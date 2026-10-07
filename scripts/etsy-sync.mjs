/*
  Etsy → shop. Run by .github/workflows/etsy-sync.yml every morning and whenever you press
  "Run workflow" on GitHub. You don't need to run it yourself.

  • New Etsy listings are added to the shop, copied exactly: full description, tags, every
    photo (saved into images/<product-id>/), options and prices, and its Etsy shop section.
  • Products already in the shop take Etsy's description, tags, photos, options and prices
    whenever those change on Etsy. Shop-only things stay as they are: the product's name, web
    address (id), category, size line, badge, details, disclaimer, and the portrait's deposit,
    steps and policy line. A product can also keep its own description, tags, options or photos:
    list them in its "shopOnly", e.g. "shopOnly": ["description"] (the house portrait does, since
    its Etsy wording is about Etsy's checkout).
  • A new product's name is the short start of its Etsy title, up to the first comma or "|"
    ("Sushi Cats Sticker, Cute Cat..." → "Sushi Cats Sticker"). Edit it in products.json anytime.
  • A product whose Etsy listing is no longer active (sold, deactivated, expired) is marked sold
    out. If it comes back on Etsy it's available again, unless it sold through the shop itself.
  • Each product remembers its Etsy listing id (etsyListingId); that's how the two are matched.
  • Safety stops: if a run finds more than `maxNewPerRun` new listings, or would mark more than
    `maxSoldOutPerRun` products sold out at once, it changes nothing and fails. A photo set only
    gets replaced when every new photo downloaded.

  • Options, prices and size come through the Etsy connection the shop holds (Cloudflare), since
    Etsy only shares those with a connected account. Etsy's option names are translated with
    "optionNames" in data/etsy-sync.json ("glossy waterproof" → "Glossy"). If the connection is
    down, everything else still syncs and options wait until it's back.
  • Price safety stop: a price that moves by more than half, or a product that would lose all
    but one of its options, is held back (not changed) and the run is marked failed so GitHub
    emails you. Make the change by hand in products.json if it's right.

  Settings: data/etsy-sync.json. Keys (GitHub → Settings → Secrets → Actions):
    ETSY_API_KEY, ETSY_SHARED_SECRET, ETSY_ADMIN_KEY (same as Cloudflare's). Optional variable SHOP_URL.
*/
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const API = process.env.ETSY_API_BASE || "https://openapi.etsy.com/v3/application";

