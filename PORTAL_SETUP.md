# Customer Portal — Setup Guide

A passwordless customer portal at **/account.html**, running entirely on your existing
Cloudflare Pages + Functions stack. **No new subscription** — Cloudflare D1 (database) and
Workers/Functions are on the free tier, and it reuses your existing Resend key for email.

What customers get: sign in with an email link (no password), view their **Stripe order
history**, edit their **name**, and toggle the **newsletter**. Sessions are per-domain — a
login on `.org` stays on `.org`, a login on `.nz` stays on `.nz`, and all navigation keeps
them on whichever domain they entered (every link is relative).

---

## What was added

```
schema.sql                          - D1 tables (customers, login_tokens, sessions)
wrangler.jsonc                      - D1 binding "DB" (needs your database_id)
account.html                        - the portal page (login + dashboard)
functions/api/_shared.js            - shared helpers (sessions, cookies, hashing)
functions/api/auth/request-link.js  - POST: email a magic sign-in link
functions/api/auth/verify.js        - GET:  validate link, start session
functions/api/auth/logout.js        - POST: end session
functions/api/account/me.js         - GET:  current profile
functions/api/account/update.js     - POST: save name / newsletter (syncs to MailerLite)
functions/api/account/orders.js     - GET:  Stripe purchase history
functions/api/_mailerlite.js        - MailerLite subscribe/unsubscribe helper
```
An **Account** link was also added to the nav on every page.

---

## One-time setup (about 10 minutes)

You need the Wrangler CLI (`npm install -g wrangler`) and to be logged in (`wrangler login`).

### 1. Create the D1 database

```bash
npx wrangler d1 create sow-portal
```

Copy the `database_id` it prints, and paste it into **wrangler.jsonc**, replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`.

### 2. Create the tables

```bash
npx wrangler d1 execute sow-portal --remote --file=./schema.sql
```

### 3. Bind D1 to Pages (so the live site can see it)

In the Cloudflare dashboard: **Workers & Pages → sow-web → Settings → Functions →
D1 database bindings → Add binding.** Set **Variable name = `DB`**, database = **sow-portal**.
(This mirrors what wrangler.jsonc declares, for the deployed site.)

### 4. Add the Stripe secret (for order history)

In the dashboard: **sow-web → Settings → Environment variables / Secrets → Add**:

- Name: `STRIPE_SECRET_KEY`
- Value: your Stripe **secret** key (`sk_live_...`, or `sk_test_...` while testing)

`RESEND_API_KEY` is already set (used by the contact form) and is reused for login emails.

### 4b. Connect MailerLite (for the newsletter) — optional but recommended

The newsletter toggle stores the opt-in in D1 **and** syncs to MailerLite so you can actually
send campaigns. Cloudflare has no newsletter product, so this is where the list lives.

1. Create a free **MailerLite** account (free up to 1,000 subscribers).
2. **Integrations → API → Generate new token.** Copy it.
3. (Optional) Create a **Group** (e.g. "Website subscribers") and copy its **group ID**
   (Subscribers → Groups → the group → the number in the URL).
4. In Cloudflare **sow-web → Settings → Secrets**, add:
   - `MAILERLITE_API_KEY` = your token
   - `MAILERLITE_GROUP_ID` = the group ID (only if you made a group)

Behaviour: toggle **on** → subscriber added/activated (and put in the group); toggle **off**
→ status set to unsubscribed. If `MAILERLITE_API_KEY` is absent, the toggle still works and
just saves the flag in D1 — nothing breaks.

### 5. Deploy

Push to the `main` branch as usual — Cloudflare Pages auto-builds. The portal is live at
`/account.html` on both domains.

---

## How order history matches customers

Orders are matched by **email**. When a Stripe payment (Payment Link or Checkout) collects
the customer's email, Stripe creates/attaches a Customer record; the portal searches those by
the signed-in email and lists succeeded charges with receipts. For this to line up:

- In each **Payment Link / Checkout**, keep **"Collect customer email"** on (it's on by default).
- Encourage customers to use the **same email** at checkout that they sign in with.

Calendar bookings (Cal.com) are **not** shown here yet — those are confirmed by Cal.com's own
emails. Adding them later is possible but needs Cal.com API wiring.

---

## Security notes

- Login links are single-use, expire in 15 minutes, and are stored **hashed** (SHA-256).
- Sessions are random 32-byte IDs in an **httpOnly, Secure, SameSite=Lax** cookie, 30-day life.
- The cookie has no `Domain` attribute, so it never spans `.org` and `.nz` — exactly the
  per-domain behaviour you asked for.

## Housekeeping (optional)

Expired tokens/sessions are cleaned lazily. To purge in bulk occasionally:

```bash
npx wrangler d1 execute sow-portal --remote --command \
  "DELETE FROM login_tokens WHERE expires_at < unixepoch()*1000; DELETE FROM sessions WHERE expires_at < unixepoch()*1000;"
```

## Note on the "from" address

Login emails currently send from `onboarding@resend.dev` (same as your contact form) until
`secretsofwisdom.org` is verified in Resend. Once verified, update the `from:` line in
`functions/api/auth/request-link.js` to e.g. `Secrets of Wisdom <hello@secretsofwisdom.org>`.
