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

## Tunable visual constants (FishingScene)

Exported from `src/scenes/FishingScene.js` so you can iterate without
hunting through the file:

| constant            | meaning |
| ------------------- | ------- |
| `SPRITE_SCALE`      | sprite height as a fraction of canvas height (0.55 - 0.65 looks natural) |
| `WATER_BOUNDS`      | `{x, y, width, height}` rectangle for cast hit-testing |
| `ROD_TIP_OFFSET_X`  | rod-tip X offset from the sprite's top-left, in displayed pixels |
| `ROD_TIP_OFFSET_Y`  | rod-tip Y offset from the sprite's top-left, in displayed pixels |

Dial in `ROD_TIP_OFFSET_*` after the sprite is rendered -- pick the values
that put the line origin exactly on the rod tip.

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
