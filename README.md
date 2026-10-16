# Julian's Adventure

A text-free 2D top-down adventure game for a 4-year-old who can't read yet.
Built with **Phaser 3** + **Vite** (vanilla JavaScript, ES modules).

The first minigame is **fishing**.

## Running the game

```bash
npm install
npm run dev
```

Vite opens the browser automatically at `http://localhost:5173/` and drops
you straight into the fishing scene (no title screen during dev).

## Project layout

```
src/
  main.js                     # Phaser config, scene registration
  constants.js                # the design frame and the 4:3 world (no other imports!)
  scenes/
    BootScene.js              # loads everything, then the title
    TitleScene.js             # "Spelen met:" -- a picture per team, and the visitor
    MapSelectScene.js         # where shall we fish?
    FishingScene.js           # the game itself
    CatchDisplayScene.js      # "look what we caught"
    FishingCollectionScene.js # the book of catches: one map's page, or all of them
    BaitSelectionScene.js, FloatSelectionScene.js
  systems/
    Layout.js                 # one camera transform for every screen shape
    Crew.js                   # the figures on the jetty: poses, rod tip, the dog
    FishingLine.js            # the line, in every phase of fishing
    FishFight.js              # a hooked fish: swimming about, runs
    Ui.js                     # lettering, glow, buttons, menus
    ReelOverlay.js            # the reel you crank
    SaveSystem.js             # localStorage wrapper (see "Save data")
    AudioManager.js           # sound wrapper, console fallback if files missing
  data/
    maps.js, teams.js, fish.js, baits.js, floats.js
assets/
  raw/                        # generated source pictures -- not shipped
  clean/                      # what the game loads, made by the scripts
  audio/
scripts/
  gen_art.py, art_prompts.py  # generate pictures (Codex); gen_video.py: film (Veo)
  make_*.py, split_atlas.py   # turn raw pictures into what the game loads
  shipping.js, prune-dist.js  # what of assets/ does not go to the players
  test-save-compat.js         # run by `npm run build`: no update may lose catches
work/                         # not in git: reference photos, Veo's raw clips
```

`vite.config.js` sets `publicDir: 'assets'`, so anything under `assets/` is
served at the dev-server root. Phaser's loader paths reflect that:
`clean/backdrop-sea.jpg`, `clean/char_julian_ready.png`, `audio/sfx/plop.wav`.

## Maps

There are three fishing spots, picked on the map-select screen after the
title (and reachable again through the compass button in the HUD). Each is
a framed painting with its name on a plate; tapping one also says the name.

