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
`raw/backdrop.png`, `clean/julian_dirk_fishing.png`, `audio/sfx/cast.mp3`.

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
* Skips anything named `backdrop*.png` -- backdrops are used as-is.

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

## Animated backdrop

Drop `assets/raw/backdrop.mp4` next to the static PNG. The scene prefers
the video when present and loops it silently. Constraints:

* **Seamlessly loopable** (first and last frame match) -- otherwise you
  see a hard cut every loop.
* **H.264 MP4** for broad browser compatibility. WEBM/VP9 also fine if
  you swap the loader URL.
* **No audio track** (we mute anyway).
* Aim for 16:9 aspect ratio and < 20 MB so HMR stays snappy.

The python pipeline ignores `backdrop*` files, so MP4s in `raw/` are
served untouched. If both `backdrop.mp4` and `backdrop.png` exist, the
video wins.

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

Clouds are a **separate layer** that scrolls horizontally and infinitely
via Phaser's `TileSprite`. The backdrop video itself should have a clean
**cloud-free sky** -- the cloud layer on top does the drifting, scoped to
the sky band **above** the mountains so the silhouettes never get covered.

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
