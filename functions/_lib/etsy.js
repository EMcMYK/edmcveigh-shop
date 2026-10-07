/*
  Etsy write access (OAuth), shared by everything on the shop that changes Etsy listings:
  the copy-edit tool (/api/etsy/listing) and, for step 36, deactivating a painting on Etsy
  when it sells on the shop.

  How it works: you connect your Etsy account once at /api/etsy/connect. Etsy hands back a
  1-hour access token and a 90-day refresh token. Both are kept in Cloudflare KV (binding
  ETSY_KV), and every use refreshes them, so the connection keeps itself alive as long as
  something uses it at least once every 90 days. If it ever lapses, connect again.

  Settings needed in Cloudflare (Settings → Variables and secrets, and Bindings):
    ETSY_API_KEY, ETSY_SHARED_SECRET   your Etsy app's keystring and shared secret
    ETSY_ADMIN_KEY                     a long random password only you (and GitHub) know
    ETSY_KV                            a KV namespace binding (Bindings → KV namespace)
*/

export const SCOPES = "listings_r listings_w";
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
export const API = "https://openapi.etsy.com/v3/application";
const KEY = "etsy:tokens";

export function redirectUri(request) {
  return new URL("/api/etsy/callback", request.url).toString();
}

// True when the request carries the admin key (?key=… or "Authorization: Bearer …").
export function isAdmin(request, env) {
  if (!env.ETSY_ADMIN_KEY) return false;
  const url = new URL(request.url);
  const given = url.searchParams.get("key") || (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return given.length === env.ETSY_ADMIN_KEY.length && safeEqual(given, env.ETSY_ADMIN_KEY);
}

export function missingSettings(env) {
  return ["ETSY_API_KEY", "ETSY_SHARED_SECRET", "ETSY_ADMIN_KEY", "ETSY_KV"].filter((k) => !env[k]);
}

async function tokenRequest(env, params) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.ETSY_API_KEY, ...params })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Etsy token request failed (${res.status}): ${data.error_description || data.error || "unknown"}`);
  return data;
}

async function save(env, data) {
  const now = Date.now();
  const saved = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: now + (Number(data.expires_in || 3600) - 60) * 1000,
    refresh_expires_at: now + 89 * 24 * 3600 * 1000,
    user_id: String(data.access_token || "").split(".")[0],
    saved_at: new Date(now).toISOString()
  };
  await env.ETSY_KV.put(KEY, JSON.stringify(saved));
  return saved;
}

// Step 2 of connecting: swap the code Etsy sent back for tokens.
export async function finishConnect(env, code, verifier, redirect) {
  return save(env, await tokenRequest(env, { grant_type: "authorization_code", redirect_uri: redirect, code, code_verifier: verifier }));
}

export async function status(env) {
  const t = JSON.parse((await env.ETSY_KV.get(KEY)) || "null");
  if (!t) return { connected: false };
  return { connected: Date.now() < t.refresh_expires_at, user_id: t.user_id, connected_or_refreshed: t.saved_at, reconnect_by: new Date(t.refresh_expires_at).toISOString().slice(0, 10) };
}

// A working access token, refreshed when it's about to expire.
export async function accessToken(env) {
  const t = JSON.parse((await env.ETSY_KV.get(KEY)) || "null");
  if (!t) throw new Error("Etsy isn't connected yet. Open /api/etsy/connect?key=… to connect it.");
  if (Date.now() < t.expires_at) return t.access_token;
  try {
    return (await save(env, await tokenRequest(env, { grant_type: "refresh_token", refresh_token: t.refresh_token }))).access_token;
  } catch (e) {
    throw new Error(`${e.message}. The Etsy connection may have lapsed: connect again at /api/etsy/connect.`);
  }
}

// Calls the Etsy API as you (the connected account).
export async function etsy(env, path, { method = "GET", body } = {}) {
  const headers = {
    "x-api-key": `${env.ETSY_API_KEY}:${env.ETSY_SHARED_SECRET}`,
    Authorization: `Bearer ${await accessToken(env)}`,
    Accept: "application/json"
  };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`Etsy said ${res.status} for ${method} ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

export async function shopId(env) {
  const me = await etsy(env, "/users/me");
  if (!me.shop_id) throw new Error("The connected Etsy account has no shop.");
  return me.shop_id;
}

// For step 36: take a listing off Etsy (inactive, not deleted) after it sells on the shop.
export async function deactivateListing(env, listingId) {
  return etsy(env, `/shops/${await shopId(env)}/listings/${listingId}`, { method: "PATCH", body: { state: "inactive" } });
}

// PKCE helpers
export function randomString(bytes = 48) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return b64url(a);
}
export async function challenge(verifier) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function safeEqual(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
