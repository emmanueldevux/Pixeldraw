# Ledger — append-only, one line per decision
# ID scheme: PRJ-0001, PRJ-0002… (never reuse; reference IDs in notes/commits)

PRJ-0001 · 2026-11-16 · Classified Pixeldraw (Uxlly / MakeSocial) as Weight C: logins, per-user data, billing + credits, scheduled automations — the full loop applies.
PRJ-0002 · 2026-11-16 · Rig adapted from the legacy `.dc.html` environment to Next/React. Stage is an IFRAME of the real app sized by `--cg-w`/`--cg-h`, because this app uses Tailwind breakpoints (viewport media queries) which a resized div cannot trigger; the rig still only writes those two CSS vars. Result: zero changes to page code, no `data-m` hooks needed.
PRJ-0003 · 2026-11-16 · Scope is the WHOLE service for launch. Order: (1) rig + shell worlds, (2) page by page — each page done only when all its worlds × 390/768/1280 are walked.
PRJ-0004 · 2026-11-16 · Rule from the owner: states are DERIVED from the codebase (real fetches, branches, shapes). Fiction only for a brand-new page or a brand-new state; even then derive every call shape that already exists and mark the invented parts in the world's `$comment`.
PRJ-0005 · 2026-11-16 · world.ts gains `extends` (shell calls pinned once in `_signed-in`/`_signed-out`, not copy-pasted per world). Deviation from "one file per state": each public world still RESOLVES to a complete state and is validated as such. Partials are prefixed `_` and hidden from the rig.
PRJ-0006 · 2026-11-16 · world.ts lookup also tries `path?query` before `path`, and entries may be a `sequence` (polling endpoints). Only same-origin `/api/*` is pinnable; `/_next` RSC fetches, images, blobs and third parties always pass through.
PRJ-0007 · 2026-11-16 · Fixture drift caught in my own first draft (industry `retail`, platforms `instagram_post`, currency `USD` — none exist in code). Fixed, and `check-worlds.mjs` now validates fixtures against the real `BillingOverview`/`OnboardingAnswers` types, the real option lists and platform keys, so this cannot recur silently.
PRJ-0008 · 2026-11-16 · Environment limits: no `npm install` here, so Next was NOT run. Verified instead: interceptor unit tests (15, mutation-checked), fixture validator, strict `tsc` on world.ts, syntax transpile of the React files. First real-browser walk happens on the owner's machine.
PRJ-0009 · 2026-11-16 · GitHub push to the repo is refused from this session (Claude GitHub App not installed on that account). Work is delivered as a patch/tarball until that is fixed.
PRJ-0010 · 2026-11-16 · /dashboard started: contract derived from the page + both route handlers; 8 worlds (new-user, skipped-reminder, empty, few-files, busy, slow-load, api-failing, signed-out). Invented content is limited to names/counts inside real shapes and is labelled in each `$comment`.
PRJ-0011 · 2026-11-16 · world.ts gains time tokens (`"$now-3h"`) expanded at serve time, so relative labels ("5m ago") stay true whenever a world is walked. Manifest entries now carry `pages` ("*" = shell world, "/route" = page world); the rig lists page worlds first and walks only the page's own worlds once it has any.
PRJ-0012 · 2026-11-16 · check-worlds.mjs now also (a) requires every world listed for a page to pin that page's mount calls (pilot/page-calls.json), (b) checks Brand/Channel/styleGuide rows against the Prisma models + route select, generation rows against the route select + `kind` union, and that fixture image paths exist in public/.

