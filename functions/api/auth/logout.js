// POST /api/auth/logout — destroys the current session and clears the cookie.
import { json, parseCookies, clearSessionCookie } from "../_shared.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const sid = parseCookies(request)["sow_session"];
  if (sid) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  }
  return json({ success: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
