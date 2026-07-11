"""CineGrade reference implementation.

This module is the mathematical ground truth for the CineGrade After Effects
plugin (plugin/src/Pipeline.cpp mirrors it stage for stage). It exists so the
look can be developed, tested and regression-checked outside After Effects.

Pipeline order (documented in docs/DESIGN.md):

  decode sRGB -> linear
    1. flicker (exposure jitter, linear)
    2. auto exposure (log-average luminance -> gain toward target)
    3. manual exposure
    4. white balance (temperature / tint channel gains)
    5. contrast about pivot (log-domain power)
    6. tonal ranges: shadows / highlights / whites / blacks
    7. filmic tone map (adjustable toe / shoulder / white point)
  encode linear -> display (sRGB)
    8. lift / gamma / gain trims
    9. saturation + vibrance
   10. six-band colour mixer (R Y G C B M: saturation + luminance)
   11. split toning (shadow / highlight tint, balance)
   12. diffusion ("softness": pro-mist style screen of a wide blur)
   13. glow (bright-pass -> blur -> screen)
   14. halation (bright-pass -> wide blur -> tinted screen, red-biased)
   15. chromatic aberration (radial R/B scale)
   16. vignette
   17. gate weave (sub-pixel frame wobble)
   18. film grain (luminance-response-weighted value noise)

All images are float32 RGB in [0, ~), shape (H, W, 3). Alpha is carried
through untouched by callers. Every parameter is a plain float so that the
AE port can keyframe all of them.
"""

from __future__ import annotations

import json
import math
import os

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
PRESET_PATH = os.path.join(_HERE, "..", "presets", "presets.json")

# ---------------------------------------------------------------------------
# presets

def load_presets(path: str = PRESET_PATH):
    with open(path) as f:
        data = json.load(f)
    neutral = data["neutral"]
    presets = {"none": dict(neutral)}
    order = ["none"]
    for p in data["presets"]:
        merged = dict(neutral)
        merged.update(p["params"])
        presets[p["id"]] = merged
        order.append(p["id"])
    return presets, order, data


def blend_with_neutral(params: dict, strength: float) -> dict:
    """Simple-mode 'Strength': linearly interpolate every parameter between
    neutral and the preset. strength in [0, 1] (AE slider 0-100)."""
    neutral = load_presets()[0]["none"]
    out = {}
    for k, v in params.items():
        n = neutral[k]
        if isinstance(v, list):
            out[k] = [a + (b - a) * strength for a, b in zip(n, v)]
        else:
            out[k] = n + (v - n) * strength
    return out


# ---------------------------------------------------------------------------
# colour helpers

def srgb_to_linear(x):
    x = np.clip(x, 0.0, None)
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(x):
    x = np.clip(x, 0.0, None)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1.0 / 2.4) - 0.055)


def luminance(rgb):
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def _hash01(*seeds) -> float:
    """Deterministic scalar hash -> [0,1). Mirrors the integer hash in
    plugin/src/Noise.h so AE renders and reference renders agree."""
    h = np.uint32(2166136261)
    for s in seeds:
        h = np.uint32((int(h) ^ (int(s) & 0xFFFFFFFF)) * 16777619 & 0xFFFFFFFF)
    h = np.uint32(int(h) ^ (int(h) >> 13))
    h = np.uint32(int(h) * 1274126177 & 0xFFFFFFFF)
    return float(int(h) & 0xFFFFFF) / float(0x1000000)


def _noise_image(h, w, seed, channels=1):
    """Deterministic per-frame white noise via numpy PCG with fixed seed —
    the C++ port uses a per-pixel integer hash instead; statistics match."""
    rng = np.random.default_rng(np.uint32(seed))
    return rng.standard_normal((h, w, channels)).astype(np.float32)


# fast repeated-box blur ~= gaussian ------------------------------------------------

def _box_blur_1d(img, r, axis):
    if r < 1:
        return img
    n = img.shape[axis]
    csum = np.cumsum(img, axis=axis, dtype=np.float32)
    idx_hi = np.minimum(np.arange(n) + r, n - 1)
    idx_lo = np.arange(n) - r - 1
    hi = np.take(csum, idx_hi, axis=axis)
    lo = np.where(
        (idx_lo < 0)[(slice(None),) + (None,) * 0],  # broadcast below
        0.0, 0.0)
    lo = np.take(csum, np.maximum(idx_lo, 0), axis=axis)
    mask = idx_lo < 0
    shape = [1] * img.ndim
    shape[axis] = n
    lo = lo * (~mask).reshape(shape)
    count = np.minimum(np.arange(n) + r, n - 1) - np.maximum(idx_lo, -1)
    count = count.reshape(shape).astype(np.float32)
    return (hi - lo) / count


