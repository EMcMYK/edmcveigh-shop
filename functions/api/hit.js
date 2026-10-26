/*
  POST /api/hit — the shop's own visit counter (replaces Umami). Called by assets/shop.js on every
  page and a few clicks, and by the edmcveigh.com links page.

  Privacy: no cookies, nothing saved in the visitor's browser, and no IP address is stored.
  To count "visitors" (not just page views), each visit gets a code made from the IP, browser and
  today's date, scrambled one-way (SHA-256) with a secret. It can't be turned back into an IP, and a
  new day gives the same person a new code, so nobody can be followed from day to day.

  Stored per hit: day, site (shop or links), page, the site they came from (just its name, e.g.
  pinterest.com), the utm_source / utm_campaign tag of the link they used, the click (Add to cart…),
  the product, country, and phone / tablet / computer.

  Setup in Cloudflare (Pages project → Settings → Bindings): a D1 database bound as STATS_DB.
  The table creates itself. Without the binding, hits are quietly ignored.
*/
import { ensureTable, SITES, phillyDay } from "../_lib/stats.js";

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|python|curl|wget|httpclient|monitor|preview/i;
const clean = (s, n = 120) => String(s ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  const site = SITES[request.headers.get("origin") || ""];
  const ua = request.headers.get("user-agent") || "";
  // Only the real sites count (not previews or testing), and not bots or link-preview fetchers.
  if (!env.STATS_DB || !site || !ua || BOT.test(ua)) return new Response(null, { status: 204 });
  let b;
  try { b = JSON.parse((await request.text()).slice(0, 2000)); } catch { return new Response(null, { status: 204 }); }

  const now = new Date();
  const day = phillyDay(now.getTime());
  let ref = "";
  try {
    const host = new URL(b.ref).hostname.replace(/^www\./, "");
    if (!/(^|\.)edmcveigh\.com$/.test(host)) ref = host;
  } catch { /* no referrer, or our own site */ }
  const device = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "phone" : "computer";
  const ip = request.headers.get("cf-connecting-ip") || "";
  const secret = env.STATS_SALT || env.ETSY_ADMIN_KEY || "edm";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}|${ip}|${ua}|${secret}`));
  const visitor = [...new Uint8Array(digest)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");

  try {
    await ensureTable(env.STATS_DB);
    await env.STATS_DB.prepare(
      `INSERT INTO hits (ts, day, site, kind, path, ref, source, campaign, event, product, country, device, visitor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      now.getTime(), day, site, b.kind === "event" ? "event" : "view",
      clean(b.path || "/", 80), ref, clean(b.source, 40).toLowerCase(), clean(b.campaign, 60).toLowerCase(),
      clean(b.event, 40), clean(b.product, 60), clean(request.cf?.country, 2), device, visitor
    ).run();
    // Keep about 13 months; tidy up now and then.
    if (Math.random() < 0.01) await env.STATS_DB.prepare("DELETE FROM hits WHERE ts < ?").bind(now.getTime() - 400 * 864e5).run();
  } catch (e) {
    console.error("hit:", e.message); // counting must never break the page
  }
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": request.headers.get("origin") } });
}
