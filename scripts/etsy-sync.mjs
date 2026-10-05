/*
  Etsy → shop sync. Run by .github/workflows/etsy-sync.yml every morning and whenever you
  press "Run workflow" on GitHub. You don't need to run it yourself.

  What it does, using your active Etsy listings as the source of truth:
    • New Etsy listing  → added to the shop right away (short name, cleaned-up copy, "New" badge)
    • Existing product  → photos refreshed from Etsy and copied into images/<product-id>/
    • Gone from Etsy    → marked sold out on the shop (a painting sold on Etsy can't sell twice)
    • Back on Etsy      → available again, unless it was sold on the shop itself

  What it never touches on existing products: names, descriptions, prices, sections, badges
  you set by hand. Edit those in data/products.json as usual and the sync leaves them alone.

  Settings: data/etsy-sync.json. Keys (GitHub → Settings → Secrets → Actions):
    ETSY_API_KEY, ETSY_SHARED_SECRET
*/
import { readFile, writeFile, mkdir, readdir, unlink, access } from "node:fs/promises";
import path from "node:path";

const API = process.env.ETSY_API_BASE || "https://openapi.etsy.com/v3/application";
const NO_AI = "Drawn, designed, printed and cut by me, who I am told is a human. No AI was used.";
const FINISH = "Glossy laminated waterproof vinyl, or a sparkly holographic finish that looks different in every light";

