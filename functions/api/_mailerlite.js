// MailerLite sync helper (leading underscore => not exposed as a route).
// Subscribes / unsubscribes a customer when they toggle the newsletter.
// Requires the MAILERLITE_API_KEY secret. MAILERLITE_GROUP_ID is optional
// (adds the subscriber to a specific group/list).
const BASE = "https://connect.mailerlite.com/api";

export async function syncNewsletter(env, { email, name, subscribed }) {
  if (!env.MAILERLITE_API_KEY) return { skipped: true };

  const body = subscribed
    ? { email, status: "active" }
    : { email, status: "unsubscribed" };

  if (subscribed) {
    if (name) body.fields = { name };
    if (env.MAILERLITE_GROUP_ID) body.groups = [String(env.MAILERLITE_GROUP_ID)];
  }

  // POST /subscribers upserts by email (creates or updates).
  const res = await fetch(`${BASE}/subscribers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MailerLite ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
