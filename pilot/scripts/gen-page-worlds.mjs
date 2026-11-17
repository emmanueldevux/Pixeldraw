// Generates the per-page worlds for the pages whose data calls the shell worlds do not pin.
// Shapes come from the API routes + Prisma schema (see each $comment). Run: node pilot/scripts/gen-page-worlds.mjs
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const W = path.join(root, "public/pilot/worlds");
const src = (f) => fs.readFileSync(path.join(root, f), "utf8");
// pull `export const NAME = <literal>` out of a TS file and evaluate it
function grab(file, name) {
  const t = src(file); const i = t.indexOf(`export const ${name}`); if (i < 0) throw new Error(`${name} not found in ${file}`);
  let j = t.indexOf("=", i) + 1; while (/\s/.test(t[j])) j++;
  const open = t[j], close = open === "[" ? "]" : "}"; let d = 0, k = j;
  for (; k < t.length; k++) { if (t[k] === open) d++; else if (t[k] === close && --d === 0) break; }
  return (0, eval)("(" + t.slice(j, k + 1).replace(/\sas\s+number\[\]/g, "") + ")");
}
const SETTINGS = grab("src/lib/billing/settings.ts", "DEFAULT_SETTINGS");
const RULES = grab("src/lib/billing/pricing.ts", "DEFAULT_RULES").map((r) => ({ ...r, active: true }));
const PLANS = grab("src/lib/billing/pricing.ts", "DEFAULT_PLANS");
const EMPTY_BRAIN = grab("src/lib/brain/types.ts", "EMPTY_BRAIN");
const T = (n) => `/templates/${n}.jpg`;
const IMG = { a: T("112548598f5ab8fc4c09207f62da0abc"), b: T("2069e417aa5289fc21b33843b87f37eb"), c: T("2409004ccdb788fd8760aa48ae05b114"), d: T("677cc0b2f67da326311a099ecf5c7e88"), e: T("68a06692e2f01159966dd6f9f51468d6"), f: T("c6d151889045da73f6d8747282591c92") };
for (const f of Object.values(IMG)) if (!fs.existsSync(path.join(root, "public", f))) throw new Error("missing image " + f);
const ok = (body) => ({ status: 200, body });
const worlds = {};
const add = (name, page, comment, entries, title, about) => (worlds[name] = { page, json: { name, extends: "_signed-in", $comment: comment, entries }, title, about });

// ---------- /templates : GET /api/design-templates -> { templates: PublicTemplate[] } (+typicalMilli) ----------
const tpl = (n, o) => ({ id: "tpl_" + n, number: n, kind: "pack", refImages: [], coverImages: [], tags: [], aspect: "4:5", styles: [], needsProduct: false, useBrandBrain: true, published: true, sortOrder: n, usageCount: 0, ownerId: null, fields: [], typicalMilli: 2042, ...o });
const templates = [
  tpl(1, { title: "Colour-block product ad", description: "A bold single-colour background with the product front and centre.", category: "Static ads", tags: ["Recommended", "ecommerce"], coverImages: [IMG.a, IMG.b], usageCount: 412, needsProduct: true, fields: [{ key: "Headline", label: "Headline (optional)", placeholder: "Fresh blooms, same day" }] }),
  tpl(2, { title: "Weekend promo", description: "Offer-led layout with a price burst and a clear call to action.", category: "Static ads", tags: ["Recommended", "promo"], coverImages: [IMG.b], usageCount: 290, needsProduct: true, aspect: "1:1" }),
  tpl(3, { title: "5-tip carousel", description: "Hook slide, five tip slides and a closing call to action.", category: "Carousel", tags: ["education"], coverImages: [IMG.c, IMG.d, IMG.e], usageCount: 171, aspect: "4:5" }),
  tpl(4, { title: "Story-style slideshow", description: "Vertical photo slides with large on-slide copy.", category: "Slideshows", tags: [], coverImages: [IMG.d, IMG.e], usageCount: 96, aspect: "9:16" }),
  tpl(5, { title: "Bold face thumbnail", description: "High-contrast thumbnail with a big expression and three words.", category: "Thumbnails", tags: ["youtube"], coverImages: [IMG.f], usageCount: 54, aspect: "16:9" }),
  tpl(6, { title: "Quiet minimal ad", description: "Soft light, lots of space, one line of copy.", category: "Static ads", tags: [], coverImages: [IMG.e], usageCount: 12, needsProduct: true }),
];
add("templates-populated", "/templates", "GET /api/design-templates -> {templates} where each is toPublic(t)+typicalMilli (lib/designTemplates/types.ts). Six published templates across all four categories; two are tagged Recommended so the page opens on that tab.", { "fetch:GET:/api/design-templates:": ok({ templates }) }, "Templates populated", "Six published templates, two tagged Recommended.");
add("templates-empty", "/templates", "Route returns {templates: []} (nothing published yet).", { "fetch:GET:/api/design-templates:": ok({ templates: [] }) }, "Templates empty", "Nothing published.");
add("templates-api-failing", "/templates", "Route catch -> 500 {templates: [], error}; the page ignores status and shows its empty state.", { "fetch:GET:/api/design-templates:": { status: 500, body: { templates: [], error: "Templates are not set up yet" } } }, "Templates API failing", "500 with an empty list.");

