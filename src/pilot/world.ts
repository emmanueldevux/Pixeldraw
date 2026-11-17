// @pilot-file — fetch interceptor ("world.js" from the Pilot Loop kit, adapted to Next/React).
// Pure TypeScript, no JSX, no React: it must run in a plain Node test (pilot/scripts/test-world.mjs).
//
// What it does
//   - Patches window.fetch ONCE. Only same-origin /api/* calls are "pinnable"; everything else
//     (/_next RSC fetches, images, blobs, third-party) always passes through untouched.
//   - A world is a named state: pinned responses keyed by  fetch:METHOD:path[?query]:bodyHash
//   - policy: "replay-only"  -> must be pinned. Unpinned => console.warn LOUDLY + 599 (never a silent 200,
//                               never a fake logout: an unpinned auth probe is state UNKNOWN).
//             "passthrough"  -> call the real fetch.
//   - No world selected => the interceptor is inert (everything is real).
//
// Lookup order for one request (first hit wins):
//   1. fetch:M:/path?query:HASH   2. fetch:M:/path?query:   3. fetch:M:/path:HASH   4. fetch:M:/path:
// so authors normally pin  fetch:GET:/api/projects:  and only add a query/hash when a page really
// calls the same path with different answers.
//
// Extras beyond the kit (see pilot/LEDGER.md PRJ-0005..0006):
//   - "extends": a world may extend partial worlds (shell calls are pinned once, not copy-pasted 8x).
//   - "sequence": an entry may be a list of responses served in order (last one repeats) — for polling
//     endpoints like /api/tasks/:id/step.

export type Policy = "replay-only" | "passthrough";

export interface Entry {
  status?: number;
  body?: unknown;
  /** raw text body (e.g. SSE); wins over body */
  bodyText?: string;
  headers?: Record<string, string>;
  delayMs?: number;
  sequence?: Omit<Entry, "sequence">[];
}

export interface World {
  name: string;
  $comment?: string;
  extends?: string | string[];
  policy?: Record<string, Policy>;
  entries?: Record<string, Entry>;
}

export interface ResolvedWorld {
  name: string;
  policy: Record<string, Policy>;
  entries: Record<string, Entry>;
}

export interface CallRecord {
  key: string;
  pinned: boolean;
  status: number;
  at: number;
}

export interface WorldApi {
  readonly name: string | null;
  readonly ready: Promise<void>;
  import(w: World | ResolvedWorld): void;
  loadFrom(url: string): Promise<void>;
  unpinned(): string[];
  calls(): CallRecord[];
  reset(): void;
}

export const STORAGE_KEY = "pilot:world";
export const WORLDS_BASE = "/pilot/worlds/";
const NO_BODY = new Set([101, 204, 205, 304]);

// ---------- small pure helpers (exported for the tests) ----------

