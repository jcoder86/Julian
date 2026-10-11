"""
Build a map's drifting cloud layers from generated green-screen strips.

The game scrolls two transparent cloud layers across the sky, a slow far
one and a faster near one. A layer is a long picture that repeats; if it
is short and its clouds look alike, the sky reads as wallpaper. So each
layer here is three DIFFERENT strips laid end to end -- wider than the
screen, so no cloud is ever on screen twice.

    assets/raw/clouds-sea-front-1..3.png  ->  assets/clean/clouds-sea-front.png
    assets/raw/clouds-sea-back-1..3.png   ->  assets/clean/clouds-sea-back.png

What happens to a strip
  * The green screen becomes transparency. A cloud's edge is a soft mix
    of cloud and screen: how green a pixel is tells how much screen is in
    it, and the cloud's own colour is recovered from the rest ("un-mixing").
    A plain colour key would leave a dark, greyish rim around every cloud.
  * Loose specks are dropped, and the left and right ends are checked to
    be empty, so the strips join without a seam.
  * Vertical position: the layer picture spans the whole sky, from the top
    of the painting down to the horizon. Near clouds keep their place high
    in the sky; far clouds are moved so their flat bases all hover just
    above the horizon.

Usage (from the project root):
    python scripts/make_clouds.py                    # both sea layers
    python scripts/make_clouds.py clouds-sea-back    # just one

The strips come from `python scripts/gen_art.py clouds-sea-front-1 ...`;
src/data/maps.js says which layers a map shows, how fast and how opaque.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
CLEAN = ROOT / "assets" / "clean"

STRIP_HEIGHT = 724        # every strip is brought to this height first
OUT_HEIGHT = 360          # height of the finished layer picture, px
EDGE_CLEAR_PX = 12        # columns at each end of a strip that must be empty
MIN_SPECK_AREA = 40       # loose bits smaller than this (px) are dropped

# layer -> its strips, and where the clouds go inside the sky:
#   keep    use only this top share of each strip (the rest is empty) and
#           stretch it over the whole sky -- makes the clouds bigger
#   bases   move each strip so its lowest cloud base sits at this share of
#           the sky's height (1.0 = on the horizon)
LAYERS = {
    "clouds-sea-front": dict(
        strips=["clouds-sea-front-1", "clouds-sea-front-2", "clouds-sea-front-3"],
        keep=0.85),
    "clouds-sea-back": dict(
        strips=["clouds-sea-back-1", "clouds-sea-back-2", "clouds-sea-back-3"],
        bases=0.955),
}


def unmix(path):
    """Green-screen strip -> float RGBA array (0..255), straight alpha."""
    img = Image.open(path).convert("RGB")
    if img.height != STRIP_HEIGHT:
        width = round(img.width * STRIP_HEIGHT / img.height)
        img = img.resize((width, STRIP_HEIGHT), Image.LANCZOS)
    rgb = np.asarray(img).astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    other = np.maximum(r, b)
    excess = g - other                                   # how green
    # The screen is whatever the image's outer border looks like.
    border = np.concatenate([excess[:8].ravel(), excess[-8:].ravel(),
                             excess[:, :8].ravel(), excess[:, -8:].ravel()])
    screen = float(np.median(border))
    if screen < 120:
        sys.exit(f"{path.name}: the border is not green screen")
    # 1 = all cloud, 0 = all screen. A little head-room on the screen side
    # swallows the screen's own unevenness.
    alpha = np.clip(1.0 - excess / (screen * 0.90), 0.0, 1.0)
    alpha[alpha < 0.04] = 0.0

    # Drop loose specks.
    labels, n = ndimage.label(alpha > 0.10)
    if n:
        areas = ndimage.sum(np.ones_like(alpha), labels, index=np.arange(1, n + 1))
        keep = np.concatenate([[False], areas >= MIN_SPECK_AREA])
        alpha = np.where(ndimage.binary_dilation(keep[labels], iterations=6), alpha, 0.0)

    # Recover the cloud's own colour: the pixel is cloud*alpha + screen*(1-alpha),
    # and the screen adds nothing to red and blue.
    safe = np.maximum(alpha, 0.05)
    colour = np.stack([r, np.minimum(g, other), b], axis=-1) / safe[..., None]
    colour = np.clip(colour, 0, 255)
    # Thin wisps come out of the un-mixing slightly tinted. A wisp is white
    # vapour: the more see-through a pixel, the more it is pulled to the
    # neutral grey of its own brightness.
    neutral = colour.max(axis=-1, keepdims=True)
    colour = neutral + (colour - neutral) * alpha[..., None]
    return np.concatenate([colour, alpha[..., None] * 255.0], axis=-1)


def clear_ends(rgba, name):
    """Make sure nothing touches the strip's ends (they join end to end)."""
    alpha = rgba[..., 3]
    touching = max(alpha[:, :EDGE_CLEAR_PX].max(), alpha[:, -EDGE_CLEAR_PX:].max())
    if touching > 8:
        print(f"[warn] {name}: a cloud reaches the end of the strip; fading it out")
        ramp = np.clip(np.arange(rgba.shape[1]) / 60.0, 0, 1)
        alpha *= np.minimum(ramp, ramp[::-1])[None, :]
    return rgba


def place(rgba, keep=None, bases=None):
    """Position a strip's clouds inside the sky (see LAYERS)."""
    height = rgba.shape[0]
    rows = np.nonzero(rgba[..., 3].max(axis=1) > 24)[0]
    if keep is not None:
        cut = round(height * keep)
        if rows.size and rows.max() >= cut:
            cut = min(height, int(rows.max()) + 8)      # never slice a cloud
        return rgba[:cut]
    target = round(height * bases)
    shift = target - int(rows.max())
    out = np.zeros_like(rgba)
    if shift >= 0:
        out[shift:] = rgba[:height - shift]
    else:
        out[:height + shift] = rgba[-shift:]
    return out


def to_image(rgba):
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")


def resize(img, size):
    """Resize with premultiplied alpha, so edges do not pick up a dark rim."""
    return img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def build(layer):
    spec = LAYERS[layer]
    parts = []
    for stem in spec["strips"]:
        src = RAW / f"{stem}.png"
        if not src.exists():
            sys.exit(f"missing {src.relative_to(ROOT)}  (python scripts/gen_art.py {stem})")
        rgba = clear_ends(unmix(src), stem)
        strip = to_image(place(rgba, keep=spec.get("keep"), bases=spec.get("bases")))
        width = round(strip.width * OUT_HEIGHT / strip.height)
        parts.append(resize(strip, (width, OUT_HEIGHT)))
    sheet = Image.new("RGBA", (sum(p.width for p in parts), OUT_HEIGHT), (255, 255, 255, 0))
    x = 0
    for part in parts:
        sheet.paste(part, (x, 0))
        x += part.width
    out = CLEAN / f"{layer}.png"
    sheet.save(out, "PNG", optimize=True)
    print(f"[ok]   {out.relative_to(ROOT)}  {sheet.width}x{sheet.height}  "
          f"{out.stat().st_size // 1024} kB")


def main():
    names = sys.argv[1:] or list(LAYERS)
    unknown = [n for n in names if n not in LAYERS]
    if unknown:
        sys.exit(f"unknown layer(s): {', '.join(unknown)}  (known: {', '.join(LAYERS)})")
    for name in names:
        build(name)


if __name__ == "__main__":
    main()
