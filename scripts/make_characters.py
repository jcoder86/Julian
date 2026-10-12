"""
Turn the character paintings into what the game shows.

    python scripts/make_characters.py            # everything
    python scripts/make_characters.py julian     # one character
    python scripts/make_characters.py badges     # only the round team pictures

Input: one green-screen painting per pose (assets/raw/char-<who>-<pose>.png,
from scripts/gen_art.py) and, for the dog, a short film of him on a green
screen (work/veo-dirk-<clip>.mp4, from scripts/gen_video.py).

Output, in assets/clean/:
    char_<who>_<pose>.png        one cut-out picture per pose
    dirk_<clip>.jpg + _alpha.png a film strip: all frames in one grid
    characters.json              how they fit together
    team_<team>.png              the faces of a team in rope frames: its button
                                 on the title screen ("Spelen met:")

What "fit together" means
  * Every pose of one boy is a separate painting, so he is never drawn at
    exactly the same size or place twice. The script finds his SEAT (the
    tackle box) in each pose and scales and shifts the pose until the
    seats coincide. In the game a change of pose then reads as the boy
    moving, not as the picture jumping.
  * The boy who stands (Boaz) has no seat; his red boots are measured
    instead.
  * Each pose with a rod gets the position of the rod's TIP: the game ties
    the fishing line to it.
  * All positions in characters.json are in output pixels, relative to the
    character's anchor: the bottom-left corner of the seat, or the ground
    between the feet. `bodyHeight` is how tall the character is in those
    pixels, so the game can show him at any size.

A sheet per character is written to work/ (check-<who>.jpg): every pose on
the common ground line, with the anchor and the rod tip marked.
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, signal

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chroma import bleed, key_green, screen_of      # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
CLEAN = ROOT / "assets" / "clean"
WORK = ROOT / "work"

OUT_SCALE = 0.4           # output pixels per pixel of a painting (the game shows a
                          # boy about 250 px tall; more would only cost memory)
BOY_POSES = ["ready", "castback", "castfwd", "wait", "wait2", "bite", "reel", "reel2", "cheer"]

# A boy on a seat: `seat` is a piece of the tackle box in his "ready"
# painting that his legs never cover (left, top, right, bottom in px).
BOYS = {
    "julian": dict(seat=(235, 742, 482, 973)),
    "james":  dict(seat=(254, 742, 559, 953)),
}
BOAZ_POSES = ["watch", "look", "point", "cheer"]

# The dog's clips: frames per second kept, and the height he is stored at.
DIRK_CLIPS = {"idle": dict(fps=10)}
DIRK_HEIGHT = 170


def load_keyed(path):
    rgba = key_green(np.asarray(Image.open(path).convert("RGB")))
    return np.clip(rgba, 0, 255).astype(np.uint8)


def gray_on_grey(rgba):
    """Luminance of a cut-out laid on mid-grey (so the background is neutral)."""
    a = rgba[..., 3:4].astype(np.float32) / 255.0
    rgb = rgba[..., :3].astype(np.float32) * a + 128.0 * (1.0 - a)
    return rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)


def locate(template, image, scales):
    """
    Find `template` in `image` (both grey), trying it at several sizes.
    Returns (score, scale, x, y) of the best match; x, y is the top-left
    corner of the match in the image.
    """
    best = (-1.0, 1.0, 0, 0)
    for s in scales:
        size = (max(8, round(template.shape[1] * s)), max(8, round(template.shape[0] * s)))
        t = np.asarray(Image.fromarray(template).resize(size, Image.BILINEAR), dtype=np.float32)
        if t.shape[0] >= image.shape[0] or t.shape[1] >= image.shape[1]:
            continue
        t = (t - t.mean()).astype(np.float64)
        ones = np.ones_like(t)
        num = signal.fftconvolve(image, t[::-1, ::-1], mode="valid")
        s1 = signal.fftconvolve(image, ones, mode="valid")
        s2 = signal.fftconvolve(image * image, ones, mode="valid")
        var = s2 - s1 * s1 / t.size
        # A flat patch (plain background) matches nothing: without this its
        # near-zero variance would blow the score up.
        flat = var < t.size * 100.0
        ncc = num / (np.sqrt(np.where(flat, 1.0, var)) * np.sqrt((t * t).sum()))
        ncc[flat] = -1.0
        y, x = np.unravel_index(np.argmax(ncc), ncc.shape)
        if ncc[y, x] > best[0]:
            best = (float(ncc[y, x]), s, int(x), int(y))
    return best


def body_mask(alpha):
    """The figure without thin things such as the rod."""
    solid = ndimage.binary_opening(alpha > 128, iterations=5)
    return solid if solid.any() else alpha > 128


def place(rgba, scale, shift):
    """Scale a cut-out and return it cropped, with where its corner ended up."""
    img = Image.fromarray(rgba, "RGBA")
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    img = img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")
    box = img.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    img = img.crop(box)
    return img, (box[0] + shift[0], box[1] + shift[1])


def make_boy(name, meta):
    spec = BOYS[name]
    master = load_keyed(RAW / f"char-{name}-ready.png")
    left, top, right, bottom = spec["seat"]
    half = 0.5
    def small(rgba):
        g = Image.fromarray(gray_on_grey(rgba).astype(np.uint8))
        return np.asarray(g.resize((round(g.width * half), round(g.height * half)), Image.BILINEAR),
                          dtype=np.float64)
    template = small(master)[round(top * half):round(bottom * half),
                             round(left * half):round(right * half)].astype(np.uint8)

    poses, tiles = {}, []
    body_height = None
    for pose in BOY_POSES:
        src = RAW / f"char-{name}-{pose}.png"
        if not src.exists():
            print(f"[skip] {src.name} not found")
            continue
        rgba = load_keyed(src)
        if pose == "ready":
            score, s, x, y = 1.0, 1.0, left, top
        else:
            score, s, x, y = locate(template, small(rgba), np.linspace(0.7, 1.4, 29))
            x, y = x / half, y / half
        # Bring this pose's seat onto the master's: scale by 1/s, then shift.
        # Anchor = bottom-left corner of the seat piece, which becomes (0, 0).
        scale = OUT_SCALE / s
        anchor = (x * scale, (y + (bottom - top) * s) * scale)
        img, corner = place(rgba, scale, (-anchor[0], -anchor[1]))
        alpha = np.asarray(img.getchannel("A"))
        body = body_mask(alpha)
        cy, cx = ndimage.center_of_mass(body)
        ys, xs = np.nonzero(alpha > 128)
        far = np.argmax((xs - cx) ** 2 + (ys - cy) ** 2)
        tip = (int(xs[far]) + corner[0], int(ys[far]) + corner[1])
        if pose == "ready":
            rows = np.nonzero(body.any(axis=1))[0]
            body_height = int(rows.max() - rows.min())
        out = CLEAN / f"char_{name}_{pose}.png"
        img.save(out, "PNG", optimize=True)
        poses[pose] = dict(file=out.name, w=img.width, h=img.height,
                           ox=round(corner[0]), oy=round(corner[1]), tip=[round(tip[0]), round(tip[1])])
        tiles.append((pose, img, corner, tip, score, s))
        print(f"[ok]   {out.name}  {img.width}x{img.height}  seat match {score:.2f} at x{s:.2f}")
    meta[name] = dict(bodyHeight=body_height, poses=poses)
    check_sheet(name, tiles)


def make_boaz(meta):
    def boots(rgba):
        r, g, b = (rgba[..., i].astype(np.int16) for i in range(3))
        return (r > 140) & (r - g > 70) & (r - b > 70) & (rgba[..., 3] > 128)
    poses, tiles = {}, []
    base_area, body_height = None, None
    for pose in BOAZ_POSES:
        src = RAW / f"char-boaz-{pose}.png"
        if not src.exists():
            print(f"[skip] {src.name} not found")
            continue
        rgba = load_keyed(src)
        red = boots(rgba)
        if base_area is None:
            base_area = red.sum()
        s = float(np.sqrt(red.sum() / base_area))
        scale = OUT_SCALE / s
        ys, xs = np.nonzero(red)
        anchor = (xs.mean() * scale, ys.max() * scale)       # the ground between his boots
        img, corner = place(rgba, scale, (-anchor[0], -anchor[1]))
        if body_height is None:
            body_height = img.height
        out = CLEAN / f"char_boaz_{pose}.png"
        img.save(out, "PNG", optimize=True)
        poses[pose] = dict(file=out.name, w=img.width, h=img.height,
                           ox=round(corner[0]), oy=round(corner[1]))
        tiles.append((pose, img, corner, None, 1.0, s))
        print(f"[ok]   {out.name}  {img.width}x{img.height}  boots x{s:.2f}")
    meta["boaz"] = dict(bodyHeight=body_height, poses=poses)
    check_sheet("boaz", tiles)


def make_dirk(meta):
    clips = {}
    body_height = None
    for clip, spec in DIRK_CLIPS.items():
        src = WORK / f"veo-dirk-{clip}.mp4"
        if not src.exists():
            print(f"[skip] {src.relative_to(ROOT)} not found")
            continue
        probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                "stream=width,height", "-of", "csv=p=0", str(src)],
                               check=True, capture_output=True, text=True).stdout.strip().split(",")
        width, height = int(probe[0]), int(probe[1])
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-r", str(spec["fps"]),
                              "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                             check=True, capture_output=True).stdout
        frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, height, width, 3)
        # The clip ends on its first frame again: leave that double out.
        frames = frames[:-1]
        screen = screen_of(frames[0].astype(np.float32))
        keyed = [np.clip(key_green(f, screen), 0, 255).astype(np.uint8) for f in frames]
        seen = np.max([k[..., 3] for k in keyed], axis=0) > 40
        seen = ndimage.binary_opening(seen, iterations=2)
        ys, xs = np.nonzero(seen)
        pad = 6
        box = (max(0, xs.min() - pad), max(0, ys.min() - pad),
               min(width, xs.max() + pad), min(height, ys.max() + pad))
        first = keyed[0][box[1]:box[3], box[0]:box[2], 3] > 128
        rows = np.nonzero(first.any(axis=1))[0]
        scale = DIRK_HEIGHT / (rows.max() - rows.min())
        fw, fh = round((box[2] - box[0]) * scale), round((box[3] - box[1]) * scale)
        cols = int(np.ceil(np.sqrt(len(keyed) * fh / fw)))
        grid_rows = int(np.ceil(len(keyed) / cols))
        colour = Image.new("RGB", (cols * fw, grid_rows * fh), (128, 128, 128))
        matte = Image.new("RGBA", (cols * fw, grid_rows * fh), (255, 255, 255, 0))
        for i, k in enumerate(keyed):
            cell = Image.fromarray(k[box[1]:box[3], box[0]:box[2]], "RGBA")
            cell = cell.convert("RGBa").resize((fw, fh), Image.LANCZOS).convert("RGBA")
            arr = np.asarray(cell)
            at = ((i % cols) * fw, (i // cols) * fh)
            colour.paste(Image.fromarray(bleed(arr).astype(np.uint8), "RGB"), at)
            white = np.full_like(arr, 255)
            white[..., 3] = arr[..., 3]
            matte.paste(Image.fromarray(white, "RGBA"), at)
        colour.save(CLEAN / f"dirk_{clip}.jpg", "JPEG", quality=88, optimize=True)
        matte.save(CLEAN / f"dirk_{clip}_alpha.png", "PNG", optimize=True)
        cols_first = np.nonzero(first.any(axis=0))[0]
        if body_height is None:
            body_height = DIRK_HEIGHT
        clips[clip] = dict(rgb=f"dirk_{clip}.jpg", alpha=f"dirk_{clip}_alpha.png",
                           fw=fw, fh=fh, cols=cols, count=len(keyed), fps=spec["fps"],
                           # anchor: the ground under the middle of the dog
                           ox=-round((cols_first.min() + cols_first.max()) / 2 * scale),
                           oy=-round(rows.max() * scale))
        kb = ((CLEAN / f"dirk_{clip}.jpg").stat().st_size
              + (CLEAN / f"dirk_{clip}_alpha.png").stat().st_size) // 1024
        print(f"[ok]   dirk_{clip}: {len(keyed)} frames of {fw}x{fh} in a "
              f"{colour.width}x{colour.height} grid, {kb} kB")
    meta["dirk"] = dict(bodyHeight=body_height, clips=clips)


# Round, rope-framed pictures made from the figures (the frame is
# assets/clean/ui-ring.png, see scripts/make_ui.py):
#   team_<team>.png   the faces of the two who fish together: the team's
#                     button on the title screen
# (who, pose or clip, share of the figure's height that is head)
BADGES = {
    "julian": [("julian", "ready", 0.31), ("dirk", "idle", 0.47)],
    "guest": [("james", "ready", 0.31), ("boaz", "look", 0.30)],
}
# Whoever plays as a visitor ("Gast") has no face: one frame with a grey
# silhouette (assets/raw/ui-guest.png), the whole badge drained of colour.
VISITOR = "visitor"
VISITOR_PICTURE = "ui-guest"
FACE_PX = 240            # one framed face (the title screen shows it about 150 px
                         # high, which is 240 on an iPad's screen)


def figure_picture(meta, who, pose):
    """A figure's cut-out picture as it was written to assets/clean/."""
    entry = meta.get(who, {})
    if "poses" in entry:
        return Image.open(CLEAN / entry["poses"][pose]["file"]).convert("RGBA")
    clip = entry["clips"][pose]
    frame = Image.open(CLEAN / clip["rgb"]).convert("RGB").crop((0, 0, clip["fw"], clip["fh"]))
    frame.putalpha(Image.open(CLEAN / clip["alpha"]).getchannel("A").crop((0, 0, clip["fw"], clip["fh"])))
    return frame


