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
# Clouds: painted into an empty copy of a map's own sky (the "plate" that
# `python scripts/make_clouds.py plates` writes), then lifted off it again
# by scripts/make_clouds.py. Two strips per layer.
# ---------------------------------------------------------------------------

SKY_CLOUDS = """\
The FIRST image is an EMPTY SKY: nothing but a smooth blue gradient, deep
blue at the top and pale at the bottom edge, where the horizon is. Paint
clouds into it.

{what}

Paint them the way a master of realistic landscape painting would, in the
style and the light of the SECOND reference image: {light}. They must look
soft and airy and belong in this sky -- softly feathered edges that melt
into the blue, gentle shading, a few wisps. Never a hard outline, never a
cut-out or sticker look.

Keep the sky itself exactly as it is everywhere between the clouds: the
same colours, the same smooth gradient. No cloud touches the left or the
right edge of the image; leave clear sky there. Nothing else in the
picture: no land, no sea, no horizon line, no sun, no birds, no aircraft,
no text. The same wide format as the first image.
"""

SKY_LIGHT = {
    "lake": ("a warm late afternoon in summer, low golden sun from the left -- cream "
             "and gold on the clouds' sunny side, soft lilac-grey in their shade"),
    "sea": ("a bright, clear summer day at noon -- clean white tops, soft blue-grey "
            "undersides"),
}
SKY_PAINTING = {"lake": "assets/raw/backdrop-naarden.png", "sea": "assets/raw/backdrop-sea.png"}

# The near layer: a few big clouds, high up.  The far layer: small ones, low.
SKY_LAYERS = {
    "front": [
        "Three large cumulus clouds of clearly different sizes and shapes, loosely "
        "scattered across the upper two thirds of the sky, with wide stretches of open "
        "blue between them. One towers; one is long and low. The bottom third stays "
        "clear.",
        "Two large, majestic cumulus clouds and one small torn-off cloud, in the upper "
        "two thirds of the sky, with wide open blue around them. The bottom third stays "
        "clear.",
    ],
    "back": [
        "Distant clouds low in the sky: a loose band of small clouds across the bottom "
        "third, their flat bases at about the same height, smaller and paler toward the "
        "bottom edge. The upper two thirds stay clear.",
        "A few small, scattered, distant clouds in the bottom third, irregularly spaced, "
        "some merged into a low bank at one side, pale and hazy near the bottom edge. "
        "The upper two thirds stay clear.",
    ],
}

# ---------------------------------------------------------------------------
# The children and the dog: one painting per pose (scripts/make_characters.py
# cuts them out, lines the poses of one child up on his seat and finds the
# rod tip). A boy's own photos are reference material that lives only on
# the owner's computer (work/photos/, not in git).
# ---------------------------------------------------------------------------

STYLE_REF = "assets/raw/char-style.png"      # the look every character follows

CHAR_STYLE = """\
A character painting for a children's fishing game, in exactly the same
rich, realistic, warm storybook-painting style and the same light as the
FIRST reference image.
"""

GREEN = """\
BACKGROUND: solid flat pure green chroma-key (#00FF00) everywhere; no
shadow on it, no ground, no water, no fishing line, no text.
"""

BOYS = {
    "julian": dict(
        look=("a 4-year-old boy with very blond, straight hair with a long "
              "fringe, grey-blue eyes and a cheeky grin, wearing an "
              "olive-green hooded outdoor jacket with a round leaf badge on "
              "the sleeve, khaki cargo shorts, thick cream socks and brown "
              "lace-up hiking boots"),
        seat="the green tackle box with the fish and leaf stickers, exactly as in the first reference image",
        photos=["work/photos/kind-foto-5.jpg", "work/photos/kind-foto-6.jpg"]),
    "james": dict(
        look=("a 7-year-old boy -- clearly a schoolboy, taller and older "
              "than a toddler -- with thick, dark brown, wavy hair, blue "
              "eyes and an open, friendly face, wearing a grey-blue quilted "
              "zip-up jacket, light blue jeans and dark green rubber boots"),
        seat="a sturdy blue tackle box with a grey lid and a fish sticker on its side",
        photos=["work/photos/kind-foto-3.jpg", "work/photos/kind-foto-4.jpg"]),
}

