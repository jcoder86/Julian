"""
Moving water for a map's painting.

A video model (Veo, see scripts/gen_video.py) turns the painting into eight
seconds of film in which the water moves. This script prepares the picture
for it and afterwards puts ONLY the moving water back into the original
painting, so everything else -- jetty or pier, walls, trees, sky -- stays
exactly the still painting: razor sharp and rock solid under Julian.

    python scripts/make_water.py sea            # generate (costs money) + compose
    python scripts/make_water.py lake
    python scripts/make_water.py sea --compose  # only redo the composing

Step by step
  1. FRAME   The bottom part of the 4:3 painting (from just above the far
             shore / horizon down) is almost exactly 16:9, the shape Veo
             films in. It is sent in full HD, so the model spends all its
             pixels on water and none on sky.
  2. FILM    Veo gets that frame as the first AND the last frame of the
             clip, with a prompt saying the camera is locked off and only
             the water moves: the clip ends where it began and can repeat.
             Kept as work/veo-<map>.mp4 (with Veo's own sound track).
  3. MASK    Where does the film actually move? Measured per small block
             of pixels: how much its average brightness changes over the
             clip. (Per single pixel would not do: Veo redraws stone and
             wood with a fine grain that shimmers a little, while a whole
             block of stone stays the same and a block of water does not.)
             Only below the map's far shore or horizon (src/data/maps.js),
             so a swaying tree top can never slip in. Kept as
             work/water-mask-<map>.png to look at: white = moving water.
  4. COMPOSE Each film frame is colour-matched to the painting and laid
             over it through that mask (soft-edged), then everything is
             encoded as the map's backdrop video.
  5. LOOP    Veo's last frame matches its first in the large (where the
             swell and the foam are) but not ripple for ripple, which would
             show as a little jolt every time the video repeats. So the
             end of the clip is dissolved into its beginning over half a
             second.

    ->  assets/clean/backdrop-<painting>.mp4   (4:3, no sound)

The game shows the painting at once and swaps in the video when it has
loaded (map.backdropVideo). Needs ffmpeg and node on the PATH.

work/ is not in git and not part of the published game: the raw clips are
30 MB each. As long as they are there, --compose costs nothing.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_video import generate          # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
CLEAN = ROOT / "assets" / "clean"
WORK = ROOT / "work"

# The part of the painting that is filmed: from this share of its height
# down to the bottom. 4:3 * (1 - 0.236) is 16:9 to within 2 %; that last
# bit is evened out by a squeeze nobody can see.
WINDOW_TOP = 0.236
FILM_SIZE = (1920, 1080)
OUT_SIZE = (1440, 1080)       # the finished 4:3 video
FPS = 24
CRF = 28                      # x264 quality: lower = better and bigger
# Veo draws water crisper than the paintings are; a touch of blur brings
# it back in line with them (and makes the file a good deal smaller).
FILM_SOFTEN = 0.6

# Motion is measured on blocks of MOTION_BLOCK x MOTION_BLOCK pixels: how
# much a block's average brightness varies over the clip (standard
# deviation, 0..255). Stone and wood stay under 3; water is 4 (far away)
# to 40.
MOTION_BLOCK = 6
MOTION_MIN = 3.5
MASK_FEATHER_PX = 6
# Colour is compared between film and painting with fine detail blurred
# away (Veo redraws every stone and ripple crisper than the painting).
COLOUR_BLUR_PX = 12
# Frames over which the end of the clip dissolves into its start.
LOOP_BLEND_FRAMES = 12

STILL_RULES = (
    "Static, locked-off tripod shot: the camera does not move at all -- no "
    "pan, no tilt, no zoom, no shake, no change of focus. Everything that is "
    "not water stays perfectly still and exactly as it is. Nothing new "
    "appears and nothing disappears: no boats, no birds, no fish, no people, "
    "no objects, no text. Even, natural, real-time motion from the first "
    "frame to the last, as one seamless loop."
)

WATER = {
    "sea": dict(
        painting="backdrop-sea",
        prompt=(
            "A calm summer sea, gently alive. A slow, low swell rolls evenly "
            "toward the viewer; small ripples and a few little white caps "
            "come and go; sunlight glitters on the water; a little foam "
            "laps softly around the foot of the stone pier. The motion is "
            "the same, gentle and regular, all the way through: NO big "
            "wave, no breaker, no splash, no spray, and no water ever comes "
            "over the pier. The stone pier, its iron bollard and the "
            "horizon do not move. " + STILL_RULES +
            " Sound: waves washing against stone, a light sea breeze. No "
            "music, no voices."
        )),
    "lake": dict(
        painting="backdrop-naarden",
        prompt=(
            "The calm water of the moat is alive. A light breeze sends small "
            "ripples drifting slowly across the surface; the reflections of "
            "the brick walls and the trees shimmer and waver softly; in the "
            "clear shallows in front, sunlight plays over the pebbles. The "
            "wooden jetty, the brick fortress walls, the church, the houses, "
            "the trees and the banks do not move -- no leaf stirs. "
            + STILL_RULES +
            " Sound: quiet water lapping, a few birds far away. No music, "
            "no voices."
        )),
}


def waterline(map_id, width, height):
    """The map's waterline (src/data/maps.js) in painting pixels."""
    js = ("import('./src/data/maps.js').then((m) => "
          "console.log(JSON.stringify(m.getMap(process.argv[1]).waterline)))")
    out = subprocess.run(["node", "--input-type=module", "-e", js, map_id],
                         cwd=ROOT, check=True, capture_output=True, text=True).stdout
    # Design coordinates: x 0..1280 across, y -120..840 down the painting.
    return [(x * width / 1280.0, (y + 120.0) * height / 960.0) for x, y in json.loads(out)]


