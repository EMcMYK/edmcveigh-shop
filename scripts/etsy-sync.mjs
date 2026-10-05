/*
  Etsy → shop: adds NEW Etsy listings to the shop. Run by .github/workflows/etsy-sync.yml every
  morning and whenever you press "Run workflow" on GitHub. You don't need to run it yourself.

  • Only adds listings the shop doesn't have yet. Products already in the shop are never changed.
  • A new product is copied exactly from Etsy: title, full description, tags, every photo
    (saved into images/<product-id>/), options and prices, and its Etsy shop section.
  • Each product remembers its Etsy listing id (etsyListingId), which is how the sync knows
    what's already in the shop.
  • Safety stop: if a run finds more than `maxNewPerRun` new listings at once, it changes nothing
    and fails, so a hiccup can't flood the shop with duplicates.

  Settings: data/etsy-sync.json. Keys (GitHub → Settings → Secrets → Actions):
    ETSY_API_KEY, ETSY_SHARED_SECRET
*/
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const API = process.env.ETSY_API_BASE || "https://openapi.etsy.com/v3/application";

export async function sync({ root = process.cwd(), fetch = globalThis.fetch, today = new Date(), log = console.log } = {}) {
  const key = process.env.ETSY_API_KEY, secret = process.env.ETSY_SHARED_SECRET;
  if (!key || !secret) throw new Error("Missing ETSY_API_KEY or ETSY_SHARED_SECRET (add them under GitHub → Settings → Secrets and variables → Actions).");
  const headers = { "x-api-key": `${key}:${secret}`, accept: "application/json" };
  const etsy = async (p, { optional = false } = {}) => {
    const res = await fetch(API + p, { headers });
    if (!res.ok) {
      const msg = `Etsy said ${res.status} for ${p}: ${(await res.text()).slice(0, 200)}`;
      if (optional) { log(msg); return null; }
      throw new Error(msg);
    }
    return res.json();
  };

  const productsPath = path.join(root, "data/products.json");
  const data = JSON.parse(await readFile(productsPath, "utf8"));
  const settings = JSON.parse(await readFile(path.join(root, "data/etsy-sync.json"), "utf8"));
  const products = data.products;
  const report = { added: [], skipped: [], problems: [] };

  // Every Etsy listing the shop already knows about, plus ones to ignore on purpose.
  const known = new Set(products.map((p) => String(p.etsyListingId || "")).filter(Boolean));
  for (const id of settings.ignoreListingIds || []) known.add(String(id));
  const unlinked = products.filter((p) => !p.etsyListingId).map((p) => p.name);
  if (unlinked.length) report.problems.push(`Not linked to an Etsy listing (the sync can't tell if they're on Etsy): ${unlinked.join(", ")}`);

  // 1. Shop, sections and active listings.
  const shops = await etsy(`/shops?shop_name=${encodeURIComponent(settings.shopName)}`);
  const shopId = shops.results?.[0]?.shop_id;
  if (!shopId) throw new Error(`Couldn't find the Etsy shop "${settings.shopName}".`);
  const sections = new Map(((await etsy(`/shops/${shopId}/sections`, { optional: true }))?.results || [])
    .map((s) => [String(s.shop_section_id), decode(s.title)]));
  const listings = [];
  for (let offset = 0; ; offset += 100) {
    const page = await etsy(`/shops/${shopId}/listings/active?limit=100&offset=${offset}`);
    listings.push(...page.results);
    if (page.results.length < 100) break;
  }
  log(`Etsy: ${listings.length} active listings, ${known.size} already in the shop`);

  // 2. Which listings are new?
  const fresh = [];
  for (const l of listings) {
    if (known.has(String(l.listing_id))) continue;
    const title = decode(l.title);
    if ((settings.skipTitles || []).some((t) => title.toLowerCase().startsWith(t.toLowerCase()))) { report.skipped.push(title); continue; }
    fresh.push(l);
  }
  const max = settings.maxNewPerRun ?? 5;
  if (fresh.length > max) {
    throw new Error(`Found ${fresh.length} new Etsy listings in one run (the limit is ${max}), so nothing was changed. ` +
      `If they really are all new, raise "maxNewPerRun" in data/etsy-sync.json and run again. New: ${fresh.map((l) => decode(l.title)).join(" | ")}`);
  }

  // 3. Copy each new listing exactly: photos, options and prices, then the product itself.
  for (const l of fresh) {
    const title = decode(l.title);
    const id = uniqueId(title, products);
    const images = (await etsy(`/listings/${l.listing_id}/images`, { optional: true }))
      || (await etsy(`/shops/${shopId}/listings/${l.listing_id}/images`, { optional: true }));
    const photos = await savePhotos(root, id, (images?.results || []).slice().sort((a, b) => a.rank - b.rank), fetch, log);
    if (!photos.length) { report.problems.push(`${title}: no photos came back from Etsy, so it wasn't added. It will be tried again next run.`); continue; }

    const inventory = await etsy(`/listings/${l.listing_id}/inventory`, { optional: true });
    const basePrice = money(l.price);
    const { label, variants } = optionsFrom(inventory, basePrice);

    const section = sections.get(String(l.shop_section_id)) || "";
    const category = categoryFor(section, title, settings);
    const description = decode(l.description || "").replace(/\r/g, "").split(/\n\s*\n/).map((s) => s.replace(/[ \t]+\n/g, "\n").trim()).filter(Boolean);
    const p = {
      id,
      name: title,
      category,
      variantLabel: label,
      variants,
      size: sizeFrom(description.join("\n")),
      images: photos,
      soldOut: Number(l.quantity) < 1,
      description,
      details: [],
      tags: (l.tags || []).map(decode),
      disclaimer: "",
      etsyListingId: Number(l.listing_id),
      etsySection: section,
      badge: "New",
      newUntil: new Date(today.getTime() + (settings.newBadgeDays || 30) * 864e5).toISOString().slice(0, 10),
    };
    if (category === "originals") p.oneOfAKind = true;
    products.push(p);
    report.added.push(`${title} → ${category}`);
  }

  // 4. Retire automatic "New" badges after their time is up.
  const day = today.toISOString().slice(0, 10);
  for (const p of products) if (p.newUntil && day > p.newUntil) { if (p.badge === "New") delete p.badge; delete p.newUntil; }

  await writeFile(productsPath, JSON.stringify(data, null, 2) + "\n");
  return report;
}