// ---------- /inspiration : GET /api/inspiration -> {success, data: InspirationImage[]} ----------
const insp = (i, url, o) => ({ id: "insp_" + i, url, platform: null, style: null, mood: null, industry: null, tags: [], addedBy: "usr_pilot_01", createdAt: "$now-" + i + "d", set: null, slideNumber: null, role: null, onSlideText: null, imageSubject: null, imageStyle: null, psychologyDevice: null, ...o });
add("inspiration-populated", "/inspiration", "GET /api/inspiration -> {success,data} rows of InspirationImage (prisma). Eight images mixing platforms/styles/moods; two are slideshow reference slides.", { "fetch:GET:/api/inspiration:": ok({ success: true, data: [
  insp(1, IMG.a, { platform: "instagram_post", style: "minimal", mood: "calm", industry: "florist", tags: ["pastel", "product"] }),
  insp(2, IMG.b, { platform: "instagram_post", style: "editorial", mood: "luxury", industry: "fashion", tags: ["serif"] }),
  insp(3, IMG.c, { platform: "tiktok", style: "maximalist", mood: "playful", industry: "food", tags: ["bright"], set: "set1", slideNumber: 1, role: "hook", onSlideText: "5 ways to style roses", imageSubject: "a bouquet on a kitchen table", imageStyle: "warm window light, big white text", psychologyDevice: "specific number" }),
  insp(4, IMG.d, { platform: "tiktok", style: "maximalist", mood: "playful", industry: "food", tags: ["bright"], set: "set1", slideNumber: 2, role: "tip", onSlideText: "1. Mix heights", imageSubject: "roses in tall and short vases", imageStyle: "same warm light", psychologyDevice: "social proof" }),
  insp(5, IMG.e, { platform: "linkedin_post", style: "3d render", mood: "professional", industry: "saas" }),
  insp(6, IMG.f, { platform: "youtube_thumbnail", style: "bold", mood: "energetic", industry: "fitness", tags: ["face"] }),
  insp(7, IMG.a, { style: "minimal", mood: "dreamy" }),
  insp(8, IMG.b, { platform: "facebook", mood: "gritty", industry: "fitness" }),
] }) }, "Inspiration populated", "Eight tagged images, two slideshow slides.");
add("inspiration-empty", "/inspiration", "Route returns {success:true,data:[]}.", { "fetch:GET:/api/inspiration:": ok({ success: true, data: [] }) }, "Inspiration empty", "Library has no images.");

// ---------- /chat : GET /api/templates -> {success, templates: TemplateReference[]} (listAvailableTemplates) ----------
const files = fs.readdirSync(path.join(root, "public/templates")).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const nameFrom = (f) => f.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
add("chat-templates", "/chat", "GET /api/templates -> {success, templates:[{id,name,filename,publicUrl}]}: a directory listing of public/templates, so this is the REAL file list (sorted).", { "fetch:GET:/api/templates:": ok({ success: true, templates: files.map((f) => ({ id: f, name: nameFrom(f), filename: f, publicUrl: "/templates/" + f })) }) }, "Chat with templates", "Template picker lists every file in public/templates.");
add("chat-no-templates", "/chat", "Directory empty -> {success:true, templates: []}.", { "fetch:GET:/api/templates:": ok({ success: true, templates: [] }) }, "Chat without templates", "Template picker is empty.");

