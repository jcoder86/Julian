"""
The briefs behind the generated artwork -- one entry per image.

    python scripts/gen_art.py --list            # what can be generated
    python scripts/gen_art.py fish-cod          # (re)generate one image
    python scripts/gen_art.py fish-cod fish-ray # ...or several, side by side

Each entry says where the image goes (`out`), which existing artwork the
image model is shown (`refs`, for layout, composition or style) and what
to paint (`brief`). After generating, run the asset pipeline
(`python scripts/split_atlas.py`, `python scripts/make_sky_mask.py ...`)
as described in docs/art-brief.md.

Keep these in step with the game: a painting's composition (where the pier
is, how high the horizon lies) is matched by numbers in src/data/maps.js.
"""

# ---------------------------------------------------------------------------
# Fish: one strip per species, like assets/raw/fish-catfish.webp
# ---------------------------------------------------------------------------

FISH_STRIP = """\
A sprite sheet for a fishing game, in exactly the same layout and the same
realistic natural-history painting style as the attached reference image
(which shows a catfish).

Subject: {subject}. {view}, with the head on the RIGHT, facing right. Three
specimens in a row from left to right: a small young one, a medium adult
and a large trophy specimen -- each clearly bigger than the one before.

Layout: wide landscape image, about 3:1. Solid flat pure green chroma-key
background (#00FF00) everywhere. Each animal sits inside its own thin white
rectangular outline; the three rectangles stand side by side. The whole
animal -- every fin, the tail, any barbel -- stays well inside its
rectangle and never touches the white line.

No shadows on the background, no water, no text, no labels, no numbers.
Crisp clean edges against the green.{extra}
"""

SIDE = "Side view"
ABOVE = "Seen from directly above (the dark upper side), lying flat"

FISH = {
    "herring":  ("an Atlantic herring (Clupea harengus): slim silver fish, blue-green back, "
                 "single dorsal fin, deeply forked tail", SIDE, ""),
    "whiting":  ("a whiting (Merlangius merlangus): slender cod-family fish, sandy-olive back, "
                 "silver flanks, white belly, three dorsal fins, a small dark spot at the base "
                 "of the pectoral fin", SIDE, ""),
    "mackerel": ("an Atlantic mackerel (Scomber scombrus): blue-green back with dark wavy bars, "
                 "silver belly, small finlets before the forked tail", SIDE, ""),
    "flounder": ("a European flounder (Platichthys flesus): flatfish, oval diamond-shaped body, "
                 "dull olive-brown mottled upper side, both eyes on the upper side, rounded "
                 "tail fin", ABOVE, ""),
    "plaice":   ("a European plaice (Pleuronectes platessa): flatfish, smooth brown upper side "
                 "with bright orange spots, both eyes on the upper side, rounded tail fin",
                 ABOVE, ""),
    "garfish":  ("a garfish (Belone belone): very long, thin, needle-like fish with a long "
                 "pointed beak full of small teeth, green-blue back, silver flanks, dorsal and "
                 "anal fin set far back near the forked tail", SIDE,
                 "\nThe body is drawn straight and horizontal."),
    "seabass":  ("a European sea bass (Dicentrarchus labrax): sturdy silver fish with a "
                 "grey-blue back, a spiny first dorsal fin and a second soft dorsal fin, large "
                 "mouth", SIDE, ""),
    "cod":      ("an Atlantic cod (Gadus morhua): heavy-bodied, olive-brown and speckled with a "
                 "pale lateral line, white belly, three dorsal fins, two anal fins and a single "
                 "barbel under the chin", SIDE, ""),
    "ray":      ("a thornback ray (Raja clavata): kite-shaped flat body with broad pointed "
                 "wings, sandy-brown upper side with darker and lighter blotches and small "
                 "thorns, a thin tail", ABOVE,
                 "\nThe snout points right and the thin tail points left."),
    "conger":   ("a European conger eel (Conger conger): long, thick, muscular, scaleless "
                 "eel-shaped fish, dark slate-grey back, pale belly, one long continuous fin "
                 "along back and tail, large mouth", SIDE,
                 "\nThe body is drawn almost straight and horizontal, with only a gentle curve."),
    "tuna":     ("an Atlantic bluefin tuna (Thunnus thynnus): massive torpedo-shaped body, "
                 "dark metallic blue back, silver-white belly, a row of small yellow finlets, "
                 "crescent-shaped tail", SIDE, ""),
    "shark":    ("a blue shark (Prionace glauca): sleek and slender, deep blue back, bright "
                 "white belly, long pointed snout, long pectoral fins, tall dorsal fin, tail "
                 "with a long upper lobe, mouth slightly open", SIDE, ""),
}

# ---------------------------------------------------------------------------
# Paintings
# ---------------------------------------------------------------------------

