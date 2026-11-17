// Pins every click-triggered /api call (wizards, modals, billing, generation, admin tabs) + the page-load calls the first
// pass missed (billing history/public, slideshow styles/characters, admin sub-tabs). Run AFTER gen-page-worlds.mjs:
//   node pilot/scripts/gen-action-worlds.mjs
// Shapes come from the route handlers and the client code that reads them (each $comment names the route).
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const W = path.join(root, "public/pilot/worlds");
const rd = (n) => JSON.parse(fs.readFileSync(path.join(W, n + ".world.json"), "utf8"));
const wr = (n, o) => fs.writeFileSync(path.join(W, n + ".world.json"), JSON.stringify(o, null, 2) + "\n");
const T = (n) => `/templates/${n}.jpg`;
const IMG = { a: T("112548598f5ab8fc4c09207f62da0abc"), b: T("2069e417aa5289fc21b33843b87f37eb"), c: T("2409004ccdb788fd8760aa48ae05b114"), d: T("677cc0b2f67da326311a099ecf5c7e88"), e: T("68a06692e2f01159966dd6f9f51468d6"), f: T("c6d151889045da73f6d8747282591c92") };
for (const f of Object.values(IMG)) if (!fs.existsSync(path.join(root, "public", f))) throw new Error("missing image " + f);
const ok = (body) => ({ status: 200, body });
const err = (status, error, extra = {}) => ({ status, body: { error, ...extra } });
const out402 = { status: 402, body: { error: "Not enough credits", code: "insufficient_credits", neededMilli: 2042, message: "You're out of credits. Top up to keep creating." } };
const worlds = {};
const add = (name, page, extendsFrom, comment, entries, title, about) => (worlds[name] = { page, json: { name, extends: extendsFrom, $comment: comment, entries }, title, about });

