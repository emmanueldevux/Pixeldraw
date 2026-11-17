// Run: node pilot/scripts/check-worlds.mjs
// Static checks tying world fixtures to the REAL code (types + option lists), so a fixture can't
// quietly drift from what the app expects. Exits non-zero on any failure.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorld } from "../../src/pilot/world.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "public/pilot/worlds");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const errors = [];
const fail = (m) => errors.push(m);

// ---- ground truth, parsed from source ----
const ifaceKeys = (src, name) => {
  const m = src.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error("interface not found: " + name);
  return [...m[1].matchAll(/^  (\w+)\??:/gm)].map((x) => x[1]);
};
const optionValues = (src, name) => {
  const m = src.match(new RegExp(`export const ${name}: Option\\[\\] = \\[([\\s\\S]*?)\\n\\];`));
  if (!m) throw new Error("option list not found: " + name);
  return [...m[1].matchAll(/value: "([^"]+)"/g)].map((x) => x[1]);
};
const billingTypes = read("src/components/billing/types.ts");
const onb = read("src/lib/onboarding.ts");
const OVERVIEW_KEYS = ifaceKeys(billingTypes, "BillingOverview");
const FREE_KEYS = ["enabled", "available", "usedTotal", "cap", "usedToday", "todayLimit", "firstDay"]; // FreeStatus, billing/free.ts
const ANSWER_KEYS = ifaceKeys(onb, "OnboardingAnswers");
const OPTIONS = {
  industry: optionValues(onb, "INDUSTRIES"), platforms: optionValues(onb, "PLATFORMS"), postsPerDay: optionValues(onb, "POSTS_PER_DAY"),
  goals: optionValues(onb, "GOALS"), styles: optionValues(onb, "STYLES"), role: optionValues(onb, "ROLES"),
  teamSize: optionValues(onb, "TEAM_SIZES"), referral: optionValues(onb, "REFERRALS"),
};
const STATUSES = ["none", "skipped", "completed"];
const schema = read("prisma/schema.prisma");
const SCALARS = new Set(["String", "Int", "Float", "Boolean", "DateTime", "Json", "BigInt", "Decimal"]);
const modelScalars = (name) => {
  const m = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error("prisma model not found: " + name);
  return [...m[1].matchAll(/^\s+(\w+)\s+(\w+)(\?|\[\])?/gm)].filter((x) => SCALARS.has(x[2]) && x[3] !== "[]").map((x) => x[1]);
};
const BRAND_KEYS = [...modelScalars("Brand"), "styleGuide", "channels"];
const CHANNEL_KEYS = [...modelScalars("Channel"), "_count"];
const projectsRoute = read("src/app/api/projects/route.ts");
const SG_KEYS = [...(projectsRoute.match(/styleGuide: \{\s*select: \{([\s\S]*?)\}/)?.[1] || "").matchAll(/(\w+): true/g)].map((x) => x[1]);
const genRoute = read("src/app/api/generations/route.ts");
const GEN_KEYS = [...(genRoute.match(/select: \{([^}]*)\}/)?.[1] || "").matchAll(/(\w+): true/g)].map((x) => x[1]);
const GEN_KINDS = [...(read("src/lib/generations.ts").match(/kind: ((?:"\w+"(?: \| )?)+)/)?.[1] || "").matchAll(/"(\w+)"/g)].map((x) => x[1]);
const PAGE_CALLS = JSON.parse(read("pilot/page-calls.json"));
delete PAGE_CALLS.$comment;
const PLATFORM_KEYS = [...read("src/lib/platforms.ts").matchAll(/^\s+key: "([a-z_]+)"/gm)].map((x) => x[1]);

const checkBrands = (tag, list) => {
  for (const b of list || []) {
    sameKeys(tag(`brand "${b.name}"`), b, BRAND_KEYS);
    if (b.styleGuide) sameKeys(tag(`brand "${b.name}".styleGuide`), b.styleGuide, SG_KEYS);
    for (const c of b.channels || []) {
      sameKeys(tag(`channel "${c.name}"`), c, CHANNEL_KEYS);
      if (!PLATFORM_KEYS.includes(c.platform)) fail(tag(`channel platform "${c.platform}" is not a real platform key`));
      if (!Number.isInteger(c._count?.posts)) fail(tag(`channel "${c.name}" _count.posts must be an integer`));
    }
  }
};
const checkGenerations = (tag, rows) => {
  for (const g of rows || []) {
    sameKeys(tag(`generation ${g.id}`), g, GEN_KEYS);
    if (!GEN_KINDS.includes(g.kind)) fail(tag(`generation ${g.id} kind "${g.kind}" not in ${GEN_KINDS}`));
    if (!Array.isArray(g.imageUrls)) fail(tag(`generation ${g.id} imageUrls must be an array`));
    for (const u of g.imageUrls || []) if (u.startsWith("/") && !fs.existsSync(path.join(root, "public", u))) fail(tag(`generation ${g.id} image ${u} does not exist in public/`));
  }
};
const sameKeys = (label, obj, keys) => {
  const have = Object.keys(obj).sort().join(",");
  const want = [...keys].sort().join(",");
  if (have !== want) fail(`${label}: keys differ.\n      have ${have}\n      want ${want}`);
};

