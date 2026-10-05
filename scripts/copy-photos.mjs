// One-time job: copies every product photo that still loads from Etsy into the repo
// (images/<product-id>/<photo-id>.jpg) and points products.json at the copies.
// Safe to run again: photos already in the repo are skipped, and a photo that
// fails to download keeps its Etsy link so nothing disappears from the shop.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export async function copyPhotos({ root = process.cwd(), fetch = globalThis.fetch, log = console.log } = {}) {
  const productsPath = path.join(root, "data", "products.json");
  const data = JSON.parse(await readFile(productsPath, "utf8"));
  const report = { copied: 0, failed: [], products: 0 };

  for (const p of data.products) {
    if (!Array.isArray(p.images) || !p.images.some((u) => /^https?:\/\//.test(u))) continue;
    report.products++;
    const dir = path.join(root, "images", p.id);
    await mkdir(dir, { recursive: true });
    const out = [];
    for (const url of p.images) {
      if (!/^https?:\/\//.test(url)) { out.push(url); continue; }
      // Etsy photo URLs end in il_794xN.<photo id>_<code>.jpg
      const m = url.match(/\/(\d+)\/il_[^/]*$/) || url.match(/il_[^.]+\.(\d+)_/);
      const name = (m ? m[1] : String(out.length + 1)) + ".jpg";
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await writeFile(path.join(dir, name), Buffer.from(await res.arrayBuffer()));
        out.push(`images/${p.id}/${name}`);
        report.copied++;
      } catch (e) {
        log(`Kept the Etsy link for ${p.id} (${e.message}): ${url}`);
        report.failed.push(`${p.id}: ${url}`);
        out.push(url);
      }
    }
    p.images = out;
  }
  await writeFile(productsPath, JSON.stringify(data, null, 2) + "\n");
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await copyPhotos();
  const lines = [
    "## Copy photos into the repo",
    `- Products updated: ${r.products}`,
    `- Photos copied: ${r.copied}`,
    `- Couldn't copy (Etsy link kept): ${r.failed.length ? r.failed.join("; ") : "none"}`,
  ];
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", { flag: "a" });
}