## PRJ-0013 — Whole-service staging from the running app
- Network was enabled, so the app now runs here (npm ci --ignore-scripts; `prisma generate` is blocked by binaries.prisma.sh, but pages do not need it).
- Replaced the hand-converted dashboard markup with CAPTURE: `pilot/design/capture/capture.py` loads every page x every applicable world in headless Chrome and saves the real DOM; `build_boards.py` turns that into one Design board per page (the app's compiled CSS with `@media` rewritten to `@container page`, so width/height presets re-flow like a real viewport).
- Preloader is skipped (localStorage `mk_preloader_day`) and `#mk-preloader` is stripped from captures.
- 13 new page worlds from `pilot/scripts/gen-page-worlds.mjs`, shapes read from the API routes and Prisma (templates, inspiration, chat, calendar, ai, admin). Admin settings/rules/plans are read from `DEFAULT_*` in source so they cannot drift.
- Pages with no extra data calls (projects, settings, billing, home, signup) are fully covered by the shell worlds.
- Limits: boards are static captures at 1280px DOM (links/buttons inert); click-triggered states (modals, wizards, hover menus) are not captured yet; `/login`, `/`, `/brain`, `/jobs`, `/projects/[id]` are redirects and have no board.

## PRJ-0014 — Every click-triggered call pinned; layered worlds; unpinned crawl
- Audit: diffed every `fetch()` in src/ against the pinned keys. Gaps were billing history/public, slideshow styles/characters, the three admin sub-tabs, GET /api/templates (project quick-create), DELETE /api/chat-session (New chat), guests' GET /api/projects, and every POST/PUT/PATCH/DELETE a wizard or modal makes.
- `pilot/scripts/gen-action-worlds.mjs` (run after gen-page-worlds.mjs): new partial `_actions` with 53 happy-path pins (extended by `_signed-in`, `_signed-out`, `session-probe-down`), plus 17 failure/edge worlds: billing (history-empty, plan-past-due, plan-cancelling, no-card, payment-declined, payments-unavailable), AI studio (generate-failing, carousel-task-failed, generate-slow, generate-402, wizards-empty, wizards-failing), signup (email-taken, server-error), admin tabs (populated, empty, denied). `out-of-credits-402` widened to every spending call. Paystack `url` redirects are deliberately never pinned.
- world.ts: `?world=a+b` layers worlds (later wins). The rig layers a page's default world under any shell world, so "new-user-onboarding on /templates" has its data.
- `pilot/design/export/crawl_unpinned.py` crawls page x world x 390/768/1280 and clicks up to 30 buttons per page world; final run: 0 unpinned calls. Trap found on the way: a build without NEXT_PUBLIC_PILOT=1 leaves the interceptor off and the crawl falsely reports 0, so confirm with a deliberately wrong world first.
- Limits: the crawl clicks buttons only (no typing, no multi-step wizard walks, no hover menus); pinned bodies are shapes read from the routes, so a field the client reads from a route's real answer but the route never sends would not show up here.

## PRJ-0015 — Canvas view for the live rig
- The Design canvas type forbids `<iframe>`, so the live app cannot sit on a Design board. The same view is built into the live rig instead: a CANVAS pill lays out all 12 pages as live iframes at the chosen width/height (default 1280x800), with pan (drag / wheel), zoom (ctrl+wheel, -/+, Fit, 1:1) and Space-to-pan over a frame.
- In canvas mode the RIG modal's Page select focuses a frame, the World select sets a shell world for all frames (layered under each page's default) or a page world for that one frame, and width/height presets resize every frame. In-app link clicks navigate only the frame they came from. Billing and Signup default to paid-power-user and signed-out.

## PRJ-0016 — Comments work in canvas view; selector bug fixed
- The comment layer now targets every frame: in canvas view each page frame is its own comment context (page, effective world, width), hover highlight and pins are scaled by the canvas zoom and re-placed on pan/zoom, and comment mode survives toggling CANVAS/SINGLE.
- Bug fixed: `sel()` kept class names like `!max-w-none` that are not valid in a CSS selector, so `querySelector` threw and the pin silently never drew. Classes are now limited to plain identifiers. This also affected single view.