def far_shore(map_id, width, height):
    """Painting row of the map's far shore or horizon: no water above it."""
    return min(y for _, y in waterline(map_id, width, height))


def film_frame(painting):
    """The 16:9 frame Veo starts from."""
    img = Image.open(RAW / f"{painting}.png").convert("RGB")
    top = round(img.height * WINDOW_TOP)
    return img.crop((0, top, img.width, img.height)).resize(FILM_SIZE, Image.LANCZOS)


def read_clip(path, size):
    """All frames of a video as one uint8 array (frames, height, width, 3)."""
    width, height = size
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path),
         "-vf", f"scale={width}:{height}:flags=lanczos,gblur=sigma={FILM_SOFTEN}",
         "-r", str(FPS), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, height, width, 3)


def compose(map_id):
    spec = WATER[map_id]
    clip_path = WORK / f"veo-{map_id}.mp4"
    if not clip_path.exists():
        sys.exit(f"missing {clip_path.relative_to(ROOT)}: run without --compose first")

    still = Image.open(RAW / f"{spec['painting']}.png").convert("RGB").resize(OUT_SIZE, Image.LANCZOS)
    still = np.asarray(still).astype(np.float32)
    width, height = OUT_SIZE
    top = round(height * WINDOW_TOP)
    clip = read_clip(clip_path, (width, height - top))       # film, back at painting scale
    frames = len(clip)

    # --- where does the film move? -----------------------------------------
    luma = clip[::3].astype(np.float32) @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    k = MOTION_BLOCK
    rows, cols = (height - top) // k, width // k
    blocks = luma[:, :rows * k, :cols * k].reshape(len(luma), rows, k, cols, k).mean(axis=(2, 4))
    moving = blocks.std(axis=0) > MOTION_MIN
    # One solid area: bridge calm patches, drop loose specks. Padded first,
    # so the picture's own border does not count as an edge of the water.
    pad = 8
    moving = np.pad(moving, pad, mode="edge")
    moving = ndimage.binary_closing(moving, iterations=3)
    moving = ndimage.binary_fill_holes(moving)
    moving = ndimage.binary_opening(moving, iterations=2)
    moving = moving[pad:-pad, pad:-pad]

    # Back to pixels...
    water = np.zeros((height, width), dtype=bool)
    water[top:top + rows * k, :cols * k] = np.kron(moving, np.ones((k, k), dtype=bool))
    water[top + rows * k:] = water[top + rows * k - 1]          # the few rows and columns
    water[:, cols * k:] = water[:, cols * k - 1:cols * k]       # the blocks did not cover
    first_row = max(top + MASK_FEATHER_PX * 3,                  # the film's own top edge
                    round(far_shore(map_id, width, height)))
    water[:first_row] = False
    # ...then pull the edge in a little and soften it.
    pad = MASK_FEATHER_PX * 4
    water = ndimage.binary_erosion(np.pad(water, pad, mode="edge"), iterations=MASK_FEATHER_PX)
    mask = ndimage.gaussian_filter(water.astype(np.float32), MASK_FEATHER_PX)[pad:-pad, pad:-pad]
    Image.fromarray((mask * 255).astype(np.uint8)).save(WORK / f"water-mask-{map_id}.png")

    # --- colour: the film's first frame IS the painting, so any overall
    # difference between the two is a colour shift to undo ------------------
    blur = (COLOUR_BLUR_PX, COLOUR_BLUR_PX, 0)
    first = ndimage.gaussian_filter(clip[0].astype(np.float32), blur)
    paint = ndimage.gaussian_filter(still[top:], blur)
    gain = np.ones(3, dtype=np.float32)
    bias = np.zeros(3, dtype=np.float32)
    for ch in range(3):
        film, target = first[..., ch].ravel(), paint[..., ch].ravel()
        gain[ch] = np.cov(film, target)[0, 1] / film.var()
        bias[ch] = target.mean() - gain[ch] * film.mean()

    # --- lay the moving water over the painting, encode --------------------
    out = CLEAN / f"{spec['painting']}.mp4"
    encoder = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{width}x{height}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF), "-pix_fmt", "yuv420p",
         "-movflags", "+faststart", "-an", str(out)],
        stdin=subprocess.PIPE)
    m = mask[top:, :, None]
    blend = LOOP_BLEND_FRAMES
    for i in range(frames - blend):
        film = clip[i].astype(np.float32)
        if i < blend:
            # The video repeats here: fade from the clip's tail into its head.
            tail = clip[frames - blend + i].astype(np.float32)
            film = tail + (film - tail) * (i / blend)
        film = film * gain + bias
        frame = still.copy()
        frame[top:] = frame[top:] * (1.0 - m) + film * m
        encoder.stdin.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())
    encoder.stdin.close()
    if encoder.wait() != 0:
        sys.exit("ffmpeg could not encode the video")

    seam = np.abs(luma[0] - clip[-1].astype(np.float32) @ np.array([0.299, 0.587, 0.114])).mean()
    step = np.abs(luma[1] - luma[0]).mean() / 3.0
    print(f"[ok]   {out.relative_to(ROOT)}  {frames - blend} frames  {out.stat().st_size // 1024} kB")
    print(f"       moving water: {mask.mean():.0%} of the picture   colour gain "
          f"{[round(float(g), 2) for g in gain]}   last-to-first frame {seam:.1f} "
          f"(frame-to-frame {step:.1f})")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("map", choices=WATER, help="map id, as in src/data/maps.js")
    ap.add_argument("--compose", action="store_true",
                    help="skip the (paid) generation, reuse work/veo-<map>.mp4")
    ap.add_argument("--model", default="fast", help="lite, fast (default) or full")
    args = ap.parse_args()

    if not args.compose:
        spec = WATER[args.map]
        WORK.mkdir(exist_ok=True)
        frame = WORK / f"veo-{args.map}-frame.jpg"
        film_frame(spec["painting"]).save(frame, "JPEG", quality=95)
        clip = generate(spec["prompt"], frame, WORK / f"veo-{args.map}.mp4", loop=True, model=args.model)
        frame.unlink()
        if clip is None:
            sys.exit(1)
    compose(args.map)


if __name__ == "__main__":
    main()
