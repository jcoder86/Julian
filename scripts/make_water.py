"""
Moving water for a map's painting.

A video model (Gemini Omni -- Veo until October 2026 --, see
scripts/gen_video.py) turns the painting into eight seconds of film in
which the water moves. This script prepares the picture
for it and afterwards puts ONLY the moving water back into the original
painting, so everything else -- jetty or pier, walls, trees, sky -- stays
exactly the still painting: razor sharp and rock solid under Julian.

    python scripts/make_water.py sea            # generate (costs money) + compose
    python scripts/make_water.py lake
    python scripts/make_water.py greece
    python scripts/make_water.py antarctica    # the fire flickers too
    python scripts/make_water.py ocean         # the wake of the boat
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
  3. MASK    Where does the film actually move? (Never on the jetty, pier
             or pontoon itself: the map's `dry` outline is cut out.)
             Where does the film actually move? Measured per small block
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
from PIL import Image, ImageDraw
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
# Kept clear around the jetty / pier / pontoon outline of the map.
DRY_MARGIN_PX = 4
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
    "france": dict(
        painting="backdrop-france",
        prompt=(
            "The clear mountain lake is gently alive. A light breeze sends "
            "small ripples drifting slowly across the surface; the "
            "reflections of the village, the trees and the mountains shimmer "
            "and waver softly; in the clear shallows in front, sunlight plays "
            "over the pebbles. The wooden pontoon with its barrels, its two "
            "striped mooring poles and their rope, the rowing boat on the "
            "bank, the houses, the bridge, the trees and the mountains do "
            "not move -- no leaf stirs. " + STILL_RULES +
            " Sound: quiet water lapping, a few birds far away. No music, "
            "no voices."
        )),
    "greece": dict(
        painting="backdrop-greece",
        prompt=(
            "A calm, clear summer sea, gently alive. Small ripples drift "
            "slowly across the deep blue water and sunlight glitters on it; "
            "in the clear turquoise shallows in front, the light plays in "
            "moving patterns over the sand, the stones and the weed on the "
            "bottom; small wavelets lap softly against the foot of the pale "
            "limestone rock, with a little white foam. The motion is the "
            "same, gentle and regular, all the way through: no big wave, no "
            "splash, no spray, and no water ever comes onto the rock. The "
            "rock, the headland, its pines, the white houses, the chapel and "
            "the islands do not move -- no branch stirs. " + STILL_RULES +
            " Sound: small waves lapping against rock, cicadas far away. No "
            "music, no voices."
        )),
    # The big ocean, from the back deck of a boat under way: the wake.
    "ocean": dict(
        painting="backdrop-ocean",
        all_water=True,
        # Gemini Omni given the same first and last frame filmed two seconds
        # of motion, a jump, and near-stillness. So, with Omni: the first
        # frame only, twelve seconds, the longest stretch that keeps moving,
        # and its end dissolved into its beginning over a full second.
        # (The film in use, November 2026, is Veo 3.1 after all, made in
        # ElevenLabs' Image & Video -- 1080p, 8 s, this frame as first and
        # last frame, this prompt without the sound -- when the Gemini
        # credit had run out: saved as work/veo-ocean.mp4, then --compose.)
        last_frame=False,
        seconds=12,
        clean_stretch=True,
        loop_blend=24,
        # Right up to the rail: no band of still water along the boat. Not
        # the map's rough `dry` polygon but each boat's own rail line
        # (RAIL_LINES in make_boats.py), to the pixel.
        rail_lines=True,
        feather=2,                       # (the far edge, at the horizon)
        prompt=(
            "In a single continuous shot, the camera locked off on the boat: "
            "the open tropical ocean seen from the cockpit of a big-game "
            "fishing boat that is sailing forward at a steady speed. Right "
            "behind the stern the broad white wake churns, foams and boils and "
            "streams steadily away toward the horizon; the deep blue swells "
            "beside it roll past, small white caps break and sunlight glitters "
            "on the water. The motion is fast, lively, steady and continuous "
            "from the first to the last frame -- the water never slows down "
            "or stops, and there are no cuts. The boat's teak deck, its white "
            "stern and varnished rails, the island and the birds do not move: the "
            "camera is fixed to the boat. " + STILL_RULES +
            " Sound: the steady rumble of boat engines and rushing, churning "
            "water. No music, no voices."
        )),
    # The ice: the water, and the fire in its bowl beside the igloo.
    "antarctica": dict(
        painting="backdrop-antarctica",
        flames=[[[0, 470], [170, 470], [170, 650], [0, 650]],      # the fire
                [[135, 250], [205, 250], [205, 470], [140, 470]]],  # its smoke
        prompt=(
            "A calm polar sea at the edge of the Antarctic ice, gently alive. "
            "Small ripples drift slowly across the dark blue water and the low "
            "sun glitters on it; in the clear turquoise water at the foot of the "
            "ice cliff the light plays softly; tiny wavelets lap against the ice "
            "with a little white foam. In the bottom-left corner the small fire in "
            "the black iron bowl burns: its orange flames flicker and dance, and "
            "a thin wisp of grey smoke drifts up and away. The motion of the water "
            "is the same, gentle and regular, all the way through: no big wave, no "
            "splash. The ice, the igloo, the iron bowl, the icebergs, the "
            "mountains, the penguins and the polar bears do not move. "
            + STILL_RULES +
            " Sound: small waves lapping against ice, the crackle of a small "
            "fire, penguins calling far away. No music, no voices."
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


def dry_land(map_id, width, height):
    """
    Where the map's jetty, pier or pontoon stands (its `dry` polygon in
    src/data/maps.js), as a mask in painting pixels: True = not water.
    """
    js = ("import('./src/data/maps.js').then((m) => "
          "console.log(JSON.stringify(m.getMap(process.argv[1]).dryParts)))")
    out = subprocess.run(["node", "--input-type=module", "-e", js, map_id],
                         cwd=ROOT, check=True, capture_output=True, text=True).stdout
    return polygons_mask(json.loads(out), width, height)


def polygons_mask(polygons, width, height):
    """Polygons in design coordinates -> a mask in painting pixels."""
    mask = Image.new("L", (width, height), 0)
    for polygon in polygons:
        points = [(x * width / 1280.0, (y + 120.0) * height / 960.0) for x, y in polygon]
        if len(points) >= 3:
            ImageDraw.Draw(mask).polygon(points, fill=255)
    return np.asarray(mask) > 0


def far_shore(map_id, width, height):
    """Painting row of the map's far shore or horizon: no water above it."""
    return min(y for _, y in waterline(map_id, width, height))


