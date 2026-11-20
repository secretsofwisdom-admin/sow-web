#!/usr/bin/env python3
"""Russian copies of the public pages, written to ru/, plus sitemap.xml.

Why: the site's Russian text lives in lang/ru.json and is put on the page by
lang-switcher.js after load, so search engines only ever saw English. This
script applies the same translations ahead of time and writes each page again
under /ru/, where a crawler reads Russian in the markup.

Run from the repo root after editing any page listed in PAGES, the menu, or
lang/ru.json — and after scripts/stamp_css.py, so the copies carry the
current version stamps:

    python3 scripts/build_ru.py           # write ru/*.html and sitemap.xml
    python3 scripts/build_ru.py --check   # exit 1 if they are out of date

The files in ru/ are generated. Do not edit them by hand.

What a copy changes, and nothing else:
  * <html lang="ru">, and <base href="/"> so every relative address (styles,
    scripts, images, lang/ru.json, the calculator iframe, account.html) still
    resolves from the site root exactly as it does on the English page;
  * text of [data-i18n] (as text) and [data-i18n-html] (as markup), and the
    two brand lines, exactly as lang-switcher.js applies them;
  * <title>, description and social titles from "meta" in lang/ru.json;
  * canonical and og:url point at the /ru/ address;
  * links to pages that have a Russian copy point at that copy.
"""
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://secretsofwisdom.org"

# Pages that exist in both languages. Each must carry the three
# <link rel="alternate" hreflang> lines; lang-switcher.js reads them to find
# the same page in the other language.
PAGES = [
    "index", "about", "services", "contact", "guide", "posts",
    "calculator", "astrology",
    "bazi-calculator-guide", "natal-chart-calculator-guide",
    "fire-horse-2026", "eclipse-corridor-2026",
    "bazi-useful-element",
]
# In the sitemap, English only.
EN_ONLY = ["privacy"]

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}


def nested(data, path):
    """Same lookup as getNestedValue() in lang-switcher.js."""
    cur = data
    for part in path.split("."):
        if cur is None:
            return None
        m = re.fullmatch(r"(.+)\[(\d+)]", part)
        if m:
            seq = cur.get(m.group(1)) or []
            idx = int(m.group(2))
            cur = seq[idx] if idx < len(seq) else None
        else:
            cur = cur.get(part) if isinstance(cur, dict) else None
    return cur


class Spans(HTMLParser):
    """Finds the inner text range of every element carrying an i18n attribute.

    The page is edited by character offsets rather than re-serialised, so
    everything outside those ranges stays byte-for-byte what the author wrote.
    """

    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.starts = [0]
        for line in text.splitlines(keepends=True):
            self.starts.append(self.starts[-1] + len(line))
        self.stack = []
        self.found = []   # (inner_start, inner_end, kind, key)
        self.feed(text)
        self.close()

    def pos_abs(self):
        line, col = self.getpos()
        return self.starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        a = dict(attrs)
        mark = None
        if "data-i18n-html" in a:
            mark = ("html", a["data-i18n-html"])
        elif "data-i18n" in a:
            mark = ("text", a["data-i18n"])
        elif "data-i18n-brand" in a:
            mark = ("brand", "")
        self.stack.append((tag, mark, self.pos_abs() + len(self.get_starttag_text())))

    def handle_startendtag(self, tag, attrs):
        pass  # <path ... /> and friends: no content, nothing to track

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                _, mark, start = self.stack[i]
                del self.stack[i:]
                if mark:
                    self.found.append((start, self.pos_abs(), mark[0], mark[1]))
                return


def translate(text, ru, page):
    spans = sorted(Spans(text).found)
    out, pos, missing = [], 0, []
    for start, end, kind, key in spans:
        if start < pos:
            continue  # inside an element that was already replaced whole
        if kind == "brand":
            new = ('<span class="brand-en">%s</span><span class="brand-ru">%s</span>'
                   % (ru["brand"]["name"], ru["brand"]["nameRu"]))
        else:
            val = nested(ru, key)
            if val is None:
                missing.append(key)
                continue
            new = val if kind == "html" else html.escape(val, quote=False)
        out.append(text[pos:start])
        out.append(new)
        pos = end
    out.append(text[pos:])
    if missing:
        print(f"  note: {page}.html has no Russian text for: {', '.join(sorted(set(missing)))}")
    return "".join(out)


def sub_once(pattern, repl, text, what, count=1, flags=0):
    new, n = re.subn(pattern, repl, text, flags=flags)
    if n != count:
        raise SystemExit(f"build_ru: expected {count} × {what}, found {n}")
    return new


