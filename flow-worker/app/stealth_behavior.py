"""
Behavioral archetypes for browser humanization (Phase 3.5 stealth).

Each archetype represents a categorically different browsing persona — not
the same behavior with different parameters, but structurally different
strategies for interacting with a page. Grounded in measured data:

  - Fitts's Law: a≈48ms, b≈146ms/bit, but RAW movements scatter ±46% (GEV)
  - Dwell time: Weibull k<1 on 98.5% of pages (early abandonment + long tail)
  - Cursor-gaze lag: ~700ms; cursor idles during first second after load
  - Scroll: Chrome ~100px/notch (quantized); trackpad = smooth momentum decay
  - Channel coupling: scroll anti-correlated with mouse activity
  - Four cursor-reading styles: neglect, horizontal follow, vertical follow, mark

Sources: Zheng & Wang (WWW 2015), Chapuis et al. (2007), Liu/White/Dumais
(SIGIR 2010), Huang/White/Buscher (CHI 2012), Nielsen Norman Group (2018),
Chartbeat, BeCAPTCHA-Mouse (Acien et al., Pattern Recognition 2022).

Design: i2opwq-ENG-0298 research → archetype implementation.
"""

import math
import random
import time
from dataclasses import dataclass, field
from typing import List, Tuple, Optional


# ═══════════════════════════════════════════════════════════════════════
# Statistical helpers calibrated to measured human distributions
# ═══════════════════════════════════════════════════════════════════════

def weibull_sample(k: float, lam: float, rng: random.Random) -> float:
    """Sample from Weibull distribution. k<1 = early-abandon shape (98.5%
    of real page dwells). k>1 = build-up-then-leave."""
    u = rng.random()
    while u == 0:
        u = rng.random()
    return lam * (-math.log(u)) ** (1.0 / k)


def gev_scatter(base_ms: float, rng: random.Random, shape: float = 0.24,
                scale_frac: float = 0.35) -> float:
    """Add GEV-distributed scatter to a Fitts-predicted movement time.
    Real humans deviate ±46% from Fitts on raw movements (Zheng & Wang).
    shape=0.24 from Chapuis field data; scale_frac controls spread."""
    scale = base_ms * scale_frac
    u = rng.random()
    while u == 0 or u == 1:
        u = rng.random()
    if abs(shape) < 1e-6:
        gev = -math.log(-math.log(u))
    else:
        gev = ((-math.log(u)) ** (-shape) - 1) / shape
    return max(base_ms * 0.2, base_ms + scale * gev)


def fitts_time(distance: float, width: float = 17.0,
               a: float = 48.0, b: float = 146.0) -> float:
    """Fitts's Law predicted movement time in ms. a=48, b=146 from
    Zheng & Wang's real-browsing measurement (1047 users, r=98.28%)."""
    if distance <= 0:
        return a
    id_bits = math.log2(distance / width + 1)
    return a + b * id_bits


# ═══════════════════════════════════════════════════════════════════════
# Scroll physics matched to real input devices
# ═══════════════════════════════════════════════════════════════════════

def wheel_scroll_sequence(target_px: int, rng: random.Random) -> List[Tuple[int, float]]:
    """Chrome mouse wheel: ~100px per notch, quantized. Real users spin
    in bursts of 1-4 notches with variable inter-notch timing."""
    NOTCH_PX = 100
    sequence = []
    scrolled = 0
    while scrolled < target_px:
        # burst of 1-4 notches
        burst = rng.randint(1, 4)
        for _ in range(burst):
            if scrolled >= target_px:
                break
            step = NOTCH_PX + rng.randint(-10, 10)  # slight hw variance
            scrolled += step
            # inter-notch gap: 30-80ms within a burst
            gap = rng.uniform(0.03, 0.08)
            sequence.append((min(scrolled, target_px), gap))
        # inter-burst pause: 150-600ms (thinking/reading)
        if scrolled < target_px:
            pause = rng.uniform(0.15, 0.6)
            sequence.append((scrolled, pause))
    return sequence


