"""
Turn the recorded background sounds into the files the game plays.

    work/audio/<source>.wav  ->  assets/audio/ambience/<name>.mp3

A map's ambience (src/data/maps.js, src/systems/Ambience.js) is a "bed"
that goes round and round -- birdsong at the moat, waves at the pier --
plus sounds that come by now and then: a fish jumping, church bells far
off, gulls, a ship's horn.

The sounds were made with ElevenLabs' Sound Effects (elevenlabs.io), four
variants per description; which variant was kept is in SOUNDS below. The
downloads live in work/audio/ (git-ignored). Each is trimmed, given soft
edges, pushed into the distance where it belongs there (a low-pass filter:
far-away sound loses its highs) and brought to a common loudness, so the
volumes in maps.js mean the same for every sound.

    python scripts/make_ambience.py              # all of them
    python scripts/make_ambience.py sea-horn     # just one
    python scripts/listen.py assets/audio/ambience/*.mp3 --blind   # a second pair of ears

The descriptions the sounds were generated from:
    lake-birds  "Gentle birdsong beside a calm pond in a Dutch park on a summer
                morning: a few songbirds, blackbird and chaffinch, soft and
                peaceful, natural field recording. No wind, no water sounds, no
                people, no traffic, no music."  (looping, 20 s)
    lake-bells  "Church tower bells ringing far away in the distance across a
                small old town, soft and mellow, a handful of slow peals that
                fade out, heard from across the water. ..."  (9 s)
    lake-plons  "A fish jumps out of a calm pond and falls back: one single
                soft splash, a small plop followed by gentle ripples, heard
                from a little distance. ..."  (3 s)
    sea-waves   "Calm sea waves gently lapping and washing against the stones
                of a harbour pier, a steady soothing rhythm, close and clear,
                natural field recording. ..."  (looping, 20 s)
    sea-gulls   "Two or three seagulls calling as they fly over a harbour,
                natural herring gull cries, a little distance away, open air,
                natural field recording. ..."  (6 s)
    sea-horn    "Distant ship foghorn: a large cargo ship far away at sea
                sounds one long, deep, mellow horn blast with a natural echo
                over the water, then silence."  (6 s)
    greece-waves  "Gentle sea water at the edge of a rocky shore in summer:
                small waves washing irregularly over and around rocks, uneven
                soft splashes at random moments, water sloshing, gurgling and
                draining between the stones, the faint hiss of a little foam,
                a calm open-air sound with no regular rhythm, natural field
                recording. ..."  (20 s, not looping: the first try, looping,
                had a beat every two seconds -- heard as someone rowing)
    greece-cicadas  "Cicadas singing in the pine trees on a hot summer
                afternoon on a Greek coast: a chorus of cicadas that swells
                up, buzzes and shimmers for a few seconds, and fades away
                again, heard from a little distance, ..."  (8 s)
                (A chapel bell for the Greek coast came out as tinkling
                little bells, jingles and a desk bell; the chapel there rings
                lake-bells.)
    ice-water   the Greek waves (greece-waves-5) with a campfire mixed in:
                "A small campfire burning in an iron fire bowl close by: logs
                crackling and popping softly, the gentle whoosh of the
                flames, an occasional little snap, steady and cosy, ..."
                (20 s). (Waves made for the ice itself sounded like a
                fountain or like rowing.)
    ice-calving "An iceberg calving far away in Antarctica: a deep, distant
                boom like faraway thunder, then a long low rumble rolling
                slowly over the calm sea and fading away. ..."  (7 s)
                (Penguins were tried twice, and came out as shrill
                squawking or as no bird at all: the ice has none.)
"""

import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "work" / "audio"
OUT = ROOT / "assets" / "audio" / "ambience"
RATE = 44100

# name -> source file (without .wav), what kind of sound, and how it is
# treated. `far`: low-pass cut-off in Hz (None = as recorded). `head`,
# `tail`: seconds of fade-in and fade-out. `echo`: the sound comes back off
# the water a few times, and this many seconds are added for that to die
# away in. `stereo`: beds keep their width. `mix`: (another source, dB): it
# is mixed in, that much softer than the main one.
SOUNDS = {
    "lake-birds":  dict(src="lake-birds-4", bed=True, far=None, stereo=True),
    "lake-bells":  dict(src="lake-bells-1", far=3800, tail=2.2),
    "lake-plons":  dict(src="lake-plons-1", far=7000, tail=0.35),
    "sea-waves":   dict(src="sea-waves-2", bed=True, far=None, stereo=True),
    # (Of the gulls, variant 2 sounded like a squeaky toy to a second
    # listener and variant 1 hissed; 3 is the one that is plainly a gull.)
    "sea-gulls":   dict(src="sea-gulls-3", far=5200, tail=0.6),
    # The horn: a blast of about two seconds at 108 Hz. Dry and close it
    # is a buzzer; soft-edged, dull and echoing it is a ship far out.
    "sea-horn":    dict(src="sea-foghorn-2", far=1300, head=0.45, tail=1.6, echo=1.8),
    # The Greek coast. (Of the cicadas only variant 1 is plainly cicadas;
    # the others hiss like a spray can. They come and go slowly.)
    "greece-waves":   dict(src="greece-waves-5", bed=True, far=None, stereo=True),
    # (Low-passed they turn into rain: their song is all around 6 kHz.)
    "greece-cicadas": dict(src="greece-cicadas-1", far=None, head=1.6, tail=2.2),
    # The South Pole: small waves and the fire beside the igloo. (Variant 4
    # is the one that is plainly a campfire; 1 ticks like a clock.)
    "ice-water":   dict(src="greece-waves-5", bed=True, far=None, stereo=True,
                        mix=("ice-fire-4", 0.0)),
    # Variant 2: a boom, then a rumble dying away over six seconds (around
    # 50 Hz -- a tablet's small speaker gives only a hint of it).
    "ice-calving": dict(src="ice-calving-2", far=1500, tail=1.5, echo=1.6),
}
ECHO = "aecho=0.8:0.65:330|700|1250:0.38|0.24|0.13"

