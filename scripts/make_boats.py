"""
The boats of the big ocean (src/data/boats.js): one painting per boat,
all with the very same sea.

    python scripts/make_boats.py              # all of them
    python scripts/make_boats.py speedboot    # just one

Codex repaints the boat of the first painting (scripts/art_prompts.py,
`boat-<id>` -> assets/raw/boat-ocean-<id>.png). Then, here:

  1. its back rail is lined up with the first boat's: every painting put
     it a few px higher or lower (RAIL, measured on the paintings);
  2. everything above the rail is taken from the first painting -- the
     sea, the wake, the island, the sky -- so that one water film
     (work/veo-ocean.mp4), one fishing area and the places in maps.js fit
     every boat                     -> assets/raw/backdrop-ocean-<id>.png
     (down to the very top of each boat's own rail, RAIL_LINES: the water
     film reaches that line too, so no strip of still sea is left above the
     rail -- make_water.py uses the same lines)
  (The boat button and menu show each WHOLE boat, from outside: Codex's
  `boat-icon-<id>`, made by scripts/make_boat_props.py -- with what stands
  on each boat.)

After this, per boat (in a terminal in the Julian folder):
    python scripts/make_paintings.py backdrop-ocean-<id>
    python scripts/make_water.py ocean --compose --painting backdrop-ocean-<id>
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
CLEAN = ROOT / "assets" / "clean"

BASE = "backdrop-ocean"                 # the first boat: its sea is everyone's
# Design y (0..840 below -120) of the TOP of each painting's back rail.
RAIL = {
    "sportvis": 434.0,
    "vissersboot": 437.5,
    "speedboot": 435.5,
    "piratenschip": 434.0,
}
# The top of each boat's rail, after lining up (design coordinates, from
# the left edge up the side, along the stern, and up the other side): above
# it the sea of the first painting, and the water film. Measured on the
# paintings (November 2026): per column, the first row going down from the
# sea that is warm -- wood and cream fibreglass are red above blue, sea and
# foam are not -- in the corners every 5 px, along the stern the median per
# 100 px; the chrome speedboat by eye. (Its film is the first boat's, whose
# rail lies at or below every other's: under the line the film is sea.)
RAIL_LINES = {
    "sportvis": [(0, 417.5), (5, 419.2), (10, 421.4), (15, 423.6), (20, 425.9), (25, 428.5),
                 (30, 430.7), (35, 433.4), (40, 435.1), (45, 436.9), (50, 437.3), (55, 437.8),
                 (60, 436.9), (70, 436.9), (100, 436.0), (200, 436.0), (300, 435.1), (400, 435.1),
                 (500, 434.3), (600, 434.3), (700, 435.1), (800, 435.1), (900, 434.3), (1000, 435.1),
                 (1100, 436.0), (1210, 436.9), (1220, 436.0), (1230, 436.5), (1235, 435.1),
                 (1240, 433.4), (1245, 430.7), (1250, 429.0), (1255, 427.2), (1260, 425.0),
                 (1265, 422.8), (1270, 420.6), (1275, 417.9), (1280, 417.9)],
    "vissersboot": [(0, 417.5), (5, 420.1), (10, 423.2), (15, 424.5), (20, 426.7), (25, 429.4),
                    (30, 431.6), (35, 431.6), (40, 432.5), (45, 434.3), (50, 435.1), (55, 435.1),
                    (60, 434.3), (100, 434.3), (200, 434.3), (300, 433.4), (400, 434.3), (500, 433.4),
                    (600, 433.4), (700, 434.3), (800, 434.3), (900, 433.4), (1000, 433.4),
                    (1100, 434.3), (1220, 434.3), (1225, 435.1), (1230, 435.5), (1235, 434.3),
                    (1240, 431.6), (1245, 431.6), (1250, 429.8), (1255, 428.5), (1260, 426.3),
                    (1265, 423.6), (1270, 421.4), (1275, 419.7), (1280, 417.9)],
    "piratenschip": [(0, 415.7), (5, 417.5), (10, 420.1), (15, 421.9), (20, 424.5), (25, 427.2),
                     (30, 429.0), (35, 431.6), (40, 433.4), (45, 435.1), (50, 436.0), (70, 436.0),
                     (100, 435.1), (200, 435.1), (300, 434.3), (400, 434.3), (500, 433.4),
                     (600, 433.4), (700, 434.3), (800, 434.3), (900, 433.4), (1000, 434.3),
                     (1100, 435.1), (1210, 436.0), (1225, 436.0), (1230, 435.1), (1235, 434.3),
                     (1240, 431.6), (1245, 429.8), (1250, 428.1), (1255, 425.9), (1260, 423.2),
                     (1265, 421.0), (1270, 419.2), (1275, 416.6), (1280, 414.8)],
    "speedboot": [(0, 418.5), (10, 421.5), (20, 425.0), (30, 428.5), (40, 431.5), (48, 434.0),
                  (1232, 434.0), (1240, 431.5), (1250, 428.5), (1260, 425.0), (1270, 422.0),
                  (1280, 419.0)],
}
# The line is taken this much lower, into the rail: a hair of rail under the
# film (the film is sea there) shows less than a hair of still sea above it.
RAIL_BIAS = 0.4


def design_to_px(x, y, size):
    k = size[0] / 1280
    return (x * k, (y + 120) * k)


def boat_of_painting(painting):
    """'backdrop-ocean' -> 'sportvis', 'backdrop-ocean-speedboot' -> 'speedboot'."""
    return "sportvis" if painting == BASE else painting[len(BASE) + 1:]


def sea_above(boat, size, bias=RAIL_BIAS):
    """
    How much of each pixel of a painting `size` big lies above the top of
    `boat`'s rail (0..1, smooth along the line): the sea, the film.
    """
    width, height = size
    ss = 4                                   # drawn 4x as big, then averaged
    k = width * ss / 1280
    line = [(x * k, (y + bias + 120) * height * ss / 960) for x, y in RAIL_LINES[boat]]
    big = Image.new("L", (width * ss, height * ss), 0)
    ImageDraw.Draw(big).polygon([(0, 0), (width * ss, 0)] + line[::-1], fill=255)
    return np.asarray(big.resize(size, Image.BOX)).astype(np.float32) / 255


def compose(boat):
    base = Image.open(RAW / f"{BASE}.png").convert("RGB")
    size = base.size
    k = size[0] / 1280
    boat_img = Image.open(RAW / f"boat-ocean-{boat}.png").convert("RGB").resize(size, Image.LANCZOS)
    # 1. The rail where the first boat has it: the part below the cut is
    #    taken from a little lower (or higher) and stretched to fit.
    cut = round(design_to_px(0, 432, size)[1])
    shift = round((RAIL[boat] - RAIL["sportvis"]) * k)
    lower = boat_img.crop((0, cut + shift, size[0], size[1])).resize((size[0], size[1] - cut), Image.LANCZOS)
    aligned = boat_img.copy()
    aligned.paste(lower, (0, cut))
    # 2. The sea of the first painting above the rail -- right down to its
    #    top, so that none of this painting's own (still) sea is left there.
    mask = Image.fromarray((sea_above(boat, size) * 255).round().astype(np.uint8))
    out = Image.composite(base, aligned, mask)
    path = RAW / f"{BASE}-{boat}.png"
    out.save(path, "PNG", optimize=True)
    print(f"[ok]   {path.relative_to(ROOT)}  (rail moved {RAIL[boat] - RAIL['sportvis']:+.1f} px)")
    return out


def main():
    boats = sys.argv[1:] or list(RAIL)
    for boat in boats:
        if boat not in RAIL:
            sys.exit(f"unknown boat {boat} (known: {', '.join(RAIL)})")
        if boat != "sportvis":
            compose(boat)


if __name__ == "__main__":
    main()
