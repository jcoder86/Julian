"""
Have a sound file described by ear.

Whoever (or whatever) makes the game's sounds cannot always listen to
them. This sends each file to Google's Gemini and prints what it hears:
what is in it, when, how it sounds, and anything that should not be there.
A machine's ears -- good for "is this birdsong or a car alarm?", not for
taste. Needs the GEMINI_API_KEY of scripts/gen_video.py.

    python scripts/listen.py work/audio/lake-birds-2.wav
    python scripts/listen.py assets/audio/ambience/*.mp3 --ask "Does it start or end abruptly?"
    python scripts/listen.py some.wav --blind        # "what is this?", without saying what for

It can be wrong, and confidently so. Use --blind and a second --model to
see whether the answers agree before believing one.
"""

import argparse
import base64
import glob
import subprocess
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_video import API, load_key      # noqa: E402

QUESTION = (
    "Listen to this sound clip, made as a sound effect or background "
    "ambience for a calm children's fishing game. In at most six short "
    "lines: (1) what exactly is heard, in order, with rough times; "
    "(2) whether it sounds natural and pleasant or artificial, harsh or "
    "distorted; (3) anything that does not belong (voices, music, hum, "
    "clicks, a sudden cut at the start or end); (4) how loud and busy it "
    "is. Be concrete and critical; do not guess what it was meant to be.")


# Without the hint of what the clip is for: a listener who is told "fishing
# game" tends to hear water in everything.
BLIND = (
    "Describe what you hear in this audio clip in two short lines (what, "
    "when, how loud, any abrupt start or end). Then, on a last line "
    "starting with 'Source:', say in a few words what an ordinary listener "
    "would say is making this sound.")


def as_mp3(path):
    """Any audio file as a small mono mp3: plenty for listening."""
    return subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "32000",
         "-codec:a", "libmp3lame", "-b:a", "96k", "-f", "mp3", "-"],
        check=True, capture_output=True).stdout


def listen(path, question, model):
    reply = requests.post(
        f"{API}/models/{model}:generateContent",
        headers={"x-goog-api-key": load_key()},
        json={"contents": [{"parts": [
            {"text": question},
            {"inlineData": {"mimeType": "audio/mp3",
                            "data": base64.b64encode(as_mp3(path)).decode("ascii")}},
        ]}], "generationConfig": {"temperature": 0}},
        timeout=300)
    if reply.status_code != 200:
        return f"(Gemini said {reply.status_code}: {reply.text[:200]})"
    return "".join(p.get("text", "") for p in reply.json()["candidates"][0]["content"]["parts"]).strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("files", nargs="+")
    ap.add_argument("--ask", help="an extra question to answer about each file")
    ap.add_argument("--blind", action="store_true",
                    help="say nothing about the game: just 'what is this sound?'")
    ap.add_argument("--model", default="gemini-flash-latest")
    args = ap.parse_args()
    question = BLIND if args.blind else QUESTION
    question += f" Also answer: {args.ask}" if args.ask else ""
    files = [f for pattern in args.files for f in (sorted(glob.glob(pattern)) or [pattern])]
    for f in files:
        print(f"=== {f}")
        print(listen(f, question, args.model))
        print()


if __name__ == "__main__":
    main()
