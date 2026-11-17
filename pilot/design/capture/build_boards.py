import json, re, os, sys, html as H
ASSETS=json.load(open('/home/claude/design-out/assets.json'))
MAN={w['name']:w for w in json.load(open('/home/claude/pixeldraw/public/pilot/worlds/index.json'))['worlds']}
CSS=open('css.css').read()
PAGES=[("dashboard","Dashboard"),("templates","Templates"),("projects","Projects"),("inspiration","Inspiration"),("calendar","Calendar"),("chat","Chat"),("ai","AI Studio"),("billing","Billing"),("settings","Settings"),("admin","Admin"),("signup","Sign up"),("home","Home")]
HTML_CLS="__variable_1deade __variable_d1e4f0 __variable_4ca69c"; BODY_CLS="__className_4ca69c antialiased"
FONT={"bb996f398c82c933":ASSETS['fontRegular'],"77115271afc7bf04":ASSETS['fontRegular'],"15eac51e9bdffb9f":ASSETS['fontMedium'],"f25d80b9a6ccca3a":ASSETS['fontBold']}
def css():
    c=re.sub(r'/\*!.*?\*/','',CSS,flags=re.S)
    for k,v in FONT.items(): c=c.replace(f"/_next/static/media/{k}-s.p.ttf",v)
    c=re.sub(r'@media\s*\((min|max)-width:\s*(\d+)px\)',r'@container page (\1-width: \2px)',c)
    c=c.replace('100dvh','100cqh').replace('100vh','100cqh').replace('100vw','100cqw')
    c=re.sub(r'(^|[\s,}{])(?:html|body|:root)(?=[\s,{.:\[])',r'\1.pstage',c)
    return c
def clean(h):
    h=re.sub(r'(<img[^>]*?alt="MakeSocial"[^>]*?)src="data:[^"]*"|<img([^>]*?)src="data:[^"]*"([^>]*?alt="MakeSocial")',lambda m:(m.group(1)+'src="'+ASSETS['logo']+'"') if m.group(1) else '<img'+m.group(2)+'src="'+ASSETS['logo']+'"'+m.group(3),h)
    h=re.sub(r'href="[^"]*"','href="#"',h)
    h=re.sub(r'\s(target|action|rel)="[^"]*"','',h)
    h=h.replace('{{','&#123;&#123;').replace('}}','&#125;&#125;')
    return h
