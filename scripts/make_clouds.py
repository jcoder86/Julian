"""
A map's drifting clouds, painted into its own sky.

The game scrolls two transparent cloud layers across each map's sky, a
slow far one and a faster near one. To make them belong in the painting
they are not painted on a green screen and pasted in, but painted INTO
that painting's sky:

  1. PLATE    `python scripts/make_clouds.py plates` reads how the sky of
              each map's painting runs from top to bottom and writes it as
              an empty sky, three times as wide as it is high:
              assets/raw/sky-plate-<map>.png
  2. PAINT    `python scripts/gen_art.py clouds-<map>-<layer>-<n>` has the
              image model paint clouds into that plate, in the style and
              the light of the map's painting (scripts/art_prompts.py).
              Two different strips per layer.
  3. LIFT     `python scripts/make_clouds.py` lifts the clouds off their
              sky again. The sky is a blue screen of sorts: how much less
              blue a pixel is than the clear sky on its row tells how much
              cloud is in it, and the cloud's own colour is what remains
              when the sky's share is taken out. A wisp stays a wisp --
              half sky, half cloud -- instead of getting a hard edge.
              The strips are laid end to end (wider than the screen, so no
              cloud is on screen twice) and saved as
              assets/clean/clouds-<map>-<layer>.png

Because a sky only changes from top to bottom and the clouds only drift
sideways, a lifted cloud always sits on the same blue it was painted on:
in the game it looks exactly as the model painted it.

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

PLATE_SIZE = (2172, 724)      # what the image model returns for a 3:1 picture
STRIPS_PER_LAYER = 2
LAYERS = ("back", "front")
OUT_HEIGHT = 440              # px; two strips make a picture 2640 px wide
EDGE_FADE_PX = 90             # clouds fade out toward a strip's ends, so strips join
MIN_ALPHA = 0.07              # below this it is the sky's own unevenness

# map id -> its painting, the sky mask made from it, and how far down the
# painting the sky reaches (the plate covers that share of its height; the
# same share is the layers' `height` in src/data/maps.js).
SKIES = {
    "lake": dict(painting="backdrop-naarden", mask="sky-mask-naarden", bottom=0.28),
    "sea":  dict(painting="backdrop-sea", mask="sky-mask-sea", bottom=0.245),
    "france": dict(painting="backdrop-france", mask="sky-mask-france", bottom=0.28),
}
SKY_MASK_FRACTION = 320 / 720     # the masks cover this share of a painting's height

LUMA = np.array([0.299, 0.587, 0.114], dtype=np.float32)


def sky_gradient(map_id):
    """The painting's clear-sky colour per plate row (PLATE height x 3)."""
    spec = SKIES[map_id]
    paint = np.asarray(Image.open(RAW / f"{spec['painting']}.png").convert("RGB")).astype(np.float32)
    height, width, _ = paint.shape
    mask = Image.open(CLEAN / f"{spec['mask']}.png").getchannel("A")
    mask = np.asarray(mask.resize((width, round(height * SKY_MASK_FRACTION)), Image.LANCZOS)) > 200
    bottom = round(height * spec["bottom"])
    ys, colours = [], []
    for y in range(min(bottom, mask.shape[0])):
        if mask[y].sum() > width * 0.05:
            ys.append(y)
            colours.append(np.median(paint[y][mask[y]], axis=0))
    ys, colours = np.array(ys), np.array(colours)
    # A smooth curve through the rows that have sky, continued down to the
    # plate's bottom (behind the tree tops there is no sky to measure).
    rows = np.linspace(0, bottom - 1, PLATE_SIZE[1])
    gradient = np.stack([np.polyval(np.polyfit(ys, colours[:, ch], 3), np.minimum(rows, ys.max()))
                         for ch in range(3)], axis=1)
    return np.clip(gradient, 0, 255).astype(np.float32)


def make_plates():
    for map_id in SKIES:
        gradient = sky_gradient(map_id)
        plate = np.repeat(gradient[:, None, :], PLATE_SIZE[0], axis=1)
        out = RAW / f"sky-plate-{map_id}.png"
        Image.fromarray(plate.astype(np.uint8), "RGB").save(out, optimize=True)
        print(f"[ok]   {out.relative_to(ROOT)}  top {gradient[0].round().astype(int).tolist()}"
              f"  bottom {gradient[-1].round().astype(int).tolist()}")


