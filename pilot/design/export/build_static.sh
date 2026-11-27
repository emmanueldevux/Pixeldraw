#!/usr/bin/env bash
# Rebuild the static export of the app with fake data on, and package it for the artifact tools.
# usage: pilot/design/export/build_static.sh [workdir]     (default workdir: /tmp/pilot-build)
# Result: <workdir>/pkg  (publish every file in it; index.html is the rig). Nothing in the repo is changed.
# Needs: node/npm, python3 + Pillow, network for npm. Google Fonts are replaced by local @fontsource copies,
# because the build sandbox cannot reach fonts.googleapis.com.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
WORK="${1:-/tmp/pilot-build}"
rm -rf "$WORK"; mkdir -p "$WORK"
cp -r "$REPO" "$WORK/app"; rm -rf "$WORK/app/.git"; cd "$WORK/app"
npm ci --ignore-scripts --no-audit --no-fund
npm i --no-save --ignore-scripts --no-audit --no-fund @fontsource-variable/inter @fontsource-variable/inter-tight

# a static export has no server: drop route handlers and redirect-only pages (they have no state to show)
rm -rf src/app/api src/app/pilot "src/app/(dashboard)/projects/[id]" src/app/page.tsx \
       "src/app/(dashboard)/brain" "src/app/(dashboard)/jobs" "src/app/(auth)/login"
python3 - <<'EOF'
p = "next.config.mjs"; t = open(p).read()
t = t.replace("const nextConfig = {", "const nextConfig = {\n  output: 'export',\n  trailingSlash: false,\n", 1)
t = t.replace("  images: {", "  images: {\n    unoptimized: true,", 1)
open(p, "w").write(t)
EOF

# local font mock: any Inter / Inter Tight request from next/font/google is answered with the @fontsource file
cat > "$WORK/fontmock.js" <<EOF
const base = "$WORK/app/node_modules/@fontsource-variable/";
module.exports = new Proxy({}, { get: (t, url) => {
  if (typeof url !== "string") return undefined;
  const tight = /Inter\+Tight/.test(url);
  const file = base + (tight ? "inter-tight/files/inter-tight-latin-wght-normal.woff2" : "inter/files/inter-latin-wght-normal.woff2");
  return "@font-face{font-family:'" + (tight ? "Inter Tight" : "Inter") + "';font-style:normal;font-weight:100 900;font-display:swap;src:url(" + file + ") format('woff2');}";
}});
EOF
NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$WORK/fontmock.js" NEXT_PUBLIC_PILOT=1 NEXT_PUBLIC_PILOT_STATIC=1 npx next build
python3 "$REPO/pilot/design/export/package_static.py" out "$WORK/pkg"
echo "ready: $WORK/pkg ($(find "$WORK/pkg" -type f | wc -l) files)"
