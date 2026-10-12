"""
Cut the generated buttons, frames and panels out of their screens.

    assets/raw/ui-<name>.png  ->  assets/clean/ui-<name>.png

    python scripts/make_ui.py            # all of them
    python scripts/make_ui.py ui-card    # just one

Each is keyed (scripts/chroma.py), cropped to what is left and scaled to
the size the game shows it at -- a button a few hundred pixels wide has no
use for 1500. The frame ring keeps its hole: the green inside it goes like
the green around it. scripts/make_characters.py puts faces in that ring
(the badges of the teams on the title screen), so run this first.

The green "go on fishing" button stands on a MAGENTA screen (it is green
itself); the key works out which of the two screens a picture has.

BOARDS. Menus need blank wooden boards in several shapes, in exactly the
wood of the START sign. They are made from that sign: its
left part, up to where the lettering starts, is plain wood with a rounded
end, a rope and two nails. A board is that part plus its own mirror image
-- as wide as the shape asks for:

    assets/clean/ui-board-<shape>.png
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chroma import key_green      # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
CLEAN = ROOT / "assets" / "clean"

# name -> the longest side it is stored at, in px
UI = {
    "ui-ring": 440,        # round rope frame around a face
    "ui-continue": 420,    # the round green "go on fishing" button
    "ui-card": 480,        # a paper card pinned to the wall: a species in the collection
}

# Blank boards cut from the START sign: shape -> (width, height) in px.
# The sizes are 1.5x what the game shows, so they stay crisp on an iPad.
BOARDS = {
    "panel": (1500, 594),    # behind a menu's row of choices
    "label": (600, 200),     # under a caught fish: its name and length
}
SIGN = "ui-start"
# The share of the sign's width, from the left, that is plain wood.
SIGN_PLAIN = 0.36


def cut_out(name):
    """A raw picture without its screen, cropped to what is left."""
    rgba = np.clip(key_green(np.asarray(Image.open(RAW / f"{name}.png").convert("RGB"))), 0, 255)
    img = Image.fromarray(rgba.astype(np.uint8), "RGBA")
    return img.crop(img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())


def shrink(img, size):
    """Resize with premultiplied alpha, so edges do not pick up a dark rim."""
    return img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def save(img, name):
    out = CLEAN / f"{name}.png"
    img.save(out, "PNG", optimize=True)
    print(f"[ok]   {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} kB")


def convert(name):
    if not (RAW / f"{name}.png").exists():
        print(f"[skip] assets/raw/{name}.png not found")
        return
    img = cut_out(name)
    scale = UI[name] / max(img.size)
    if scale < 1:
        img = shrink(img, (round(img.width * scale), round(img.height * scale)))
    save(img, name)


def make_boards():
    if not (RAW / f"{SIGN}.png").exists():
        print(f"[skip] boards: assets/raw/{SIGN}.png not found")
        return
    sign = np.asarray(cut_out(SIGN))
    height = sign.shape[0]
    plain = round(sign.shape[1] * SIGN_PLAIN)
    for shape, (width, out_height) in BOARDS.items():
        # A tall shape is a board standing on end.
        upright = out_height > width
        long_side, short_side = (out_height, width) if upright else (width, out_height)
        half = round(height * long_side / short_side / 2)
        if half > plain:
            sys.exit(f"board '{shape}' is too long for the plain part of the sign")
        left = sign[:, :half]
        board = Image.fromarray(np.concatenate([left, left[:, ::-1]], axis=1), "RGBA")
        board = shrink(board, (long_side, short_side))
        if upright:
            board = board.transpose(Image.ROTATE_90)
        save(board, f"ui-board-{shape}")


def main():
    names = sys.argv[1:] or list(UI) + ["boards"]
    unknown = [n for n in names if n not in UI and n != "boards"]
    if unknown:
        sys.exit(f"unknown: {', '.join(unknown)}  (known: {', '.join(UI)}, boards)")
    for name in names:
        if name == "boards":
            make_boards()
        else:
            convert(name)


if __name__ == "__main__":
    main()
