-- 0004: folder rules v2 (2026-11-10).
-- Apply ONCE to the remote database, before the code that needs it is pushed:
--   npx wrangler d1 execute sow-portal --remote --file=./migrations/0004_folder_rules_v2.sql
-- (schema.sql carries the same end state for a fresh setup.)
--
-- 1. Starter folders are seeded once per account, recorded here, so an
--    account that deletes every folder does not get them back on its next
--    listing.
ALTER TABLE customers ADD COLUMN folders_seeded INTEGER NOT NULL DEFAULT 0;
UPDATE customers SET folders_seeded = 1
 WHERE id IN (SELECT customer_id FROM profile_folders);

-- 2. Charts are no longer filed by guesswork. 0003's listing put every chart
--    without a folder into 'personal'. That UPDATE did not touch updated_at,
--    while any move or save by a person does, so a chart in a personal folder
--    last updated before that folder existed was filed by the server: it goes
--    back to no folder. Charts a person filed stay where they are.
UPDATE birth_profiles SET folder_id = NULL
 WHERE folder_id IN (SELECT id FROM profile_folders WHERE kind = 'personal')
   AND updated_at < (SELECT f.created_at FROM profile_folders f WHERE f.id = birth_profiles.folder_id);

-- 3. Starter order: Personal, Family & Friends, Clients. Custom folders
--    already sit at position 3 or later.
UPDATE profile_folders SET position = CASE kind
    WHEN 'personal' THEN 0 WHEN 'family' THEN 1 WHEN 'clients' THEN 2 END
 WHERE kind IS NOT NULL;
