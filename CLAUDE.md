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

## TODO
- Source files kept in `/Users/nadin_zn-lo/Claude/sample/` — copy new files from there

## Structure
```
index.html       - Home
about.html       - About
services.html    - Services + pricing
contact.html     - Contact form (AJAX submit)
thank-you.html   - Post-submit redirect
style.css        - Global styles
script.js        - Loader + fade-up animations
functions/api/contact.js - Email sending via Resend
wrangler.jsonc   - Cloudflare config
```
