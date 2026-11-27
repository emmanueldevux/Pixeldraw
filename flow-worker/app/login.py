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
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(a.url)
        input(f"Sign in to the Google account for '{a.account_id}' in the window, open Flow once to accept any "
              f"prompts, then press Enter here to save... ")
        ctx.storage_state(path=out)
        browser.close()
    os.chmod(out, 0o600)
    print("saved", out)


if __name__ == "__main__":
    main()
