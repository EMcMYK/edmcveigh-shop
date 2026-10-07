/*
  GET /api/etsy/listing-data?id=LISTING_ID — what the daily sync can't read with the plain
  keys: the listing's options and prices (inventory) and its attributes (width, height…).
  Admin only ("Authorization: Bearer YOUR_ETSY_ADMIN_KEY"). Read-only: changes nothing on Etsy.
*/
import { isAdmin, missingSettings, etsy, shopId } from "../../_lib/etsy.js";

export async function onRequestGet({ request, env }) {
  const missing = missingSettings(env);
  if (missing.length) return Response.json({ error: `Missing in Cloudflare: ${missing.join(", ")}` }, { status: 500 });
  if (!isAdmin(request, env)) return new Response("Forbidden", { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!/^\d+$/.test(id || "")) return Response.json({ error: "id must be an Etsy listing number" }, { status: 400 });
  try {
    const inventory = await etsy(env, `/listings/${id}/inventory`);
    const properties = await etsy(env, `/shops/${await shopId(env)}/listings/${id}/properties`).catch(() => null);
    return Response.json({ inventory, properties: properties?.results || [] }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