* **lake** -- Naarden-Vesting: the moat, from a wooden jetty. Float fishing
  with bread, corn, maggots, worms or a bait fish, or lure fishing with a
  spinner or a rubber shad. (The id is still `lake`: it is in every
  player's save data.)
* **france** -- Frankrijk: a mountain lake, from a floating pontoon on wine
  barrels (the game's very first painting, repainted). The same five baits,
  the spinner and a fly; the fish of clear, cold water.
* **sea** -- Noordzee: from a stone harbour pier. Float fishing with a
  lugworm or a bait fish, **or lure fishing** with a feather rig, a spoon or
  a pilk jig.

Everything specific to one spot (painting, optional video, sky mask,
waterline, default bait, music, ambience, name) is one entry in
`src/data/maps.js`; `FishingScene` takes a `{ mapId }` and contains no
specifics of any spot itself.

**Which fish live where** is `MAP_SPECIES` in `src/data/fish.js`: twelve per
map, in the order of that map's page in the collection. A species can live
on more than one map (the catfish does, and is rarer in France: `weightOn`);
its catches are then kept per map -- under its plain id on its first map,
under `<id>@<map>` on the others (`catchKey`), so the French catfish has a
card and a record of its own. A bait says on which maps
it is fished (`maps` in `src/data/baits.js`): the five fresh-water baits and
the spinner serve the moat and the French lake alike; the shad is the
moat's own lure, the fly the French lake's. A lure is only taken by the
fish that hunt: perch, zander and pike (and on the shad the catfish) in the
moat; the trout family, the chub and the bass in France.

**How big, and how rare.** Every species has a record length -- the last
number of its `large` range in `fish.js`, the longest it is known to grow.
A large fish is usually near the low end of its range: the closer to the
record, the rarer (`RECORD_SKEW`). So what makes a catch special is not its
centimetres but how close it comes to the biggest its kind can be -- a
58 cm perch is a rarer catch than a 140 cm catfish. `node
scripts/fish-odds.js` prints what bites on what, per map, and for every
species how often one comes within 10 % of its record -- and how often it
is a giant.

**A giant** is a catch within 5 % of its species' record (`GIANT_SHARE`,
`isGiant` in `fish.js`). It gets the works on the catch screen -- rays of
light turning behind it, a gleam running over it, glints, "Gigantisch!"
above it -- and the voice calls out "Wow! Een gigantische snoek!" instead of
"een grote snoek!". In the fish book its card keeps glittering: golden rays,
a gold star, and the length that did it on gold. Nothing extra is saved for
this: the best length per size, which was already kept, says it -- so a
giant caught before this existed counts too.

How often: about one bite in 80 to 150, depending on the bait. Going by
the lengths alone it was one in 140 to 240, and of the rare species
practically never, which proved a little too rare. So every hooked fish
also has a small chance of being one of **the old ones** of its kind: a
fish from the top 5 %, a giant for certain. That chance follows nature --
the older a kind of fish can get, the more very old ones are about:
`OLD_ONE_PER_YEAR` (0.02 %) for every year in `OLDEST_YEARS`, so 1 in 1000
gobies, 1 in 250 perch, 1 in 100 eels, 1 in 50 sturgeon. The margin of what
counts as a giant is untouched. `node scripts/fish-odds.js --tabel` prints,
per fish, the chance per bite on its best bait, how many of them are large
and how many are giants.

A species id is for ever -- catches are saved under it -- but a species can
be renamed or moved. That happened in October 2026: the first lake's Karper
became the Schubkarper (the mirror carp joined it), its Forel the Bruine
forel and its Forelbaars the Grootbekbaars, and those two moved to France
with the Kopvoorn; the sea's Tonijn and Haai became the Blauwvintonijn and
the Haringhaai. Their catches came along untouched.

### Lure fishing

A lure has no float. Cast, and the reel appears at once: cranking swims
the lure back to the jetty. Somewhere on the way a fish may grab it -- the
"fish on" sign pops up -- and it is hooked there and then: no tap, just
keep cranking, and the same reel is now the normal reel fight. No bite,
and the lure arrives empty: cast again (`LURE_BITE_CHANCE`: 7 retrieves in
10 get a bite).

A lure is ten to fifteen centimetres long itself, so it hooks no small
fish: never the `small` one of a species, and nothing under 20 cm
(`smallestCatchOn` in `baits.js`). A fish that would have been too small
comes as the smallest that is allowed (`catchableSizes` in `fish.js`), so
the species are as common as on any bait and a large one is as rare as it
always was; `fish-odds.js` prints the result.

Far out the lure is drawn as small as a float there (`LURE_SCALE_FAR`) --
on the sea it can be cast to the horizon, and should look it.

**To scale.** Everything on the water is drawn to one scale, `PX_PER_CM`
in `constants.js` (Julian on the jetty, about 85 cm, is 232 px): a lure as
long as it really is (`lengthCm` in `baits.js` -- a spinner 8 cm, a dry
fly 3, a pilker 12), and the fish that follows it, or gets away, as long
as that fish. A lure is drawn from a smoothed small copy of its picture
(`_smallTexture`), so that it does not glitter when it is that small.

**Under water** (`src/systems/LureSwim.js`). The lure lands with a splash
and sinks to the depth it runs at; it swims nose first along the way to
the jetty, and its depth shows -- the deeper, the fainter and the more the
colour of the water (`waterTint` per map), and a touch lower in the
picture. Cranked, it wobbles the way its kind does: a lure's `swim` in
`baits.js` (the spinner whirrs and flashes, the shad wags its tail deep
down, the pilker is jigged up and down, a spoon wobbles wide and flashes,
the dry fly skitters over the surface and never sinks). The faster the
crank, the livelier; near the jetty it comes up. Left alone, it sinks
towards the bottom. The line comes down from the rod, goes into the water
a little in front of the lure -- a bright dimple, and ripples running off
while it is cranked -- and runs on under the surface, fainter, to the
lure's nose (FishingLine's `lure` shape). A fish that is going to bite
shows itself first: a dark shape that follows the lure, closer with every
turn of the reel (`LURE_FOLLOW_SPAN`); at the bite the water boils. On
three in ten retrieves without a bite a fish follows for a while and turns
away (`LURE_REFUSE_CHANCE`). The other tunables are the `LURE_*` constants
in `FishingScene.js` and the constants at the top of `LureSwim.js`.

