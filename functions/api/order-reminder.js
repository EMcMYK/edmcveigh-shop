/*
  POST /api/order-reminder — the daily ship-by push. Admin only ("Authorization: Bearer YOUR_ETSY_ADMIN_KEY").
  The "Order reminder" GitHub workflow calls it once a day. It pushes one notification listing the
  unshipped orders that are overdue or due today or tomorrow, and stays quiet when nothing is due.
  ?test=1 sends a sample of both pushes, exactly as real ones look (the Orders page's "Test notification" button).
*/
import { isAdmin } from "../_lib/etsy.js";
import { notify, daysUntil, newOrderPush, reminderPush, addBusinessDays } from "../_lib/notify.js";
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

    // Test: send exactly what you'd get for a real order and a real reminder, using your latest order
    // (or a sample sticker if there are none yet). "(test)" at the end is the only difference.
    if (test) {
      const latest = orders[0] || { lines: [{ qty: 2, name: "Philly Soft Pretzel Sticker", option: "Holographic (sparkly)" }], total: 9.65, created: new Date().toISOString() };
      const order = newOrderPush({ ...latest, created: Date.now() });
      const remind = reminderPush(due.length ? due : [{ o: { ...latest, shipBy: addBusinessDays(new Date(), 1).toISOString() }, d: 1 }]);
      order.message += "\n(test)"; remind.message += "\n(test)";
      const a = await notify(env, order);
      const b = await notify(env, remind);
      const ok = a === true && b === true;
      return json(ok ? { sent: true } : { sent: false, error: a === true ? b : a }, ok ? 200 : 502);
    }

    const sent = await notify(env, reminderPush(due));
    return json(sent === true ? { sent: true, due: due.length } : { sent: false, error: sent }, sent === true ? 200 : 502);
  } catch (e) {
    console.error(e);
    return json({ error: String(e.message || e) }, 502);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