def gaussian_blur(img, sigma):
    """Three-pass box blur approximation of a gaussian. img: (H,W,C)."""
    if sigma <= 0.25:
        return img
    r = max(1, int(round(sigma * 0.8)))
    out = img
    for _ in range(3):
        out = _box_blur_1d(out, r, 0)
        out = _box_blur_1d(out, r, 1)
    return out


# ---------------------------------------------------------------------------
# stages (linear domain)

def auto_exposure_gain(linear_rgb, target_ev=0.0, adapt=1.0,
                       clamp_stops=4.0, highlight_protect=0.35):
    """Return a scalar gain that moves the frame's log-average luminance
    toward mid grey (0.18 * 2^target_ev).

    adapt in [0,1] is how much of the correction to apply. highlight_protect
    in [0,1] restrains *positive* gain when the frame already contains bright
    sources (p90 luminance), so night scenes with floodlights stay night
    instead of being washed up to mid grey. clamp limits the correction to
    +/- clamp_stops."""
    lum = luminance(linear_rgb)
    # stats on a downsampled grid, exactly like the plugin
    sub = lum[::4, ::4]
    log_avg = float(np.exp(np.mean(np.log(sub + 1e-4))))
    target = 0.18 * (2.0 ** target_ev)
    stops = math.log2(target / max(log_avg, 1e-6))
    if stops > 0.0 and highlight_protect > 0.0:
        # anchor on the brightest ~1% of the frame: if it already contains
        # bright sources, restrain the lift so night scenes keep their mood
        p99 = float(np.percentile(sub, 99))
        stops_hl = math.log2(0.75 / max(p99, 1e-6))
        limited = min(stops, max(stops_hl, 0.0))
        stops = stops + (limited - stops) * highlight_protect
    stops = max(-clamp_stops, min(clamp_stops, stops)) * adapt
    return 2.0 ** stops


def apply_white_balance(lin, temperature, tint):
    """temperature/tint in [-100,100]. Positive temperature warms."""
    t = temperature / 100.0
    g = tint / 100.0
    r_gain = 1.0 + 0.25 * t - 0.05 * g
    g_gain = 1.0 + 0.10 * g
    b_gain = 1.0 - 0.25 * t - 0.05 * g
    out = lin.copy()
    out[..., 0] *= r_gain
    out[..., 1] *= g_gain
    out[..., 2] *= b_gain
    return out


def apply_contrast(lin, contrast, pivot=0.18):
    c = 1.0 + contrast / 100.0
    x = np.maximum(lin, 1e-6)
    return pivot * (x / pivot) ** c


def _smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def apply_tonal_ranges(lin, shadows, highlights, whites, blacks):
    """Lightroom-style tonal ranges, applied as luminance-masked exposure in
    linear light. All inputs [-100,100]."""
    lum = luminance(lin)
    d = linear_to_srgb(lum)  # weight in display space for perceptual masks
    w_sh = 1.0 - _smoothstep(0.0, 0.55, d)
    w_hi = _smoothstep(0.45, 1.0, d)
    w_wh = _smoothstep(0.75, 1.0, d)
    w_bl = 1.0 - _smoothstep(0.0, 0.25, d)
    stops = (shadows / 100.0) * 0.9 * w_sh \
        + (highlights / 100.0) * 0.9 * w_hi \
        + (whites / 100.0) * 0.6 * w_wh \
        + (blacks / 100.0) * 0.6 * w_bl
    return lin * (2.0 ** stops)[..., None]


def filmic_tonemap(lin, amount, toe, shoulder, white_point):
    """Adjustable filmic curve, per channel in linear light.

    shoulder in [0,100]: strength of the highlight rolloff (Reinhard-extended
    toward white_point). toe in [0,100]: smooth black-end density. amount
    blends between linear (0) and full curve (1).
    """
    if amount <= 0.0:
        return lin
    x = np.maximum(lin, 0.0)
    s = (shoulder / 100.0) ** 1.5 * 1.6          # 0..1.6
    wp = max(white_point, 1.0)
    curved = x * (1.0 + s * x / (wp * wp)) / (1.0 + s * x)
    t = (toe / 100.0) * 0.05
    if t > 0:
        curved = curved * (x / (x + t))          # smooth flare/toe
    return lin + (curved - lin) * amount


# ---------------------------------------------------------------------------
# stages (display domain)

