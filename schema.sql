-- Secrets of Wisdom — customer portal schema (Cloudflare D1)
-- Apply with:  npx wrangler d1 execute sow-portal --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS customers (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  newsletter  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- Single-use, short-lived passwordless login tokens (stored hashed).
CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0
);

-- Server-side sessions referenced by an httpOnly cookie.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_email     ON login_tokens(email);
CREATE INDEX IF NOT EXISTS idx_sessions_customer ON sessions(customer_id);
