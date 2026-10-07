/*
  GET /api/etsy/connect?key=YOUR_ETSY_ADMIN_KEY — connects your Etsy account (one time).
  Sends you to Etsy to approve listing read/edit access, then back to /api/etsy/callback.
  Shared helpers and the settings it needs: functions/_lib/etsy.js
*/
import { isAdmin, missingSettings, redirectUri, randomString, challenge, SCOPES } from "../../_lib/etsy.js";

export async function onRequestGet({ request, env }) {
  const missing = missingSettings(env);
  if (missing.length) return page(`Not set up yet. Add these in Cloudflare first: ${missing.join(", ")}.`, 500);
  if (!isAdmin(request, env)) return page("Add ?key= with your admin key to the address.", 403);
  const verifier = randomString(48), state = randomString(16);
  await env.ETSY_KV.put(`etsy:oauth:${state}`, verifier, { expirationTtl: 900 });
  const url = new URL("https://www.etsy.com/oauth/connect");
  url.search = new URLSearchParams({
    response_type: "code", client_id: env.ETSY_API_KEY, redirect_uri: redirectUri(request), scope: SCOPES,
    state, code_challenge: await challenge(verifier), code_challenge_method: "S256"
  }).toString().replace(/\+/g, "%20"); // Etsy wants the scopes space-separated as %20
  return Response.redirect(url.toString(), 302);
}

export function page(msg, status = 200) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Etsy connection</title><body style="font:18px/1.5 system-ui;max-width:36em;margin:3em auto;padding:0 16px">${msg}</body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
