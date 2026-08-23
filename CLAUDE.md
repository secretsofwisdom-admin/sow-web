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
- **`main.dart.js` carries no content hash here either**, exactly as in `astro/`. A browser that has loaded the page once keeps serving the old bundle after a rebuild — locally too, and there is no service worker to blame. Verifying a rebuild on the port you last used will show you the *previous* app and nothing will look wrong. Serve on a **fresh port**; that is a new origin and a cold cache.
- JS build, not `--wasm` (despite `DEPLOY_WEB.md`) — parent page isn't cross-origin-isolated.
- Security headers come from the **root `_headers`** (`/calc/*` → `X-Frame-Options: SAMEORIGIN`). Pages ignores nested `calc/_headers`. Never set DENY there — it blanks the iframe.
- Replace the whole folder each time; asset hashes change between builds.
- **The resting input panel carries name, gender and the unknown-hour checkbox** (2026-08-22). Gender rides the `Birth Date` caption, the checkbox shares the hour/minute row, and the name field shares the GO button's row — which is why `LayoutSpec.inputPanel` only had to grow 460 → 470. `BaziCalculator/CLAUDE.md` has the arithmetic, and the reason the time row now has *two* dimming wrappers rather than one.
- **The subject's name prints after the 八字 badge on the `Your Chart Plot` line, at the title's own size** — not above the Ten Gods / Symbolic Stars reading. A long one shrinks to fit rather than truncating (`ShrinkToFitLine`, a render object — `BaziCalculator/CLAUDE.md` records why a `LayoutBuilder` + `Text` version measured one thing and drew another). On a phone it takes the subtitle's line instead.
- **No in-app language switcher.** The globe `PopupMenuButton` was removed from `_HeaderActions` in `lib/widgets/imperial/app_header.dart` (2026-08-15) — the site nav select is the only control, and it reaches the app over the postMessage channel. `localeProvider` stays: it still resolves `?lang=` on a cold start and receives the message. `locale_switch_test.dart` guards both the absence of the icon and that the site's choice still turns the UI over.

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
- **`main.dart.js` carries no content hash**, so a browser that has seen the page keeps serving the old app after a deploy. Hard-refresh when checking a rebuild — locally too; a second server on a fresh port is the reliable way to be sure you are looking at the new bundle.
- Headers come from the **root `_headers`** (`/astro/*` → `SAMEORIGIN`). Never DENY.
- Shared Dart was **copied** from BaziCalculator, not extracted into a package — that project is not to be modified. `city_database.dart`, `city_aliases.dart`, `text_search.dart` and `imperial_tokens.dart` now exist twice; a city fix has to be applied in both or the two calculators disagree about where someone was born.
- `AstroCalculator/staging/` holds Imperial widgets copied but not yet ported (they still import `package:bazi_calculator/…`). Excluded from `flutter analyze`.
- **Nothing the birth form shows may live in widget state.** The screen picks a different tree at each breakpoint, so crossing one destroys `_BirthFormState` and every `TextEditingController` with it — a filled form went blank on a resize while the cast chart stayed. The raw text of all four boxes (`name`, `dateText`, `timeText`, `cityQuery`) lives in `birthFormProvider`, the controllers are seeded from it in `initState`, and a `ref.listen` pushes later changes back in. `showFormErrorsProvider` holds the "Cast pressed on an incomplete form" flag for the same reason.
  - The place box is `RawAutocomplete`, not `Autocomplete`, purely so the form can own that controller too — the convenience widget keeps its own and it dies with the widget.
  - Parsing lives in `BirthFormNotifier.setDateText` / `setTimeText` (with free `parseDate` / `parseTime`), not in the fields, so a half-typed date is a state the form can hold and a rule that can be tested without a widget.
  - `home_layout_test.dart` is the regression: fill, cast, resize across 1240 and 980, assert every value is still on screen.
