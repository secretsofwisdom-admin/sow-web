// Folders for saved birth charts (2026-11-09): shared by folders/*.js and
// profiles/*.js. Leading underscore => not a route.
//
// Rules:
// - Every account has at least one folder. The first listing seeds three
//   starter folders (kind 'family', 'clients', 'personal', name NULL so the
//   page shows them in its own language). After that they behave like any
//   other folder: they can be renamed or deleted.
// - Each chart sits in exactly one folder. A chart with no folder, or with a
//   folder that no longer exists, is moved into the default folder
//   ('personal' while it exists, otherwise the first one) whenever the list
//   is read, so older rows and the calculator builds that predate folders
//   need nothing special.
// - Deleting a folder deletes its charts with it (the holder's choice); the
//   last folder cannot be deleted.
import { randomToken } from "./_shared.js";

export const MAX_FOLDERS = 50;
export const MAX_FOLDER_NAME = 60;
const STARTERS = ["family", "clients", "personal"];

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

export function defaultFolderId(rows) {
  const personal = rows.find((r) => r.kind === "personal");
  return (personal || rows[0])?.id ?? null;
}

// Seeds the starter folders on an account that has none, files every chart
// that has no valid folder, and returns the folders in order with counts.
export async function ensureFolders(env, customerId) {
  let rows = await listRows(env, customerId);
  if (!rows.length) {
    const now = Date.now();
    // OR IGNORE + the unique (customer_id, kind) index: a second listing
    // racing this one cannot add a second set.
    await env.DB.batch(STARTERS.map((kind, i) => env.DB
      .prepare("INSERT OR IGNORE INTO profile_folders (id, customer_id, kind, name, position, created_at) VALUES (?, ?, ?, NULL, ?, ?)")
      .bind(randomToken(12), customerId, kind, i, now)));
    rows = await listRows(env, customerId);
  }
  const target = defaultFolderId(rows);
  if (target) {
    const r = await env.DB
      .prepare(
        `UPDATE birth_profiles SET folder_id = ?
          WHERE customer_id = ?
            AND (folder_id IS NULL OR folder_id NOT IN (SELECT id FROM profile_folders WHERE customer_id = ?))`)
      .bind(target, customerId, customerId).run();
    if (r.meta && r.meta.changes) rows = await listRows(env, customerId);
  }
  return rows;
}

// The folder row if it belongs to the customer, else null.
export async function ownFolder(env, customerId, id) {
  if (typeof id !== "string" || !id) return null;
  return env.DB
    .prepare("SELECT id, kind, name FROM profile_folders WHERE id = ? AND customer_id = ?")
    .bind(id, customerId).first();
}
