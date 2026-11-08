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

We stand in the cockpit and look back over the stern: its flat back wall
runs straight across the picture, and the wake begins right behind the
middle of it. (A first redo, November 2026, had the stern at a slant in
a corner, and looked like the bow.) The children sit on the deck in front
of it; the rod reaches over the stern and the lure goes into the wake.
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
    HORIZON = 82
    poly(d, [(0, HORIZON), (1280, HORIZON), (1280, 840), (0, 840)], (25, 60, 150))   # ocean
    # The wake: it begins right behind the middle of the stern and streams
    # straight back to the horizon.
    poly(d, [(400, 470), (695, HORIZON + 2), (745, HORIZON + 2), (1080, 470)], (245, 248, 252))
    # The stern (transom): the boat's flat back wall, straight across.
    poly(d, [(40, 462), (1240, 462), (1240, 560), (40, 560)], (215, 218, 222))
    # Its cap rail along the top.
    poly(d, [(40, 455), (1240, 455), (1240, 472), (40, 472)], (150, 95, 45))
    # The two sides of the boat, coming toward us at the left and right edge.
    poly(d, [(0, 440), (40, 455), (40, 560), (0, 610)], (215, 218, 222))
    poly(d, [(1280, 440), (1240, 455), (1240, 560), (1280, 610)], (215, 218, 222))
    # The deck in front of the stern.
    poly(d, [(0, 610), (40, 560), (1240, 560), (1280, 610), (1280, 840), (0, 840)], (196, 150, 98))
    # Where the children and the dog sit: deck, kept empty.
    poly(d, [(120, 580), (620, 580), (620, 790), (120, 790)], (238, 150, 190))
    img.save(OUT)
    print(f"[ok]   {OUT.relative_to(ROOT)}  {W}x{H}")


if __name__ == "__main__":
    main()
