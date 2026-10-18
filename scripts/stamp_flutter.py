#!/usr/bin/env python3
"""Stamp the calculators' script URLs with their content hash.

Run from the repo root after copying a Flutter build into calc/ or astro/:

    python3 scripts/stamp_flutter.py

Cloudflare serves main.dart.js and flutter_bootstrap.js with max-age=14400
while index.html is max-age=0. Without a changing URL a returning visitor
pairs a new index.html with a four-hour-old app: on 2026-10-18 the page's new
touch rule waited for a flag that only the new app sets, so a fix that
worked on a fresh load did nothing on the user's iPhone.

Two links are stamped, because each file names the next:
  index.html -> flutter_bootstrap.js?v=<hash of the stamped bootstrap>
  flutter_bootstrap.js -> "mainJsPath":"main.dart.js?v=<hash of main.dart.js>"
The bootstrap is stamped first, so its own hash covers the new main stamp.
Idempotent: a second run changes nothing.
"""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APPS = ["calc", "astro"]

MAIN = re.compile(r'("mainJsPath":"main\.dart\.js)(\?v=[0-9a-f]+)?(")')
BOOT = re.compile(r'(<script src="flutter_bootstrap\.js)(\?v=[0-9a-f]+)?(")')


def stamp(path: Path, pattern: re.Pattern, value: str) -> bool:
    text = path.read_text(encoding="utf-8")
    new, count = pattern.subn(lambda m: f"{m[1]}?v={value}{m[3]}", text)
    if count != 1:
        sys.exit(f"{path}: expected one match for {pattern.pattern}, found {count}")
    if new != text:
        path.write_text(new, encoding="utf-8")
        return True
    return False


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()[:8]


def main() -> int:
    for app in APPS:
        base = ROOT / app
        boot = base / "flutter_bootstrap.js"
        changed = stamp(boot, MAIN, md5(base / "main.dart.js"))
        changed |= stamp(base / "index.html", BOOT, md5(boot))
        print(f"{app}: {'stamped' if changed else 'already current'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
