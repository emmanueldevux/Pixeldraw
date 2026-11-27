# Calibrating the Flow driver (the right way, repeatable)

Goal: fill in `flow_selectors.json` from the real Flow page, once, and know how to redo it when Flow changes.
You click; the tool records. No passwords or typed text are ever captured.

## 1. Set up on your PC (once)
```bash
cd flow-worker
pip install -r requirements.txt
playwright install chromium
```

## 2. Record the screens
```bash
python -m app.inspect_page account1          # opens https://flow.google.com in a normal window
```
1. Sign in to the Google account in the window (you type the password, not the tool).
2. Open Flow's **image** creation screen.
3. In the terminal type a label and press Enter for each state below, getting the screen into that state first:
   | label | what the screen should show |
   |---|---|
   | `empty-prompt` | image screen, nothing typed, aspect options visible |
   | `aspect-open` | any aspect-ratio / settings menu open (if there is one) |
   | `reference-ui` | the place where you add a reference image (open the upload control if it is hidden) |
   | `prompt-typed` | a short prompt typed in; the generate button should now be enabled |
   | `generating` | right after pressing generate, while it is working |
   | `result` | the finished image(s) on screen |
   | `out-of-credits` | only if you can reach it: the message Flow shows when credits run out |
   | `signed-out` | optional: open Flow in a private window and capture the signed-out page (the tool will not have a login here, run it with a new account name) |
4. Press Enter on an empty label to finish. The login is saved to `accounts/account1.json` the first time.

Files appear in `captures/` (`account1-3-prompt-typed.json` + `.png` ...). Check them for anything personal (your
account *name* can appear in a button label; e-mails are masked), then send them to Claude.

## 3. Fill in the selectors
Claude reads the captures and fills `flow_selectors.json`, then tests it:
```bash
FLOW_HEADLESS=0 python -m app.try_flow account1 "a red sneaker on white background"   # (added after calibration)
```
Test with ONE image on ONE account first. Watch the window. Only then add more accounts.

## 4. When Flow changes
If jobs start failing with "page changed" / timeouts: run step 2 again for the broken state, send the captures, and
only `flow_selectors.json` needs to change. Nothing else in the worker depends on Flow's page.

## Notes
- A login file (`accounts/<id>.json`) is a session, treat it like a password. It is ignored by git.
- Google may refuse to sign in inside an automated window. That is their choice and the tool does not work around
  it. If it happens, sign in with that account in your normal Chrome and tell Claude; we will use another way.