def framed(size, fill):
    """
    A picture in the rope ring, `size` px across. `fill(side)` returns the
    square RGBA picture, `side` px, that goes inside the ring.
    """
    ring = Image.open(CLEAN / "ui-ring.png").convert("RGBA")
    alpha = np.asarray(ring.getchannel("A"))
    cy, cx = alpha.shape[0] // 2, alpha.shape[1] // 2
    hole = int(np.argmax(alpha[cy, cx:] > 128))          # centre -> inner edge of the ring
    scale = size / max(ring.size)
    ring = ring.resize((round(ring.width * scale), round(ring.height * scale)), Image.LANCZOS)
    radius = hole * scale + 5                            # tuck the picture under the ring
    side = round(radius * 2)
    ss = 4
    disc = Image.new("L", (side * ss, side * ss), 0)
    ImageDraw.Draw(disc).ellipse([0, 0, side * ss - 1, side * ss - 1], fill=255)
    disc = disc.resize((side, side), Image.LANCZOS)
    inside = fill(side).convert("RGBA")
    inside.putalpha(Image.fromarray(np.minimum(np.asarray(inside.getchannel("A")), np.asarray(disc))))
    out = Image.new("RGBA", ring.size, (0, 0, 0, 0))
    out.alpha_composite(inside, (round(ring.width / 2 - side / 2), round(ring.height / 2 - side / 2)))
    out.alpha_composite(ring)
    return out