export async function sync({ root = process.cwd(), fetch = globalThis.fetch, today = new Date(), log = console.log } = {}) {
  const key = process.env.ETSY_API_KEY, secret = process.env.ETSY_SHARED_SECRET;
  if (!key || !secret) throw new Error("Missing ETSY_API_KEY or ETSY_SHARED_SECRET (add them under GitHub → Settings → Secrets and variables → Actions).");
  const headers = { "x-api-key": `${key}:${secret}`, accept: "application/json" };
  const etsy = async (p) => {
    const res = await fetch(API + p, { headers });
    if (!res.ok) throw new Error(`Etsy said ${res.status} for ${p}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  };

  const productsPath = path.join(root, "data/products.json");
  const data = JSON.parse(await readFile(productsPath, "utf8"));
  const settings = JSON.parse(await readFile(path.join(root, "data/etsy-sync.json"), "utf8"));
  const products = data.products;
  const report = { added: [], updatedPhotos: [], soldOut: [], back: [], skipped: [], unmatched: [] };

  // 1. Find the shop, then every active listing with its photos.
  const shops = await etsy(`/shops?shop_name=${encodeURIComponent(settings.shopName)}`);
  const shopId = shops.results?.[0]?.shop_id;
  if (!shopId) throw new Error(`Couldn't find the Etsy shop "${settings.shopName}".`);
  const listings = [];
  for (let offset = 0; ; offset += 100) {
    const page = await etsy(`/shops/${shopId}/listings/active?limit=100&offset=${offset}&includes=Images`);
    listings.push(...page.results);
    if (page.results.length < 100) break;
  }
  log(`Etsy: ${listings.length} active listings`);

  // 2. Match listings to products: by the saved Etsy listing id, or (first run) by a shared photo.
  const photoId = (s) => (String(s).match(/(\d{8,})[_.]/) || [])[1];
  const byListing = new Map(products.filter((p) => p.etsyListingId).map((p) => [String(p.etsyListingId), p]));
  const byPhoto = new Map();
  for (const p of products) for (const img of p.images || []) { const id = photoId(img); if (id) byPhoto.set(id, p); }

  const seen = new Set();
  for (const l of listings) {
    const lid = String(l.listing_id);
    const images = (l.images || []).slice().sort((a, b) => a.rank - b.rank);
    let p = byListing.get(lid) || images.map((i) => byPhoto.get(String(i.listing_image_id))).find(Boolean);

    if (!p) {
      if ((settings.skipTitles || []).some((t) => l.title.toLowerCase().startsWith(t.toLowerCase()))) { report.skipped.push(l.title); continue; }
      p = newProduct(l, products, settings, today);
      if (!p) { report.skipped.push(`${l.title} (custom order: add it by hand)`); continue; }
      products.push(p);
      report.added.push(p.name);
    }
    p.etsyListingId = Number(lid);
    seen.add(p.id);

    // Photos: copy Etsy's current photos into the repo, in Etsy's order.
    const local = await savePhotos(root, p.id, images, fetch);
    if (local.length && JSON.stringify(local) !== JSON.stringify(p.images)) {
      if (!report.added.includes(p.name)) report.updatedPhotos.push(p.name);
      p.images = local;
    }

    // Availability: active on Etsy means available here, unless it already sold on the shop.
    const etsySoldOut = Number(l.quantity) < 1;
    if (p.soldWhere === "shop") { /* sold here: stays sold */ }
    else if (etsySoldOut && !p.soldOut) { p.soldOut = true; p.soldWhere = "etsy"; report.soldOut.push(p.name); }
    else if (!etsySoldOut && p.soldOut) { p.soldOut = false; delete p.soldWhere; report.back.push(p.name); }

    // Retire the automatic "New" badge after a while.
    if (p.newUntil && today.toISOString().slice(0, 10) > p.newUntil) { if (p.badge === "New") delete p.badge; delete p.newUntil; }
  }

  // 3. Products linked to Etsy that are no longer active there → sold out here.
  for (const p of products) {
    if (seen.has(p.id)) continue;
    // Imported from Etsy before the sync existed (photos still on Etsy's servers) but no longer
    // active there: treat it like a linked listing that went away.
    const fromEtsy = (p.images || []).some((u) => String(u).includes("etsystatic.com"));
    if (!p.etsyListingId && !fromEtsy) { report.unmatched.push(p.name); continue; }
    if (!p.soldOut) { p.soldOut = true; p.soldWhere = p.soldWhere || "etsy"; report.soldOut.push(p.name); }
  }

  await writeFile(productsPath, JSON.stringify(data, null, 2) + "\n");
  return report;
}

function slug(s) { return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }

function newProduct(l, products, settings, today) {
  const title = l.title.trim();
  if (/custom|commission|portrait/i.test(title)) return null;
  const name = title.split(/[,|]/)[0].trim();
  let id = slug(name), n = 2;
  while (products.some((p) => p.id === id)) id = `${slug(name)}-${n++}`;
  const price = l.price ? Math.round((l.price.amount / l.price.divisor) * 100) / 100 : 0;
  const painting = /painting|original art|gouache|watercolor painting/i.test(title);
  const { intro, size, cut, disclaimer } = parseDescription(l.description || "");
  const until = new Date(today.getTime() + (settings.newBadgeDays || 30) * 864e5).toISOString().slice(0, 10);
  const base = {
    id, name, size, images: [], swatch: "#18602a", soldOut: false,
    description: intro, disclaimer, badge: "New", newUntil: until,
  };
  if (painting) {
    return { ...base, category: "originals", variantLabel: "Framing", oneOfAKind: true,
      variants: [{ name: "Unframed", price }, { name: "Framed", price: price + (settings.framedUpcharge ?? 25) }],
      details: ["Original painting, signed. Not a print.", "One of a kind: once it sells, it's gone"] };
  }
  return { ...base, category: "stickers", variantLabel: "Finish",
    variants: [{ name: "Glossy", price }, { name: "Holographic", price }],
    details: [cut || "Die cut", FINISH, NO_AI].filter(Boolean) };
}

// Turns an Etsy description into the shop's shorter format: the opening paragraph(s),
// the size, the die-cut line and any "not affiliated" line. Photo-number notes are dropped.
export function parseDescription(desc) {
  const text = desc.replace(/\r/g, "");
  const lines = text.split("\n").map((s) => s.replace(/^[\s•\-–*]+/, "").trim());
  const dims = /\d+(?:\.\d+)?\s*["”]\s*(?:wide\s*)?[x×]\s*\d+(?:\.\d+)?\s*["”](?:\s*tall)?/i;
  const sizeLine = lines.find((s) => /^size\b/i.test(s)) || "";
  const found = (sizeLine.match(dims) || text.match(dims) || [])[0];
  const size = (found || sizeLine.replace(/^size( is)?:?\s*/i, "")).replace(/\s*[x×]\s*/gi, " × ").replace(/\.$/, "").trim();
  const cut = lines.find((s) => /^die.?cut/i.test(s)) || "";
  const disclaimer = lines.find((s) => /^not affiliated/i.test(s)) || "";
  const skip = /^(photo|photos|good to know|choose your|regular:|holographic:|glossy:|clear:|size|die.?cut|drawn, designed|all of my|every sticker|not affiliated|details|great for)/i;
  const intro = text.split(/\n\s*\n/).map((s) => s.trim()).filter((s) => s && !skip.test(s.replace(/^[•\-\s]+/, ""))).slice(0, 2);
  return { intro: intro.length ? intro : [""], size, cut, disclaimer };
}

async function exists(f) { try { await access(f); return true; } catch { return false; } }

async function savePhotos(root, productId, images, fetch) {
  if (!images.length) return [];
  const dir = path.join(root, "images", productId);
  await mkdir(dir, { recursive: true });
  const kept = [];
  for (const img of images) {
    const file = `${img.listing_image_id}.jpg`;
    const dest = path.join(dir, file);
    if (!(await exists(dest))) {
      const urls = [String(img.url_fullxfull || "").replace("il_fullxfull", "il_794xN"), img.url_570xN].filter(Boolean);
      let ok = false;
      for (const u of urls) {
        const res = await fetch(u);
        if (res.ok) { await writeFile(dest, Buffer.from(await res.arrayBuffer())); ok = true; break; }
      }
      if (!ok) { console.warn(`Couldn't download a photo for ${productId}`); continue; }
    }
    kept.push(`images/${productId}/${file}`);
  }
  // Remove photos Etsy no longer has for this listing.
  for (const f of await readdir(dir)) if (!kept.includes(`images/${productId}/${f}`)) await unlink(path.join(dir, f));
  return kept;
}

// Run directly (GitHub Action): sync, then print a summary for the run page.
if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await sync();
  const lines = [
    "## Etsy sync",
    `- Added: ${report.added.join(", ") || "none"}`,
    `- Photos updated: ${report.updatedPhotos.join(", ") || "none"}`,
    `- Marked sold out: ${report.soldOut.join(", ") || "none"}`,
    `- Available again: ${report.back.join(", ") || "none"}`,
    `- Skipped on purpose: ${report.skipped.join(", ") || "none"}`,
    `- Shop items not linked to Etsy: ${report.unmatched.join(", ") || "none"}`,
  ].join("\n");
  console.log(lines);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, lines + "\n", { flag: "a" });
}
