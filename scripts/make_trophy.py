"""
The pieces of the weighing station of the big ocean (src/scenes/TrophyScene.js).

    python scripts/make_trophy.py

A catch on the ocean is hung from a scale in the harbour, and the children
stand beside it at their REAL height (data/teams.js `trophy`), so the
length of a shark is something you can see. For that the game must know,
for each figure, where his head is and where his feet are, and, for the
scale, where its dial is and where its hook ends.

Input (assets/raw/, from scripts/gen_art.py):
    ui-scale.png              the hanging scale, on green
    char-julian-stand.png     Julian standing, pointing up at his catch
    char-james-stand.png      James, the same
    char-boaz-point.png       Boaz pointing (one of his own poses)
    char-dirk.png             Dirk, sitting

Output (assets/clean/):
    ui-scale.png, trophy_<who>.png    the cut-outs
    trophy.json                       where things are in them:
        scale:   w, h; the dial's centre and radius (cx, cy, r); the tip of
                 the hook (hookX, hookY)
        figures: per figure w, h and headY -- the top of his head. (A boy
                 who points up has his hand above his head: the top of the
                 picture is not the top of the boy. His head is found in the
                 middle of his body, where his legs are.)
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chroma import key_green      # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
CLEAN = ROOT / "assets" / "clean"

FIGURES = {
    "julian": "char-julian-stand",
    "james": "char-james-stand",
    "boaz": "char-boaz-point",
    "dirk": "char-dirk",
}
FIGURE_HEIGHT = 720       # px the figures are stored at (head to feet, about)
SCALE_HEIGHT = 560        # px the scale is stored at
# The head is looked for in this share of the figure's width around the
# middle of its legs.
HEAD_BAND = 0.16


def keyed(name):
    rgb = np.asarray(Image.open(RAW / f"{name}.png").convert("RGB"))
    return np.clip(key_green(rgb), 0, 255).astype(np.uint8)


def crop(rgba, height):
    """Cropped to the figure, scaled so that it is `height` px tall."""
    img = Image.fromarray(rgba, "RGBA")
    box = img.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    img = img.crop(box)
    k = height / img.height
    return img.convert("RGBa").resize((round(img.width * k), height), Image.LANCZOS).convert("RGBA")


def figure(who, src):
    img = crop(keyed(src), FIGURE_HEIGHT)
    alpha = np.asarray(img.getchannel("A")) > 128
    body = ndimage.binary_opening(alpha, iterations=4)
    rows = np.nonzero(body.any(axis=1))[0]
    # The legs: the lowest fifth of the body; their middle is the middle of him.
    low = body[rows.max() - (rows.max() - rows.min()) // 5:rows.max()]
    xs = np.nonzero(low.any(axis=0))[0]
    mid = (xs.min() + xs.max()) / 2
    half = img.width * HEAD_BAND
    band = body[:, max(0, int(mid - half)):min(img.width, int(mid + half))]
    head_y = int(np.nonzero(band.any(axis=1))[0].min())
    out = CLEAN / f"trophy_{who}.png"
    img.save(out, "PNG", optimize=True)
    print(f"[ok]   {out.name}  {img.width}x{img.height}  head at y {head_y}")
    return dict(file=out.name, w=img.width, h=img.height, headY=head_y)


def scale():
    img = crop(keyed("ui-scale"), SCALE_HEIGHT)
    arr = np.asarray(img).astype(np.int16)
    r, g, b, a = (arr[..., i] for i in range(4))
    # The dial: the big cream-white round face.
    face = (a > 200) & (r > 190) & (g > 180) & (b > 140) & (r - b < 70)
    face = ndimage.binary_closing(face, iterations=6)
    labels, n = ndimage.label(face)
    sizes = ndimage.sum(face, labels, index=range(1, n + 1))
    main = labels == (int(np.argmax(sizes)) + 1)
    ys, xs = np.nonzero(main)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    radius = ((xs.max() - xs.min()) + (ys.max() - ys.min())) / 4
    # The hook: the lowest solid point.
    solid = a > 128
    hy = int(np.nonzero(solid.any(axis=1))[0].max())
    hx = float(np.nonzero(solid[hy - 6:hy + 1].any(axis=0))[0].mean())
    out = CLEAN / "ui-scale.png"
    img.save(out, "PNG", optimize=True)
    print(f"[ok]   {out.name}  {img.width}x{img.height}  dial at ({cx:.0f}, {cy:.0f}) r {radius:.0f}, hook at ({hx:.0f}, {hy})")
    return dict(file=out.name, w=img.width, h=img.height, cx=round(cx), cy=round(cy),
                r=round(radius), hookX=round(hx), hookY=hy)


def main():
    meta = dict(scale=scale(), figures={who: figure(who, src) for who, src in FIGURES.items()})
    out = CLEAN / "trophy.json"
    out.write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    print(f"[ok]   {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
