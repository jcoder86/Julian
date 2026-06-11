#!/usr/bin/env python3
"""
process_assets.py -- one-shot raw -> clean asset pipeline.

For every PNG in assets/raw/ (except files matching backdrop*.png), produces
a transparent-background version at assets/clean/<same-name>.png.

Two modes:
    default          chromakey green removal + alpha despill + edge feather
    --use-rembg      generic AI background remover (slower, no green needed)

Usage:
    pip install -r scripts/requirements.txt
    python scripts/process_assets.py            # chromakey mode
    python scripts/process_assets.py --use-rembg  # rembg mode

Notes:
    * backdrop*.png is excluded from processing entirely (used as-is by scenes).
    * Output is always RGBA PNG with the same filename as the input.
    * Existing files in assets/clean/ are overwritten without prompting.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


# Repo-root resolution: this script lives in scripts/, so the project root
# is one level up regardless of where the user runs it from.
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
RAW_DIR = REPO_ROOT / "assets" / "raw"
CLEAN_DIR = REPO_ROOT / "assets" / "clean"

# Filename prefixes we skip outright (handled as-is by scenes).
#   backdrop    -- painterly scene used as-is (no chromakey)
#   foreground  -- near-camera layer, transparent PNG (no chromakey needed)
# Note: cloud strips DO run through chromakey -- AI image tools typically
# output green-screen, and the script no-ops on already-transparent inputs.
SKIP_PREFIXES = ("backdrop", "foreground")

# Chromakey tuning -- values are in [0, 255] image space.
# These work well for a typical "Hollywood green" backdrop (#00ff00-ish).
# Tweak in-code if your green is noticeably different.
CHROMA_LOW = 10    # green_excess below this -> pixel kept fully opaque
CHROMA_HIGH = 80   # green_excess above this -> pixel fully transparent
ALPHA_BLUR_RADIUS = 0.6  # final gaussian blur on alpha channel for soft edges


def is_processable(path: Path) -> bool:
    if path.suffix.lower() != ".png":
        return False
    if any(path.name.lower().startswith(p) for p in SKIP_PREFIXES):
        return False
    return True


def chromakey_remove(img: Image.Image) -> Image.Image:
    """
    Remove green chromakey by computing the per-pixel "green excess" --
    how much greener a pixel is than the brighter of its red/blue channels.

    * green_excess > CHROMA_HIGH -> fully transparent (definite green)
    * green_excess in [LOW, HIGH] -> partial alpha (edge fringe)
    * green_excess <= LOW -> fully opaque (subject)

    Then we *despill* every kept pixel by clamping the green channel to
    max(R, B). This kills the green tint that bleeds onto hair, fur, and
    skin edges, which is what causes the "green halo" the user mentioned.
    Finally we gaussian-blur the alpha channel by ~0.6px to feather the
    matte and avoid stairstepping on diagonal edges.
    """
    rgba = np.asarray(img.convert("RGBA"), dtype=np.float32)
    r = rgba[..., 0]
    g = rgba[..., 1]
    b = rgba[..., 2]

    max_rb = np.maximum(r, b)
    green_excess = g - max_rb

    # Soft alpha mask: 1.0 = opaque, 0.0 = fully removed.
    denom = max(CHROMA_HIGH - CHROMA_LOW, 1)
    alpha_mask = 1.0 - np.clip((green_excess - CHROMA_LOW) / denom, 0.0, 1.0)

    # Despill: where green > max(R, B), pull green down to max(R, B).
    # This is the same trick OBS's color key filter uses.
    despilled_g = np.where(green_excess > 0, max_rb, g)

    out = np.stack(
        [r, despilled_g, b, alpha_mask * 255.0],
        axis=-1,
    )
    out = np.clip(out, 0, 255).astype(np.uint8)

    result = Image.fromarray(out, mode="RGBA")

    # Feather the alpha channel only -- don't touch RGB.
    r_ch, g_ch, b_ch, a_ch = result.split()
    a_ch = a_ch.filter(ImageFilter.GaussianBlur(radius=ALPHA_BLUR_RADIUS))
    return Image.merge("RGBA", (r_ch, g_ch, b_ch, a_ch))


def rembg_remove(img: Image.Image) -> Image.Image:
    """
    Generic AI background remover. Used when chromakey gives poor results
    (subject too close to green, or no green screen at all). Imported lazily
    because the dependency tree is heavy.
    """
    try:
        from rembg import remove  # type: ignore
    except ImportError as e:
        print(
            "[error] --use-rembg requires the rembg package.\n"
            "        pip install rembg onnxruntime",
            file=sys.stderr,
        )
        raise SystemExit(1) from e
    return remove(img)


def crop_empty_vertical(img: Image.Image) -> Image.Image:
    """
    Trim near-empty top and bottom rows. "Near-empty" means rows whose count
    of mostly-opaque pixels (alpha >= 128) is below 10% of the row with the
    densest content. This removes the soft feathered cloud edges that have
    technically non-zero alpha but contribute nothing visually, so the
    cropped image starts and ends where actual cloud BODIES live. Width is
    preserved to keep horizontal tiling intact.
    """
    arr = np.asarray(img.convert("RGBA"))
    alpha = arr[..., 3]
    # Per-row count of mostly-opaque pixels.
    row_density = (alpha >= 128).sum(axis=1)
    max_density = int(row_density.max())
    if max_density == 0:
        return img
    threshold = max(1, int(max_density * 0.10))
    rows_significant = row_density >= threshold
    if not rows_significant.any():
        return img
    ymin, ymax = np.where(rows_significant)[0][[0, -1]]
    return img.crop((0, int(ymin), img.width, int(ymax) + 1))


def process_one(path: Path, use_rembg: bool) -> Path:
    img = Image.open(path)
    if use_rembg:
        cleaned = rembg_remove(img)
    else:
        cleaned = chromakey_remove(img)

    # Cloud strips: crop away the transparent rows above/below the cloud band
    # so the scene can scale the whole image into its band without empty margins.
    if path.name.lower().startswith("cloud"):
        cleaned = crop_empty_vertical(cleaned)

    out_path = CLEAN_DIR / path.name
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)
    cleaned.save(out_path, "PNG")
    return out_path


def main():
    parser = argparse.ArgumentParser(description="Process raw assets into clean ones.")
    parser.add_argument(
        "--use-rembg",
        action="store_true",
        help="Force the AI background remover instead of chromakey.",
    )
    args = parser.parse_args()

    if not RAW_DIR.exists():
        print(f"[error] {RAW_DIR} does not exist. Nothing to process.", file=sys.stderr)
        sys.exit(1)

    raws = sorted(p for p in RAW_DIR.iterdir() if p.is_file())
    if not raws:
        print(f"[info] {RAW_DIR} is empty -- nothing to do.")
        return

    processed = 0
    skipped = 0
    for path in raws:
        if not is_processable(path):
            skipped += 1
            print(f"[skip] {path.name} (matches skip prefix or not a PNG)")
            continue
        try:
            out = process_one(path, use_rembg=args.use_rembg)
            print(f"[ok]   {path.name} -> {out.relative_to(REPO_ROOT)}")
            processed += 1
        except Exception as e:
            print(f"[fail] {path.name}: {e}", file=sys.stderr)

    print(f"\nDone. processed={processed} skipped={skipped} total={len(raws)}")


if __name__ == "__main__":
    main()
