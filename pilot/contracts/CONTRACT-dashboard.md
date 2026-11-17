# CONTRACT — /dashboard
Page: src/app/(dashboard)/dashboard/page.tsx (client component). Worlds: `public/pilot/worlds/dashboard-*.world.json`.
Both calls fire ON MOUNT and are NOT auth-gated in the page (it fetches whether or not anyone is signed in).

## GET /api/generations?limit=60   → Files tab
Success 200 `{ success:true, data:[{ id, kind:"image"|"carousel"|"template", title, imageUrls:string[], caption, brandId, createdAt }] }`, newest first, `limit` clamped 1–200 (default 60), excludes `deleted`.
Errors: 401 `{error:"Unauthorized"}` · no try/catch in the route, so a thrown DB error is Next's own 500 with a NON-JSON body.
Page: keeps only rows with `imageUrls.length`; tile = `imageUrls[0]`; label = `title || "Design"`; count>1 → "N slides" pill. `!d.success` → returns silently. Any rejection (incl. r.json() on the 500 body) → swallowed. No loading state on this tab.
Source: src/app/api/generations/route.ts; src/lib/generations.ts (kind).

## GET /api/projects   → Projects tab
Success 200 `{ success:true, data: Brand[] }` (shape: CONTRACT-shell.md). Page flattens `brand.channels[]` and adds `brandName`.
Errors: 401 `{error:"Unauthorized"}` · 500 `{error:"Internal error"}`.
Page: `channelsLoading` true until the call settles (spinner); then empty → "No projects yet / Create your first project" (link to /projects); else cards (3 per row from md): name, brandName, platform badge, `_count.posts`, `formatRelative(updatedAt)`. Failure of any kind clears loading and shows the EMPTY state.

## Derived client-side
- Stat cards: hardcoded "0" strings (code comment: "placeholder data") — not derived from any call.
- `formatRelative`: just now (<60s) · Nm ago · Nh ago · Nd ago (<7d) · absolute date. Worlds use `$now-…` tokens so the buckets stay true.
- OnboardingReminder: renders only when onboarding status is "skipped" AND pathname is "/dashboard" (from the shell's GET /api/onboarding).

## Interactions NOT yet walked (calls fire on click; add worlds when walked)
Quick-action cards and "Quick" buttons open OnboardingModal / CarouselQuickModal / ThumbnailWizard / SlideshowQuickModal / AdWizard — each fetches /api/projects and more (see STATE-MAP.generated.md). "Schedule a job" → /calendar. Project card → /projects/:channelId → server redirect → /ai?channel=:channelId.
