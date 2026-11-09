"""
The boats' own pictures (src/data/boats.js), from Codex's (scripts/art_prompts.py,
`boat-icon-<id>` and `prop-<boat>-<name>`):

    python scripts/make_boat_props.py            # all of them
    python scripts/make_boat_props.py vissersboot

  assets/raw/boat-icon-<id>.png   the whole boat, from outside, on the sea
      -> assets/clean/boat_<id>_icon.jpg      square, for the boat menu
  assets/raw/boat-badge-<id>.png  the same boat alone, on green
      -> assets/clean/boat_<id>_badge.png     cut out, for the round boat button
  assets/raw/prop-<boat>-<name>.png   one thing on green
      -> assets/clean/prop_<boat>_<name>.png  cut out (the green keyed away and
         despilled), trimmed to what is in it
  (the gulls: two birds side by side, wings up and wings down
      -> prop_<boat>_gull-up.png, prop_<boat>_gull-down.png)
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from split_atlas import auto_crop, chromakey_remove      # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
CLEAN = ROOT / "assets" / "clean"
BOATS = ["sportvis", "vissersboot", "piratenschip", "speedboot"]
ICON_SIZE = 320
BADGE_MAX = 360
PROP_MAX = 520              # px: about twice as big as any is drawn


def icon(boat):
    src = RAW / f"boat-icon-{boat}.png"
    if not src.exists():
        return
    img = Image.open(src).convert("RGB")
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    out = CLEAN / f"boat_{boat}_icon.jpg"
    img.crop((left, top, left + side, top + side)).resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS) \
        .save(out, "JPEG", quality=88)
    print(f"[ok]   {out.relative_to(ROOT)}")


def badge(boat):
    src = RAW / f"boat-badge-{boat}.png"
    if src.exists():
        save_cutout(chromakey_remove(Image.open(src).convert("RGB")), CLEAN / f"boat_{boat}_badge.png", BADGE_MAX)


def save_cutout(img, out, most=PROP_MAX):
    img = auto_crop(img)
    k = min(1.0, most / max(img.size))
    if k < 1:
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    img.save(out, "PNG", optimize=True)
    print(f"[ok]   {out.relative_to(ROOT)}  {img.width}x{img.height}")


def centred_on_body(img):
    """
    A bird in flight, padded so that its body -- the middle columns, where
    the wings are not -- is in the middle of the picture: then its two
    frames (wings up, wings down) take turns without the bird jumping.
    """
    img = auto_crop(img)
    alpha = np.asarray(img.getchannel("A")).astype(np.float32)
    h, w = alpha.shape
    mid = alpha[:, int(w * 0.4):int(w * 0.6)]
    cy = float((mid.sum(axis=1) * np.arange(h)).sum() / max(mid.sum(), 1))
    cx = float((alpha.sum(axis=0) * np.arange(w)).sum() / max(alpha.sum(), 1))
    half_w = max(cx, w - cx)
    half_h = max(cy, h - cy)
    out = Image.new("RGBA", (round(half_w * 2), round(half_h * 2)), (0, 0, 0, 0))
    out.paste(img, (round(half_w - cx), round(half_h - cy)))
    return out


def save_frames(frames, outs):
    """Frames padded to one size (each centred), scaled alike."""
    w = max(f.width for f in frames)
    h = max(f.height for f in frames)
    k = min(1.0, PROP_MAX / max(w, h))
    for f, out in zip(frames, outs):
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        canvas.paste(f, ((w - f.width) // 2, (h - f.height) // 2))
        if k < 1:
            canvas = canvas.resize((round(w * k), round(h * k)), Image.LANCZOS)
        canvas.save(out, "PNG", optimize=True)
        print(f"[ok]   {out.relative_to(ROOT)}  {canvas.width}x{canvas.height}")


def halves(img):
    """Two things side by side: split at the emptiest column in the middle."""
    alpha = np.asarray(img.getchannel("A")).astype(np.float32)
    w = alpha.shape[1]
    middle = slice(w // 3, 2 * w // 3)
    cut = w // 3 + int(np.argmin(alpha[:, middle].sum(axis=0)))
    return img.crop((0, 0, cut, img.height)), img.crop((cut, 0, w, img.height))


def props(boat):
    for src in sorted(RAW.glob(f"prop-{boat}-*.png")):
        name = src.stem[len(f"prop-{boat}-"):]
        cut = chromakey_remove(Image.open(src).convert("RGB"))
        if name == "gulls":
            up, down = (centred_on_body(half) for half in halves(cut))
            save_frames([up, down], [CLEAN / f"prop_{boat}_gull-up.png",
                                     CLEAN / f"prop_{boat}_gull-down.png"])
        else:
            save_cutout(cut, CLEAN / f"prop_{boat}_{name}.png")


def main():
    boats = sys.argv[1:] or BOATS
    for boat in boats:
        if boat not in BOATS:
            sys.exit(f"unknown boat {boat} (known: {', '.join(BOATS)})")
        icon(boat)
        badge(boat)
        props(boat)


if __name__ == "__main__":
    main()
