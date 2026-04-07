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
- **From:** onboarding@resend.dev (until domain verified)
- **On success:** redirects to thank-you.html

## TODO
- Verify secretsofwisdom.org domain in Resend → then update `from` and `to` in contact.js
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