// ---------- shared sample data ----------
const brand = { id: "br_1", userId: "usr_pilot_01", name: "Lagos Bloom Florals", logo: null, logoPosition: "bottom-right", logoScale: 0.14, createdAt: "$now-45d", updatedAt: "$now-1d" };
const channel = { id: "ch_new", brandId: "br_1", name: "instagram post", platform: "instagram_post", description: null, styleOverrides: null, createdAt: "$now", updatedAt: "$now" };
const slides = (n) => Array.from({ length: n }, (_, i) => ({ slideNumber: i + 1, role: i === 0 ? "hook" : i === n - 1 ? "cta" : "tip", headline: ["5 ways to style roses", "Mix your heights", "Use odd numbers", "Trim stems at an angle", "Order today"][i] || "Tip " + i, body: "Short supporting line for slide " + (i + 1) + ".", imageUrl: [IMG.c, IMG.d, IMG.e, IMG.a, IMG.b][i % 5] }));
const task = (status, progress, extra = {}) => ({ success: true, data: { id: "task_1", status, progress, total: 5, slides: status === "done" ? slides(5) : slides(progress), error: null, generationId: status === "done" ? "gen_task_1" : null, style: "Soft studio", size: "1080x1350", ...extra } });
const ssStyles = [{ id: "ss_1", name: "Everyday candid", description: "Phone-photo look with white caption boxes.", textStyle: "white", formats: ["single", "split"], mine: false, cover: IMG.d, preview: [IMG.d, IMG.e] }, { id: "ss_own1", name: "My story style", description: "", textStyle: "plain", formats: ["single"], mine: true, cover: IMG.c, preview: [IMG.c] }];
const chars = [{ id: "c_1", name: "Ada", description: "Late 20s, natural curls, linen shirt, warm smile.", photos: [IMG.e, IMG.f], source: "ai" }];
const plan = { title: "5 ways to style roses", slides: [1, 2, 3, 4, 5].map((n) => ({ n, kind: n === 3 ? "split" : "single", scene: "A bouquet on a kitchen table, window light", scene2: n === 3 ? "Close-up of hands trimming stems" : "", text: ["5 ways to style roses", "Mix your heights", "Trim at an angle", "Change the water daily", "Order yours today"][n - 1], detail: "", text2: n === 3 ? "Angle cuts drink more" : "", person: n === 1 ? "character" : "none" })) };
const jobRow = (o) => ({ id: "job_new", userId: "usr_pilot_01", channelId: "ch_1", name: "New automation", prompt: "A fresh bouquet photo with a short caption", schedule: "09:00", platform: "instagram_post", size: "1080x1080", deliveryEmail: true, deliveryTelegram: false, deliverySocial: false, telegramChatId: null, isActive: true, lastRunAt: null, createdAt: "$now", updatedAt: "$now", ...o });
const planItems = [1, 2, 3, 4, 5, 6].map((i) => ({ id: "pl_new" + i, planId: "plan_1", scheduledAt: "$now+" + i + "d", platform: i % 2 ? "instagram_post" : "tiktok", format: i % 3 ? "image" : "carousel", size: i % 2 ? "1080x1080" : "1080x1920", topic: ["Valentine bundles", "Keeping roses fresh", "Behind the scenes", "Customer story", "Weekend offer", "Care tips"][i - 1], theme: null, status: "planned" }));
const ledger = [["purchase", 100000, "Top-up $10"], ["usage", -2042, "Image (GPT Image)"], ["usage", -2042, "Image (GPT Image)"], ["free", 3000, "Free trial image"], ["plan", 200000, "Starter plan credits"], ["autoreload", 50000, "Auto-reload $5"], ["admin", 5000, "Goodwill credit"], ["usage", -300, "Chat reply"]].map(([kind, d, note], i) => ({ id: "ev_" + i, deltaMilli: d, kind, note, meta: null, expiresAt: null, createdAt: "$now-" + (i * 2 + 1) + "h" }));
const tplAdmin = (n, o) => ({ id: "tpl_" + n, number: n, kind: "pack", refImages: [IMG.a], coverImages: [IMG.a], tags: [], aspect: "4:5", styles: [], needsProduct: false, useBrandBrain: true, published: true, sortOrder: n, usageCount: n * 40, ownerId: null, fields: [], ...o });
const admTemplates = [tplAdmin(1, { title: "Colour-block product ad", category: "Static ads", description: "Bold single colour with the product centred." }), tplAdmin(2, { title: "Weekend promo", category: "Static ads", description: "Offer-led layout.", aspect: "1:1" }), tplAdmin(3, { title: "5-tip carousel", category: "Carousel", description: "Hook, five tips, call to action." }), tplAdmin(4, { title: "Draft: bold thumbnail", category: "Thumbnails", description: "Not published yet.", published: false, aspect: "16:9", usageCount: 0 })];
const admCar = [{ id: "cs_1", name: "Soft studio", description: "Pastel backgrounds with serif headlines.", published: true, sortOrder: 1, usageCount: 88, cover: IMG.c, refs: [IMG.c, IMG.d, IMG.e], dna: {} }, { id: "cs_2", name: "Draft: bold type", description: "", published: false, sortOrder: 2, usageCount: 0, cover: IMG.d, refs: [IMG.d], dna: {} }];
const admSlide = [{ id: "ss_1", name: "Everyday candid", description: "Phone-photo look with white caption boxes.", published: true, sortOrder: 1, usageCount: 41, textStyle: "white", formats: ["single", "split"], refs: [IMG.d, IMG.e], dna: "" }];

