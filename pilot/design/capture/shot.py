import sys
from playwright.sync_api import sync_playwright
url, out, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": w, "height": h}); ctx.add_init_script("try{localStorage.setItem('mk_preloader_day', new Date().toDateString())}catch(e){}"); pg = ctx.new_page()
    logs=[]
    pg.on("console", lambda m: m.type in ("error","warning") and logs.append(m.text[:160]))
    pg.goto(url, wait_until="networkidle", timeout=60000)
    pg.wait_for_timeout(1200)
    pg.screenshot(path=out)
    print("\n".join(logs[:6]))
    b.close()
