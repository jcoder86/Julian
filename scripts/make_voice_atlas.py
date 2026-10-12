"""
Turn one spoken recording into a voice atlas: the audio file with all the
phrases in a row plus the JSON that says where each one starts
(assets/audio/sfx/<name>.mp3 + <name>.json). The game says a fish's name
from it when the fish is caught (src/systems/AudioManager.js).

The voice is made with ElevenLabs (elevenlabs.io, Text to Speech), in one
go for the whole atlas so every phrase has the same tone:

    voice       Hugo V - Enthusiastic and Professional
    model       Eleven Multilingual v2
    speed 1.00, stability 50 %, similarity 75 %, style 0 %, speaker boost on
    output      MP3 44.1 kHz 128 kbps

1. `python scripts/make_voice_atlas.py <name> --text` prints the text to
   paste into ElevenLabs: one phrase per line, with a line holding only a
   full stop in between -- that makes the pause the phrases are cut at.
2. Generate, download, and keep the download in work/voice/ (git-ignored).
3. `python scripts/make_voice_atlas.py <name> <download.mp3>` finds the
   phrases (anything between two silences; two that the voice ran together
   are cut apart at the pause between them), checks that there are exactly
   as many as were asked for, brings them to the loudness of the first
   atlas, and writes them out with half a second of silence in between.
4. `... --check` afterwards has Google's Gemini write down what it hears
   in the atlas and compares that with the text (needs the GEMINI_API_KEY
   of scripts/gen_video.py). A machine's ears, but better than none.

A new atlas also has to be listed in VOICE_ATLASES in AudioManager.js.

Besides fish an atlas can hold other phrases (EXTRA): the names of the maps,
spoken when one is chosen.

Usage (from the project root):
    python scripts/make_voice_atlas.py vissen-zee --text
    python scripts/make_voice_atlas.py vissen-zee work/voice/zee-elevenlabs-2026-10-11.mp3
    python scripts/make_voice_atlas.py vissen-zee --check
"""

import argparse
import base64
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "audio" / "sfx"
RATE = 44100

# atlas name -> what is in it: each species and what the voice calls it, in
# the order they are read out. All the small ones come first, then the
# medium ones, then the large ones. A species can be in more than one atlas
# (when its name changed): the game takes the phrase from the newest.
ATLASES = {
    # The first recording (June 2026): the first lake's fish. Its files were
    # made by hand; listed here for --text and --check only.
    "vissen": {
        "roach": "voorn", "rudd": "ruisvoorn", "perch": "baars", "bream": "brasem",
        "tench": "zeelt", "carp": "karper", "pike": "snoek", "zander": "snoekbaars",
        "chub": "kopvoorn", "bass": "forelbaars", "trout": "forel",
    },
    # The twelve sea fish, and the catfish, which had no voice yet.
    "vissen-zee": {
        "herring": "haring", "whiting": "wijting", "mackerel": "makreel",
        "flounder": "bot", "plaice": "schol", "garfish": "geep",
        "seabass": "zeebaars", "cod": "kabeljauw", "ray": "rog",
        "conger": "zeepaling", "tuna": "tonijn", "shark": "haai",
        "catfish": "meerval",
    },
    # October 2026, with the map of France: the fish that are new in the moat
    # and in the French lake, the five whose name became more exact
    # (karper, forelbaars, forel, tonijn, haai) -- and the names of the maps.
    "vissen-3": {
        "goby": "zwartbekgrondel", "carp": "schubkarper", "mirrorcarp": "spiegelkarper",
        "eel": "paling",
        "gudgeon": "riviergrondel", "minnow": "elrits", "barbel": "barbeel",
        "bass": "grootbekbaars", "grayling": "vlagzalm", "trout": "bruine forel",
        "rainbowtrout": "regenboogforel", "char": "beekridder", "salmon": "zalm",
        "sturgeon": "steur",
        "tuna": "blauwvintonijn", "shark": "haringhaai",
    },
}
# Phrases that are not a fish: (key, text), read out after the fish. The
# map names are spoken when a map is chosen (key `map_<id>`).
EXTRA = {
    "vissen-3": [("map_lake", "Naarden-Vesting!"), ("map_france", "Frankrijk!"),
                 ("map_sea", "Noordzee!")],
}
SIZES = ("small", "medium", "large")
PHRASE = {"small": "een kleine {}!", "medium": "een {}!", "large": "een grote {}!!"}

# Finding the phrases: sound is whatever rises above SILENCE_DB (relative to
# full scale), and a phrase ends where it stays below that for MIN_GAP_S.
SILENCE_DB = -40.0
MIN_GAP_S = 0.25
WINDOW_S = 0.01
# The atlas that is written: each phrase gets a little air before and after
# (also inside its marker, so a player that starts a few hundredths off
# still says all of it), and pure silence up to the next one.
LEAD_S = 0.06
TAIL_S = 0.15
GAP_S = 0.5
FADE_S = 0.008
PEAK_LIMIT = 0.89          # -1 dB: never louder than this after the gain
# New atlases are brought to the loudness of the first one.
REFERENCE = "vissen"


