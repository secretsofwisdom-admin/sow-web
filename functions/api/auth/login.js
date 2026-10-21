// POST /api/auth/login { email, password }
// Verifies the password and starts a session. A password reaches the account
// only through a clicked confirmation or reset link (signup.js, verify.js).
import { json, isValidEmail, verifyPassword, createSession, issueToken, sendEmail, actionEmailHtml, publicOrigin } from "../_shared.js";

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
      // Signed up but never clicked the confirmation: the password is still
      // waiting on its token, not on the account. If this is that password,
      // say so and send a fresh link carrying the same hash. Only for an
      // account never confirmed: on an established one the pending password
      // may be a stranger's, and re-mailing it would let them spam the owner
      // with links that look like the owner's own signup.
      const pending = customer && customer.email_verified !== 1 && await env.DB
        .prepare("SELECT pending_hash FROM login_tokens WHERE email = ? AND purpose = 'verify' AND used = 0 AND pending_hash IS NOT NULL ORDER BY expires_at DESC LIMIT 1")
        .bind(email).first();
      if (pending && (await verifyPassword(password, pending.pending_hash))) {
        const token = await issueToken(env, email, "verify", VERIFY_TTL_MS, pending.pending_hash);
        const link = `${publicOrigin(request)}/api/auth/verify?token=${token}`;
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
      return json({ error: "Invalid email or password." }, 401);
    }

    // Since signup stopped writing unconfirmed passwords, a row with a hash is
    // always verified. Kept as a guard for rows written before that change.
    if (customer.email_verified !== 1) {
      return json({ error: "Invalid email or password." }, 401);
    }

    const { cookie } = await createSession(env, customer.id);
    return json({ success: true }, 200, { "Set-Cookie": cookie });
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}
