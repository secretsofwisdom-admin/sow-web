// POST /api/auth/reset-request { email }
// Emails a password-reset link if the account exists. Always responds success
// (never reveals whether an email is registered).
import { json, isValidEmail, issueToken, sendEmail, actionEmailHtml } from "../_shared.js";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) return json({ error: "Please enter a valid email address." }, 400);

    const customer = await env.DB.prepare("SELECT id FROM customers WHERE email = ?").bind(email).first();
    if (customer) {
      const token = await issueToken(env, email, "reset", TOKEN_TTL_MS);
      const link = `${new URL(request.url).origin}/account.html?reset=${token}`;
      await sendEmail(env, {
        to: email,
        subject: "Reset your password · Secrets of Wisdom",
        text: `Reset your Secrets of Wisdom password with this link (expires in 30 minutes):\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
        html: actionEmailHtml({
          intro: "Use the button below to set a new password. This link expires in 30 minutes.",
          buttonLabel: "Reset password", link,
          note: "If you didn't request this, your password is unchanged and you can ignore this email.",
        }),
      });
    }
    // Same response whether or not the account exists.
    return json({ success: true });
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}
