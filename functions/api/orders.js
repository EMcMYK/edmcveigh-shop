/*
  /api/orders — the data behind the Orders page (shop.edmcveigh.com/orders). Admin only: needs the
  admin key (ETSY_ADMIN_KEY, the same one the Etsy tools use) as "Authorization: Bearer …".

  GET   every paid order, newest first, straight from Stripe: what was bought (with the option and a photo),
        where it's going, the buyer's email and notes, and whether you've marked it shipped.
  POST  { order: "pi_…", shipped: true|false, tracking?: "…" } marks an order shipped (or not yet).

  Nothing is stored here: "shipped" is saved on the payment in Stripe (its metadata: shipped_at, tracking),
  so it also shows in the Stripe dashboard and works for every order, including ones placed before this page.
*/
import { isAdmin } from "../_lib/etsy.js";
import { addBusinessDays } from "../_lib/notify.js";

const SHIP_DAYS = 4;          // "Please allow 2–4 business days for me to process your order" (policies)
const MAX_ORDERS = 300;

async function getOrders({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Wrong or missing admin key." }, 401);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "No Stripe key in Cloudflare." }, 500);
  return json(await loadOrders(request, env));
}

// Every paid order, newest first (also used by the daily ship-by reminder).
export async function loadOrders(request, env) {

  let products = [];
  try { products = (await (await env.ASSETS.fetch(new URL("/data/products.json", request.url))).json()).products; } catch {}

  const sessions = [];
  let after = "";
  while (sessions.length < MAX_ORDERS) {
    const q = new URLSearchParams({ status: "complete", limit: "100" });
    q.append("expand[]", "data.line_items");
    q.append("expand[]", "data.payment_intent.latest_charge");
    if (after) q.set("starting_after", after);
    const page = await stripe(env, `/v1/checkout/sessions?${q}`);
    sessions.push(...page.data);
    if (!page.has_more || !page.data.length) break;
    after = page.data[page.data.length - 1].id;
  }

  const orders = sessions
    .filter((s) => s.payment_status === "paid" && s.payment_intent && typeof s.payment_intent === "object")
    .map((s) => toOrder(s, products));
  return { live: sessions[0] ? sessions[0].livemode : null, orders };
}

async function markShipped({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Wrong or missing admin key." }, 401);
  const { order, shipped, tracking } = await request.json().catch(() => ({}));
  if (!/^pi_[A-Za-z0-9]+$/.test(String(order || ""))) return json({ error: "Unknown order." }, 400);
  const form = new URLSearchParams();
  form.set("metadata[shipped_at]", shipped ? new Date().toISOString() : "");
  form.set("metadata[tracking]", shipped ? String(tracking || "").trim().slice(0, 120) : "");
  const pi = await stripe(env, `/v1/payment_intents/${order}`, form);
  return json({ ok: true, shippedAt: pi.metadata.shipped_at || null, tracking: pi.metadata.tracking || "" });
}

function toOrder(s, products) {
  const pi = s.payment_intent, charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const cart = String(s.metadata?.cart || "").split(/, (?=\d+x \S+ \()/).filter(Boolean);   // "2x pretzel (Holographic)", in line-item order
  const lines = (s.line_items?.data || []).map((li, i) => {
    const m = /^(\d+)x (\S+) \((.*)\)$/.exec(cart[i] || "");
    const product = m && products.find((p) => p.id === m[2]);
    return {
      name: li.description,
      qty: li.quantity,
      option: m && product && product.variants.length > 1 ? m[3] : "",
      image: product?.images?.[0] || "",
      deposit: Boolean(product?.deposit) || /: 50% deposit$/.test(li.description || ""),
      oneOfAKind: Boolean(product?.oneOfAKind),
    };
  });
  const ship = s.collected_information?.shipping_details || s.shipping_details || null;
  const created = new Date(s.created * 1000);
  const portrait = lines.some((l) => l.deposit);
  const refunded = charge ? (charge.refunded ? "full" : charge.amount_refunded > 0 ? "partial" : "") : "";
  return {
    id: pi.id,
    number: s.id.slice(-8).toUpperCase(),
    created: created.toISOString(),
    shipBy: portrait ? null : addBusinessDays(created, SHIP_DAYS).toISOString(),
    portrait,
    name: ship?.name || s.customer_details?.name || "",
    email: s.customer_details?.email || "",
    address: ship?.address || s.customer_details?.address || null,
    notes: (s.custom_fields || []).map((f) => f.text?.value).filter(Boolean).join("\n"),
    lines,
    total: s.amount_total / 100,
    tax: (s.total_details?.amount_tax || 0) / 100,
    refunded,
    shippedAt: pi.metadata?.shipped_at || null,
    tracking: pi.metadata?.tracking || "",
    stripeUrl: `https://dashboard.stripe.com/${s.livemode ? "" : "test/"}payments/${pi.id}`,
  };
}

async function stripe(env, path, form) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: form ? "POST" : "GET",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe: ${body.error?.message || res.status}`);
  return body;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function onRequest(ctx) {
  try {
    if (ctx.request.method === "GET") return await getOrders(ctx);
    if (ctx.request.method === "POST") return await markShipped(ctx);
    return new Response("Method not allowed", { status: 405 });
  } catch (e) {
    console.error(e);
    return json({ error: String(e.message || e) }, 502);
  }
}
