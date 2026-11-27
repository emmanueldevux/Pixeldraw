"""Drivers: the part that actually produces an image for one prompt on one account.

MockDriver            deterministic placeholder PNG. Used by tests and by `FLOW_DRIVER=mock` for wiring the app up.
PlaywrightFlowDriver  drives Google Flow in a normal Chromium with the account's saved login.

Stealth integration (opt-out via FLOW_STEALTH=0):
  stealth_profile.py   coherent per-account browser fingerprint (device archetype,
                       UA, WebGL, canvas seed, timezone, fonts) — applied to the
                       browser context before any page script runs.
  stealth_behavior.py  per-run behavioral archetype (scanner/reader/shopper/...)
                       executed after page load and before the prompt is typed:
                       human mouse entrance, device-matched scroll, reading pauses,
                       optional link hover.

Every Flow-specific selector lives in flow_selectors.json so a UI change is a one-file fix.

Error types tell the pool what to do with the account:
  NeedsHuman   signed out, out of credits, blocked, a verification page -> account is paused until a person resumes it
  Retryable    anything else (timeout, page changed, generation failed) -> cooldown, job moves to another account
"""
from __future__ import annotations

import asyncio
import io
import json
import math
import os
import random
import re
from dataclasses import dataclass, field
from typing import Optional

# ── Stealth modules (optional; driver still works without them) ──
try:
    from .stealth_behavior import (
        pick_archetype,
        weibull_sample,
        gev_scatter,
        fitts_time,
        bezier_path_with_scatter,
        drift_path,
        wheel_scroll_sequence,
        trackpad_scroll_sequence,
        keyboard_scroll_sequence,
    )
    from .stealth_profile import (
        load_or_create_profile,
        build_stealth_script,
        apply_profile_to_context_kwargs,
    )
    _STEALTH_AVAILABLE = True
except ImportError:
    try:
        from stealth_behavior import (  # type: ignore
            pick_archetype,
            weibull_sample,
            gev_scatter,
            fitts_time,
            bezier_path_with_scatter,
            drift_path,
            wheel_scroll_sequence,
            trackpad_scroll_sequence,
            keyboard_scroll_sequence,
        )
        from stealth_profile import (  # type: ignore
            load_or_create_profile,
            build_stealth_script,
            apply_profile_to_context_kwargs,
        )
        _STEALTH_AVAILABLE = True
    except ImportError:
        _STEALTH_AVAILABLE = False


SELECTORS_PATH = os.getenv("FLOW_SELECTORS", os.path.join(os.path.dirname(__file__), "..", "flow_selectors.json"))
GENERATION_TIMEOUT_MS = int(os.getenv("FLOW_GENERATION_TIMEOUT_MS", "180000"))
HEADLESS = os.getenv("FLOW_HEADLESS", "1") != "0"

# Stealth knobs
STEALTH_ENABLED = os.getenv("FLOW_STEALTH", "1") != "0" and _STEALTH_AVAILABLE
STEALTH_DEBUG   = os.getenv("FLOW_STEALTH_DEBUG", "0") == "1"
PROFILE_DIR     = os.getenv("FLOW_PROFILE_DIR", os.path.join("data", "profiles"))


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
    reference_files: list[str] = field(default_factory=list)   # ALL images to upload (attachments first, then the reference)
    attachment_files: list[str] = field(default_factory=list)  # the user's product photo / attachments
    reference_file: Optional[str] = None                       # the single style reference


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


# ═══════════════════════════════════════════════════════════════════════
# Stealth helpers
# ═══════════════════════════════════════════════════════════════════════

_PROFILE_CACHE: dict[str, object] = {}


def _account_key(storage_state_path: str) -> str:
    """Stable, filesystem-safe key for an account derived from its storage_state path."""
    base = os.path.splitext(os.path.basename(storage_state_path))[0]
    return re.sub(r"[^A-Za-z0-9_.-]", "_", base) or "default"


def _get_or_create_profile(storage_state_path: str):
    """Load (or create + persist) the fingerprint profile for this account.

    Same account -> same profile every run. The profile seeds a coherent
    device archetype (UA / screen / WebGL / fonts / timezone) which is
    injected at the browser-context level so browser-level properties match
    the JS-level overrides.
    """
    if not STEALTH_ENABLED:
        return None
    key = _account_key(storage_state_path)
    cached = _PROFILE_CACHE.get(key)
    if cached is not None:
        return cached
    profile_path = os.path.join(PROFILE_DIR, f"{key}.json")
    profile = load_or_create_profile(profile_path=profile_path, seed=storage_state_path)
    _PROFILE_CACHE[key] = profile
    if STEALTH_DEBUG:
        print(f"[stealth] profile for '{key}': {profile.archetype_id}")
    return profile