const tplFiles = fs.readdirSync(path.join(root, "public/templates")).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().map((f) => ({ id: f, name: f.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(), filename: f, publicUrl: "/templates/" + f }));
// ---------- _actions : happy path for every call a click can make (partial; every signed-in/out world extends it) ----------
const actions = {
  "fetch:GET:/api/billing/history:": ok({ events: ledger }),
  "fetch:POST:/api/billing/topup:": ok({ ok: true, status: "success" }),
  "fetch:POST:/api/billing/subscription:": ok({ ok: true }),
  "fetch:DELETE:/api/billing/subscription:": ok({ ok: true }),
  "fetch:PATCH:/api/billing/subscription:": ok({ ok: true }),
  "fetch:PUT:/api/billing/auto-reload:": ok({ ok: true }),
  "fetch:POST:/api/billing/sync:": ok({ ok: true, status: "success" }),
  "fetch:POST:/api/billing/payment-methods:": ok({ ok: true }),
  "fetch:DELETE:/api/billing/payment-methods:": ok({ ok: true }),
  "fetch:POST:/api/ai/chat:": ok({ content: "Here's a soft pink ad with your bouquet front and centre.", model: "pilot", imageUrl: IMG.a, generationId: "gen_new_1", logo: null, usage: { promptTokens: 120, completionTokens: 60 } }),
  "fetch:POST:/api/ai/generate-image:": ok({ generationId: "gen_new_2", imageUrl: IMG.b, revisedPrompt: "A pastel bouquet on a kitchen table", logo: null }),
  "fetch:POST:/api/ai/carousel:": ok({ success: true, data: { background: true, taskId: "task_1", plan: { topic: "How to style roses", totalSlides: 5, ctaGoal: "" }, format: "carousel", style: { id: "cs_1", name: "Soft studio" }, size: "1080x1350", disclosure: null, slides: [] } }),
  "fetch:POST:/api/tasks/task_1/step:": { sequence: [{ status: 200, delayMs: 600, body: task("running", 2) }, { status: 200, delayMs: 600, body: task("running", 4) }, { status: 200, body: task("done", 5) }] },
  "fetch:POST:/api/generations:": ok({ success: true }),
  "fetch:POST:/api/generations/caption:": ok({ success: true, data: { caption: "Roses that last all week. Here's how we style ours.", hashtags: ["#roses", "#lagosflorist"] } }),
  "fetch:POST:/api/generations/redo-slide:": ok({ success: true, data: { slideNumber: 2, imageUrl: IMG.e, headline: "Mix your heights", body: "Short supporting line." } }),
  "fetch:POST:/api/projects:": ok({ success: true, data: { brand, channel } }),
  "fetch:DELETE:/api/projects:": ok({ success: true }),
  "fetch:PUT:/api/projects/logo:": ok({ success: true, data: brand }),
  "fetch:PUT:/api/projects/style:": ok({ success: true }),
  "fetch:GET:/api/slideshow/styles:": ok({ styles: ssStyles }),
  "fetch:POST:/api/slideshow/styles:": ok({ success: true, style: ssStyles[1] }),
  "fetch:DELETE:/api/slideshow/styles:": ok({ success: true }),
  "fetch:GET:/api/slideshow/character:": ok({ characters: chars }),
  "fetch:PUT:/api/slideshow/character:": ok({ success: true, characters: chars }),
  "fetch:POST:/api/slideshow/character:": ok({ success: true, photos: [IMG.e, IMG.f] }),
  "fetch:POST:/api/slideshow/plan:": ok({ success: true, plan, textStyle: "white" }),
  "fetch:POST:/api/slideshow/slide:": { status: 200, delayMs: 500, body: { success: true, url: IMG.d, viewUrl: IMG.d, chargedMilli: 2402 } },
  "fetch:POST:/api/slideshow/save:": ok({ success: true, generationId: "gen_ss_1" }),
  "fetch:POST:/api/carousel-styles:": ok({ success: true, style: { id: "cs_new", name: "My new style", description: "", mine: true, cover: IMG.d, preview: [IMG.d] } }),
  "fetch:DELETE:/api/carousel-styles:": ok({ success: true }),
  "fetch:POST:/api/carousel-styles/upload:": ok({ success: true, url: IMG.d }),
  "fetch:POST:/api/ad-packs:": ok({ success: true, pack: { id: "tpl_own2", title: "New pack", description: "", mine: true, coverImages: [IMG.a] } }),
  "fetch:DELETE:/api/ad-packs:": ok({ success: true }),
  "fetch:POST:/api/plans:": ok({ success: true, data: { id: "plan_1", items: planItems }, trimmed: 0 }),
  "fetch:PATCH:/api/plans/plan_1:": ok({ success: true }),
  "fetch:POST:/api/jobs:": ok({ success: true, data: jobRow({}) }),
  "fetch:PATCH:/api/jobs/job_1:": ok({ success: true, data: jobRow({ id: "job_1", name: "Morning bloom" }) }),
  "fetch:DELETE:/api/jobs/job_1:": ok({ success: true }),
  "fetch:PATCH:/api/jobs/job_2:": ok({ success: true, data: jobRow({ id: "job_2" }) }),
  "fetch:DELETE:/api/jobs/job_2:": ok({ success: true }),
  "fetch:POST:/api/onboarding:": ok({ status: "done", answers: {} }),
  "fetch:POST:/api/auth/signup:": ok({ success: true, user: { id: "usr_pilot_02", name: "Ada Okafor", email: "ada@example.com" } }),
  "fetch:DELETE:/api/chat-session:": ok({ success: true }),
  "fetch:GET:/api/templates:": ok({ success: true, templates: tplFiles }),
  "fetch:POST:/api/inspiration:": ok({ success: true, data: {} }),
  "fetch:DELETE:/api/inspiration:": ok({ success: true }),
  "fetch:POST:/api/admin/templates:": ok({ ok: true, template: admTemplates[0], url: IMG.a, prompt: "Colour-block ad of {product} on a flat pastel background.", title: "Pack", fields: [] }),
  "fetch:POST:/api/admin/carousel-styles:": ok({ ok: true, style: admCar[0], url: IMG.c, dna: "" }),
  "fetch:POST:/api/admin/slideshow-styles:": ok({ ok: true, style: admSlide[0], url: IMG.d, dna: "" }),
  "fetch:POST:/api/admin/billing:": ok({ ok: true }),
  "fetch:PUT:/api/admin/billing:": ok({ ok: true }),
};
{
  const pub = rd("paid-power-user").entries["fetch:GET:/api/billing/overview:"].body;
  actions["fetch:GET:/api/billing/public:"] = ok({ ...pub, paymentsReady: false, balanceMilli: 0, nextExpiry: null, plan: null, autoReload: { enabled: false, belowMilli: 0, amountCents: 0 }, cards: [], free: { enabled: false, available: false, usedTotal: 0, cap: 0, usedToday: 0, todayLimit: 0, firstDay: false }, isAdmin: false });
}
wr("_actions", { name: "_actions", $comment: "PARTIAL. Happy-path answers for every call a click can trigger (wizards, billing modals, generation, projects, jobs, plans, onboarding, signup, admin tabs) plus billing history/public and slideshow styles/characters. Extended by _signed-in and _signed-out so no world answers 599 for a normal click. Failure variants override single keys in named worlds. Paystack redirects are never pinned (a data.url would navigate the rig frame away).", entries: actions });
for (const p of ["_signed-in", "_signed-out", "session-probe-down"]) { const w = rd(p); w.extends = ["_base", "_actions"]; wr(p, w); }

