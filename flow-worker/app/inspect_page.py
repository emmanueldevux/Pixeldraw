"""Capture what a page looks like, so the Flow selectors can be written from real data.

    python -m app.inspect_page account1                 # opens Flow in a normal window
    python -m app.inspect_page account1 --url https://flow.google.com

You do the clicking. Whenever the screen shows a state worth recording, come back to this terminal, type a short
label (for example "empty prompt screen", "prompt typed", "generating", "result shown", "out of credits") and press
Enter. Press Enter on an empty label to finish. Each capture saves, in captures/:
  <account>-<n>-<label>.json   every visible button / link / input / image with a suggested selector
  <account>-<n>-<label>.png    a screenshot
Send me those files (they are ignored by git). Nothing you type into the page is recorded: input values are never
read, password fields are skipped, e-mail addresses are masked, and image links keep only host + path.

If accounts/<account>.json exists it is used (already signed in); otherwise sign in in the window, and the login is
saved to that file when you finish, so the pool can use it.
"""
import argparse
import json
import os
import re

from playwright.sync_api import sync_playwright

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")

JS = r"""
() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.right > 0; };
  const q = 'button,a[href],input,textarea,select,img,video,canvas,[role=button],[role=tab],[role=radio],[role=option],' +
            '[role=menuitem],[role=switch],[role=checkbox],[contenteditable=true],[contenteditable=""]';
  const out = [];
  for (const e of document.querySelectorAll(q)) {
    if (!vis(e)) continue;
    const tag = e.tagName.toLowerCase();
    if (tag === 'input' && e.type === 'password') continue;
    const r = e.getBoundingClientRect();
    const text = (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const o = { tag, role: e.getAttribute('role') || '', text,
      aria: e.getAttribute('aria-label') || '', title: e.getAttribute('title') || '',
      placeholder: e.getAttribute('placeholder') || '', type: e.getAttribute('type') || '',
      id: e.id || '', name: e.getAttribute('name') || '', testid: e.getAttribute('data-testid') || '',
      disabled: !!e.disabled || e.getAttribute('aria-disabled') === 'true',
      box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
    if (tag === 'img') {
      let s = e.currentSrc || e.src || '';
      try { const u = new URL(s, location.href); s = s.startsWith('data:') ? 'data:(' + s.length + ' chars)' : u.host + u.pathname; } catch (_) {}
      o.src = s; o.alt = e.alt || ''; o.natural = [e.naturalWidth, e.naturalHeight];
    }
    if (tag === 'input' && e.type === 'file') o.accept = e.accept || '';
    // suggested selector, most stable first
    let sel = '';
    if (o.testid) sel = `[data-testid="${o.testid}"]`;
    else if (o.id && !/\d{3,}/.test(o.id)) sel = '#' + CSS.escape(o.id);
    else if (o.aria) sel = `${tag}[aria-label="${o.aria.replace(/"/g, '\\"')}"]`;
    else if (o.placeholder) sel = `${tag}[placeholder="${o.placeholder.replace(/"/g, '\\"')}"]`;
    else if (text && (tag === 'button' || o.role)) sel = `${tag === 'button' ? 'button' : '[role=' + o.role + ']'}:has-text("${text.slice(0, 40).replace(/"/g, '\\"')}")`;
    else if (tag === 'input' && e.type === 'file') sel = 'input[type=file]';
    o.suggested = sel;
    out.push(o);
  }
  return { url: location.origin + location.pathname, title: document.title, elements: out.slice(0, 400) };
}
"""


def mask(o):
    """Mask e-mail addresses anywhere in the captured text."""
    if isinstance(o, str):
        return EMAIL.sub("<email>", o)
    if isinstance(o, list):
        return [mask(x) for x in o]
    if isinstance(o, dict):
        return {k: mask(v) for k, v in o.items()}
    return o


def capture(page, account: str, n: int, label: str, out_dir: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]+", "-", label).strip("-")[:40] or "state"
    base = os.path.join(out_dir, f"{account}-{n}-{safe}")
    data = mask(page.evaluate(JS))
    data["label"] = label
    with open(base + ".json", "w") as f:
        json.dump(data, f, indent=1)
    page.screenshot(path=base + ".png")
    print(f"  saved {base}.json ({len(data['elements'])} elements) and .png")
    return base


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("account_id")
    ap.add_argument("--url", default="https://flow.google.com")
    ap.add_argument("--dir", default=os.getenv("ACCOUNTS_DIR", "./accounts"))
    ap.add_argument("--out", default="./captures")
    ap.add_argument("--once", metavar="LABEL", help="capture once without asking (used by tests)")
    ap.add_argument("--headless", action="store_true")
    a = ap.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", a.account_id):
        raise SystemExit("account id: letters, digits, - and _ only")
    os.makedirs(a.out, exist_ok=True)
    state = os.path.join(a.dir, f"{a.account_id}.json")
    have_login = os.path.isfile(state)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=a.headless)
        ctx = browser.new_context(storage_state=state if have_login else None, viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.goto(a.url)
        n = 0
        if a.once:
            page.wait_for_timeout(500)
            capture(page, a.account_id, 1, a.once, a.out)
        else:
            print("Sign in if needed, then get the screen into the state you want to record.")
            while True:
                label = input("label for this screen (empty = finish): ").strip()
                if not label:
                    break
                n += 1
                capture(page, a.account_id, n, label, a.out)
            if not have_login:
                os.makedirs(a.dir, exist_ok=True)
                ctx.storage_state(path=state)
                os.chmod(state, 0o600)
                print("login saved to", state)
        browser.close()


if __name__ == "__main__":
    main()