def trackpad_scroll_sequence(target_px: int, rng: random.Random) -> List[Tuple[int, float]]:
    """Mac trackpad: smooth momentum with exponential decay after finger
    lifts. iOS deceleration: 0.998/ms → projected travel ≈ 499·v₀."""
    sequence = []
    scrolled = 0
    # finger phase: smooth, accelerating
    finger_events = rng.randint(8, 18)
    accel = rng.uniform(1.3, 2.0)
    base_delta = rng.uniform(8, 20)
    for i in range(finger_events):
        t = i / finger_events
        delta = base_delta * (1 + accel * t)  # accelerating
        delta += rng.gauss(0, 2)  # noise
        scrolled += max(1, int(delta))
        if scrolled >= target_px:
            scrolled = target_px
            sequence.append((scrolled, rng.uniform(0.012, 0.020)))
            break
        sequence.append((scrolled, rng.uniform(0.012, 0.020)))  # ~60Hz
    # momentum phase: decaying deltas after "finger lift"
    velocity = base_delta * (1 + accel)
    decay = 0.92 + rng.uniform(0, 0.05)  # per-frame decay
    while velocity > 2 and scrolled < target_px:
        velocity *= decay
        scrolled += max(1, int(velocity))
        scrolled = min(scrolled, target_px)
        sequence.append((scrolled, rng.uniform(0.014, 0.018)))
    return sequence


def keyboard_scroll_sequence(target_px: int, rng: random.Random) -> List[Tuple[int, float]]:
    """Power users scroll with Space/PageDown. Large jumps, long pauses."""
    JUMP_PX = rng.choice([600, 700, 800, 900])  # roughly one viewport
    sequence = []
    scrolled = 0
    while scrolled < target_px:
        scrolled = min(scrolled + JUMP_PX, target_px)
        # reading pause after each jump: 1-4s
        pause = weibull_sample(k=0.75, lam=2.5, rng=rng)
        pause = max(0.8, min(pause, 6.0))
        sequence.append((scrolled, pause))
    return sequence


# ═══════════════════════════════════════════════════════════════════════
# Mouse path generators
# ═══════════════════════════════════════════════════════════════════════

def bezier_path_with_scatter(start: Tuple[int, int], end: Tuple[int, int],
                             rng: random.Random,
                             steps: int = 0) -> List[Tuple[int, int]]:
    """Cubic Bézier with GEV-scattered step timing and Gaussian micro-noise.
    NOT perfectly smooth — real hands produce corrective submovements."""
    sx, sy = start
    ex, ey = end
    dist = math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
    if steps <= 0:
        steps = max(10, int(dist / 15) + rng.randint(-5, 5))

    # control points with personality-driven spread
    spread = rng.uniform(0.15, 0.45)
    c1x = sx + (ex - sx) * rng.uniform(0.2, 0.5) + dist * spread * rng.gauss(0, 0.3)
    c1y = sy + (ey - sy) * rng.uniform(0.1, 0.4) + dist * spread * rng.gauss(0, 0.2)
    c2x = sx + (ex - sx) * rng.uniform(0.5, 0.8) + dist * spread * rng.gauss(0, 0.2)
    c2y = sy + (ey - sy) * rng.uniform(0.6, 0.9) + dist * spread * rng.gauss(0, 0.15)

    points = []
    for i in range(steps + 1):
        t = i / steps
        it = 1 - t
        x = it**3 * sx + 3*it**2*t * c1x + 3*it*t**2 * c2x + t**3 * ex
        y = it**3 * sy + 3*it**2*t * c1y + 3*it*t**2 * c2y + t**3 * ey
        # micro-noise (real hand tremor)
        x += rng.gauss(0, 1.2)
        y += rng.gauss(0, 0.8)
        points.append((int(x), int(y)))

    # occasional corrective submovement at the end (~30%)
    if rng.random() < 0.30 and len(points) > 5:
        overshoot_x = ex + rng.randint(-15, 15)
        overshoot_y = ey + rng.randint(-10, 10)
        points[-2] = (overshoot_x, overshoot_y)
        points[-1] = (ex + rng.randint(-2, 2), ey + rng.randint(-2, 2))

    return points