// guests: /api/projects answers 401 (route requires a session) -> pages show their signed-out state
{ const so = rd("_signed-out"); so.entries["fetch:GET:/api/projects:"] = err(401, "Unauthorized"); wr("_signed-out", so); }

// ---------- billing ----------
const paid = rd("paid-power-user").entries["fetch:GET:/api/billing/overview:"].body;
const ov = (patch) => ok({ ...paid, ...patch });
add("billing-history-empty", "/billing", "paid-power-user", "GET /api/billing/history -> {events: []}: brand-new ledger.", { "fetch:GET:/api/billing/history:": ok({ events: [] }) }, "Billing, empty history", "History tab has no rows.");
add("billing-plan-past-due", "/billing", "paid-power-user", "overview.plan.status = past_due -> page text 'payment failed, update your card'.", { "fetch:GET:/api/billing/overview:": ov({ plan: { ...paid.plan, status: "past_due" } }) }, "Billing, plan past due", "Plan card shows the payment-failed warning.");
add("billing-plan-cancelling", "/billing", "paid-power-user", "overview.plan.cancelAtPeriodEnd = true -> Resume instead of Cancel.", { "fetch:GET:/api/billing/overview:": ov({ plan: { ...paid.plan, cancelAtPeriodEnd: true } }) }, "Billing, cancelling", "Plan ends at period end; Resume offered.");
add("billing-no-card", "/billing", "paid-power-user", "cards: [] and autoReload off -> 'No cards saved yet', auto-reload modal asks to add a card.", { "fetch:GET:/api/billing/overview:": ov({ cards: [], autoReload: { enabled: false, belowMilli: 0, amountCents: 0 } }) }, "Billing, no card", "Payment methods tab is empty.");
add("billing-payment-declined", "/billing", "paid-power-user", "topup/subscription answer 400 {error} (flows throw Error(message)); auto-reload 400 'Add a payment method first'.", { "fetch:POST:/api/billing/topup:": err(400, "Your card was declined. Try another card."), "fetch:POST:/api/billing/subscription:": err(400, "Your card was declined. Try another card."), "fetch:PUT:/api/billing/auto-reload:": err(400, "Add a payment method first") }, "Billing, payment declined", "Top-up, plan and auto-reload show an error.");
add("billing-payments-unavailable", "/billing", "payments-not-ready", "paystackConfigured() false -> topup/subscription 503 'Payments are not configured yet'.", { "fetch:POST:/api/billing/topup:": err(503, "Payments are not configured yet"), "fetch:POST:/api/billing/subscription:": err(503, "Payments are not configured yet") }, "Billing, payments off", "Buy and subscribe answer 503.");