MONO="font-family:ui-monospace,SFMono-Regular,Menlo,monospace"
LAB=f"{MONO};font-size:10px;letter-spacing:.12em;color:#8c8c8c"
def board(slug,title,d):
    variants=list(d['variants'].items()); n=len(variants)
    idx={h:i for i,(h,_) in enumerate(variants)}
    worlds={}
    order=[]
    for w,info in d['per'].items():
        m=MAN.get(w,{})
        worlds[w]={"v":idx[info['hash']],"title":m.get('title',w),"about":m.get('about',''),"unpinned":sorted(set(re.sub(r'^.*?(fetch:[^ ]+).*$',r'\1',u) for u in info['unpinned']))}
        order.append(w)
    blocks="\n".join(f'<sc-if value="{{{{v{i}}}}}" hint-placeholder-val="{{{{ false }}}}">{clean(v["html"])}</sc-if>' for i,(h,v) in enumerate(variants))
    modal=f'''
  <button type="button" onClick="{{{{toggleRig}}}}" style="position:absolute;left:16px;bottom:16px;z-index:50;display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:999px;background:#0d0d0d;border:1px solid #333;color:#e8e8e8;{MONO};font-size:12px;font-weight:700;letter-spacing:.06em;box-shadow:0 6px 24px rgba(0,0,0,.5)"><span style="color:#b6ff3b">RIG</span> · {{{{vpLabel}}}}</button>
  <sc-if value="{{{{rigOpen}}}}" hint-placeholder-val="{{{{ false }}}}">
    <div onClick="{{{{toggleRig}}}}" style="position:absolute;left:0;top:0;right:0;bottom:0;z-index:60;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px">
      <div onClick="{{{{stop}}}}" style="width:440px;max-width:100%;max-height:100%;overflow:auto;background:#161616;border:1px solid #2f2f2f;border-radius:14px;padding:22px 22px 20px;color:#e8e8e8;box-shadow:0 20px 60px rgba(0,0,0,.6);font-family:system-ui,sans-serif;line-height:1.4">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:18px"><span style="font-size:20px;font-weight:700;color:#fff">Pilot rig</span><span style="{LAB}">STAGING ONLY · {title.upper()}</span><button type="button" onClick="{{{{toggleRig}}}}" aria-label="Close" style="margin-left:auto;background:transparent;border:0;color:#aaa;font-size:20px;line-height:1;cursor:pointer">×</button></div>
        <div style="{LAB};margin-bottom:6px">WORLD</div>
        <select value="{{{{world}}}}" onChange="{{{{onWorld}}}}" style="width:100%;height:40px;background:#1a1a1a;color:#fff;border:1px solid #444;border-radius:8px;padding:0 10px;font-family:inherit;font-size:13px">
          <sc-for list="{{{{worldOptions}}}}" as="w" hint-placeholder-count="12"><option value="{{{{w.name}}}}">{{{{w.name}}}}</option></sc-for>
        </select>
        <p style="{MONO};font-size:12px;line-height:1.5;color:#a8a8a8;margin:10px 0 6px">{{{{aboutText}}}}</p>
        <p style="{MONO};font-size:11px;line-height:1.5;color:#e0b050;margin:0 0 18px">{{{{unpinnedText}}}}</p>
        <div style="{LAB};display:flex;gap:8px;margin-bottom:6px">WIDTH <span style="color:#fff;font-size:13px;letter-spacing:0">{{{{wLabel}}}}</span></div>
        <input type="range" min="280" max="1920" step="1" value="{{{{wVal}}}}" onInput="{{{{onW}}}}" onChange="{{{{onW}}}}" style="width:100%;accent-color:#b6ff3b;margin:0 0 16px">
        <div style="{LAB};display:flex;gap:8px;align-items:center;margin-bottom:6px">HEIGHT <span style="color:#fff;font-size:13px;letter-spacing:0">{{{{hLabel}}}}</span><button type="button" onClick="{{{{autoH}}}}" style="{{{{autoHStyle}}}}">auto</button></div>
        <input type="range" min="400" max="1600" step="1" value="{{{{hVal}}}}" onInput="{{{{onH}}}}" onChange="{{{{onH}}}}" style="width:100%;accent-color:#b6ff3b;margin:0 0 16px">
        <div style="{LAB};margin-bottom:8px">PRESETS</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px"><sc-for list="{{{{vps}}}}" as="v" hint-placeholder-count="9"><button type="button" onClick="{{{{v.pick}}}}" style="{{{{v.style}}}}">{{{{v.label}}}}</button></sc-for></div>
        <p style="{MONO};font-size:11px;color:#8c8c8c;margin:16px 0 0">Real markup and CSS captured from the running app at 1280px. Links and buttons are inert. Walk each world at 390, 768 and 1280.</p>
      </div>
    </div>
  </sc-if>'''
    data=json.dumps({"worlds":worlds,"order":order,"n":n})
    flags="\n".join(f"      v{i}: st.v === {i}," for i in range(n))
    script=f'''const DATA = {data};
const VPS=[{{label:"SE",w:375,h:667}},{{label:"iPhone",w:390,h:844}},{{label:"Max",w:430,h:932}},{{label:"Tab mini",w:768,h:1024}},{{label:"iPad 11\\"",w:834,h:1194}},{{label:"Laptop",w:1280,h:800}},{{label:"Desktop",w:1440,h:900}},{{label:"FHD",w:1920,h:1080}},{{label:"Full",w:null,h:null}}];
const ON="height:36px;padding:0 14px;border-radius:8px;border:1px solid #b6ff3b;background:#b6ff3b;color:#000;font-family:inherit;font-size:13px;cursor:pointer";
const OFF="height:36px;padding:0 14px;border-radius:8px;border:1px solid #444;background:transparent;color:#e8e8e8;font-family:inherit;font-size:13px;cursor:pointer";
class Component extends DCLogic {{
  constructor(props) {{ super(props); this.state = {{ world: DATA.order.find((n) => n.includes('few-files')) || DATA.order.find((n) => n === 'paid-power-user') || DATA.order[0], v: 0, vw: null, vh: null, rigOpen: false }}; this.state.v = DATA.worlds[this.state.world].v; }}
  renderVals() {{
    const st = this.state, W = DATA.worlds[st.world];
    const act = (v) => v.w === st.vw && v.h === st.vh;
    return {{
{flags}
      world: st.world,
      aboutText: W.title + (W.about ? ' — ' + W.about : ''),
      unpinnedText: W.unpinned.length ? 'Unpinned on this page (answers 599): ' + W.unpinned.join(', ') : '',
      worldOptions: DATA.order.map((n) => ({{ name: n }})),
      onWorld: (e) => {{ const n = e.target.value; this.setState({{ world: n, v: DATA.worlds[n].v }}); }},
      vps: VPS.map((v) => ({{ label: v.label, style: act(v) ? ON : OFF, pick: () => this.setState({{ vw: v.w, vh: v.h }}) }})),
      rigOpen: st.rigOpen, toggleRig: () => this.setState({{ rigOpen: !st.rigOpen }}), stop: (e) => e && e.stopPropagation && e.stopPropagation(),
      vpLabel: st.vw ? st.vw + (st.vh ? '×' + st.vh : '') : 'full',
      vw: st.vw ? st.vw + 'px' : '100%', vh: st.vh ? st.vh + 'px' : '100%',
      wLabel: st.vw ? st.vw + 'px' : 'full', hLabel: st.vh ? st.vh + 'px' : 'auto',
      wVal: st.vw || 1280, hVal: st.vh || 900,
      onW: (e) => this.setState({{ vw: Number(e.target.value) }}),
      onH: (e) => this.setState({{ vh: Number(e.target.value) }}),
      autoH: () => this.setState({{ vh: null }}),
      autoHStyle: (st.vh == null ? ON : OFF) + ';height:22px;padding:0 8px;font-size:11px',
    }};
  }}
}}'''
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title} — Pixeldraw pilot</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
body{{margin:0}}
{css()}
</style>
</helmet>
<div style="position:relative;width:100%;height:100dvh;overflow:hidden;background:#e9e9e9">
  <div style="width:{{{{vw}}}};height:{{{{vh}}}};margin:0 auto;container-type:size;container-name:page;position:relative;overflow:hidden;background:#fff">
    <div class="pstage {HTML_CLS} {BODY_CLS}" style="width:100%;height:100%;overflow:auto">
{blocks}
    </div>
  </div>{modal}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1440,"height":900}}}}'>
{script}
</script>
</body>
</html>
'''
os.makedirs('/home/claude/design-out/project',exist_ok=True)
done=[]
for slug,title in PAGES:
    p=f'out/{slug}.json'
    if not os.path.exists(p): continue
    d=json.load(open(p))
    if not d['variants']: continue
    name=f'{title.replace(" ","")}.dc.html'
    s=board(slug,title,d)
    open('/home/claude/design-out/project/'+name,'w').write(s)
    print(name,round(len(s)/1024),'KB',len(d['variants']),'variants',len(d['per']),'worlds')
    done.append((name,title))
boards={}; 
for i,(name,title) in enumerate(done):
    boards[name]={"x":(i%4)*1540,"y":(i//4)*1000,"w":1440,"h":900,"expand":"fill","is_interactive":True,"title":title}
import datetime
cj={"v":3,"createdOnFiles":{"v":1,"at":datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},"title":"Pixeldraw Pilot","pages":[],"boards":boards,"order":[n for n,_ in done],"notes":{},"designSystems":[]}
json.dump(cj,open('/home/claude/design-out/project/canvas.json','w'))
