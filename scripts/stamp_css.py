#!/usr/bin/env python3
"""Restamp every page's style.css link with the current content hash.

Run from the repo root after editing style.css:

    python3 scripts/stamp_css.py

style.css is served with max-age=14400 while the HTML is max-age=0, so without
a changing URL a returning visitor pairs new markup with a four-hour-old
stylesheet — the inline script sets data-theme, the cached sheet has no
[data-theme] blocks to answer it, and .nav-controls renders unstyled.

The stamp is a content hash rather than a date because a date only busts the
cache on the first edit of a day; the second edit produces the same stamp and
the hole reopens silently. Check 7b of check_theme_invariants.py verifies the
stamp against the file, so forgetting to run this fails the check rather than
shipping.
"""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Kept in step with check_theme_invariants.py's NAV_PAGES: the legal pages
# load no stylesheet, so they are deliberately absent.
PAGES = [
    "about.html", "account.html", "astrology.html", "calculator.html",
    "contact.html", "guide.html", "index.html", "payment-thank-you.html",
    "posts.html", "services.html", "thank-you.html",
]

LINK = re.compile(r'(<link rel="stylesheet" href="style\.css)(\?v=[^"]*)?(")')


def main() -> int:
    stamp = hashlib.md5((ROOT / "style.css").read_bytes()).hexdigest()[:8]
    changed = []
    for name in PAGES:
        path = ROOT / name
        html = path.read_text(encoding="utf-8")
        new, n = LINK.subn(rf'\1?v={stamp}\3', html)
        if n == 0:
            print(f"no stylesheet link in {name}", file=sys.stderr)
            return 1
        if new != html:
            path.write_text(new, encoding="utf-8")
            changed.append(name)
    print(f"style.css -> ?v={stamp}")
    print(f"{len(changed)} of {len(PAGES)} pages updated"
          + (f": {', '.join(changed)}" if changed else " (already current)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
