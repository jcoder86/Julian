"""
Generate one piece of artwork with the Codex CLI's image tool and save it
where the game (or the asset pipeline) expects it.

Codex is the OpenAI desktop app / CLI; it must be installed and signed in
(`codex login status`). The image model is told what to paint, optionally
shown reference images (for composition or style), and the file it writes
under ~/.codex/generated_images/<session id>/ is copied to --out.

Usage (from the project root):
    python scripts/gen_image.py --out assets/raw/fish-mackerel.png \
        --ref assets/raw/fish-catfish.webp --prompt-file prompt.txt
    python scripts/gen_image.py --out out.png --prompt "a red apple"

The prompts used for the shipped artwork live in scripts/art_prompts.py;
`python scripts/gen_art.py <name> ...` runs them by name.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

CODEX_HOME = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
GENERATED = CODEX_HOME / "generated_images"

# The agent is only allowed to paint: no shell, no file edits.
WRAPPER = """You are being used purely as an image generator.

Use your image generation tool to create EXACTLY ONE image that follows the
brief below as closely as you can. Do not run shell commands, do not create
or edit any files, do not ask questions. If reference images are attached,
use them the way the brief says. When the image has been generated, reply
with the single word DONE.

BRIEF:
{brief}
"""


def find_codex():
    """The codex binary: on PATH, or bundled with the desktop app (Windows)."""
    found = shutil.which("codex")
    if found:
        return found
    local = os.environ.get("LOCALAPPDATA")
    if local:
        candidates = sorted(
            Path(local, "OpenAI", "Codex", "bin").glob("*/codex.exe"),
            key=lambda p: p.stat().st_mtime, reverse=True)
        if candidates:
            return str(candidates[0])
    sys.exit("codex not found: install the Codex app or put `codex` on PATH")


def session_image(stdout):
    """
    The image a finished run produced. Codex prints its session ("thread")
    id as a JSON event and stores generated images in a folder of that
    name, so several runs can go on side by side without mixing up files.
    """
    for line in stdout.splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get("type") == "thread.started" and event.get("thread_id"):
            images = sorted((GENERATED / event["thread_id"]).glob("*.png"),
                            key=lambda p: p.stat().st_mtime)
            return images[-1] if images else None
    return None


def generate(brief, out, refs=(), workdir=None, timeout=900):
    """Run Codex once; returns the path written, or None on failure."""
    out = Path(out)
    # Codex gets an empty scratch folder as its workspace, not the project.
    workdir = Path(workdir or Path(tempfile.gettempdir()) / "julian-codex-art")
    workdir.mkdir(parents=True, exist_ok=True)

    cmd = [find_codex(), "exec", "--skip-git-repo-check", "-s", "read-only",
           "-C", str(workdir), "--color", "never", "--json"]
    for ref in refs:
        cmd += ["-i", str(Path(ref).resolve())]
    cmd.append("-")   # prompt comes from stdin

    t0 = time.time()
    proc = subprocess.run(cmd, input=WRAPPER.format(brief=brief.strip()),
                          text=True, encoding="utf-8", errors="replace",
                          capture_output=True, timeout=timeout)
    image = session_image(proc.stdout or "")
    if image is None:
        tail = (proc.stdout or "")[-600:] + (proc.stderr or "")[-600:]
        print(f"[fail] {out}: no image produced (exit {proc.returncode})\n{tail}")
        return None
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(image, out)
    print(f"[ok]   {out}  <- {image.parent.name[:8]}/{image.name[:13]}  "
          f"({time.time() - t0:.0f}s)")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", required=True, help="where to save the PNG")
    ap.add_argument("--prompt", help="the brief, inline")
    ap.add_argument("--prompt-file", help="the brief, from a text file")
    ap.add_argument("--ref", action="append", default=[], help="reference image (repeatable)")
    args = ap.parse_args()
    if not (args.prompt or args.prompt_file):
        ap.error("give --prompt or --prompt-file")
    brief = args.prompt or Path(args.prompt_file).read_text(encoding="utf-8")
    sys.exit(0 if generate(brief, args.out, args.ref) else 1)


if __name__ == "__main__":
    main()
