#!/usr/bin/env python3
"""Derive images/celestial-veil-light.jpg from images/celestial-veil.jpg.

Run from the repo root. Writes the site copy and the AstroCalculator copy in
one pass so the two cannot drift; check 9 of check_theme_invariants.py asserts
their md5s match.

Why the asset is derived rather than drawn
------------------------------------------
Dark mode screens the galaxy photo over a near-black ground: `screen` can only
add light, so it lifts stars without muting the plate. On parchment that same
photo washes to a faint smear, because there is no darkness for it to add
light to. Light mode therefore needs the tonal opposite of the photo,
composited with `multiply`.

Why the chroma is thrown away
-----------------------------
Inverting the photo and stopping there does not work, and the reason is not
obvious from the frame mean. The interesting pixels are the veil's *dark* ones
-- the only place multiply does any work -- and those are the inverse of the
photo's brightest regions, which are the gold medallion and the blue-white
nebula. Inverted, gold becomes blue and blue becomes amber, so the layer
arrives as chromatic noise: measured over the darkest decile at full strength,
naive inversion lands at R 52.8 / G 69.1 / B 90.3 -- blue-dominant, with R
*lowest*, the exact reverse of the parchment it has to sit on. Multiplied at
the shipping opacity it drags the ground's warm spread from G-B +14.3 down to
+9.3, and scatters visible pink and green blotches where the nebula was.

Converting to L first discards all of that and rebuilds the colour from a
single umber-to-white ramp, so every mark is the same warm grey no matter what
hue it started as. Same measurement: R 118.9 / G 107.3 / B 87.0, warm ordering
kept, and the composited shift is +0.8 instead of -5.0.

The two endpoints
-----------------
white = #FFFFFF -- empty sky becomes pure white, and multiply by white is a
no-op, so the majority of the frame is left exactly as the vignette painted it
rather than uniformly muddied.

black = #4A3E28 -- the ink floor. Warm sepia rather than black, so the
heaviest wash is deep umber and not a grey bruise on a warm page. Tunable
between #2E2A22 (heavier) and #6B5730 (lighter, matches --gold-rule).

Encoding
--------
JPEG q35, matching the dark veil. PNG-8 was measured and rejected: the plan
expected a mostly-flat-white frame to quantise small, but only 3% of pixels
are actually flat sky -- the rest is continuous nebula gradient -- so PNG-8
came out at 469-621 KB against JPEG's 82 KB. Its lower error buys nothing
visible at 14% opacity.
"""
import hashlib
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parent.parent
ASTRO = ROOT.parent / "AstroCalculator"

SRC = ROOT / "images" / "celestial-veil.jpg"
OUT = ROOT / "images" / "celestial-veil-light.jpg"
COPY = ASTRO / "assets" / "images" / "celestial-veil-light.jpg"

INK = "#4A3E28"
PAPER = "#FFFFFF"
QUALITY = 35

# The crop that puts the medallion at the dead centre of the file is what keeps
# it concentric with the lacquer's compass at every viewport. Inversion is
# per-pixel so it survives -- but a resize would destroy it silently.
SIZE = (1280, 696)


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC}", file=sys.stderr)
        return 1

    src = Image.open(SRC).convert("RGB")
    if src.size != SIZE:
        print(f"source is {src.size}, expected {SIZE} -- refusing to guess",
              file=sys.stderr)
        return 1

    gray = ImageOps.invert(src).convert("L")
    out = ImageOps.colorize(gray, black=INK, white=PAPER)

    assert out.size == SIZE, out.size
    mean = ImageStat.Stat(out).mean
    if not mean[0] > mean[1] > mean[2]:
        print(f"result is not warm-ordered: {mean} -- check the endpoints",
              file=sys.stderr)
        return 1

    out.save(OUT, "JPEG", quality=QUALITY, optimize=True)
    COPY.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OUT, COPY)

    digest = hashlib.md5(OUT.read_bytes()).hexdigest()
    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.1f} KB  "
          f"{out.size[0]}x{out.size[1]}  md5 {digest[:8]}")
    print(f"mean R{mean[0]:.1f} G{mean[1]:.1f} B{mean[2]:.1f}  "
          f"G-B {mean[1] - mean[2]:+.1f}")
    print(f"copied to {COPY}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
