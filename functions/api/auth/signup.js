// POST /api/auth/signup { name, email, password }
// Creates (or claims) an account with a password, then emails a confirmation
// link. The password is NOT written to the account here: its hash rides on the
// confirmation token and verify.js applies it only when that exact link is
// clicked. Writing it straight onto the row (as this file once did) let anyone
// sign up with a stranger's address: the stranger's next ordinary sign-in link
// marked the address verified, and the intruder's password started working.
import { json, isValidEmail, passwordProblem, hashPassword, issueToken, sendEmail, actionEmailHtml, randomToken, publicOrigin } from "../_shared.js";

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
      // No password on the row yet; it arrives with the confirmation click.
      await env.DB
        .prepare("INSERT INTO customers (id, email, name, newsletter, created_at, password_hash, email_verified) VALUES (?, ?, ?, 0, ?, NULL, 0)")
        .bind(randomToken(16), email, name || null, now).run();
    }
    // An existing account is left exactly as it is: its owner may be signing
    // in by link today, and nothing an unconfirmed visitor sends may change that.

    const token = await issueToken(env, email, "verify", TOKEN_TTL_MS, passwordHash);
    const link = `${publicOrigin(request)}/api/auth/verify?token=${token}`;
    const ok = await sendEmail(env, existing && existing.email_verified === 1 ? {
      to: email,
      subject: "Set a password for your account · Secrets of Wisdom",
      text: `Someone asked to set a password for the Secrets of Wisdom account that uses this address.\n\nIf it was you, confirm with this link (expires in 30 minutes):\n\n${link}\n\nIf it wasn't you, ignore this email. Nothing changes until the link is clicked.`,
      html: actionEmailHtml({
        intro: "Someone asked to set a password for the account that uses this address. If it was you, confirm below. This link expires in 30 minutes.",
        buttonLabel: "Confirm new password",
        link,
        note: "If it wasn't you, ignore this email. Nothing changes until the link is clicked.",
      }),
    } : {
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
