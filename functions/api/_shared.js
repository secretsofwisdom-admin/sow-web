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
