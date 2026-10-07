/*
  Applies the copy edits in data/etsy-edits.json to your Etsy listings, one listing at a time,
  through the shop's /api/etsy/listing endpoint (which holds the Etsy connection).
  Run by .github/workflows/apply-etsy-edits.yml. With DRY_RUN=true nothing changes on Etsy:
  each listing is only checked (its current text must match "expect").
  Results are written to data/etsy-edits-result.json.
*/
import { readFile, writeFile } from "node:fs/promises";

const base = (process.env.SHOP_URL || "https://edmcveigh-shop.pages.dev").replace(/\/$/, "");
const key = process.env.ETSY_ADMIN_KEY;
const dryRun = process.env.DRY_RUN !== "false";
const only = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!key) throw new Error("Missing ETSY_ADMIN_KEY (GitHub → Settings → Secrets and variables → Actions).");

const { edits } = JSON.parse(await readFile("data/etsy-edits.json", "utf8"));
const results = [];
for (const e of edits) {
  if (only.length && !only.includes(e.id)) continue;
  const res = await fetch(`${base}/api/etsy/listing`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ listing_id: e.listing_id, expect: e.expect, set: e.set, removeOption: e.removeOption, renameOption: e.renameOption, dryRun })
  });
  const body = await res.json().catch(async () => ({ error: (await res.text()).slice(0, 300) }));
  const ok = res.ok && (dryRun || body.ok === true);
  results.push({ id: e.id, listing_id: e.listing_id, ok, status: res.status, error: body.error || null, before: body.before || null, after: body.after || null, options: body.options || null, readiness: body.readiness || null });
  console.log(`${ok ? "OK  " : "FAIL"} ${e.id}${body.error ? ": " + body.error : ""}`);
  await new Promise((r) => setTimeout(r, 400));
}
await writeFile("data/etsy-edits-result.json", JSON.stringify({ ranAt: new Date().toISOString(), dryRun, results }, null, 2) + "\n");
const failed = results.filter((r) => !r.ok);
console.log(`${dryRun ? "Checked" : "Applied"} ${results.length - failed.length} of ${results.length}.`);
if (failed.length) process.exitCode = 1;
