// POST /api/account/update  { name?, newsletter? } — updates profile fields.
import { json, getSessionCustomer } from "../_shared.js";
import { syncNewsletter } from "../_mailerlite.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const customer = await getSessionCustomer(env, request);
  if (!customer) return json({ error: "Not signed in." }, 401);

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : undefined;
  const newsletter = body.newsletter === undefined ? undefined : body.newsletter ? 1 : 0;

  if (name !== undefined) {
    await env.DB.prepare("UPDATE customers SET name = ? WHERE id = ?").bind(name || null, customer.id).run();
  }
  if (newsletter !== undefined) {
    await env.DB.prepare("UPDATE customers SET newsletter = ? WHERE id = ?").bind(newsletter, customer.id).run();
    // Best-effort sync to MailerLite. The D1 flag is the source of truth, so we
    // never fail the request if the email tool is unavailable.
    try {
      await syncNewsletter(env, {
        email: customer.email,
        name: name !== undefined ? name : customer.name,
        subscribed: newsletter === 1,
      });
    } catch (e) {
      // Swallow — can be re-synced later.
    }
  }
  return json({ success: true });
}
