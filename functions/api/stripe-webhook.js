/*
  POST /api/stripe-webhook — Stripe calls this right after someone pays.

  When the order includes a one-of-a-kind painting, it starts the "Mark sold on the shop"
  GitHub workflow for each one. That workflow marks the painting sold on the shop and emails
  you (as a GitHub issue) a reminder to deactivate it on Etsy.

  Settings needed in Cloudflare (Settings → Variables and secrets):
    STRIPE_WEBHOOK_SECRET  the signing secret Stripe shows for this webhook (starts with whsec_)
    GITHUB_TOKEN           a fine-grained GitHub token for this repo with "Actions: Read and write"
  Optional:
    GITHUB_REPO            defaults to EMcMYK/edmcveigh-shop
*/

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("Webhook not set up", { status: 500 });
  if (!(await verifyStripe(body, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) {
    return new Response("Bad signature", { status: 400 });
  }

  const event = JSON.parse(body);
  if (event.type !== "checkout.session.completed") return new Response("ignored");
  const session = event.data.object;
  if (session.payment_status !== "paid") return new Response("not paid yet");

  const ids = String(session.metadata?.one_of_a_kind || "").split(",").map((s) => s.trim()).filter(Boolean);
  const repo = env.GITHUB_REPO || "EMcMYK/edmcveigh-shop";
  for (const id of ids) {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/mark-sold.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "edmcveigh-shop",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ref: "main", inputs: { product: id } })
    });
    if (!res.ok) {
      console.error("Couldn't start mark-sold for", id, res.status, await res.text());
      return new Response("GitHub refused", { status: 502 });   // Stripe retries later
    }
  }
  return new Response("ok");
}

// Checks Stripe's signature so nobody else can mark things sold.
export async function verifyStripe(body, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")).filter((kv) => kv.length === 2 && kv[0] !== "v1"));
  const sigs = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && timingSafeEqual(s, hex));
}

function timingSafeEqual(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
