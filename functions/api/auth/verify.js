// GET /api/auth/verify?token=...
// Validates the magic link, starts a 30-day session, sets the cookie, and
// redirects to /account.html on the SAME domain the link was opened on.
import { sha256hex, randomToken, sessionCookie } from "../_shared.js";

const SESSION_TTL_S = 30 * 24 * 60 * 60; // 30 days

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
    .prepare("SELECT email, expires_at, used FROM login_tokens WHERE token_hash = ?")
    .bind(tokenHash)
    .first();

  if (!row || row.used === 1 || row.expires_at < now) {
    return redirect("/account.html?error=expired");
  }

  // Burn the token immediately (single use).
  await env.DB.prepare("UPDATE login_tokens SET used = 1 WHERE token_hash = ?").bind(tokenHash).run();

  const customer = await env.DB.prepare("SELECT id FROM customers WHERE email = ?").bind(row.email).first();
  if (!customer) return redirect("/account.html?error=invalid");

  const sid = randomToken(32);
  await env.DB
    .prepare("INSERT INTO sessions (id, customer_id, expires_at) VALUES (?, ?, ?)")
    .bind(sid, customer.id, now + SESSION_TTL_S * 1000)
    .run();

  return redirect("/account.html", sessionCookie(sid, SESSION_TTL_S));
}