def face(img, share):
    """`fill` for framed(): the head of a figure against a summer sky."""
    alpha = np.asarray(img.getchannel("A"))
    body = ndimage.binary_opening(alpha > 128, iterations=6)      # without the rod
    rows = np.nonzero(body.any(axis=1))[0]
    top, height = rows.min(), rows.max() - rows.min()
    cols = np.nonzero(body[top:top + round(height * share)].any(axis=0))[0]
    size = max(cols.max() - cols.min(), height * share) * 1.12
    cx, cy = (cols.min() + cols.max()) / 2, top + height * share * 0.5
    box = [round(v) for v in (cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2)]

    def fill(side):
        picture = Image.new("RGBA", (side, side), (150, 205, 240, 255))
        head = img.crop(box).resize((side, side), Image.LANCZOS)
        picture.alpha_composite(head)
        return picture
    return fill


def whole_picture(path):
    """`fill` for framed(): a square picture as it is."""
    img = Image.open(path).convert("RGB")
    side = min(img.size)
    left, top = (img.width - side) // 2, (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side))
    return lambda size: img.resize((size, size), Image.LANCZOS).convert("RGBA")


def greyed(img):
    """The picture without its colour (and a touch lighter): "nobody in particular"."""
    alpha = img.getchannel("A")
    grey = np.asarray(img.convert("L"), dtype=np.float64)
    grey = np.clip(grey * 0.92 + 26, 0, 255).astype(np.uint8)
    out = Image.merge("RGB", [Image.fromarray(grey)] * 3)
    out.putalpha(alpha)
    return out


