// Shared helpers for the customer-portal Functions.
// Leading-underscore filename => not exposed as a route.

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export async function sha256hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(byteLength = 32) {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      if (k) out[k] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return out;
}

// Cookie has NO Domain attribute => host-only. A login on secretsofwisdom.org
// creates a cookie for .org only, and .nz only for .nz — exactly the per-domain
// behaviour requested. It never spans the two domains.
export function sessionCookie(sid, maxAgeSeconds) {
  return `sow_session=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `sow_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Returns the signed-in customer row, or null. Also cleans up expired sessions lazily.
export async function getSessionCustomer(env, request) {
  const sid = parseCookies(request)["sow_session"];
  if (!sid || !env.DB) return null;
  const now = Date.now();
  const session = await env.DB
    .prepare("SELECT customer_id, expires_at FROM sessions WHERE id = ?")
    .bind(sid)
    .first();
  if (!session) return null;
  if (session.expires_at < now) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
    return null;
  }
  return env.DB
    .prepare("SELECT id, email, name, newsletter, created_at FROM customers WHERE id = ?")
    .bind(session.customer_id)
    .first();
}

export function isValidEmail(email) {
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// --- Passwords (PBKDF2-HMAC-SHA256 via Web Crypto; native, fast) ---------------

const PBKDF2_ITERATIONS = 210000;
const SENDER = "Secrets of Wisdom <hello@secretsofwisdom.org>";

function b64encode(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64decode(str) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 200) return "Password is too long.";
  return null;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, keyMaterial, 256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64encode(salt)}$${b64encode(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = b64decode(parts[2]);
  const expected = b64decode(parts[3]);
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, expected.length * 8
  ));
  if (derived.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i];
  return diff === 0;
}

// --- Sessions, tokens, email --------------------------------------------------

const SESSION_TTL_S = 30 * 24 * 60 * 60; // 30 days

export async function createSession(env, customerId) {
  const sid = randomToken(32);
  await env.DB
    .prepare("INSERT INTO sessions (id, customer_id, expires_at) VALUES (?, ?, ?)")
    .bind(sid, customerId, Date.now() + SESSION_TTL_S * 1000)
    .run();
  return { cookie: sessionCookie(sid, SESSION_TTL_S) };
}

// Create a single-use email token (stored hashed). Returns the raw token.
export async function issueToken(env, email, purpose, ttlMs) {
  const token = randomToken(32);
  const tokenHash = await sha256hex(token);
  await env.DB
    .prepare("INSERT INTO login_tokens (token_hash, email, expires_at, used, purpose) VALUES (?, ?, ?, 0, ?)")
    .bind(tokenHash, email, Date.now() + ttlMs, purpose)
    .run();
  return token;
}

export async function sendEmail(env, { to, subject, text, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: SENDER, to, subject, text, html }),
  });
  return res.ok;
}

// Branded wrapper for a call-to-action email (sign-in, confirm, reset).
export function actionEmailHtml({ heading, intro, buttonLabel, link, note }) {
  return (
    `<div style="font-family:Georgia,'Times New Roman',serif;background:#0B0B2B;color:#EDEAE4;padding:32px;border-radius:10px;max-width:520px;margin:auto;">` +
    `<h2 style="color:#C9A84C;font-weight:normal;">Secrets of Wisdom · NZ</h2>` +
    `<p>${intro}</p>` +
    `<p style="text-align:center;margin:28px 0;"><a href="${link}" style="display:inline-block;padding:13px 26px;background:#C9A84C;color:#0B0B2B;text-decoration:none;border-radius:6px;font-weight:bold;">${buttonLabel}</a></p>` +
    `<p style="font-size:13px;color:#B9B3C7;">Or paste this address into your browser:<br><span style="color:#C9A84C;">${link}</span></p>` +
    `<p style="font-size:12px;color:#7d7890;margin-top:24px;">${note}</p>` +
    `</div>`
  );
}
