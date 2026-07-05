// POST /api/auth/reset-confirm { token, password }
// Consumes a reset token, sets the new password, marks the email verified
// (the click proves ownership), and starts a session.
import { json, passwordProblem, hashPassword, sha256hex, createSession } from "../_shared.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "");
    const password = String(body.password || "");

    const pwErr = passwordProblem(password);
    if (pwErr) return json({ error: pwErr }, 400);
    if (!token) return json({ error: "This reset link is invalid." }, 400);

    const tokenHash = await sha256hex(token);
    const now = Date.now();
    const row = await env.DB
      .prepare("SELECT email, expires_at, used, purpose FROM login_tokens WHERE token_hash = ?")
      .bind(tokenHash).first();

    if (!row || row.used === 1 || row.purpose !== "reset" || row.expires_at < now) {
      return json({ error: "This reset link is invalid or has expired. Please request a new one." }, 400);
    }

    await env.DB.prepare("UPDATE login_tokens SET used = 1 WHERE token_hash = ?").bind(tokenHash).run();

    const passwordHash = await hashPassword(password);
    await env.DB
      .prepare("UPDATE customers SET password_hash = ?, email_verified = 1 WHERE email = ?")
      .bind(passwordHash, row.email).run();

    const customer = await env.DB.prepare("SELECT id FROM customers WHERE email = ?").bind(row.email).first();
    if (!customer) return json({ error: "Account not found." }, 400);

    const { cookie } = await createSession(env, customer.id);
    return json({ success: true }, 200, { "Set-Cookie": cookie });
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}
