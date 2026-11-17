// Run before shipping: asserts the rig is fully gone from production code.
//   node pilot/scripts/strip-check.mjs        (exit 1 if any remnant is found)
// Ship procedure: delete src/pilot, src/app/pilot, public/pilot; remove every block between the
// @pilot-start / @pilot-end markers (currently only in src/app/layout.tsx); then run this.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NEEDLES = ["@pilot-start", "@pilot-end", "@pilot-file", "PilotBoot", "PilotRig", "installWorld", "pilot/worlds", "NEXT_PUBLIC_PILOT"];
const hits = [];
const mustBeGone = ["src/pilot", "src/app/pilot", "public/pilot"].filter((p) => fs.existsSync(path.join(root, p)));
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!["node_modules", ".next", ".git", "pilot"].includes(e.name) || (e.name === "pilot" && !p.includes(path.join("src", "pilot")) && !p.includes(path.join("app", "pilot")) && !p.includes(path.join("public", "pilot")))) walk(p); continue; }
    if (!/\.(tsx?|css|mjs|json)$/.test(e.name)) continue;
    const t = fs.readFileSync(p, "utf8");
    for (const n of NEEDLES) if (t.includes(n)) hits.push(`${path.relative(root, p)} contains "${n}"`);
  }
})(path.join(root, "src"));
if (mustBeGone.length) hits.push("still present: " + mustBeGone.join(", "));
if (hits.length) { console.error("RIG REMNANTS:\n - " + hits.join("\n - ")); process.exit(1); }
console.log("strip-check: zero rig remnants");
