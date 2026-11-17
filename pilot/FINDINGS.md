# Findings from reading the code (launch-cleanup relevant, each one verifiable)

1. `next.config.mjs` ships with `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` set to true. The file's own comment says to run `npx tsc --noEmit`, fix errors, then delete both blocks before launch — type errors that hide real runtime bugs currently pass the build.
2. `(dashboard)/layout.tsx` → `AppHeader` imports all the creation wizards, so the "shell" closure is 54 files (see STATE-MAP.generated.md). Most of their calls only fire after a click, but every dashboard route bundles them.
3. Dashboard routes are browsable anonymously by design (layout comment); gated actions use `AuthGate.requireAuth`. Every page therefore needs a `signed-out` pass, not just the login page.
4. `/login` and `/` are pure server redirects (`/chat` + `?login=1`), `/brain`, `/jobs`, `/projects/[id]` too — no state to mock; they are listed so nobody tries.
5. TO VERIFY in the rig (world `session-probe-down`): next-auth's client treats a failed `/api/auth/session` as "no session", so a backend outage on load likely looks like "signed out" to the user. If confirmed, that is a launch-quality issue (UNKNOWN vs signed-out).

## /dashboard (read from src/app/(dashboard)/dashboard/page.tsx — rig worlds `dashboard-*` reproduce each)
6. Stat cards are hardcoded zeros ("Stats (placeholder data)", line ~115): a user with 60 designs still sees "Graphics Generated 0". Launch blocker for credibility, or hide the row.
7. Errors masquerade as empty: a 500 (or any failure) on /api/projects renders "No projects yet — Create your first project" for someone who has projects; a failed /api/generations renders "No files yet". World: `dashboard-api-failing`.
8. Files tab has no loading state — it shows "No files yet" until data lands (world `dashboard-slow-load`).
9. Files grid is a fixed `grid-cols-4` (line ~214, no breakpoint) while Projects collapses to 1 column on mobile — likely four ~80px tiles at 390px. TO VERIFY in the walk (`dashboard-few-files` / `dashboard-busy` at 390).
10. Dead code on the page: `showTikTok` is never set true (TikTokWizard mounted but unreachable here) and `sidebarOpen` is unused.
11. Anonymous visitors see "No projects yet / Create your first project" because the page calls the API without checking the session (world `dashboard-signed-out`).
12. Project cards link to /projects/:id which server-redirects to /ai?channel=:id (an extra hop; works, but the link target could be /ai directly).