# Loudness everything is brought to (RMS of the sounding part, dB below
# full scale), and the ceiling for peaks. A bed is steady, so its level is
# measured over all of it; a passing sound over its loud part only.
BED_RMS_DB = -27.0
PASSING_RMS_DB = -22.0
PEAK_CEILING = 0.85
# A bed's first and last instants are faded, so that even a player that
# leaves a tiny gap at the loop point makes no click. (Ambience.js overlaps
# the end of one round with the start of the next anyway.)
BED_EDGE_S = 0.03
HEAD_S = 0.02            # fade-in of a passing sound
SILENCE_DB = -50.0       # below this a passing sound's start and end are cut off


def decode(path, channels):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", str(channels), "-ar", str(RATE),
         "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, channels)


def filtered(path, far, channels, echo=0):
    """The recording, low-passed (and echoing) if it is to sound far away."""
    if far is None and not echo:
        return decode(path, channels)
    chain = [f"lowpass=f={far}:p=2"] if far else []
    if echo:
        chain += [f"apad=pad_dur={echo}", ECHO]
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-af", ",".join(chain),
         "-ac", str(channels), "-ar", str(RATE), "-f", "f32le", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, channels)


def rms(x):
    return float(np.sqrt((x ** 2).mean()))


def sounding(x):
    """(first, last) sample between which the sound is above SILENCE_DB."""
    win = int(RATE * 0.02)
    n = len(x) // win
    level = np.sqrt((x[:n * win].reshape(n, win, -1) ** 2).mean(axis=(1, 2)))
    loud = np.nonzero(level > 10 ** (SILENCE_DB / 20))[0]
    if not len(loud):
        return 0, len(x)
    return max(0, loud[0] * win - win), min(len(x), (loud[-1] + 2) * win)


def make(name):
    spec = SOUNDS[name]
    src = SRC / f"{spec['src']}.wav"
    if not src.exists():
        print(f"[skip] {name}: {src.relative_to(ROOT)} not found")
        return
    channels = 2 if spec.get("stereo") else 1
    x = filtered(src, spec.get("far"), channels, spec.get("echo", 0))
    if spec.get("mix"):
        other, softer_db = spec["mix"]
        y = filtered(SRC / f"{other}.wav", None, channels)
        n = min(len(x), len(y))
        x = x[:n] + y[:n] * (rms(x[:n]) / rms(y[:n])) * 10 ** (softer_db / 20)

    if spec.get("bed"):
        target = BED_RMS_DB
        measured = rms(x)
        edge = int(RATE * BED_EDGE_S)
    else:
        a, b = sounding(x)
        x = x[a:b]
        target = PASSING_RMS_DB
        # Its loud part: the windows within 20 dB of the loudest one.
        win = int(RATE * 0.05)
        n = max(1, len(x) // win)
        level = np.sqrt((x[:n * win].reshape(n, win, -1) ** 2).mean(axis=(1, 2)))
        measured = float(np.sqrt((level[level > level.max() / 10] ** 2).mean()))
        edge = int(RATE * spec.get("head", HEAD_S))

    gain = min(10 ** (target / 20) / measured, PEAK_CEILING / np.abs(x).max())
    x = x * gain

    ramp = np.linspace(0.0, 1.0, edge)[:, None]
    x[:edge] *= ramp ** (1.5 if spec.get("head") else 1.0)
    tail = int(RATE * spec.get("tail", BED_EDGE_S))
    tail = min(tail, len(x) // 2)
    x[-tail:] *= np.linspace(1.0, 0.0, tail)[:, None] ** 1.5

    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{name}.mp3"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE), "-ac", str(channels),
         "-i", "-", "-codec:a", "libmp3lame", "-b:a", "128k" if channels == 2 else "96k", str(out)],
        input=x.astype(np.float32).tobytes(), check=True)
    print(f"[ok]   {out.relative_to(ROOT)}  {len(x) / RATE:5.2f} s  {'stereo' if channels == 2 else 'mono  '}"
          f"  gain {20 * np.log10(gain):+5.1f} dB  peak {np.abs(x).max():.2f}  {out.stat().st_size // 1024} kB")


def main():
    names = sys.argv[1:] or list(SOUNDS)
    unknown = [n for n in names if n not in SOUNDS]
    if unknown:
        sys.exit(f"unknown: {', '.join(unknown)}  (known: {', '.join(SOUNDS)})")
    for name in names:
        make(name)


if __name__ == "__main__":
    main()
