// PATCH  /api/folders/:id { name } → the renamed folder
// DELETE /api/folders/:id          → { success: true, movedCharts: n }
// Deleting a folder keeps its charts: they move to "no folder" (rules v2,
// 2026-11-10). Any folder may be deleted, the last one included.
// Every query is scoped to the signed-in customer, so another account's id
// is a 404.
import { json, getSessionCustomer, rejectCrossSite } from "../_shared.js";
import { cleanFolderName, folderJson, ownFolder } from "../_folders.js";

async function guard(context) {
  const { request, env } = context;
  const bad = rejectCrossSite(request);
  if (bad) return { error: bad };
  const customer = await getSessionCustomer(env, request);
  if (!customer) return { error: json({ error: "Not signed in." }, 401) };
  const folder = await ownFolder(env, customer.id, String(context.params.id || ""));
  if (!folder) return { error: json({ error: "Folder not found." }, 404) };
  return { customer, folder };
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  try {
    const g = await guard(context);
    if (g.error) return g.error;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);
    const n = cleanFolderName(body.name);
    if (n.error) return json({ error: n.error }, 400);
    await env.DB
      .prepare("UPDATE profile_folders SET name = ? WHERE id = ? AND customer_id = ?")
      .bind(n.name, g.folder.id, g.customer.id).run();
    const c = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM birth_profiles WHERE customer_id = ? AND folder_id = ?")
      .bind(g.customer.id, g.folder.id).first();
    return json(folderJson({ ...g.folder, name: n.name, count: c.n }));
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env } = context;
  try {
    const g = await guard(context);
    if (g.error) return g.error;
    const [charts] = await env.DB.batch([
      env.DB.prepare("UPDATE birth_profiles SET folder_id = NULL WHERE customer_id = ? AND folder_id = ?").bind(g.customer.id, g.folder.id),
      env.DB.prepare("DELETE FROM profile_folders WHERE id = ? AND customer_id = ?").bind(g.folder.id, g.customer.id),
    ]);
    return json({ success: true, movedCharts: charts.meta?.changes ?? 0 });
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}