/** djb2 over the raw body string -> short hex. Empty / non-string body => "". */
export function bodyHash(body: unknown): string {
  if (typeof body !== "string" || body === "") return "";
  let h = 5381;
  for (let i = 0; i < body.length; i++) h = ((h << 5) + h + body.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export function candidateKeys(method: string, pathname: string, search: string, hash: string): string[] {
  const m = method.toUpperCase();
  const out: string[] = [];
  if (search) {
    if (hash) out.push(`fetch:${m}:${pathname}${search}:${hash}`);
    out.push(`fetch:${m}:${pathname}${search}:`);
  }
  if (hash) out.push(`fetch:${m}:${pathname}:${hash}`);
  out.push(`fetch:${m}:${pathname}:`);
  return out;
}

/** Merge a list of worlds in order (later wins). */
export function mergeWorlds(name: string, list: Array<Pick<World, "policy" | "entries">>): ResolvedWorld {
  const out: ResolvedWorld = { name, policy: {}, entries: {} };
  for (const w of list) {
    Object.assign(out.policy, w.policy || {});
    Object.assign(out.entries, w.entries || {});
  }
  if (!out.policy.default) out.policy.default = "replay-only";
  return out;
}

/** Resolve "extends" recursively (cycle-safe). `load` fetches one raw world by name. */
export async function resolveWorld(name: string, load: (n: string) => Promise<World>, seen: string[] = []): Promise<ResolvedWorld> {
  if (seen.includes(name)) throw new Error(`pilot: extends cycle ${[...seen, name].join(" -> ")}`);
  // "a+b" layers worlds (later wins): a page world under a shell world, so every page has its data in every shell state.
  if (name.includes("+")) {
    const layers: ResolvedWorld[] = [];
    for (const part of name.split("+").filter(Boolean)) layers.push(await resolveWorld(part, load, seen));
    return mergeWorlds(name, layers);
  }
  const raw = await load(name);
  const parents = raw.extends ? (Array.isArray(raw.extends) ? raw.extends : [raw.extends]) : [];
  const resolvedParents: ResolvedWorld[] = [];
  for (const p of parents) resolvedParents.push(await resolveWorld(p, load, [...seen, name]));
  return mergeWorlds(raw.name || name, [...resolvedParents, raw]);
}

const UNIT_MS: Record<string, number> = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 };

/** Time tokens: "$now", "$now-3h", "$now+2d" become ISO timestamps at SERVE time, so relative labels
 *  ("5m ago", "just now") and date ranges stay true whenever the world is walked. Deep-walks JSON. */
export function expandTime(v: unknown, now: number = Date.now()): unknown {
  if (typeof v === "string") {
    const m = v.match(/^\$now(?:([+-])(\d+)([smhd]))?$/);
    if (!m) return v;
    const off = m[1] ? (m[1] === "-" ? -1 : 1) * Number(m[2]) * UNIT_MS[m[3]] : 0;
    return new Date(now + off).toISOString();
  }
  if (Array.isArray(v)) return v.map((x) => expandTime(x, now));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, expandTime(x, now)]));
  return v;
}

