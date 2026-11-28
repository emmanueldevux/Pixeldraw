"""Drivers: the part that actually produces an image for one prompt on one account."""

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

# ── Stealth modules ──
try:
    from .stealth_behavior import (
        pick_archetype, weibull_sample, gev_scatter, fitts_time,
        bezier_path_with_scatter, drift_path, wheel_scroll_sequence,
        trackpad_scroll_sequence, keyboard_scroll_sequence,
    )
    from .stealth_profile import (
        load_or_create_profile, build_stealth_script, apply_profile_to_context_kwargs,
    )
    _STEALTH_AVAILABLE = True
except ImportError:
    try:
        from stealth_behavior import (
            pick_archetype, weibull_sample, gev_scatter, fitts_time,
            bezier_path_with_scatter, drift_path, wheel_scroll_sequence,
            trackpad_scroll_sequence, keyboard_scroll_sequence,
        )
        from stealth_profile import (
            load_or_create_profile, build_stealth_script, apply_profile_to_context_kwargs,
        )
        _STEALTH_AVAILABLE = True
    except ImportError:
        _STEALTH_AVAILABLE = False


# Path directly to the app folder
SELECTORS_PATH = os.getenv("FLOW_SELECTORS", os.path.join(os.path.dirname(__file__), "flow_selectors.json"))
GENERATION_TIMEOUT_MS = int(os.getenv("FLOW_GENERATION_TIMEOUT_MS", "180000"))
HEADLESS = os.getenv("FLOW_HEADLESS", "1") != "0"

STEALTH_ENABLED = os.getenv("FLOW_STEALTH", "1") != "0" and _STEALTH_AVAILABLE
STEALTH_DEBUG   = os.getenv("FLOW_STEALTH_DEBUG", "0") == "1"
PROFILE_DIR     = os.getenv("FLOW_PROFILE_DIR", os.path.join("data", "profiles"))


class NeedsHuman(Exception): pass
class Retryable(Exception): pass
class NeedsCalibration(NeedsHuman): pass


@dataclass
class Job:
    id: str
    prompt: str
    aspect: str = "1:1"
    reference_files: list[str] = field(default_factory=list)


class Driver:
    async def generate(self, job: Job, storage_state_path: str) -> bytes: raise NotImplementedError


class MockDriver(Driver):
    async def generate(self, job: Job, storage_state_path: str) -> bytes:
        from PIL import Image, ImageDraw
        w, h = {"1:1": (512, 512), "16:9": (640, 360), "9:16": (360, 640), "4:5": (512, 640)}.get(job.aspect, (512, 512))
        im = Image.new("RGB", (w, h), (30, 30, 40))
        d = ImageDraw.Draw(im)
        d.text((16, 16), f"MOCK {job.aspect}\n{job.prompt[:80]}", fill=(240, 240, 240))
        buf = io.BytesIO()
        im.save(buf, "PNG")
        return buf.getvalue()


def load_selectors(path: str = SELECTORS_PATH) -> dict:
    try:
        with open(path) as f: return json.load(f)
    except (OSError, ValueError) as e: raise NeedsCalibration(f"selector file not readable: {e}")

def _sel(cfg: dict, key: str) -> str:
    v = cfg.get(key)
    if not v or str(v).startswith("TODO"): raise NeedsCalibration(f"flow_selectors.json: '{key}' is not set yet")
    return v


_PROFILE_CACHE: dict[str, object] = {}

def _account_key(storage_state_path: str) -> str:
    base = os.path.splitext(os.path.basename(storage_state_path))[0]
    return re.sub(r"[^A-Za-z0-9_.-]", "_", base) or "default"

def _get_or_create_profile(storage_state_path: str):
    if not STEALTH_ENABLED: return None
    key = _account_key(storage_state_path)
    cached = _PROFILE_CACHE.get(key)
    if cached is not None: return cached
    profile_path = os.path.join(PROFILE_DIR, f"{key}.json")
    profile = load_or_create_profile(profile_path=profile_path, seed=storage_state_path)
    _PROFILE_CACHE[key] = profile
    if STEALTH_DEBUG: print(f"[stealth] profile for '{key}': {profile.archetype_id}")
    return profile