// ---------- /calendar : GET /api/calendar, /api/jobs, /api/plans/items ----------
const chan = { id: "ch_1", brandId: "br_1", name: "instagram post", platform: "instagram_post", description: null, styleOverrides: null, createdAt: "2026-10-01T09:00:00.000Z", updatedAt: "2026-11-14T16:20:00.000Z" };
const post = (i, d, o) => ({ id: "post_" + i, channelId: "ch_1", title: null, caption: null, imageUrl: null, platform: "instagram_post", size: "1080x1080", status: "scheduled", scheduledAt: d, publishedAt: null, createdAt: "$now-9d", updatedAt: "$now-1d", channel: chan, ...o });
const posts = [post(1, "$now+1d", { title: "Mother's Day bouquet", imageUrl: IMG.a }), post(2, "$now+2d", { title: "Weekend delivery", imageUrl: IMG.b }), post(3, "$now+4d", { title: "Rose care tips", status: "draft", imageUrl: IMG.c }), post(4, "$now-2d", { title: "New arrivals", status: "published", publishedAt: "$now-2d", imageUrl: IMG.d }), post(5, "$now-1d", { title: "Flash sale", status: "failed" })];
const job = { id: "job_1", userId: "usr_pilot_01", channelId: "ch_1", name: "Morning bloom", prompt: "A fresh bouquet photo with a short caption", schedule: "09:00", platform: "instagram_post", size: "1080x1080", deliveryEmail: true, deliveryTelegram: false, deliverySocial: false, telegramChatId: null, isActive: true, lastRunAt: "$now-1d", createdAt: "$now-20d", updatedAt: "$now-1d", channel: { ...chan, brand: { id: "br_1", userId: "usr_pilot_01", name: "Lagos Bloom Florals", logo: null } } };
const planItems = [{ id: "pl_1", scheduledAt: "$now+3d", platform: "instagram_post", format: "image", size: "1080x1080", topic: "Valentine bundles", theme: "Romance", status: "planned" }, { id: "pl_2", scheduledAt: "$now+5d", platform: "tiktok", format: "carousel", size: "1080x1920", topic: "How to keep roses fresh", theme: null, status: "planned" }];
add("calendar-busy", "/calendar", "posts = Post rows incl. channel (api/calendar), jobs = Job rows incl. channel.brand (api/jobs), plan items = PlanItemLite (components/plan/PlanWizard.tsx). Dates are $now-relative so they land in the visible month. Covers draft/scheduled/published/failed.", { "fetch:GET:/api/calendar:": ok({ success: true, data: posts }), "fetch:GET:/api/jobs:": ok({ success: true, data: [job] }), "fetch:GET:/api/plans/items:": ok({ success: true, data: planItems }) }, "Calendar busy", "Posts in every status, one job, two planned items.");
add("calendar-empty", "/calendar", "All three routes return empty data arrays.", { "fetch:GET:/api/calendar:": ok({ success: true, data: [] }), "fetch:GET:/api/jobs:": ok({ success: true, data: [] }), "fetch:GET:/api/plans/items:": ok({ success: true, data: [] }) }, "Calendar empty", "Nothing scheduled, no jobs, no plan.");