async def _execute_archetype_async(page, archetype, *,
                                    viewport_w: int, viewport_h: int,
                                    rng: random.Random,
                                    debug: bool = False) -> dict:
    """Async port of stealth_behavior.execute_archetype.

    Same physical model (Fitts + GEV scatter, device-matched scroll physics,
    Weibull read pauses, cursor-while-reading styles) but awaits instead of
    time.sleep so the Playwright event loop is not blocked.
    """
    log: dict = {"archetype": archetype.name, "steps": []}

    # Document height — needed to scale archetype's scroll_depth_frac
    try:
        doc_height = int(await page.evaluate(
            "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)"))
    except Exception:
        doc_height = viewport_h * 3
    doc_height = max(doc_height, viewport_h * 2)

    # ── Step 1: initial pause (Weibull, not uniform) ──
    lo, hi = archetype.initial_pause_range
    pause = max(lo, min(hi, weibull_sample(k=0.75, lam=(lo + hi) / 2, rng=rng)))
    if debug:
        print(f"[stealth]   archetype '{archetype.name}': initial pause {pause:.1f}s")
    await asyncio.sleep(pause)
    log["steps"].append(("initial_pause", pause))

    # ── Step 2: mouse entrance (Fitts + GEV scatter, archetype speed) ──
    edge = rng.choice(["top", "left", "right"])
    if edge == "top":
        start = (rng.randint(100, viewport_w - 100), 0)
    elif edge == "left":
        start = (0, rng.randint(50, viewport_h - 50))
    else:
        start = (viewport_w, rng.randint(50, viewport_h - 50))

    target = (rng.randint(int(viewport_w * 0.2), int(viewport_w * 0.7)),
              rng.randint(int(viewport_h * 0.15), int(viewport_h * 0.45)))

    dist = math.sqrt((target[0] - start[0]) ** 2 + (target[1] - start[1]) ** 2)
    mt_ms = gev_scatter(fitts_time(dist), rng)
    speed_mult = {"fast": 0.6, "medium": 1.0, "slow": 1.5, "minimal": 2.0}
    mt_ms *= speed_mult.get(archetype.mouse_speed, 1.0)
    steps = max(8, int(mt_ms / 15))
    path = bezier_path_with_scatter(start, target, rng, steps=steps)

    try:
        per_step_s = (mt_ms / 1000.0) / len(path)
        for px, py in path:
            await page.mouse.move(max(0, min(px, viewport_w)), max(0, min(py, viewport_h)))
            await asyncio.sleep(max(0.003, per_step_s + rng.gauss(0, per_step_s * 0.2)))
    except Exception:
        pass

    if debug:
        print(f"[stealth]   mouse {edge}→{target} {len(path)} steps ({mt_ms:.0f}ms)")
    log["steps"].append(("mouse_enter", edge, target, len(path)))

    # ── Step 3: device-matched scroll ──
    scroll_target = int(doc_height * archetype.scroll_depth_frac) + rng.randint(-200, 200)
    scroll_target = max(100, min(scroll_target, doc_height - 200))

    if archetype.input_device == "trackpad":
        seq = trackpad_scroll_sequence(scroll_target, rng)
    elif archetype.input_device == "keyboard":
        seq = keyboard_scroll_sequence(scroll_target, rng)
    else:
        seq = wheel_scroll_sequence(scroll_target, rng)

    final_scroll = 0
    try:
        for pos, delay in seq:
            await page.evaluate(f"window.scrollTo(0, {pos})")
            final_scroll = pos
            await asyncio.sleep(delay)
    except Exception:
        pass

    # optional reversal (comparison-shopper signature)
    did_reverse = False
    if final_scroll > 80 and rng.random() < archetype.scroll_reversal_prob:
        did_reverse = True
        reverse_amt = rng.randint(80, min(400, final_scroll))
        try:
            await page.evaluate(f"window.scrollTo(0, {max(0, final_scroll - reverse_amt)})")
            await asyncio.sleep(rng.uniform(0.3, 1.0))
            if rng.random() < 0.6:
                await page.evaluate(f"window.scrollTo(0, {final_scroll})")
                await asyncio.sleep(rng.uniform(0.1, 0.3))
        except Exception:
            pass

    if debug:
        pct = 100 * final_scroll // max(1, doc_height)
        print(f"[stealth]   {archetype.input_device} scroll {final_scroll}/{doc_height} ({pct}%)"
              f"{' + reversal' if did_reverse else ''} [{len(seq)} events]")
    log["steps"].append(("scroll", archetype.input_device, final_scroll, len(seq), did_reverse))

    # ── Step 4: read pause with cursor-while-reading style ──
    read_time = weibull_sample(k=archetype.read_pause_k,
                               lam=archetype.read_pause_lam, rng=rng)
    read_time = max(0.5, min(read_time, 8.0))

    intensity = {
        "neglect": "none",
        "horizontal": "active",
        "vertical": "light",
        "marker": "marker",
    }.get(archetype.cursor_read_style, "light")
    drift = drift_path(target, read_time, rng, intensity=intensity)

    try:
        for dx, dy, dt in drift:
            await page.mouse.move(max(0, min(dx, viewport_w)), max(0, min(dy, viewport_h)))
            await asyncio.sleep(max(0.05, dt))
    except Exception:
        await asyncio.sleep(read_time)

    if debug:
        print(f"[stealth]   read {read_time:.1f}s (cursor={archetype.cursor_read_style}, "
              f"{len(drift)} drift pts)")
    log["steps"].append(("read_pause", read_time, archetype.cursor_read_style))

    # ── Step 5: optional hover on a link ──
    did_hover = False
    if rng.random() < archetype.hover_prob:
        did_hover = True
        try:
            await page.evaluate("""() => {
                const links = Array.from(document.querySelectorAll('a'))
                    .filter(a => {
                        const r = a.getBoundingClientRect();
                        return r.width > 0 && r.height > 0
                            && r.top > 100 && r.top < window.innerHeight;
                    });
                if (links.length > 0) {
                    const el = links[Math.floor(Math.random() * links.length)];
                    el.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
                    el.dispatchEvent(new MouseEvent('mouseover',  {bubbles: true}));
                }
            }""")
            await asyncio.sleep(rng.uniform(0.15, 0.5))
        except Exception:
            pass

    if debug:
        print(f"[stealth]   hover={did_hover} (p={archetype.hover_prob:.0%})")
    log["steps"].append(("hover", did_hover))

    # ── Step 6: return to top for the actual task ──
    try:
        await page.evaluate("window.scrollTo(0, 0)")
        await page.wait_for_timeout(200)
    except Exception:
        pass

    log["steps"].append(("scroll_top",))
    return log