- **`DigitMaskFormatter`** (`lib/utils/input_masks.dart`) types the separators in: `15061981` → `15.06.1981`, `1145` → `11:45`. The separator appears **with** the digit that completes its group, and backspacing onto one deletes the digit in front of it — removing only the separator would let the formatter re-add it, and mid-string the text would not change at all. `input_masks_test.dart` pins both directions.
- **Three layout bands, in `home_screen.dart`:** ≥1240 form (300) | chart | aspects (300); 980–1239 form (300) | everything stacked; below that one column. The form rail is 300 because BaZi's is 260 of a 1448-unit canvas — the same proportion, read against a 1360px page. `AspectList` reflows to a two-line row under 420px (`aspectCompactWidth`), which is what makes a 300px rail readable and also fixes the squeeze on a phone. The house-system dropdown needs `isExpanded: true` at that width, and the "time unknown" checkbox sits on its own line — *Время неизвестно* beside a time box overflows a 300px rail.
- **The Cast button is never disabled.** `BirthFormState.missing` reports which of date / time / place is outstanding, and a failed press paints `errorText` on each one plus a summary line — a disabled button cannot say what is wrong with the form. `cityQuery` exists so a *typed but never picked* place (an apparently filled field with a null `City`) gets its own message instead of reading as empty; editing away from the picked city clears it. Covered by `birth_form_state_test.dart` and `birth_form_widget_test.dart`.
- **Wheel is `wheelWidthFactor` (0.7) of its panel**, set in `widgets/zoomable_wheel.dart`, with `InteractiveViewer` and −/↻/+ buttons around it. `scaleEnabled: false` on purpose: **pinch belongs to the browser**, and letting the viewer claim it too means whichever grabs the gesture first leaves the other dead. `panEnabled` is off until the wheel is actually zoomed, so at rest a one-finger drag still scrolls the page. `LayoutBuilder` + `SizedBox.square`, not `FractionallySizedBox` — the wheel sits in a Column with unbounded height.
- **Tokens are three `static const` instances behind a Riverpod provider**, not a `ThemeExtension`. `_WheelPainter` has no `BuildContext` at paint time so it needs the palette passed as a field regardless, which is what the provider approach already does; `ThemeExtension` would also demand a hand-written `lerp` over 16 fields for a crossfade nobody wants under a chart wheel. Providers live in `lib/providers/theme_providers.dart` and are named to match BaZi's (`themeIdProvider`, `imperialTokensProvider`, `themeDataProvider`).
  - The 15 shared role values sit between `// --- SHARED ROLE PALETTE ---` markers in `imperial_tokens.dart`. The file as a whole has diverged past a useful diff (this app deleted `fromTheme` and every element map), so "fix a colour in both places" is kept by diffing that **block**, not the file.
  - `shouldRepaint` compares `old.t != t` by **identity**, which is correct only because the palettes are canonicalised `static const`. Adding `operator ==` to `ImperialTokens` for tidiness would silently make it a 16-field compare every frame. Pinned by `wheel_repaint_test.dart`.
  - 18 dead fields and 7 dead lookups were removed (BaZi leftovers; one pointed at an asset absent from this project). `errorInk` had four definitions and is now one per-theme token, guarded by a test that fails on any `Color(0x` outside `lib/theme/`.
  - `imperial`'s `errorInk` measures **3.66:1** on its own `panelFill` — under AA for the 12.5px error text it paints. Pre-existing and preserved because imperial is frozen; the test pins it at 3.6 so it cannot get worse. `light` does not inherit the shortfall.
  - There is **no `buttonBottom`** here (it was one of the pruned fields). `FilledButtonThemeData` uses a flat `backgroundColor: t.buttonTop`, so `buttonTop` is the **whole** fill — unlike the site, where `--btn-top` genuinely is a gradient stop. That is why light inverts figure and ground: a pale gold plate cannot carry dark ink at AA (3.07:1).