def ru_path(page):
    return "/ru/" if page == "index" else "/ru/" + page


def build(page, ru):
    text = (ROOT / f"{page}.html").read_text(encoding="utf-8")
    meta = nested(ru, f"meta.{page}")
    if not meta:
        raise SystemExit(f"build_ru: lang/ru.json has no meta.{page}")
    if 'hreflang="ru"' not in text:
        raise SystemExit(f"build_ru: {page}.html has no hreflang links")

    text = translate(text, ru, page)

    text = sub_once(r'<html lang="en">', '<html lang="ru">', text, "<html lang>")
    text = sub_once(r'(<meta charset="UTF-8" />\n)',
                    r'\1  <base href="/" />\n', text, "charset meta")
    text = text.replace("<!DOCTYPE html>\n",
                        "<!DOCTYPE html>\n<!-- Generated by scripts/build_ru.py from "
                        f"{page}.html and lang/ru.json. Do not edit. -->\n", 1)

    title = html.escape(meta["title"], quote=False)
    desc = html.escape(meta["description"])
    text = sub_once(r"<title>.*?</title>", lambda m: f"<title>{title}</title>", text, "<title>")
    text = sub_once(r'(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*"',
                    lambda m: m.group(1) + html.escape(meta["title"]) + '"', text, "social titles", 2)
    text = sub_once(r'(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*"',
                    lambda m: m.group(1) + desc + '"', text, "descriptions", 3)
    url = SITE + ru_path(page)
    text = sub_once(r'(<link rel="canonical" href=")[^"]*"', lambda m: m.group(1) + url + '"', text, "canonical")
    text = sub_once(r'(<meta property="og:url" content=")[^"]*"', lambda m: m.group(1) + url + '"', text, "og:url")

    # Menu and body links: stay inside /ru/ wherever a Russian copy exists.
    # Everything else keeps its address and resolves from the root via <base>.
    names = "|".join(re.escape(p) for p in PAGES)

    def link(m):
        target = "ru/" if m.group(1) == "index" else "ru/" + m.group(1)
        return 'href="' + target + (m.group(2) or "") + '"'
    text = re.sub(r'href="(%s)\.html([?#][^"]*)?"' % names, link, text)
    # With <base href="/">, a bare "#..." would point at the home page.
    text = re.sub(r'href="#([^"]*)"', lambda m: 'href="%s#%s"' % (ru_path(page).lstrip("/"), m.group(1)), text)

    # The language select shows the page's own language before any script runs.
    text = text.replace('<option value="en" selected>EN</option>', '<option value="en">EN</option>')
    text = text.replace('<option value="ru">RU</option>', '<option value="ru" selected>RU</option>')
    return text


def sitemap():
    rows = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
            '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for page in PAGES:
        en = SITE + ("/" if page == "index" else "/" + page)
        ru = SITE + ru_path(page)
        alts = "".join(f'<xhtml:link rel="alternate" hreflang="{lang}" href="{href}"/>'
                       for lang, href in (("en", en), ("ru", ru), ("x-default", en)))
        rows.append(f"  <url><loc>{en}</loc>{alts}</url>")
        rows.append(f"  <url><loc>{ru}</loc>{alts}</url>")
    for page in EN_ONLY:
        rows.append(f"  <url><loc>{SITE}/{page}</loc></url>")
    rows.append("</urlset>")
    return "\n".join(rows) + "\n"


def main():
    check = "--check" in sys.argv[1:]
    ru = json.loads((ROOT / "lang" / "ru.json").read_text(encoding="utf-8"))
    wanted = {Path("ru") / f"{p}.html": build(p, ru) for p in PAGES}
    wanted[Path("sitemap.xml")] = sitemap()

    stale = []
    for rel, text in wanted.items():
        path = ROOT / rel
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current != text:
            stale.append(str(rel))
            if not check:
                path.parent.mkdir(exist_ok=True)
                path.write_text(text, encoding="utf-8")
    extra = sorted(str(p.relative_to(ROOT)) for p in (ROOT / "ru").glob("*.html")
                   if p.relative_to(ROOT) not in wanted) if (ROOT / "ru").exists() else []

    if check:
        if stale or extra:
            print("out of date: " + ", ".join(stale + [e + " (not in PAGES)" for e in extra]))
            print("rebuild with:  python3 scripts/build_ru.py")
            return 1
        print(f"ru/ and sitemap.xml are up to date ({len(PAGES)} pages)")
        return 0
    print(f"{len(stale)} of {len(wanted)} files written" + (f"; unexpected in ru/: {extra}" if extra else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