def drift_path(center: Tuple[int, int], duration_s: float,
               rng: random.Random, intensity: str = "light") -> List[Tuple[int, int, float]]:
    """Cursor drift while reading. Returns (x, y, sleep_s) tuples.
    intensity: 'none'=parked, 'light'=subtle, 'active'=following text."""
    cx, cy = center
    if intensity == "none":
        return [(cx, cy, duration_s)]

    steps = max(2, int(duration_s / 0.3))
    sleep_per = duration_s / steps
    result = []
    x, y = cx, cy
    for _ in range(steps):
        if intensity == "light":
            x += rng.gauss(0, 4)
            y += rng.gauss(0, 3)
        elif intensity == "active":
            # following text: moves rightward, wraps down
            x += rng.uniform(5, 20)
            y += rng.gauss(0, 2)
            if x > cx + 300:
                x = cx - 50
                y += rng.uniform(15, 25)
        elif intensity == "marker":
            # jumps to points of interest
            if rng.random() < 0.3:
                x = cx + rng.randint(-200, 200)
                y = cy + rng.randint(-100, 100)
        result.append((max(0, int(x)), max(0, int(y)),
                       sleep_per + rng.gauss(0, sleep_per * 0.15)))
    return result


# ═══════════════════════════════════════════════════════════════════════
# The archetypes — categorically different browsing personas
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class BehavioralArchetype:
    """A distinct human browsing persona with its own motor control
    parameters, device physics, and interaction strategy."""
    name: str
    description: str

    # Input device (determines scroll physics)
    input_device: str  # "wheel", "trackpad", "keyboard", "mixed"

    # Mouse movement character
    mouse_speed: str  # "fast", "medium", "slow", "minimal"
    mouse_curve_spread: float  # how curved the paths are (0.1=straight, 0.5=dramatic)
    overshoot_prob: float  # corrective submovement probability

    # Scroll behavior
    scroll_depth_frac: float  # how far down the page (0.0-1.0)
    scroll_reversal_prob: float  # direction reversal probability
    scroll_pause_k: float  # Weibull shape for inter-scroll pauses

    # Timing
    initial_pause_range: Tuple[float, float]
    read_pause_k: float  # Weibull shape for reading pauses
    read_pause_lam: float  # Weibull scale
    total_time_range: Tuple[float, float]  # approximate total humanization time

    # Cursor-while-reading style (Rodden et al.)
    cursor_read_style: str  # "neglect", "horizontal", "vertical", "marker"

    # Channel coupling
    mouse_during_scroll: bool  # does cursor move during scroll? (anti-correlated in reality)
    hover_prob: float  # probability of hovering over a link


