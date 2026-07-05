// POST /api/auth/request-link  { email, name? }
// Creates/loads the customer, issues a single-use magic link, emails it via Resend.
// The link uses the SAME origin the request came from, so it returns the visitor
// to the exact domain (.org or .nz) they were already on.
import { json, sha256hex, randomToken, isValidEmail } from "../_shared.js";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim().slice(0, 120);

    if (!isValidEmail(email)) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const now = Date.now();
    const existing = await env.DB.prepare("SELECT id FROM customers WHERE email = ?").bind(email).first();
    if (!existing) {
      await env.DB
        .prepare("INSERT INTO customers (id, email, name, newsletter, created_at) VALUES (?, ?, ?, 0, ?)")
        .bind(randomToken(16), email, name || null, now)
        .run();
    } else if (name) {
      await env.DB
        .prepare("UPDATE customers SET name = ? WHERE email = ? AND (name IS NULL OR name = '')")
        .bind(name, email)
        .run();
    }

    const token = randomToken(32);
    const tokenHash = await sha256hex(token);
    await env.DB
      .prepare("INSERT INTO login_tokens (token_hash, email, expires_at, used) VALUES (?, ?, ?, 0)")
      .bind(tokenHash, email, now + TOKEN_TTL_MS)
      .run();

    const origin = new URL(request.url).origin;
    const link = `${origin}/api/auth/verify?token=${token}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Secrets of Wisdom <onboarding@resend.dev>",
        to: email,
        subject: "Your sign-in link · Secrets of Wisdom",
        text:
          `Welcome to Secrets of Wisdom.\n\n` +
          `Use the link below to sign in to your account. It expires in 15 minutes and can be used once.\n\n${link}\n\n` +
          `If you didn't request this, you can safely ignore this email.`,
        html:
          `<div style="font-family:Georgia,'Times New Roman',serif;background:#0B0B2B;color:#EDEAE4;padding:32px;border-radius:10px;max-width:520px;margin:auto;">` +
          `<h2 style="color:#C9A84C;font-weight:normal;">Secrets of Wisdom · NZ</h2>` +
          `<p>Use the button below to sign in to your account. This link expires in 15 minutes and can be used once.</p>` +
          `<p style="text-align:center;margin:28px 0;"><a href="${link}" style="display:inline-block;padding:13px 26px;background:#C9A84C;color:#0B0B2B;text-decoration:none;border-radius:6px;font-weight:bold;">Sign in</a></p>` +
          `<p style="font-size:13px;color:#B9B3C7;">Or paste this address into your browser:<br><span style="color:#C9A84C;">${link}</span></p>` +
          `<p style="font-size:12px;color:#7d7890;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>` +
          `</div>`,
      }),
    });

    if (!res.ok) {
      return json({ error: "We couldn't send the login email. Please try again shortly." }, 502);
    }
    return json({ success: true });
  } catch (e) {
    return json({ error: "Server error. Please try again." }, 500);
  }
}