def apply_lgg(disp, lift, gamma, gain):
    out = np.empty_like(disp)
    for c in range(3):
        x = disp[..., c]
        x = gain[c] * (x + lift[c] * (1.0 - x))
        x = np.maximum(x, 0.0) ** (1.0 / max(gamma[c], 1e-3))
        out[..., c] = x
    return out


def apply_sat_vibrance(disp, saturation, vibrance):
    lum = luminance(disp)[..., None]
    sat_f = saturation / 100.0
    out = lum + (disp - lum) * sat_f
    if vibrance != 0.0:
        v = vibrance / 100.0
        mx = out.max(-1)
        mn = out.min(-1)
        cur_sat = (mx - mn) / np.maximum(mx, 1e-4)
        # vibrance boosts unsaturated pixels more; protects near-orange (skin)
        w = (1.0 - cur_sat) if v > 0 else np.ones_like(cur_sat)
        f = 1.0 + v * w
        lum2 = luminance(out)[..., None]
        out = lum2 + (out - lum2) * f[..., None]
    return out


_BAND_HUES = np.array([0.0, 60.0, 120.0, 180.0, 240.0, 300.0])  # R Y G C B M


def _rgb_to_hsl_hue_sat(disp):
    mx = disp.max(-1)
    mn = disp.min(-1)
    c = mx - mn
    hue = np.zeros_like(mx)
    safe = c > 1e-6
    r, g, b = disp[..., 0], disp[..., 1], disp[..., 2]
    m = safe & (mx == r)
    hue[m] = (60.0 * ((g - b) / np.maximum(c, 1e-6)) % 360.0)[m]
    m = safe & (mx == g)
    hue[m] = (60.0 * ((b - r) / np.maximum(c, 1e-6)) + 120.0)[m]
    m = safe & (mx == b)
    hue[m] = (60.0 * ((r - g) / np.maximum(c, 1e-6)) + 240.0)[m]
    sat = np.where(mx > 1e-6, c / np.maximum(mx, 1e-6), 0.0)
    return hue, sat


def apply_band_mixer(disp, band_sat, band_lum):
    if not any(band_sat) and not any(band_lum):
        return disp
    hue, sat = _rgb_to_hsl_hue_sat(disp)
    lum = luminance(disp)
    sat_adj = np.zeros_like(hue)
    lum_adj = np.zeros_like(hue)
    for i, h0 in enumerate(_BAND_HUES):
        d = np.abs(((hue - h0 + 180.0) % 360.0) - 180.0)
        w = np.clip(1.0 - d / 60.0, 0.0, 1.0)
        w = w * w * (3 - 2 * w)
        sat_adj += w * (band_sat[i] / 100.0)
        lum_adj += w * (band_lum[i] / 100.0)
    # weight by pixel saturation so greys are untouched
    sat_adj *= sat
    lum_adj *= sat
    l3 = lum[..., None]
    out = l3 + (disp - l3) * (1.0 + sat_adj)[..., None]
    out = out * (2.0 ** (lum_adj * 0.8))[..., None]
    return out


def _hue_to_rgb(hue_deg):
    h = (hue_deg % 360.0) / 60.0
    c = 1.0
    x = c * (1.0 - abs(h % 2 - 1.0))
    table = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)]
    return np.array(table[int(h) % 6], dtype=np.float32)


def apply_split_tone(disp, sh_hue, sh_sat, hi_hue, hi_sat, balance):
    if sh_sat <= 0 and hi_sat <= 0:
        return disp
    lum = luminance(disp)
    bal = balance / 100.0 * 0.25
    w_hi = _smoothstep(0.35 - bal, 0.95 - bal, lum)
    w_sh = 1.0 - _smoothstep(0.05 - bal, 0.65 - bal, lum)
    c_sh = _hue_to_rgb(sh_hue) * (sh_sat / 100.0)
    c_hi = _hue_to_rgb(hi_hue) * (hi_sat / 100.0)
    out = disp.copy()
    for c in range(3):
        add = w_sh * c_sh[c] * 0.35 + w_hi * c_hi[c] * 0.35
        out[..., c] = out[..., c] + add * (1.0 - out[..., c])  # screen-ish
    # renormalise luminance so tints do not brighten the frame
    l0 = np.maximum(lum, 1e-4)
    l1 = np.maximum(luminance(out), 1e-4)
    return out * (l0 / l1)[..., None]


def apply_diffusion(disp, softness, sigma_frac=0.02):
    if softness <= 0:
        return disp
    s = softness / 100.0
    h = disp.shape[0]
    blur = gaussian_blur(disp, max(2.0, h * sigma_frac * (0.5 + s)))
    screened = 1.0 - (1.0 - np.clip(disp, 0, 1)) * (1.0 - np.clip(blur, 0, 1) * 0.7 * s)
    out = disp + (screened - disp) * 0.6
    # slight overall softening
    soft = gaussian_blur(disp, 1.0 + 2.0 * s)
    return out + (soft - out) * (0.25 * s)