def film_frame(painting):
    """The 16:9 frame Veo starts from."""
    img = Image.open(RAW / f"{painting}.png").convert("RGB")
    top = round(img.height * WINDOW_TOP)
    return img.crop((0, top, img.width, img.height)).resize(FILM_SIZE, Image.LANCZOS)


def clean_stretch(clip):
    """
    The longest stretch of the film that keeps moving: without a cut (a
    sudden jump to another picture) and without the water standing still.
    (Gemini Omni's first ocean film, November 2026, moved for two seconds,
    jumped, and then hardly moved at all -- on the iPad: bursts of motion
    and stillness.)
    """
    small = clip[:, ::8, ::8].astype(np.float32) @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    step = np.abs(np.diff(small, axis=0)).mean(axis=(1, 2))
    typical = np.percentile(step, 75)
    local = ndimage.median_filter(step, size=9, mode="nearest")
    good = (step > typical * 0.35) & (step < local * 2.5)
    best, run_from, best_from = 0, 0, 0
    for i, ok in enumerate(list(good) + [False]):
        if not ok:
            if i - run_from > best:
                best, best_from = i - run_from, run_from
            run_from = i + 1
    first, last = best_from, best_from + best       # frames first..last
    print(f"       clean stretch: frames {first}-{last} of {len(clip)} "
          f"({(last - first + 1) / FPS:.1f} s; motion {step[first:last].mean():.1f} per frame)")
    if (last - first + 1) < FPS * 4:
        sys.exit("less than four seconds of steady motion: generate the film again")
    return clip[first:last + 1]


def read_clip(path, size):
    """All frames of a video as one uint8 array (frames, height, width, 3)."""
    width, height = size
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path),
         "-vf", f"scale={width}:{height}:flags=lanczos,gblur=sigma={FILM_SOFTEN}",
         "-r", str(FPS), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, height, width, 3)


