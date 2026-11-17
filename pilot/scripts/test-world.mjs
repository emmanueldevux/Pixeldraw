// Run: node pilot/scripts/test-world.mjs     (Node >= 22.18, type stripping)
// Exercises src/pilot/world.ts against the real world files in public/pilot/worlds.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { installWorld, bodyHash, candidateKeys, resolveWorld, expandTime } from "../../src/pilot/world.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUB = path.join(root, "public");
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log("  ok  " + name); };

function makeTarget({ search = "", store = {} } = {}) {
  const passthrough = [];
  const warns = [];
  const target = {
    location: { origin: "http://app.test", search },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    console: { warn: (...a) => warns.push(a.join(" ")), info: () => {} },
    async fetch(input, init) {
      const url = new URL(typeof input === "string" ? input : input.url, "http://app.test");
      if (url.pathname.startsWith("/pilot/worlds/")) {
        const f = path.join(PUB, url.pathname);
        if (!fs.existsSync(f)) return new Response("nope", { status: 404 });
        return new Response(fs.readFileSync(f, "utf8"), { status: 200, headers: { "content-type": "application/json" } });
      }
      passthrough.push(url.pathname + url.search);
      return new Response(JSON.stringify({ real: true }), { status: 200 });
    },
  };
  return { target, passthrough, warns, store };
}
const json = async (p) => (await p).json();

console.log("world.ts");

await test("no world selected => fully inert (everything is real)", async () => {
  const { target, passthrough } = makeTarget();
  installWorld(target);
  const r = await target.fetch("/api/projects");
  assert.deepEqual(await r.json(), { real: true });
  assert.deepEqual(passthrough, ["/api/projects"]);
});

await test("?world= resolves extends chain (child -> _signed-in -> _base)", async () => {
  const { target } = makeTarget({ search: "?world=paid-power-user" });
  installWorld(target);
  const session = await json(target.fetch("/api/auth/session"));
  assert.equal(session.user.id, "usr_pilot_01");
  const csrf = await json(target.fetch("/api/auth/csrf")); // pinned in _base only
  assert.equal(csrf.csrfToken, "pilot-csrf-token");
  const ov = await json(target.fetch("/api/billing/overview"));
  assert.equal(ov.plan.key, "pro");
  assert.equal(ov.balanceMilli, 412500);
});

await test("3-level extends: out-of-credits-402 -> free-trial-exhausted -> _signed-in", async () => {
  const { target } = makeTarget({ search: "?world=out-of-credits-402" });
  installWorld(target);
  const ov = await json(target.fetch("/api/billing/overview"));
  assert.equal(ov.free.available, false);
  assert.equal(ov.balanceMilli, 0);
  const r = await target.fetch("/api/ai/chat", { method: "POST", body: JSON.stringify({ messages: [] }) });
  assert.equal(r.status, 402);
  const b = await r.json();
  assert.equal(b.error, "insufficient_credits");
  assert.equal(typeof b.neededMilli, "number");
});

await test("unpinned call in replay-only => 599, warns loudly, listed in unpinned()", async () => {
  const { target, warns } = makeTarget({ search: "?world=signed-out" });
  const api = installWorld(target);
  const r = await target.fetch("/api/generations?limit=60");
  assert.equal(r.status, 599);
  assert.equal((await r.json()).error, "pilot_unpinned");
  assert.ok(warns.some((w) => w.includes("UNPINNED") && w.includes("/api/generations")));
  assert.deepEqual(api.unpinned(), ["fetch:GET:/api/generations:"]);
});

await test("signed-out world: session is {} (never a fake user)", async () => {
  const { target } = makeTarget({ search: "?world=signed-out" });
  installWorld(target);
  assert.deepEqual(await json(target.fetch("/api/auth/session")), {});
});

await test("non-/api and cross-origin requests always pass through, even in a world", async () => {
  const { target, passthrough } = makeTarget({ search: "?world=signed-out" });
  installWorld(target);
  await target.fetch("/_next/static/chunk.js");
  await target.fetch("/templates/a.jpg");
  await target.fetch("https://api.paystack.co/x");
  await target.fetch("/api/anything-else-origin", {}).catch(() => {});
  assert.ok(passthrough.includes("/_next/static/chunk.js"));
  assert.ok(passthrough.includes("/templates/a.jpg"));
  assert.ok(passthrough.includes("/x"), "cross-origin URL reached real fetch");
});

await test("query fallback: path-only pin answers a call that has a query string", async () => {
  const { target } = makeTarget({ search: "?world=paid-power-user" });
  installWorld(target);
  const r = await json(target.fetch("/api/projects?anything=1"));
  assert.equal(r.success, true);
  assert.equal(r.data.length, 4);
});

await test("most specific key wins; sequence serves in order and the last repeats", async () => {
  const { target } = makeTarget({ search: "?world=signed-out" });
  const api = installWorld(target);
  await api.ready;
  const body = JSON.stringify({ a: 1 });
  api.import({ name: "signed-out", entries: {
    "fetch:POST:/api/x:": { body: { which: "path" } },
    ["fetch:POST:/api/x:" + bodyHash(body)]: { body: { which: "hash" } },
    "fetch:POST:/api/tasks/1/step:": { sequence: [{ body: { n: 1 }, delayMs: 0 }, { body: { n: 2 }, delayMs: 0 }] },
  } });
  assert.equal((await json(target.fetch("/api/x", { method: "POST", body }))).which, "hash");
  assert.equal((await json(target.fetch("/api/x", { method: "POST", body: "{}" }))).which, "path");
  const seq = [];
  for (let i = 0; i < 3; i++) seq.push((await json(target.fetch("/api/tasks/1/step", { method: "POST" }))).n);
  assert.deepEqual(seq, [1, 2, 2]);
  // import() must keep the world's earlier pins (merge, not replace)
  assert.equal((await json(target.fetch("/api/auth/session"))).constructor, Object);
});