// ---- load ----
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".world.json"));
const names = files.map((f) => f.replace(/\.world\.json$/, ""));
const load = async (n) => JSON.parse(fs.readFileSync(path.join(dir, n + ".world.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")).worlds;

const publicNames = names.filter((n) => !n.startsWith("_"));
for (const n of publicNames) if (!manifest.some((m) => m.name === n)) fail(`${n}: missing from index.json`);
for (const m of manifest) if (!Array.isArray(m.pages) || !m.pages.length) fail(`index.json: "${m.name}" needs pages: ["*"] or ["/route"]`);
for (const m of manifest) for (const pg of m.pages || []) if (pg !== "*" && !(pg in PAGE_CALLS)) fail(`index.json: "${m.name}" lists unknown page ${pg}`);
for (const m of manifest) if (!publicNames.includes(m.name)) fail(`index.json lists "${m.name}" but no such world file`);

for (const n of publicNames) {
  let w;
  try { w = await resolveWorld(n, load); } catch (e) { fail(`${n}: ${e.message}`); continue; }
  const tag = (m) => `${n}: ${m}`;
  if (w.policy.default !== "replay-only") fail(tag(`default policy must be replay-only (got ${w.policy.default})`));
  for (const k of ["fetch:GET:/api/auth/session:", "fetch:GET:/api/auth/csrf:", "fetch:GET:/api/auth/providers:"]) if (!w.entries[k]) fail(tag(`does not pin ${k}`));

  const sessionEntry = w.entries["fetch:GET:/api/auth/session:"];
  const session = sessionEntry?.status === 200 ? sessionEntry.body : undefined; // a 500 pin is an intentional failure world
  const signedIn = session && session.user;
  if (signedIn) {
    for (const k of ["fetch:GET:/api/billing/overview:", "fetch:GET:/api/onboarding:", "fetch:GET:/api/projects:"]) if (!w.entries[k]) fail(tag(`signed in but does not pin ${k} (shell calls it on every page)`));
    const ov = w.entries["fetch:GET:/api/billing/overview:"]?.body;
    if (ov) {
      sameKeys(tag("billing overview"), ov, OVERVIEW_KEYS);
      if (ov.free) sameKeys(tag("billing overview.free"), ov.free, FREE_KEYS);
      if (ov.plan && !ov.plans.some((p) => p.key === ov.plan.key)) fail(tag(`plan "${ov.plan.key}" not in plans[]`));
      if (!Number.isInteger(ov.balanceMilli)) fail(tag("balanceMilli must be an integer (milli-credits)"));
    }
    const ob = w.entries["fetch:GET:/api/onboarding:"]?.body;
    if (ob) {
      if (!STATUSES.includes(ob.status)) fail(tag(`onboarding status "${ob.status}" not in ${STATUSES}`));
      sameKeys(tag("onboarding answers"), ob.answers, ANSWER_KEYS);
      for (const [field, list] of Object.entries(OPTIONS)) {
        const v = ob.answers[field];
        for (const x of Array.isArray(v) ? v : v == null ? [] : [v]) if (!list.includes(x)) fail(tag(`onboarding ${field}="${x}" is not a real option (${list.join("|")})`));
      }
    }
    const pe = w.entries["fetch:GET:/api/projects:"];
    if (pe && pe.status === 200) {
      const pr = pe.body;
      if (pr.success !== true || !Array.isArray(pr.data)) fail(tag("projects body must be { success:true, data:[...] }"));
      checkBrands(tag, pr.data);
    }
  } else if (!signedIn && session && Object.keys(session).length) fail(tag("signed-out session must be {}"));
  // page worlds: every on-mount call of the page(s) the world is listed for must be pinned (kit rule: pin EVERYTHING the page calls)
  const meta = manifest.find((m) => m.name === n);
  for (const pg of (meta?.pages || []).filter((x) => x !== "*")) {
    for (const k of PAGE_CALLS[pg] || []) if (!w.entries[k]) fail(tag(`listed for ${pg} but does not pin ${k}`));
    if (!(pg in PAGE_CALLS)) fail(tag(`listed for ${pg}, which has no entry in pilot/page-calls.json`));
  }
  const ge = w.entries["fetch:GET:/api/generations:"];
  if (ge && ge.status === 200) {
    if (ge.body?.success !== true || !Array.isArray(ge.body?.data)) fail(tag("generations body must be { success:true, data:[...] }"));
    checkGenerations(tag, ge.body.data);
  }
  console.log(`  ${errors.some((e) => e.startsWith(n + ":")) ? "FAIL" : "ok  "} ${n}  (${Object.keys(w.entries).length} pins)`);
}

if (errors.length) { console.error("\n" + errors.map((e) => " - " + e).join("\n")); process.exit(1); }
console.log(`\n${publicNames.length} worlds valid; fixtures match BillingOverview (${OVERVIEW_KEYS.length} keys), OnboardingAnswers (${ANSWER_KEYS.length} keys), ${PLATFORM_KEYS.length} platforms, Brand (${BRAND_KEYS.length}) / Channel (${CHANNEL_KEYS.length}) / styleGuide (${SG_KEYS.length}) / generation (${GEN_KEYS.length}) rows.`);
