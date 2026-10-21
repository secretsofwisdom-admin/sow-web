-- 0002: signup takeover fix + saved birth profiles for the calculator.
-- Apply ONCE to the remote database, before the code that needs it is pushed:
--   npx wrangler d1 execute sow-portal --remote --file=./migrations/0002_birth_profiles.sql
-- (schema.sql carries the same end state for a fresh setup.)

-- A password chosen at signup waits here until its confirmation link is
-- clicked (functions/api/auth/signup.js, verify.js).
ALTER TABLE login_tokens ADD COLUMN pending_hash TEXT;

-- Passwords written by the old signup and never confirmed. Any of them may be
-- an intruder's; a genuine owner can still sign in by link or reset.
UPDATE customers SET password_hash = NULL WHERE email_verified = 0;

-- Saved birth data for the calculators. `form` is the BaZi app's birth form
-- as JSON (validated in functions/api/_profiles.js); `name` lives in its own
-- column for sorting. At most one row per customer has is_self = 1.
CREATE TABLE IF NOT EXISTS birth_profiles (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  name        TEXT NOT NULL,
  is_self     INTEGER NOT NULL DEFAULT 0,
  form        TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_customer ON birth_profiles(customer_id, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_self ON birth_profiles(customer_id) WHERE is_self = 1;