# ═══════════════════════════════════════════════════════════════════════
# Playwright driver
# ═══════════════════════════════════════════════════════════════════════

class PlaywrightFlowDriver(Driver):
    """Steps (each one named in flow_selectors.json):
       open project page -> check signed in -> [stealth: archetype] ->
       (optional) attach references -> choose aspect -> type prompt ->
       press generate -> wait for the result image -> read its bytes.
    """

    def __init__(self, selectors: Optional[dict] = None):
        self.cfg = selectors

    async def generate(self, job: Job, storage_state_path: str) -> bytes:
        from playwright.async_api import TimeoutError as PWTimeout
        from playwright.async_api import async_playwright

        cfg = self.cfg or load_selectors()
        url = _sel(cfg, "start_url")

        # ── Per-account fingerprint profile ──
        profile = _get_or_create_profile(storage_state_path)

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=HEADLESS)

            # Context kwargs: profile (if available) drives viewport/UA/locale/tz
            ctx_kwargs: dict = {"storage_state": storage_state_path}
            if profile is not None:
                try:
                    ctx_kwargs = apply_profile_to_context_kwargs(profile, ctx_kwargs)
                except Exception:
                    ctx_kwargs = {"storage_state": storage_state_path,
                                  "viewport": {"width": 1440, "height": 900}}
            else:
                ctx_kwargs["viewport"] = {"width": 1440, "height": 900}

            ctx = await browser.new_context(**ctx_kwargs)

            # Inject fingerprint overrides before ANY page script runs
            if profile is not None:
                try:
                    await ctx.add_init_script(build_stealth_script(profile))
                except Exception as e:
                    if STEALTH_DEBUG:
                        print(f"[stealth] init script failed: {e}")

            page = await ctx.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)

                # signed out / verification / out of credits -> a person has to fix the account
                for key, why in (("signed_out_marker", "signed out"),
                                 ("verification_marker", "verification page"),
                                 ("out_of_credits_marker", "out of credits")):
                    m = cfg.get(key)
                    if m and not str(m).startswith("TODO") and await page.locator(m).count():
                        raise NeedsHuman(why)

                # ── Stealth: humanize BEFORE we do anything task-specific ──
                # Bad accounts already bailed above; healthy accounts now spend
                # 2–12s behaving like a real visitor who just landed on the page.
                if STEALTH_ENABLED and profile is not None:
                    try:
                        vp = ctx_kwargs.get("viewport") or {"width": 1440, "height": 900}
                        vp_w, vp_h = vp["width"], vp["height"]
                        archetype = pick_archetype(random.Random())
                        await _execute_archetype_async(
                            page, archetype,
                            viewport_w=vp_w, viewport_h=vp_h,
                            rng=random.Random(),
                            debug=STEALTH_DEBUG,
                        )
                    except Exception as e:
                        # Stealth is best-effort — never fail the job over it.
                        if STEALTH_DEBUG:
                            print(f"[stealth] archetype skipped: {e}")

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
                    arg=[cfg["result_image"], before],
                    timeout=GENERATION_TIMEOUT_MS,
                )
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