// ---------- /ai : GET /api/projects/style, GET+PUT /api/chat-session ----------
const style = { primaryColor: "#2563EB", secondaryColor: "#1D4ED8", accentColor: "#22C55E", backgroundColor: null, headingFont: "Inter", tone: "professional", extraNotes: "", referenceImages: [], advancedSettings: {}, logo: null, logoPosition: "bottom-right", logoScale: 0.14 };
const msgs = [
  { id: "m1", role: "user", content: "Make a Mother's Day ad for my bouquets", imageUrl: null, logo: null, generationId: null, carouselSlides: null, createdAt: "$now-2h" },
  { id: "m2", role: "assistant", content: "Here is a soft pink ad with your bouquet front and centre.", imageUrl: IMG.a, logo: null, generationId: "gen_000", carouselSlides: null, createdAt: "$now-2h" },
  { id: "m3", role: "user", content: "Now a 3-slide carousel on styling roses", imageUrl: null, logo: null, generationId: null, carouselSlides: null, createdAt: "$now-1h" },
  { id: "m4", role: "assistant", content: "Done. Three slides: hook, tip and call to action.", imageUrl: null, logo: null, generationId: "gen_002", carouselSlides: [{ imageUrl: IMG.c }, { imageUrl: IMG.d }, { imageUrl: IMG.e }], createdAt: "$now-1h" },
];
const brain = (status, data) => ({ brandId: "br_1", status, data, edited: [], generatedAt: status === "ready" ? "$now-3d" : null, updatedAt: status === "ready" ? "$now-1d" : null });
const brainReady = brain("ready", { ...EMPTY_BRAIN, business: { name: "Lagos Bloom Florals", whatYouSell: "Fresh bouquets and same-day delivery", industry: "Florist", location: "Lagos, Nigeria", website: "lagosbloom.example", summary: "A florist in Lagos selling bouquets for gifting. Customers are busy professionals who order online." }, offers: [{ id: "O1", title: "Free delivery over 20k", details: "Orders above NGN 20,000 ship free in Lagos.", code: "BLOOM20", isGuarantee: false }] });
const packs = { packs: [{ id: "tpl_1", title: "Colour-block product ad", description: "Bold single colour with the product centred.", mine: false, coverImages: [IMG.a, IMG.b] }, { id: "tpl_own1", title: "My weekend promos", description: "", mine: true, coverImages: [IMG.c] }] };
const thumbPacks = { packs: [{ id: "tpl_5", title: "Bold face thumbnail", description: "High-contrast thumbnail.", mine: false, coverImages: [IMG.f] }] };
const carStyles = { styles: [{ id: "cs_1", name: "Soft studio", description: "Pastel backgrounds with serif headlines.", mine: false, cover: IMG.c, preview: [IMG.c, IMG.d, IMG.e] }, { id: "cs_own1", name: "My launch style", description: "", mine: true, cover: IMG.d, preview: [IMG.d] }] };
const aiPins = (msgsBody, b) => ({ "fetch:GET:/api/projects/style:": ok({ success: true, data: style }), "fetch:GET:/api/chat-session:": ok({ success: true, data: msgsBody }), "fetch:PUT:/api/chat-session:": ok({ success: true }), "fetch:GET:/api/brain:": ok(b), "fetch:GET:/api/ad-packs:": ok(packs), "fetch:GET:/api/ad-packs?purpose=thumbnail:": ok(thumbPacks), "fetch:GET:/api/carousel-styles:": ok(carStyles) });
add("ai-with-history", "/ai", "GET /api/brain -> BrainRecord (lib/brain/types.ts; EMPTY_BRAIN is read from source); GET /api/ad-packs[?purpose=thumbnail] -> {packs:[{id,title,description,mine,coverImages}]} (ad-packs/route.ts shape()); GET /api/carousel-styles -> {styles:[{id,name,description,mine,cover,preview}]} (route shape()); GET /api/projects/style -> {success,data} (route lines 36-52); GET /api/chat-session -> {success,data: messages[]} where messages follow the PUT mapper (id, role, content, imageUrl, logo, generationId, carouselSlides, createdAt). PUT saves; pinned to success.", aiPins(msgs, brainReady), "AI with history", "Saved chat with an image and a 3-slide carousel.");
add("ai-fresh", "/ai", "Same as ai-with-history but chat-session GET returns [] (a project with no saved chat).", aiPins([], brain("empty", EMPTY_BRAIN)), "AI fresh chat", "Project selected, no saved messages.");

// ---------- /admin : GET /api/admin/billing -> {settings, rules, plans, recent} ----------
const recent = [["purchase", 100000, "Top-up $10"], ["usage", -2042, "image.openai"], ["free", 3000, "Free trial"], ["plan", 200000, "Starter plan"], ["admin", 5000, "Goodwill credit"]].map(([kind, d, note], i) => ({ id: "ev_" + i, email: i % 2 ? "ada@example.com" : "tunde@example.com", kind, deltaMilli: d, note, createdAt: "$now-" + (i + 1) + "h" }));
add("admin-populated", "/admin", "settings = DEFAULT_SETTINGS, rules = DEFAULT_RULES(+active), plans = DEFAULT_PLANS, all read from the source files by this generator so they cannot drift; recent = CreditEvent rows with email.", { "fetch:GET:/api/admin/billing:": ok({ settings: SETTINGS, rules: RULES, plans: PLANS.map((p) => ({ ...p, active: true })), recent }) }, "Admin populated", "Real default settings, rules and plans, five recent credit events.");
add("admin-denied", "/admin", "requireAdmin fails -> 403; the page shows its admins-only message.", { "fetch:GET:/api/admin/billing:": { status: 403, body: { error: "Not allowed" } } }, "Admin denied", "403, the admins-only screen.");

const idxPath = path.join(W, "index.json");
const idx = JSON.parse(fs.readFileSync(idxPath, "utf8"));
for (const [name, w] of Object.entries(worlds)) {
  fs.writeFileSync(path.join(W, name + ".world.json"), JSON.stringify(w.json, null, 2) + "\n");
  const e = { name, title: w.title, about: w.about, pages: [w.page] };
  const i = idx.worlds.findIndex((x) => x.name === name); if (i >= 0) idx.worlds[i] = e; else idx.worlds.push(e);
}
fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2) + "\n");
console.log("wrote", Object.keys(worlds).length, "worlds");
