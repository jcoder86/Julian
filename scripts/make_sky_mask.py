"""
Build a map's sky mask from its backdrop (video or still painting).

The cloud layers are DOM strips that scroll behind the game canvas. Masked
with this image they only show where the backdrop painting is SKY, so the
clouds pass behind the tree tops and mountain ridges instead of in front
of them -- on every screen shape, however the painting gets cropped.

How it works
  * backdrop.mp4 is a 1280x720 file holding the 4:3 painting (960x720)
    with black bars left and right; only the painting part is used.
  * The sky is a smooth vertical gradient. Walking down row by row we
    track its colour, and call a pixel "sky" when it matches the tracked
    colour for that row. That separates sky from the mountains' blue
    shadows, which have nearly the same hue as the sky higher up but are
    much darker than the sky right next to them.
  * Near the horizon the sky turns hazy and no longer matches one colour
    per row, so the mask is then grown outward: a neighbouring pixel joins
    when it is sky-blue AND nearly the same colour as the sky already next
    to it. Ridges and tree tops are hard colour edges, so growth stops
    there.
  * Only sky connected to the top edge counts (the lake is blue too).
  * A handful of frames across the loop are combined with AND, so
    anything that moves in the video never ends up inside the mask.
  * A still painting (--image) is read differently, because a generated
    painting's sky is not one colour per row (it can be hazier on one
    side): sky is then every smooth, bright-blue area that is connected
    to the top edge. Tree tops, roofs and the sea's horizon are hard
    edges and stop it; the sea itself is too dark and too rippled.
  * The edge is pulled in a little and feathered so the clouds dissolve
    softly behind the ridge line rather than being cut with scissors.

Output: white PNG whose alpha channel is the mask, covering the top
MASK_ROWS rows of the painting (the rest has no sky at all).

Usage (from the project root):
    # the original lake video -> assets/clean/sky-mask.png (needs ffmpeg)
    python scripts/make_sky_mask.py
    # a still 4:3 painting -> the mask named in src/data/maps.js
    python scripts/make_sky_mask.py --image assets/raw/backdrop-sea.png --out assets/clean/sky-mask-sea.png
    # a video of a 4:3 painting with black bars left and right
    python scripts/make_sky_mask.py --video assets/raw/backdrop-sea.mp4 --out assets/clean/sky-mask-sea.png
"""

import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "assets" / "raw" / "backdrop.mp4"
OUT = ROOT / "assets" / "clean" / "sky-mask.png"

FRAME_W, FRAME_H = 1280, 720
PAINT_X0, PAINT_X1 = 160, 1120      # the painting inside the 16:9 frame
MASK_ROWS = 320                      # sky never reaches below this row
SAMPLE_TIMES = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 5.9]

TOLERANCE = 30        # max per-channel distance from the row's sky colour
GROW_STEP = 12        # max per-channel distance from adjacent sky when growing
GROW_ROUNDS = 80
STILL_EDGE_MAX = 14   # --image: max colour change per px inside smooth sky
STILL_BLUE_MIN = 140  # --image: sky is at least this blue (the sea is darker)
ERODE_PX = 2          # pull the edge in: hides anti-aliased ridge pixels
FEATHER_SIGMA = 1.6   # gaussian blur of the edge, in mask px


def load_still(path):
    """A still 4:3 painting, scaled to the mask's working size."""
    img = Image.open(path).convert("RGB").resize(
        (PAINT_X1 - PAINT_X0, FRAME_H), Image.LANCZOS)
    return np.asarray(img)[:MASK_ROWS].astype(np.int16)