def make_badges(meta):
    if not (CLEAN / "ui-ring.png").exists():
        print("[skip] badges: assets/clean/ui-ring.png not found (python scripts/make_ui.py)")
        return
    step = round(FACE_PX * 0.84)
    for team, faces in BADGES.items():
        if any(who not in meta for who, _, _ in faces):
            continue
        discs = [framed(FACE_PX, face(figure_picture(meta, who, pose), share)) for who, pose, share in faces]
        badge = Image.new("RGBA", (FACE_PX + step * (len(discs) - 1), max(d.height for d in discs)), (0, 0, 0, 0))
        for i, disc in enumerate(discs):
            badge.alpha_composite(disc, (i * step, 0))
        badge.save(CLEAN / f"team_{team}.png", "PNG", optimize=True)
        print(f"[ok]   team_{team}.png  {badge.width}x{badge.height}")

    picture = RAW / f"{VISITOR_PICTURE}.png"
    if picture.exists():
        badge = greyed(framed(FACE_PX, whole_picture(picture)))
        badge.save(CLEAN / f"team_{VISITOR}.png", "PNG", optimize=True)
        print(f"[ok]   team_{VISITOR}.png  {badge.width}x{badge.height}")
    else:
        print(f"[skip] team_{VISITOR}.png: {picture.relative_to(ROOT)} not found")


