"""Save a Google login for the pool. YOU sign in; this script never sees or stores your password,
only the browser's resulting session (cookies) in accounts/<id>.json.

    python -m app.login account1                      # opens a browser window, you sign in, press Enter
    python -m app.login account2 --url https://...    # start from a different page

Treat accounts/*.json like passwords: they are ignored by git and must not be shared.
If Google refuses to sign in inside the automated browser window, that is Google's choice: sign in with the
account in your normal Chrome and export that browser's session instead (see README, "Account login").
"""
import argparse
import os
import re

from playwright.sync_api import sync_playwright


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("account_id")
    ap.add_argument("--url", default=os.getenv("FLOW_LOGIN_URL", "https://accounts.google.com/"))
    ap.add_argument("--dir", default=os.getenv("ACCOUNTS_DIR", "./accounts"))
    a = ap.parse_args()
    
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", a.account_id):
        raise SystemExit("account id: letters, digits, - and _ only")
        
    os.makedirs(a.dir, exist_ok=True)
    out = os.path.join(a.dir, f"{a.account_id}.json")

    # Pull proxy settings from environment variables
    proxy_server = os.getenv("PROXY_SERVER")
    proxy_user = os.getenv("PROXY_USER")
    proxy_pass = os.getenv("PROXY_PASS")

    launch_kwargs = {
        "headless": False,
        "channel": "chrome",  # Uses your real installed Chrome
        "args": ["--disable-blink-features=AutomationControlled"]
    }

    if proxy_server:
        print(f"🌐 Using Proxy: {proxy_server}")
        launch_kwargs["proxy"] = {
            "server": proxy_server,
            "username": proxy_user,
            "password": proxy_pass
        }

    with sync_playwright() as pw:
        # Launch real Chrome with proxy
        browser = pw.chromium.launch(**launch_kwargs)
        
        # Match the viewport we use in the bot to prevent fingerprint changes
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        
        print(f"Opening {a.url}...")
        page.goto(a.url, wait_until="domcontentloaded", timeout=60000)
        
        input(f"\nSign in to the Google account for '{a.account_id}' in the window.\n"
              f"Open Flow once to accept any prompts (and verify you can generate an image).\n"
              f"Then press Enter here to save... ")
              
        ctx.storage_state(path=out)
        browser.close()
        
    os.chmod(out, 0o600)
    print("✅ Login saved to", out)


if __name__ == "__main__":
    main()