def _bright_pass(disp, threshold01, knee=0.1):
    lum = luminance(np.clip(disp, 0, None))
    w = _smoothstep(threshold01 - knee, threshold01 + knee, lum)
    return disp * w[..., None]


def apply_glow(disp, amount, threshold, radius_px):
    if amount <= 0:
        return disp
    a = amount / 100.0
    bp = _bright_pass(disp, threshold / 100.0)
    blur = gaussian_blur(bp, radius_px * 0.25)
    blur += gaussian_blur(bp, radius_px * 0.6) * 0.6
    add = np.clip(blur * a * 0.9, 0, None)
    return 1.0 - (1.0 - np.clip(disp, 0, 1)) * (1.0 - np.clip(add, 0, 1))


def apply_halation(disp, amount, threshold, radius_px, hue_deg):
    """Film halation: highlights bleed through the emulsion and reflect off
    the base, exposing the red-sensitive layer -> warm fringes around bright
    areas."""
    if amount <= 0:
        return disp
    a = amount / 100.0
    tint = _hue_to_rgb(hue_deg)
    tint = tint / max(tint.max(), 1e-6)
    tint = tint * np.array([1.0, 0.55, 0.25]) + np.array([0.0, 0.05, 0.0])
    bp = _bright_pass(disp, threshold / 100.0, knee=0.15)
    lum_bp = luminance(bp)[..., None]
    blur = gaussian_blur(lum_bp, radius_px * 0.5)
    blur += gaussian_blur(lum_bp, radius_px * 1.1) * 0.5
    add = blur * tint.reshape(1, 1, 3) * a * 0.55
    return 1.0 - (1.0 - np.clip(disp, 0, 1)) * (1.0 - np.clip(add, 0, 1))


def apply_chromatic_aberration(disp, amount):
    """Radial CA: scale red outward, blue inward. amount ~ pixels of shift at
    the corners per 100 units."""
    if amount <= 0:
        return disp
    h, w = disp.shape[:2]
    max_shift = amount / 100.0 * 3.0  # px at corner
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    nx = (xx - cx) / max(cx, 1)
    ny = (yy - cy) / max(cy, 1)
    r2 = nx * nx + ny * ny

    def sample(channel, scale):
        sx = cx + (xx - cx) * scale
        sy = cy + (yy - cy) * scale
        x0 = np.clip(sx.astype(np.int32), 0, w - 1)
        y0 = np.clip(sy.astype(np.int32), 0, h - 1)
        x1 = np.clip(x0 + 1, 0, w - 1)
        y1 = np.clip(y0 + 1, 0, h - 1)
        fx = np.clip(sx - x0, 0, 1)
        fy = np.clip(sy - y0, 0, 1)
        c = channel
        v = (c[y0, x0] * (1 - fx) + c[y0, x1] * fx) * (1 - fy) \
            + (c[y1, x0] * (1 - fx) + c[y1, x1] * fx) * fy
        return v

    diag = math.hypot(cx, cy)
    s_r = 1.0 - max_shift / diag
    s_b = 1.0 + max_shift / diag
    out = disp.copy()
    out[..., 0] = sample(disp[..., 0], s_r) * r2 + disp[..., 0] * (1 - r2)
    out[..., 2] = sample(disp[..., 2], s_b) * r2 + disp[..., 2] * (1 - r2)
    return out


def apply_vignette(disp, amount, size, feather, roundness):
    if amount == 0:
        return disp
    h, w = disp.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx / (w - 1) - 0.5) * 2.0
    ny = (yy / (h - 1) - 0.5) * 2.0
    aspect = w / h
    rnd = roundness / 100.0
    ax = 1.0 + (aspect - 1.0) * (1.0 - rnd) * 0.0  # keep framing natural
    nx = nx * (1.0 + (1.0 - rnd) * 0.15)
    r = np.sqrt(nx * nx + ny * ny)
    inner = size / 100.0 * 1.2
    feath = max(feather / 100.0, 0.01) * 1.2
    mask = _smoothstep(inner, inner + feath, r)
    g = 1.0 - mask * (amount / 100.0)
    return disp * g[..., None]