def grab_frame(t, video=None):
    """Decode one RGB frame at time t (seconds) with ffmpeg."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(t), "-i", str(video or VIDEO),
         "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        check=True, capture_output=True,
    ).stdout
    frame = np.frombuffer(raw, dtype=np.uint8).reshape(FRAME_H, FRAME_W, 3)
    return frame[:MASK_ROWS, PAINT_X0:PAINT_X1].astype(np.int16)


def sky_of(frame):
    """Boolean sky mask for one frame."""
    rows, cols, _ = frame.shape
    sky = np.zeros((rows, cols), dtype=bool)
    # Row 0 is all sky: start tracking from its median colour.
    colour = np.median(frame[0], axis=0)
    for y in range(rows):
        dist = np.abs(frame[y] - colour).max(axis=1)
        match = dist < TOLERANCE
        if match.sum() < 8:
            break                    # below the lowest sky: stop
        sky[y] = match
        colour = np.median(frame[y][match], axis=0)

    # Keep only what is connected to the top edge.
    labels, _ = ndimage.label(sky)
    top = np.unique(labels[0])
    sky = np.isin(labels, top[top != 0])

    # Grow into the hazy sky just above the horizon (see module docstring).
    rgb = frame.astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    skylike = (b > 205) & (b - r > 120) & (g > 120)
    for _ in range(GROW_ROUNDS):
        weight = ndimage.uniform_filter(sky.astype(np.float32), size=5)
        frontier = ndimage.binary_dilation(sky) & ~sky & skylike
        if not frontier.any():
            break
        near = np.zeros_like(frontier)
        ok = frontier.copy()
        for ch in range(3):
            local = ndimage.uniform_filter(rgb[..., ch] * sky, size=5)
            mean = np.divide(local, weight, out=np.zeros_like(local), where=weight > 0)
            ok &= np.abs(rgb[..., ch] - mean) < GROW_STEP
        near = ok
        if not near.any():
            break
        sky |= near
    return sky


def sky_of_still(frame):
    """Boolean sky mask for a still painting (see module docstring)."""
    soft = ndimage.gaussian_filter(frame.astype(np.float32), sigma=(1.0, 1.0, 0))
    edge = np.zeros(soft.shape[:2], dtype=np.float32)
    for ch in range(3):
        gx = ndimage.sobel(soft[..., ch], axis=1) / 4.0
        gy = ndimage.sobel(soft[..., ch], axis=0) / 4.0
        edge = np.maximum(edge, np.hypot(gx, gy))
    r, g, b = soft[..., 0], soft[..., 1], soft[..., 2]
    smooth_blue = ((edge < STILL_EDGE_MAX) & (b > STILL_BLUE_MIN)
                   & (b > r + 15) & (b >= g))
    labels, _ = ndimage.label(smooth_blue)
    top = np.unique(labels[0])
    return np.isin(labels, top[top != 0])


def main():
    ap = argparse.ArgumentParser(description="Build a map's sky mask from its backdrop.")
    ap.add_argument("--image", help="a still 4:3 painting to read the sky from")
    ap.add_argument("--video", help="a backdrop video (4:3 painting, black bars at the sides)")
    ap.add_argument("--out", help="where to write the mask (default: assets/clean/sky-mask.png)")
    args = ap.parse_args()
    out = Path(args.out) if args.out else OUT

    if args.image:
        if not Path(args.image).exists():
            sys.exit(f"missing {args.image}")
        frames = [load_still(args.image)]
    else:
        video = Path(args.video) if args.video else VIDEO
        if not video.exists():
            sys.exit(f"missing {video}")
        frames = [grab_frame(t, video) for t in SAMPLE_TIMES]

    detect = sky_of_still if args.image else sky_of
    sky = None
    for frame in frames:
        s = detect(frame)
        sky = s if sky is None else (sky & s)

    # Fill pinholes (stray off-colour pixels inside the sky), then shrink
    # and feather the edge. Padded first so the image border itself is
    # never treated as an edge of the sky.
    pad = 8
    sky = np.pad(sky, pad, mode="edge")
    sky = ndimage.binary_closing(sky, iterations=1)
    sky = ndimage.binary_fill_holes(sky)
    sky = ndimage.binary_erosion(sky, iterations=ERODE_PX)
    alpha = ndimage.gaussian_filter(sky.astype(np.float32), FEATHER_SIGMA)
    sky = sky[pad:-pad, pad:-pad]
    alpha = alpha[pad:-pad, pad:-pad]
    alpha = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)

    rgba = np.full((*alpha.shape, 4), 255, dtype=np.uint8)
    rgba[..., 3] = alpha
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(out, optimize=True)

    lowest = int(np.nonzero(sky.any(axis=1))[0].max())
    print(f"wrote {out}  {alpha.shape[1]}x{alpha.shape[0]}  "
          f"sky reaches row {lowest}  coverage {sky.mean():.1%}")


if __name__ == "__main__":
    main()
