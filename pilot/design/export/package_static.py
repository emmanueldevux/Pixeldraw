"""Turn a `next build` static export (output:'export') into a folder that works under ANY base path.
usage: package_static.py <export-out-dir> <dest-dir>"""
import os, re, shutil, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(dst): shutil.rmtree(dst)
shutil.copytree(src, dst)
for f in [f for f in os.listdir(dst) if f.endswith(".txt") or f == "404.html"]: os.remove(os.path.join(dst, f))
shutil.rmtree(os.path.join(dst, "_next", "static", "chunks", "pages"), ignore_errors=True)
ABS = re.compile(r'(["\'(=])/(_next|templates|pilot)/')
n = 0
for d, _, fs in os.walk(dst):
    for f in fs:
        p = os.path.join(d, f)
        if f.endswith((".html", ".js", ".json")) and not p.startswith(os.path.join(dst, "pilot")):
            t = open(p, encoding="utf-8").read(); u = ABS.sub(r"\1./\2/", t)
            if u != t: open(p, "w", encoding="utf-8").write(u); n += 1
        elif f.endswith(".css"):
            t = open(p, encoding="utf-8").read(); u = t.replace("url(/_next/static/", "url(../")
            if u != t: open(p, "w", encoding="utf-8").write(u); n += 1
# fixtures point at /templates/x.jpg: make those relative too (world files are fetched, not bundled)
for f in os.listdir(os.path.join(dst, "pilot", "worlds")):
    p = os.path.join(dst, "pilot", "worlds", f)
    t = open(p, encoding="utf-8").read(); u = t.replace('"/templates/', '"./templates/')
    if u != t: open(p, "w", encoding="utf-8").write(u)
# publish-safe file names: letters, digits, dot, dash only (publish tool paths); worlds are rewritten to match
tdir = os.path.join(dst, "templates"); renames = {}
for f in sorted(os.listdir(tdir)):
    if os.path.isfile(os.path.join(tdir, f)) and not re.fullmatch(r"[A-Za-z0-9._-]+", f):
        new = "t%d%s" % (len(renames) + 1, os.path.splitext(f)[1].lower()); renames[f] = new
        os.rename(os.path.join(tdir, f), os.path.join(tdir, new))
for f in os.listdir(os.path.join(dst, "pilot", "worlds")):
    p = os.path.join(dst, "pilot", "worlds", f); t = open(p, encoding="utf-8").read(); u = t
    for old, new in renames.items(): u = u.replace(old, new)
    if u != t: open(p, "w", encoding="utf-8").write(u)
imgs = os.path.join(tdir, "images")
for f in sorted(os.listdir(imgs)):
    if not re.fullmatch(r"[A-Za-z0-9._-]+", f):
        new = f.replace(" ", "-"); os.rename(os.path.join(imgs, f), os.path.join(imgs, new))
        for d, _, fs in os.walk(dst):
            for g in fs:
                if g.endswith((".html", ".js")):
                    q = os.path.join(d, g); x = open(q, encoding="utf-8").read(); y = x.replace(f, new).replace(f.replace(" ", "%20"), new)
                    if y != x: open(q, "w", encoding="utf-8").write(y)
# route-group folders "(auth)" / "(dashboard)" -> "_auth" / "_dashboard" (parentheses are not publish-safe)
for old, new in (("(auth)", "grp-auth"), ("(dashboard)", "grp-dashboard")):
    for d, ds, fs in os.walk(dst):
        for x in ds:
            if x == old: os.rename(os.path.join(d, x), os.path.join(d, new))
    for d, _, fs in os.walk(dst):
        for g in fs:
            if g.endswith((".html", ".js")):
                q2 = os.path.join(d, g); a = open(q2, encoding="utf-8").read()
                b = a.replace(old, new).replace(old.replace("(", "%28").replace(")", "%29"), new)
                if b != a: open(q2, "w", encoding="utf-8").write(b)
# keep the artifact small: templates are previews, so cap them at 640px
for d, _, fs in os.walk(os.path.join(dst, "templates")):
    for f in fs:
        p = os.path.join(d, f)
        if f.lower().endswith((".jpg", ".jpeg", ".png")):
            im = Image.open(p); im.thumbnail((640, 640))
            im.save(p, quality=80) if f.lower().endswith((".jpg", ".jpeg")) else im.save(p, optimize=True)
# the publish tool reserves a leading underscore: rename every such name, and every reference to it
SWAP = [("_next/", "nx/"), ("_buildManifest", "buildManifest"), ("_ssgManifest", "ssgManifest"), ("_not-found", "not-found"),
        ("_base", "p-base"), ("_signed-in", "p-signed-in"), ("_signed-out", "p-signed-out"), ("_actions", "p-actions")]
for d, _, fs in os.walk(dst):
    for g in fs:
        if g.endswith((".html", ".js", ".css", ".json")):
            p2 = os.path.join(d, g); a = open(p2, encoding="utf-8").read(); b = a
            for o, n in SWAP: b = re.sub(r'(?<![A-Za-z0-9_])' + re.escape(o) + r'(?![A-Za-z0-9_])' if not o.endswith('/') else r'(?<![A-Za-z0-9_])' + re.escape(o), n, b)
            if b != a: open(p2, "w", encoding="utf-8").write(b)
for _ in range(6):
    for d, ds, fs in os.walk(dst, topdown=False):
        for x in fs + ds:
            if x.startswith("_"):
                n = x[1:]
                for o, nn in SWAP:
                    o2 = o.rstrip("/")
                    if x == o2 or x.startswith(o2 + "."): n = nn.rstrip("/") + x[len(o2):]
                os.rename(os.path.join(d, x), os.path.join(d, n))
shutil.copy(os.path.join(here, "rig.html"), os.path.join(dst, "index.html"))
print("rewrote", n, "files; total", sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(dst) for f in fs) // 1024, "KB")
