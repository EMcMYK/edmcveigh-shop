/*
  Puts photos on Etsy listings, from folders in etsy-photos/, through the shop's /api/etsy/images endpoint
  (which holds the Etsy connection). Run by .github/workflows/upload-etsy-photos.yml.

  data/etsy-photos.json lists the jobs:
    { "jobs": [ { "id": "philly-eats-pack", "listing_id": 123, "folder": "PhillyEatsPack", "replaceAll": true } ] }
  Each folder holds the photos named in Etsy order: 1_hero.jpg, 2_product.jpg, … (other files are ignored).
  replaceAll: the folder's photos become the listing's photos, in order, and any extra old photos are removed.
  Without it, the photos are added after the ones already there.

  DRY_RUN=true (the default) only shows what's on Etsy now and what would be uploaded.
  Finished jobs get "done": true and are skipped next time; results go to data/etsy-photos-result.json.
*/
import { readFile, writeFile, readdir } from "node:fs/promises";

const base = (process.env.SHOP_URL || "https://edmcveigh-shop.pages.dev").replace(/\/$/, "");
const key = process.env.ETSY_ADMIN_KEY;
const dryRun = process.env.DRY_RUN !== "false";
const only = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!key) throw new Error("Missing ETSY_ADMIN_KEY (GitHub → Settings → Secrets and variables → Actions).");
const auth = { Authorization: `Bearer ${key}` };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, query, body, type) {
  const res = await fetch(`${base}/api/etsy/images?${new URLSearchParams(query)}`, {
    method, headers: body ? { ...auth, "Content-Type": type } : auth, body
  });
  const out = await res.json().catch(async () => ({ error: (await res.text()).slice(0, 300) }));
  if (!res.ok || out.error) throw new Error(out.error || `HTTP ${res.status}`);
  return out;
}

const file = JSON.parse(await readFile("data/etsy-photos.json", "utf8"));
const results = [];
for (const job of file.jobs) {
  if (job.done || (only.length && !only.includes(job.id))) continue;
  const r = { id: job.id, listing_id: job.listing_id, ok: false };
  try {
    const dir = `etsy-photos/${job.folder}`;
    const photos = (await readdir(dir)).filter((f) => /^\d+_.+\.(jpe?g|png)$/i.test(f))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    if (!photos.length) throw new Error(`No numbered photos in ${dir}`);
    if (photos.length > 20) throw new Error("Etsy allows 20 photos.");
    const before = (await api("GET", { listing_id: job.listing_id })).images;
    r.before = before.length; r.photos = photos;
    if (dryRun) { r.ok = true; r.plan = job.replaceAll ? `replace ${before.length} photo(s) with ${photos.length}` : `add ${photos.length} after ${before.length}`; }
    else {
      const start = job.replaceAll ? 1 : before.length + 1;
      for (const [i, f] of photos.entries()) {
        const bytes = await readFile(`${dir}/${f}`);
        const type = /\.png$/i.test(f) ? "image/png" : "image/jpeg";
        const q = { listing_id: job.listing_id, rank: start + i, name: f };
        if (job.replaceAll && i < before.length) q.replace = "1";
        await api("POST", q, bytes, type);
        console.log(`  ${job.id}: uploaded ${f} as photo ${start + i}`);
        await pause(600);
      }
      let after = (await api("GET", { listing_id: job.listing_id })).images;
      if (job.replaceAll) {
        for (const extra of after.filter((im) => im.rank > photos.length)) {
          await api("DELETE", { listing_id: job.listing_id, image_id: extra.id }); await pause(400);
        }
        after = (await api("GET", { listing_id: job.listing_id })).images;
      }
      r.after = after.length;
      r.ok = job.replaceAll ? after.length === photos.length : after.length === before.length + photos.length;
      if (r.ok) job.done = true; else r.error = `Expected ${job.replaceAll ? photos.length : before.length + photos.length} photos, Etsy has ${after.length}.`;
    }
  } catch (e) { r.error = e.message; }
  results.push(r);
  console.log(`${r.ok ? "OK  " : "FAIL"} ${job.id}${r.plan ? ": " + r.plan : ""}${r.error ? ": " + r.error : ""}`);
}
if (!dryRun) await writeFile("data/etsy-photos.json", JSON.stringify(file, null, 2) + "\n");
await writeFile("data/etsy-photos-result.json", JSON.stringify({ ranAt: new Date().toISOString(), dryRun, results }, null, 2) + "\n");
const failed = results.filter((r) => !r.ok);
console.log(`${dryRun ? "Checked" : "Uploaded"} ${results.length - failed.length} of ${results.length} job(s).`);
if (failed.length) process.exitCode = 1;
