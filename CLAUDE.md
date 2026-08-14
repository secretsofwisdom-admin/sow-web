# SOW Web - Secrets of Wisdom Website

## Overview
Static website for "Secrets of Wisdom · NZ" — feng shui, astrology, spatial design consultation business.

## Infrastructure
- **Hosting:** Cloudflare Pages (git integration, auto-deploys on push)
- **Repo:** github.com/secretsofwisdom-admin/sow-web
- **Domain:** secretsofwisdom.org
- **Pages URL:** sow-web-7ne.pages.dev
- **GitHub account:** secretsofwisdom-admin
- **Cloudflare account ID:** 8ddfe9e9bbacfc0b4b511b916abc650f

## Contact Form Email
- **Provider:** Resend (API key stored as Cloudflare Pages secret `RESEND_API_KEY`)
- **Endpoint:** `/api/contact` (Pages Function at `functions/api/contact.js`)
- **Sends to:** secretsofwisdominbox@gmail.com (temporary — domain not yet verified in Resend)
- **From:** hello@secretsofwisdom.org (domain verified in Resend)
- **On success:** redirects to thank-you.html

## Customer Portal
- **Page:** `/account.html` — passwordless login (magic link via Resend), order history (Stripe), newsletter (MailerLite)
- **Backend:** Pages Functions under `functions/api/` (auth/, account/); shared helpers in `_shared.js`, `_mailerlite.js`
- **Database:** Cloudflare D1 `sow-portal` (id `ecf8579d-5c31-4e17-9ddb-7f485aa286da`), binding `DB`; schema in `schema.sql`
- **Secrets (Pages):** `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `MAILERLITE_API_KEY`, optional `MAILERLITE_GROUP_ID`
- **Setup notes:** `PORTAL_SETUP.md`

## BaZi Calculator (`/calc/`)
- `calc/` is **generated output**, not hand-written — a Flutter web build committed to this repo. `calculator.html` embeds it in an iframe.
- Source project: `/Users/nadin_zn-lo/Claude/BaziCalculator/` (local only, no git remote).
- Rebuild and update:
  ```
  cd /Users/nadin_zn-lo/Claude/BaziCalculator
  flutter pub get
  flutter build web --release --base-href=/calc/
  cp web/_headers build/web/_headers
  rm -rf /Users/nadin_zn-lo/Claude/sow-web/calc
  cp -R build/web /Users/nadin_zn-lo/Claude/sow-web/calc
  find /Users/nadin_zn-lo/Claude/sow-web/calc -type f -exec chmod 644 {} \;
  ```
- `--base-href=/calc/` must use `=`. With a space, Flutter 3.44 silently leaves it `/` and every asset 404s under `/calc/`.
- JS build, not `--wasm` (despite `DEPLOY_WEB.md`) — parent page isn't cross-origin-isolated.
- Security headers come from the **root `_headers`** (`/calc/*` → `X-Frame-Options: SAMEORIGIN`). Pages ignores nested `calc/_headers`. Never set DENY there — it blanks the iframe.
- Replace the whole folder each time; asset hashes change between builds.

## Astrology Calculator (`/astro/`)
- Same arrangement as `calc/`: **generated output**, a Flutter web build committed here. `astrology.html` embeds it in an iframe.
- Source project: `/Users/nadin_zn-lo/Claude/AstroCalculator/` (local git repo, no remote).
- Rebuild and update:
  ```
  cd /Users/nadin_zn-lo/Claude/AstroCalculator
  flutter build web --release --base-href=/astro/
  rm -rf /Users/nadin_zn-lo/Claude/sow-web/astro
  cp -R build/web /Users/nadin_zn-lo/Claude/sow-web/astro
  chmod -R a+r /Users/nadin_zn-lo/Claude/sow-web/astro
  ```
- `--base-href=/astro/` must use `=`, same trap as `calc/`.
- Headers come from the **root `_headers`** (`/astro/*` → `SAMEORIGIN`). Never DENY.
- Shared Dart was **copied** from BaziCalculator, not extracted into a package — that project is not to be modified. `city_database.dart`, `city_aliases.dart`, `text_search.dart` and `imperial_tokens.dart` now exist twice; a city fix has to be applied in both or the two calculators disagree about where someone was born.
- `AstroCalculator/staging/` holds Imperial widgets copied but not yet ported (they still import `package:bazi_calculator/…`). Excluded from `flutter analyze`.
- **Not yet built:** Chiron (needs a one-off JPL Horizons fetch to generate `assets/chiron.bin` — the only external network dependency in the build), transits, synastry, and the AI reading endpoint. Chiron is *omitted* from charts rather than defaulted, so its absence is visible.
- Positions come from `astronomy-engine` (MIT), vendored at `web/astronomy.browser.min.js`. Two traps, both documented in `engine_web.dart`: `EclipticLongitude()` is **heliocentric**, and `SunPosition` returns `{elat, elon}` while `EclipticGeoMoon` returns `{lat, lon}` — reading the wrong one yields NaN silently. Positions are now finite-checked at the interop boundary.

## i18n (`lang-switcher.js` + `lang/ru.json`)
- `data-i18n="key"` swaps `textContent`; `data-i18n-html="key"` swaps `innerHTML`.
- `syncCalculatorLanguage()` drives **every** `iframe[data-calc-src]`, not one hard-coded id — both calculators reload with `?lang=ru`. Adding a third calculator is a markup change, not a code change. The comparison is against `getAttribute('src')`, never the `.src` property (which resolves to an absolute URL and would never match).
- If a key's value in `lang/ru.json` contains markup (`<strong>`, `<a>`, `<br/>`), the element **must** use `data-i18n-html` — otherwise the tags render as literal text after switching to RU (and the English original is flattened on switching back, since originals are cached per attribute type).
- Audit after editing translations — script walks `ru.json` for values containing `<` and flags any page still using plain `data-i18n` for them:
  ```
  python3 - <<'EOF'
  import json, re, glob
  d = json.load(open('lang/ru.json')); hk = set()
  def w(o, p=''):
      if isinstance(o, dict):
          for k, v in o.items(): w(v, p + ('.' if p else '') + k)
      elif isinstance(o, str) and '<' in o: hk.add(p)
  w(d)
  for f in glob.glob('**/*.html', recursive=True):
      if f.startswith('calc/'): continue
      for k in re.findall(r'data-i18n="([^"]+)"', open(f, encoding='utf-8').read()):
          if k in hk: print(f, k)
  EOF
  ```
- Fixed 2026-08-13: 10 keys in `guide.html` (`guide.prepare.li1-2`, `guide.limits.li1-7`, `guide.session.during1`) and `contact.guideNudge` in `contact.html` used `data-i18n` for HTML-bearing values.

## Design system — "Imperial"
The site was re-skinned to match the calculator so the two read as one product. Tokens are ported from the calculator's `imperial` theme (`BaziCalculator/lib/theme/imperial_tokens.dart`), where they were sampled pixel-by-pixel from reference art — **don't round them to tidier values**.

- All tokens live in the `:root` block at the top of `style.css`. Change colour there, never inline.
- **House rules:** 1px hairline borders; radii only 6/8/10/24 (`--r-sm/md/lg/pill`); **no drop shadows** — depth is glows (zero offset, large blur); colour is rationed, gold is the only accent.
- **Font:** EB Garamond, self-hosted at `fonts/EBGaramond-Subset.ttf`. Variable (`wght` 400–800), subset to Latin + Cyrillic U+0400–045F. No Google Fonts anywhere. `©` and `✦` are outside the subset — `©` falls back to Georgia, `✦` was replaced by a CSS lozenge.
- **Backdrop — two fixed layers.** `body::before` = `images/bg_lacquer.png` over a radial vignette. `body::after` = `images/celestial-veil.jpg`, the pre-redesign galaxy wallpaper ghosted back in at `opacity: var(--galaxy)` with `mix-blend-mode: screen`. Do **not** use `background-attachment: fixed` — iOS Safari ignores it.
  - The veil must sit **on top**: `bg_lacquer.png` is fully opaque (it has a `tRNS` chunk, but no pixel uses it), so the vignette under it is only a pre-load fallback and anything else placed under it is invisible.
  - `screen` is load-bearing — it can only add light, so the veil never mutes the plate or pulls the gold toward purple.
  - **`--galaxy` ceiling is `.10`.** Above it the 12px footer line in `--ink-muted` drops under 4.5:1 against the brightest stars (measured with glyph-scale integration: `.12` → 4.37:1, `.14` → 4.11:1). If it ever needs to go higher, mask the veil rather than restoring a scrim — removing the scrim was the point of the swap.
  - `images/celestial-veil.jpg` is `celestial-bg.jpg` at 1280px / JPEG q35, then cropped (see below). At 10% opacity the recompression error is 0.87 output levels — under 1, so invisible. The 630 KB original stays as the source.
- **Both backdrop images are cropped so their circular motif sits at the dead centre of the file.** This is load-bearing, not cosmetic — it is the only thing keeping the luopan compass and the veil's medallion concentric.
  - `bg_lacquer.png` — crop `(18, 16, 1498, 876)` of the 1535×1024 original, giving 1480×860. Puts the compass (at px 758,446) dead centre. The box is inset just inside the artwork's decorative border so no partial frame survives at any viewport. **Crop in `P` mode** (`Image.crop()` preserves the palette); converting to RGB quadruples the file.
  - `celestial-veil.jpg` — crop `(0, 0, 1280, 696)`, trimming 18px off the bottom. Puts the medallion (at px 640,348) dead centre.
  - **Re-apply the lacquer crop after every calculator rebuild.** `calc/` is deleted and regenerated, and the site's copy is deliberately different from the calculator's. Skipping this silently restores the uncropped file and the circles drift ~55px apart again. It does not affect the seam — `calculator.html`'s iframe is full-bleed below the nav, so the site's backdrop is never visible there.
  - Why cropping and not `background-position`: for a `cover` layer, a circle at image-fraction `c` with position `p` lands at `c·ih·s + (vh − ih·s)·p`, which collapses to `0.5·vh` when `c = p = 0.5` — the scale term cancels, so it holds at every viewport. Offsets cannot substitute: the veil is wider than any real viewport so it has **zero vertical overflow** and its Y position is inert, while the lacquer has **zero horizontal overflow** and its X position is inert. Dead axes on opposite sides.
  - The hero medallion on `index.html` lands ~47px below the viewport centre at 1280×800. It is placed by the header's pixel flow, not a viewport fraction, so it cannot be registered by the same mechanism.
- **Ornaments** (pure CSS, no images): `.brackets` corner angles, `.rule` hairline broken by a 45° lozenge, `.double-frame` inset second rule.
- `--ink-muted` is the calculator's `fieldValueInk` (#9A9A96), not its `fieldHintInk`. The hint ink is `--ink-faint` and fails WCAG AA as body text — decorative and sub-12px use only.
- `--nav-h` is shared by the nav and `.calc-wrapper`. Previously the wrapper hard-coded 50px against a ~100px nav, so the iframe sat *under* the bar.
- **Nav collapses to the hamburger below 1220px**, in its own media block above the 768px one. Nine links need ~1005px of clear width, and the medallion and language select are absolutely positioned, so an overflowing bar slides text *under* them silently instead of wrapping. Wrapping is not an option — a two-row bar exceeds `--nav-h` and puts both iframes back underneath it. Recompute the breakpoint after adding a nav link.
- Assets were **copied out of** `calc/`, not referenced in place — `calc/` is deleted and regenerated on every calculator rebuild.
- The three legal pages (`privacy`, `agreement`, `readings-terms`) stay self-contained: no `style.css`, no nav. They carry a duplicate token block in an inline `<style>`, byte-identical across all three — edit all three together.

## TODO
- Source files kept in `/Users/nadin_zn-lo/Claude/sample/` — copy new files from there
- `images/fire-horse.png` (3.3 MB) and `images/eclipse.png` (2.8 MB) are served as 120×90 thumbnails — needs a resize pass
- Nav and footer are copy-pasted into 9 pages with no build step, and have drifted before; consider a JS injector or a build step

## Structure
```
index.html       - Home
about.html       - About
services.html    - Services + pricing
contact.html     - Contact form (AJAX submit)
thank-you.html   - Post-submit redirect
guide.html       - Consultation guide
posts.html       - Journal
account.html     - Customer portal (own inline <style>)
calculator.html  - Iframe wrapper for /calc/
privacy.html, agreement.html, readings-terms.html - Legal, self-contained
style.css        - Global styles + :root design tokens
script.js        - Loader + fade-up animations + card expand + hamburger
lang-switcher.js - EN/RU swap via data-i18n attributes
fonts/           - EBGaramond-Subset.ttf (variable, self-hosted)
functions/api/contact.js - Email sending via Resend
wrangler.jsonc   - Cloudflare config
```
