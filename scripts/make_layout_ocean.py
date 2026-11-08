"""
A colour-block layout guide for the painting of the big ocean.

    python scripts/make_layout_ocean.py   ->  assets/raw/layout-ocean.png

The first painting of the boat (November 2026) put the fighting chair
where the dog sits, the rods in their holders right where the angler's rod
swings back, and had the boys cast off the side of the boat. This guide
says where things belong, in the game's own design coordinates (x 0..1280,
y -120..840), so that the new painting (scripts/art_prompts.py, `ocean`)
fits the figures and the cast:

    light blue   sky              dark blue   open ocean (it moves: video)
    white        the wake         tan         the teak cockpit deck
    light grey   the boat's white walls: the far gunwale behind the
                 children, and the stern (transom) in front of them
    pink         deck that stays EMPTY: the children and the dog sit there

The children face right, toward the stern; the angler's rod swings back
up-left over the open sea behind the far gunwale (nothing there), then the
lure goes over the stern into the wake.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "raw" / "layout-ocean.png"
W, H = 1448, 1086                 # the size Codex paints at
K = W / 1280                      # design px -> image px


def pt(x, y):
    """Design coordinates (y from -120) to image pixels."""
    return (round(x * K), round((y + 120) * K))


def poly(draw, points, colour):
    draw.polygon([pt(x, y) for x, y in points], fill=colour)


def main():
    img = Image.new("RGB", (W, H), (150, 200, 245))           # sky
    d = ImageDraw.Draw(img)
    HORIZON = 94
    poly(d, [(0, HORIZON), (1280, HORIZON), (1280, 840), (0, 840)], (25, 60, 150))   # ocean
    # The wake: from behind the stern (bottom right) away to the horizon,
    # narrowing toward a point right of the middle.
    poly(d, [(690, 840), (690, 470), (1005, HORIZON + 2), (1040, HORIZON + 2), (1200, 840)],
         (245, 248, 252))
    # The deck: below the far gunwale, left of the stern.
    poly(d, [(0, 500), (690, 520), (640, 840), (0, 840)], (196, 150, 98))
    # The far gunwale: a white wall with a cap rail, behind the children.
    poly(d, [(0, 430), (705, 455), (705, 520), (0, 500)], (215, 218, 222))
    # The stern (transom): a white wall in front of them, from the far
    # corner down to the bottom edge.
    poly(d, [(690, 455), (735, 470), (690, 840), (630, 840)], (215, 218, 222))
    # Where the children and the dog sit: deck, kept empty.
    poly(d, [(120, 520), (600, 525), (600, 760), (120, 760)], (238, 150, 190))
    img.save(OUT)
    print(f"[ok]   {OUT.relative_to(ROOT)}  {W}x{H}")


if __name__ == "__main__":
    main()
