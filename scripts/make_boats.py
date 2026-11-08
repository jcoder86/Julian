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
  3. a square piece of every boat's painting, its stern and deck, for the
     boat button and the boat menu  -> assets/clean/boat_<id>_icon.jpg

After this, per boat (in a terminal in the Julian folder):
    python scripts/make_paintings.py backdrop-ocean-<id>
    python scripts/make_water.py ocean --compose --painting backdrop-ocean-<id>
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

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
# Above this line (design coordinates) the picture is the first painting's
# sea: just above the rail, and up the two sides of the boat at the edges.
SEA_EDGE = [(0, 410), (50, 432), (1235, 432), (1280, 410)]
FEATHER_PX = 1.5
# The icon: this square of the painting (design x, y), this many px.
ICON_BOX = (330, 230, 950, 850)
ICON_SIZE = 320


def design_to_px(x, y, size):
    k = size[0] / 1280
    return (x * k, (y + 120) * k)


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
    # 2. The sea of the first painting above the rail.
    mask = Image.new("L", size, 0)
    sea = [design_to_px(x, y, size) for x, y in SEA_EDGE]
    ImageDraw.Draw(mask).polygon([(0, 0), (size[0], 0), (size[0], sea[-1][1])] + sea[::-1] + [(0, sea[0][1])], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(FEATHER_PX * k))
    out = Image.composite(base, aligned, mask)
    path = RAW / f"{BASE}-{boat}.png"
    out.save(path, "PNG", optimize=True)
    print(f"[ok]   {path.relative_to(ROOT)}  (rail moved {RAIL[boat] - RAIL['sportvis']:+.1f} px)")
    return out


def icon(boat, painting):
    k = painting.size[0] / 1280
    x0, y0, x1, y1 = ICON_BOX
    box = (round(x0 * k), round((y0 + 120) * k), round(x1 * k), round((y1 + 120) * k))
    out = CLEAN / f"boat_{boat}_icon.jpg"
    painting.crop(box).resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS).save(out, "JPEG", quality=88)
    print(f"[ok]   {out.relative_to(ROOT)}")


def main():
    boats = sys.argv[1:] or list(RAIL)
    for boat in boats:
        if boat not in RAIL:
            sys.exit(f"unknown boat {boat} (known: {', '.join(RAIL)})")
        painting = (Image.open(RAW / f"{BASE}.png").convert("RGB") if boat == "sportvis"
                    else compose(boat))
        icon(boat, painting)


if __name__ == "__main__":
    main()