## PRJ-0017 — Upstream merge (Update 68) and Composition state
- Merged origin/main (793e4fa, "Update 68: composition setting for single ads") into `pilot-rig`; no conflicts. Upstream touched `src/lib/ai/composition.ts` (new), `/api/ai/chat`, the AI studio and chat pages, `ProjectSettings` (Composition setting), `ProjectPrompt` (Product / Reference-ad toggle for attached images), `adDirector.ts`, `designTemplates/pack.ts`, `public/templates/images/pinlogo.png`.
- Pin audit: the route changes are request-body only, so no existing pin needed to change; the Product/Reference-ad toggle makes no new call.
- New state: world `ai-composition-fixed` (ai-with-history with `advancedSettings.composition = "bottom-left"`), generated by `gen-action-worlds.mjs`. Now 48 worlds valid, 17 world tests pass.
- Crawl of /ai and /chat after the merge: 0 unpinned, 0 crashes. Live rig republished with the new build.

## PRJ-0018 — Header menus close on outside click (real app bug, found via rig comment)
- Comment on /dashboard: the "Create project" popup stayed open when the page was clicked. Cause in `AppHeader.tsx`: each menu used a `fixed inset-0` backdrop to catch outside clicks, but the header has `backdrop-blur-md`, which makes `fixed` children position against the header bar (72px), so the backdrop never covered the page.
- Fix: removed the three backdrops; one document `pointerdown` listener (capture) closes the open menu when the press is outside any `[data-hdr-menu]` wrapper; Esc also closes. Applies to Create project, Chat history and the bell.
- Verified in the static export at 1280x800: canvas click closes Create project and Chat history; Esc closes; the toggle button still opens and closes.
- Follow-up: the press that closes a header menu is now swallowed (pointerdown stopped; the matching mousedown/mouseup/click eaten once, 600ms safety timeout), so clicking the page only closes the menu. Verified: 0 page clicks seen on the closing press, the next click works normally.

## PRJ-0019 — Comment mode no longer activates the element
- Comment mode only cancelled `click`, so the page still saw pointerdown/mousedown/mouseup (menus, buttons using those). Now rig.html swallows pointerdown/up, mousedown/up, dblclick, auxclick, contextmenu, touchstart/end and submit (capture, stopImmediatePropagation) while comment mode is on. Verified: clicking "Create project" in comment mode gave 0 events to the app, no menu opened, comment popup appeared.

## PRJ-0020 — Send to Claude (no copy/paste)
- Comments panel has a "Send to Claude" button: each unsent comment is written to the artifact's shared db at `inbox/<id>` ({page, world, width, selector, element, note, status:"new"}) and marked "✓ sent". Falls back to Copy all if the db is unreachable. Artifact declares `db` and `user`.
- Limit: an artifact cannot start a Claude task by itself here (wake is `not_armed: no_address` for this session), so Claude reads the inbox when the user says "go" in chat. Not tested end-to-end in the claude.ai viewer.

## PRJ-0021 — Tapping a link in comment mode changed the page
- Cause: the static build's link hook (PilotBoot, document capture) posts `pilotNav` to the rig on any anchor click and ran before the comment layer's listeners. Fix: the comment layer now listens on the iframe's `window` (runs first), and the rig ignores `pilotNav` messages while comment mode is on. Touch events are hidden from the app but not cancelled (cancelling touchend suppresses the click that opens the comment box).
- Verified with a touch context: tapping the `/home` link in comment mode leaves the page unchanged and opens the comment box; mouse test still 0 events to the app.

## PRJ-0022 — First comment sent from the rig and applied
- Inbox comment (/dashboard, dashboard-few-files): "reduce padding here by 40 percent" on the project card. `LightCard` default `md` is p-5 (20px); this card now uses `padding="sm"` (12px, -40%). Only the dashboard project cards changed. Verified: computed padding 12px in the export. Inbox doc marked `done`.

