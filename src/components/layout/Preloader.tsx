// ============================================================
// UXLLY — Preloader
// White screen with the logo doing a heartbeat, shown the first time
// the site is opened each day. An inline script in <head> adds the
// "mk-seen" class before paint when today's already been shown, so
// returning visitors never see a flash.
// ============================================================
"use client";

import { useEffect, useRef, useState } from "react";

export const PRELOADER_KEY = "mk_preloader_day";
// ?preloader=1 in the address bar forces it to show (for testing).
export const preloaderGuard = `try{if(/[?&]preloader\\b/.test(location.search))localStorage.removeItem("${PRELOADER_KEY}");if(localStorage.getItem("${PRELOADER_KEY}")===new Date().toDateString())document.documentElement.classList.add("mk-seen")}catch(e){}`;

const CSS = `
html.mk-seen #mk-preloader{display:none}
#mk-preloader{position:fixed;inset:0;z-index:99999;background:#fff;display:flex;align-items:center;justify-content:center;clip-path:circle(150% at 50% 50%)}
/* exit: the logo swells then pops away, and the white closes like an iris onto the page */
#mk-preloader.mk-out{pointer-events:none;animation:mk-iris .75s cubic-bezier(.76,0,.24,1) .3s forwards}
#mk-preloader.mk-out .mk-beat{animation:mk-pop .45s cubic-bezier(.5,-0.4,.7,.2) forwards}
@keyframes mk-pop{0%{transform:scale(1);opacity:1}35%{transform:scale(1.22);opacity:1}100%{transform:scale(0);opacity:0}}
@keyframes mk-iris{0%{clip-path:circle(150% at 50% 50%)}100%{clip-path:circle(0% at 50% 50%)}}
#mk-preloader .mk-beat{width:92px;height:92px;object-fit:contain;opacity:0;will-change:transform}
#mk-preloader:not(.mk-out) .mk-beat.mk-ready{opacity:1;animation:mk-heartbeat 1.1s ease-in-out infinite}
@keyframes mk-heartbeat{
  0%{transform:scale(1)}
  14%{transform:scale(1.18)}
  28%{transform:scale(1)}
  42%{transform:scale(1.12)}
  70%,100%{transform:scale(1)}
}
@media (prefers-reduced-motion:reduce){#mk-preloader .mk-beat.mk-ready{animation:none}#mk-preloader.mk-out,#mk-preloader.mk-out .mk-beat{animation-duration:.01s;animation-delay:0s}}
`;

export default function Preloader() {
  const [out, setOut] = useState(false);
  const [gone, setGone] = useState(false);
  const [ready, setReady] = useState(false); // logo has loaded: only then start the beat
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (document.documentElement.classList.contains("mk-seen")) {
      setGone(true);
      return;
    }
    let started = Date.now();
    let done = false;
    let logoOk = false;
    const maybe = () => { if (logoOk && (document.readyState === "complete")) finish(); };
    const finish = () => {
      if (done) return;
      done = true;
      // Always let at least two beats play so it doesn't flicker.
      const wait = Math.max(0, 1800 - (Date.now() - started));
      window.setTimeout(() => {
        setOut(true);
        try { localStorage.setItem(PRELOADER_KEY, new Date().toDateString()); } catch { /* private mode */ }
        window.setTimeout(() => setGone(true), 1150);
      }, wait);
    };
    const img = imgRef.current;
    const onLogo = () => {
      logoOk = true;
      started = Date.now(); // count the beats from when the logo is actually visible
      setReady(true);
      if (document.readyState === "complete") finish();
      else window.addEventListener("load", maybe, { once: true });
    };
    if (!img || img.complete) {
      // cached, or already decoded (or broken: onError handles that)
      if (img && img.naturalWidth > 0) onLogo();
    }
    img?.addEventListener("load", onLogo, { once: true });
    img?.addEventListener("error", () => { logoOk = true; finish(); }, { once: true });
    const cap = window.setTimeout(finish, 6000); // never trap the visitor
    return () => window.clearTimeout(cap);
  }, []);

  if (gone) return null;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div id="mk-preloader" className={out ? "mk-out" : ""} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          className={`mk-beat${ready ? " mk-ready" : ""}`}
          src="/templates/images/preloader%20logo.png"
          alt=""
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>
    </>
  );
}

/** Shown while the session is being checked (hard refresh etc.): white, logo beating. */
export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <style dangerouslySetInnerHTML={{ __html: "@keyframes mk-heartbeat{0%{transform:scale(1)}14%{transform:scale(1.18)}28%{transform:scale(1)}42%{transform:scale(1.12)}70%,100%{transform:scale(1)}}" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/templates/images/preloader%20logo.png"
        alt=""
        style={{ width: 92, height: 92, objectFit: "contain", animation: "mk-heartbeat 1.1s ease-in-out infinite" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}
