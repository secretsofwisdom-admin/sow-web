// GET /api/account/me — returns the signed-in customer's profile, or { authenticated:false }.
import { json, getSessionCustomer } from "../_shared.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const customer = await getSessionCustomer(env, request);
  if (!customer) return json({ authenticated: false });
  return json({
    authenticated: true,
    email: customer.email,
    name: customer.name || "",
    newsletter: !!customer.newsletter,
    memberSince: customer.created_at,
  });
}
