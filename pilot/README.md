# Pilot rig (Pixeldraw)

Dev/staging only. Production behaviour is unchanged unless `NEXT_PUBLIC_PILOT=1` is set at build/run time.

## Run
    NEXT_PUBLIC_PILOT=1 npm run dev
    open http://localhost:3000/pilot

Pick a page, a world and a width. The stage is an iframe of the real app; the world decides what every `/api/*` call returns.
`unpinned: N` turns red when the page made a call the world doesn't pin (answered with HTTP 599 + a console warning — never a silent 200).
"Mark walked" records page × world × width (390/768/1280) in localStorage; "copy" exports the matrix as markdown for the ledger.

## Check (no browser needed)
    node pilot/scripts/test-world.mjs      # interceptor behaviour
    node pilot/scripts/check-worlds.mjs    # fixtures vs real types/options/platform keys
    node pilot/scripts/derive-state-map.mjs > pilot/STATE-MAP.generated.md   # re-derive calls per page

## Adding a world
1. Derive it from the code first (route handler + the page's branches); put sources in `$comment`.
2. New file `public/pilot/worlds/<name>.world.json`, `extends` a partial, override only what the story changes.
3. Add it to `public/pilot/worlds/index.json`. Run `check-worlds`.

## Ship (strip the rig)
Delete `src/pilot`, `src/app/pilot`, `public/pilot`; remove the `@pilot-start … @pilot-end` blocks in `src/app/layout.tsx`;
run `node pilot/scripts/strip-check.mjs` — it must print "zero rig remnants". Keep `pilot/` docs and worlds in git as the spec.
