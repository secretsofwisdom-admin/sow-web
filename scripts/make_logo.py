#!/usr/bin/python3
"""Cut every logo file of the site and of both calculators from the master.

Run from the repo root with the system Python (it has Pillow and numpy):

    /usr/bin/python3 scripts/make_logo.py

Master: scripts/logo.png = `secrets-of-wisdom.png` from the owner's approved
pack `logo-unified-for-claude.zip` (2026-11-20), already transparent, one
file for both themes. Never redrawn or recoloured here — every output is a
crop or a scale of its pixels.

The caption is found as the last band of rows below an empty gap. In the
master the caption stands 26 px to the right of the bowl's axis, so the full
logo is cropped symmetrically about the bowl's axis (transparent margin on
the left): the file's centre is the centre of the bowl and the flame, and a
page that centres the file centres the mark. The caption keeps its place.

Outputs
  images/sow-logo-full.png      mark + "Secrets of Wisdom"
  images/sow-logo-mark.png      flame, smoke and bowl only
  images/sow-logo-mark-nav.png  the same, 192 px tall (menu, loader)
  images/favicon-32.png, images/favicon-192.png, favicon.ico   mark, transparent
  images/apple-touch-icon.png   180 px, mark on the menu's navy
  images/og-logo.jpg            1200 x 630 link preview, logo on navy
  ../BaziCalculator/web/…, ../AstroCalculator/web/…  favicon.png and icons/
      (skipped when the project is not beside the repo)
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAVY = (5, 12, 25)          # --nav-fill, the pack's own dark sample ground
INK = 8                     # alpha above this counts as drawn


def bands(img):
    """Row ranges that hold ink, split at empty gaps of 3 rows or more."""
    rows = np.where((np.asarray(img)[..., 3] > INK).any(axis=1))[0]
    out, start, prev = [], rows[0], rows[0]
    for r in rows[1:]:
        if r - prev > 3:
            out.append((start, prev))
            start = r
        prev = r
    out.append((start, prev))
    return out


def crop(img, y_from, y_to, pad):
    al = np.asarray(img)[..., 3]
    ys, xs = np.where(al[y_from:y_to + 1] > INK)
    return img.crop((max(xs.min() - pad, 0), max(ys.min() + y_from - pad, 0),
                     min(xs.max() + pad + 1, img.width),
                     min(ys.max() + y_from + pad + 1, img.height)))


def fit(img, size, share, ground=None):
    """img scaled to `share` of a square canvas of `size`, centred."""
    box = size * share
    s = min(box / img.width, box / img.height)
    small = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), ground + (255,) if ground else (0, 0, 0, 0))
    canvas.alpha_composite(small, ((size - small.width) // 2, (size - small.height) // 2))
    return canvas


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print('wrote', os.path.relpath(path, ROOT), img.size)


def main():
    images = os.path.join(ROOT, 'images')
    master = Image.open(os.path.join(ROOT, 'scripts', 'logo.png')).convert('RGBA')
    b = bands(master)
    assert len(b) == 2, b               # the mark, then the caption
    (m0, m1), (_, c1) = b
    mark = crop(master, m0, m1, 10)
    icon = crop(master, m0, m1, 2)

    # Full logo: symmetric about the bowl's axis (see the note above).
    al = np.asarray(master)[..., 3] > INK
    xs = np.where(al[m0:m1 + 1].any(axis=0))[0]
    axis = (xs.min() + xs.max()) / 2.0
    xs = np.where(al[m0:c1 + 1].any(axis=0))[0]
    half = int(np.ceil(max(axis - xs.min(), xs.max() - axis))) + 10
    left = int(round(axis)) - half
    full = master.crop((left, m0 - 10, left + 2 * half, c1 + 11))

    save(full, os.path.join(images, 'sow-logo-full.png'))
    save(mark, os.path.join(images, 'sow-logo-mark.png'))
    save(mark.resize((round(mark.width * 192 / mark.height), 192), Image.LANCZOS),
         os.path.join(images, 'sow-logo-mark-nav.png'))

    save(fit(icon, 32, 1.0), os.path.join(images, 'favicon-32.png'))
    save(fit(icon, 192, 1.0), os.path.join(images, 'favicon-192.png'))
    save(fit(icon, 180, 0.80, NAVY).convert('RGB'), os.path.join(images, 'apple-touch-icon.png'))
    fit(icon, 48, 1.0).save(os.path.join(ROOT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    print('wrote favicon.ico')

    og = Image.new('RGBA', (1200, 630), NAVY + (255,))
    f = full
    s = 540 / f.height
    f = f.resize((round(f.width * s), 540), Image.LANCZOS)
    og.alpha_composite(f, ((1200 - f.width) // 2, 45))
    og.convert('RGB').save(os.path.join(images, 'og-logo.jpg'), quality=90, optimize=True)
    print('wrote images/og-logo.jpg', og.size)

    for app in ('BaziCalculator', 'AstroCalculator'):
        web = os.path.join(os.path.dirname(ROOT), app, 'web')
        if not os.path.isdir(web):
            print('skipped', app, '(not beside the repo)')
            continue
        save(fit(icon, 32, 1.0), os.path.join(web, 'favicon.png'))
        for size in (192, 512):
            save(fit(icon, size, 0.80, NAVY).convert('RGB'),
                 os.path.join(web, 'icons', 'Icon-%d.png' % size))
            save(fit(icon, size, 0.60, NAVY).convert('RGB'),
                 os.path.join(web, 'icons', 'Icon-maskable-%d.png' % size))


if __name__ == '__main__':
    sys.exit(main())
