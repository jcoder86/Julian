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
  constants.js                # GAME_WIDTH / GAME_HEIGHT (no other imports!)
  placeholders.js             # All placeholder shapes -- one file to swap later
  scenes/
    BootScene.js              # Asset preloading + transition to FishingScene
    FishingScene.js
    FishingCollectionScene.js
  systems/
    SaveSystem.js             # localStorage wrapper
    AudioManager.js           # Sound wrapper, console fallback if files missing
  data/
    fish.js                   # 5 fish + weighted-random picker
assets/
  raw/                        # Source images (green-screen sprites + backdrops)
  clean/                      # Output of process_assets.py -- transparent PNGs
  sprites/                    # Reserved for future hand-authored sprites
  audio/
    sfx/                      # cast.mp3, splash.mp3, nibble.mp3, dive.mp3, ...
    music/
scripts/
  process_assets.py           # raw -> clean asset pipeline
  requirements.txt
```

`vite.config.js` sets `publicDir: 'assets'`, so anything under `assets/` is
served at the dev-server root. Phaser's loader paths reflect that:
`clean/backdrop-sea.jpg`, `clean/julian-idle1.png`, `audio/sfx/plop.wav`.

## Maps

There are two fishing spots, picked on a wordless map-select screen after
the title (and reachable again through the compass button in the HUD):

* **lake** -- the moat of Naarden-Vesting, from a wooden jetty: float
  fishing with bread, corn, maggots, worms or a bait fish. (The id is
  still `lake`: it is in every player's save data.)
* **sea** -- from a stone harbour pier: float fishing with a lugworm or a
  bait fish, **or lure fishing** with a feather rig, a spoon or a pilk jig.

Everything specific to one spot (painting, optional video, sky mask,
waterline, default bait, music) is one entry in `src/data/maps.js`; `FishingScene`
takes a `{ mapId }` and contains no lake or sea specifics itself. Each
species (`src/data/fish.js`) and each bait or lure (`src/data/baits.js`)
names the map it belongs to. The collection has one page of 12 per map.

### Lure fishing

A lure has no float. Cast, and the reel appears at once: cranking swims
the lure back to the jetty. Somewhere on the way a fish may grab it -- the
"fish on" sign pops up -- and a tap anywhere on the screen sets the hook;
from there it is the normal reel fight. No bite, or a tap that comes too
late, and the lure arrives empty: cast again. Rings of ripples spread
from the lure while it swims, so it is easy to follow on a choppy sea. The
tunables are the `LURE_*` constants in `FishingScene.js`.

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
| `sea-catch`, `mapselect-bg` | `python scripts/make_paintings.py` | `clean/catch-sea.jpg`, `clean/mapselect.jpg` |
| `clouds-sea-front-1..3`, `clouds-sea-back-1..3` | `python scripts/make_clouds.py` | `clean/clouds-sea-front.png`, `clean/clouds-sea-back.png` |

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
4. Optional voice clips: add `small_<id>` / `medium_<id>` / `large_<id>`
   phrases to `assets/audio/sfx/vissen.json` + `vissen.mp3`, or drop
   separate `assets/audio/voice/<size>-<id>.wav` files. Without them a
   catch is simply announced without a voice.

The collection screen is a 4 x 3 grid per map and each map currently has
exactly 12 species; a 13th on one map needs a layout change in
`FishingCollectionScene.js`.

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

### Decoupled cloud layer (parallax)

Clouds are **separate layers** that scroll horizontally and infinitely:
DOM strips behind the transparent canvas and in front of the backdrop. The
backdrop itself should have a clean **cloud-free sky** -- the cloud layers
do the drifting. Which layers a map shows, how tall, how fast and how
opaque, is its `clouds` list in `src/data/maps.js`.

The sea's two layers are built by `scripts/make_clouds.py` from six
generated strips: three different strips end to end per layer, so a layer
is wider than the screen and no cloud is on screen twice -- a short strip
of look-alike clouds reads as wallpaper over an open sea. The far layer's
clouds are lined up just above the horizon, the near layer's hang higher.

The strips are masked with the map's sky mask
(`assets/clean/sky-mask-<map>.png`), an alpha image of where the painting
is sky, so clouds pass **behind** the tree tops, the church tower and the
sea's horizon on every screen shape. The mask is generated from the
painting; re-run this whenever a backdrop changes:

```bash
python scripts/make_sky_mask.py --image assets/raw/backdrop-naarden.png --out assets/clean/sky-mask-naarden.png
python scripts/make_sky_mask.py --image assets/raw/backdrop-sea.png --out assets/clean/sky-mask-sea.png
```

(needs Pillow / numpy / scipy; reading a video instead needs `ffmpeg` on
the PATH). If the mask is missing the clouds simply render unmasked.

The notes below describe the original single-strip setup and are kept for
the asset requirements; the tunables that actually exist today are each
map's `clouds` list in `src/data/maps.js`.

Drop a transparent-background cloud strip at `assets/raw/clouds.png`:

* Horizontal strip, e.g. 2048x512 (whatever fits the band height).
* **Native PNG transparency** -- not green-screen. The python pipeline
  skips any filename prefixed `cloud` so the file is served as-is.
* **Side-to-side tileable** -- the leftmost column of pixels must match
  the rightmost so the seam is invisible while scrolling. Most AI image
  tools have a "tileable" option, or you can prompt
  *"seamlessly tileable horizontal cloud strip on transparent background"*.

If the file is missing the cloud layer just doesn't render -- the rest
of the scene still works.

Tunables in `FishingScene.js`:

| constant                        | meaning |
| ------------------------------- | ------- |
| `CLOUD_BAND_HEIGHT_RATIO`       | top fraction of canvas devoted to clouds (default 0.50) |
| `CLOUD_SCROLL_SPEED_PX_PER_SEC` | horizontal drift in displayed px/sec (default 6) |
| `CLOUD_ALPHA`                   | layer opacity (default 0.95) |

The source PNG's natural vertical cloud distribution maps proportionally
into the band, so scattering happens at asset-creation time, not in
code. For real depth you can scale up later -- swap the single layer for
multiple stacked `TileSprite`s with different scales/speeds/alphas
(classic parallax stack).

## Asset sprite architecture

The scene prefers **separate** Julian and Dirk sprites so Julian can have
his own cast animation later without Dirk moving along. Asset preference
order in `FishingScene._buildCharacters`:

1. `assets/clean/julian_fishing.png` + `assets/clean/dirk_sitting.png`
   (preferred -- animation-ready)
2. `assets/clean/julian_dirk_fishing.png` (transitional fallback, logs a
   warning to the browser console)
3. Plain grey placeholder rectangle (first-ever run)

For a clean composition, `backdrop.png` must contain **only** the
landscape -- no Julian, no Dirk. The sprite layers handle the characters.

## Tunable visual constants (FishingScene)

Exported from `src/scenes/FishingScene.js` so you can iterate without
hunting through the file:

| constant            | meaning |
| ------------------- | ------- |
| `SPRITE_SCALE`      | Julian sprite height as a fraction of canvas height |
| `DIRK_SCALE`        | Dirk sprite height as a fraction of canvas height |
| `JULIAN_ANCHOR_X/Y` | Julian's bottom-left anchor in canvas coords |
| `DIRK_OFFSET_X/Y`   | Dirk position relative to Julian's anchor |
| `WATER_BOUNDS`      | `{x, y, width, height}` rectangle for cast hit-testing |
| `ROD_TIP_OFFSET_X`  | rod-tip X offset from Julian's top-left, in displayed pixels |
| `ROD_TIP_OFFSET_Y`  | rod-tip Y offset from Julian's top-left, in displayed pixels |

### Calibrating the rod tip

In-game: press **C** to toggle calibration mode. A red dot appears at the
current rod-tip position. **Shift+Click** anywhere on the sprite to set a
new rod tip; the browser console logs the offset values to paste back
into `ROD_TIP_OFFSET_X/Y`. Press **C** again to turn off.

## Save data

Catches persist via `localStorage` under the prefix `julians_game_`. To
reset the collection during testing:

```js
// in browser console
Object.keys(localStorage)
  .filter(k => k.startsWith('julians_game_'))
  .forEach(k => localStorage.removeItem(k));
```

## Out of scope for now

* Title screen
* Overworld scene (sprite `julian_dirk_general.png` is processed by the
  pipeline so it's ready, but not loaded by any current scene)
* Real sprites for the bobber and fish
* Water-shimmer overlay
* Idle animations for Julian / Dirk (Veo pipeline)
