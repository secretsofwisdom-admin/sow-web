// GET  /api/folders          → { folders: [{ id, kind, name, count }], unfiled }  (seeds the starters once)
// POST /api/folders { name } → the new folder
// Folders for saved birth charts; rules in ../_folders.js. Requires a session.
import { json, getSessionCustomer, randomToken, rejectCrossSite } from "../_shared.js";
import { MAX_FOLDERS, cleanFolderName, ensureFolders, folderJson } from "../_folders.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const customer = await getSessionCustomer(env, request);
    if (!customer) return json({ error: "Not signed in." }, 401);
    const { folders, unfiled } = await ensureFolders(env, customer.id);
    return json({ folders: folders.map(folderJson), unfiled }, 200, { "Cache-Control": "no-store" });
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
    const n = cleanFolderName(body.name);
    if (n.error) return json({ error: n.error }, 400);

    const { folders: rows } = await ensureFolders(env, customer.id);
    if (rows.length >= MAX_FOLDERS) {
      return json({ error: "limit", message: `You can keep up to ${MAX_FOLDERS} folders.` }, 409);
    }
    const position = rows.reduce((m, r) => Math.max(m, r.position), -1) + 1;
    const id = randomToken(12);
    await env.DB
      .prepare("INSERT INTO profile_folders (id, customer_id, kind, name, position, created_at) VALUES (?, ?, NULL, ?, ?, ?)")
      .bind(id, customer.id, n.name, position, Date.now()).run();
    return json(folderJson({ id, kind: null, name: n.name, count: 0 }), 201);
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}
