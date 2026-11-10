-- 0003: folders for saved birth charts (2026-11-09).
-- Apply ONCE to the remote database, before the code that needs it is pushed:
--   npx wrangler d1 execute sow-portal --remote --file=./migrations/0003_profile_folders.sql
-- (schema.sql carries the same end state for a fresh setup.)
--
-- Every account gets three starter folders the first time its charts are
-- listed (functions/api/_folders.js, ensureFolders). `kind` marks those three
-- ('family', 'clients', 'personal'); `name` stays NULL until the holder
-- renames one, and a NULL name is shown in the page's language. Custom
-- folders have kind NULL and a name. Each chart sits in exactly one folder;
-- a chart whose folder_id is NULL or points at nothing is moved into the
-- default folder on the next listing, so this migration needs no data step.
CREATE TABLE IF NOT EXISTS profile_folders (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  kind        TEXT,
  name        TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_folders_customer ON profile_folders(customer_id, position);
-- Two first listings racing each other cannot seed the starter folders twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_kind ON profile_folders(customer_id, kind) WHERE kind IS NOT NULL;

ALTER TABLE birth_profiles ADD COLUMN folder_id TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_folder ON birth_profiles(customer_id, folder_id);
