"""
Bring a still picture to life: generate a short video clip from it with
Google's Veo model (Gemini API).

Used to animate the water of a map's painting -- see scripts/make_water.py,
which prepares the picture, calls this, and puts the moving water back into
the painting.

The API key is read from the environment variable GEMINI_API_KEY, or from a
file `.env` (or `.env.txt`) in the project root holding one line:

    GEMINI_API_KEY=....

Those files are in .gitignore; the key is sent to Google in a request
header only and is never printed. Veo is billed per second of video (no
free tier): `python scripts/gen_video.py --prices` shows what a clip costs.

Usage (from the project root):
    python scripts/gen_video.py --image frame.jpg --loop --out clip.mp4 \
        --prompt "Static shot. Gentle waves roll toward the viewer."
"""

import argparse
import base64
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
API = "https://generativelanguage.googleapis.com/v1beta"

# model -> US$ per second of 1080p video (ai.google.dev/gemini-api/docs/pricing,
# October 2026). "fast" is the default: a tenth of the price of the full
# model's top tier, and water does not need more.
MODELS = {
    "lite": ("veo-3.1-lite-generate-preview", 0.08),
    "fast": ("veo-3.1-fast-generate-preview", 0.12),
    "full": ("veo-3.1-generate-preview", 0.40),
}
DURATION_S = 8          # 1080p clips are always 8 seconds


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
    return {"bytesBase64Encoded": base64.b64encode(path.read_bytes()).decode("ascii"),
            "mimeType": mime}


def generate(prompt, image, out, loop=False, model="fast", timeout=900):
    """
    One clip: `image` is its first frame, and with `loop` also its last, so
    the clip ends where it began. Returns the path written.
    """
    key = load_key()
    headers = {"x-goog-api-key": key}
    model_id, price = MODELS[model]
    instance = {"prompt": prompt.strip(), "image": as_image(image)}
    if loop:
        instance["lastFrame"] = as_image(image)
    body = {"instances": [instance],
            "parameters": {"aspectRatio": "16:9", "resolution": "1080p",
                           "durationSeconds": DURATION_S}}

    def explain(response):
        return response.text[:800].replace(key, "<key>")

    print(f"[veo]  {model_id}: {DURATION_S} s at 1080p, about ${price * DURATION_S:.2f}")
    started = time.time()
    r = requests.post(f"{API}/models/{model_id}:predictLongRunning",
                      headers=headers, json=body, timeout=120)
    if r.status_code != 200:
        sys.exit(f"request refused (HTTP {r.status_code}):\n{explain(r)}")
    operation = r.json()["name"]

    while True:
        time.sleep(10)
        r = requests.get(f"{API}/{operation}", headers=headers, timeout=60)
        if r.status_code != 200:
            sys.exit(f"polling failed (HTTP {r.status_code}):\n{explain(r)}")
        state = r.json()
        if state.get("done"):
            break
        if time.time() - started > timeout:
            sys.exit(f"gave up after {timeout} s; operation {operation} is still running")
    if "error" in state:
        sys.exit(f"generation failed: {state['error']}")
    answer = state.get("response", {}).get("generateVideoResponse", {})
    samples = answer.get("generatedSamples") or []
    if not samples:
        # e.g. the safety filter held the clip back
        sys.exit(f"no video came back: {str(answer)[:600]}")

    video = requests.get(samples[0]["video"]["uri"], headers=headers, timeout=300)
    if video.status_code != 200:
        sys.exit(f"download failed (HTTP {video.status_code}):\n{explain(video)}")
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(video.content)
    print(f"[ok]   {out}  {len(video.content) // 1024} kB  ({time.time() - started:.0f} s)")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--image", help="the first frame (16:9, ideally 1920x1080)")
    ap.add_argument("--prompt", help="what should move, and what should not")
    ap.add_argument("--out", help="where to save the .mp4")
    ap.add_argument("--loop", action="store_true",
                    help="end on the first frame again, so the clip can repeat")
    ap.add_argument("--model", choices=MODELS, default="fast")
    ap.add_argument("--prices", action="store_true", help="show what a clip costs and exit")
    args = ap.parse_args()
    if args.prices:
        for name, (model_id, price) in MODELS.items():
            print(f"{name:5s} {model_id:32s} ${price * DURATION_S:.2f} per {DURATION_S} s clip")
        return
    if not (args.image and args.prompt and args.out):
        ap.error("--image, --prompt and --out are required")
    generate(args.prompt, args.image, args.out, loop=args.loop, model=args.model)


if __name__ == "__main__":
    main()