function toResponse(e: Entry): Response {
  const status = e.status ?? 200;
  const headers: Record<string, string> = { ...(e.headers || {}) };
  if (NO_BODY.has(status)) return new Response(null, { status, headers });
  if (e.bodyText !== undefined) {
    if (!headers["content-type"]) headers["content-type"] = "text/plain";
    return new Response(e.bodyText, { status, headers });
  }
  if (!headers["content-type"]) headers["content-type"] = "application/json";
  return new Response(JSON.stringify(expandTime(e.body === undefined ? {} : e.body)), { status, headers });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------- the installer ----------

interface Target {
  fetch: typeof fetch;
  location: { origin: string; search: string };
  localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  console?: Pick<Console, "warn" | "info">;
  [k: string]: unknown;
}

export function readWorldName(t: Pick<Target, "location" | "localStorage">): string | null {
  let fromUrl: string | null = null;
  try {
    fromUrl = new URLSearchParams(t.location.search).get("world");
  } catch {
    /* ignore */
  }
  try {
    if (fromUrl) {
      t.localStorage?.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return t.localStorage?.getItem(STORAGE_KEY) || null;
  } catch {
    return fromUrl;
  }
}

export function installWorld(t: Target = globalThis as unknown as Target): WorldApi {
  const existing = t.world as WorldApi | undefined;
  if (existing) return existing; // idempotent

  const realFetch: typeof fetch = t.fetch.bind(t);
  const log = t.console || console;
  let current: ResolvedWorld | null = null;
  let currentName: string | null = null;
  let loadFailed: string | null = null;
  const seq = new Map<string, number>();
  const unpinnedKeys = new Set<string>();
  const callLog: CallRecord[] = [];

  const rawLoader = async (n: string): Promise<World> => {
    const res = await realFetch(`${WORLDS_BASE}${encodeURIComponent(n)}.world.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`world file "${n}" -> HTTP ${res.status}`);
    return (await res.json()) as World;
  };

  const setWorld = (w: ResolvedWorld) => {
    current = w;
    currentName = w.name;
    seq.clear();
    unpinnedKeys.clear();
    callLog.length = 0;
  };

  const api: WorldApi & { _setReady(p: Promise<void>): void } = {
    get name() {
      return currentName;
    },
    ready: Promise.resolve(),
    _setReady(p) {
      (api as { ready: Promise<void> }).ready = p;
    },
    import(w) {
      const base = current ? [current] : [];
      setWorld(mergeWorlds(w.name || currentName || "imported", [...base, w as World]));
    },
    async loadFrom(url) {
      const res = await realFetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`loadFrom ${url} -> HTTP ${res.status}`);
      api.import((await res.json()) as World);
    },
    unpinned: () => [...unpinnedKeys],
    calls: () => callLog.slice(),
    reset() {
      seq.clear();
      unpinnedKeys.clear();
      callLog.length = 0;
    },
  };

  const patched: typeof fetch = async (input, init) => {
    // Cheap exits first: no world selected -> fully inert.
    const wantWorld = currentName !== null || loadFailed !== null || chosenName !== null;
    if (!wantWorld) return realFetch(input, init);

    let url: URL;
    let method = (init?.method || "GET").toUpperCase();
    let rawBody: unknown = init?.body;
    try {
      if (typeof input === "string") url = new URL(input, t.location.origin);
      else if (input instanceof URL) url = input;
      else {
        url = new URL((input as Request).url, t.location.origin);
        method = (init?.method || (input as Request).method || "GET").toUpperCase();
        if (rawBody === undefined && method !== "GET" && method !== "HEAD") rawBody = await (input as Request).clone().text();
      }
    } catch {
      return realFetch(input, init);
    }

    const pinnable = url.origin === t.location.origin && url.pathname.startsWith("/api/");
    if (!pinnable) return realFetch(input, init);

    await api.ready;

    if (loadFailed || !current) {
      const why = loadFailed || "no world loaded";
      log.warn(`[pilot] ${method} ${url.pathname} -> 599 (${why})`);
      return toResponse({ status: 599, body: { error: "pilot_world_unavailable", detail: why } });
    }

    const keys = candidateKeys(method, url.pathname, url.search, bodyHash(rawBody));
    const hit = keys.find((k) => current!.entries[k] !== undefined);
    const policyFor = (): Policy => {
      for (const k of keys) if (current!.policy[k]) return current!.policy[k];
      return current!.policy.default || "replay-only";
    };

    if (hit) {
      let e = current.entries[hit];
      if (e.sequence && e.sequence.length) {
        const i = seq.get(hit) ?? 0;
        seq.set(hit, i + 1);
        e = e.sequence[Math.min(i, e.sequence.length - 1)];
      }
      await sleep(e.delayMs ?? 50);
      const res = toResponse(e);
      callLog.push({ key: hit, pinned: true, status: res.status, at: Date.now() });
      return res;
    }

    if (policyFor() === "passthrough") {
      callLog.push({ key: keys[keys.length - 1], pinned: false, status: -1, at: Date.now() });
      return realFetch(input, init);
    }

    const suggestion = keys[keys.length - 1];
    unpinnedKeys.add(suggestion);
    callLog.push({ key: suggestion, pinned: false, status: 599, at: Date.now() });
    log.warn(`[pilot] UNPINNED in world "${currentName}": ${suggestion}  (pin it in the world file; returning 599)`);
    return toResponse({ status: 599, body: { error: "pilot_unpinned", key: suggestion, world: currentName } });
  };

  // Decide the world up front so the very first fetch already waits for it.
  const chosenName = readWorldName(t);
  if (chosenName) {
    api._setReady(
      resolveWorld(chosenName, rawLoader)
        .then((w) => {
          setWorld(w);
          log.info(`[pilot] world "${w.name}" active (${Object.keys(w.entries).length} pinned calls)`);
        })
        .catch((err: Error) => {
          loadFailed = `world "${chosenName}" failed to load: ${err.message}`;
          log.warn(`[pilot] ${loadFailed}`);
        })
    );
  }

  t.fetch = patched;
  t.world = api;
  return api;
}