## PRJ-0023 — Four inbox comments on the dashboard project card; comments now send on Add
- Card (src/app/(dashboard)/dashboard/page.tsx): header row `mb-10` (40px); title = project (brand) name; second line = category (Ads / Carousels / Slideshows / Thumbnails) from `projectKind()`; badge = platform before the underscore (instagram_post -> instagram).
- Category source: the project wizard stores one marker per kind in the brand's `advancedSettings` (thumbPackId / carousel / characters|slideshowStyleId / adPackId); older projects without a marker fall back to platform (tiktok -> Slideshows, youtube_thumbnail -> Thumbnails, else Ads). The pinned worlds' brands have no advancedSettings, so the rig shows the platform fallback.
- Rig: the comment popup's button is now "Add & send to Claude" and writes to the inbox immediately.

## PRJ-0024 — Three more card comments
- Project card: second line = platform name (Instagram, TikTok, YouTube…), badge = category (Ads/Carousels/Slideshows/Thumbnails), gap under the top row 40px -> 32px (`mb-8`).

## PRJ-0025 — Project card icon +20%
- Icon tile 32px -> 38.4px (`w-[38.4px] h-[38.4px]`), glyph 16 -> 19. Measured 38.39px in the export.

## PRJ-0026 — New project starts with a type picker
- Request: "New project" did nothing useful; it should start by choosing what to make and follow that path. Answers: type picker first; all four types; finish in the AI studio.
- `OnboardingModal` with no `kind` now opens with step "What do you want to make?" (Ads / Carousels / Slideshows / Thumbnails), then runs that kind's own steps (business, size, kind settings, style) and opens `/ai?channel=<id>` at the end (`openChat` defaults to true). Affects the header's New project, the Projects page and QuickCreate; the four "Make …" entries still skip the picker.
- Verified in the export: picker shows, Continue disabled until a card is chosen, Carousels -> business -> "Default carousel size" -> "Carousel style".
- Not tested: the final create call against the real API (the rig pins it).

## PRJ-0027 — Template gallery in the New project wizard (ads and thumbnails)
- The "Reference ads" / "Reference thumbnails" step shows the ready-made templates as cards grouped by category (your own styles first under "My styles"), with an Auto card first and a dashed "Add my style" tile below that opens the existing pack wizard. Replaces the dropdown in the wizard only; the project settings picker keeps the dropdown (`AdPackPicker variant="gallery"`).
- `/api/ad-packs` now returns `category` per pack (the field already exists on DesignTemplate). Packs with no category fall under "More templates".
- Rig: demo packs have categories; `_actions` pins GET /api/ad-packs (+ `?purpose=thumbnail`) so the wizard has templates outside the AI studio worlds. 48 worlds valid, 17 tests pass.

## PRJ-0028 — References and Colours/font are separate wizard steps
- The wizard's single "Show us your style" step is now two optional steps: "Add references" (pick styles you like + upload reference images) and "Colours and font" (brand colours, tone, heading font, style notes). Applies to ads, carousels and thumbnails (slideshows have no style step). Both are skippable; the last step creates the project.
- Verified in the export: Ads now has 5 steps (kind, business, size, template, references, colours/font = steps 1-5 after the picker count).

## PRJ-0029 — Ads wizard: template-pack step removed (for now)
- Request: the "Reference ads" step (Auto + template gallery + Add my style) is redundant; templates and reference uploads live on the references step. The ads wizard is now: business, size, references (template grid + reference images), colours and font (4 steps). Ads projects still save `adPackId: ""` so the category stays "Ads". Thumbnails, carousels and slideshows keep their own settings step. The gallery variant of `AdPackPicker` stays in the code, unused by the wizard.
- An attempt to merge the two screens was reverted at the user's request.

## PRJ-0030 — Admin: four categories, bulk/folder add, drag to slots, auto-study
- Template categories are now only Ads, Carousels, Thumbnails, Slideshows (`CATEGORIES`/`canonCategory`; legacy strings map at read time, unknown -> "Unclassified"; saving writes the canonical one). No "New category" input.
- Carousel and slideshow style editors accept multiple images or a whole folder into a tray; drag them onto Intro / Details / Outro (or reorder slideshow slides), or use Auto-sort.
- Reference DNA is studied automatically when the images change (hand-edited DNA is kept); "Re-study" remains for a manual redo.
- Rig fixtures for the admin worlds corrected. Verified in the export: drop from tray to slot moves the image (synthetic DnD events); Playwright's drag_to doesn't carry dataTransfer so it can't test this.