def apply_gate_weave(disp, weave, frame):
    """Sub-pixel frame wobble. weave in [0,100] -> up to ~1.5 px drift."""
    if weave <= 0:
        return disp
    amp = weave / 100.0 * 1.5
    dx = (math.sin(frame * 0.61 + _hash01(frame, 11) * 6.28) * 0.7
          + (_hash01(frame, 12) - 0.5) * 0.6) * amp
    dy = (math.sin(frame * 0.83 + _hash01(frame, 13) * 6.28) * 0.7
          + (_hash01(frame, 14) - 0.5) * 0.6) * amp
    h, w = disp.shape[:2]
    ix, fx = int(math.floor(dx)), dx - math.floor(dx)
    iy, fy = int(math.floor(dy)), dy - math.floor(dy)

    def shift(img, sx, sy):
        return np.roll(np.roll(img, sy, axis=0), sx, axis=1)

    a = shift(disp, ix, iy)
    b = shift(disp, ix + 1, iy)
    c = shift(disp, ix, iy + 1)
    d = shift(disp, ix + 1, iy + 1)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def apply_grain(disp, amount, size, chroma, response, frame):
    if amount <= 0:
        return disp
    h, w = disp.shape[:2]
    a = amount / 100.0 * 0.14
    n_lum = _noise_image(h, w, 1000 + frame, 1)
    n_c = _noise_image(h, w, 5000 + frame, 3)
    if size > 0.55:
        sig = (size - 0.5) * 1.6
        n_lum = gaussian_blur(n_lum, sig)
        n_c = gaussian_blur(n_c, sig)
        # renormalise variance after blur
        n_lum /= max(n_lum.std(), 1e-6)
        n_c /= max(n_c.std(), 1e-6)
    lum = np.clip(luminance(disp), 0, 1)
    resp = response / 100.0
    # film grain is strongest in mids, weaker in deep shadow and highlight
    weight = (4.0 * lum * (1.0 - lum)) ** (0.5 + resp)
    noise = n_lum * (1.0 - chroma / 100.0) + n_c * (chroma / 100.0)
    return disp + noise * (a * weight)[..., None]


# ---------------------------------------------------------------------------
# full pipeline

def grade(img_srgb, params, frame=0, auto_exposure=False, ae_target_ev=0.0,
          ae_adapt=1.0, ae_highlight_protect=0.35, ae_precomputed_gain=None):
    """img_srgb: float32 (H,W,3) in [0,1]. Returns graded float32 in [0,1]."""
    p = params
    lin = srgb_to_linear(img_srgb.astype(np.float32))

    flicker = p.get("flicker", 0.0)
    if flicker > 0:
        lin = lin * (1.0 + (_hash01(frame, 77) - 0.5) * 2.0 * flicker / 100.0 * 0.06)

    if auto_exposure:
        gain = (ae_precomputed_gain if ae_precomputed_gain is not None
                else auto_exposure_gain(lin, ae_target_ev, ae_adapt,
                                        highlight_protect=ae_highlight_protect))
        lin = lin * gain

    lin = lin * (2.0 ** p["exposure"])
    lin = apply_white_balance(lin, p["temperature"], p["tint"])
    lin = apply_contrast(lin, p["contrast"], p["pivot"])
    lin = apply_tonal_ranges(lin, p["shadows"], p["highlights"],
                             p["whites"], p["blacks"])
    lin = filmic_tonemap(lin, p["filmic_amount"] / 100.0, p["toe"],
                         p["shoulder"], p["white_point"])

    disp = linear_to_srgb(lin)
    disp = apply_lgg(disp, p["lift"], p["gamma"], p["gain"])
    disp = apply_sat_vibrance(disp, p["saturation"], p["vibrance"])
    disp = apply_band_mixer(disp, p["band_sat"], p["band_lum"])
    disp = apply_split_tone(disp, p["split_shadow_hue"], p["split_shadow_sat"],
                            p["split_highlight_hue"], p["split_highlight_sat"],
                            p["split_balance"])
    disp = apply_diffusion(disp, p["softness"])
    h = disp.shape[0]
    px = h / 720.0  # radii are calibrated at 720p and scale with resolution
    disp = apply_glow(disp, p["glow_amount"], p["glow_threshold"],
                      p["glow_radius"] * px)
    disp = apply_halation(disp, p["halation_amount"], p["halation_threshold"],
                          p["halation_radius"] * px, p["halation_hue"])
    disp = apply_chromatic_aberration(disp, p["ca_amount"])
    disp = apply_vignette(disp, p["vignette_amount"], p["vignette_size"],
                          p["vignette_feather"], p["vignette_roundness"])
    disp = apply_gate_weave(disp, p["gate_weave"], frame)
    disp = apply_grain(disp, p["grain_amount"], p["grain_size"],
                       p["grain_chroma"], p["grain_response"], frame)
    return np.clip(disp, 0.0, 1.0)
