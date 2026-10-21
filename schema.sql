-- Secrets of Wisdom — customer portal schema (Cloudflare D1)
-- Apply with:  npx wrangler d1 execute sow-portal --remote --file=./schema.sql
-- (fresh database only; an existing one is brought up to date by migrations/)

CREATE TABLE IF NOT EXISTS customers (
  id             TEXT PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  name           TEXT,
  newsletter     INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  password_hash  TEXT,                      -- PBKDF2 string; NULL for email-link-only accounts
  email_verified INTEGER NOT NULL DEFAULT 0 -- 1 once ownership proven (link click or reset)
);

-- Single-use, short-lived email tokens (stored hashed).
-- purpose: 'login' (magic link) | 'verify' (confirm signup) | 'reset' (password reset)
CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  purpose     TEXT NOT NULL DEFAULT 'login',
  pending_hash TEXT                         -- signup password, applied only when this 'verify' link is clicked
);

-- Server-side sessions referenced by an httpOnly cookie.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_email     ON login_tokens(email);
CREATE INDEX IF NOT EXISTS idx_sessions_customer ON sessions(customer_id);

-- Saved birth data for the calculators (migrations/0002_birth_profiles.sql).
CREATE TABLE IF NOT EXISTS birth_profiles (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  name        TEXT NOT NULL,
  is_self     INTEGER NOT NULL DEFAULT 0, -- the account holder's own chart; at most one
  form        TEXT NOT NULL,              -- BaZi birth form as JSON, see functions/api/_profiles.js
  note        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_customer ON birth_profiles(customer_id, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_self ON birth_profiles(customer_id) WHERE is_self = 1;