BOY = CHAR_STYLE + """
WHO: {look}. The PHOTOS show the real boy: give the character HIS face,
HIS hair and HIS expression, so that his parents recognise him at once.
{same}
POSE: {pose}

He holds a slim fishing rod with a cork handle and a small spinning reel.

FRAMING: landscape image. He sits on {seat}, in the lower-left part of the
image, seen from the side-front (three-quarter view), his body turned to
the right. The ENTIRE fishing rod, from the butt of its handle to its very
tip, lies inside the image with clear green space around it. Full body,
complete from head to boots; nothing is cropped. He is alone: no dog, no
other people.
""" + GREEN

SAME = ("The LAST reference image is this same boy in the game: keep him "
        "exactly the same -- face, hair, clothes, the seat, the rod, his size "
        "in the image -- and change only the pose.")

BOY_POSES = {
    "ready": "He sits relaxed, the rod resting in both hands and pointing up and to the "
             "right at about 45 degrees, and looks straight at the viewer with a big, "
             "happy grin.",
    "castback": "The wind-up of a cast: he has swung the rod back over his shoulder, so "
                "that it points up and BACKWARDS, to the left, behind his head; both arms "
                "are raised and his body twists back a little. He looks ahead to the "
                "right, at the water, eager and concentrated.",
    "castfwd": "The end of a cast: he has just whipped the rod forward. Both arms are "
               "stretched out in front of him and the rod points forward to the right, "
               "almost level, slightly bent. He leans forward and looks where the bait "
               "will land, mouth open with excitement.",
    "wait": "He is fishing patiently: he holds the rod still in both hands, pointing up "
            "and to the right at about 30 degrees, and watches the water to the right "
            "with calm concentration and a little smile.",
    "wait2": "He is fishing: he holds the rod still in both hands, pointing up and to "
             "the right at about 30 degrees, and has turned his head to glance at the "
             "viewer with a mischievous smile and raised eyebrows.",
    "bite": "A fish bites! He jerks the rod upwards with both hands, so that it points "
            "steeply up and bends in an arc; he leans back, eyes wide open, mouth open "
            "in a surprised, delighted 'oh!'.",
    "reel": "He is fighting a fish: he leans back, the rod pointing up and to the right, "
            "bent in a strong arc; one hand grips the handle, the other turns the reel. "
            "He grins with clenched teeth from the effort.",
    "reel2": "He is fighting a fish: he leans forward, the rod lowered, pointing to the "
             "right and bent; one hand grips the handle, the other turns the reel fast. "
             "He looks along the rod at the water, laughing.",
    "cheer": "He cheers: one fist punched high in the air, the other hand holding the "
             "rod upright beside him; his head is thrown back a little and he laughs "
             "out loud with joy.",
}

BOAZ = CHAR_STYLE + """
WHO: a 4-year-old boy with light brown, tousled, slightly wavy hair, blue
eyes, rosy cheeks and a huge laugh, wearing a blue sweatshirt with a small
colourful print, grey-blue jeans and red rubber boots. The PHOTOS show the
real boy: give the character HIS face, HIS hair and HIS laugh, so that his
parents recognise him at once.
{same}
POSE: {pose}

FRAMING: he STANDS, seen from the side-front (three-quarter view), his body
turned to the right. Full body, complete from head to boots, filling most
of the image's height; nothing is cropped. He holds nothing. He is alone:
no dog, no other people.
""" + GREEN

BOAZ_PHOTOS = ["work/photos/kind-foto-1.jpg", "work/photos/kind-foto-2.jpg"]
BOAZ_POSES = {
    "watch": "He stands bent forward a little, hands on his knees, and peers "
             "curiously at something low down to the right, smiling.",
    "look": "He stands upright, hands behind his back, rocking on his heels, and "
            "looks at the viewer with a broad, happy grin.",
    "point": "He points excitedly with an outstretched arm at something to the "
             "right, eyes wide, mouth open, the other hand on his cheek.",
    "cheer": "He jumps for joy: both arms thrown up in the air, both feet off the "
             "ground, laughing out loud.",
}