### The line

`src/systems/FishingLine.js` draws the line from the rod tip to whatever
is on its end, and it looks different in every phase:

* **Before the cast** the rig hangs from the rod tip -- the whole float
  with the bait under it, or the lure -- and swings as the rod moves (a
  small pendulum).
* **The cast.** The rig swings back with the rod, is let go as the rod
  whips forward and flies out; the line trails it in a bow that rises as
  the float comes down.
* **Waiting.** The bow falls onto the water and the line goes slack: it
  droops from the rod, lands on the water a little before the float and
  lies on the surface from there. A nibble or a dive pulls it tighter.
* **Reeling in.** Pulled tight, straight from the tip into the water, with
  a fine shiver. Let go of the reel and it sags a little.

Between shapes the line never jumps: every point of it trails slightly
behind where it should be, the middle more than the ends -- which is what
makes it whip and settle. How slack the line is in which state is the
`LINE_SLACK` table in `FishingScene.js`.

A fish (or lure) is not reeled to the rod tip but to the map's `landing`
spot: on the water, right at the jetty or the foot of the pier. From there
the catch is lifted out. Each map also outlines its jetty or pier (`dry`):
a float cannot land on it. Press **W** in the game to see the castable
water, the jetty cut out of it and the landing spot.

### The one that got away

A hook does not always hold. Of every hooked fish -- any species, on bait
or lure -- 7 % gets off again somewhere during the fight (`ESCAPE_CHANCE`
in `FishingScene.js`). The reel vanishes, the line falls slack, rings
spread where it tore loose and the fish's dark shape darts away; a board
and the voice say "Helaas! De vis is ontsnapt!". Nothing is recorded, and
after a moment the angler can cast again.

### The fight

While a fish is being reeled in (`src/systems/FishFight.js`) it has a
will of its own, and more of it the bigger it is:

* it **swims** -- a small fish hardly, a big one all over the place: it
  picks a spot in the water around the way in, to one side or the other
  or back out, and swims there in a curve; it has weight, so it overshoots
  and swings round before it picks the next (up to 330 px to the side and
  170 px back out from 180 cm, less in the distance and the closer it
  comes);
* a fish of 45 cm or more now and then makes a **run**: for about a second
  it tears off, sideways and away, and takes back some of the line. One run
  per 45 cm of fish, four at most; each takes back 5-9 % of the fight, all
  together never more than 30 %. Cranking through a run is worth a quarter.

During a run the angler holds on with the rod bent double, the reel's
progress ring turns from green to orange, the line shivers, the water
boils where the run starts and rings spread faster from where the line
cuts the water; where it cuts through fast it leaves a wake. The fish
itself stays out of sight: what was caught is a surprise until the catch
screen.

Runs are planned at the start of the fight, at set points along the way,
so a big fish makes the fight longer (about one and a half times for the
largest) but never endless.

## Teams and characters

Under "Spelen met:" the title screen shows one big picture per **team**
(`src/data/teams.js`), its two faces in rope frames: *Julian & Dirk* and
*James & Boaz*. The picture is the button. A team is a save profile -- its
catches are its own -- plus the two figures on the jetty: the boy with the
rod and his buddy. (The second team's profile id is `guest`: that is what
the button was called when James started saving his catches under it.)

Below them, grey and smaller, is **Gast**: the visitor, for trying the game
or testing something. A visitor plays with Julian and Dirk's figures, and
nothing he catches is kept: his profile (`visitor`) lives in memory only,
is empty at every start and never reaches the browser's storage
(`SaveSystem.js`; the save test checks it).

The boys are not animated film but **poses**: nine paintings each of the
boy with the rod (ready, wind-up, cast, two ways of waiting, bite, two of
reeling, cheering) and four of Boaz. `src/systems/Crew.js` picks the pose
that fits what is happening, cross-fades, adds breathing and a hop of joy,
and reports where the rod's tip is -- the fishing line is tied to it.
Dirk the dog *is* film: a loop of frames.

```bash
python scripts/gen_art.py char-julian-bite       # (re)paint one pose
python scripts/make_characters.py                # cut out, line up, write characters.json
```

