"""
Browser fingerprint profile generator — Phase 2 stealth hardening.

Generates internally-consistent browser profiles where every attribute
agrees with every other: UA, platform, screen, WebGL, canvas seed, fonts,
timezone, languages. Anti-bot ML models detect "impossible combinations"
(Windows UA + Linux platform + no Windows fonts); this module ensures
every property is derived from a single coherent device archetype.

Key design decisions (i2opwq-ENG-0295):
  - ZERO external dependencies (no browserforge/fingerprint-suite)
  - Seeded per-account: same account = same "device" every run
  - Archetype-based: pick a real device profile, derive everything from it
  - Canvas/WebGL injection: stable per-session seed, not random per-read
    (two-read consistency checks catch randomization)
  - Imported and called from snapshot.py only; extraction pipeline unaware
"""

import hashlib
import json
import os
import random
from dataclasses import dataclass, field
from typing import Optional


# ═══════════════════════════════════════════════════════════════════════
# Device archetypes — real-world device combinations that actually exist.
# Each archetype defines the FULL set of correlated properties a real
# browser on that device would report. Adding an archetype = one dict.
# ═══════════════════════════════════════════════════════════════════════

_ARCHETYPES = [
    {
        "id": "win10-nvidia-1080p",
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "platform": "Win32",
        "oscpu": "",
        "screen": {"width": 1920, "height": 1080, "depth": 24, "outer_w": 1920, "outer_h": 1040},
        "webgl_vendor": "Google Inc. (NVIDIA)",
        "webgl_renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "hardware_concurrency": 12,
        "device_memory": 8,
        "max_touch_points": 0,
        "languages": ["en-US", "en"],
        "timezone": "America/New_York",
        "fonts": ["Arial", "Calibri", "Cambria", "Consolas", "Courier New", "Georgia",
                  "Impact", "Lucida Console", "Segoe UI", "Tahoma", "Times New Roman",
                  "Trebuchet MS", "Verdana", "Wingdings"],
    },
    {
        "id": "win10-amd-1440p",
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "platform": "Win32",
        "oscpu": "",
        "screen": {"width": 2560, "height": 1440, "depth": 24, "outer_w": 2560, "outer_h": 1400},
        "webgl_vendor": "Google Inc. (AMD)",
        "webgl_renderer": "ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "hardware_concurrency": 8,
        "device_memory": 16,
        "max_touch_points": 0,
        "languages": ["en-US", "en"],
        "timezone": "America/Chicago",
        "fonts": ["Arial", "Calibri", "Cambria", "Consolas", "Courier New", "Georgia",
                  "Impact", "Lucida Console", "Segoe UI", "Tahoma", "Times New Roman",
                  "Trebuchet MS", "Verdana", "Wingdings"],
    },
    {
        "id": "win11-intel-1080p",
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "platform": "Win32",
        "oscpu": "",
        "screen": {"width": 1920, "height": 1080, "depth": 24, "outer_w": 1920, "outer_h": 1040},
        "webgl_vendor": "Google Inc. (Intel)",
        "webgl_renderer": "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "hardware_concurrency": 8,
        "device_memory": 8,
        "max_touch_points": 10,
        "languages": ["en-US", "en"],
        "timezone": "America/Los_Angeles",
        "fonts": ["Arial", "Calibri", "Cambria", "Consolas", "Courier New", "Georgia",
                  "Impact", "Lucida Console", "Segoe UI", "Segoe UI Variable",
                  "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana", "Wingdings"],
    },
    {
        "id": "win10-nvidia-laptop",
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "platform": "Win32",
        "oscpu": "",
        "screen": {"width": 1366, "height": 768, "depth": 24, "outer_w": 1366, "outer_h": 728},
        "webgl_vendor": "Google Inc. (NVIDIA)",
        "webgl_renderer": "ANGLE (NVIDIA, NVIDIA GeForce MX250 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "hardware_concurrency": 4,
        "device_memory": 8,
        "max_touch_points": 0,
        "languages": ["en-US", "en"],
        "timezone": "America/Denver",
        "fonts": ["Arial", "Calibri", "Cambria", "Consolas", "Courier New", "Georgia",
                  "Impact", "Lucida Console", "Segoe UI", "Tahoma", "Times New Roman",
                  "Trebuchet MS", "Verdana", "Wingdings"],
    },
    {
        "id": "mac-m1-retina",
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "platform": "MacIntel",
        "oscpu": "",
        "screen": {"width": 1440, "height": 900, "depth": 30, "outer_w": 1440, "outer_h": 875},
        "webgl_vendor": "Google Inc. (Apple)",
        "webgl_renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)",
        "hardware_concurrency": 8,
        "device_memory": 8,
        "max_touch_points": 0,
        "languages": ["en-US", "en"],
        "timezone": "America/New_York",
        "fonts": ["Arial", "Courier New", "Georgia", "Helvetica", "Helvetica Neue",
                  "Lucida Grande", "Menlo", "Monaco", "SF Pro", "Times New Roman",
                  "Trebuchet MS", "Verdana"],
    },
    {
        "id": "mac-m2-retina",
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "platform": "MacIntel",
        "oscpu": "",
        "screen": {"width": 1512, "height": 982, "depth": 30, "outer_w": 1512, "outer_h": 957},
        "webgl_vendor": "Google Inc. (Apple)",
        "webgl_renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
        "hardware_concurrency": 8,
        "device_memory": 8,
        "max_touch_points": 0,
        "languages": ["en-US", "en"],
        "timezone": "America/Chicago",
        "fonts": ["Arial", "Courier New", "Georgia", "Helvetica", "Helvetica Neue",
                  "Lucida Grande", "Menlo", "Monaco", "SF Pro", "Times New Roman",
                  "Trebuchet MS", "Verdana"],
    },
]