DIRK = CHAR_STYLE + """
A brindle French bulldog with a white chest and a white stripe between
his eyes -- the dog from the first reference image, exactly the same dog.
He sits, seen from the side-front (three-quarter view), turned to the
right, looking ahead to the right with bright eyes, mouth a little open.
He is alone. Full body, complete from the tips of his ears to his paws,
in the middle of a wide landscape image with plenty of green on all
sides; nothing is cropped.
""" + GREEN

# ---------------------------------------------------------------------------
# Paintings with the children in them: the title screen and, per team and
# per map, the "look what we caught" screen. The character paintings are
# passed along so the boys and the dog look the same as in the game.
# ---------------------------------------------------------------------------

CAST = {
    "julian": "JULIAN: 4 years old, very blond straight hair with a long fringe, "
              "olive-green hooded jacket, khaki shorts, cream socks, brown boots.",
    "james": "JAMES: 7 years old, the tallest -- a head taller than a 4-year-old; dark "
             "brown wavy hair, grey-blue quilted jacket, jeans, dark green rubber boots.",
    "boaz": "BOAZ: 4 years old, small; light brown tousled hair, blue sweatshirt with a "
            "colourful print, jeans, red rubber boots.",
    "dirk": "DIRK: a brindle French bulldog with a white chest.",
}


def who_is_who(*names):
    """The cast of one painting -- and nobody else may appear in it."""
    lines = "\n".join(f"- {CAST[n]}" for n in names)
    return ("WHO IS IN THE PICTURE (each is shown in his own reference image; keep "
            "faces, hair and clothes exactly as there) -- these and NOBODY else:\n" + lines + "\n")

START_SCREEN = """\
Repaint the title screen of the children's fishing game "Julian's
Visavontuur". The FIRST reference image is the current title screen: keep
its place (a sunny forest stream with a waterfall), its rich, warm,
realistic storybook-painting style, and above all its wooden title sign
with the words "Julian's Visavontuur" -- same lettering, same colours,
same spot in the upper right. The words must read exactly:
Julian's Visavontuur

New: instead of one boy there are now THREE friends and the dog, standing
together on the path at the left, all looking at the viewer and laughing:
Julian in front, holding a fishing rod upright; James behind him, a head
taller, one hand on Julian's shoulder; Boaz next to Julian, waving; Dirk
sitting at their feet. The three boys fill the left half of the picture,
from the bottom edge up to about three quarters of its height.

""" + who_is_who("julian", "james", "boaz", "dirk") + """
The lower right quarter of the picture stays calm and uncluttered --
just the stream -- because two buttons are placed there later.

No other people. No text other than the title sign. 4:3 landscape.
"""

CATCH_SCREEN = """\
Repaint the attached top-down scene (the FIRST reference image) with new
children in it. Keep everything else exactly as it is: the camera looking
straight down, the {ground}, the water along the top, the landing net at
the right, the light and the painting style.

Instead of the boy in the reference, {who} in the UPPER-LEFT corner,
looking up at the viewer and laughing -- small, the same size as the boy
in the reference, and no further right than a third of the picture's
width.

{cast}
The whole middle and the lower half of the picture stay empty and
uncluttered: a caught fish is laid there later. No fish in the painting.
No text. 4:3 landscape.
"""

CATCH_WHO = {
    "julian": ("Julian sits cross-legged with Dirk the dog lying beside him -- just the two of them",
               ["julian", "dirk"], ["char-julian-ready", "char-dirk"]),
    "guest": ("James and Boaz sit side by side, James clearly the taller, Boaz leaning against him",
              ["james", "boaz"], ["char-james-ready", "char-boaz-watch"]),
}
CATCH_GROUND = {
    "lake": ("wooden planks of the jetty", "assets/raw/catch.png"),
    "sea": ("stone slabs of the harbour quay", "assets/raw/catch-sea.png"),
}

# ---------------------------------------------------------------------------
# Buttons and frames (scripts/make_ui.py cuts them out, and makes the blank
# boards of the menus from the START sign). Carved wood and rope, like the
# title sign.
# ---------------------------------------------------------------------------

WOOD_STYLE = """\
Style: exactly the chunky, friendly, hand-painted game art of the wooden
title sign in the reference image -- thick weathered planks with a darker
carved rim, warm brown wood grain, iron nails, a bit of rope.
"""