`make_characters.py` finds the tackle box in every pose and scales and
shifts the pose until the boxes coincide, so a change of pose reads as the
boy moving rather than the picture jumping; it finds each pose's rod tip;
and it writes `assets/clean/characters.json`, which is all the game needs
to know. `work/check-<who>.jpg` shows the result at a glance.

Why poses? Google's Veo refuses to animate pictures of lifelike children,
and the boys are painted from photos to look like themselves. Dogs are
fine: `work/veo-dirk-idle.mp4` is Dirk's master painting brought to life,
which the script turns into a strip of frames (colours as JPEG, the
transparency as a separate PNG -- together a fraction of a transparent
PNG -- put back together when the game starts).

The boys' photos are reference material for the image model only. They
live in `work/photos/` on the owner's computer and are not in git.

The "look what we caught" screen shows the team, so there is one painting
per team and map (`catch-<team>-<map>`).

## Generating artwork

The sea, the Naarden-Vesting painting, the sea fish, the sea tackle, the
map button and the map-select wall were painted by an image model, driven
from the command line through the Codex app / CLI (it must be installed
and signed in: `codex login status`). The brief for every image -- what
to paint, and which existing artwork the model is shown for layout and
style -- is in `scripts/art_prompts.py`.

```bash
python scripts/gen_art.py --list                       # every image by name
python scripts/gen_art.py fish-cod --out-dir try-outs  # a candidate, to look at first
python scripts/gen_art.py fish-cod                     # straight into assets/raw/
```

A fresh image lands in `assets/raw/`; the game loads what the pipeline
makes of it:

| image | then run | result |
| --- | --- | --- |
| `fish-<id>` | `python scripts/split_atlas.py fish-<id>` | `clean/fish_<id>_<size>.png` |
| `sea-baits`, `icon-map` | `python scripts/split_atlas.py baits-sea icon-map` | `clean/bait_<id>_<full/simple>.png`, `clean/icon-map.png` |
| `sea-backdrop`, `naarden` | `python scripts/make_paintings.py` and `python scripts/make_sky_mask.py --image assets/raw/<file>.png --out assets/clean/sky-mask-<map>.png` | `clean/backdrop-<map>.jpg`, `clean/sky-mask-<map>.png` |
| `mapselect-bg`, `start`, `catch-<team>-<map>` | `python scripts/make_paintings.py` | `clean/mapselect.jpg`, `clean/start-friends.jpg`, `clean/catch-<team>-<map>.jpg` |
| `char-<who>-<pose>`, `char-dirk` | `python scripts/make_characters.py` | `clean/char_<who>_<pose>.png`, `clean/characters.json` |
| `clouds-<map>-front-1..2`, `clouds-<map>-back-1..2` | `python scripts/make_clouds.py` | `clean/clouds-<map>-front.png`, `clean/clouds-<map>-back.png` |
| `ui-start`, `ui-ring`, `ui-guest` | `python scripts/make_ui.py`, then `python scripts/make_characters.py badges` | the boards `clean/ui-board-*.png`, `clean/team_<team>.png` |
| `ui-continue`, `ui-card` | `python scripts/make_ui.py` | `clean/ui-continue.png`, `clean/ui-card.png` |
| `ui-wall` | `python scripts/make_paintings.py ui-wall` | `clean/ui-wall.jpg` |

A new backdrop also needs its numbers checked in `src/data/maps.js`: the
waterline (press `W` in the fishing scene to see it drawn over the
painting), for the sea `SEA_SKY` (where the horizon lies), and
`julianAnchor` -- where on the jetty or pier Julian sits; Dirk and the rod
follow him. The jetty or pier itself has to stay in the lower-left corner;
the briefs ask for exactly that.

More detail, in Dutch: [`docs/art-brief.md`](docs/art-brief.md).

## Screen sizes & layout

Every painting in the game (backdrop, start, catch) is **4:3**. The Phaser
canvas is that same 4:3 "world" (1280x960) and uses `Scale.ENVELOP`: it
always **covers** the screen and crops what doesn't fit -- no letterbox
bars on any device.