def phrases_of(name):
    """[(key, text)] in reading order."""
    fish = [(f"{size}_{species}", PHRASE[size].format(spoken))
            for size in SIZES for species, spoken in ATLASES[name].items()]
    return fish + EXTRA.get(name, [])


def decode(path):
    """Any audio file -> mono float samples at RATE."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(RATE),
         "-f", "s16le", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0


def encode(samples, path):
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16).tobytes()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(RATE), "-ac", "1",
         "-i", "-", "-codec:a", "libmp3lame", "-b:a", "128k", str(path)],
        input=pcm, check=True)


def find_phrases(samples):
    """[(start, end)] in samples: every stretch of sound between two silences."""
    win = int(RATE * WINDOW_S)
    n = len(samples) // win
    rms = np.sqrt((samples[:n * win].reshape(n, win) ** 2).mean(axis=1))
    loud = rms > 10 ** (SILENCE_DB / 20)
    min_gap = int(round(MIN_GAP_S / WINDOW_S))

    found, start, quiet = [], None, 0
    for i, is_loud in enumerate(loud):
        if is_loud:
            if start is None:
                start = i
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet >= min_gap:
                found.append((start * win, (i - quiet + 1) * win))
                start, quiet = None, 0
    if start is not None:
        found.append((start * win, (n - quiet) * win))
    return found


def quietest_run(samples, a, b):
    """The longest stretch of silence inside samples[a:b]: (length, start, end) in samples."""
    win = int(RATE * WINDOW_S)
    n = (b - a) // win
    rms = np.sqrt((samples[a:a + n * win].reshape(n, win) ** 2).mean(axis=1))
    quiet = rms <= 10 ** (SILENCE_DB / 20)
    best, start = (0, a, a), None
    for i, q in enumerate(list(quiet) + [False]):
        if q and start is None:
            start = i
        elif not q and start is not None:
            if i - start > best[0]:
                best = (i - start, a + start * win, a + i * win)
            start = None
    return best


def split_merged(samples, spans, expected):
    """
    Two phrases the voice ran together (a pause shorter than MIN_GAP_S) come
    out as one. While there are too few phrases, cut the one with the
    longest silence inside it at that silence.
    """
    spans = list(spans)
    while len(spans) < expected:
        runs = [quietest_run(samples, a, b) for a, b in spans]
        i = max(range(len(spans)), key=lambda k: runs[k][0])
        length, start, end = runs[i]
        if length < 3:                       # 30 ms: not a pause, a consonant
            break
        a, b = spans[i]
        print(f"  (phrases {i + 1} and {i + 2} ran together: cut at a pause of "
              f"{length * WINDOW_S:.2f} s, {start / RATE:.2f} s into the recording)")
        spans[i:i + 1] = [(a, start), (end, b)]
    return spans


def speech_rms(samples, spans):
    """Loudness of the speech alone: the silences in between do not count."""
    spoken = np.concatenate([samples[a:b] for a, b in spans])
    return float(np.sqrt((spoken ** 2).mean()))


def reference_rms():
    """How loud the first atlas speaks (None if it is not there)."""
    audio, meta = OUT_DIR / f"{REFERENCE}.mp3", OUT_DIR / f"{REFERENCE}.json"
    if not (audio.exists() and meta.exists()):
        return None
    samples = decode(audio)
    marks = json.loads(meta.read_text(encoding="utf-8"))["phrases"].values()
    return speech_rms(samples, [(int(m["start"] * RATE), int((m["start"] + m["duration"]) * RATE))
                                for m in marks])


def build(name, source):
    wanted = phrases_of(name)
    samples = decode(source)
    spans = split_merged(samples, find_phrases(samples), len(wanted))
    if len(spans) != len(wanted):
        for i, (a, b) in enumerate(spans):
            print(f"  {i + 1:3d}  {a / RATE:7.2f} s  {(b - a) / RATE:5.2f} s")
        sys.exit(f"{source}: found {len(spans)} phrases, expected {len(wanted)} -- "
                 f"listen to the recording around the odd one out")

    gain = 1.0
    target = None if name == REFERENCE else reference_rms()
    if target:
        gain = target / speech_rms(samples, spans)
    gain = min(gain, PEAK_LIMIT / max(abs(samples[a:b]).max() for a, b in spans))

    lead, tail, gap, fade = (int(RATE * s) for s in (LEAD_S, TAIL_S, GAP_S, FADE_S))
    ramp = np.linspace(0.0, 1.0, fade)
    pieces, marks, cursor = [np.zeros(gap)], {}, gap
    for (key, text), (a, b) in zip(wanted, spans):
        cut = samples[max(0, a - lead):min(len(samples), b + tail)].copy() * gain
        cut[:fade] *= ramp
        cut[-fade:] *= ramp[::-1]
        marks[key] = {"start": round(cursor / RATE, 3), "duration": round(len(cut) / RATE, 3)}
        pieces += [cut, np.zeros(gap)]
        cursor += len(cut) + gap
        print(f"  {key:16s} {text:26s} {(b - a) / RATE:5.2f} s")

    atlas = np.concatenate(pieces)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    encode(atlas, OUT_DIR / f"{name}.mp3")
    (OUT_DIR / f"{name}.json").write_text(json.dumps({
        "file": f"{name}.mp3",
        "totalDuration": round(len(atlas) / RATE, 3),
        "phrases": marks,
    }, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"{name}: {len(marks)} phrases, {len(atlas) / RATE:.1f} s, gain {20 * np.log10(gain):+.1f} dB"
          f" -> {(OUT_DIR / name).relative_to(ROOT)}.mp3 + .json")


def heard(text):
    """A phrase reduced to its words, for comparing."""
    return re.sub(r"[^a-z ]", "", text.lower()).split()


def check(name, model):
    """Have Gemini write down the atlas, phrase by phrase, and compare."""
    import requests
    from gen_video import API, load_key

    wanted = phrases_of(name)
    meta = json.loads((OUT_DIR / f"{name}.json").read_text(encoding="utf-8"))
    missing = [key for key, _ in wanted if key not in meta["phrases"]]
    if missing:
        sys.exit(f"{name}.json has no entry for: {', '.join(missing)}")
    samples = decode(OUT_DIR / f"{name}.mp3")

    # Each phrase by itself, cut where the game cuts it: this also shows a
    # marker that sits in the wrong place.
    parts = [{"text": (
        "You get a number of very short Dutch audio clips. In each one a man "
        "calls out the name of a fish, e.g. 'een kleine snoek' (a few are the "
        "name of a place instead). Write down "
        "exactly what is said in each clip, one line per clip, in order, as "
        "'<number>: <words>'. Dutch spelling, no commentary. If a clip is "
        "silent or cut off, say so on its line.")}]
    for i, (key, _) in enumerate(wanted):
        m = meta["phrases"][key]
        cut = samples[int(m["start"] * RATE):int((m["start"] + m["duration"]) * RATE)]
        wav = subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "s16le", "-ar", str(RATE), "-ac", "1", "-i", "-",
             "-ar", "16000", "-f", "wav", "-"],
            input=(cut * 32767).astype(np.int16).tobytes(), check=True, capture_output=True).stdout
        parts += [{"text": f"Clip {i + 1}:"},
                  {"inlineData": {"mimeType": "audio/wav",
                                  "data": base64.b64encode(wav).decode("ascii")}}]

    reply = requests.post(
        f"{API}/models/{model}:generateContent",
        headers={"x-goog-api-key": load_key()},
        json={"contents": [{"parts": parts}], "generationConfig": {"temperature": 0}},
        timeout=300)
    if reply.status_code != 200:
        sys.exit(f"Gemini said {reply.status_code}: {reply.text[:300]}")
    text = "".join(p.get("text", "") for p in reply.json()["candidates"][0]["content"]["parts"])
    lines = dict(re.findall(r"^\s*(\d+)\s*[:.]\s*(.+?)\s*$", text, flags=re.M))

    wrong = 0
    for i, (key, said) in enumerate(wanted):
        got = lines.get(str(i + 1), "(nothing)")
        ok = heard(got) == heard(said)
        wrong += not ok
        print(f"  {'ok ' if ok else '?? '} {key:16s} {said:26s} heard: {got}")
    print(f"{name}: {len(wanted) - wrong} of {len(wanted)} phrases heard as written")
    return wrong


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("name", choices=sorted(ATLASES))
    ap.add_argument("source", nargs="?", help="the recording to cut up")
    ap.add_argument("--text", action="store_true", help="print the text to have spoken")
    ap.add_argument("--check", action="store_true", help="let Gemini listen to the atlas")
    ap.add_argument("--model", default="gemini-flash-latest", help="Gemini model for --check")
    args = ap.parse_args()

    if args.text:
        print("\n.\n".join(text for _, text in phrases_of(args.name)) + "\n.")
    if args.source:
        build(args.name, args.source)
    if args.check:
        sys.exit(1 if check(args.name, args.model) else 0)
    if not (args.text or args.source or args.check):
        ap.error("give a recording to cut up, or --text or --check")


if __name__ == "__main__":
    main()
