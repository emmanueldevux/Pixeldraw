// @pilot-file — installs the world interceptor as early as possible in the browser.
// Imported by src/app/layout.tsx between the @pilot-start/@pilot-end markers, BEFORE <AuthProvider>,
// so the module runs before SessionProvider's first /api/auth/session fetch.
// Inert unless NEXT_PUBLIC_PILOT=1 (and inert even then until a world is chosen via ?world= / localStorage).
"use client";

import { installWorld } from "./world";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_PILOT === "1") {
  installWorld(window as unknown as Parameters<typeof installWorld>[0]);
}

// Static-export build (artifact hosting): there is no server and no client router payloads, so a click on an
// in-app link would navigate the iframe to an absolute path that does not exist. Hand it to the rig page instead.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_PILOT_STATIC === "1") {
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const href = a?.getAttribute("href") || "";
      if (!a || !href.startsWith("/")) return; // #hash, mailto:, https: left alone
      e.preventDefault();
      e.stopPropagation();
      if (window.parent !== window) window.parent.postMessage({ pilotNav: href.split(/[?#]/)[0] }, "*");
    },
    true,
  );
}

export default function PilotBoot() {
  return null;
}
