#!/usr/bin/env python3
"""Read-only invariants for the three-theme system.

Run from the repo root:  python3 scripts/check_theme_invariants.py

Each check prints PASS / FAIL / SKIP and the script exits non-zero if any
check FAILs. Checks that depend on work not yet done SKIP rather than fail,
so this can be run from the first commit onwards.
"""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASTRO = ROOT.parent / "AstroCalculator"

# The 11 pages carrying the shared nav. Kept explicit rather than globbed:
# the legal pages deliberately have no nav, and a new page must be added
# here consciously.
NAV_PAGES = [
    "about.html", "account.html", "astrology.html", "calculator.html",
    "contact.html", "guide.html", "index.html", "payment-thank-you.html",
    "posts.html", "services.html", "thank-you.html",
]
LEGAL_PAGES = ["privacy.html", "agreement.html", "readings-terms.html"]

failures = []
skips = []


def report(name, ok, detail=""):
    if ok is None:
        skips.append(name)
        print(f"SKIP  {name}" + (f" — {detail}" if detail else ""))
    elif ok:
        print(f"PASS  {name}")
    else:
        failures.append(name)
        print(f"FAIL  {name}" + (f"\n      {detail}" if detail else ""))


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


# --- check 6: every themed token exists in both [data-theme] blocks -------
# Colours only, and deliberately so. Radii, font stack, --nav-h and the
# bracket geometry are shared across all three palettes; --galaxy is an
# opacity that a palette may legitimately inherit (lifted does). Demanding
# those here would be demanding duplication for its own sake, and an earlier
# draft that did so flagged correct CSS twice in a row.
#
# What this actually guards: one missing COLOUR silently inherits the
# imperial value and paints a single wrong swatch in an otherwise correct
# theme — the kind of thing nobody spots by eye.


def _themed(block):
    """{name: value} for the colour tokens, which must differ per palette."""
    return {
        name: value.strip()
        for name, value in re.findall(
            r"^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);", block, re.M)
        if value.strip().startswith("#")
    }


def check_tokens():
    css = read("style.css")
    root = re.search(r"^:root \{(.*?)^\}", css, re.S | re.M)
    if not root:
        return report("6 token parity", False, "no :root block found in style.css")
    want = _themed(root.group(1))

    problems = []
    for theme in ("lifted", "light"):
        blk = re.search(r'html\[data-theme="%s"\] \{(.*?)^\}' % theme, css, re.S | re.M)
        if not blk:
            return report("6 token parity", None, f"no [data-theme={theme}] block yet")
        have = _themed(blk.group(1))

        missing = sorted(set(want) - set(have))
        if missing:
            problems.append(f"{theme} missing {missing}")
        # A token copied across unchanged is almost always a forgotten edit
        # rather than a deliberate match — the grounds and inks have no
        # business being identical between two different palettes.
        same = sorted(k for k in have if k in want and have[k].lower() == want[k].lower())
        if same:
            problems.append(f"{theme} identical to imperial: {same}")

    report("6 token parity", not problems, "; ".join(problems))


# --- check 7: nav + FOUC script identical across the 11 pages ---------------
def check_nav():
    navs, foucs = {}, {}
    for page in NAV_PAGES:
        try:
            html = read(page)
        except FileNotFoundError:
            return report("7 nav parity", False, f"{page} not found")
        m = re.search(r"<nav\b.*?</nav>", html, re.S)
        navs[page] = hashlib.md5(m.group(0).encode()).hexdigest() if m else "NO-NAV"
        # Matched on what the script DOES, not on how it opens: an earlier
        # version keyed on "<script>(function(){try{" and silently reported
        # "not rolled out anywhere" once the script grew a leading comment.
        f = None
        # A bare "<script>" has no attributes, so it is inline by construction —
        # no lookahead needed to exclude src= tags.
        for m in re.finditer(r"<script>(.*?)</script>", html, re.S):
            if "sow-theme" in m.group(1) and "documentElement" in m.group(1):
                f = m
                break
        foucs[page] = hashlib.md5(f.group(0).encode()).hexdigest() if f else None

    groups = {}
    for page, h in navs.items():
        groups.setdefault(h, []).append(page)
    detail = ""
    if len(groups) > 1:
        detail = " | ".join(f"{h[:8]}: {', '.join(p)}" for h, p in groups.items())
    report("7 nav parity", len(groups) == 1, detail)

    present = [p for p, h in foucs.items() if h]
    if not present:
        report("7 FOUC parity", None, "no inline theme script on any page yet")
    elif len(present) != len(NAV_PAGES):
        report("7 FOUC parity", False,
               f"only {len(present)}/{len(NAV_PAGES)}: missing "
               f"{sorted(set(NAV_PAGES) - set(present))}")
    else:
        report("7 FOUC parity", len(set(foucs.values())) == 1,
               f"{len(set(foucs.values()))} distinct variants")


# --- check 8: legal pages' <style> blocks identical ------------------------
def check_legal():
    hashes = {}
    for page in LEGAL_PAGES:
        m = re.search(r"<style>.*?</style>", read(page), re.S)
        if not m:
            return report("8 legal style parity", False, f"{page} has no <style>")
        hashes[page] = hashlib.md5(m.group(0).encode()).hexdigest()
    uniq = set(hashes.values())
    report("8 legal style parity", len(uniq) == 1,
           "" if len(uniq) == 1 else str({p: h[:8] for p, h in hashes.items()}))


# --- check 9: asset invariants --------------------------------------------
def check_assets():
    def md5(p):
        return hashlib.md5(p.read_bytes()).hexdigest() if p.exists() else None

    for name in ("celestial-veil.jpg", "celestial-veil-light.jpg"):
        site, app = ROOT / "images" / name, ASTRO / "assets" / "images" / name
        if not site.exists() and not app.exists():
            report(f"9 {name} parity", None, "not generated yet")
            continue
        a, b = md5(site), md5(app)
        report(f"9 {name} parity", a is not None and a == b,
               f"site={a and a[:8]} astro={b and b[:8]}")

    lacquer = ROOT / "images" / "bg_lacquer.png"
    if not lacquer.exists():
        return report("9 lacquer crop", False, "images/bg_lacquer.png missing")
    try:
        from PIL import Image
    except ImportError:
        return report("9 lacquer crop", None, "PIL not available")
    size = Image.open(lacquer).size
    report("9 lacquer crop", size == (1480, 860), f"got {size}, want (1480, 860)")


for fn in (check_tokens, check_nav, check_legal, check_assets):
    fn()

print()
print(f"{len(failures)} failed, {len(skips)} skipped")
sys.exit(1 if failures else 0)
