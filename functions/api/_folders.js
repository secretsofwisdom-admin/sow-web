// Folders for saved birth charts: shared by folders/*.js and profiles/*.js.
// Leading underscore => not a route.
//
// Rules (v2, 2026-11-10; v1 of 2026-11-09 filed and deleted differently):
// - Each account is given three starter folders once, on its first listing:
//   kind 'personal', 'family', 'clients', in that order, name NULL so the
//   page shows them in its own language. customers.folders_seeded records
//   it, so an account that deletes every folder does not get them back.
//   After that they behave like any other folder.
// - A chart sits in at most one folder. folder_id NULL means "no folder";
//   nothing is filed by guesswork. A folder_id that points at a deleted
//   folder is cleared on the next listing.
// - Deleting a folder keeps its charts: they move to no folder.
// - "Main" (is_self) is a mark on a chart, not a folder.
import { randomToken } from "./_shared.js";

export const MAX_FOLDERS = 50;
export const MAX_FOLDER_NAME = 60;
const STARTERS = ["personal", "family", "clients"];

// Returns { name } or { error }.
export function cleanFolderName(v) {
  const name = typeof v === "string" ? v.trim() : "";
  if (!name) return { error: "Please give the folder a name." };
  if (name.length > MAX_FOLDER_NAME) return { error: `Folder names are limited to ${MAX_FOLDER_NAME} characters.` };
  return { name };
}

export function folderJson(row) {
  return { id: row.id, kind: row.kind ?? null, name: row.name ?? null, count: row.count ?? 0 };
}

async function listRows(env, customerId) {
  const { results } = await env.DB
    .prepare(
      `SELECT f.id, f.kind, f.name, f.position,
              (SELECT COUNT(*) FROM birth_profiles p WHERE p.customer_id = f.customer_id AND p.folder_id = f.id) AS count
         FROM profile_folders f
        WHERE f.customer_id = ?
        ORDER BY f.position, f.created_at`)
    .bind(customerId).all();
  return results;
}

// Seeds the starter folders once per account, clears links to folders that
// no longer exist, and returns { folders (in order, with counts), unfiled }.
export async function ensureFolders(env, customerId) {
  // Only the listing that flips the flag seeds; a racing second listing
  // changes nothing here. INSERT OR IGNORE + the unique (customer_id, kind)
  // index stay as a second guard.
  const flip = await env.DB
    .prepare("UPDATE customers SET folders_seeded = 1 WHERE id = ? AND folders_seeded = 0")
    .bind(customerId).run();
  if (flip.meta && flip.meta.changes) {
    const now = Date.now();
    await env.DB.batch(STARTERS.map((kind, i) => env.DB
      .prepare("INSERT OR IGNORE INTO profile_folders (id, customer_id, kind, name, position, created_at) VALUES (?, ?, ?, NULL, ?, ?)")
      .bind(randomToken(12), customerId, kind, i, now)));
  }
  await env.DB
    .prepare(
      `UPDATE birth_profiles SET folder_id = NULL
        WHERE customer_id = ? AND folder_id IS NOT NULL
          AND folder_id NOT IN (SELECT id FROM profile_folders WHERE customer_id = ?)`)
    .bind(customerId, customerId).run();
  const folders = await listRows(env, customerId);
  const u = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM birth_profiles WHERE customer_id = ? AND folder_id IS NULL")
    .bind(customerId).first();
  return { folders, unfiled: u.n };
}

// The folder row if it belongs to the customer, else null.
export async function ownFolder(env, customerId, id) {
  if (typeof id !== "string" || !id) return null;
  return env.DB
    .prepare("SELECT id, kind, name FROM profile_folders WHERE id = ? AND customer_id = ?")
    .bind(id, customerId).first();
}
