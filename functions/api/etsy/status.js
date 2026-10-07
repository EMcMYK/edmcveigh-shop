/* GET /api/etsy/status?key=YOUR_ETSY_ADMIN_KEY — is Etsy connected, and until when. */
import { isAdmin, status, missingSettings } from "../../_lib/etsy.js";

export async function onRequestGet({ request, env }) {
  const missing = missingSettings(env);
  if (missing.length) return Response.json({ connected: false, missing });
  if (!isAdmin(request, env)) return new Response("Forbidden", { status: 403 });
  return Response.json(await status(env), { headers: { "cache-control": "no-store" } });
}