def compose(map_id, painting=None):
    spec = dict(WATER[map_id])
    if painting:
        # Another painting with the same water (the boats of the big ocean:
        # scripts/make_boats.py): the same film, laid over that one.
        spec["painting"] = painting
    clip_path = WORK / f"veo-{map_id}.mp4"
    if not clip_path.exists():
        sys.exit(f"missing {clip_path.relative_to(ROOT)}: run without --compose first")

    still = Image.open(RAW / f"{spec['painting']}.png").convert("RGB").resize(OUT_SIZE, Image.LANCZOS)
    still = np.asarray(still).astype(np.float32)
    width, height = OUT_SIZE
    top = round(height * WINDOW_TOP)
    clip = read_clip(clip_path, (width, height - top))       # film, back at painting scale
    if spec.get("clean_stretch"):
        clip = clean_stretch(clip)
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
    if spec.get("all_water"):
        # The open sea from a sailing boat: all of it moves -- also the white
        # foam of the wake and the deep blue swell, which change too little
        # in brightness for the measure above. All but the deck is film.
        water[:] = True
    feather = spec.get("feather", MASK_FEATHER_PX)
    first_row = max(top + MASK_FEATHER_PX * 3,                  # the film's own top edge
                    round(far_shore(map_id, width, height)))
    water[:first_row] = False
    # Never what the anglers sit on: a floating pontoon bobs in the film, and
    # even a fixed jetty's planks shimmer a little. It stays the painting.
    # (`dry_margin` below zero: the film reaches a few px onto the dry
    # edge itself -- a boat's rail is fixed to the camera and as sharp in the
    # film as in the painting, so no band of still water is left beside it.)
    dry = (np.zeros((height, width), dtype=bool) if spec.get("rail_lines")
           else dry_land(map_id, width, height))
    margin = spec.get("dry_margin", DRY_MARGIN_PX)
    if margin > 0:
        dry = ndimage.binary_dilation(dry, iterations=margin)
    elif margin < 0:
        dry = ndimage.binary_erosion(dry, iterations=-margin)
    water &= ~dry
    # A fire on the ice (`flames`, design coordinates): there, too, the film
    # -- where it moves: the flames and the smoke, not the iron bowl.
    if spec.get("flames"):
        lively = np.zeros((height, width), dtype=bool)
        lively[top:top + rows * k, :cols * k] = np.kron(
            ndimage.binary_closing(blocks.std(axis=0) > MOTION_MIN, iterations=2),
            np.ones((k, k), dtype=bool))
        water |= polygons_mask(spec["flames"], width, height) & lively
    # ...then pull the edge in a little and soften it.
    pad = MASK_FEATHER_PX * 4
    water = ndimage.binary_erosion(np.pad(water, pad, mode="edge"), iterations=feather)
    mask = ndimage.gaussian_filter(water.astype(np.float32), feather)[pad:-pad, pad:-pad]
    if spec.get("rail_lines"):
        # A boat: the film down to the very top of its rail, edge smooth
        # but sharp (the rail's edge is sharp in film and painting alike).
        from make_boats import boat_of_painting, sea_above
        mask *= sea_above(boat_of_painting(spec["painting"]), (width, height))
    Image.fromarray((mask * 255).astype(np.uint8)).save(WORK / f"water-mask-{map_id}.png")

    # --- colour: the film's first frame IS the painting, so any overall
    # difference between the two is a colour shift to undo ------------------
    blur = (COLOUR_BLUR_PX, COLOUR_BLUR_PX, 0)
    first = ndimage.gaussian_filter(clip[0].astype(np.float32), blur)
    # (Over another painting the colours are matched against the map's own:
    # only that one is the film's first frame.)
    match = still
    if spec["painting"] != WATER[map_id]["painting"]:
        match = np.asarray(Image.open(RAW / f"{WATER[map_id]['painting']}.png").convert("RGB")
                           .resize(OUT_SIZE, Image.LANCZOS)).astype(np.float32)
    paint = ndimage.gaussian_filter(match[top:], blur)
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
    blend = spec.get("loop_blend", LOOP_BLEND_FRAMES)
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
    ap.add_argument("--model", default="omni", help="the video model (gen_video.py's MODELS)")
    ap.add_argument("--painting", help="with --compose: lay the film over this painting "
                    "instead (one with the same water, such as a boat of the big ocean)")
    args = ap.parse_args()

    if not args.compose:
        spec = WATER[args.map]
        WORK.mkdir(exist_ok=True)
        frame = WORK / f"veo-{args.map}-frame.jpg"
        film_frame(spec["painting"]).save(frame, "JPEG", quality=95)
        clip = generate(spec["prompt"], frame, WORK / f"veo-{args.map}.mp4",
                        loop=spec.get("last_frame", True), seconds=spec.get("seconds", 8),
                        model=args.model)
        frame.unlink()
        if clip is None:
            sys.exit(1)
    compose(args.map, args.painting)


if __name__ == "__main__":
    main()
