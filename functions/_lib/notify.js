/*
  Phone notifications through ntfy (ntfy.sh): install the free ntfy app, subscribe to your topic,
  and the shop pushes "New order" alerts and the daily ship-by reminder to it.

  Setting needed in Cloudflare (Settings → Variables and secrets):
    NTFY_TOPIC   your topic name. Anyone who knows it can read the alerts, so make it long and random,
                 like edm-orders-x7k2q9w4m8. The alerts never include buyer names or addresses.
  Optional:
    NTFY_SERVER  defaults to https://ntfy.sh
*/

export const ORDERS_URL = "https://shop.edmcveigh.com/orders/";

// Sends one push. Never throws: a failed notification must not break a sale.
export async function notify(env, { title, message, priority = 3, tags = [], click = ORDERS_URL }) {
  if (!env.NTFY_TOPIC) return false;
  try {
    const res = await fetch(env.NTFY_SERVER || "https://ntfy.sh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: env.NTFY_TOPIC, title, message, priority, tags, click }),
    });
    if (!res.ok) console.error("ntfy refused", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("ntfy failed", e);
    return false;
  }
}

// Business days in Philly time (weekends skipped; holidays aren't). Returns noon UTC on that day.
export function addBusinessDays(date, n) {
  const ny = new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const d = new Date(Date.UTC(ny.getFullYear(), ny.getMonth(), ny.getDate(), 12));
  while (n > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) n--;
  }
  return d;
}

// Whole days from today (Philly time) to that date: 0 today, 1 tomorrow, -1 yesterday.
export function daysUntil(iso, now = new Date()) {
  const key = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/New_York" });   // YYYY-MM-DD
  return Math.round((Date.parse(key(iso)) - Date.parse(key(now))) / 864e5);
}

export const shortDate = (iso) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" });