## PRJ-0031 — Cover image + one extra prompt for every pack/style
- Carousel and slideshow styles: click the star on any reference image to make it the cover shown on pickers and the templates page (default: first image). One optional "Extra prompt" box per style is added to every generation (carousel planner + each slide; slideshow plan + photo). New DB columns `coverImage` and `extraPrompt` on CarouselStyle and SlideshowStyle (run `prisma db push`).
- Ad and thumbnail packs: star on an example image moves it to the front (the cover); "Extra prompt" box reuses the pack's `prompt` field, appended to ad and thumbnail generation.
- Not run against the real DB/API here.

## PRJ-0032 — Admin tabs: Static ads and Thumbnails; start applies DB columns
- The admin "Templates" tab is replaced by "Static ads" (category Ads: templates and reference packs) and "Thumbnails" (thumbnail reference packs). Each tab lists only its own category, creates new items in it, and hides the category picker. Carousels and Slideshows unchanged.
- `npm start` now runs `prisma db push --skip-generate` first (additive only, no `--accept-data-loss`) so the new coverImage/extraPrompt columns exist; their absence made the Carousels tab spin forever.
- Rig admin worlds not updated for the renamed tabs.

## PRJ-0033 — Admin Users: full list, add-credits popup, disable/enable
- Admin > Users now lists every user (newest first, up to 300, searchable) with joined date, credit balance and Active/Disabled. Each row has "Add credits" (opens a popup with balance, Grant/Remove credits, unlock free images, onboarding answers) and "Disable"/"Enable".
- New `User.disabled` column. A disabled user cannot sign in (password or Google) and an existing session is treated as signed out on the next request. Admins can't be disabled.
- API: `listUsers`, `setDisabled` actions on /api/admin/billing. The old find-by-email box is replaced by the search field.
- Not run against the real DB (needs the column; `npm start` applies it).

## PRJ-0034 — Format comes from the project size (no one picks it)
- Removed the Format dropdown from the template editor and no picker is shown to users. When a template runs for a project, the format is derived from the size the user already chose for it (e.g. Instagram portrait -> 4:5, story/TikTok -> 9:16, Twitter/YouTube/LinkedIn post -> 16:9, square -> 1:1). With no project it falls back to the template's stored default (9:16, packs 4:5).

## PRJ-0035 — Fix: "Invalid prisma.designTemplate.create()" when saving a template
- Cause: the DesignTemplate model in prisma/schema.prisma had no `kind`, `refImages`, `packDna` or `refDnas` columns, but the code saves them, so Prisma rejected every new template. Added the four columns (defaults keep existing rows valid). `npm start` applies them with `prisma db push`.

## PRJ-0036 — Product photo is always optional
- Removed the "Users must upload a product photo" checkbox. The Use-template popup never requires a photo (label says optional) and the generate API no longer rejects a missing one. The stored `needsProduct` value is ignored except for the cost estimate.

## PRJ-0037 — Brand voice and colours are always applied
- Removed the "Write words in the project's brand voice" checkbox. When a project is picked, every template now uses its brand brain (wording) and brand colours; the project picker always shows. `useBrandBrain` is no longer read.

## PRJ-0038 — One-click Publish in the template editor
- The "Published" checkbox is replaced by buttons: a draft shows "Save draft" and "Publish" (saves and publishes in one click); a published template shows "Unpublish" and "Save changes". Carousels and slideshows still use the checkbox.

## PRJ-0039 — Publish / Unpublish buttons for carousel and slideshow styles
- Same as templates: draft -> "Save draft" + "Publish"; published -> "Unpublish" + "Save changes". Checkbox removed.

