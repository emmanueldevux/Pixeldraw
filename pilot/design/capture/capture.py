import json, hashlib, sys, os, re, urllib.request
from playwright.sync_api import sync_playwright
BASE="http://localhost:3000"
man=json.load(open("/home/claude/pixeldraw/public/pilot/worlds/index.json"))["worlds"]
ROUTES=["/dashboard","/templates","/projects","/inspiration","/calendar","/chat","/ai","/billing","/settings","/admin","/signup","/home"]
only=sys.argv[1:] 
os.makedirs("out",exist_ok=True)
JS = r"""
async () => {
  const root = document.body.cloneNode(true);
  root.querySelectorAll('#mk-preloader,script,noscript,nextjs-portal,next-route-announcer,[data-nextjs-dialog-overlay],style[data-next-hide-fouc]').forEach(e=>e.remove());
  const live = [...document.body.querySelectorAll('img')];
  const cl = [...root.querySelectorAll('img')];
  for (let i=0;i<cl.length;i++){
    const im = live[i], c = cl[i];
    c.removeAttribute('srcset'); c.removeAttribute('sizes'); c.removeAttribute('loading');
    try{
      const src = im.currentSrc || im.src;
      if (!im.complete || !im.naturalWidth) continue;
      if (/\.svg(\?|$)/i.test(src)) { const t = await (await fetch(src)).text(); c.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(t))); continue; }
      const s = Math.min(1, 480/im.naturalWidth), cv=document.createElement('canvas');
      cv.width=Math.round(im.naturalWidth*s); cv.height=Math.round(im.naturalHeight*s);
      cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
      c.src = cv.toDataURL(/\.png/i.test(src)?'image/png':'image/jpeg',0.72);
    }catch(e){}
  }
  return {html: root.innerHTML, w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight};
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for route in ROUTES:
        if only and route not in only: continue
        names=[w["name"] for w in man if "*" in w["pages"] or route in w["pages"]]
        variants={}; per={}
        for n in names:
            ctx=b.new_context(viewport={"width":1280,"height":900})
            ctx.add_init_script("try{localStorage.setItem('mk_preloader_day', new Date().toDateString())}catch(e){}")
            pg=ctx.new_page()
            unp=[]
            pg.on("console", lambda m: "unpinned" in m.text.lower() and unp.append(m.text[:140]))
            try:
                pg.goto(f"{BASE}{route}?world={n}", wait_until="networkidle", timeout=90000)
                pg.wait_for_timeout(2500)
                r=pg.evaluate(JS)
                h=hashlib.sha1(r["html"].encode()).hexdigest()[:10]
                variants.setdefault(h,{"html":r["html"],"worlds":[],"h":r["h"],"w":r["w"]})["worlds"].append(n)
                per[n]={"hash":h,"unpinned":unp[:5],"url":pg.url}
                print(route,n,h,len(r["html"]),r["h"],len(unp),flush=True)
            except Exception as e:
                print(route,n,"FAIL",str(e)[:100],flush=True)
            ctx.close()
        json.dump({"route":route,"variants":variants,"per":per},open("out/"+(route.strip("/") or "root")+".json","w"))
    b.close()