export async function sync({ root = process.cwd(), fetch = globalThis.fetch, today = new Date(), log = console.log } = {}) {
  const key = process.env.ETSY_API_KEY, secret = process.env.ETSY_SHARED_SECRET;
  if (!key || !secret) throw new Error("Missing ETSY_API_KEY or ETSY_SHARED_SECRET (add them under GitHub → Settings → Secrets and variables → Actions).");
  const headers = { "x-api-key": `${key}:${secret}`, accept: "application/json" };
  const pause = Number(process.env.ETSY_PAUSE_MS ?? 150); // stay well under Etsy's rate limit
  const etsy = async (p, { optional = false } = {}) => {
    if (pause) await new Promise((r) => setTimeout(r, pause));
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
  const report = { added: [], updated: [], soldOut: [], back: [], skipped: [], problems: [], held: [] };

  // Options, prices and attributes through the shop's Etsy connection (read-only).
  const shopUrl = (process.env.SHOP_URL || "https://edmcveigh-shop.pages.dev").replace(/\/$/, "");
  let connectionDown = !process.env.ETSY_ADMIN_KEY;
  if (connectionDown) report.problems.push("ETSY_ADMIN_KEY isn't set in GitHub, so options, prices and sizes weren't checked.");
  const connected = async (listingId) => {
    if (connectionDown) return null;
    try {
      const res = await fetch(`${shopUrl}/api/etsy/listing-data?id=${listingId}`, { headers: { Authorization: `Bearer ${process.env.ETSY_ADMIN_KEY}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `status ${res.status}`);
      return body;
    } catch (e) {
      connectionDown = true;
      report.problems.push(`Couldn't reach the Etsy connection (${e.message}), so options, prices and sizes weren't checked today. If it says the connection lapsed, reconnect at ${shopUrl}/api/etsy/connect?key=…`);
      return null;
    }
  };

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

  // 3. Listings that left Etsy → sold out (checked one by one before anything is marked).
  if (!listings.length && products.some((p) => p.etsyListingId)) throw new Error("Etsy returned no active listings at all, so nothing was changed.");
  const active = new Map(listings.map((l) => [String(l.listing_id), l]));
  const ignored = new Set((settings.ignoreListingIds || []).map(String));
  const gone = [];
  for (const p of products) {
    const lid = String(p.etsyListingId || "");
    if (!lid || active.has(lid) || ignored.has(lid) || p.soldOut) continue;
    const res = await fetch(`${API}/listings/${lid}`, { headers });
    if (res.status === 404) { gone.push([p, "removed"]); continue; }
    if (!res.ok) { report.problems.push(`${p.name}: couldn't check its Etsy listing (${res.status}), left as is.`); continue; }
    const l = await res.json();
    if (l.state !== "active" || Number(l.quantity) < 1) gone.push([p, l.state || "inactive"]);
    else active.set(lid, l); // active after all (e.g. missed by paging): treat as a normal listing
  }
  const maxGone = settings.maxSoldOutPerRun ?? 3;
  if (gone.length > maxGone) {
    throw new Error(`${gone.length} shop products would be marked sold out in one run (the limit is ${maxGone}), so nothing was changed. ` +
      `If that's right, raise "maxSoldOutPerRun" in data/etsy-sync.json and run again. They are: ${gone.map(([p]) => p.name).join(" | ")}`);
  }
  for (const [p, why] of gone) {
    p.soldOut = true; p.soldWhere = "etsy"; p.soldOn = today.toISOString().slice(0, 10);
    report.soldOut.push(`${p.name} (${why} on Etsy)`);
  }

  // 4. Products already in the shop: take Etsy's title, description, tags, photos, options and prices.
  for (const p of products) {
    const l = active.get(String(p.etsyListingId || ""));
    if (!l) continue;
    const changed = [];
    const keep = new Set(p.shopOnly || []); // fields this product keeps from the shop, never Etsy's
    const description = paragraphs(l.description);
    if (!keep.has("description") && description.length && JSON.stringify(p.description) !== JSON.stringify(description)) { p.description = description; changed.push("description"); }
    const tags = (l.tags || []).map(decode);
    if (!keep.has("tags") && JSON.stringify(p.tags || []) !== JSON.stringify(tags)) { p.tags = tags; changed.push("tags"); }

    const extra = keep.has("options") ? null : await connected(l.listing_id);
    if (extra?.inventory) {
      const fromEtsy = optionsFrom(extra.inventory, money(l.price), settings);
      // A single option keeps the shop's own name (e.g. Barn's "Framed"); only its price follows Etsy.
      const variants = fromEtsy.variants.length === 1 && p.variants.length === 1 ? [{ ...p.variants[0], price: fromEtsy.variants[0].price }] : fromEtsy.variants;
      const label = variants.length > 1 ? (p.variantLabel || fromEtsy.label) : "";
      if (JSON.stringify(p.variants) !== JSON.stringify(variants) || (p.variantLabel || "") !== label) {
        const why = holdReason(p.variants, variants);
        if (why) report.held.push(`${p.name}: ${why}. Etsy has ${variants.map((v) => `${v.name} $${v.price}`).join(", ")}; the shop kept ${p.variants.map((v) => `${v.name} $${v.price}`).join(", ")}.`);
        else { p.variants = variants; p.variantLabel = label; changed.push("options and prices"); }
      }
    }

    const images = keep.has("photos") ? null : (await etsy(`/listings/${l.listing_id}/images`, { optional: true }))
      || (await etsy(`/shops/${shopId}/listings/${l.listing_id}/images`, { optional: true }));
    const want = (images?.results || []).slice().sort((a, b) => a.rank - b.rank);
    if (want.length) {
      const wantPaths = want.map((img) => `images/${p.id}/${img.listing_image_id}.jpg`);
      if (JSON.stringify(p.images) !== JSON.stringify(wantPaths)) {
        const have = new Set(await readdir(path.join(root, "images", p.id)).catch(() => []));
        const missing = want.filter((img) => !have.has(`${img.listing_image_id}.jpg`));
        const got = await savePhotos(root, p.id, missing, fetch, log);
        if (got.length === missing.length) {
          for (const f of have) if (!wantPaths.includes(`images/${p.id}/${f}`)) await rm(path.join(root, "images", p.id, f));
          p.images = wantPaths; changed.push("photos");
        } else report.problems.push(`${p.name}: some new photos didn't download, kept the current ones. It will be tried again next run.`);
      }
    } else if (images) report.problems.push(`${p.name}: Etsy returned no photos, kept the current ones.`);

    if (Number(l.quantity) < 1 && !p.soldOut) { p.soldOut = true; p.soldWhere = "etsy"; p.soldOn = today.toISOString().slice(0, 10); report.soldOut.push(`${p.name} (out of stock on Etsy)`); }
    else if (Number(l.quantity) >= 1 && p.soldOut && p.soldWhere !== "shop") {
      p.soldOut = false; delete p.soldWhere; delete p.soldOn; report.back.push(p.name);
    }
    if (changed.length) report.updated.push(`${p.name}: ${changed.join(", ")}`);
  }

  // 5. Copy each new listing exactly: photos, options and prices, then the product itself.
  for (const l of fresh) {
    const title = decode(l.title);
    const id = uniqueId(title, products);
    const images = (await etsy(`/listings/${l.listing_id}/images`, { optional: true }))
      || (await etsy(`/shops/${shopId}/listings/${l.listing_id}/images`, { optional: true }));
    const photos = await savePhotos(root, id, (images?.results || []).slice().sort((a, b) => a.rank - b.rank), fetch, log);
    if (!photos.length) { report.problems.push(`${title}: no photos came back from Etsy, so it wasn't added. It will be tried again next run.`); continue; }

    const extra = await connected(l.listing_id);
    const basePrice = money(l.price);
    const { label, variants } = optionsFrom(extra?.inventory, basePrice, settings);
    if (!extra) report.problems.push(`${decode(l.title)}: added with a single "Standard" option at $${basePrice}, since the Etsy connection wasn't reachable. It will pick up its real options on a later run.`);

    const section = sections.get(String(l.shop_section_id)) || "";
    const category = categoryFor(section, title, settings);
    const description = paragraphs(l.description);
    const p = {
      id,
      name: shortName(title),
      category,
      variantLabel: label,
      variants,
      size: sizeFrom(description.join("\n")) || sizeFromProperties(extra?.properties),
      images: photos,
      soldOut: Number(l.quantity) < 1,
      description,
      details: category === "stickers" ? [...(settings.newStickerDetails || [])] : [],
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

  // 6. Retire automatic "New" badges after their time is up.
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

function paragraphs(text) {
  return decode(text || "").replace(/\r/g, "").split(/\n\s*\n/).map((s) => s.replace(/[ \t]+\n/g, "\n").trim()).filter(Boolean);
}

function money(price) { return price ? Math.round((price.amount / price.divisor) * 100) / 100 : 0; }

function cap(s) { s = String(s).trim(); return s.charAt(0).toUpperCase() + s.slice(1); }

// Etsy's wording → the shop's, from a { "etsy name": "Shop name" } map; unknown names are just capitalized.
const squash = (s) => String(s).toLowerCase().replace(/[“”″"]/g, '"').replace(/\s+/g, " ").trim();
function rename(map = {}, value) {
  const hit = Object.entries(map).find(([k]) => squash(k) === squash(value));
  return hit ? hit[1] : cap(value);
}

// Why an options change from Etsy looks like a mistake (or "" if it looks fine).
export function holdReason(before, after) {
  if (before.length > 1 && after.length === 1) return "it would drop to a single option";
  for (const a of after) {
    const b = before.find((v) => v.name === a.name);
    if (b && b.price > 0 && Math.abs(a.price - b.price) / b.price > 0.5) return `${a.name} would go from $${b.price} to $${a.price}`;
  }
  return "";
}

// "3\" wide × 2.64\" tall" from the Width and Height you fill in on the Etsy listing.
export function sizeFromProperties(props = []) {
  const get = (re) => (props || []).find((p) => re.test(p.property_name || ""));
  const w = get(/^width$/i), h = get(/^height$/i);
  const num = (p) => p && (p.values || [])[0];
  if (!num(w) || !num(h)) return "";
  const unit = /inch/i.test(w.scale_name || "inches") ? '"' : ` ${w.scale_name}`;
  return `${num(w)}${unit} wide × ${num(h)}${unit} tall`;
}

// Options exactly as Etsy has them (e.g. Material: Regular waterproof / Holographic), each with its own price.
export function optionsFrom(inventory, basePrice, settings = {}) {
  const rows = (inventory?.products || []).filter((pr) => !pr.is_deleted);
  const variants = [];
  let label = "";
  for (const pr of rows) {
    const offer = (pr.offerings || []).find((o) => o.is_enabled !== false && !o.is_deleted);
    if (!offer) continue;
    const props = pr.property_values || [];
    if (!label && props.length) label = props.map((pv) => rename(settings.optionLabels, decode(pv.property_name))).join(" and ");
    const name = props.map((pv) => (pv.values || []).map((v) => rename(settings.optionNames, decode(v))).join(" ")).join(", ") || "Standard";
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

export function shortName(title) {
  const short = title.split(/\s*[,|]\s*/)[0].trim();
  return short.length >= 3 ? short : title;
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
    `- Updated from Etsy: ${report.updated.length ? "\n  - " + report.updated.join("\n  - ") : "nothing changed"}`,
    `- Marked sold out: ${report.soldOut.join(", ") || "none"}`,
    `- Available again: ${report.back.join(", ") || "none"}`,
    `- Skipped on purpose: ${report.skipped.join(", ") || "none"}`,
    ...report.held.map((p) => `- ✋ Held back: ${p}`),
    ...report.problems.map((p) => `- ⚠️ ${p}`),
  ].join("\n");
  console.log(lines);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, lines + "\n", { flag: "a" });
  await writeFile("data/etsy-sync-last.json", JSON.stringify({ ranAt: new Date().toISOString(), ...report }, null, 2) + "\n");
  if (report.held.length) process.exitCode = 1; // GitHub emails you about a failed run; everything else was still saved
}