// ---------- helpers ----------

export function decode(s) {
  return String(s ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function money(price) { return price ? Math.round((price.amount / price.divisor) * 100) / 100 : 0; }

function cap(s) { s = String(s).trim(); return s.charAt(0).toUpperCase() + s.slice(1); }

// Options exactly as Etsy has them (e.g. Material: Regular waterproof / Holographic), each with its own price.
export function optionsFrom(inventory, basePrice) {
  const rows = (inventory?.products || []).filter((pr) => !pr.is_deleted);
  const variants = [];
  let label = "";
  for (const pr of rows) {
    const offer = (pr.offerings || []).find((o) => o.is_enabled !== false && !o.is_deleted);
    if (!offer) continue;
    const props = pr.property_values || [];
    if (!label && props.length) label = props.map((pv) => cap(decode(pv.property_name))).join(" and ");
    const name = props.map((pv) => (pv.values || []).map((v) => cap(decode(v))).join(" ")).join(", ") || "Standard";
    variants.push({ name, price: money(offer.price) });
  }
  if (!variants.length) variants.push({ name: "Standard", price: basePrice });
  return { label: variants.length > 1 ? label : "", variants };
}

function categoryFor(section, title, settings) {
  const map = settings.sectionCategories || {};
  for (const [needle, cat] of Object.entries(map)) if (section.toLowerCase().includes(needle.toLowerCase())) return cat;
  if (/painting|original/i.test(title)) return "originals";
  if (/portrait/i.test(title)) return "portraits";
  return "stickers";
}

export function sizeFrom(text) {
  const dims = /\d+(?:\.\d+)?\s*["”]\s*(?:wide\s*)?[x×]\s*\d+(?:\.\d+)?\s*["”](?:\s*tall)?/i;
  const m = text.match(dims);
  return m ? m[0].replace(/\s*[x×]\s*/gi, " × ").trim() : "";
}

function slug(s) { return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function uniqueId(title, products) {
  const base = slug(title.split(/[,|]/)[0]).slice(0, 60) || "item";
  let id = base, n = 2;
  while (products.some((p) => p.id === id)) id = `${base}-${n++}`;
  return id;
}

async function savePhotos(root, productId, images, fetch, log) {
  const kept = [];
  if (!images.length) return kept;
  const dir = path.join(root, "images", productId);
  await mkdir(dir, { recursive: true });
  for (const img of images) {
    const file = `${img.listing_image_id}.jpg`;
    const urls = [String(img.url_fullxfull || "").replace("il_fullxfull", "il_794xN"), img.url_fullxfull, img.url_570xN].filter(Boolean);
    let ok = false;
    for (const u of urls) {
      const res = await fetch(u);
      if (res.ok) { await writeFile(path.join(dir, file), Buffer.from(await res.arrayBuffer())); ok = true; break; }
    }
    if (ok) kept.push(`images/${productId}/${file}`);
    else log(`Couldn't download photo ${img.listing_image_id} for ${productId}`);
  }
  return kept;
}

// Run directly (GitHub Action): sync, then print a summary on the run page.
if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await sync();
  const lines = [
    "## Etsy sync",
    `- Added to the shop: ${report.added.join(", ") || "nothing new on Etsy"}`,
    `- Skipped on purpose: ${report.skipped.join(", ") || "none"}`,
    ...report.problems.map((p) => `- ⚠️ ${p}`),
  ].join("\n");
  console.log(lines);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, lines + "\n", { flag: "a" });
}