// ---------- AI studio generation + wizards ----------
add("ai-generate-failing", "/ai", "ai-with-history", "chat/generate-image/carousel 500 (routes' catch blocks); the task poller returns {error} so the carousel throws 'Carousel generation failed'.", { "fetch:POST:/api/ai/chat:": err(500, "Failed to generate response"), "fetch:POST:/api/ai/generate-image:": err(500, "Failed to generate image"), "fetch:POST:/api/ai/carousel:": err(500, "Failed to generate carousel"), "fetch:POST:/api/generations/caption:": err(502, "Could not write a caption."), "fetch:POST:/api/generations/redo-slide:": err(502, "Could not redo that slide. Nothing was charged.") }, "AI studio, generation failing", "Every generate call answers an error.");
add("ai-carousel-task-failed", "/ai", "ai-with-history", "Carousel starts, the first poll comes back status:failed with error -> 'Carousel generation failed'.", { "fetch:POST:/api/tasks/task_1/step:": ok({ success: true, data: { id: "task_1", status: "failed", progress: 1, total: 5, slides: slides(1), error: "The image service timed out", generationId: null, style: "Soft studio", size: "1080x1350" } }) }, "AI studio, carousel fails midway", "One slide done, then the task fails.");
add("ai-generate-slow", "/ai", "ai-with-history", "chat and generate-image take 9 seconds (loading bubble stays up); carousel steps take 4 seconds each.", { "fetch:POST:/api/ai/chat:": { ...actions["fetch:POST:/api/ai/chat:"], delayMs: 9000 }, "fetch:POST:/api/ai/generate-image:": { ...actions["fetch:POST:/api/ai/generate-image:"], delayMs: 9000 }, "fetch:POST:/api/tasks/task_1/step:": { sequence: [{ status: 200, delayMs: 4000, body: task("running", 1) }, { status: 200, delayMs: 4000, body: task("running", 3) }, { status: 200, delayMs: 4000, body: task("done", 5) }] } }, "AI studio, slow generation", "Loading states hold for seconds.");
add("ai-generate-402", "/ai", "ai-with-history", "Every credit-spending call answers 402 insufficient_credits -> openTopUp / 'Not enough credits' notes.", { "fetch:POST:/api/ai/chat:": out402, "fetch:POST:/api/ai/generate-image:": out402, "fetch:POST:/api/ai/carousel:": out402, "fetch:POST:/api/generations/caption:": out402, "fetch:POST:/api/generations/redo-slide:": out402, "fetch:POST:/api/slideshow/plan:": out402, "fetch:POST:/api/slideshow/slide:": out402, "fetch:POST:/api/slideshow/character:": out402, "fetch:POST:/api/slideshow/styles:": out402, "fetch:POST:/api/carousel-styles:": out402, "fetch:POST:/api/ad-packs:": out402, "fetch:POST:/api/plans:": out402 }, "AI studio, out of credits everywhere", "All spending calls answer 402.");
add("ai-wizards-empty", "/ai", "ai-fresh", "No saved slideshow styles, characters, ad packs or carousel styles.", { "fetch:GET:/api/slideshow/styles:": ok({ styles: [] }), "fetch:GET:/api/slideshow/character:": ok({ characters: [] }), "fetch:GET:/api/ad-packs:": ok({ packs: [] }), "fetch:GET:/api/ad-packs?purpose=thumbnail:": ok({ packs: [] }), "fetch:GET:/api/carousel-styles:": ok({ styles: [] }) }, "AI studio, wizards empty", "Pickers have nothing saved.");
add("ai-wizards-failing", "/ai", "ai-with-history", "Wizard calls fail: plan/slide/character 502 (routes), style/pack/plan/job create 500, upload 400.", { "fetch:POST:/api/slideshow/plan:": err(502, "Couldn't plan the slideshow. Nothing was charged. Try again."), "fetch:POST:/api/slideshow/slide:": err(502, "This photo couldn't be made. You were not charged."), "fetch:POST:/api/slideshow/character:": err(502, "The character couldn't be made. You were not charged. Try again."), "fetch:POST:/api/slideshow/styles:": err(500, "Couldn't study the examples. Nothing was charged. Try again."), "fetch:POST:/api/ad-packs:": err(500, "Could not study the references. Nothing was charged. Try again."), "fetch:POST:/api/carousel-styles:": err(500, "Could not create the style"), "fetch:POST:/api/carousel-styles/upload:": err(400, "Send a smaller image"), "fetch:POST:/api/plans:": err(500, "Could not draft the plan"), "fetch:POST:/api/jobs:": err(500, "Internal error"), "fetch:POST:/api/projects:": err(500, "Internal error") }, "AI studio, wizards failing", "Every wizard step answers an error.");

