"""Drivers: the part that actually produces an image for one prompt on one account.

MockDriver            deterministic placeholder PNG. Used by tests and by `FLOW_DRIVER=mock` for wiring the app up.
PlaywrightFlowDriver  drives Google Flow in a normal Chromium with the account's saved login.
                      Plain automation: no fingerprint spoofing, no stealth patches, no fake mouse movement.
                      Every Flow-specific selector lives in flow_selectors.json so a UI change is a one-file fix.

Error types tell the pool what to do with the account:
  NeedsHuman   signed out, out of credits, blocked, a verification page -> account is paused until a person resumes it
  Retryable    anything else (timeout, page changed, generation failed) -> cooldown, job moves to another account
"""
from __future__ import annotations

import io
import json
import os
import re
from dataclasses import dataclass, field
from typing import Optional

SELECTORS_PATH = os.getenv("FLOW_SELECTORS", os.path.join(os.path.dirname(__file__), "..", "flow_selectors.json"))
GENERATION_TIMEOUT_MS = int(os.getenv("FLOW_GENERATION_TIMEOUT_MS", "180000"))
HEADLESS = os.getenv("FLOW_HEADLESS", "1") != "0"


class NeedsHuman(Exception):
    """The account cannot continue without a person (login, credits, verification)."""


class Retryable(Exception):
    """This attempt failed; another attempt (or account) may work."""


class NeedsCalibration(NeedsHuman):
    """flow_selectors.json has not been filled in yet for this step."""


@dataclass
class Job:
    id: str
    prompt: str
    aspect: str = "1:1"                          # "1:1" | "16:9" | "9:16" | "4:5" ...
    reference_files: list[str] = field(default_factory=list)   # local paths, already downloaded


class Driver:
    async def generate(self, job: Job, storage_state_path: str) -> bytes:  # returns image bytes
        raise NotImplementedError


class MockDriver(Driver):
    async def generate(self, job: Job, storage_state_path: str) -> bytes:
        from PIL import Image, ImageDraw
        w, h = {"1:1": (512, 512), "16:9": (640, 360), "9:16": (360, 640), "4:5": (512, 640)}.get(job.aspect, (512, 512))
        im = Image.new("RGB", (w, h), (30, 30, 40))
        d = ImageDraw.Draw(im)
        d.text((16, 16), f"MOCK {job.aspect}\n{job.prompt[:80]}\nrefs: {len(job.reference_files)}", fill=(240, 240, 240))
        buf = io.BytesIO()
        im.save(buf, "PNG")
        return buf.getvalue()


def load_selectors(path: str = SELECTORS_PATH) -> dict:
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError) as e:
        raise NeedsCalibration(f"selector file not readable: {e}")


def _sel(cfg: dict, key: str) -> str:
    v = cfg.get(key)
    if not v or str(v).startswith("TODO"):
        raise NeedsCalibration(f"flow_selectors.json: '{key}' is not set yet")
    return v


class PlaywrightFlowDriver(Driver):
    """Steps (each one named in flow_selectors.json):
       open project page -> check signed in -> (optional) attach references -> choose aspect ->
       type prompt -> press generate -> wait for the result image -> read its bytes.
    """

    def __init__(self, selectors: Optional[dict] = None):
        self.cfg = selectors

    async def generate(self, job: Job, storage_state_path: str) -> bytes:
        from playwright.async_api import TimeoutError as PWTimeout
        from playwright.async_api import async_playwright

        cfg = self.cfg or load_selectors()
        url = _sel(cfg, "start_url")
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=HEADLESS)
            ctx = await browser.new_context(storage_state=storage_state_path, viewport={"width": 1440, "height": 900})
            page = await ctx.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)

                # signed out / verification / out of credits -> a person has to fix the account
                for key, why in (("signed_out_marker", "signed out"), ("verification_marker", "verification page"),
                                 ("out_of_credits_marker", "out of credits")):
                    m = cfg.get(key)
                    if m and not str(m).startswith("TODO") and await page.locator(m).count():
                        raise NeedsHuman(why)

                if job.reference_files:
                    attach = _sel(cfg, "reference_file_input")
                    await page.set_input_files(attach, job.reference_files)

                ratio_sel = (cfg.get("aspect_buttons") or {}).get(job.aspect)
                if ratio_sel and not str(ratio_sel).startswith("TODO"):
                    await page.click(ratio_sel)

                await page.fill(_sel(cfg, "prompt_input"), job.prompt)
                before = await page.locator(_sel(cfg, "result_image")).count()
                await page.click(_sel(cfg, "generate_button"))

                # wait for a NEW result image to appear
                result = page.locator(_sel(cfg, "result_image"))
                await page.wait_for_function(
                    "([sel, n]) => document.querySelectorAll(sel).length > n",
                    arg=[cfg["result_image"], before], timeout=GENERATION_TIMEOUT_MS)
                src = await result.nth(before).get_attribute("src")
                if not src:
                    raise Retryable("result image has no src")
                if src.startswith("data:"):
                    import base64
                    return base64.b64decode(src.split(",", 1)[1])
                resp = await ctx.request.get(src)
                if not resp.ok:
                    raise Retryable(f"could not download result ({resp.status})")
                return await resp.body()
            except PWTimeout as e:
                raise Retryable(f"timed out: {str(e)[:120]}")
            finally:
                await browser.close()


def aspect_for_size(size: str) -> str:
    """'1080x1920' -> '9:16'. Falls back to the closest of the common ratios."""
    m = re.match(r"^(\d+)x(\d+)$", size or "")
    if not m:
        return "1:1"
    w, h = int(m.group(1)), int(m.group(2))
    r = w / h
    options = {"1:1": 1.0, "4:5": 0.8, "9:16": 9 / 16, "16:9": 16 / 9, "3:2": 1.5, "2:3": 2 / 3}
    return min(options, key=lambda k: abs(options[k] - r))


def make_driver() -> Driver:
    kind = os.getenv("FLOW_DRIVER", "playwright")
    return MockDriver() if kind == "mock" else PlaywrightFlowDriver()