- **`web/index.html` sets the first-paint background per theme.** `#12100E` is a *dark* flash inside a pale page, as wrong as the white flash it was added to prevent. The `?theme=` reader there is a separate block from the pinch-zoom patches — do not merge them.
- **Not yet built:** Chiron (needs a one-off JPL Horizons fetch to generate `assets/chiron.bin` — the only external network dependency in the build), transits, synastry, and the AI reading endpoint. Chiron is *omitted* from charts rather than defaulted, so its absence is visible.
- Positions come from `astronomy-engine` (MIT), vendored at `web/astronomy.browser.min.js`. Two traps, both documented in `engine_web.dart`: `EclipticLongitude()` is **heliocentric**, and `SunPosition` returns `{elat, elon}` while `EclipticGeoMoon` returns `{lat, lon}` — reading the wrong one yields NaN silently. Positions are now finite-checked at the interop boundary.
- **Backdrop:** the app paints the site's galaxy wallpaper itself (`StarfieldBackdrop`), because `.calc-wrapper` makes the iframe full-bleed and the site's own `body::after` is never visible on `astrology.html`. Same two layers, same order, same per-theme blend as `style.css`. Both veil files under `AstroCalculator/assets/images/` are **copies** of the site's — re-copy if the site's are ever re-cropped or the two drift (check 9 catches it).
  - **Which veil, and how it is composited, is a map keyed by `ThemeId`** — `veils` in `starfield_backdrop.dart`: the two dark palettes screen `celestial-veil.jpg`, `light` multiplies `celestial-veil-light.jpg`. Deliberately *not* fields on `ImperialTokens`: that class is the role palette kept in step with BaZi's, and BaZi has no veil at all. The lookup ends in `!`, so a fourth palette added without an entry compiles and throws on first use — `veil_test.dart` is the only thing standing between the two, and it also asserts both files exist, are covered by a `pubspec` asset directory, and are both 1280×696.
  - Opacity is `.18` in every palette, not the site's `--galaxy: .10`. The site's number is a contrast limit that does not apply here: every widget that carries text — `ChartSummary`, `PlacementTable`, `_EmptyState`, even the theme button — is inside an opaque `ImperialPanel`, so nothing is ever read against the backdrop. **Re-check that before raising it.** The limit here is attention: screen over a near-black ground passes the photo through at nearly full strength, so at `.34` the wallpaper's medallion competes with the chart wheel.
  - Flutter has no blend-mode widget — `Opacity` alpha-composites and `ShaderMask` blends the *other* way — so `_BlendMask` is a small `RenderProxyBox` doing `saveLayer` with a blended paint.

## Pinch-zoom (both calculators)

The site's own pages have always allowed zoom. The calculators blocked it, for **three** reasons, all injected by the Flutter engine at runtime and none visible in the source. The first two block a **touchscreen** pinch; the third blocks a **trackpad** pinch, which is a different gesture on a different event and was missed on the first pass.

1. It **deletes every author `<meta name="viewport">`** in `<head>` and appends its own carrying `maximum-scale=1.0, user-scalable=no` (`a4q()` in `main.dart.js`). Declaring a zoomable viewport in `web/index.html` is therefore useless — it gets thrown away.
2. It sets `touch-action: none` on `<body>`. `touch-action` applies to the element under the fingers, and both iframes are full-bleed, so this swallowed the pinch for the *whole page*, not just the app.
3. It **cancels every `wheel` event** — `A.aMB("wheel", handler, !1, q)` registers a *non-passive* listener on `<flutter-view>`, and the handler ends in a bare `a.preventDefault()` on both branches unless Dart has called `allowPlatformDefault(true)`, which neither app does. The guarded branch is `if (framed && fullPageEmbedder)`, and both hold here: each build owns its whole document and the site loads it in an iframe.

Reason 3 is the one that matters on a laptop. **A trackpad pinch is not a touch gesture** — Chrome and Firefox deliver it as a `wheel` event carrying `ctrlKey`. `touch-action` never sees it and the viewport meta is ignored for desktop zoom, so fixes 1 and 2 could not have helped, and the page stayed unzoomable on a trackpad long after touch pinch worked.

Fixed in each project's `web/index.html`:

- a `<style>` rule `body { touch-action: pinch-zoom !important; }` — `pinch-zoom` gives the browser two-finger pinch and nothing else, so single-pointer gestures still reach Flutter and the app's own scrolling and tapping are untouched. The `!important` is what outranks the engine's inline style.
- a script **after** `flutter_bootstrap.js` that rewrites the meta to `maximum-scale=5.0, user-scalable=yes`. It has to run after the engine, so it fixes the tag if present and otherwise watches `document.head` with a `MutationObserver`. The observer is deliberately left connected — writing `content` is an attribute change and cannot re-trigger a childList observer, so there is no loop.
- a **capture-phase** `wheel` listener on `window`, in `<head>` so it is registered before the engine boots, that calls `stopPropagation()` when `e.ctrlKey` is set. The engine's listener is on `<flutter-view>`, a descendant, so stopping the event at the first step of the propagation path means it is never invoked and nothing cancels the gesture. Two rules for that handler: it must **never** call `preventDefault()` (that would kill the zoom exactly as Flutter did), and it must test `ctrlKey` — diverting plain wheel would take the apps' own scrolling with it.

Both fixes survive a rebuild because they live in `web/index.html`, which Flutter copies into `build/web`. The `calc/` and `astro/` copies here were hand-patched too, so the current fix ships without a Flutter rebuild; `diff` each against its source and only the `<base href>` line should differ.

**Re-check after a Flutter upgrade.** The minified names drift between builds and are quoted in comments only — this build's meta-replacer is `aaK`, not the `a4q` the note above was written against, and the wheel handler is `ai_` in `calc/` but `abE` in `astro/`. Grep for behaviour, not names:

