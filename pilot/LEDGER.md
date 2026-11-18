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
