# CONTRACT — dashboard shell (calls made on every page)
All shapes copied from code; `Source` is where to re-check. Fixtures: `public/pilot/worlds/_signed-in.world.json`.

## GET /api/auth/session   (next-auth v4, via <SessionProvider>)
Signed out: 200 `{}` (client maps to null). Signed in: 200 `{ user:{ name, email, image, id }, expires }`; `user.id` = JWT `sub`.
Source: src/lib/auth.ts callbacks (session/jwt). Also pinned: GET /api/auth/csrf `{csrfToken}`, GET /api/auth/providers (google, credentials), POST /api/auth/_log.

## GET /api/billing/overview   (BillingProvider, only when authenticated)
200 → `BillingOverview` (src/components/billing/types.ts, 12 top-level keys). 401 `{error:"Unauthorized"}` when no session.
Derived server-side: `balanceMilli` (milli-credits; 1000 = 1 credit = creditValueCents), `free.*` (freeTrialStatus), `pricing[]` (typicalCharges), `isAdmin` (ADMIN_EMAILS), `paymentsReady` (PAYSTACK configured), `payment.currency` (PAYSTACK_CURRENCY, default NGN).
UI reaction: `paymentsReady=false` → "Payments are almost ready" modal instead of top-up/plans/auto-reload/add-card.
Source: src/app/api/billing/overview/route.ts; src/lib/billing/{free,settings,pricing,metered}.ts.

## GET /api/onboarding   (OnboardingProvider, only when authenticated)
200 `{ status:"none"|"skipped"|"completed", answers: OnboardingAnswers }`; 401 `{error:"Sign in first"}`.
UI: `none` → wizard opens over the current page; `skipped` → reminder bar on /dashboard only.
POST `{action:"save"|"complete"|"skip", answers}` → same 200 shape; 400 `{error:"Unknown action"}`; 500 `{error:"Could not save your answers"}`.
Option ids are validated against src/lib/onboarding.ts lists by check-worlds.mjs.
Source: src/app/api/onboarding/route.ts.

## GET /api/projects   (AppHeader History menu, many modals/pages)
200 `{ success:true, data: Brand[] }`, Brand = { id,userId,name,logo,logoPosition,logoScale,createdAt,updatedAt, styleGuide:{id,primaryColor,secondaryColor,accentColor,backgroundColor,headingFont,tone,extraNotes}|null, channels:[{…Channel, _count:{posts}}] } ordered by updatedAt desc. 401 `{error:"Unauthorized"}`; 500 `{error:"Internal error"}`.
Source: src/app/api/projects/route.ts.

## Out-of-credits (any metered action)
402 `{ error:"insufficient_credits", message, neededMilli, balanceMilli }` → pages call `openTopUp({reason:"out_of_credits", neededMilli})`.
Returned by: ai/chat, ai/generate-image, ai/carousel, design-templates/generate, projects/analyze, slideshow/{character,plan,slide}.
Source: src/lib/billing/http.ts insufficientResponse.
