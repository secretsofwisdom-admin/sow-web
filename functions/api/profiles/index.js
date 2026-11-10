// GET  /api/profiles               → { profiles: [...], folders: [...], unfiled }  (main first, then by name)
// POST /api/profiles { name, form, note?, isSelf?, folderId? } → the new profile
// Without folderId the chart has no folder; a folderId that is not one of the
// holder's own folders is refused (400). See ../_folders.js. `folders` was
// added 2026-11-09, `unfiled` 2026-11-10; older calculator builds read only
// `profiles`.
// Saved birth data for the calculator. Requires a session.
import { json, getSessionCustomer, randomToken, rejectCrossSite } from "../_shared.js";
import {
  MAX_PROFILES, validateBirthForm, cleanName, cleanNote, profileJson, PROFILE_COLUMNS,
} from "../_profiles.js";
import { ensureFolders, folderJson, ownFolder } from "../_folders.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const customer = await getSessionCustomer(env, request);
    if (!customer) return json({ error: "Not signed in." }, 401);
    // Before the profiles: it clears links to deleted folders.
    const { folders, unfiled } = await ensureFolders(env, customer.id);
    const { results } = await env.DB
      .prepare(`SELECT ${PROFILE_COLUMNS} FROM birth_profiles WHERE customer_id = ? ORDER BY is_self DESC, name COLLATE NOCASE, created_at`)
      .bind(customer.id).all();
    return json({ profiles: results.map(profileJson), folders: folders.map(folderJson), unfiled }, 200, { "Cache-Control": "no-store" });
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const bad = rejectCrossSite(request);
    if (bad) return bad;
    const customer = await getSessionCustomer(env, request);
    if (!customer) return json({ error: "Not signed in." }, 401);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);
    const n = cleanName(body.name);
    if (n.error) return json({ error: n.error }, 400);
    const f = validateBirthForm(body.form);
    if (f.error) return json({ error: f.error }, 400);
    const t = cleanNote(body.note);
    if (t.error) return json({ error: t.error }, 400);
    const isSelf = body.isSelf === true;
    if (body.folderId != null && typeof body.folderId !== "string") return json({ error: "Invalid request." }, 400);

    const count = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM birth_profiles WHERE customer_id = ?")
      .bind(customer.id).first();
    if (count.n >= MAX_PROFILES) {
      return json({ error: "limit", message: `You can keep up to ${MAX_PROFILES} profiles.` }, 409);
    }

    let folderId = null;
    if (body.folderId != null) {
      const folder = await ownFolder(env, customer.id, body.folderId);
      if (!folder) return json({ error: "Unknown folder." }, 400);
      folderId = folder.id;
    }

    const id = randomToken(12);
    const now = Date.now();
    const insert = env.DB
      .prepare("INSERT INTO birth_profiles (id, customer_id, name, is_self, form, note, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, customer.id, n.name, isSelf ? 1 : 0, JSON.stringify(f.form), t.note, folderId, now, now);
    // Only one main profile: clear the old one in the same batch.
    await env.DB.batch(isSelf
      ? [env.DB.prepare("UPDATE birth_profiles SET is_self = 0 WHERE customer_id = ? AND is_self = 1").bind(customer.id), insert]
      : [insert]);

    const row = await env.DB
      .prepare(`SELECT ${PROFILE_COLUMNS} FROM birth_profiles WHERE id = ? AND customer_id = ?`)
      .bind(id, customer.id).first();
    return json(profileJson(row), 201);
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}
