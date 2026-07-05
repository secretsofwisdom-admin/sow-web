// POST /api/auth/signup { name, email, password }
// Creates (or claims) an account with a password, then emails a confirmation
// link. The password is NOT usable until the link is clicked — this proves the
// signer controls the email, preventing takeover of an address that already has
// orders. On confirm (verify.js), email_verified flips to 1 and login works.
import { json, isValidEmail, passwordProblem, hashPassword, issueToken, sendEmail, actionEmailHtml, randomToken } from "../_shared.js";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim().slice(0, 120);
    const password = String(body.password || "");

    if (!isValidEmail(email)) return json({ error: "Please enter a valid email address." }, 400);
    const pwErr = passwordProblem(password);
    if (pwErr) return json({ error: pwErr }, 400);

    const existing = await env.DB
      .prepare("SELECT id, password_hash, email_verified FROM customers WHERE email = ?")
      .bind(email).first();

    if (existing && existing.password_hash && existing.email_verified === 1) {
      return json({ error: "An account with this email already exists. Please sign in or reset your password." }, 409);
    }

    const passwordHash = await hashPassword(password);
    const now = Date.now();

    if (!existing) {
      await env.DB
        .prepare("INSERT INTO customers (id, email, name, newsletter, created_at, password_hash, email_verified) VALUES (?, ?, ?, 0, ?, ?, 0)")
        .bind(randomToken(16), email, name || null, now, passwordHash).run();
    } else {
      // Claim / (re)set password on an existing account; require re-confirmation.
      await env.DB
        .prepare("UPDATE customers SET password_hash = ?, email_verified = 0, name = COALESCE(NULLIF(?, ''), name) WHERE email = ?")
        .bind(passwordHash, name, email).run();
    }

    const token = await issueToken(env, email, "verify", TOKEN_TTL_MS);
    const link = `${new URL(request.url).origin}/api/auth/verify?token=${token}`;
    const ok = await sendEmail(env, {
      to: email,
      subject: "Confirm your account · Secrets of Wisdom",
      text: `Welcome to Secrets of Wisdom.\n\nConfirm your account and finish signing in with this link (expires in 30 minutes):\n\n${link}\n\nIf you didn't create an account, you can ignore this email.`,
      html: actionEmailHtml({
        intro: "Confirm your account to finish signing in. This link expires in 30 minutes.",
        buttonLabel: "Confirm account",
        link,
        note: "If you didn't create an account, you can safely ignore this email.",
      }),
    });
    if (!ok) return json({ error: "We couldn't send the confirmation email. Please try again shortly." }, 502);

    return json({ success: true, pending: "verify" });
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}