```
python3 -c "import re;s=open('calc/main.dart.js',encoding='utf-8',errors='replace').read();[print(repr(s[m.start()-420:m.start()+200])) for m in re.finditer(r'\"wheel\"',s)]"
```

Known limit: while the page is zoomed, Flutter still consumes plain wheel, so panning may only be possible during the pinch gesture itself. If that becomes a problem the listener can also pass wheel through while `visualViewport.scale > 1` — at the cost of the app's own scrolling whenever the page is zoomed. Safari is untested: macOS Safari sends `gesturestart`/`gesturechange` for a trackpad pinch rather than `ctrlKey` wheel, and Flutter does not listen to those, so it should already zoom.

## i18n (`lang-switcher.js` + `lang/ru.json`)
- `data-i18n="key"` swaps `textContent`; `data-i18n-html="key"` swaps `innerHTML`.
- **Two paths to the calculators, and the split is load-bearing.** `syncCalculatorLanguage()` sets `?lang=ru` on `iframe[data-calc-src]` and runs **only from `init()`**, i.e. the app's cold start. `postCalculatorLanguage()` handles every later switch over `postMessage`. Both drive *every* `iframe[data-calc-src]`, not a hard-coded id, so a third calculator is a markup change, not a code change. The src comparison is against `getAttribute('src')`, never the `.src` property (which resolves to an absolute URL and would never match).
  - Why: setting `src` **reloads the iframe**, which restarts the Flutter app and empties its form state — while the browser restores the visible text into Flutter's hidden DOM inputs. The fields looked filled, the state was gone, and "Построить карту" was dead with no explanation. Fixed 2026-08-15. Do not go back to reloading.
  - The apps listen in `lib/utils/lang_channel*.dart` (conditional import, origin-checked) and post `{source:'sow-calc', type:'ready'}` on startup; the page answers with the current language. That handshake is what covers a switch made while the app is still booting.
  - `BaziCalculator`'s SDK floor was raised to `>=3.5.0` for that file (`extension type` needs 3.3, `JSAny.isA` needs 3.4).
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
- **The brand is marked non-translatable.** Every occurrence of `Secrets of Wisdom · NZ` and the bare alias `NZ` carries `translate="no" class="notranslate"` — the HTML5 attribute plus Google's older class, because Yandex honours only the class. Added 2026-08-17: Chrome's built-in Google Translate was expanding `NZ` into "Новая Зеландия" and rendering the name as "Тайны Мудрости", so the English page machine-translated to "Секреты мудрости · Родилась Новая Зеландия". Nothing in the repo ever said New Zealand.
  - Both markers are **inherited by descendants**, so `[data-i18n-brand]` needs them only on the `<h1>`; the `.brand-en` / `.brand-ru` spans that `lang-switcher.js` injects, and the plain text `restoreEnglish()` puts back, are covered without touching the script or `brand.*` in `ru.json`.
  - Wrapping the brand inside a translatable string forces that key onto `data-i18n-html` — that is why `footer`, `index.welcome`, `index.meetHeading`, `about.heading`, `about.p1` and `about.bio` moved. `footer` is one key on **nine** pages: convert all nine together or the stragglers print raw `<span …>` in Russian.
  - The markers cannot reach `<head>`, so every page also carries `<meta name="google" content="notranslate" />` right after the charset meta — that is what keeps the **tab title** from being translated, and it switches Chrome's auto-translate off for the whole site. The trade was accepted knowingly: visitors on a third language lose browser translation and get the site's own EN/RU select instead. Both layers are kept — the meta stops the offer, the per-element markers still hold if someone starts a translation by hand.
  - The three legal pages carry the same markers by hand (crest `div`, intro paragraph, footer line) — no i18n there.

- Fixed 2026-08-13: 10 keys in `guide.html` (`guide.prepare.li1-2`, `guide.limits.li1-7`, `guide.session.during1`) and `contact.guideNudge` in `contact.html` used `data-i18n` for HTML-bearing values.

## Themes (`theme-switcher.js` + `[data-theme]`)

Two palettes: `imperial` (the original) and `light` (warm parchment). Selectable from a nav select on all 11 nav-bearing pages and from a `PopupMenuButton` inside the astro calculator.

- A third, `lifted` (dark with raised grounds), shipped 2026-08-21 and was **removed 2026-08-22**. It was a small visual delta from `imperial` for a third of the QA matrix. Removal is safe by construction: `THEMES` on the site and `ImperialTokens.parse()` in the app are both allowlists, so a visitor with `lifted` still in `localStorage` resolves to `imperial` rather than to anything broken — verified. The stale key is left in place; every read rejects it.

