/*
  GET /api/etsy/callback — where Etsy sends you back after you approve the connection.
  Register this exact address as a callback URL in your Etsy app (etsy.com/developers/your-apps):
    https://edmcveigh-shop.pages.dev/api/etsy/callback   (and https://shop.edmcveigh.com/api/etsy/callback once that's live)
*/
import { finishConnect, redirectUri, shopId } from "../../_lib/etsy.js";
import { page } from "./connect.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return page(`Etsy didn't connect: ${esc(url.searchParams.get("error_description") || url.searchParams.get("error"))}`, 400);
  const state = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
  const verifier = state && (await env.ETSY_KV.get(`etsy:oauth:${state}`));
  if (!verifier || !code) return page("This link expired or was already used. Start again at /api/etsy/connect.", 400);
  await env.ETSY_KV.delete(`etsy:oauth:${state}`);
  try {
    await finishConnect(env, code, verifier, redirectUri(request));
  } catch (e) {
    return page(`Couldn't finish connecting: ${esc(e.message)}`, 502);
  }
  // Connected. Checking the shop is a bonus; a failure here doesn't undo the connection.
  const shop = await shopId(env).catch(() => null);
  return page(`<b>Etsy is connected.</b>${shop ? ` Shop id ${shop}.` : ""} You can close this tab.`);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