SEA_BACKDROP = """\
Repaint the attached lake scene as a view over the open sea from a stone
harbour pier. Keep the same camera position, the same composition and the
same rich, detailed painting style as the reference.

THE PIER. In the lower-left corner, exactly where the wooden jetty is in
the reference -- same position, same size, same viewing angle, same
footprint -- there is now the end of a massive STONE harbour pier: big
weathered grey granite blocks with mortar joints, a flat top surface of
worn stone paving, one rusty iron mooring bollard near the far corner,
seaweed and barnacles on the wall at the waterline. The wall goes straight
down into the sea. The middle of the top surface stays clear and empty (a
boy and a dog are added there later).

THE SEA. Everything else is open sea: deep blue-green water with a gentle
swell, small white-capped waves, soft foam where the water meets the stone.
The sea fills the picture up to a HIGH, perfectly straight, level horizon
that lies about one quarter of the way down from the top edge. No land in
the water, no rocks, no boats.

THE SKY. Clear blue with NO clouds at all, only a soft lighter haze just
above the horizon. A small red-and-white lighthouse on a low distant stone
breakwater at the far right, sitting on the horizon. Nothing else.

No people, no animals, no birds, no text. Bright summer daylight.
4:3 landscape.
"""

SEA_CATCH = """\
Repaint the attached top-down scene so that it takes place on a STONE
harbour pier by the sea. Keep the composition, the camera and the boy
exactly as they are: the same boy with the same face, clothes and pose,
sitting in the same spot in the upper-left, the same size, the same warm
light and the same painting style.

Replace the wooden planks with the top of a stone quay: large, flat, worn
granite paving slabs with clear joints, slightly damp here and there. The
big empty area in the middle and the lower half stays clear and uncluttered
(a caught fish is placed there later).

Replace the pond at the top with seawater: deep blue-green sea with small
waves and white foam lapping against the stone edge. No lily pads, no
pond plants.

Replace the wooden corner posts with rusty iron mooring bollards, and the
grass and plants along the sides with stone edging, a thick coiled mooring
rope and a little seaweed.

Keep the fishing rod lying at the left and the landing net lying at the
right. No text. 4:3 landscape.
"""

NAARDEN_BACKDROP = """\
Repaint the attached lake scene as the moat of Naarden-Vesting, the
17th-century Dutch star-fortress town. Keep the same camera position, the
same composition and the same rich, detailed painting style as the
reference.

KEEP EXACTLY AS IN THE REFERENCE: the wooden jetty in the lower-left corner
(same position, same size, same angle, same planks and posts); the area
covered by water; the clear shallow water with stones in the foreground;
and the height of the far bank -- the far edge of the water stays at the
same height across the whole width of the picture, about 40% down from the
top. The left bank keeps its shape and position.

REPLACE the pine forest and the mountains on the far side with
Naarden-Vesting: long, low, slanting red-brick fortress walls and bastions
rising straight out of the moat, topped with green grass ramparts and big
leafy trees; behind them old Dutch brick houses with red tiled roofs; and
as the landmark the tall square brick tower and long roof of the Grote
Kerk. At the far right a brick town gate with a small arched bridge. The
walls and trees are softly reflected in calm green-blue moat water.

On the left bank: reeds, bushes and a grassy rampart instead of pine trees.

Sky: clear blue with NO clouds at all.

No people, no animals, no boats, no text. Late-afternoon summer light.
4:3 landscape.
"""

MAPSELECT_BACKGROUND = """\
A background painting for the "choose your fishing spot" screen of a
children's fishing game: the inside wall of a cosy fishing cabin, made of
weathered, sun-bleached horizontal wooden planks, seen straight on.

Decorations ONLY near the corners and edges: a fishing net with a few
glass floats draped in the top-left corner, a red-and-white lifebuoy in
the top-right corner, a coil of rope and some colourful fishing floats
along the bottom edge, a small brass ship's lantern at one side.

The whole central area -- about 80% of the width and 60% of the height --
is plain, empty, evenly lit wood: two framed pictures are hung there later.

Warm afternoon light, a soft dark vignette toward the edges. Rich, warm,
detailed digital painting. No text, no letters, no people, no animals.
4:3 landscape.
"""

# ---------------------------------------------------------------------------
# Clouds: loose strips that drift across a map's sky (scripts/make_clouds.py
# joins three strips into one long layer, so no cloud is on screen twice)
# ---------------------------------------------------------------------------

CLOUD_STRIP = """Photorealistic fair-weather cumulus clouds for a sky layer in a game, cut
out against a solid flat pure green chroma-key background (#00FF00).

{what}

Real clouds, as in a sharp photograph of a summer sky over the sea: every
cloud has its own irregular shape and size, with a flat, slightly grey
base and bright billowing tops, soft wispy edges and a few torn-off
fragments drifting beside it. No two clouds look alike; nothing is
repeated, mirrored or evenly spaced. Sunlight from high above, slightly
from the right.

Layout: wide landscape image, about 3:1. Everything that is not cloud is
plain flat green. NO cloud touches the left or right edge of the image:
keep a clear strip of plain green at both sides. No horizon, no sea, no
land, no sun, no birds, no aircraft, no text.
"""