- **`imperial` is frozen and is the *absence* of the attribute.** The default lives in bare `:root`; `light` is an `html[data-theme="light"]` block, which at (0,1,1) beats `:root` at (0,1,0) with no `!important`. A visitor with nothing stored gets byte-identical CSS to before the feature existed. `theme_tokens_test.dart` pins all 16 app-side values; don't "tidy" them.
- **Hand-authored, not derived.** BaZi's `ImperialTokens.fromTheme` is a derivation factory and what it produced for light grounds was Material blue on near-white. A lerp also cannot reverse an ordering, and in light the gold ramp's ordering **does** reverse.
- **The gold ramp's names mean prominence, not luminance.** On parchment the emphatic gold is the *darkest*: `--gold-bright` is darkest and `--gold-rule` palest, the reverse of both dark sets. Authoring light with the dark ordering is the likeliest source of "it looks wrong and I can't say why", and the contrast floors are blind to it — contrast is symmetric, ordering is not. A ramp-ordering test in the app pins it.
  - `--gold-rule` is the most-used token in the sheet (21 uses) and is entirely hairlines. A prettier light value like `#C9B183` measures 1.99:1 and every rule, bracket and double-frame silently vanishes.
  - `goldDim` must stay *more* present than `goldRule` in every palette; a first draft had light swapped.
- **Light `--galaxy` is `.10` — the same number as imperial, for the opposite reason.** The imperial constraint does not transfer: there the veil *adds* light and the risk is washing out pale text; under `multiply` it *removes* light and the risk is darkening the ground under dark text. Sign flipped, same locus (the 12px footer line in `--ink-muted`). It is **declared, not inherited**, so a dark-side change cannot drag it along.
  - Re-measured against the real `celestial-veil-light.jpg`; an earlier `.14` was set from a modelled veil and did not survive. Glyph-scale integration over a 6×12 box (the statistic the dark `.10` was set with) / raw worst pixel: `.10` → 5.16 / 4.62, `.12` → 5.05 / **4.46**, `.14` → 4.92 / 4.30, `.16` → 4.77 / 4.15.
  - Glyph-scale alone would allow ~`.20`. It sits at `.10` because the shipping **dark** backdrop measures 5.61 glyph / 5.43 raw and so clears AA on *both* metrics — running light at `.14` would make it the one place on the site with sub-4.5 backdrop pixels under text. Matching the stricter standard costs almost nothing: the medallion, nebula and spirals all still read at `.10`.
  - The three legal pages carry the same value and the same override in their own `<style>`; edit all three together.
- **Light drops the lacquer plate.** `bg_lacquer.png` is fully opaque, so on a pale ground it is a dark slab over the page, not a texture — the same reason BaZi's light themes leave `backgroundPlate` null. `html[data-theme="light"] body::before` restates the vignette alone.
- **First paint needs a synchronous inline script in every `<head>`**, immediately after `<meta charset>` and *before* the stylesheet. `lang-switcher.js` and `theme-switcher.js` are `defer`, which is far too late — the wrong ground is already painted. The `try/catch` is mandatory: `localStorage` throws in Safari private mode and an uncaught throw there blocks the parser before the stylesheet loads. It must be inline and blocking, so it cannot be a shared file; that duplication across 14 pages is correct.
- **`theme-switcher.js` is deliberately separate from `lang-switcher.js`.** The language machinery is delicate and load-bearing. The only thing the two share is the single `message` listener, which stays in `lang-switcher.js` so there is **one** origin check — that check is the whole security boundary.

### The channel, both directions

```
site → app   { source:'sow',      type:'lang',  lang:'en'|'ru' }
site → app   { source:'sow',      type:'theme', theme:'imperial'|'light' }
app  → site  { source:'sow-calc', type:'ready' }
app  → site  { source:'sow-calc', type:'theme', theme:'…' }
```