* 4:3 iPad -- the whole painting is visible.
* Wider screens (phones in landscape, desktop) -- top and bottom are
  cropped. Each scene says which part must survive (the dock in the fishing
  scene, the logo on the title screen, Julian's head on the catch screen).
* Narrower screens -- the sides are cropped instead.
* A phone or tablet held upright gets a wordless "rotate" hint
  (`#rotate-hint` in `index.html`).

Scenes are written in **design coordinates**: the original 1280x720 frame,
which sits in the vertical middle of the world (the painting runs from
design y -120 to 840). `src/systems/Layout.js` positions each scene's
camera and reports the visible rectangle (`layout.view`) and the same
rectangle minus notch / status bar (`layout.safe`):

* things that belong to the painting (Julian, Dirk, the waterline, the
  bobber) use fixed design coordinates and therefore sit on the same spot
  of the painting on every device;
* things that belong to the screen (HUD icons, reel, buttons) are placed
  relative to `layout.safe` in the scene's `_applyLayout()`, which re-runs
  on every resize / rotation;
* DOM layers behind the canvas (backdrop video, clouds, title image) are
  positioned from the same layout via `layout.cssRect()`, so they cannot
  drift apart from what the canvas draws.

Menus (collection, bait / float pickers) use the layout's `frame` mode,
which zooms the camera out just enough to keep their content on screen.

## Asset pipeline

Drop your green-screen PNGs into `assets/raw/` and run:

```bash
pip install -r scripts/requirements.txt
python scripts/process_assets.py
```

What it does:
* Removes #00FF00-ish green chromakey backgrounds.
* **Despills** edges -- clamps any leftover green channel to `max(R, B)`
  so hair, fur, and feathered edges don't keep a green halo.
* Feathers the alpha channel ~0.6px to avoid stair-stepping on diagonals.
* Outputs to `assets/clean/<same-name>.png`.
* Skips anything named `backdrop*.png`: full-screen paintings have no
  background to remove. `scripts/make_paintings.py` turns those into the
  light JPEGs the game loads.

If the chromakey result looks rough on a particular asset (subject is close
to green, or the source isn't green-screen at all), force the AI fallback:

```bash
python scripts/process_assets.py --use-rembg
```

That uses the `rembg` library (heavy dependency, slower, but works on any
background). It is loaded lazily, so you only need to install it if you
plan to use that flag.

### Tuning the chromakey

The two knobs live at the top of `process_assets.py`:

| constant       | meaning |
| -------------- | ------- |
| `CHROMA_LOW`   | green-excess (G - max(R,B)) below this is kept fully opaque |
| `CHROMA_HIGH`  | green-excess above this is fully removed |
| `ALPHA_BLUR_RADIUS` | gaussian blur applied to the alpha channel only |

If you see a green halo, lower `CHROMA_LOW`. If the subject is being eaten
into, raise `CHROMA_HIGH`.

### Adding a fish species

A new species arrives as its own green-screen image: the three sizes side
by side (small, medium, large), each inside a white box -- see
`assets/raw/fish-catfish.webp`. Describe the species in the `FISH` table
of `scripts/art_prompts.py` and `python scripts/gen_art.py fish-<id>`
paints it.

1. Save the image in `assets/raw/` as `fish-<id>.webp` (or `.png`) and add
   a `(file stem, species id)` pair to `FISH_STRIPS` in
   `scripts/split_atlas.py`. The twelve sea species are already listed.
2. Run `python scripts/split_atlas.py fish-<id>` (without a name it
   re-cuts every atlas). The new sprites come out as
   `assets/clean/fish_<id>_<size>.png`.
3. Add the species to `FISH_SPECIES` in `src/data/fish.js` (map, Dutch
   name, baits, rarity weight, cm range per size). Preloading, the catch
   screen and the collection card all follow from that list.
4. Its spoken name ("een kleine haai!", "een haai!", "een grote
   haai!!"): see "The voice" below. Without it a catch is announced by
   applause only.

### The voice

On the catch screen a voice calls out what was caught. The phrases live in
voice atlases: an mp3 with all of them in a row and a JSON that says where
each one starts (`assets/audio/sfx/vissen.mp3` for the first eleven lake
fish, `vissen-zee.mp3` for the sea fish and the catfish, `vissen-3.mp3`
for the newcomers, the renamed fish and the names of the maps,
`stem-spel.mp3` for what the game itself says ("Helaas! De vis is
ontsnapt!"), `vissen-gigant.mp3` for "Wow! Een gigantische ...!" of every
species, `vissen-4.mp3` for the roach by the name on its card (Blankvoorn;
the first recording says "voorn"); the list is `VOICE_ATLASES` in
`src/systems/AudioManager.js`).

The voice plays 15 % louder than its recordings (`VOICE_VOLUME`), except
where a phrase's loudest moment would then clip: that phrase gets as much
as it can take.

A map can make the voice speak up (`voiceVolume` in `maps.js`): on the
pier it is 15 % louder, over the waves, the gulls and louder music. And a
voice file that did not load when the game started is fetched again when
the map screen or a fishing spot opens, or when one of its phrases is
wanted (`reloadMissingVoice`): its fish do not stay silent until the next
start.

They are spoken by ElevenLabs, a whole atlas in one go so every phrase
has the same tone. To add fish, add an atlas rather than redoing one:

1. Give it a name and its species in `ATLASES` in
   `scripts/make_voice_atlas.py` (and the spoken name in `SPOKEN`), then
   `python scripts/make_voice_atlas.py <name> --text` prints the text.
2. Paste that into ElevenLabs' Text to Speech with the voice and settings
   listed at the top of the script, generate, download the mp3 and keep it
   in `work/voice/`.
3. `python scripts/make_voice_atlas.py <name> <download.mp3>` cuts it at
   the pauses, matches the loudness of the first atlas and writes the mp3
   and JSON. It stops if it does not find exactly the phrases asked for.
   (Phrases that open with a cry and a pause -- "Wow! ... een gigantische
   snoek!" -- need `OPENING_CRY_S` for their atlas, or each comes out as
   two.)
4. `python scripts/make_voice_atlas.py <name> --check` lets Gemini listen
   to every phrase as the game will play it and compares it with the text.
   Then listen yourself: a machine does not hear an odd accent.
5. Add the name to `VOICE_ATLASES`.

When a species is added, add its giant too: a line in `GIANTS` in the
script, and a new atlas with just that phrase (an atlas is not redone).

How rare a catch is follows from `speciesWeight`, `sizeWeights` and
`lengthCm` in `src/data/fish.js`; `node scripts/fish-odds.js` prints the
exact odds per bait -- of every species, of a fish longer than 150 cm and
of a tuna or shark of over two metres. Run it after changing a weight.

The collection screen is a 4 x 3 grid per map and each map currently has
exactly 12 species; a 13th on one map needs a layout change in
`FishingCollectionScene.js`. A tap on a card says the fish's name ("een
snoek!", the phrase without a size). From the fishing screen it opens on that map's
page; the card "Alle vissen" on the map screen opens the whole book, every
map's page under the other, to scroll through (drag, flick or mouse wheel).

## Moving water

Each map's water moves: the backdrop is a short looping video of the
painting in which only the water is alive. `scripts/make_water.py` makes
it:

```bash
python scripts/make_water.py sea             # generate (paid) + compose
python scripts/make_water.py lake
python scripts/make_water.py sea --compose   # only redo the composing
```

1. The lower three quarters of the 4:3 painting are almost exactly 16:9.
   That frame goes to Google's **Veo** video model as the first *and* the
   last frame of an 8-second clip, with a prompt that locks the camera
   and lets only the water move (`scripts/gen_video.py`).
2. The script measures where the clip actually moves and lays just that
   -- the water -- back over the original painting. Jetty or pier, walls,
   trees and sky stay the still painting: sharp, and rock solid under
   Julian. (Veo redraws stone and wood with a grain that shimmers.)
3. The end of the clip is dissolved into its beginning, so the loop has
   no jolt, and the result is encoded to `assets/clean/backdrop-<x>.mp4`
   (1440x1080, 4-5 MB, no sound).

In the game (`backdropVideo` in `src/data/maps.js`) the still painting is
shown at once and the video fades in over it when it has loaded. On an
iPhone or iPad in Low Power Mode videos do not autoplay; the water then
simply stays still.

**It costs money.** Veo has no free tier: a clip with the default "fast"
model is about one US dollar (`python scripts/gen_video.py --prices`).
The API key is read from `GEMINI_API_KEY` in the environment or in a
`.env` / `.env.txt` file in the project root (git-ignored). Veo's raw
clips, `work/veo-<map>.mp4`, are 30 MB each: `work/` is not in git and not
part of the published game. As long as they are on disk `--compose`
re-uses them for free. They also carry a sound track Veo made up (waves,
birds) that is not used yet.

Want different water (wilder, calmer)? Change the map's prompt in
`WATER` at the top of `scripts/make_water.py`. Ask for calm and even
motion: the first sea clip had one big wave crash over the pier, right
where Julian sits, every eight seconds.

### Foreground layer

Anything near-camera that should stay in front of the drifting clouds
goes in `assets/raw/foreground.png` -- typically the overhanging tree
branch baked into the backdrop. The layer is rendered at depth 3
(above clouds, below characters), cover-scaled to the canvas just like
the backdrop, so its silhouette stays pixel-aligned.

Constraints:

* Same aspect ratio as the backdrop so cover-scaling lines up.
* **Native PNG transparency** -- not green-screen. The python pipeline
  skips any filename prefixed `foreground`.
* Transparent everywhere except where the foreground element sits.

How to make it: open `backdrop.png` in Photopea (free, in-browser) or
Photoshop, erase everything except the tree branch (or whatever you
want in the foreground), save as `foreground.png` in `assets/raw/`.

If the file is missing the layer just doesn't render -- clouds will
visibly pass over the tree branch, which looks slightly off but is not
a crash.

The layer gets a gentle programmatic sway (rotation tween) so the branch
appears to move in the wind even though the PNG itself is static. Tune
via `FOREGROUND_SWAY_AMPLITUDE` (degrees) and `FOREGROUND_SWAY_PERIOD_MS`
in `FishingScene.js`. Set amplitude to 0 if you later upgrade to a true
animated foreground (e.g. an alpha-channel WebM that already moves).

### Clouds

Clouds are **separate layers** that drift sideways for ever: DOM strips
behind the transparent canvas and in front of the backdrop. The backdrop
itself has a clean, **cloud-free sky**. Which layers a map shows, how
tall, how fast and how opaque, is its `clouds` list in `src/data/maps.js`.

To make the clouds belong in a painting they are painted **into that
painting's own sky** and then lifted off it again:

```bash
python scripts/make_clouds.py plates          # an empty copy of each map's sky
python scripts/gen_art.py clouds-lake-front-1 clouds-lake-front-2 clouds-lake-back-1 clouds-lake-back-2
python scripts/make_clouds.py lake            # lift the clouds off, join the strips
```

1. `plates` reads how the sky of the map's painting runs from top to
   bottom and writes it as an empty sky (`assets/raw/sky-plate-<map>.png`).
2. The image model paints clouds into that plate, in the style and the
   light of the map's painting -- golden in the late afternoon over
   Naarden, clean white at noon over the sea. Two different strips per
   layer: big clouds high up for the near layer, small ones low down for
   the far layer.
3. `make_clouds.py` treats the sky as a blue screen: how much less blue a
   pixel is than the clear sky on its row tells how much cloud is in it,
   and the cloud's own colour is what remains when the sky's share is
   taken out. A wisp stays a wisp. The two strips of a layer are laid end
   to end, which makes the layer wider than the screen: no cloud is ever
   on screen twice.

A sky only changes from top to bottom and clouds only drift sideways, so
a lifted cloud always sits on the same blue it was painted on: in the
game it looks exactly as it was painted.

The strips are masked with the map's sky mask
(`assets/clean/sky-mask-<map>.png`), an alpha image of where the painting
is sky, so clouds pass **behind** the tree tops, the church tower and the
sea's horizon on every screen shape. The mask is generated from the
painting; re-run this whenever a backdrop changes (and then make the
plates and the clouds again):

```bash
python scripts/make_sky_mask.py --image assets/raw/backdrop-naarden.png --out assets/clean/sky-mask-naarden.png
python scripts/make_sky_mask.py --image assets/raw/backdrop-sea.png --out assets/clean/sky-mask-sea.png
```

(needs Pillow / numpy / scipy; reading a video instead needs `ffmpeg` on
the PATH). If the mask is missing the clouds simply render unmasked.

## Menus and buttons

Everything one taps outside the fishing itself is carved wood and rope,
after the title sign -- and paper pinned to that wood, for what is written
down. `src/systems/Ui.js` holds the shared pieces (the lettering, the
breathing glow, the press-dip, the menu of choices).

The map screen has a third, small framed picture in its top-left corner:
the title painting, with "Startmenu" on a plate under it. It leads back to
the title screen, where the other team can take over.

* **The teams** on the title screen: each face in a round rope frame
  (`ui-ring`), two to a picture. The visitor's is one frame with a grey
  silhouette (`ui-guest`), the whole of it drained of colour.
* **Go on fishing** (`ui-continue`): a round green button with a rod, a
  float and an arrow, in the style of the icons in the fishing screen. It
  closes the catch screen and the collection.
* **The collection**: a paper card per species (`ui-card`, with a brass
  pin in each top corner) on the bare plank wall of the cabin (`ui-wall`).
  What is on a card is written in ink (`written()` in `Ui.js`).
* **Boards**: the blank boards behind the bait and float menus, under a
  caught fish and behind "Spelen met:" are all cut from one generated
  wooden sign (`assets/raw/ui-start.png`) -- its plain left part plus its
  mirror image, as long as the shape asks for -- so they are the same wood.

`scripts/make_ui.py` cuts out the ring, the button and the card and makes
the boards; `scripts/make_characters.py badges` then puts the faces in the
ring.

Lettering uses "Arial Rounded MT Bold", which ships with iPadOS; on other
systems the next rounded or plain font in `UI_FONT` is used.

## Sound

Three layers, loudest last: the **music** of the map (`music` in
`src/data/maps.js`: `ambient.mp3` at the moat, `relaxing.mp3` at sea), the
**ambience** of the place, and the game's own sounds (the plop of the
float, the reel, applause, the voice).

The ambience (`src/systems/Ambience.js`, a map's `ambience`) is a *bed*
that goes round and round -- birdsong at the moat, waves at the pier -- and
sounds that *pass* now and then, each after a random wait: a fish jumping
and the church bells across the water; gulls and a ship's horn far out.
How often and how loud is in `maps.js`; each passing sound also comes from
a slightly different side and at a slightly different volume every time.
The bed is cross-faded into itself rather than looped, so the sliver of
silence at the ends of an mp3 never ticks.

The sounds were made with ElevenLabs' Sound Effects and are prepared by
`scripts/make_ambience.py` (which also lists the descriptions they were
generated from): trimmed, soft-edged, the far-away ones dulled, all brought
to one loudness. `scripts/listen.py <files> --blind` has Gemini describe a
sound file -- useful when whoever makes the sounds cannot hear them, but it
is confidently wrong at times, low drones especially: ask it twice.

## Where things are on a painting

Each map says where its crew sits (`seat`: the bottom-left corner of the
angler's tackle box) and where its water starts (`waterline`), both in
design coordinates, in `src/data/maps.js`. Press **W** in the fishing
scene to see the water drawn over the painting. How tall the figures
stand, and where the buddy is relative to the seat, is per team in
`src/data/teams.js`. A map's painting contains **only** the landscape --
no children, no dog, no clouds.

## Save data

Catches are stored only in the player's own browser (`localStorage`,
prefix `julians_game_`), per team: Julian & Dirk under the plain keys,
James & Boaz under `julians_game_guest_*`. There is no server copy, so:

* an update must never rename a key, a species, a bait or a map id, and
  never clean up at start-up -- `SaveSystem.js` explains, and
  `scripts/test-save-compat.js` (run first by `npm run build`) proves it
  against saves written by the released game;
* on an iPad the home-screen app has its own storage, which is deleted
  when the icon is removed. To pick up an update: open the game, leave it
  open for a minute, close it completely, open it again.

One thing is put into a save from outside. James caught his 176 lake fish
on the guest button of one tablet; the team James & Boaz uses that same
profile but began empty everywhere else. So at start-up, once per device,
`SaveSystem.adoptJamesCatches()` gives James & Boaz his collection
(`src/data/jamesCatches.js`) if they have no lake fish there yet, and --
until 14 October 2026 only -- empties their sea book at that same moment
(on request: a stray fish from trying the team out). Julian's save is not
opened, a device where James & Boaz already have lake fish is left as it
is, and what was taken out is kept under `julians_game_guest_jamesCatchesAdopted`.
The test covers each of these.

One more thing was taken out on request. When the French lake opened, the
chub, bass and trout of the first lake moved there with their old catches,
and both teams had tried the new map out. `SaveSystem.emptyFrenchBooks()`
empties the French page once per team per device -- on devices that start
this version through 19 October 2026 only; after that French catches are
real ones and stay. Only what is on that page goes (a catfish from the moat
is not), and it is kept under `julians_game_franceEmptied` and
`julians_game_guest_franceEmptied`. For the same reason James's chub, bass
and trout are no longer put in on a new device.

To start from an empty collection **on a test machine** (this deletes
every catch stored in that browser):

```js
// in the browser console
Object.keys(localStorage)
  .filter(k => k.startsWith('julians_game_'))
  .forEach(k => localStorage.removeItem(k));
```

## Not there yet

* The children are posed, not filmed (see "Teams and characters").