_BEHAVIORAL_ARCHETYPES = [
    BehavioralArchetype(
        name="the_scanner",
        description="Quick skim: fast mouse, rapid scroll, barely reads. In and out.",
        input_device="wheel",
        mouse_speed="fast",
        mouse_curve_spread=0.15,
        overshoot_prob=0.10,
        scroll_depth_frac=0.55,
        scroll_reversal_prob=0.10,
        scroll_pause_k=1.2,
        initial_pause_range=(0.2, 0.6),
        read_pause_k=0.6,
        read_pause_lam=1.2,
        total_time_range=(2.0, 4.5),
        cursor_read_style="neglect",
        mouse_during_scroll=False,
        hover_prob=0.15,
    ),
    BehavioralArchetype(
        name="the_reader",
        description="Careful reader: slow deliberate scroll, long pauses, cursor follows text.",
        input_device="trackpad",
        mouse_speed="slow",
        mouse_curve_spread=0.35,
        overshoot_prob=0.25,
        scroll_depth_frac=0.35,
        scroll_reversal_prob=0.15,
        scroll_pause_k=0.65,
        initial_pause_range=(0.8, 2.0),
        read_pause_k=0.70,
        read_pause_lam=4.0,
        total_time_range=(5.0, 10.0),
        cursor_read_style="horizontal",
        mouse_during_scroll=False,
        hover_prob=0.35,
    ),
    BehavioralArchetype(
        name="the_comparison_shopper",
        description="Scrolls to reviews, reads one, scrolls back UP to product info, then down again.",
        input_device="wheel",
        mouse_speed="medium",
        mouse_curve_spread=0.30,
        overshoot_prob=0.20,
        scroll_depth_frac=0.45,
        scroll_reversal_prob=0.60,  # high — the signature behavior
        scroll_pause_k=0.75,
        initial_pause_range=(0.5, 1.2),
        read_pause_k=0.70,
        read_pause_lam=2.5,
        total_time_range=(4.0, 8.0),
        cursor_read_style="marker",
        mouse_during_scroll=False,
        hover_prob=0.40,
    ),
    BehavioralArchetype(
        name="the_distracted",
        description="Scrolls a bit, long idle, sudden burst, mouse wanders aimlessly.",
        input_device="trackpad",
        mouse_speed="slow",
        mouse_curve_spread=0.45,
        overshoot_prob=0.35,
        scroll_depth_frac=0.25,
        scroll_reversal_prob=0.20,
        scroll_pause_k=0.55,  # very early-abandon shaped
        initial_pause_range=(1.5, 4.0),
        read_pause_k=0.55,
        read_pause_lam=5.0,
        total_time_range=(6.0, 12.0),
        cursor_read_style="neglect",
        mouse_during_scroll=True,  # hand rests on trackpad
        hover_prob=0.10,
    ),
    BehavioralArchetype(
        name="the_quick_checker",
        description="Glances at first review, decides in 3 seconds. Minimal interaction.",
        input_device="wheel",
        mouse_speed="fast",
        mouse_curve_spread=0.12,
        overshoot_prob=0.05,
        scroll_depth_frac=0.15,
        scroll_reversal_prob=0.05,
        scroll_pause_k=1.5,  # k>1 = builds up then leaves
        initial_pause_range=(0.3, 0.8),
        read_pause_k=0.80,
        read_pause_lam=1.0,
        total_time_range=(1.5, 3.5),
        cursor_read_style="neglect",
        mouse_during_scroll=False,
        hover_prob=0.05,
    ),
    BehavioralArchetype(
        name="the_power_user",
        description="Keyboard scroller: Space/PageDown, precise mouse, no wasted movement.",
        input_device="keyboard",
        mouse_speed="fast",
        mouse_curve_spread=0.10,
        overshoot_prob=0.08,
        scroll_depth_frac=0.50,
        scroll_reversal_prob=0.05,
        scroll_pause_k=0.85,
        initial_pause_range=(0.2, 0.5),
        read_pause_k=0.75,
        read_pause_lam=2.0,
        total_time_range=(3.0, 6.0),
        cursor_read_style="neglect",
        mouse_during_scroll=False,
        hover_prob=0.20,
    ),
    BehavioralArchetype(
        name="the_hesitator",
        description="Starts scrolling, stops, scrolls back, pauses, resumes. Indecisive.",
        input_device="wheel",
        mouse_speed="medium",
        mouse_curve_spread=0.40,
        overshoot_prob=0.30,
        scroll_depth_frac=0.30,
        scroll_reversal_prob=0.45,  # lots of back-and-forth
        scroll_pause_k=0.60,
        initial_pause_range=(0.6, 1.8),
        read_pause_k=0.65,
        read_pause_lam=3.5,
        total_time_range=(4.0, 9.0),
        cursor_read_style="vertical",
        mouse_during_scroll=False,
        hover_prob=0.25,
    ),
    BehavioralArchetype(
        name="the_cursor_follower",
        description="Cursor actively tracks what they're reading — moves with the text.",
        input_device="trackpad",
        mouse_speed="medium",
        mouse_curve_spread=0.25,
        overshoot_prob=0.15,
        scroll_depth_frac=0.40,
        scroll_reversal_prob=0.20,
        scroll_pause_k=0.70,
        initial_pause_range=(0.5, 1.5),
        read_pause_k=0.70,
        read_pause_lam=3.0,
        total_time_range=(4.0, 8.0),
        cursor_read_style="horizontal",
        mouse_during_scroll=False,
        hover_prob=0.45,
    ),
]


