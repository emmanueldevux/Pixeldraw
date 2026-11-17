// @pilot-file — the rig: world switcher + viewport presets around an iframe of the real app.
//
// Why an iframe (adaptation of the kit's --cg-w stage): the kit's pages were container-query based, so a
// width on the root div was enough. This app uses Tailwind breakpoints (sm:/md:), which are MEDIA queries
// against the real window — resizing a div would not trigger them and the mock would lie. An iframe whose
// width is `var(--cg-w)` makes every media query fire exactly as in production, with ZERO changes to page code.
// The kit's contract is kept: the rig only writes --cg-w / --cg-h on <html>, and the stage consumes them.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEY, type WorldApi } from "./world";

interface WorldMeta {
  name: string;
  title: string;
  about: string;
  /** ["*"] = shell world usable on any page; ["/dashboard"] = authored for that page */
  pages: string[];
}

const PAGES = ["/chat", "/dashboard", "/ai", "/projects", "/templates", "/inspiration", "/calendar", "/billing", "/settings", "/admin", "/signup", "/home"];
// 390 / 768 / 1280 are the walk widths (kit non-negotiable #1); the rest are extra presets.
const PRESETS: { label: string; w: number | null; walk?: boolean }[] = [
  { label: "SE 375", w: 375 },
  { label: "390", w: 390, walk: true },
  { label: "768", w: 768, walk: true },
  { label: "1280", w: 1280, walk: true },
  { label: "Full", w: null },
];
const WALK_WIDTHS = [390, 768, 1280];
const WALKED_KEY = "pilot:walked";

const readWalked = (): Record<string, true> => {
  try {
    return JSON.parse(localStorage.getItem(WALKED_KEY) || "{}");
  } catch {
    return {};
  }
};