# The near layer: a few big clouds high in the sky.
CLOUDS_NEAR = [
    "Three clouds in the upper two thirds of the image: one large, tall, "
    "towering cloud left of the centre, one medium-sized flatter cloud at "
    "the right and one small cloud between them, higher up. The lower third "
    "of the image is empty green.",
    "Two clouds in the upper two thirds of the image: a long, low, stretched "
    "cloud bank that fills most of the left half, and a compact, puffy, "
    "medium-sized cloud at the right, a little higher. A few small wisps "
    "trail behind them. The lower third of the image is empty green.",
    "Four clouds of clearly different sizes scattered loosely across the "
    "upper two thirds of the image: one big and broad, two small, and one "
    "thin ragged cloud that is breaking up. Wide gaps of empty green between "
    "them. The lower third of the image is empty green.",
]

# The far layer: many small clouds lined up low, just above the horizon.
CLOUDS_FAR = [
    "A loose row of about ten SMALL distant clouds in the lower third of the "
    "image, as cumulus looks far away above the horizon: their flat bases "
    "lie at almost the same height, their sizes vary and some have merged "
    "into short banks. The upper two thirds of the image are empty green.",
    "Distant clouds in the lower third of the image: at the left a denser "
    "bank of small cumulus that have grown together, thinning out to a few "
    "scattered tiny clouds at the right. Flat bases at almost the same "
    "height. The upper two thirds of the image are empty green.",
    "About seven small, well separated distant clouds in the lower third of "
    "the image, with irregular gaps between them -- one clearly bigger than "
    "the others, two very small. Flat bases at almost the same height. The "
    "upper two thirds of the image are empty green.",
]

# ---------------------------------------------------------------------------
# Tackle and icons
# ---------------------------------------------------------------------------

SEA_BAITS = """\
A sprite sheet of SEA-fishing baits and lures for a game, in exactly the
same layout and the same realistic painting style as the attached reference
sheet: 5 columns by 2 rows on a solid flat pure green (#00FF00)
chroma-key background.

Columns, left to right:
  1. a lugworm -- a thick reddish-brown marine worm
  2. a small silver bait fish (a sprat)
  3. a mackerel feather rig
  4. a silver spoon lure
  5. a blue-and-silver pilk jig -- a long, heavy, fish-shaped metal lure

TOP ROW, each item hanging vertically "on the line":
  1. the lugworm threaded on a single steel hook with its eye at the top
  2. the bait fish on a single steel hook, head down
  3. a short length of line with three feathered hooks one below the other
     (white, red and blue feathers), a small swivel at the top and a small
     lead weight at the bottom
  4. the spoon hanging from a steel swivel, a treble hook at its bottom
  5. the jig hanging from a steel swivel, a treble hook at its bottom

BOTTOM ROW, the same five items lying flat and horizontal:
  1. the lugworm alone   2. the bait fish alone
  3. ONE single feathered hook   4. the spoon   5. the jig
For 3, 4 and 5 the line eye is at the LEFT end and the hook at the RIGHT
end.

Every item is one solid, connected object, clearly separated from its
neighbours by plenty of plain green; nothing overlaps or touches. No
shadows on the background, no text, no labels, no grid lines. Crisp edges.
Landscape, about 3:2.
"""

MAP_ICON = """\
A game HUD button in exactly the same style, size and framing as the
attached reference icon: a round, glossy blue button with a polished
silver outer rim and a thin inner silver ring. Instead of the wavy water,
the centre shows a classic compass rose with a red north point, lying on a
small rolled-out old paper map.

Solid flat pure green (#00FF00) background outside the button, no shadow
on the background, no text, no letters. Square image.
"""

# ---------------------------------------------------------------------------

JOBS = {
    "sea-backdrop": dict(out="assets/raw/backdrop-sea.png",
                         refs=["assets/raw/backdrop.png"], brief=SEA_BACKDROP),
    "sea-catch":    dict(out="assets/raw/catch-sea.png",
                         refs=["assets/raw/catch.png"], brief=SEA_CATCH),
    "naarden":      dict(out="assets/raw/backdrop-naarden.png",
                         refs=["assets/raw/backdrop.png"], brief=NAARDEN_BACKDROP),
    "mapselect-bg": dict(out="assets/raw/mapselect.png", refs=[], brief=MAPSELECT_BACKGROUND),
    "sea-baits":    dict(out="assets/raw/baits-sea.png",
                         refs=["assets/raw/baits.png"], brief=SEA_BAITS),
    "icon-map":     dict(out="assets/raw/icon-map.png",
                         refs=["assets/clean/icon-float.png"], brief=MAP_ICON),
}
for _layer, _variants in (("front", CLOUDS_NEAR), ("back", CLOUDS_FAR)):
    for _n, _what in enumerate(_variants, start=1):
        JOBS[f"clouds-sea-{_layer}-{_n}"] = dict(
            out=f"assets/raw/clouds-sea-{_layer}-{_n}.png",
            refs=[], brief=CLOUD_STRIP.format(what=_what),
        )
for _id, (_subject, _view, _extra) in FISH.items():
    JOBS[f"fish-{_id}"] = dict(
        out=f"assets/raw/fish-{_id}.png",
        refs=["assets/raw/fish-catfish.webp"],
        brief=FISH_STRIP.format(subject=_subject, view=_view, extra=_extra),
    )
