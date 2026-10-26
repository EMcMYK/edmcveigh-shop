// Shared by /api/hit (records visits) and /api/stats (the Stats page). See functions/api/hit.js.

// Which page addresses count, and what each is called on the Stats page.
export const SITES = {
  "https://shop.edmcveigh.com": "shop",
  "https://edmcveigh.com": "links",
  "https://www.edmcveigh.com": "links",
};

// Days are Philly days (Eastern time), so "today" on the Stats page matches yours.
export const phillyDay = (t = Date.now()) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

let ready = false;
export async function ensureTable(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS hits (
      id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, day TEXT NOT NULL, site TEXT NOT NULL, kind TEXT NOT NULL,
      path TEXT, ref TEXT, source TEXT, campaign TEXT, event TEXT, product TEXT, country TEXT, device TEXT, visitor TEXT)`),
    db.prepare("CREATE INDEX IF NOT EXISTS hits_day ON hits (day)"),
  ]);
  ready = true;
}