UI_START = """\
A START button for a children's fishing game, as one wide wooden sign.

""" + WOOD_STYLE + """
A single thick plank, about three times as wide as it is high, with
rounded corners. On its RIGHT two thirds stands the one word START in the
same fat, glossy, three-dimensional lettering as the word "Julian's" on
the reference sign (orange-yellow, dark outline, white shine). The LEFT
third of the plank is plain, empty wood: two round portraits are put
there later. The only text is: START

Seen straight from the front. Solid flat pure green chroma-key background
(#00FF00), no shadow on it, nothing else in the picture. Wide image.
"""

UI_RING = """\
A round picture frame for a portrait in a children's fishing game: a thick
ring of twisted ship's rope around a narrow rim of carved wood, seen
straight from the front, perfectly circular.

""" + WOOD_STYLE + """
The INSIDE of the ring is empty: pure flat green, like the background (a
portrait is put there later). The ring fills the square image almost to
its edges. Solid flat pure green chroma-key background (#00FF00), no
shadow, no text.
"""

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
for _boy, _spec in BOYS.items():
    _master = f"assets/raw/char-{_boy}-ready.png"
    for _pose, _text in BOY_POSES.items():
        _first = _pose == "ready"
        JOBS[f"char-{_boy}-{_pose}"] = dict(
            out=f"assets/raw/char-{_boy}-{_pose}.png",
            refs=[STYLE_REF] + _spec["photos"] + ([] if _first else [_master]),
            brief=BOY.format(look=_spec["look"], seat=_spec["seat"], pose=_text,
                             same="" if _first else SAME),
        )
for _pose, _text in BOAZ_POSES.items():
    _first = _pose == "watch"
    JOBS[f"char-boaz-{_pose}"] = dict(
        out=f"assets/raw/char-boaz-{_pose}.png",
        refs=[STYLE_REF] + BOAZ_PHOTOS + ([] if _first else ["assets/raw/char-boaz-watch.png"]),
        brief=BOAZ.format(pose=_text, same="" if _first else SAME.replace("the seat, the rod, ", "")),
    )
JOBS["char-dirk"] = dict(out="assets/raw/char-dirk.png", refs=[STYLE_REF], brief=DIRK)
JOBS["start"] = dict(
    out="assets/raw/start-friends.png",
    refs=["assets/raw/start.png", "assets/raw/char-julian-ready.png", "assets/raw/char-james-ready.png",
          "assets/raw/char-boaz-watch.png", "assets/raw/char-dirk.png"],
    brief=START_SCREEN)
for _team, (_who, _cast, _chars) in CATCH_WHO.items():
    for _map, (_ground, _layout) in CATCH_GROUND.items():
        JOBS[f"catch-{_team}-{_map}"] = dict(
            out=f"assets/raw/catch-{_team}-{_map}.png",
            refs=[_layout] + [f"assets/raw/{c}.png" for c in _chars],
            brief=CATCH_SCREEN.format(ground=_ground, who=_who, cast=who_is_who(*_cast)))
_SIGN = "assets/raw/start-friends.png"
JOBS["ui-start"] = dict(out="assets/raw/ui-start.png", refs=[_SIGN], brief=UI_START)
JOBS["ui-ring"] = dict(out="assets/raw/ui-ring.png", refs=[_SIGN], brief=UI_RING)
for _map, _light in SKY_LIGHT.items():
    for _layer, _variants in SKY_LAYERS.items():
        for _n, _what in enumerate(_variants, start=1):
            JOBS[f"clouds-{_map}-{_layer}-{_n}"] = dict(
                out=f"assets/raw/clouds-{_map}-{_layer}-{_n}.png",
                refs=[f"assets/raw/sky-plate-{_map}.png", SKY_PAINTING[_map]],
                brief=SKY_CLOUDS.format(what=_what, light=_light),
            )
for _id, (_subject, _view, _extra) in FISH.items():
    JOBS[f"fish-{_id}"] = dict(
        out=f"assets/raw/fish-{_id}.png",
        refs=["assets/raw/fish-catfish.webp"],
        brief=FISH_STRIP.format(subject=_subject, view=_view, extra=_extra),
    )