export default function PilotRig() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [worlds, setWorlds] = useState<WorldMeta[]>([]);
  const [path, setPath] = useState("/chat");
  const [world, setWorld] = useState("");
  const [w, setW] = useState<number | null>(1280);
  const [h, setH] = useState<number | null>(null);
  const [unpinned, setUnpinned] = useState<string[]>([]);
  const [showUnpinned, setShowUnpinned] = useState(false);
  const [walked, setWalked] = useState<Record<string, true>>({});
  const [nonce, setNonce] = useState(0);

  // boot: URL params -> localStorage -> defaults
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    fetch("/pilot/worlds/index.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { worlds: WorldMeta[] }) => {
        setWorlds(d.worlds);
        const wanted = q.get("world") || localStorage.getItem(STORAGE_KEY) || "";
        setWorld(d.worlds.some((x) => x.name === wanted) ? wanted : "");
      })
      .catch(() => setWorlds([]));
    setPath(q.get("path") || "/chat");
    const qw = q.get("w");
    setW(qw === "full" ? null : qw ? Number(qw) : 1280);
    setWalked(readWalked());
    setReady(true);
  }, []);

  // the rig only writes the two CSS vars (kit contract)
  useEffect(() => {
    const r = document.documentElement.style;
    w ? r.setProperty("--cg-w", `${w}px`) : r.removeProperty("--cg-w");
    h ? r.setProperty("--cg-h", `${h}px`) : r.removeProperty("--cg-h");
  }, [w, h]);

  // keep the shell URL shareable / reload-safe
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams({ path, w: w ? String(w) : "full" });
    if (world) q.set("world", world);
    window.history.replaceState(null, "", `/pilot?${q.toString()}`);
  }, [ready, path, world, w]);

  // poll the iframe's interceptor for unpinned calls
  useEffect(() => {
    const id = setInterval(() => {
      const api = (frame.current?.contentWindow as (Window & { world?: WorldApi }) | null | undefined)?.world;
      setUnpinned(api?.unpinned() ?? []);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const src = useMemo(() => {
    if (!ready) return "about:blank";
    const sep = path.includes("?") ? "&" : "?";
    return world ? `${path}${sep}world=${encodeURIComponent(world)}` : path;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, path, world, nonce]);

  const pickWorld = (name: string) => {
    if (name) localStorage.setItem(STORAGE_KEY, name);
    else localStorage.removeItem(STORAGE_KEY);
    setWorld(name);
    setNonce((n) => n + 1);
  };

  const pagePath = path.split("?")[0];
  // worlds authored for this page win; a page with none yet falls back to the shell worlds
  const specific = worlds.filter((x) => x.pages.includes(pagePath));
  const shell = worlds.filter((x) => x.pages.includes("*"));
  const walkWorlds = specific.length ? specific : shell;

  const pickPage = (next: string) => {
    setPath(next);
    const sp = worlds.filter((x) => x.pages.includes(next));
    const ok = worlds.some((x) => x.name === world && (x.pages.includes("*") || x.pages.includes(next)));
    if (!ok) pickWorld(sp[0]?.name ?? "");
  };

  const walkKey = `${pagePath}|${world || "(real)"}|${w ?? "full"}`;
  const markWalked = useCallback(() => {
    const next = { ...readWalked(), [walkKey]: true as const };
    localStorage.setItem(WALKED_KEY, JSON.stringify(next));
    setWalked(next);
  }, [walkKey]);

  const total = walkWorlds.length * WALK_WIDTHS.length;
  const done = walkWorlds.reduce((n, wd) => n + WALK_WIDTHS.filter((x) => walked[`${pagePath}|${wd.name}|${x}`]).length, 0);

  const exportWalked = () => {
    const rows = walkWorlds.map((wd) => `| ${wd.name} | ${WALK_WIDTHS.map((x) => (walked[`${pagePath}|${wd.name}|${x}`] ? "✔" : "·")).join(" | ")} |`);
    const md = [`### ${pagePath} — walked (${done}/${total})`, "| world | 390 | 768 | 1280 |", "|---|---|---|---|", ...rows].join("\n");
    navigator.clipboard?.writeText(md).catch(() => {});
  };

  const about = worlds.find((x) => x.name === world)?.about;
  const bar = "flex flex-wrap items-center gap-2 px-3 py-2 bg-[#111] text-white text-xs";
  const btn = (on: boolean) => `h-7 px-2.5 rounded-md border ${on ? "bg-[#B6FF3B] text-black border-[#B6FF3B]" : "border-[#444] hover:bg-[#222]"}`;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#1b1b1b]" data-pilot-rig>
      <div className={bar}>
        <b className="mr-1 tracking-wide">PILOT</b>

        <select className="h-7 rounded-md bg-[#222] border border-[#444] px-1.5" value={PAGES.includes(pagePath) ? pagePath : ""} onChange={(e) => e.target.value && pickPage(e.target.value)} aria-label="Page">
          {!PAGES.includes(pagePath) && <option value="">{pagePath}</option>}
          {PAGES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select className="h-7 rounded-md bg-[#222] border border-[#444] px-1.5 max-w-[240px]" value={world} onChange={(e) => pickWorld(e.target.value)} aria-label="World">
          <option value="">(no world — real backend)</option>
          {specific.length > 0 && (
            <optgroup label={`This page (${pagePath})`}>
              {specific.map((x) => (
                <option key={x.name} value={x.name}>
                  {x.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Shell (any page)">
            {shell.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name}
              </option>
            ))}
          </optgroup>
        </select>

        <span className="mx-1 opacity-40">|</span>
        {PRESETS.map((p) => (
          <button key={p.label} className={btn(w === p.w)} onClick={() => setW(p.w)}>
            {p.label}
          </button>
        ))}
        <label className="flex items-center gap-1 ml-1">
          w
          <input type="range" min={320} max={1600} value={w ?? 1600} onChange={(e) => setW(Number(e.target.value))} />
          <span className="w-9 tabular-nums">{w ?? "full"}</span>
        </label>
        <label className="flex items-center gap-1">
          h
          <input type="range" min={480} max={1400} value={h ?? 1400} onChange={(e) => setH(Number(e.target.value) >= 1400 ? null : Number(e.target.value))} />
          <span className="w-9 tabular-nums">{h ?? "fit"}</span>
        </label>

        <span className="mx-1 opacity-40">|</span>
        <button className={btn(false)} onClick={() => frame.current?.contentWindow?.location.reload()}>
          Reload
        </button>
        <button className={btn(!!walked[walkKey])} onClick={markWalked} title="Mark this page × world × width as walked">
          {walked[walkKey] ? "Walked ✔" : "Mark walked"}
        </button>
        <button className={btn(false)} onClick={exportWalked} title="Copy the walk matrix for this page as markdown">
          {done}/{total} walked · copy
        </button>
        <button className={`${btn(showUnpinned)} ${unpinned.length ? "!border-red-400 !text-red-300" : ""}`} onClick={() => setShowUnpinned((s) => !s)}>
          unpinned: {unpinned.length}
        </button>
      </div>

      {about && <div className="px-3 py-1 text-[11px] bg-[#1d2a0a] text-[#d6f58a]">{about}</div>}
      {showUnpinned && (
        <div className="px-3 py-2 text-[11px] bg-[#2a0f0f] text-red-200 font-mono max-h-40 overflow-auto">
          {unpinned.length === 0 ? "Nothing unpinned in this world so far." : unpinned.map((k) => <div key={k}>{k}</div>)}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto flex justify-center items-start p-3">
        <iframe
          key={nonce}
          ref={frame}
          src={src}
          title="Pilot stage"
          style={{ width: "var(--cg-w, 100%)", height: "var(--cg-h, 100%)", maxWidth: "100%", border: 0, background: "#fff", borderRadius: 8 }}
        />
      </div>
    </div>
  );
}
