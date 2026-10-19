/*
  /api/etsy/images — a listing's photos on Etsy. Admin only ("Authorization: Bearer YOUR_ETSY_ADMIN_KEY").
  Used by the "Upload Etsy photos" GitHub workflow, so new listings never need photos dragged in by hand.

  GET    ?listing_id=123                         list the photos (id, rank, size, url)
  POST   ?listing_id=123&rank=1[&replace=1]      body = the image file itself (Content-Type image/jpeg or image/png).
                                                 replace=1 puts it in that spot instead of adding after it.
  DELETE ?listing_id=123&image_id=456            remove one photo
*/
import { isAdmin, missingSettings, etsy, shopId, accessToken, API } from "../../_lib/etsy.js";

const MAX_BYTES = 10 * 1024 * 1024; // Etsy's photo limit is well above this; ours are 0.3–3 MB.

export async function onRequest({ request, env }) {
  const missing = missingSettings(env);
  if (missing.length) return Response.json({ error: `Missing in Cloudflare: ${missing.join(", ")}` }, { status: 500 });
  if (!isAdmin(request, env)) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const listingId = url.searchParams.get("listing_id");
  if (!/^\d+$/.test(listingId || "")) return Response.json({ error: "listing_id is required" }, { status: 400 });

  try {
    if (request.method === "GET") return Response.json({ images: await list(env, listingId) });

    if (request.method === "DELETE") {
      const imageId = url.searchParams.get("image_id");
      if (!/^\d+$/.test(imageId || "")) return Response.json({ error: "image_id is required" }, { status: 400 });
      await etsy(env, `/shops/${await shopId(env)}/listings/${listingId}/images/${imageId}`, { method: "DELETE" });
      return Response.json({ ok: true, images: await list(env, listingId) });
    }

    if (request.method === "POST") {
      const type = (request.headers.get("content-type") || "").split(";")[0].trim();
      if (!["image/jpeg", "image/png", "image/gif"].includes(type)) return Response.json({ error: "Send the image itself as the body, with Content-Type image/jpeg or image/png." }, { status: 415 });
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength) return Response.json({ error: "The image was empty." }, { status: 400 });
      if (bytes.byteLength > MAX_BYTES) return Response.json({ error: "That image is over 10 MB." }, { status: 413 });
      const rank = Math.max(1, Math.min(20, parseInt(url.searchParams.get("rank") || "1", 10) || 1));
      const name = (url.searchParams.get("name") || `photo-${rank}.jpg`).replace(/[^\w.-]/g, "_").slice(0, 80);

      const form = new FormData();
      form.append("image", new Blob([bytes], { type }), name);
      form.append("rank", String(rank));
      if (url.searchParams.get("replace") === "1") form.append("overwrite", "true");
      const alt = url.searchParams.get("alt");
      if (alt) form.append("alt_text", alt.slice(0, 250));

      const res = await fetch(`${API}/shops/${await shopId(env)}/listings/${listingId}/images`, {
        method: "POST",
        headers: { "x-api-key": `${env.ETSY_API_KEY}:${env.ETSY_SHARED_SECRET}`, Authorization: `Bearer ${await accessToken(env)}` },
        body: form
      });
      const text = await res.text();
      if (!res.ok) return Response.json({ error: `Etsy said ${res.status}: ${text.slice(0, 300)}` }, { status: 502 });
      const img = JSON.parse(text);
      return Response.json({ ok: true, image: brief(img) });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}

async function list(env, listingId) {
  const r = await etsy(env, `/listings/${listingId}/images`);
  return (r.results || []).map(brief).sort((a, b) => a.rank - b.rank);
}
const brief = (i) => ({ id: i.listing_image_id, rank: i.rank, width: i.full_width, height: i.full_height, url: i.url_570xN });