def lift(path, plate_gradient):
    """A strip of painted sky -> the clouds alone (float RGBA, 0..255)."""
    img = Image.open(path).convert("RGB")
    if img.size != PLATE_SIZE:
        img = img.resize(PLATE_SIZE, Image.LANCZOS)
    rgb = np.asarray(img).astype(np.float32)

    # The model never returns the plate's colours exactly. Find what clear
    # sky looks like in ITS picture: per row, the bluest pixels -- and tie
    # that to the plate with one straight-line fit per channel, so rows that
    # are all cloud get a sensible sky too.
    blue = rgb[..., 2] - rgb[..., 0]
    clear = blue >= np.percentile(blue, 80, axis=1, keepdims=True) - 4
    measured = np.array([np.median(rgb[y][clear[y]], axis=0) for y in range(rgb.shape[0])])
    sky = np.empty_like(measured)
    plate_blue = np.maximum(plate_gradient[:, 2] - plate_gradient[:, 0], 12.0)
    weight = np.clip((measured[:, 2] - measured[:, 0]) / plate_blue, 0.05, 1.0) ** 4
    for ch in range(3):
        slope, offset = np.polyfit(plate_gradient[:, ch], measured[:, ch], 1, w=weight)
        fitted = slope * plate_gradient[:, ch] + offset
        # follow the picture where it is clearly sky, the fit elsewhere
        sky[:, ch] = ndimage.gaussian_filter1d(np.minimum(measured[:, ch], fitted + 6), 6)
    sky = sky[:, None, :]

    sky_blue = np.maximum(sky[..., 2] - sky[..., 0], 12.0)
    by_colour = 1.0 - blue / sky_blue                         # less blue than the sky
    sky_luma = sky @ LUMA
    by_light = (rgb @ LUMA - sky_luma) / np.maximum(248.0 - sky_luma, 12.0)   # lighter than the sky
    alpha = np.clip(np.maximum(by_colour, by_light), 0.0, 1.0)
    alpha = np.clip((alpha - MIN_ALPHA) / (1.0 - MIN_ALPHA), 0.0, 1.0)

    # Take the sky's share out of the colour; what is left is the cloud.
    safe = np.maximum(alpha, 0.12)[..., None]
    colour = np.clip((rgb - (1.0 - alpha[..., None]) * sky) / safe, 0, 255)

    ramp = np.clip(np.arange(PLATE_SIZE[0]) / EDGE_FADE_PX, 0.0, 1.0)
    alpha = alpha * np.minimum(ramp, ramp[::-1])[None, :]
    return np.concatenate([colour, alpha[..., None] * 255.0], axis=-1)


def build(map_id, layer):
    gradient = sky_gradient(map_id)
    parts = []
    for n in range(1, STRIPS_PER_LAYER + 1):
        src = RAW / f"clouds-{map_id}-{layer}-{n}.png"
        if not src.exists():
            sys.exit(f"missing {src.relative_to(ROOT)}  (python scripts/gen_art.py {src.stem})")
        strip = Image.fromarray(np.clip(lift(src, gradient), 0, 255).astype(np.uint8), "RGBA")
        width = round(strip.width * OUT_HEIGHT / strip.height)
        # premultiplied while resizing, so edges do not pick up a dark rim
        parts.append(strip.convert("RGBa").resize((width, OUT_HEIGHT), Image.LANCZOS).convert("RGBA"))
    sheet = Image.new("RGBA", (sum(p.width for p in parts), OUT_HEIGHT), (255, 255, 255, 0))
    x = 0
    for part in parts:
        sheet.paste(part, (x, 0))
        x += part.width
    out = CLEAN / f"clouds-{map_id}-{layer}.png"
    sheet.save(out, "PNG", optimize=True)
    cover = (np.asarray(sheet.getchannel("A")) > 40).mean()
    print(f"[ok]   {out.relative_to(ROOT)}  {sheet.width}x{sheet.height}  "
          f"{out.stat().st_size // 1024} kB  clouds cover {cover:.0%}")


def main():
    args = sys.argv[1:]
    if args == ["plates"]:
        make_plates()
        return
    maps = args or list(SKIES)
    if set(maps) - set(SKIES):
        sys.exit(f"unknown map(s): {', '.join(sorted(set(maps) - set(SKIES)))}  "
                 f"(known: {', '.join(SKIES)}; or: plates)")
    for map_id in maps:
        for layer in LAYERS:
            build(map_id, layer)


if __name__ == "__main__":
    main()
