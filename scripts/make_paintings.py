"""
Turn the generated full-screen paintings into the files the game loads.

The image model delivers a ~3 MB PNG per painting (assets/raw/). The game
needs none of that weight: a painting has no transparency, so a good JPEG
looks the same on screen at a tenth of the size -- which is what gets
downloaded (and kept for offline play) on Julian's iPad.

    assets/raw/<name>.png  ->  assets/clean/<name>.jpg   (1440x1080, 4:3)

Usage (from the project root):
    python scripts/make_paintings.py                 # all of them
    python scripts/make_paintings.py backdrop-sea    # just one

raw/catch.png and raw/catch-sea.png (one boy, no friends yet) are no longer
shown; they are the layout the new catch screens were painted from.
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
CLEAN = ROOT / "assets" / "clean"

SIZE = (1440, 1080)
QUALITY = 90

# name -> what it is (the file names are what src/data/maps.js and
# MapSelectScene point at).
PAINTINGS = {
    "backdrop-naarden": "the moat of Naarden-Vesting (map 'lake')",
    "backdrop-france":  "the mountain lake in France, from the pontoon (map 'france')",
    "backdrop-sea":     "the sea from the stone harbour pier (map 'sea')",
    "mapselect":        "the wall behind the 'where shall we fish?' screen",
    "ui-wall":          "the bare cabin wall behind the fish collection",
    "start-friends":    "the title screen: the three friends and the dog",
    # The catch screen, per team (save profile) and map:
    "catch-julian-lake": "Julian and Dirk on the jetty",
    "catch-julian-sea":  "Julian and Dirk on the stone quay",
    "catch-guest-lake":  "James and Boaz on the jetty",
    "catch-guest-sea":   "James and Boaz on the stone quay",
    "catch-julian-france": "Julian and Dirk on the pontoon",
    "catch-guest-france":  "James and Boaz on the pontoon",
    "backdrop-greece":  "a rocky coast in Greece, from a limestone ledge (map 'greece')",
    "catch-julian-greece": "Julian and Dirk on the rocks",
    "catch-guest-greece":  "James and Boaz on the rocks",
}


def convert(name):
    src = RAW / f"{name}.png"
    if not src.exists():
        print(f"[skip] {src.relative_to(ROOT)} not found")
        return False
    img = Image.open(src).convert("RGB")
    ratio = img.width / img.height
    if abs(ratio - SIZE[0] / SIZE[1]) > 0.01:
        sys.exit(f"{src.name} is {img.width}x{img.height}: not a 4:3 painting")
    out = CLEAN / f"{name}.jpg"
    img.resize(SIZE, Image.LANCZOS).save(
        out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    print(f"[ok]   {out.relative_to(ROOT)}  {out.stat().st_size // 1024} kB  "
          f"(from {src.stat().st_size // 1024} kB)")
    return True


def main():
    names = sys.argv[1:] or list(PAINTINGS)
    unknown = [n for n in names if n not in PAINTINGS]
    if unknown:
        sys.exit(f"unknown painting(s): {', '.join(unknown)}  (known: {', '.join(PAINTINGS)})")
    for name in names:
        convert(name)


if __name__ == "__main__":
    main()
