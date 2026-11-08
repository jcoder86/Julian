"""
Turn generated music into the loops the game plays.

    work/music/<source>.wav  ->  assets/audio/music/<key>.mp3

The music of the big ocean was made with ElevenLabs' Music (elevenlabs.io,
model v2.5, instrumental, two variants per description) and listened to
with scripts/listen.py. A generated piece does not loop by itself: it
starts and ends somewhere. Here a stretch of it is cut out and its end is
cross-faded into its own beginning, so that played round and round
(Phaser's `loop`) there is no seam. Then it is brought to the loudness of
the game's other music.

    python scripts/make_music.py              # all of them
    python scripts/make_music.py ocean-fight  # just one

The descriptions:
    ocean        "Warm, adventurous orchestral theme for a children's fishing
                 game on a boat on the wide open ocean, sunny and hopeful: a
                 soaring French horn and strings melody over plucked strings,
                 marimba and light hand percussion, a sense of wide horizons
                 and setting out on a big adventure, relaxed medium tempo
                 around 96 BPM, D major, steady from start to end without a
                 big intro or ending so it can loop. Instrumental, no
                 vocals."  (2 min; "Open Sea Adventure". The other variant
                 built up to brass fanfares: too grand to fish to.)
    ocean-fight  the same, with "Open Sea Adventure" as the reference:
                 "The same warm open-ocean adventure theme, now turned
                 exciting for the big fight with a giant fish on the line:
                 same orchestra and melody, faster and driving at around 132
                 BPM, pounding taiko and timpani drums, urgent staccato
                 strings, bold brass stabs and the French horn theme heroic,
                 full of suspense and energy but fun and never scary, ..."
                 (2 min; "Hooked on the Line", without its finale. The other
                 variant began with twenty seconds of a lone snare drum.)
"""

import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "work" / "music"
OUT = ROOT / "assets" / "audio" / "music"
RATE = 44100

# key -> source, the stretch used (seconds; None = to the end), and its
# loudness (RMS, dB below full scale: the sea's relaxing.mp3 is about -17).
MUSIC = {
    "ocean":       dict(src="ocean-1", start=0.0, end=None, rms=-17.0),
    # (Its last twenty-five seconds build to a final chord: left out.)
    "ocean-fight": dict(src="ocean-fight-1", start=0.0, end=94.0, rms=-16.0),
}
SEAM_S = 3.0              # the end is cross-faded into the start over this long
PEAK_CEILING = 0.89


def decode(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "2", "-ar", str(RATE),
         "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64).reshape(-1, 2)


def looped(x):
    """The stretch with its end laid over its start: it loops without a seam."""
    n = int(SEAM_S * RATE)
    t = np.linspace(0, np.pi / 2, n)[:, None]
    seam = x[-n:] * np.cos(t) + x[:n] * np.sin(t)
    return np.concatenate([x[n:-n], seam])


def make(key):
    spec = MUSIC[key]
    x = decode(SRC / f"{spec['src']}.wav")
    a = int(spec["start"] * RATE)
    b = int(spec["end"] * RATE) if spec["end"] else len(x)
    x = looped(x[a:b])
    x *= 10 ** (spec["rms"] / 20) / np.sqrt(np.mean(x ** 2))
    peak = np.abs(x).max()
    # A rare peak above the ceiling is limited rather than the whole made softer.
    af = ["-af", f"alimiter=limit={PEAK_CEILING}:level=false"] if peak > PEAK_CEILING else []
    out = OUT / f"{key}.mp3"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(RATE), "-ac", "2", "-i", "-",
         *af, "-codec:a", "libmp3lame", "-b:a", "192k", str(out)],
        input=x.tobytes(), check=True)
    print(f"[ok]   {out.relative_to(ROOT)}  {len(x) / RATE:.1f} s, peak {20 * np.log10(peak):.1f} dB"
          f"{' (limited)' if af else ''}")


def main():
    keys = sys.argv[1:] or list(MUSIC)
    unknown = [k for k in keys if k not in MUSIC]
    if unknown:
        sys.exit(f"unknown: {', '.join(unknown)}  (known: {', '.join(MUSIC)})")
    for key in keys:
        make(key)


if __name__ == "__main__":
    main()
