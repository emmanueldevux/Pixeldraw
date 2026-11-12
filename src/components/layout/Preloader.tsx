// ============================================================
// UXLLY — Preloader
// White screen with the logo doing a heartbeat, shown the first time
// the site is opened each day. An inline script in <head> adds the
// "mk-seen" class before paint when today's already been shown, so
// returning visitors never see a flash.
// ============================================================
"use client";

import { useEffect, useState } from "react";

export const PRELOADER_KEY = "mk_preloader_day";
// ?preloader=1 in the address bar forces it to show (for testing).
export const preloaderGuard = `try{if(/[?&]preloader\\b/.test(location.search))localStorage.removeItem("${PRELOADER_KEY}");if(localStorage.getItem("${PRELOADER_KEY}")===new Date().toDateString())document.documentElement.classList.add("mk-seen")}catch(e){}`;

const CSS = `
html.mk-seen #mk-preloader{display:none}
#mk-preloader{position:fixed;inset:0;z-index:99999;background:#fff;display:flex;align-items:center;justify-content:center;transition:opacity .5s ease,visibility .5s ease}
#mk-preloader.mk-out{opacity:0;visibility:hidden}
#mk-preloader .mk-beat{width:92px;height:92px;object-fit:contain;animation:mk-heartbeat 1.1s ease-in-out infinite;will-change:transform}
@keyframes mk-heartbeat{
  0%{transform:scale(1)}
  14%{transform:scale(1.18)}
  28%{transform:scale(1)}
  42%{transform:scale(1.12)}
  70%,100%{transform:scale(1)}
}
@media (prefers-reduced-motion:reduce){#mk-preloader .mk-beat{animation:none}}
`;

export default function Preloader() {
  const [out, setOut] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (document.documentElement.classList.contains("mk-seen")) {
      setGone(true);
      return;
    }
    const started = Date.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // Always let at least two beats play so it doesn't flicker.
      const wait = Math.max(0, 1800 - (Date.now() - started));
      window.setTimeout(() => {
        setOut(true);
        try { localStorage.setItem(PRELOADER_KEY, new Date().toDateString()); } catch { /* private mode */ }
        window.setTimeout(() => setGone(true), 600);
      }, wait);
    };
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    const cap = window.setTimeout(finish, 5000); // never trap the visitor
    return () => window.clearTimeout(cap);
  }, []);

  if (gone) return null;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div id="mk-preloader" className={out ? "mk-out" : ""} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="mk-beat"
          src="/templates/images/preloader%20logo.png"
          alt=""
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>
    </>
  );
}