await test("204 pins produce a bodiless Response; bodyText/headers pass through", async () => {
  const { target } = makeTarget({ search: "?world=signed-out" });
  const api = installWorld(target);
  await api.ready;
  api.import({ name: "signed-out", entries: {
    "fetch:DELETE:/api/jobs/9:": { status: 204 },
    "fetch:POST:/api/ai/stream:": { bodyText: "data: hi\n\n", headers: { "content-type": "text/event-stream" }, delayMs: 0 },
  } });
  const r = await target.fetch("/api/jobs/9", { method: "DELETE" });
  assert.equal(r.status, 204);
  const s = await target.fetch("/api/ai/stream", { method: "POST" });
  assert.equal(s.headers.get("content-type"), "text/event-stream");
  assert.equal(await s.text(), "data: hi\n\n");
});

await test("Request objects are understood (method + body hash from clone)", async () => {
  const { target } = makeTarget({ search: "?world=signed-out" });
  const api = installWorld(target);
  await api.ready;
  api.import({ name: "signed-out", entries: { "fetch:POST:/api/onboarding:": { body: { via: "request" }, delayMs: 0 } } });
  const req = new Request("http://app.test/api/onboarding", { method: "POST", body: JSON.stringify({ action: "skip" }) });
  assert.equal((await json(target.fetch(req))).via, "request");
});

await test("missing world file => every pinnable call is 599 pilot_world_unavailable (never a silent 200)", async () => {
  const { target, warns } = makeTarget({ search: "?world=does-not-exist" });
  installWorld(target);
  const r = await target.fetch("/api/auth/session");
  assert.equal(r.status, 599);
  assert.equal((await r.json()).error, "pilot_world_unavailable");
  assert.ok(warns.some((w) => w.includes("failed to load")));
});

await test("world choice persists in localStorage across a reload without ?world=", async () => {
  const store = {};
  const a = makeTarget({ search: "?world=admin", store });
  installWorld(a.target);
  assert.equal(store["pilot:world"], "admin");
  const b = makeTarget({ search: "", store });
  installWorld(b.target);
  const ov = await json(b.target.fetch("/api/billing/overview"));
  assert.equal(ov.isAdmin, true);
});

await test("installWorld is idempotent (no double patching)", async () => {
  const { target } = makeTarget({ search: "?world=signed-out" });
  const a = installWorld(target);
  const patched = target.fetch;
  const b = installWorld(target);
  assert.equal(a, b);
  assert.equal(target.fetch, patched);
});

await test("extends cycles are detected", async () => {
  const worlds = { a: { name: "a", extends: "b" }, b: { name: "b", extends: "a" } };
  await assert.rejects(resolveWorld("a", async (n) => worlds[n]), /cycle/);
});

await test("candidateKeys order: query+hash, query, path+hash, path", () => {
  assert.deepEqual(candidateKeys("get", "/api/x", "?q=1", "ab"), ["fetch:GET:/api/x?q=1:ab", "fetch:GET:/api/x?q=1:", "fetch:GET:/api/x:ab", "fetch:GET:/api/x:"]);
  assert.deepEqual(candidateKeys("GET", "/api/x", "", ""), ["fetch:GET:/api/x:"]);
});

await test("time tokens expand at serve time (deep), plain strings untouched", async () => {
  const now = Date.parse("2026-11-16T12:00:00.000Z");
  const out = expandTime({ a: "$now-3h", b: ["$now+2d", "$now"], c: "not $now", d: 5 }, now);
  assert.deepEqual(out, { a: "2026-11-16T09:00:00.000Z", b: ["2026-11-18T12:00:00.000Z", "2026-11-16T12:00:00.000Z"], c: "not $now", d: 5 });
  const { target } = makeTarget({ search: "?world=signed-out" });
  const api = installWorld(target);
  await api.ready;
  api.import({ name: "signed-out", entries: { "fetch:GET:/api/t:": { body: { at: "$now-1h" }, delayMs: 0 } } });
  const at = Date.parse((await json(target.fetch("/api/t"))).at);
  assert.ok(Math.abs(Date.now() - 36e5 - at) < 5000);
});

await test("'a+b' layers worlds, later wins, each keeps its own extends", async () => {
  const W = { base: { name: "base", entries: { "fetch:GET:/x:": { body: 1 } } }, page: { name: "page", extends: "base", entries: { "fetch:GET:/p:": { body: "page" }, "fetch:GET:/x:": { body: 2 } } }, shell: { name: "shell", entries: { "fetch:GET:/x:": { body: 3 } } } };
  const r = await resolveWorld("page+shell", async (n) => W[n]);
  assert.equal(r.entries["fetch:GET:/x:"].body, 3);
  assert.equal(r.entries["fetch:GET:/p:"].body, "page");
});

console.log(`\n${passed} passed`);
