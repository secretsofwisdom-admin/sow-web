// GET /api/auth/verify?token=...
// Handles 'login' (magic link) and 'verify' (signup confirmation) tokens.
// Validates the token, marks the email verified, starts a 30-day session, sets
// the cookie, and redirects to /account.html on the SAME domain it was opened on.
// (Password-reset tokens are handled separately via /account.html?reset=...)
import { sha256hex, createSession } from "../_shared.js";

function redirect(location, cookie) {
  const headers = { Location: location };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token) return redirect("/account.html?error=invalid");

  const tokenHash = await sha256hex(token);
  const now = Date.now();

  const row = await env.DB
    .prepare("SELECT email, expires_at, used, purpose FROM login_tokens WHERE token_hash = ?")
    .bind(tokenHash)
    .first();

  // Accept login + verify links here; reject reset tokens (they use another flow).
  if (!row || row.used === 1 || row.expires_at < now || (row.purpose !== "login" && row.purpose !== "verify")) {
    return redirect("/account.html?error=expired");
  }

  await env.DB.prepare("UPDATE login_tokens SET used = 1 WHERE token_hash = ?").bind(tokenHash).run();

  const customer = await env.DB.prepare("SELECT id FROM customers WHERE email = ?").bind(row.email).first();
  if (!customer) return redirect("/account.html?error=invalid");

  // Clicking the emailed link proves ownership → mark verified (enables password login).
  await env.DB.prepare("UPDATE customers SET email_verified = 1 WHERE id = ?").bind(customer.id).run();

  const { cookie } = await createSession(env, customer.id);
  return redirect("/account.html", cookie);
}
