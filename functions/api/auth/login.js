// POST /api/auth/login { email, password }
// Verifies the password and starts a session. Requires email_verified = 1,
// so a password only works after its email confirmation has been clicked.
import { json, isValidEmail, verifyPassword, createSession, issueToken, sendEmail, actionEmailHtml } from "../_shared.js";

const VERIFY_TTL_MS = 30 * 60 * 1000;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!isValidEmail(email) || !password) {
      return json({ error: "Invalid email or password." }, 400);
    }

    const customer = await env.DB
      .prepare("SELECT id, password_hash, email_verified FROM customers WHERE email = ?")
      .bind(email).first();

    const ok = customer && customer.password_hash && (await verifyPassword(password, customer.password_hash));
    if (!ok) {
      return json({ error: "Invalid email or password." }, 401);
    }

    if (customer.email_verified !== 1) {
      // Correct password but unconfirmed email — re-send the confirmation link.
      const token = await issueToken(env, email, "verify", VERIFY_TTL_MS);
      const link = `${new URL(request.url).origin}/api/auth/verify?token=${token}`;
      await sendEmail(env, {
        to: email,
        subject: "Confirm your account · Secrets of Wisdom",
        text: `Confirm your account to finish signing in (expires in 30 minutes):\n\n${link}`,
        html: actionEmailHtml({
          intro: "Confirm your account to finish signing in. This link expires in 30 minutes.",
          buttonLabel: "Confirm account", link,
          note: "If you didn't request this, you can ignore this email.",
        }),
      });
      return json({ error: "Please confirm your email first — we've sent you a new link.", pending: "verify" }, 403);
    }

    const { cookie } = await createSession(env, customer.id);
    return json({ success: true }, 200, { "Set-Cookie": cookie });
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}
