#!/usr/bin/env python3
"""
split_atlas.py -- chromakey-and-split source atlases into individual cells.

Reads green-screen atlas PNGs from assets/raw/, removes the chromakey
background, and splits them into a grid of cells, auto-tightening each
cell to its bounding box. Outputs to assets/clean/.

Usage:
    python scripts/split_atlas.py

Atlases handled:
    fish.png    -- 10 species x 3 sizes (small/medium/large) = 30 cells
    baits.png   -- 5 baits x 2 styles  (full/simple)         = 10 cells
    floats.png  -- 5 floats x 2 parts  (full/tip)            = 10 cells

Each split cell is auto-cropped to its non-transparent bounding box, so
downstream code can scale freely without dealing with padding.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


# Resolve repo root from script location.
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
RAW_DIR = REPO_ROOT / "assets" / "raw"
CLEAN_DIR = REPO_ROOT / "assets" / "clean"


# Reuse the same chromakey parameters as process_assets.py so the look is
# consistent across all chromakey'd assets.
CHROMA_LOW = 10
CHROMA_HIGH = 80
ALPHA_BLUR_RADIUS = 0.6


def chromakey_remove(img: Image.Image, remove_white: bool = False) -> Image.Image:
    rgba = np.asarray(img.convert("RGBA"), dtype=np.float32)
    r = rgba[..., 0]
    g = rgba[..., 1]
    b = rgba[..., 2]
    max_rb = np.maximum(r, b)
    green_excess = g - max_rb
    denom = max(CHROMA_HIGH - CHROMA_LOW, 1)
    alpha_mask = 1.0 - np.clip((green_excess - CHROMA_LOW) / denom, 0.0, 1.0)
    despilled_g = np.where(green_excess > 0, max_rb, g)
    # Optionally transparentise near-white pixels (e.g. gridlines drawn on
    # the source atlas). Threshold 220 catches anti-aliased line edges too.
    if remove_white:
        white_mask = (r > 220) & (g > 220) & (b > 220)
        alpha_mask = np.where(white_mask, 0.0, alpha_mask)
    out = np.stack([r, despilled_g, b, alpha_mask * 255.0], axis=-1)
    out = np.clip(out, 0, 255).astype(np.uint8)
    result = Image.fromarray(out, mode="RGBA")
    r_ch, g_ch, b_ch, a_ch = result.split()
    a_ch = a_ch.filter(ImageFilter.GaussianBlur(radius=ALPHA_BLUR_RADIUS))
    return Image.merge("RGBA", (r_ch, g_ch, b_ch, a_ch))


def auto_crop(img: Image.Image, alpha_threshold: int = 16) -> Image.Image:
    """Tight crop to the bounding box of non-transparent pixels."""
    arr = np.asarray(img.convert("RGBA"))
    alpha = arr[..., 3]
    mask = alpha > alpha_threshold
    if not mask.any():
        return img
    rows = mask.any(axis=1)
    cols = mask.any(axis=0)
    ymin, ymax = np.where(rows)[0][[0, -1]]
    xmin, xmax = np.where(cols)[0][[0, -1]]
    return img.crop((int(xmin), int(ymin), int(xmax) + 1, int(ymax) + 1))


def split_grid(img: Image.Image, cols: int, rows: int) -> list[list[Image.Image]]:
    """
    Split image into a uniform cols x rows grid. Returns nested list
    indexed as cells[row][col]. Each cell is then auto-cropped.
    """
    cell_w = img.width / cols
    cell_h = img.height / rows
    cells: list[list[Image.Image]] = []
    for r in range(rows):
        row_cells = []
        for c in range(cols):
            x0 = int(round(c * cell_w))
            y0 = int(round(r * cell_h))
            x1 = int(round((c + 1) * cell_w))
            y1 = int(round((r + 1) * cell_h))
            cell = img.crop((x0, y0, x1, y1))
            cell = auto_crop(cell)
            row_cells.append(cell)
        cells.append(row_cells)
    return cells


# ----------------------------------------------------------------------------
# Atlas-specific processing
# ----------------------------------------------------------------------------

# Fish atlas: 11 species rows, 3 size columns. Rows are NOT uniform height
# (e.g. pike row is taller than perch row) so a fixed grid clips adjacent
# fish into each cell. We detect each fish as an isolated alpha blob and
# cluster blobs by their centroid into rows + columns instead.
FISH_SIZES = ["small", "medium", "large"]
FISH_SPECIES = [
    "roach",        # row 1 -- voorn
    "rudd",         # row 2 -- rietvoorn
    "perch",        # row 3 -- baars
    "bream",        # row 4 -- brasem
    "tench",        # row 5 -- zeelt
    "carp",         # row 6 -- karper
    "pike",         # row 7 -- snoek
    "zander",       # row 8 -- snoekbaars
    "chub",         # row 9 -- kopvoorn
    "bass",         # row 10 -- baars (Amerikaanse)
    "trout",        # row 11 -- forel (brown)
]
FISH_SPECIES_COUNT = len(FISH_SPECIES)


def _find_blobs(img: Image.Image, alpha_threshold: int = 32, min_area: int = 200,
                morph: int = 0):
    """
    Return list of dicts plus the label array for each connected blob in img.
    `morph` > 0 dilates (merges loose parts of one sprite into its body).
    `morph` < 0 erodes (separates sprites that are touching at pixel level).

    Crucially, the label array is computed on the morph'd mask but the
    returned bboxes are expanded to the ORIGINAL alpha extent so erosion
    doesn't shrink the visible sprite.
    """
    from scipy import ndimage
    arr = np.asarray(img.convert("RGBA"))
    raw_mask = (arr[..., 3] > alpha_threshold).astype(np.uint8)
    if morph > 0:
        work_mask = ndimage.binary_dilation(raw_mask, iterations=morph).astype(np.uint8)
    elif morph < 0:
        work_mask = ndimage.binary_erosion(raw_mask, iterations=-morph).astype(np.uint8)
    else:
        work_mask = raw_mask

    labels, n = ndimage.label(work_mask)

    # When we erode, the labels live inside a shrunken version of each sprite.
    # Re-grow the labels back into the original alpha so each labelled blob
    # actually covers its full visible pixels again. Use grey-dilation with
    # the labels themselves so adjacent labels don't bleed into each other.
    if morph < 0:
        # Repeatedly assign unlabelled raw-mask pixels to their nearest
        # labelled neighbour. This is the classic "watershed-fill" trick.
        for _ in range(-morph + 1):
            dilated = ndimage.grey_dilation(labels, size=(3, 3))
            new_assignments = (labels == 0) & (raw_mask > 0) & (dilated > 0)
            labels = np.where(new_assignments, dilated, labels)

    blobs = []
    for i in range(1, n + 1):
        ys, xs = np.where(labels == i)
        if len(ys) < min_area:
            continue
        bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        centroid = (float(xs.mean()), float(ys.mean()))
        blobs.append({
            "bbox": bbox,
            "centroid": centroid,
            "area": int(len(ys)),
            "label": i,
        })
    blobs.sort(key=lambda b: -b["area"])
    return blobs, labels


def _crop_blob(img: Image.Image, labels: np.ndarray, blob: dict) -> Image.Image:
    """
    Crop a blob's bounding box AND mask out any pixels belonging to other
    blobs (in case bboxes overlap). Returns an RGBA Image.
    """
    xmin, ymin, xmax, ymax = blob["bbox"]
    region = np.asarray(img.convert("RGBA"))[ymin:ymax, xmin:xmax].copy()
    region_labels = labels[ymin:ymax, xmin:xmax]
    other_blob_mask = (region_labels != 0) & (region_labels != blob["label"])
    region[other_blob_mask, 3] = 0   # transparentise neighbours
    return Image.fromarray(region, mode="RGBA")


def _cluster_by_axis(blobs, axis: int, n_clusters: int):
    """
    Cluster blobs into `n_clusters` groups by centroid axis (0=x, 1=y).
    Equal-count split assuming a regular grid.
    """
    coords = sorted([(b["centroid"][axis], idx) for idx, b in enumerate(blobs)])
    per = len(coords) / n_clusters
    cluster_of = [0] * len(blobs)
    for rank, (_, idx) in enumerate(coords):
        cluster_of[idx] = min(int(rank // per), n_clusters - 1)
    return cluster_of


def process_fish(atlas_path: Path) -> int:
    img = Image.open(atlas_path)
    cleaned = chromakey_remove(img, remove_white=True)
    expected = FISH_SPECIES_COUNT * 3
    blobs, labels = _find_blobs(cleaned, alpha_threshold=32, min_area=500, morph=0)

    # Detect mega-blobs (heights well above the typical-large-fish height)
    # and split them vertically. Use 75th percentile as reference -- median
    # is skewed by the small column-1 fish, but the large fish in column 3
    # need their own characteristic height for the split factor to round
    # to the right number of sub-fish.
    heights = sorted(b["bbox"][3] - b["bbox"][1] for b in blobs)
    median_h = heights[int(len(heights) * 0.75)]   # p75 ~= "typical large fish"
    split_blobs = []
    next_label = max(b["label"] for b in blobs) + 1
    for b in blobs:
        xmin, ymin, xmax, ymax = b["bbox"]
        h = ymax - ymin
        n_sub = round(h / median_h)
        if n_sub <= 1:
            split_blobs.append(b)
            continue
        sub_h = h / n_sub
        print(f"[info] splitting mega-blob h={h} (median={median_h}) into {n_sub} sub-blobs")
        for i in range(n_sub):
            sy0 = int(round(ymin + i * sub_h))
            sy1 = int(round(ymin + (i + 1) * sub_h))
            sub_bbox = (xmin, sy0, xmax, sy1)
            sub_label = next_label
            next_label += 1
            # Reassign label pixels in this sub-band so _crop_blob masks correctly.
            mask = (labels[sy0:sy1, xmin:xmax] == b["label"])
            labels[sy0:sy1, xmin:xmax] = np.where(mask, sub_label, labels[sy0:sy1, xmin:xmax])
            split_blobs.append({
                "bbox": sub_bbox,
                "centroid": ((xmin + xmax) / 2, (sy0 + sy1) / 2),
                "area": int(mask.sum()),
                "label": sub_label,
            })
    blobs = sorted(split_blobs, key=lambda b: -b["area"])
    print(f"[info] fish.png: after mega-blob splitting -> {len(blobs)} blobs (target {expected})")
    expected = FISH_SPECIES_COUNT * 3
    if len(blobs) >= expected:
        # Keep top-N largest -- filters spurious tiny artifacts (loose eyes,
        # detached fin tips) that survived the dilation pass.
        blobs = blobs[:expected]
        print(f"[info] fish.png found {len(blobs)} fish blobs (after filtering)")
    else:
        print(f"[warn] fish.png found {len(blobs)} blobs, expected {expected}. "
              f"Falling back to uniform grid.")
        cells = split_grid(cleaned, cols=3, rows=FISH_SPECIES_COUNT)
        saved = 0
        for row_idx, row in enumerate(cells):
            for col_idx, cell in enumerate(row):
                out = CLEAN_DIR / f"fish_{(row_idx+1):02d}_{FISH_SIZES[col_idx]}.png"
                cell.save(out, "PNG")
                saved += 1
        return saved

    # Cluster by Y centroid -> row (species). Sort by Y, assign row index by rank.
    row_of = _cluster_by_axis(blobs, axis=1, n_clusters=FISH_SPECIES_COUNT)
    grouped: dict[int, list[int]] = {}
    for i, r in enumerate(row_of):
        grouped.setdefault(r, []).append(i)

    saved = 0
    for row_idx in sorted(grouped.keys()):
        members = grouped[row_idx]
        # Sort row's blobs left-to-right -> size index.
        members.sort(key=lambda i: blobs[i]["centroid"][0])
        for col_idx, blob_idx in enumerate(members[:3]):
            blob = blobs[blob_idx]
            cell = _crop_blob(cleaned, labels, blob)
            size = FISH_SIZES[col_idx]
            species = FISH_SPECIES[row_idx] if row_idx < len(FISH_SPECIES) else f"sp{row_idx+1:02d}"
            out = CLEAN_DIR / f"fish_{species}_{size}.png"
            cell.save(out, "PNG")
            saved += 1
    return saved


# Bait atlas: 5 columns (bait types) x 2 rows (top=full-on-hook, bottom=simple).
BAIT_NAMES = ["brood", "mais", "maden", "wormen", "vis"]
BAIT_ROW_LABELS = ["full", "simple"]  # row 0 = full, row 1 = simple


def process_baits(atlas_path: Path) -> int:
    img = Image.open(atlas_path)
    cleaned = chromakey_remove(img)
    return _process_grid_via_blobs(
        cleaned,
        rows=len(BAIT_ROW_LABELS),
        cols=len(BAIT_NAMES),
        out_pattern=lambda r, c: CLEAN_DIR / f"bait_{BAIT_NAMES[c]}_{BAIT_ROW_LABELS[r]}.png",
        atlas_name="baits.png",
    )


# Float atlas: 5 columns (float types) x 2 rows (top=full, bottom=tip).
FLOAT_NAMES = ["float_01", "float_02", "float_03", "float_04", "float_05"]
FLOAT_ROW_LABELS = ["full", "tip"]


def process_floats(atlas_path: Path) -> int:
    img = Image.open(atlas_path)
    cleaned = chromakey_remove(img)
    return _process_grid_via_blobs(
        cleaned,
        rows=len(FLOAT_ROW_LABELS),
        cols=len(FLOAT_NAMES),
        out_pattern=lambda r, c: CLEAN_DIR / f"{FLOAT_NAMES[c]}_{FLOAT_ROW_LABELS[r]}.png",
        atlas_name="floats.png",
    )


def _process_grid_via_blobs(cleaned: Image.Image, rows: int, cols: int,
                            out_pattern, atlas_name: str) -> int:
    """
    Shared blob-detection grid processing for baits/floats. Finds rows*cols
    blobs, clusters by Y then X, masks neighbour pixels out of each crop,
    and saves to the given output naming pattern.
    """
    expected = rows * cols
    blobs, labels = _find_blobs(cleaned, alpha_threshold=32, min_area=300, morph=0)
    if len(blobs) < expected:
        print(f"[warn] {atlas_name}: only {len(blobs)} blobs (expected {expected}). "
              f"Falling back to uniform grid.")
        cells = split_grid(cleaned, cols=cols, rows=rows)
        saved = 0
        for r, row in enumerate(cells):
            for c, cell in enumerate(row):
                cell.save(out_pattern(r, c), "PNG")
                saved += 1
        return saved
    # Keep largest `expected` blobs.
    blobs = blobs[:expected]
    print(f"[info] {atlas_name}: detected {len(blobs)} blobs (target {expected})")

    row_of = _cluster_by_axis(blobs, axis=1, n_clusters=rows)
    grouped: dict[int, list[int]] = {}
    for i, r in enumerate(row_of):
        grouped.setdefault(r, []).append(i)
    saved = 0
    for row_idx in sorted(grouped.keys()):
        members = grouped[row_idx]
        members.sort(key=lambda i: blobs[i]["centroid"][0])
        for col_idx, blob_idx in enumerate(members[:cols]):
            blob = blobs[blob_idx]
            cell = _crop_blob(cleaned, labels, blob)
            cell.save(out_pattern(row_idx, col_idx), "PNG")
            saved += 1
    return saved


# Standalone icons (no splitting, just chromakey). Source: raw/icon-*.png.
ICONS = ["icon-bait", "icon-fish", "icon-float"]


def process_icons() -> int:
    saved = 0
    for name in ICONS:
        src = RAW_DIR / f"{name}.png"
        if not src.exists():
            print(f"[skip] {name}.png not found")
            continue
        img = Image.open(src)
        cleaned = chromakey_remove(img)
        cleaned = auto_crop(cleaned)
        out = CLEAN_DIR / f"{name}.png"
        cleaned.save(out, "PNG")
        saved += 1
    return saved


def process_play_button() -> int:
    """
    play.png is a rounded-rectangle button on a near-white background.
    (Older version was a full circle on a green chromakey; the current
    asset is a less-rounded square shape that handles HiDPI scaling
    better.) We remove the EXTERIOR white via flood-fill from the
    corners so any white highlight INSIDE the button is preserved, then
    Lanczos-downsample to a HiDPI-friendly size.
    Output: clean/play.png.
    """
    src = RAW_DIR / "play.png"
    if not src.exists():
        print(f"[skip] play.png not found")
        return 0

    from scipy import ndimage

    img = Image.open(src).convert("RGBA")
    arr = np.asarray(img, dtype=np.uint8).copy()
    h, w = arr.shape[:2]

    # Near-white mask. Generous threshold catches anti-aliased fringes
    # without grabbing the gold-and-green button interior.
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    near_white = (r > 230) & (g > 230) & (b > 230)

    # Flood-fill the exterior: anything connected to the image edge that
    # is near-white. Keeps any in-button white highlights intact.
    labeled, _ = ndimage.label(near_white)
    edge_band = np.zeros_like(near_white, dtype=bool)
    edge_band[0, :] = True; edge_band[-1, :] = True
    edge_band[:, 0] = True; edge_band[:, -1] = True
    edge_labels = set(labeled[edge_band & near_white]) - {0}
    exterior = np.isin(labeled, list(edge_labels))
    arr[exterior, 3] = 0

    out_img = Image.fromarray(arr, mode="RGBA")
    out_img = auto_crop(out_img)

    # HIGH-QUALITY pre-downsample. The runtime sprite displays at ~230px;
    # by exporting at 512px (HiDPI-friendly) using Lanczos, the GPU only
    # has to do a ~2x scale at runtime instead of a >5x downscale.
    TARGET_SIZE = 512
    if max(out_img.size) > TARGET_SIZE:
        scale = TARGET_SIZE / max(out_img.size)
        new_w = round(out_img.size[0] * scale)
        new_h = round(out_img.size[1] * scale)
        out_img = out_img.resize((new_w, new_h), Image.LANCZOS)
    out = CLEAN_DIR / "play.png"
    out_img.save(out, "PNG")
    print(f"[info] play.png -> play.png ({out_img.width}x{out_img.height})")
    return 1


# Reel (fishing-reel "molen") atlas: a single PNG with TWO objects on a
# green chromakey background -- the reel body on the left, the loose
# crank handle on the right. We split into two files so the handle can
# be rotated independently around the reel's axis at runtime.
#
# Output:
#   reel.png        -- the reel body, auto-cropped
#   reel-handle.png -- the handle, auto-cropped
def process_rod(atlas_path: Path) -> int:
    img = Image.open(atlas_path)
    cleaned = chromakey_remove(img)

    # We expect 2 large blobs (reel + handle). Use morph=0 since the reel
    # alone is already a single contiguous shape and the handle is loose.
    blobs, labels = _find_blobs(cleaned, alpha_threshold=32, min_area=400, morph=0)
    if len(blobs) < 2:
        print(f"[warn] rod.png: only {len(blobs)} blob(s) found, expected 2. "
              f"Saving whole-image chromakey'd version as reel.png.")
        out = CLEAN_DIR / "reel.png"
        auto_crop(cleaned).save(out, "PNG")
        return 1

    # Keep top 2 by area; the reel is much larger than the handle so this
    # is robust against speckle artifacts surviving the chromakey.
    blobs = blobs[:2]
    blobs.sort(key=lambda b: b["centroid"][0])   # left-to-right: reel first, handle second
    names = ["reel", "reel-handle"]
    saved = 0
    for blob, name in zip(blobs, names):
        cell = _crop_blob(cleaned, labels, blob)
        out = CLEAN_DIR / f"{name}.png"
        cell.save(out, "PNG")
        print(f"[info] rod.png -> {name}.png ({cell.width}x{cell.height})")
        saved += 1
    return saved


def main():
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)

    atlases = [
        ("fish2.png",  process_fish),     # 11 species, gridlined source
        ("baits.png",  process_baits),
        ("floats.png", process_floats),
        ("rod.png",    process_rod),      # reel body + crank handle
    ]

    total = 0
    for fname, handler in atlases:
        path = RAW_DIR / fname
        if not path.exists():
            print(f"[skip] {fname} not found in raw/")
            continue
        count = handler(path)
        print(f"[ok]   {fname} -> {count} cells")
        total += count

    icons = process_icons()
    print(f"[ok]   3 icon files -> {icons} cleaned")
    total += icons

    play = process_play_button()
    print(f"[ok]   play.png -> {play} cleaned")
    total += play

    print(f"\nDone. Total assets produced: {total}")


if __name__ == "__main__":
    main()
