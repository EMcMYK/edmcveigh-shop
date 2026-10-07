/*
  POST /api/etsy/listing — changes one Etsy listing's copy. Admin only
  ("Authorization: Bearer YOUR_ETSY_ADMIN_KEY"). Used by the "Apply Etsy edits" GitHub workflow.

  Body: {
    "listing_id": 123,
    "expect": { "title": "…", "description": "…", "tags": [...] },   optional: refuse if Etsy's current text differs
    "set":    { "title": "…", "description": "…", "tags": [...] },   any of these
    "titleReplace": { "from": "…", "to": "…" },                       optional: swap words in the current title
    "removeOption": "Clear",                                           optional: drop a variation option
    "renameOption": { "from": "regular", "to": "glossy" },             optional: rename words in option names
    "dryRun": true                                                     optional: show what would change, change nothing
  }
  Returns the listing's before and after (title, description, tags, options).
*/
import { isAdmin, missingSettings, etsy, shopId } from "../../_lib/etsy.js";

export async function onRequestPost({ request, env }) {
  const missing = missingSettings(env);
  if (missing.length) return Response.json({ error: `Missing in Cloudflare: ${missing.join(", ")}` }, { status: 500 });
  if (!isAdmin(request, env)) return new Response("Forbidden", { status: 403 });
  try {
    const { listing_id, expect = {}, set = {}, titleReplace, removeOption, renameOption, dryRun } = await request.json();
    if (!listing_id) return Response.json({ error: "listing_id is required" }, { status: 400 });
    const before = await snapshot(env, listing_id);

    for (const k of Object.keys(expect)) {
      if (JSON.stringify(norm(before[k])) !== JSON.stringify(norm(expect[k]))) {
        return Response.json({ error: `Etsy's current ${k} isn't what the edit list expected, so nothing was changed.`, before }, { status: 409 });
      }
    }
    const patch = {};
    for (const k of ["title", "description", "tags"]) if (set[k] !== undefined) patch[k] = set[k];
    if (titleReplace) {
      const cur = decode(before.title);
      if (!cur.includes(titleReplace.from)) return Response.json({ error: `The title doesn't contain "${titleReplace.from}", so nothing was changed.`, before: strip(before) }, { status: 409 });
      patch.title = cur.replace(titleReplace.from, titleReplace.to);
    }
    if (patch.tags && (patch.tags.length > 13 || patch.tags.some((t) => t.length > 20))) return Response.json({ error: "Etsy allows 13 tags of up to 20 characters." }, { status: 400 });
    if (patch.title && patch.title.length > 140) return Response.json({ error: "Etsy titles are up to 140 characters." }, { status: 400 });

    let inventory = null;
    if (removeOption || renameOption) {
      inventory = rebuildInventory(before._inventory, removeOption, renameOption, before._readiness);
      if (inventory.error) return Response.json({ error: inventory.error, before: strip(before) }, { status: 400 });
    }
    if (dryRun) return Response.json({ dryRun: true, before: strip(before), patch, options: inventory ? optionNames(inventory) : null, readiness: inventory ? inventory.products.flatMap((p) => p.offerings.map((o) => o.readiness_state_id ?? null)) : null });

    // Options first: if Etsy refuses them, nothing else on the listing has changed yet.
    if (inventory) await etsy(env, `/listings/${listing_id}/inventory`, { method: "PUT", body: inventory });
    if (Object.keys(patch).length) await etsy(env, `/shops/${await shopId(env)}/listings/${listing_id}`, { method: "PATCH", body: patch });
    const after = await snapshot(env, listing_id);
    const ok = Object.entries(patch).every(([k, v]) => JSON.stringify(norm(after[k])) === JSON.stringify(norm(v)))
      && (!inventory || JSON.stringify(after.options.map((o) => o.toLowerCase())) === JSON.stringify(optionNames(inventory).map((o) => o.toLowerCase())));
    return Response.json({ ok, before: strip(before), after: strip(after) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}

async function snapshot(env, id) {
  const l = await etsy(env, `/listings/${id}`);
  const inv = await etsy(env, `/listings/${id}/inventory`);
  const options = (inv.products || []).filter((p) => !p.is_deleted).map((p) => (p.property_values || []).map((pv) => (pv.values || []).join(" ")).join(", ") || "Standard");
  return { title: l.title, description: l.description, tags: l.tags || [], state: l.state, options, _inventory: inv, _readiness: l.readiness_state_id ?? null };
}
const strip = ({ _inventory, _readiness, ...rest }) => rest;
// Compare the way the shop sync reads Etsy: entities decoded, paragraphs trimmed.
const decode = (s) => String(s ?? "").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const norm = (v) => (typeof v === "string"
  ? decode(v).replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.replace(/[ \t]+\n/g, "\n").trim()).filter(Boolean).join("\n\n")
  : Array.isArray(v) ? v.map((t) => decode(t)) : v);

// The inventory as Etsy wants it back, minus any product whose option matches `remove`,
// and with `rename.from` swapped for `rename.to` inside option names (e.g. "regular" → "glossy").
function rebuildInventory(inv, remove, rename, listingReadiness) {
  const all = (inv.products || []).filter((p) => !p.is_deleted);
  const has = (p, name) => (p.property_values || []).some((pv) => (pv.values || []).some((v) => v.toLowerCase().includes(name.toLowerCase())));
  const keep = remove ? all.filter((p) => !has(p, remove)) : all;
  if (remove && keep.length === all.length) return { error: `No "${remove}" option on this listing.` };
  if (!keep.length) return { error: "That would remove every option." };
  if (rename && !keep.some((p) => has(p, rename.from))) return { error: `No "${rename.from}" option to rename on this listing.` };
  return {
    products: keep.map((p) => ({
      sku: p.sku || "",
      property_values: (p.property_values || []).map((pv) => {
        const values = (pv.values || []).map((v) => (rename ? v.replace(new RegExp(rename.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), rename.to) : v));
        const renamed = JSON.stringify(values) !== JSON.stringify(pv.values || []);
        // A renamed value drops its old id so Etsy stores the new name.
        return { property_id: pv.property_id, property_name: pv.property_name, scale_id: pv.scale_id, value_ids: renamed ? [] : pv.value_ids, values };
      }),
      offerings: (p.offerings || []).filter((o) => !o.is_deleted).map((o) => {
        // Etsy now wants each offering's processing time ("readiness state") sent back too.
        const readiness = o.readiness_state_id ?? listingReadiness;
        return { price: o.price.amount / o.price.divisor, quantity: o.quantity, is_enabled: o.is_enabled, ...(readiness != null ? { readiness_state_id: readiness } : {}) };
      })
    })),
    price_on_property: inv.price_on_property || [],
    quantity_on_property: inv.quantity_on_property || [],
    sku_on_property: inv.sku_on_property || []
  };
}
const optionNames = (inv) => inv.products.map((p) => p.property_values.map((pv) => pv.values.join(" ")).join(", ") || "Standard");
