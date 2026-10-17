/*
  POST /api/order-reminder — the daily ship-by push. Admin only ("Authorization: Bearer YOUR_ETSY_ADMIN_KEY").
  The "Order reminder" GitHub workflow calls it once a day. It pushes one notification listing the
  unshipped orders that are overdue or due today or tomorrow, and stays quiet when nothing is due.
  ?test=1 always sends a push (the Orders page's "Test notification" button uses it).
*/
import { isAdmin } from "../_lib/etsy.js";
import { notify, daysUntil, shortDate } from "../_lib/notify.js";
import { loadOrders } from "./orders.js";

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Wrong or missing admin key." }, 401);
  if (!env.NTFY_TOPIC) return json({ error: "NTFY_TOPIC isn't set in Cloudflare yet." }, 500);
  const test = new URL(request.url).searchParams.get("test") === "1";
  try {
    const { orders } = await loadOrders(request, env);
    const open = orders.filter((o) => !o.shippedAt && o.refunded !== "full" && o.shipBy);
    const due = open.map((o) => ({ o, d: daysUntil(o.shipBy) })).filter((x) => x.d <= 1).sort((a, b) => a.d - b.d);

    if (!due.length && !test) return json({ sent: false, due: 0 });
    if (!due.length) {
      const sent = await notify(env, { title: "Test: notifications work", message: `${open.length ? `${open.length} order${open.length > 1 ? "s" : ""} to ship, none due yet.` : "Nothing to ship right now."}`, tags: ["white_check_mark"] });
      return json({ sent, due: 0 });
    }
    const late = due.filter((x) => x.d < 0).length, today = due.filter((x) => x.d === 0).length, tomorrow = due.filter((x) => x.d === 1).length;
    const parts = [late && `${late} overdue`, today && `${today} due today`, tomorrow && `${tomorrow} due tomorrow`].filter(Boolean);
    const lines = due.map(({ o, d }) => {
      const what = o.lines.map((l) => `${l.qty}× ${l.name}${l.option ? ` (${l.option})` : ""}`).join(", ");
      const when = d < 0 ? `overdue since ${shortDate(o.shipBy)}` : d === 0 ? "due today" : "due tomorrow";
      return `• ${what}: ${when}`;
    });
    const sent = await notify(env, {
      title: `${test ? "Test: " : ""}Orders to ship: ${parts.join(", ")}`,
      message: lines.join("\n"),
      priority: late ? 4 : 3,
      tags: [late ? "warning" : "package"],
    });
    return json({ sent, due: due.length });
  } catch (e) {
    console.error(e);
    return json({ error: String(e.message || e) }, 502);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
