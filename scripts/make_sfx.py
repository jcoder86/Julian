"""
Turn recorded sound effects into the files the game plays.

    work/audio/<source>.wav  ->  assets/audio/sfx/<key>.wav

So far: the sounds of the big ocean (src/scenes/FishingScene.js,
src/scenes/TrophyScene.js). They were made with ElevenLabs' Sound Effects,
four variants per description, and listened to with scripts/listen.py
(--blind: "what is this?"). The downloads live in work/audio/
(git-ignored). Each is trimmed, given soft edges and brought to the
loudness of the game's other sounds.

    python scripts/make_sfx.py                 # all of them
    python scripts/make_sfx.py reel-scream     # just one

The reel that screams when a big fish runs is not a recording: three
descriptions of it came back as a buzzer, a telephone, birdsong, a
balloon and a spray can. A screaming reel IS the clicking of its drag,
so fast that the clicks become a buzz -- so it is made from the game's
own reel clicks (assets/audio/sfx/reel.wav): each click cut out and laid
down again over a hundred times a second, a little higher, speeding up as
the fish takes line and slowing as it tires. (Just playing the click
three times as fast sounded like jingle bells.)

The descriptions the recordings were made from:
    splash-big  "A huge fish leaps out of the ocean and crashes back into
                the water: a big heavy splash with spray, close by, natural
                field recording. No voices, no music."  (3 s; variant 3 --
                2 and 4 are a wave on a beach)
    shutter     "Camera shutter click, close-up: a single crisp mechanical
                shutter of a photo camera. No voices, no music."  (1.2 s;
                variant 3. Asked for with a flash and its whine as well, it
                was a finger snap or a clap.)
    chain       "A heavy fish being hung on a big harbour weighing scale: a
                heavy iron chain rattling and clanking, a creak of the
                scale's spring and a solid metal clunk. ..."  (2 s; variant
                1: a creak, a clank, loose metal settling. A plain "heavy
                iron chain rattling" was keys jingling.)
"""

import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "work" / "audio"
OUT = ROOT / "assets" / "audio" / "sfx"
RATE = 44100

# key -> source and treatment. `tail`: seconds of fade-out at the end.
# `scream`: made from the reel click instead (see above).
SFX = {
    "splash-big":  dict(src="ocean-splash-3", tail=0.8),
    "shutter":     dict(src="ocean-camera-3", tail=0.15),
    "chain":       dict(src="ocean-chain-1", tail=0.3),
    # (Softer than the rest: a buzz this busy is shrill when loud.)
    "reel-scream": dict(scream="reel", seconds=3.0, loudest=-23.0),
}

# The loudest tenth of a second is brought to this (dB below full scale):
# about the splash and the "fish on" the game already has.
LOUDEST_DB = -18.0
PEAK_CEILING = 0.89
SILENCE_DB = -50.0
HEAD_S = 0.005

# The scream: clicks per second over its length (0..1) -- it takes off,
# wavers while the fish runs, and slows. Each click a little higher than
# the crank's (PITCH) and a little different in loudness.
SCREAM_RATE = [(0.0, 45), (0.1, 125), (0.35, 110), (0.55, 140), (0.8, 115), (1.0, 55)]
SCREAM_PITCH = (1.25, 1.5)
GRAIN_S = 0.022


def decode(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(RATE),
         "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def encode(x, path, af=None):
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(RATE), "-ac", "1", "-i", "-"]
    if af:
        cmd += ["-af", af]
    cmd += ["-c:a", "pcm_s16le", str(path)]
    subprocess.run(cmd, input=x.astype(np.float64).tobytes(), check=True)


def loudest_rms(x, win=RATE // 10):
    hops = range(0, max(1, len(x) - win), win // 4)
    return max(np.sqrt(np.mean(x[i:i + win] ** 2)) for i in hops)


def trimmed(x):
    level = 10 ** (SILENCE_DB / 20)
    loud = np.nonzero(np.abs(x) > level)[0]
    return x[loud[0]:loud[-1] + 1] if len(loud) else x


def faded(x, head, tail):
    x = x.copy()
    h, t = int(head * RATE), int(tail * RATE)
    if h:
        x[:h] *= np.linspace(0, 1, h)
    if t:
        x[-t:] *= np.linspace(1, 0, t) ** 2
    return x


def levelled(x, loudest=LOUDEST_DB):
    x = x * (10 ** (loudest / 20) / loudest_rms(x))
    peak = np.abs(x).max()
    return x * (PEAK_CEILING / peak) if peak > PEAK_CEILING else x


def clicks(x):
    """The single clicks of a recording of clicks, each faded out."""
    from scipy.signal import find_peaks
    env = np.convolve(np.abs(x), np.ones(220) / 220, "same")
    peaks, _ = find_peaks(env, height=env.max() * 0.3, distance=RATE // 100)
    n = int(GRAIN_S * RATE)
    fade = np.linspace(1, 0, n) ** 1.5
    return [x[p - 60:p - 60 + n] * fade for p in peaks if 60 <= p < len(x) - n]


def scream(src, seconds, seed=7):
    grains = clicks(decode(OUT / f"{src}.wav"))
    rng = np.random.default_rng(seed)
    out = np.zeros(int((seconds + GRAIN_S) * RATE))
    keys = np.array(SCREAM_RATE)
    t = 0.0
    while t < seconds:
        g = grains[rng.integers(len(grains))]
        k = rng.uniform(*SCREAM_PITCH)
        g = np.interp(np.arange(0, len(g) - 1, k), np.arange(len(g)), g)
        i = int(t * RATE)
        out[i:i + len(g)] += g * rng.uniform(0.75, 1.0)
        rate = np.interp(t / seconds, keys[:, 0], keys[:, 1])
        t += rng.uniform(0.85, 1.15) / rate
    return faded(out[:int(seconds * RATE)], 0.03, 0.6)


def make(key):
    spec = SFX[key]
    out = OUT / f"{key}.wav"
    if "scream" in spec:
        x = scream(spec["scream"], spec["seconds"])
        af = "highpass=f=250,lowpass=f=4500"
    else:
        x = faded(trimmed(decode(SRC / f"{spec['src']}.wav")), HEAD_S, spec.get("tail", 0.2))
        af = None
    x = levelled(x, spec.get("loudest", LOUDEST_DB))
    encode(x, out, af)
    print(f"[ok]   {out.relative_to(ROOT)}  {len(x) / RATE:.2f} s")


def main():
    keys = sys.argv[1:] or list(SFX)
    unknown = [k for k in keys if k not in SFX]
    if unknown:
        sys.exit(f"unknown: {', '.join(unknown)}  (known: {', '.join(SFX)})")
    for key in keys:
        make(key)


if __name__ == "__main__":
    main()