@dataclass
class BrowserProfile:
    """A coherent browser fingerprint — every property derived from one
    device archetype, seeded for stability across runs."""
    archetype_id: str = ""
    user_agent: str = ""
    platform: str = ""
    screen_width: int = 1920
    screen_height: int = 1080
    color_depth: int = 24
    outer_width: int = 1920
    outer_height: int = 1040
    webgl_vendor: str = ""
    webgl_renderer: str = ""
    hardware_concurrency: int = 8
    device_memory: int = 8
    max_touch_points: int = 0
    languages: list = field(default_factory=lambda: ["en-US", "en"])
    timezone: str = "America/New_York"
    fonts: list = field(default_factory=list)
    canvas_seed: int = 0  # deterministic seed for canvas noise

    def to_dict(self) -> dict:
        return {
            "archetype_id": self.archetype_id,
            "user_agent": self.user_agent,
            "platform": self.platform,
            "screen_width": self.screen_width,
            "screen_height": self.screen_height,
            "color_depth": self.color_depth,
            "outer_width": self.outer_width,
            "outer_height": self.outer_height,
            "webgl_vendor": self.webgl_vendor,
            "webgl_renderer": self.webgl_renderer,
            "hardware_concurrency": self.hardware_concurrency,
            "device_memory": self.device_memory,
            "max_touch_points": self.max_touch_points,
            "languages": self.languages,
            "timezone": self.timezone,
            "fonts": self.fonts,
            "canvas_seed": self.canvas_seed,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "BrowserProfile":
        p = cls()
        for k, v in d.items():
            if hasattr(p, k):
                setattr(p, k, v)
        return p


def generate_profile(seed: str = "") -> BrowserProfile:
    """Generate a coherent browser profile from a device archetype.

    Args:
        seed: stable seed string (e.g. user_id, account email, session path).
              Same seed always picks the same archetype and produces the same
              profile. Empty string = random.
    """
    if seed:
        h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
        rng = random.Random(h)
    else:
        rng = random.Random()

    arch = rng.choice(_ARCHETYPES)
    scr = arch["screen"]

    profile = BrowserProfile(
        archetype_id=arch["id"],
        user_agent=arch["ua"],
        platform=arch["platform"],
        screen_width=scr["width"],
        screen_height=scr["height"],
        color_depth=scr["depth"],
        outer_width=scr["outer_w"],
        outer_height=scr["outer_h"],
        webgl_vendor=arch["webgl_vendor"],
        webgl_renderer=arch["webgl_renderer"],
        hardware_concurrency=arch["hardware_concurrency"],
        device_memory=arch["device_memory"],
        max_touch_points=arch["max_touch_points"],
        languages=list(arch["languages"]),
        timezone=arch["timezone"],
        fonts=list(arch["fonts"]),
        canvas_seed=rng.randint(100000, 999999),
    )
    return profile


def load_or_create_profile(profile_path: str = "",
                           seed: str = "") -> BrowserProfile:
    """Load a persisted profile or create and save a new one.

    Persistence ensures the same account always presents the same "device"
    across runs — anti-bot systems flag identity churn.
    """
    if not profile_path:
        profile_path = os.path.join("data", "fingerprint_profile.json")

    if os.path.exists(profile_path):
        try:
            with open(profile_path, "r") as f:
                data = json.load(f)
            profile = BrowserProfile.from_dict(data)
            return profile
        except Exception:
            pass  # corrupt file — regenerate

    profile = generate_profile(seed=seed)

    # save for next run
    try:
        os.makedirs(os.path.dirname(profile_path) or ".", exist_ok=True)
        with open(profile_path, "w") as f:
            json.dump(profile.to_dict(), f, indent=2)
    except Exception:
        pass  # non-fatal — we still have the profile in memory

    return profile


def build_stealth_script(profile: BrowserProfile) -> str:
    """Build the JS init script that injects the profile's fingerprint
    into the browser context BEFORE any page scripts run.

    Key design: canvas and WebGL values are STABLE per-session (seeded),
    not random per-read. Anti-bot two-read consistency checks catch
    randomization instantly. Our values are deterministic from the seed,
    so repeated reads return identical results.
    """
    fonts_json = json.dumps(profile.fonts)
    langs_json = json.dumps(profile.languages)

    return f"""(() => {{
// ── navigator properties ──
Object.defineProperty(navigator, 'webdriver', {{get: () => undefined}});
Object.defineProperty(navigator, 'platform', {{get: () => '{profile.platform}'}});
Object.defineProperty(navigator, 'hardwareConcurrency', {{get: () => {profile.hardware_concurrency}}});
Object.defineProperty(navigator, 'deviceMemory', {{get: () => {profile.device_memory}}});
Object.defineProperty(navigator, 'maxTouchPoints', {{get: () => {profile.max_touch_points}}});
Object.defineProperty(navigator, 'languages', {{get: () => {langs_json}}});
Object.defineProperty(navigator, 'plugins', {{get: () => [
  {{name:'Chrome PDF Plugin', filename:'internal-pdf-viewer'}},
  {{name:'Chrome PDF Viewer', filename:'mhjfbmdgcfjbbpaeojofohoefgiehjai'}},
  {{name:'Native Client', filename:'internal-nacl-plugin'}}
]}});
if (!window.chrome) window.chrome = {{}};
window.chrome.runtime = window.chrome.runtime || {{}};
window.chrome.csi = window.chrome.csi || function(){{}};
window.chrome.loadTimes = window.chrome.loadTimes || function(){{}};

// ── screen ──
Object.defineProperty(screen, 'width', {{get: () => {profile.screen_width}}});
Object.defineProperty(screen, 'height', {{get: () => {profile.screen_height}}});
Object.defineProperty(screen, 'availWidth', {{get: () => {profile.screen_width}}});
Object.defineProperty(screen, 'availHeight', {{get: () => {profile.outer_height}}});
Object.defineProperty(screen, 'colorDepth', {{get: () => {profile.color_depth}}});
Object.defineProperty(screen, 'pixelDepth', {{get: () => {profile.color_depth}}});
window.outerWidth = {profile.outer_width};
window.outerHeight = {profile.outer_height};

// ── WebGL ──
const _getParam = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(p) {{
  const ext = this.getExtension('WEBGL_debug_renderer_info');
  if (ext) {{
    if (p === ext.UNMASKED_VENDOR_WEBGL) return '{profile.webgl_vendor}';
    if (p === ext.UNMASKED_RENDERER_WEBGL) return '{profile.webgl_renderer}';
  }}
  return _getParam.call(this, p);
}};
const _getParam2 = WebGL2RenderingContext.prototype.getParameter;
WebGL2RenderingContext.prototype.getParameter = function(p) {{
  const ext = this.getExtension('WEBGL_debug_renderer_info');
  if (ext) {{
    if (p === ext.UNMASKED_VENDOR_WEBGL) return '{profile.webgl_vendor}';
    if (p === ext.UNMASKED_RENDERER_WEBGL) return '{profile.webgl_renderer}';
  }}
  return _getParam2.call(this, p);
}};

// ── Canvas: deterministic noise from seed (stable per-read) ──
const _toDataURL = HTMLCanvasElement.prototype.toDataURL;
const _toBlob = HTMLCanvasElement.prototype.toBlob;
const SEED = {profile.canvas_seed};
function _noise(ctx) {{
  try {{
    const w = ctx.canvas.width, h = ctx.canvas.height;
    if (w === 0 || h === 0) return;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    let s = SEED;
    for (let i = 0; i < d.length; i += 4) {{
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (d[i] + ((s >> 16) & 1)) & 0xff;
    }}
    ctx.putImageData(img, 0, 0);
  }} catch(e) {{}}
}}
HTMLCanvasElement.prototype.toDataURL = function(...args) {{
  const ctx = this.getContext('2d');
  if (ctx) _noise(ctx);
  return _toDataURL.apply(this, args);
}};
HTMLCanvasElement.prototype.toBlob = function(...args) {{
  const ctx = this.getContext('2d');
  if (ctx) _noise(ctx);
  return _toBlob.apply(this, args);
}};

// ── AudioContext: deterministic offset ──
const _createOsc = (window.OfflineAudioContext || window.webkitOfflineAudioContext || function(){{}}).prototype.createOscillator;
if (_createOsc) {{
  const _origGetFloatFreq = AnalyserNode.prototype.getFloatFrequencyData;
  AnalyserNode.prototype.getFloatFrequencyData = function(arr) {{
    _origGetFloatFreq.call(this, arr);
    let s = SEED;
    for (let i = 0; i < arr.length; i++) {{
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      arr[i] += ((s >> 16) & 0xf) * 0.0001;
    }}
  }};
}}
}})();""".strip()


def apply_profile_to_context_kwargs(profile: BrowserProfile,
                                     ctx_kwargs: dict) -> dict:
    """Apply profile properties to the Playwright/Patchright context kwargs.

    Modifies ctx_kwargs in place and returns it. Sets viewport, locale,
    timezone_id, and user_agent from the profile so the browser-level
    properties match the JS-level injections.
    """
    ctx_kwargs["viewport"] = {
        "width": min(profile.screen_width, 1920),  # viewport ≤ screen
        "height": min(profile.screen_height - 40, 1040),
    }
    ctx_kwargs["locale"] = profile.languages[0] if profile.languages else "en-US"
    ctx_kwargs["timezone_id"] = profile.timezone
    ctx_kwargs["user_agent"] = profile.user_agent
    return ctx_kwargs
