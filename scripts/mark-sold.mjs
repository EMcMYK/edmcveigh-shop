/*
  Marks one product as sold on the shop. Run by .github/workflows/mark-sold.yml, which the
  Stripe sale hook (functions/api/stripe-webhook.js) starts when a one-of-a-kind item sells.
  Usage: node scripts/mark-sold.mjs <product-id>
*/
import { readFile, writeFile } from "node:fs/promises";

const id = process.argv[2];
const file = "data/products.json";
const data = JSON.parse(await readFile(file, "utf8"));
const p = data.products.find((x) => x.id === id);
if (!p) { console.error(`No product with id "${id}"`); process.exit(1); }

p.soldOut = true;
p.soldWhere = "shop";
p.soldOn = new Date().toISOString().slice(0, 10);
await writeFile(file, JSON.stringify(data, null, 2) + "\n");

// Hand the name and Etsy listing to the next workflow step (the email reminder).
const out = process.env.GITHUB_OUTPUT;
if (out) await writeFile(out, `name=${p.name}\netsy=${p.etsyListingId || ""}\n`, { flag: "a" });
console.log(`Marked sold: ${p.name}`);
