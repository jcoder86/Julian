"""
Generate game artwork by name, using the briefs in scripts/art_prompts.py.

    python scripts/gen_art.py --list
    python scripts/gen_art.py sea-backdrop
    python scripts/gen_art.py fish-cod fish-ray fish-shark     # run side by side
    python scripts/gen_art.py --all-fish --jobs 4
    python scripts/gen_art.py fish-cod --out-dir some/folder   # try-out, not into assets/

Needs the Codex app / CLI, signed in (see scripts/gen_image.py). Each image
takes roughly half a minute to a minute. An existing file is overwritten,
so use --out-dir to compare candidates first.
"""

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from art_prompts import JOBS            # noqa: E402
from gen_image import generate          # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def run(name, out_dir):
    job = JOBS[name]
    out = ROOT / job["out"]
    if out_dir:
        out = Path(out_dir) / out.name
    refs = [ROOT / r for r in job["refs"]]
    try:
        return name, generate(job["brief"], out, refs)
    except Exception as err:            # a timeout must not sink the batch
        print(f"[fail] {name}: {err}")
        return name, None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("names", nargs="*", help="which images (see --list)")
    ap.add_argument("--list", action="store_true", help="show all image names and exit")
    ap.add_argument("--all-fish", action="store_true", help="every fish-* strip")
    ap.add_argument("--jobs", type=int, default=3, help="how many to run at once (default 3)")
    ap.add_argument("--out-dir", help="write here instead of into assets/")
    args = ap.parse_args()

    if args.list:
        for name, job in JOBS.items():
            print(f"{name:14s} -> {job['out']}")
        return
    names = list(args.names)
    if args.all_fish:
        names += [n for n in JOBS if n.startswith("fish-") and n not in names]
    unknown = [n for n in names if n not in JOBS]
    if unknown or not names:
        ap.error(f"unknown or missing image name(s): {', '.join(unknown) or '(none given)'}")

    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        results = list(pool.map(lambda n: run(n, args.out_dir), names))
    failed = [name for name, path in results if path is None]
    if failed:
        sys.exit(f"failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()
