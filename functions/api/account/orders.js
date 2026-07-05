// GET /api/account/orders — the signed-in customer's Stripe purchase history.
// Looks up Stripe customers by email, then lists their succeeded charges.
// Requires the STRIPE_SECRET_KEY Pages secret. If it's absent, returns an empty
// list with a note (so the page still works before Stripe is wired up).
import { json, getSessionCustomer } from "../_shared.js";

async function stripeGet(env, path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const customer = await getSessionCustomer(env, request);
  if (!customer) return json({ error: "Not signed in." }, 401);

  if (!env.STRIPE_SECRET_KEY) {
    return json({ orders: [], note: "not_configured" });
  }

  try {
    // Stripe Search API: find customer records with this email.
    const q = encodeURIComponent(`email:'${customer.email.replace(/'/g, "")}'`);
    const found = await stripeGet(env, `customers/search?query=${q}&limit=10`);
    const customerIds = (found.data || []).map((c) => c.id);

    const orders = [];
    for (const cid of customerIds) {
      const charges = await stripeGet(env, `charges?customer=${cid}&limit=100`);
      for (const ch of charges.data || []) {
        if (ch.paid && ch.status === "succeeded") {
          orders.push({
            date: ch.created * 1000,
            amount: ch.amount,
            currency: (ch.currency || "usd").toUpperCase(),
            description: ch.description || ch.calculated_statement_descriptor || "Purchase",
            receiptUrl: ch.receipt_url || null,
            refunded: !!ch.refunded,
          });
        }
      }
    }

    orders.sort((a, b) => b.date - a.date);
    return json({ orders });
  } catch (e) {
    return json({ error: "Could not load your orders right now." }, 502);
  }
}