async def _execute_archetype_async(page, archetype, *, viewport_w: int, viewport_h: int, rng: random.Random, debug: bool = False) -> dict:
    log: dict = {"archetype": archetype.name, "steps": []}
    try:
        doc_height = int(await page.evaluate("Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)"))
    except Exception: doc_height = viewport_h * 3
    doc_height = max(doc_height, viewport_h * 2)

    lo, hi = archetype.initial_pause_range
    pause = max(lo, min(hi, weibull_sample(k=0.75, lam=(lo + hi) / 2, rng=rng)))
    if debug: print(f"[stealth]   archetype '{archetype.name}': initial pause {pause:.1f}s")
    await asyncio.sleep(pause)
    log["steps"].append(("initial_pause", pause))

    edge = rng.choice(["top", "left", "right"])
    if edge == "top": start = (rng.randint(100, viewport_w - 100), 0)
    elif edge == "left": start = (0, rng.randint(50, viewport_h - 50))
    else: start = (viewport_w, rng.randint(50, viewport_h - 50))

    target = (rng.randint(int(viewport_w * 0.2), int(viewport_w * 0.7)), rng.randint(int(viewport_h * 0.15), int(viewport_h * 0.45)))
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
    except Exception: pass
    log["steps"].append(("mouse_enter", edge, target, len(path)))

    scroll_target = int(doc_height * archetype.scroll_depth_frac) + rng.randint(-200, 200)
    scroll_target = max(100, min(scroll_target, doc_height - 200))
    if archetype.input_device == "trackpad": seq = trackpad_scroll_sequence(scroll_target, rng)
    elif archetype.input_device == "keyboard": seq = keyboard_scroll_sequence(scroll_target, rng)
    else: seq = wheel_scroll_sequence(scroll_target, rng)

    final_scroll = 0
    try:
        for pos, delay in seq:
            await page.evaluate(f"window.scrollTo(0, {pos})")
            final_scroll = pos
            await asyncio.sleep(delay)
    except Exception: pass
    log["steps"].append(("scroll", archetype.input_device, final_scroll, len(seq)))

    read_time = weibull_sample(k=archetype.read_pause_k, lam=archetype.read_pause_lam, rng=rng)
    read_time = max(0.5, min(read_time, 8.0))
    intensity = {"neglect": "none", "horizontal": "active", "vertical": "light", "marker": "marker"}.get(archetype.cursor_read_style, "light")
    drift = drift_path(target, read_time, rng, intensity=intensity)
    try:
        for dx, dy, dt in drift:
            await page.mouse.move(max(0, min(dx, viewport_w)), max(0, min(dy, viewport_h)))
            await asyncio.sleep(max(0.05, dt))
    except Exception: await asyncio.sleep(read_time)
    log["steps"].append(("read_pause", read_time, archetype.cursor_read_style))

    try:
        await page.evaluate("window.scrollTo(0, 0)")
        await page.wait_for_timeout(200)
    except Exception: pass
    return log