- **Two narrow messages, never one combined `{lang, theme}`.** Deployed calculator bundles only understand `{type:'lang'}`, so a site deploy landing before an app rebuild would break the *working* language feature. One extra `postMessage` per handshake buys independent deployability.
- **`calcUrl(base, lang, theme)` builds the whole query in one function, and must stay that way.** The obvious shape — one sync function per setting — has each building a *complete* URL from its own parameter, so whichever runs second erases the first and cold-start language silently dies. `theme=imperial` is omitted so the default URL is unchanged.
- **Loop prevention, three independent stops:** the app's notifier returns early when the palette already matches; the site returns early if the incoming theme equals `currentTheme()`; and **posting happens only in the popup's `onSelected`, never in a listener on the theme provider**. A gesture posts, a state change does not — so an inbound message cannot provoke an outbound one.
- **Allowlist before storing.** The origin check makes the trust boundary "any document on this origin", which includes both Flutter apps. `THEMES.indexOf(...)` on the site, `ImperialTokens.parse()` returning null on the app side.
- **The apps do not persist the theme.** They share one `localStorage` with the site on this origin, so a `SharedPreferences` write would not create a second store — it would create a second key claiming authority over one setting. `?theme=` covers cold start, the handshake covers the boot race, `postMessage` covers the rest.
  - BaZi's `ThemeNotifier.loadSavedTheme()` has **no `_chosen` guard** where `LocaleNotifier.loadSavedLocale()` does, and fires from a `Future.microtask` after `announceReady()`. Dormant today; it becomes a live race the moment BaZi joins the channel. Delete the call or port the guard.

### `scripts/check_theme_invariants.py`

Read-only, run from the repo root. Asserts the things that have actually drifted: all 11 navs byte-identical, the same inline first-paint script on all 14 pages, every **colour** token present and *different* in both `[data-theme]` blocks, the stylesheet version stamp, the three legal `<style>` blocks identical, both veils' copies matching by md5, and `images/bg_lacquer.png` still 1480×860. It found real nav drift in `account.html` on its first run.

- Scoped to colours on purpose — radii, font stack, `--nav-h` and bracket geometry are shared across palettes, and `--galaxy` may legitimately be inherited. Earlier drafts flagged correct CSS twice by being stricter than the invariant actually is.
- Checks SKIP rather than fail when the thing they guard does not exist yet, so it is runnable mid-rollout.

**After editing `style.css`, restamp**, or check 7b fails:

```
python3 scripts/stamp_css.py
```

- `style.css` is served `max-age=14400` while the HTML is `max-age=0`, so without a changing URL a returning visitor pairs **new markup with a four-hour-old stylesheet** — the inline script sets `data-theme`, the cached sheet has no `[data-theme]` blocks to answer it, and `.nav-controls` renders unstyled.
- The stamp is `md5(style.css)[:8]`, **not a date**. A date only busts the cache on the first edit of a given day; the second edit that day produces the same stamp and the hole silently reopens — which nearly happened on the light-veil change. A content hash lets check 7b *verify* rather than merely compare equal, so forgetting to restamp fails the check instead of shipping.
- The three legal pages load no stylesheet and are deliberately outside both the stamp and the check.

## Design system — "Imperial"
The site was re-skinned to match the calculator so the two read as one product. Tokens are ported from the calculator's `imperial` theme (`BaziCalculator/lib/theme/imperial_tokens.dart`), where they were sampled pixel-by-pixel from reference art — **don't round them to tidier values**.

- All tokens live in the `:root` block at the top of `style.css`. Change colour there, never inline.
- **House rules:** 1px hairline borders; radii only 6/8/10/24 (`--r-sm/md/lg/pill`); **no drop shadows** — depth is glows (zero offset, large blur); colour is rationed, gold is the only accent.
- **Font:** EB Garamond, self-hosted at `fonts/EBGaramond-Subset.ttf`. Variable (`wght` 400–800), subset to Latin + Cyrillic U+0400–045F. No Google Fonts anywhere. `©` and `✦` are outside the subset — `©` falls back to Georgia, `✦` was replaced by a CSS lozenge.
- **Backdrop — two fixed layers.** `body::before` = `images/bg_lacquer.png` over a radial vignette. `body::after` = `images/celestial-veil.jpg`, the pre-redesign galaxy wallpaper ghosted back in at `opacity: var(--galaxy)` with `mix-blend-mode: screen`. Do **not** use `background-attachment: fixed` — iOS Safari ignores it.
  - The veil must sit **on top**: `bg_lacquer.png` is fully opaque (it has a `tRNS` chunk, but no pixel uses it), so the vignette under it is only a pre-load fallback and anything else placed under it is invisible.
  - `screen` is load-bearing — it can only add light, so the veil never mutes the plate or pulls the gold toward purple.
  - **Light mode drops the plate and swaps the veil for a different file** — `images/celestial-veil-light.jpg` with `mix-blend-mode: multiply`. A blend change alone cannot do it: `screen` over parchment has no darkness left to lift and washes out, while `multiply` with the *dark* photo paints a negative. `multiply` is the exact mirror of `screen` — it can only remove light — and the asset is built to exploit that: empty sky is pure white, and multiply by white is a no-op, so most of the frame is left as the vignette painted it. Only `background-image` and `mix-blend-mode` are overridden; `center center / cover no-repeat` are longhands the shorthand already set and they carry over, taking the concentric-medallion contract with them.
  - **`--galaxy` ceiling is `.10`.** Above it the 12px footer line in `--ink-muted` drops under 4.5:1 against the brightest stars (measured with glyph-scale integration: `.12` → 4.37:1, `.14` → 4.11:1). If it ever needs to go higher, mask the veil rather than restoring a scrim — removing the scrim was the point of the swap.
  - `images/celestial-veil.jpg` is `celestial-bg.jpg` at 1280px / JPEG q35, then cropped (see below). At 10% opacity the recompression error is 0.87 output levels — under 1, so invisible. The 630 KB original stays as the source.
