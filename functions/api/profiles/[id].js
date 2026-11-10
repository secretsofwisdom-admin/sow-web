// PATCH  /api/profiles/:id { name?, form?, note?, isSelf?, folderId? } → the updated profile
// folderId: one of the holder's folders (else 400), or null for no folder.
// DELETE /api/profiles/:id                                  → { success: true }
// Every query is scoped to the signed-in customer, so another account's id
// behaves exactly like one that does not exist (404).
import { json, getSessionCustomer, rejectCrossSite } from "../_shared.js";
import { validateBirthForm, cleanName, cleanNote, profileJson, PROFILE_COLUMNS } from "../_profiles.js";
import { ownFolder } from "../_folders.js";

async function guard(context) {
  const { request, env } = context;
  const bad = rejectCrossSite(request);
  if (bad) return { error: bad };
  const customer = await getSessionCustomer(env, request);
  if (!customer) return { error: json({ error: "Not signed in." }, 401) };
  const id = String(context.params.id || "");
  const exists = await env.DB
    .prepare("SELECT id FROM birth_profiles WHERE id = ? AND customer_id = ?")
    .bind(id, customer.id).first();
  if (!exists) return { error: json({ error: "Profile not found." }, 404) };
  return { customer, id };
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  try {
    const g = await guard(context);
    if (g.error) return g.error;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);

    const sets = [];
    const args = [];
    if ("name" in body) {
      const n = cleanName(body.name);
      if (n.error) return json({ error: n.error }, 400);
      sets.push("name = ?"); args.push(n.name);
    }
    if ("form" in body) {
      const f = validateBirthForm(body.form);
      if (f.error) return json({ error: f.error }, 400);
      sets.push("form = ?"); args.push(JSON.stringify(f.form));
    }
    if ("note" in body) {
      const t = cleanNote(body.note);
      if (t.error) return json({ error: t.error }, 400);
      sets.push("note = ?"); args.push(t.note);
    }
    if ("isSelf" in body) {
      if (typeof body.isSelf !== "boolean") return json({ error: "Invalid request." }, 400);
      sets.push("is_self = ?"); args.push(body.isSelf ? 1 : 0);
    }
    if ("folderId" in body) {
      if (body.folderId === null) {
        sets.push("folder_id = NULL");
      } else {
        const folder = await ownFolder(env, g.customer.id, body.folderId);
        if (!folder) return json({ error: "Unknown folder." }, 400);
        sets.push("folder_id = ?"); args.push(folder.id);
      }
    }
    if (!sets.length) return json({ error: "Nothing to change." }, 400);
    sets.push("updated_at = ?"); args.push(Date.now());

    const update = env.DB
      .prepare(`UPDATE birth_profiles SET ${sets.join(", ")} WHERE id = ? AND customer_id = ?`)
      .bind(...args, g.id, g.customer.id);
    await env.DB.batch(body.isSelf === true
      ? [env.DB.prepare("UPDATE birth_profiles SET is_self = 0 WHERE customer_id = ? AND is_self = 1 AND id != ?").bind(g.customer.id, g.id), update]
      : [update]);

    const row = await env.DB
      .prepare(`SELECT ${PROFILE_COLUMNS} FROM birth_profiles WHERE id = ? AND customer_id = ?`)
      .bind(g.id, g.customer.id).first();
    return json(profileJson(row));
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env } = context;
  try {
    const g = await guard(context);
    if (g.error) return g.error;
    await env.DB
      .prepare("DELETE FROM birth_profiles WHERE id = ? AND customer_id = ?")
      .bind(g.id, g.customer.id).run();
    return json({ success: true });
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}