class PlaywrightFlowDriver(Driver):
    def __init__(self, selectors: Optional[dict] = None):
        self.cfg = selectors

    async def generate(self, job: Job, storage_state_path: str) -> bytes:
        from playwright.async_api import TimeoutError as PWTimeout
        from playwright.async_api import async_playwright

        cfg = self.cfg or load_selectors()
        url = _sel(cfg, "start_url")
        profile = _get_or_create_profile(storage_state_path)

        proxy_server = os.getenv("PROXY_SERVER")
        proxy_user = os.getenv("PROXY_USER")
        proxy_pass = os.getenv("PROXY_PASS")

        launch_kwargs = {
            "headless": HEADLESS,
            "channel": "chrome",
            "args": ["--disable-blink-features=AutomationControlled", "--start-maximized"]
        }

        if proxy_server:
            if STEALTH_DEBUG: print(f"[stealth] using proxy: {proxy_server}")
            launch_kwargs["proxy"] = {"server": proxy_server, "username": proxy_user, "password": proxy_pass}

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(**launch_kwargs)
            ctx_kwargs: dict = {"storage_state": storage_state_path, "no_viewport": True}
            
            if profile is not None:
                try:
                    ctx_kwargs = apply_profile_to_context_kwargs(profile, ctx_kwargs)
                    ctx_kwargs["no_viewport"] = True
                except Exception: pass

            ctx = await browser.new_context(**ctx_kwargs)
            if profile is not None:
                try: await ctx.add_init_script(build_stealth_script(profile))
                except Exception as e:
                    if STEALTH_DEBUG: print(f"[stealth] init script failed: {e}")

            page = await ctx.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                print("[stealth] Zooming out to reveal bottom UI...")
                await page.keyboard.press("Control+-")
                await page.keyboard.press("Control+-")
                await page.wait_for_timeout(1000)

                for key, why in (("signed_out_marker", "signed out"), ("verification_marker", "verification page"), ("out_of_credits_marker", "out of credits")):
                    m = cfg.get(key)
                    if m and not str(m).startswith("TODO") and await page.locator(m).count():
                        raise NeedsHuman(why)

                if STEALTH_ENABLED and profile is not None:
                    try:
                        vp = ctx_kwargs.get("viewport") or {"width": 1920, "height": 1080}
                        await _execute_archetype_async(
                            page, pick_archetype(random.Random()),
                            viewport_w=vp["width"], viewport_h=vp["height"],
                            rng=random.Random(), debug=STEALTH_DEBUG,
                        )
                    except Exception as e:
                        if STEALTH_DEBUG: print(f"[stealth] archetype skipped: {e}")

                # ── Click New Project (if on dashboard) ──
                if "/project/" not in page.url:
                    print("[stealth] Dashboard detected. Clicking 'New Project'...")
                    new_proj_sel = cfg.get("new_project_button")
                    if new_proj_sel:
                        try:
                            await page.locator(new_proj_sel).first.click(timeout=5000)
                            await page.wait_for_timeout(3000) # Wait for project to load
                        except Exception as e:
                            print(f"[stealth] Could not click new project: {e}")

                # ── Google Flow Settings Menu ──
                settings_sel = cfg.get("settings_trigger")
                if settings_sel and not str(settings_sel).startswith("TODO"):
                    try:
                        await page.click(settings_sel, timeout=5000)
                        await page.wait_for_timeout(1000)

                        img_tab_sel = cfg.get("image_tab")
                        if img_tab_sel and not str(img_tab_sel).startswith("TODO"):
                            try: await page.click(img_tab_sel, timeout=2000); await page.wait_for_timeout(500)
                            except Exception: pass 

                        ratio_sel = (cfg.get("aspect_buttons") or {}).get(job.aspect)
                        if ratio_sel and not str(ratio_sel).startswith("TODO"):
                            try: await page.click(ratio_sel, timeout=2000); await page.wait_for_timeout(300)
                            except Exception: pass

                        x4_sel = cfg.get("x4_button")
                        if x4_sel and not str(x4_sel).startswith("TODO"):
                            try: await page.click(x4_sel, timeout=2000)
                            except Exception: pass

                        await page.keyboard.press("Escape"); await page.wait_for_timeout(500)
                    except Exception as e:
                        if STEALTH_DEBUG: print(f"[stealth] settings menu error (ignoring): {e}")

                # ── Attach references ──
                if job.reference_files:
                    print(f"[stealth] Attaching {len(job.reference_files)} reference files...")
                    try:
                        add_media_btn = cfg.get("add_media_button")
                        if add_media_btn:
                            await page.click(add_media_btn)
                            await page.wait_for_timeout(1000)

                        attach_sel = _sel(cfg, "reference_file_input")
                        await page.set_input_files(attach_sel, job.reference_files)
                        
                        print("[stealth] Waiting for reference images to upload...")
                        await page.wait_for_function(
                            '() => document.querySelectorAll(\'img[src^="blob:"\']).length > 0',
                            timeout=15000
                        )
                        await page.wait_for_timeout(2000)
                        
                    except Exception as e:
                        print(f"[stealth] Failed to attach references: {e}")
                # ── Type Prompt ──
                print("[stealth] Typing prompt...")
                prompt_sel = _sel(cfg, "prompt_input")
                await page.click(prompt_sel, timeout=10000)
                await page.wait_for_timeout(200)
                await page.keyboard.type(job.prompt, delay=random.randint(30, 80))
                await page.wait_for_timeout(1000)

                # ── Generate ──
                print("[stealth] Clicking generate...")
                before = await page.locator(_sel(cfg, "result_image")).count()
                await page.click(_sel(cfg, "generate_button"))

                result = page.locator(_sel(cfg, "result_image"))
                await page.wait_for_function(
                    "([sel, n]) => document.querySelectorAll(sel).length > n",
                    arg=[cfg["result_image"], before], timeout=GENERATION_TIMEOUT_MS,
                )
                src = await result.nth(before).get_attribute("src")
                if not src: raise Retryable("result image has no src")
                if src.startswith("data:"):
                    import base64
                    return base64.b64decode(src.split(",", 1)[1])
                resp = await ctx.request.get(src)
                if not resp.ok: raise Retryable(f"could not download result ({resp.status})")
                return await resp.body()

            except PWTimeout as e:
                raise Retryable(f"timed out: {str(e)[:120]}")
            finally:
                await browser.close()

def aspect_for_size(size: str) -> str:
    m = re.match(r"^(\d+)x(\d+)$", size or "")
    if not m: return "1:1"
    w, h = int(m.group(1)), int(m.group(2))
    r = w / h
    options = {"1:1": 1.0, "4:5": 0.8, "9:16": 9 / 16, "16:9": 16 / 9, "4:3": 4 / 3, "3:4": 3 / 4}
    return min(options, key=lambda k: abs(options[k] - r))

def make_driver() -> Driver:
    kind = os.getenv("FLOW_DRIVER", "mock" if HEADLESS else "playwright")
    return MockDriver() if kind == "mock" else PlaywrightFlowDriver()