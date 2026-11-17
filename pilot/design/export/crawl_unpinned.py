# Crawl every page x applicable world x width against the static export and report any call that answered 599 (unpinned).
# usage: crawl_unpinned.py <base-url, e.g. http://localhost:8124/x> <out.json> [--clicks]
import json, sys, collections
from playwright.sync_api import sync_playwright
base, out = sys.argv[1], sys.argv[2]; clicks = "--clicks" in sys.argv
man = json.load(open("/home/claude/pixeldraw/public/pilot/worlds/index.json"))["worlds"]
ROUTES = ["/dashboard","/templates","/projects","/inspiration","/calendar","/chat","/ai","/billing","/settings","/admin","/signup","/home"]
WIDTHS = [(390,844),(768,1024),(1280,800)]
res = collections.defaultdict(set); crashes = []
def unp(pg):
    try: return pg.evaluate("window.world && window.world.unpinned ? window.world.unpinned() : null") or []
    except Exception as e: return ["EVAL-FAIL "+str(e)[:60]]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for route in ROUTES:
        own = [w["name"] for w in man if route in w["pages"]]
        shell = [w["name"] for w in man if "*" in w["pages"]]
        import re
        dflt = ([n for n in own if re.search(r"few-files|populated|busy|with-history|templates$", n)] or own or [None])[0]
        for name in own + [((dflt + "+") if dflt else "") + s for s in (shell if route in ("/dashboard","/ai","/billing") else ["paid-power-user","signed-out"])]:
            ctx = b.new_context(viewport={"width":1280,"height":800})
            ctx.add_init_script("try{localStorage.setItem('mk_preloader_day', new Date().toDateString())}catch(e){}")
            pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
            try:
                pg.goto(f"{base}{route}.html?world={name}", wait_until="networkidle", timeout=20000); pg.wait_for_timeout(1200)
                for (w, h) in WIDTHS:
                    pg.set_viewport_size({"width":w,"height":h}); pg.wait_for_timeout(250)
                for u in unp(pg): res[(route,name)].add("load: "+u)
                if clicks and (name in own or name.endswith("+paid-power-user")):
                    pg.set_viewport_size({"width":1280,"height":800})
                    sel = "button:visible, [role=tab]:visible, [role=button]:visible"
                    n = min(pg.locator(sel).count(), 30)
                    for i in range(n):
                        try:
                            el = pg.locator(sel).nth(i); lab = (el.inner_text(timeout=500) or el.get_attribute("aria-label") or "?")[:30].replace("\n"," ")
                            before = set(unp(pg)); el.click(timeout=1500, no_wait_after=True); pg.wait_for_timeout(700)
                            for u in set(unp(pg)) - before: res[(route,name)].add(f"click[{lab}]: {u}")
                            pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
                            if not pg.url.startswith(f"{base}{route}.html"): pg.goto(f"{base}{route}.html?world={name}", wait_until="networkidle"); pg.wait_for_timeout(600)
                        except Exception as e: pass
            except Exception as e:
                crashes.append((route, name, str(e)[:100]))
            if errs: crashes.append((route, name, "pageerror: "+errs[0]))
            ctx.close()
    b.close()
flat = {f"{r} | {w}": sorted(v) for (r,w), v in res.items() if v}
json.dump({"unpinned": flat, "crashes": crashes}, open(out,"w"), indent=1)
print("combos with unpinned:", len(flat), "| crashes:", len(crashes))