// composition (upstream "Update 68"): project style advancedSettings.composition = "auto" | a spot; manual enables the 3x3 grid
{
  const base = rd("ai-with-history").entries["fetch:GET:/api/projects/style:"];
  const withComp = (c) => ({ status: 200, body: { ...base.body, data: { ...base.body.data, advancedSettings: { ...(base.body.data.advancedSettings || {}), composition: c } } } });
  add("ai-composition-fixed", "/ai", "ai-with-history", "GET /api/projects/style -> data.advancedSettings.composition = 'bottom-left' (ProjectSettings reads typeof adv.composition === 'string'); the Composition grid is enabled and a spot is selected. 'auto' (the default for every other world) greys the grid out.", { "fetch:GET:/api/projects/style:": withComp("bottom-left") }, "AI studio, composition fixed", "Project has a fixed text position (bottom-left).");
}

// ---------- signup ----------
add("signup-email-taken", "/signup", "signed-out", "POST /api/auth/signup -> 409 'An account with this email already exists'.", { "fetch:POST:/api/auth/signup:": err(409, "An account with this email already exists") }, "Sign up, email taken", "409 on submit.");
add("signup-server-error", "/signup", "signed-out", "POST /api/auth/signup -> 500 'Internal server error'.", { "fetch:POST:/api/auth/signup:": err(500, "Internal server error") }, "Sign up, server error", "500 on submit.");

// ---------- admin tabs ----------
const admPins = { "fetch:GET:/api/admin/templates:": ok({ templates: admTemplates }), "fetch:GET:/api/admin/carousel-styles:": ok({ styles: admCar }), "fetch:GET:/api/admin/slideshow-styles:": ok({ styles: admSlide }) };
add("admin-tabs-populated", "/admin", "admin-populated", "Admin GETs return {templates} / {styles} with unpublished rows included (publishedOnly:false).", admPins, "Admin tabs, populated", "Templates, carousel styles and slideshow styles, including drafts.");
add("admin-tabs-empty", "/admin", "admin-populated", "Same GETs return empty lists.", { "fetch:GET:/api/admin/templates:": ok({ templates: [] }), "fetch:GET:/api/admin/carousel-styles:": ok({ styles: [] }), "fetch:GET:/api/admin/slideshow-styles:": ok({ styles: [] }) }, "Admin tabs, empty", "Nothing created yet.");
add("admin-tabs-denied", "/admin", "admin-denied", "Admin tab GETs answer 403 'Admins only'.", { "fetch:GET:/api/admin/templates:": err(403, "Admins only"), "fetch:GET:/api/admin/carousel-styles:": err(403, "Admins only"), "fetch:GET:/api/admin/slideshow-styles:": err(403, "Admins only") }, "Admin tabs, denied", "403 on every tab.");
// default admin-populated/admin tabs should also load
{ const a = rd("admin-populated"); Object.assign(a.entries, admPins); wr("admin-populated", a); }

// the shell 402 world: widen it to every spending call
{ const o = rd("out-of-credits-402"); for (const k of ["fetch:POST:/api/ai/carousel:", "fetch:POST:/api/generations/caption:", "fetch:POST:/api/generations/redo-slide:", "fetch:POST:/api/slideshow/plan:", "fetch:POST:/api/slideshow/slide:", "fetch:POST:/api/slideshow/character:", "fetch:POST:/api/slideshow/styles:", "fetch:POST:/api/carousel-styles:", "fetch:POST:/api/ad-packs:", "fetch:POST:/api/plans:"]) o.entries[k] = out402; wr("out-of-credits-402", o); }

const idxPath = path.join(W, "index.json");
const idx = JSON.parse(fs.readFileSync(idxPath, "utf8"));
for (const [name, w] of Object.entries(worlds)) {
  wr(name, w.json);
  const e = { name, title: w.title, about: w.about, pages: [w.page] };
  const i = idx.worlds.findIndex((x) => x.name === name); if (i >= 0) idx.worlds[i] = e; else idx.worlds.push(e);
}
fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2) + "\n");
console.log("wrote", Object.keys(worlds).length, "worlds +", Object.keys(actions).length, "action pins");