def pick_archetype(rng: Optional[random.Random] = None) -> BehavioralArchetype:
    """Pick a random archetype for this run. Different from the device
    profile seed — the same "device" can browse differently each time,
    because real humans do."""
    if rng is None:
        rng = random.Random()
    return rng.choice(_BEHAVIORAL_ARCHETYPES)


def execute_archetype(page, archetype: BehavioralArchetype,
                      viewport_w: int = 1280, viewport_h: int = 900,
                      doc_height: int = 5000,
                      rng: Optional[random.Random] = None,
                      debug: bool = False) -> dict:
    """Execute a behavioral archetype on a live page. Returns a log dict.

    This is the main entry point — _humanize() in snapshot.py calls this
    instead of its own hardcoded sequence when archetypes are available.
    """
    if rng is None:
        rng = random.Random()

    log = {"archetype": archetype.name, "steps": []}

    # ── Step 1: Initial pause (Weibull-distributed, not uniform) ──
    lo, hi = archetype.initial_pause_range
    pause = max(lo, min(hi, weibull_sample(k=0.75, lam=(lo + hi) / 2, rng=rng)))
    if debug:
        print(f"[gecko]   archetype '{archetype.name}': initial pause {pause:.1f}s")
    time.sleep(pause)
    log["steps"].append(("initial_pause", pause))

    # ── Step 2: Mouse entrance (speed + curve from archetype) ──
    edge = rng.choice(["top", "left", "right"])
    if edge == "top":
        start = (rng.randint(100, viewport_w - 100), 0)
    elif edge == "left":
        start = (0, rng.randint(50, viewport_h - 50))
    else:
        start = (viewport_w, rng.randint(50, viewport_h - 50))

    target = (rng.randint(int(viewport_w * 0.2), int(viewport_w * 0.7)),
              rng.randint(int(viewport_h * 0.15), int(viewport_h * 0.45)))

    dist = math.sqrt((target[0] - start[0])**2 + (target[1] - start[1])**2)
    base_mt = fitts_time(dist)
    actual_mt = gev_scatter(base_mt, rng)  # ±46% scatter

    speed_mult = {"fast": 0.6, "medium": 1.0, "slow": 1.5, "minimal": 2.0}
    mt_ms = actual_mt * speed_mult.get(archetype.mouse_speed, 1.0)
    steps = max(8, int(mt_ms / 15))

    path = bezier_path_with_scatter(start, target, rng, steps=steps)

    try:
        per_step_s = (mt_ms / 1000.0) / len(path)
        for px, py in path:
            px = max(0, min(px, viewport_w))
            py = max(0, min(py, viewport_h))
            page.mouse.move(px, py)
            time.sleep(max(0.003, per_step_s + rng.gauss(0, per_step_s * 0.2)))
    except Exception:
        pass

    if debug:
        print(f"[gecko]   step 2: mouse from {edge} → ({target[0]},{target[1]}) "
              f"in {len(path)} steps ({mt_ms:.0f}ms, {archetype.mouse_speed})")
    log["steps"].append(("mouse_enter", edge, target, len(path)))

    # ── Step 3: Scroll (device-matched physics) ──
    scroll_target = int(doc_height * archetype.scroll_depth_frac)
    scroll_target += rng.randint(-200, 200)
    scroll_target = max(100, min(scroll_target, doc_height - 200))

    if archetype.input_device == "wheel":
        scroll_seq = wheel_scroll_sequence(scroll_target, rng)
    elif archetype.input_device == "trackpad":
        scroll_seq = trackpad_scroll_sequence(scroll_target, rng)
    elif archetype.input_device == "keyboard":
        scroll_seq = keyboard_scroll_sequence(scroll_target, rng)
    else:
        scroll_seq = wheel_scroll_sequence(scroll_target, rng)

    final_scroll = 0
    try:
        for pos, delay in scroll_seq:
            page.evaluate(f"window.scrollTo(0, {pos})")
            final_scroll = pos
            time.sleep(delay)
    except Exception:
        pass

    # Direction reversal
    did_reverse = False
    if rng.random() < archetype.scroll_reversal_prob:
        did_reverse = True
        reverse_amt = rng.randint(80, min(400, final_scroll))
        try:
            page.evaluate(f"window.scrollTo(0, {max(0, final_scroll - reverse_amt)})")
            time.sleep(rng.uniform(0.3, 1.0))
            # maybe scroll back down, maybe stay
            if rng.random() < 0.6:
                page.evaluate(f"window.scrollTo(0, {final_scroll})")
                time.sleep(rng.uniform(0.1, 0.3))
        except Exception:
            pass

    if debug:
        print(f"[gecko]   step 3: {archetype.input_device} scroll to "
              f"{final_scroll}px/{doc_height}px ({100*final_scroll//max(1,doc_height)}%)"
              f"{' + reversal' if did_reverse else ''}"
              f" [{len(scroll_seq)} events]")
    log["steps"].append(("scroll", archetype.input_device, final_scroll,
                         len(scroll_seq), did_reverse))

    # ── Step 4: Reading pause with cursor behavior ──
    read_time = weibull_sample(k=archetype.read_pause_k,
                               lam=archetype.read_pause_lam, rng=rng)
    read_time = max(0.5, min(read_time, 8.0))  # cap to reasonable range

    cursor_drift = drift_path(target, read_time, rng,
                              intensity={
                                  "neglect": "none",
                                  "horizontal": "active",
                                  "vertical": "light",
                                  "marker": "marker",
                              }.get(archetype.cursor_read_style, "light"))

    try:
        for dx, dy, dt in cursor_drift:
            dx = max(0, min(dx, viewport_w))
            dy = max(0, min(dy, viewport_h))
            page.mouse.move(dx, dy)
            time.sleep(max(0.05, dt))
    except Exception:
        time.sleep(read_time)

    if debug:
        print(f"[gecko]   step 4: reading pause {read_time:.1f}s "
              f"(cursor: {archetype.cursor_read_style}, "
              f"{len(cursor_drift)} drift points)")
    log["steps"].append(("read_pause", read_time, archetype.cursor_read_style))

    # ── Step 5: Optional hover interaction ──
    did_hover = False
    if rng.random() < archetype.hover_prob:
        did_hover = True
        try:
            page.evaluate("""() => {
                const links = Array.from(document.querySelectorAll('a'))
                    .filter(a => {
                        const r = a.getBoundingClientRect();
                        return r.width > 0 && r.height > 0
                            && r.top > 100 && r.top < window.innerHeight;
                    });
                if (links.length > 0) {
                    const el = links[Math.floor(Math.random() * links.length)];
                    el.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
                    el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
                }
            }""")
            time.sleep(rng.uniform(0.15, 0.5))
        except Exception:
            pass

    if debug:
        print(f"[gecko]   step 5: {'hover on link' if did_hover else 'no hover'} "
              f"(prob={archetype.hover_prob:.0%})")
    log["steps"].append(("hover", did_hover))

    # ── Step 6: Scroll back to top ──
    try:
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(200)
    except Exception:
        pass

    if debug:
        print(f"[gecko]   step 6: scrolled to top for screenshot")
        total = sum(s[1] if isinstance(s[1], (int, float)) else 0
                    for s in log["steps"][:2])
        print(f"[gecko] humanization complete (archetype: {archetype.name})")
    log["steps"].append(("scroll_top",))

    return log
