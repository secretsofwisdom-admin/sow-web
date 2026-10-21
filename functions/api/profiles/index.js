// GET  /api/profiles               → { profiles: [...] }  (main first, then by name)
// POST /api/profiles { name, form, note?, isSelf? } → the new profile
// Saved birth data for the calculator. Requires a session.
import { json, getSessionCustomer, randomToken, rejectCrossSite } from "../_shared.js";
import {
  MAX_PROFILES, validateBirthForm, cleanName, cleanNote, profileJson, PROFILE_COLUMNS,
} from "../_profiles.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const customer = await getSessionCustomer(env, request);
    if (!customer) return json({ error: "Not signed in." }, 401);
    const { results } = await env.DB
      .prepare(`SELECT ${PROFILE_COLUMNS} FROM birth_profiles WHERE customer_id = ? ORDER BY is_self DESC, name COLLATE NOCASE, created_at`)
      .bind(customer.id).all();
    return json({ profiles: results.map(profileJson) }, 200, { "Cache-Control": "no-store" });
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

    const count = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM birth_profiles WHERE customer_id = ?")
      .bind(customer.id).first();
    if (count.n >= MAX_PROFILES) {
      return json({ error: "limit", message: `You can keep up to ${MAX_PROFILES} profiles.` }, 409);
    }

    const id = randomToken(12);
    const now = Date.now();
    const insert = env.DB
      .prepare("INSERT INTO birth_profiles (id, customer_id, name, is_self, form, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, customer.id, n.name, isSelf ? 1 : 0, JSON.stringify(f.form), t.note, now, now);
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