def check_sheet(name, tiles):
    """All poses on one ground line, anchor (red) and rod tip (blue) marked."""
    if not tiles:
        return
    WORK.mkdir(exist_ok=True)
    left = min(c[0] for _, _, c, _, _, _ in tiles)
    top = min(c[1] for _, _, c, _, _, _ in tiles)
    right = max(c[0] + i.width for _, i, c, _, _, _ in tiles)
    bottom = max(c[1] + i.height for _, i, c, _, _, _ in tiles)
    cw, ch = round(right - left) + 20, round(bottom - top) + 40
    cols = min(3, len(tiles))
    sheet = Image.new("RGB", (cols * cw, -(-len(tiles) // cols) * ch), (70, 110, 150))
    draw = ImageDraw.Draw(sheet)
    for k, (pose, img, corner, tip, score, s) in enumerate(tiles):
        x0, y0 = (k % cols) * cw + 10 - round(left), (k // cols) * ch + 30 - round(top)
        sheet.paste(img, (x0 + round(corner[0]), y0 + round(corner[1])), img)
        draw.line([(x0 - 30, y0), (x0 + 250, y0)], fill=(255, 60, 60), width=2)
        draw.ellipse([x0 - 5, y0 - 5, x0 + 5, y0 + 5], fill=(255, 60, 60))
        if tip:
            draw.ellipse([x0 + tip[0] - 7, y0 + tip[1] - 7, x0 + tip[0] + 7, y0 + tip[1] + 7],
                         outline=(60, 160, 255), width=3)
        draw.text(((k % cols) * cw + 8, (k // cols) * ch + 6), f"{pose}  match {score:.2f}  x{s:.2f}",
                  fill=(255, 255, 255))
    sheet.thumbnail((1800, 1800), Image.LANCZOS)
    sheet.save(WORK / f"check-{name}.jpg", quality=88)


def main():
    known = list(BOYS) + ["boaz", "dirk"]
    names = sys.argv[1:] or known
    if names == ["badges"]:
        names = []                       # only the pictures made from the figures
    if set(names) - set(known):
        sys.exit(f"unknown character(s): {', '.join(sorted(set(names) - set(known)))}  (known: {', '.join(known)})")
    out = CLEAN / "characters.json"
    meta = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}
    for name in names:
        if name in BOYS:
            make_boy(name, meta)
        elif name == "boaz":
            make_boaz(meta)
        else:
            make_dirk(meta)
    make_badges(meta)
    out.write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    print(f"[ok]   {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