- **Both backdrop images are cropped so their circular motif sits at the dead centre of the file.** This is load-bearing, not cosmetic — it is the only thing keeping the luopan compass and the veil's medallion concentric.
  - `bg_lacquer.png` — crop `(18, 16, 1498, 876)` of the 1535×1024 original, giving 1480×860. Puts the compass (at px 758,446) dead centre. The box is inset just inside the artwork's decorative border so no partial frame survives at any viewport. **Crop in `P` mode** (`Image.crop()` preserves the palette); converting to RGB quadruples the file.
  - `celestial-veil.jpg` — crop `(0, 0, 1280, 696)`, trimming 18px off the bottom. Puts the medallion (at px 640,348) dead centre.
  - `celestial-veil-light.jpg` is **derived per-pixel** from that file by `scripts/make_light_veil.py`, so it inherits the crop exactly — but a resize anywhere in that pipeline would break the registration silently, which is why both the script and `veil_test.dart` assert 1280×696.
  - **Re-apply the lacquer crop after every calculator rebuild.** `calc/` is deleted and regenerated, and the site's copy is deliberately different from the calculator's. Skipping this silently restores the uncropped file and the circles drift ~55px apart again. It does not affect the seam — `calculator.html`'s iframe is full-bleed below the nav, so the site's backdrop is never visible there.
- **The light veil is generated, not drawn** — `python3 scripts/make_light_veil.py` writes both copies in one pass (site `images/`, `AstroCalculator/assets/images/`) so they cannot drift. **BaZi has no veil and needs none.** Two findings from building it, both contradicting what was expected:
  - **The chroma has to be discarded, and the failure of not doing so is a *cool* cast, not a green one.** The planning note recorded "inverted mean G−B +9.7 → pale green", but that is the veil file's own frame mean and is a bad proxy: the pixels that matter are the veil's *dark* ones, the only place `multiply` does any work, and those are the inverse of the photo's brightest regions — the gold medallion and the blue-white nebula. Inverted, gold becomes blue. Measured over the darkest decile at full strength, naive inversion lands at **R 52.8 / G 69.1 / B 90.3** — blue-dominant with R *lowest*, the exact reverse of the parchment it sits on — and at the shipping opacity it drags the ground's warm spread from G−B +14.3 down to +9.3, scattering visible pink and green blotches where the nebula was. Converting to `L` first and re-colouring from one umber→white ramp gives **R 118.9 / G 107.3 / B 87.0**, warm ordering kept, composited shift +0.8 instead of −5.0.
  - **PNG-8 lost badly and JPEG q35 won.** The expectation was that a mostly-flat-white frame would quantise small; only ~3% of pixels are actually flat sky, the rest is continuous nebula gradient, so PNG-8 measured **469–621 KB against JPEG's 82 KB**. Its lower error buys nothing visible at 10% opacity. Same q35 as the dark veil.
  - Endpoints are `black='#4A3E28'` (warm sepia ink floor, so the heaviest wash is umber not a grey bruise; tunable between `#2E2A22` and `#6B5730`) and `white='#FFFFFF'` (so empty sky is a multiply no-op).
  - Why cropping and not `background-position`: for a `cover` layer, a circle at image-fraction `c` with position `p` lands at `c·ih·s + (vh − ih·s)·p`, which collapses to `0.5·vh` when `c = p = 0.5` — the scale term cancels, so it holds at every viewport. Offsets cannot substitute: the veil is wider than any real viewport so it has **zero vertical overflow** and its Y position is inert, while the lacquer has **zero horizontal overflow** and its X position is inert. Dead axes on opposite sides.
  - The hero medallion on `index.html` lands ~47px below the viewport centre at 1280×800. It is placed by the header's pixel flow, not a viewport fraction, so it cannot be registered by the same mechanism.
