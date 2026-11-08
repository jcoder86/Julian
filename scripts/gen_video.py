"""
Bring a still picture to life: generate a short video clip from it with
Google's Gemini Omni model (Gemini API).

Used to animate the water of a map's painting -- see scripts/make_water.py,
which prepares the picture, calls this, and puts the moving water back into
the painting.

(Until October 2026 this was Veo 3.1. Google switched the Veo previews off
on 22 October 2026; Gemini Omni 1.2 Flash took their place on the same key
and billing, through the Interactions API.)

The API key is read from the environment variable GEMINI_API_KEY, or from a
file `.env` (or `.env.txt`) in the project root holding one line:

    GEMINI_API_KEY=....

Those files are in .gitignore; the key is sent to Google in a request
header only and is never printed. Video is billed per second (no free
tier; the key's project must be on a paid tier): `python
scripts/gen_video.py --prices` shows what a clip costs.

Usage (from the project root):
    python scripts/gen_video.py --image frame.jpg --loop --out clip.mp4 \
        --prompt "Static shot. Gentle waves roll toward the viewer."
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
API = "https://generativelanguage.googleapis.com/v1beta"

# model -> id; US$ per second by resolution (ai.google.dev pricing,
# November 2026; 1080p and 4k are upscaled from 720p by the model).
MODELS = {"omni": "gemini-omni-1.2-flash"}
PRICES = {"360p": 0.023, "720p": 0.07, "1080p": 0.104, "4k": 0.209}
# Seconds: 3 to 15 from one picture, at most 10 with a first AND last frame.
MIN_S, MAX_S, MAX_LOOP_S = 3, 15, 10


def load_key():
    key = os.environ.get("GEMINI_API_KEY")
    for name in (".env", ".env.txt"):
        path = ROOT / name
        if key or not path.exists():
            continue
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            name_, _, value = line.partition("=")
            if name_.strip() == "GEMINI_API_KEY":
                key = value.strip().strip('"').strip("'")
    if not key:
        sys.exit("no GEMINI_API_KEY: set it in the environment or in a .env file "
                 "in the project root (see the top of scripts/gen_video.py)")
    return key


def as_image(path):
    path = Path(path)
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return {"type": "image", "data": base64.b64encode(path.read_bytes()).decode("ascii"),
            "mime_type": mime}


def find_video(node):
    """The video item somewhere in an interaction's answer: {uri} or {data}."""
    if isinstance(node, dict):
        if node.get("type") == "video" and (node.get("uri") or node.get("data")):
            return node
        node = list(node.values())
    if isinstance(node, list):
        for item in node:
            found = find_video(item)
            if found:
                return found
    return None


def generate(prompt, image, out, loop=False, model="omni", resolution="1080p",
             seconds=8, timeout=900):
    """
    One clip: `image` is its first frame, and with `loop` also its last, so
    the clip ends where it began. Returns the path written.
    """
    longest = MAX_LOOP_S if loop else MAX_S
    if not MIN_S <= seconds <= longest:
        sys.exit(f"a clip is {MIN_S} to {longest} seconds")
    key = load_key()
    headers = {"x-goog-api-key": key}
    model_id = MODELS.get(model, MODELS["omni"])
    first = as_image(image)
    inputs = [first, dict(first)] if loop else [first]
    inputs.append({"type": "text", "text": prompt.strip()})
    body = {
        "model": model_id,
        "input": inputs,
        "response_format": {"type": "video", "duration": f"{seconds}s", "aspect_ratio": "16:9",
                            "resolution": resolution, "delivery": "uri"},
        # (One request that waits for the clip: the quickest way, says Google.
        # A clip handed over as a file must be stored for a while.)
        "background": False, "store": True, "stream": False,
    }

    def explain(response):
        return response.text[:800].replace(key, "<key>")

    print(f"[omni] {model_id}: {seconds} s at {resolution}, about ${PRICES[resolution] * seconds:.2f}")
    started = time.time()
    r = requests.post(f"{API}/interactions", headers=headers, json=body, timeout=timeout)
    if r.status_code != 200:
        sys.exit(f"request refused (HTTP {r.status_code}):\n{explain(r)}")
    answer = r.json()
    video = find_video(answer)
    if not video:
        # e.g. the safety filter held the clip back
        print(f"[fail] no video came back: {json.dumps(answer)[:600]}")
        return None

    if video.get("data"):
        content = base64.b64decode(video["data"])
    else:
        # A file of the Files API: wait until it is ready, then fetch it.
        file_id = video["uri"].split("/files/")[-1].split(":")[0].split("?")[0]
        while True:
            r = requests.get(f"{API}/files/{file_id}", headers=headers, timeout=60)
            if r.status_code == 200 and r.json().get("state") == "ACTIVE":
                break
            if time.time() - started > timeout:
                sys.exit(f"gave up after {timeout} s waiting for file {file_id}")
            time.sleep(5)
        r = requests.get(f"{API}/files/{file_id}:download", headers=headers,
                         params={"alt": "media"}, timeout=300)
        if r.status_code != 200:
            sys.exit(f"download failed (HTTP {r.status_code}):\n{explain(r)}")
        content = r.content
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(content)
    print(f"[ok]   {out}  {len(content) // 1024} kB  ({time.time() - started:.0f} s)")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--image", help="the first frame (16:9, ideally 1920x1080)")
    ap.add_argument("--prompt", help="what should move, and what should not")
    ap.add_argument("--out", help="where to save the .mp4")
    ap.add_argument("--loop", action="store_true",
                    help="end on the first frame again, so the clip can repeat")
    ap.add_argument("--model", choices=MODELS, default="omni")
    ap.add_argument("--resolution", choices=PRICES, default="1080p")
    ap.add_argument("--seconds", type=int, default=8)
    ap.add_argument("--prices", action="store_true", help="show what a clip costs and exit")
    args = ap.parse_args()
    if args.prices:
        for resolution, price in PRICES.items():
            print(f"{MODELS['omni']}  {resolution:5s} ${price:.3f}/s   (8 s: ${price * 8:.2f})")
        return
    if not (args.image and args.prompt and args.out):
        ap.error("--image, --prompt and --out are required")
    ok = generate(args.prompt, args.image, args.out, loop=args.loop, model=args.model,
                  resolution=args.resolution, seconds=args.seconds)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
