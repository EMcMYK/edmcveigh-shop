/*
  GET /api/stats?days=30 — the numbers behind the Stats page (shop.edmcveigh.com/stats). Admin only:
  the same admin key as the Orders page (ETSY_ADMIN_KEY), as "Authorization: Bearer …".
  A "visit" is one visitor on one day (see functions/api/hit.js for how visitors are counted).
*/
import { isAdmin } from "../_lib/etsy.js";
import { ensureTable, phillyDay } from "../_lib/stats.js";

// Friendly names for where visits came from. utm tags (from pins and the links page) win over the
// referring site, since apps like Instagram often hide where a click came from.
const SOURCE_NAMES = [
  [/^links-page$/, "Your links page"],
  [/pinterest|pin\.it/, "Pinterest"],
  [/instagram/, "Instagram"],
  [/facebook|fb\.com|fb\.me/, "Facebook"],
  [/threads/, "Threads"],
  [/^(google|bing|duckduckgo|yahoo|ecosia|search\.brave)\b|\.google\./, "Search engines"],
  [/etsy/, "Etsy"],
  [/faire/, "Faire"],
  [/^t\.co$|twitter|x\.com/, "X / Twitter"],
];
const sourceName = (src, ref) => {
  const s = src || ref;
  if (!s) return "Direct or unknown";
  const hit = SOURCE_NAMES.find(([re]) => re.test(s));
  return hit ? hit[1] : s;
};

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Wrong or missing admin key." }, 401);
  if (!env.STATS_DB) return json({ error: "The STATS_DB database isn't connected in Cloudflare yet." }, 500);
  const days = Math.min(400, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const from = phillyDay(Date.now() - (days - 1) * 864e5);
  const db = env.STATS_DB;
  await ensureTable(db);
  const all = (sql, ...args) => db.prepare(sql).bind(from, ...args).all().then((r) => r.results);

  const [daily, pages, firstHits, campaigns, events, countries, devices, links] = await Promise.all([
    all(`SELECT day, site, COUNT(DISTINCT visitor) AS visits, SUM(kind = 'view') AS views
         FROM hits WHERE day >= ? GROUP BY day, site ORDER BY day`),
    all(`SELECT path, COUNT(*) AS views, COUNT(DISTINCT day || visitor) AS visits
         FROM hits WHERE day >= ? AND site = 'shop' AND kind = 'view' GROUP BY path ORDER BY visits DESC, views DESC LIMIT 20`),
    // How each visit arrived: its first hit of the day (SQLite returns the other columns from the MIN(ts) row).
    all(`SELECT site, source, ref, MIN(ts) AS ts FROM hits WHERE day >= ? GROUP BY site, day, visitor`),
    all(`SELECT source, campaign, COUNT(DISTINCT day || visitor) AS visits
         FROM hits WHERE day >= ? AND site = 'shop' AND campaign != '' GROUP BY source, campaign ORDER BY visits DESC LIMIT 20`),
    all(`SELECT event, product, COUNT(*) AS times
         FROM hits WHERE day >= ? AND kind = 'event' AND site = 'shop' GROUP BY event, product ORDER BY times DESC`),
    all(`SELECT country, COUNT(DISTINCT day || visitor) AS visits FROM hits WHERE day >= ? GROUP BY country ORDER BY visits DESC LIMIT 10`),
    all(`SELECT device, COUNT(DISTINCT day || visitor) AS visits FROM hits WHERE day >= ? GROUP BY device ORDER BY visits DESC`),
    all(`SELECT product AS link, COUNT(*) AS clicks
         FROM hits WHERE day >= ? AND site = 'links' AND kind = 'event' GROUP BY product ORDER BY clicks DESC`),
  ]);

  const sources = {};
  for (const h of firstHits) {
    const key = `${h.site}|${sourceName(h.source, h.ref)}`;
    sources[key] = (sources[key] || 0) + 1;
  }
  const sourceList = Object.entries(sources)
    .map(([k, visits]) => ({ site: k.split("|")[0], source: k.split("|")[1], visits }))
    .sort((a, b) => b.visits - a.visits);

  return json({ days, from, daily, pages, sources: sourceList, campaigns, events, countries, devices, links });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