## PRJ-0040 — Template cards: image at full width, natural height
- Cards with a cover image now show it at width 100% and height auto (no cropping, so each card is as tall as its image). Cards without an image keep the placeholder at the template's shape.

## PRJ-0041 — Using a reference pack template creates/uses a project
- On the templates page, "Use template" on an Ads or Thumbnails reference pack now opens "Add it to": a dropdown of your projects (that fit: thumbnail projects for thumbnail packs) plus "+ Create a new project".
  - Existing project: the pack is saved into its settings (`adPackId` / `thumbPackId`, merged with what's there) and the AI studio opens on that project.
  - New project: the project setup wizard runs (business, size, references, colours), the template step is skipped because it's preset, and it ends in the AI studio.
- Either way the work lives under Projects. The older written-prompt templates (1-3) keep the previous popup. Not tested against the real API.

## PRJ-0042 — Light gray border on template cards
- Template cards on the templates page have a 1px light gray border (`border-gray-300`).

## PRJ-0043 — Carousel admin: one way to add images
- Removed the per-slot "Add references" buttons. Images are added in one place ("Add many at once": choose images or a folder, or drop them), then dragged onto Intro / Details / Outro (or Auto-sort). Dropping files straight onto a slot still works.

## PRJ-0044 — Carousel and slideshow styles show on the templates page
- The templates page now also lists the admin's published carousel styles (tab Carousels) and slideshow styles (tab Slideshows), using each style's cover image. "Use template" opens the same "Add it to a project" box: existing project (the style is saved into it) or a new project (wizard with the style preselected; the carousel style step is skipped, slideshows still ask for the character). A carousel style only appears once it has references for intro, details and outro.

## PRJ-0045 — Image slider on carousel and slideshow cards
- Carousel and slideshow cards on the templates page cycle through their images (cover, then intro/details/outro or the example slides). Dots sit bottom-centre; left and right arrows appear mid-height on hover. Arrows are white with a black border and turn black on hover; dots are white with a black border, the active one is a wider pill, inactive ones brighten and grow on hover. Clicking an arrow or dot doesn't open the template.

## PRJ-0046 — Using a template always creates a new project (replaces the "add to project" box)
- Flow: pick a template -> project setup opens with that template as the reference pack -> optional name and details, or "Use an existing project's brain" (copies that project's brand brain on create, and pre-fills its colours, font and tone) -> confirm creates a NEW project -> opens the AI studio on it. The project shows under Projects.
- Name is optional here (defaults to the template's name). Works for Ads, Thumbnails, Carousels and Slideshows reference packs/styles; the older written-prompt templates keep the old popup.
- Projects page: "or start from a template" link under Create new project (and in the empty state) opens the templates page.
- API: POST /api/projects takes `copyBrainFrom` (a brand id the user owns).
- Supersedes PRJ-0041's "Add it to" dropdown.

## PRJ-0047 — Written templates with example images also start a project
- Template 14 ("Premium Interior") is a written-prompt template with example images, so it still opened the old Generate popup. Any template with example images now opens the project flow, and `resolvePack` treats such a template's example images as its reference images (no studied DNA, so results are less tuned than a reference pack). Templates 1-3 have no images and keep the old popup.

## PRJ-0048 — Template flow: copy a project's style and you're done
- From a template the references step is gone (the template is the style). The "brain" picker is now "Use an existing project's style". Choosing one copies its voice, audience, colours, font and size, hides the detail fields, and the wizard is a single step: optional name, then Create project (it opens the AI studio). Without a project selected the steps are: details, size, (slideshows: character), colours and font. Slideshows from a template no longer ask for a style again.

## PRJ-0049 — Mobile fixes from rig comments (4)
- /chat landing: reference/template tiles are 2 per row on mobile (4 from sm).
- Header on mobile: two-line menu button on the left (opens the sidebar as a drawer, closes on navigate or backdrop tap) then the logo; credits on the right; all items smaller (h-8, smaller text), "credits" word and bell hidden on mobile.
- /ai: a Settings button on the right of the project bar (below lg) opens the project settings as a right drawer; the right panel was a fixed 380px that overflowed phones. The project picker button has no padding or border on mobile and sits flush left.
- Not checked in a browser (no export rebuild).

## PRJ-0050 — Mobile round 2 (5 rig comments)
- /ai: Settings is a bottom sheet that slides up (below lg) with a Cancel button; X kept.
- /chat mobile: "Discover and remix ideas" hidden; Chat history button hidden; Create project moved to the right end after credits/bell (desktop unchanged).

## PRJ-0051 — /dashboard stat cards 2 per row on mobile, smaller icon/text/padding.
- Revised: heading back on top; composer pinned to the bottom of the screen on mobile.
- Heading on mobile: "Make an ad for my" on line 1, the typed brand on its own line below.
- /chat tiles: 4 per row on mobile, smaller padding/text.
- /chat tiles mobile: no padding, image fills tile, aligned to top.
- /chat tiles mobile: only 3 shown (Add reference + 2), 3 columns.
- /chat tiles mobile: 30px bottom padding.
- /chat tiles mobile: bottom padding 45px.
- /dashboard mobile: Files/Projects card hidden; .uxlly-content side padding 12px below sm (matches header).
- /templates mobile: search box hidden; category pills one row, no wrap, horizontal scroll.

## PRJ-0052 — Composition + reference together
- Pack generation and the ad director now combine both: fixed text position overrides only the text layout (reference still sets the look); on "auto" the reference layout is followed unless the request says where the text goes.

## PRJ-0053 — Ad format library + hook styles (Madvera skill)
- New src/lib/ai/adFormats.ts: 37 named formats (layouts in canvas %), namedFormat(), candidateFormats() (8, repeatable, skips formats used in the chat, mixes graphic/photo), 24 hook styles with a 6-style shortlist.
- adDirector: named format -> use exactly it; else pick from shortlist; copy rules (outcome-led, so-what test, concrete lines, full set for multi-packs).
- chat route: named format or "something new" skips packs and uses the library; explicit packs and reference ads still win.
- Revised PRJ-0053: the ad pack stays ON for look. A named/shortlisted format now supplies the LAYOUT only (generatePackAd layoutOverride); reference ads still win entirely.
- Composition + format + pack together: fixed text position limits the shortlist to text-block-friendly formats; a named structured format becomes the visual idea only, text goes in the fixed block; pack still teaches the look; logo is pasted above the block as before.
- Library only when the user names a format or explicitly asks for a different layout/style/surprise; a plain "make an ad" / "another one" stays on the simple path (reference pack + composition).
- Smarter product interaction: packs/director adapt the reference pose to how the product is really used (bed = lie on it, bowl = eat from it...), realistic scale.
- Project settings: Offers moved below Style references and Colors.
- Project settings now per project kind (kind saved at creation, inferred for older projects): Single ads / composition only for ads, Thumbnails only for thumbnails, Characters only for slideshows, Carousel only for carousels. "Add a character" is a dotted button "Add character sheet".

## PRJ-0054 — Positive prompt
- Project settings: new "Positive prompt" box under Negative. Saved as advancedSettings.positivePrompt, applied with the negative via applyProjectNegative (usage.ts) and appended to every image call as "ALWAYS INCLUDE (brand rules)" next to "NEVER INCLUDE (brand rules)" (openai + together providers).
- Project settings: Language moved up (after Fonts, before Logo).
- /dashboard mobile: Files/Projects card restored; container padding, border, shadow and background removed on mobile so project cards fill the width.
- Header menu (hamburger) button: light grey bg + border, same as the other header buttons; header is shared so it applies on every page.
- Reverted the mobile .uxlly-content 12px side padding; back to the original 1.5rem.
- Header hamburger: no border/padding/bg; icon lines stretched wider (28px).
- Header hamburger reverted to the original (w-8 h-8, hover bg only, 18px icon).
