/*
  POST /api/checkout — turns a cart into a Stripe Checkout page.

  This runs on Cloudflare's servers (a "Pages Function"), never in the visitor's browser,
  so your Stripe secret key stays private. It:
    1. Reads the cart the browser sent: [{ id, variant, qty }]
    2. Looks up the REAL prices in data/products.json (so nobody can edit prices in their browser)
    3. Asks Stripe for a checkout page with free US shipping, and sends back its address

  Setting needed in Cloudflare (Settings → Variables and secrets):
    STRIPE_SECRET_KEY   your Stripe secret key (sk_test_... while testing, sk_live_... when live)
  Optional:
    STRIPE_AUTOMATIC_TAX  set to "true" to have Stripe Tax add sales tax at checkout (Stripe charges extra for this)
    ETSY_API_KEY, ETSY_SHARED_SECRET  lets checkout confirm a painting is still for sale on Etsy
*/

const MAX_QTY = 50;
const SHIP_TO = ["US"]; // add country codes like "CA" here if you start shipping abroad

export async function onRequestPost({ request, env }) {
  try {
    if (!env.STRIPE_SECRET_KEY) return json({ error: "Checkout isn't set up yet (missing Stripe key)." }, 500);

    const origin = new URL(request.url).origin;
    const { items } = await request.json();
    if (!Array.isArray(items) || items.length === 0) return json({ error: "Your cart is empty." }, 400);

    // Load the product list that's published with the site.
    const res = await env.ASSETS.fetch(new URL("/data/products.json", request.url));
    const { products } = await res.json();

    const form = new URLSearchParams();
    let hasPortrait = false;
    const summary = [];
    const seen = new Set();

    items.slice(0, 30).forEach((item, i) => {
      const product = products.find((p) => p.id === item.id);
      const variant = product && product.variants[Number(item.variant)];
      if (!product || !variant) throw new UserError("Something in your cart is no longer available. Please remove it and try again.");
      if (product.soldOut) throw new UserError(`${product.name} just sold out. Please remove it and try again.`);

      if (product.oneOfAKind && seen.has(product.id)) throw new UserError(`There's only one ${product.name}. Please keep just one in your cart.`);
      seen.add(product.id);
      const qty = product.oneOfAKind ? 1 : Math.max(1, Math.min(MAX_QTY, Math.floor(Number(item.qty) || 1)));
      const dollars = product.deposit ? variant.price * product.deposit : variant.price;
      const name = product.deposit ? `${product.name}: 50% deposit` : product.name;
      const description = product.deposit
        ? `${variant.name}. Full price $${variant.price.toFixed(2)}; balance invoiced when finished.`
        : (product.variants.length > 1 ? `${variant.name} · ${product.size}` : product.size);

      const key = `line_items[${i}]`;
      form.set(`${key}[quantity]`, String(qty));
      form.set(`${key}[price_data][currency]`, "usd");
      form.set(`${key}[price_data][unit_amount]`, String(Math.round(dollars * 100)));
      form.set(`${key}[price_data][product_data][name]`, name);
      form.set(`${key}[price_data][product_data][description]`, description);
      // Sales tax (only used when Stripe Tax is on): prices are before tax, taxed as physical goods.
      form.set(`${key}[price_data][tax_behavior]`, "exclusive");
      form.set(`${key}[price_data][product_data][tax_code]`, "txcd_99999999");
      if (product.images && product.images[0]) {
        form.set(`${key}[price_data][product_data][images][0]`, new URL(product.images[0], origin + "/").href);
      }
      if (product.deposit) hasPortrait = true;
      summary.push(`${qty}x ${product.id} (${variant.name})`);
    });

    // One-of-a-kind paintings are also listed on Etsy. Ask Etsy whether each is still for sale,
    // so one sold there a minute ago can't be bought here too. If Etsy can't be reached, the
    // sale goes ahead (the daily sync and your sale reminder still catch it).
    const unique = items.map((it) => products.find((p) => p.id === it.id)).filter((p) => p && p.oneOfAKind);
    for (const p of unique) {
      if (!p.etsyListingId || !env.ETSY_API_KEY || !env.ETSY_SHARED_SECRET) continue;
      try {
        const res = await fetch(`https://openapi.etsy.com/v3/application/listings/${p.etsyListingId}`, {
          headers: { "x-api-key": `${env.ETSY_API_KEY}:${env.ETSY_SHARED_SECRET}` }
        });
        if (res.ok) {
          const listing = await res.json();
          if (listing.state !== "active" || Number(listing.quantity) < 1) {
            throw new UserError(`${p.name} just sold. Please remove it from your cart and try again.`);
          }
        } else if (res.status === 404) {
          throw new UserError(`${p.name} just sold. Please remove it from your cart and try again.`);
        }
      } catch (err) {
        if (err instanceof UserError) throw err;
        console.error("Etsy check failed", err);
      }
    }
    if (unique.length) form.set("metadata[one_of_a_kind]", unique.map((p) => p.id).join(",").slice(0, 490));

    form.set("mode", "payment");
    form.set("success_url", `${origin}/#thanks`);
    form.set("cancel_url", `${origin}/#cart`);
    form.set("billing_address_collection", "auto");
    form.set("phone_number_collection[enabled]", hasPortrait ? "true" : "false");
    SHIP_TO.forEach((c, i) => form.set(`shipping_address_collection[allowed_countries][${i}]`, c));

    // Free shipping on every order.
    form.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    form.set("shipping_options[0][shipping_rate_data][display_name]", "Free shipping (USPS)");
    form.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "0");
    form.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
    form.set("shipping_options[0][shipping_rate_data][tax_behavior]", "exclusive");

    // Portrait orders: ask for the deadline and any notes right at checkout.
    if (hasPortrait) {
      // Save the buyer as a Stripe customer (name, email, address) so the balance invoice
      // can be sent to them later, with the same sales tax worked out from their address.
      form.set("customer_creation", "always");
      form.set("custom_fields[0][key]", "portrait_notes");
      form.set("custom_fields[0][label][type]", "custom");
      form.set("custom_fields[0][label][custom]", "Portrait deadline or notes");
      form.set("custom_fields[0][type]", "text");
      form.set("custom_fields[0][optional]", "true");
      form.set("custom_text[submit][message]", "After checkout, email a clear, straight-on photo of the home. I'll send a pencil sketch to approve before inking.");
    }

    if (env.STRIPE_AUTOMATIC_TAX === "true") form.set("automatic_tax[enabled]", "true");
    form.set("metadata[cart]", summary.join(", ").slice(0, 490)); // shows up in your Stripe dashboard

    const stripe = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form
    });
    const session = await stripe.json();
    if (!stripe.ok) {
      console.error("Stripe error", session.error);
      return json({ error: "Stripe couldn't start checkout." }, 502);
    }
    return json({ url: session.url });
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: "Checkout isn't available right now." }, 500);
  }
}

class UserError extends Error {}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
