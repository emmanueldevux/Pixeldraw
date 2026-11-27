# flow-worker — Nano Banana images through Google Flow

A small service that takes a prompt (and optional reference images) from Pixeldraw, makes the image in
Google Flow with one of your Google accounts, and returns an image URL. It sits next to the OpenAI provider:
Pixeldraw picks one with a setting.

```
Pixeldraw  --POST /generate-->  flow-worker  --queue-->  account pool  -->  Chromium on Flow  -->  R2  --> image URL
```

## What it does
- **Account rotation:** each Google account is a saved login in `accounts/<id>.json`. The next job goes to the account used
  longest ago. One job per account at a time, so 3 accounts = 3 images at once.
- **Failover:** if an attempt fails, the job moves to a different account (up to 3 attempts). A failing account cools
  down for 5 minutes. Signed out, out of credits or a verification page pauses it until you resume it. Three failures
  in a row also pause it.
- **Stealth modules (added by the owner, not by Claude):** `app/stealth_profile.py` and `app/stealth_behavior.py` (copied from
  CrawlGecko) give each account a spoofed browser fingerprint and humanlike behavior, and `driver.py` calls them. They exist to
  avoid bot detection, which Google's terms very likely prohibit for automated Flow use; accounts may be flagged or banned.
  Claude did not write, test or support these parts. The original worker design was plain automation (PRJ-0056).

## Run it
```bash
cd flow-worker
pip install -r requirements.txt && playwright install chromium
export WORKER_TOKEN=$(openssl rand -hex 24)      # Pixeldraw sends this
FLOW_DRIVER=mock uvicorn app.main:app --port 8080  # mock = placeholder images, no Google; for wiring the app up
python -m pytest tests -q                         # 18 tests
```

| Variable | Meaning |
|---|---|
| `WORKER_TOKEN` | required. Shared secret; Pixeldraw sends it as `Authorization: Bearer ...` |
| `FLOW_DRIVER` | `playwright` (default, real Flow) or `mock` |
| `ACCOUNTS_DIR` | where logins and pool state live (default `./accounts`; on Railway use a volume) |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` | images go to R2. Without them images are kept locally and served at `/files` |
| `FLOW_HEADLESS` | `0` shows the browser window (for calibration) |
| `ACCOUNT_COOLDOWN_SECONDS`, `ACCOUNT_MAX_FAILURES`, `JOB_MAX_ATTEMPTS`, `GENERATE_WAIT_SECONDS` | tuning, see `app/` |

## Account login (you do this, once per account)
```bash
python -m app.login account1     # a window opens; you sign in to Google and open Flow; press Enter
```
Your password is typed into Google's page by you; the script saves only the browser session. Treat
`accounts/*.json` like passwords (git ignores them). If Google refuses to sign in inside the automated
window, sign in with that account in your normal Chrome and export that browser's session instead.

## Calibration (needed before the real driver works) — full steps in CALIBRATION.md
`python -m app.inspect_page account1` records each Flow screen to `captures/`; send those files to Claude to fill the selectors.
`flow_selectors.json` has a `TODO` for every Flow-specific element (start page, prompt box, generate button, result
image, aspect buttons, file input, signed-out / out-of-credits markers). Until they are filled in, the driver stops with
"needs calibration" and pauses nothing, instead of guessing. Fill them from the real Flow page with `FLOW_HEADLESS=0`.

## API (all but /health need the token)
- `POST /generate` `{prompt, size?|aspect?, attachments?[], reference?}`: `attachments` = the user's product photo / attached images (up to `FLOW_MAX_ATTACHMENTS`, default 3), `reference` = ONE style reference. They are different things and are kept apart (`Job.attachment_files`, `Job.reference_file`). Older callers' `referenceImages` still work: the first becomes the reference -> `200 {url}` | `502 {error}` | `504 {jobId}` (still running)
- `POST /jobs`, `GET /jobs/{id}` — the same without waiting
- `GET /accounts` — state only, never cookies; `POST /accounts/{id}/resume`; `POST /accounts/reload` after adding a file
- `GET /health`

## Deploy (Railway)
Root directory `flow-worker`, builds from the `Dockerfile`. Attach a volume at `/data` (logins and pool state survive
redeploys), set the variables above. Then in Pixeldraw set `FLOW_WORKER_URL` and `FLOW_WORKER_TOKEN`.
Upload the `accounts/*.json` files to the volume by running `python -m app.login` on your own machine and copying
them over; do not paste them into chat or commit them.

## Limits to know
- Only the mock path and the pool, queue and API are tested. The Flow steps are untested until calibrated.
- A Flow UI change breaks the driver; the fix is one file (`flow_selectors.json`).
- Jobs are kept in memory: a restart drops jobs in flight (Pixeldraw sees an error and can retry).
- Flow credits and per-day limits are Google's; this worker does not read the balance, it reacts when Flow refuses.