- **Ornaments** (pure CSS, no images): `.brackets` corner angles, `.rule` hairline broken by a 45° lozenge, `.double-frame` inset second rule.
- `--ink-muted` is the calculator's `fieldValueInk` (#9A9A96), not its `fieldHintInk`. The hint ink is `--ink-faint` and fails WCAG AA as body text — decorative and sub-12px use only.
- `--nav-h` is shared by the nav and `.calc-wrapper`. Previously the wrapper hard-coded 50px against a ~100px nav, so the iframe sat *under* the bar.
- **Nav collapses to the hamburger below 1270px**, in its own media block above the 768px one. An overflowing bar slides text *under* the absolutely-positioned medallion and controls instead of wrapping. Wrapping is not an option — a two-row bar exceeds `--nav-h` and puts both iframes back underneath it.
  - **The arithmetic here used to be wrong.** It was recorded as a sum (`926 links + 76 medallion + 79 select = 1081 → 1100`), but `nav` is `justify-content: center` with the logo and `.nav-controls` absolutely positioned, so the links are **centred** and the clearance condition is `viewport > linkRun + 2*controlsWidth + 48`. Controls count **twice** — shaving 11px off them moved the threshold by 22.
  - Measured 2026-08-21 in the browser, both languages: **EN 1152, RU 1265.** Measure with the Russian nav actually rendered; `lang/ru.json` loads async, so measuring straight after `sowSwitchLang('ru')` measures English twice.
  - The old 1100 was computed for English only, so **Russian was already colliding between 1100 and 1179 on the live site** before the theme select existed. Check both languages, always.
  - One breakpoint serves both, set to the worse case. English therefore collapses at 1270 rather than its own 1152, losing ~110px of range; splitting per-language needs `html[lang="ru"]` variants of the whole block including `--nav-h`, which `.calc-wrapper` depends on, and that was judged not worth the duplication.
  - Both selects use `appearance: none` with an 8px SVG caret. That is worth ~16px each, and because controls count twice it is the difference between a 1280px laptop keeping the full nav and losing it. Don't restore the native arrow without re-measuring.
- Assets were **copied out of** `calc/`, not referenced in place — `calc/` is deleted and regenerated on every calculator rebuild.
- The three legal pages (`privacy`, `agreement`, `readings-terms`) stay self-contained: no `style.css`, no nav. They carry a duplicate token block in an inline `<style>`, byte-identical across all three — edit all three together (check 8 in the invariant script asserts it).
  - Their vocabulary **differs from `style.css`**: `--bg --bg2 --panel --ink --muted --gold --gold-soft --line --radius --galaxy`. Write theme overrides against those names, not the sheet's.
  - `body::before` there **hardcodes** `#1A1C1E / #0E1114 / #03050A` rather than reading tokens, so a palette override has to restate the whole layer.
  - They follow the theme but carry **no toggle** — they are footer links nobody lands on first, and back returns to a page that has one. They do get the inline first-paint script, which is the only `<script>` on them; four lines, inline and dependency-free, so "self-contained" still holds.

## TODO
- **BaZi is still dark-only.** It ships five themes (`imperial`/`classic`/`crimson`/`jade`/`porcelain`) with its own switcher and `SharedPreferences`, and ignores the theme channel, so `calculator.html` stays imperial while the site around it goes light. Reducing it to the same two needs **30 hand-authored element colours** (5 families × 6 roles × 1 new palette) — the largest remaining palette task, and invisible from the astro side. Delete `loadSavedTheme()` from its `main.dart` when wiring the channel (see the race note above).
- `SUN` / `MOON` are hardcoded English in `ChartSummary` (`AstroCalculator/lib/widgets/placement_table.dart`) — the RU chart summary reads `АСЦЕНДЕНТ`, then `SUN`, `MOON`
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
lang-switcher.js - EN/RU swap via data-i18n attributes; owns the iframe URL + the one postMessage listener
theme-switcher.js - Palette switching; paired with a synchronous inline script in every <head>
scripts/          - check_theme_invariants.py (read-only), make_light_veil.py,
                    stamp_css.py — all run from the repo root
fonts/           - EBGaramond-Subset.ttf (variable, self-hosted)
functions/api/contact.js - Email sending via Resend
wrangler.jsonc   - Cloudflare config
```
