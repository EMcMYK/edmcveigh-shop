/*
  Sends visitors on the old address (edmcveigh-shop.pages.dev) to shop.edmcveigh.com, keeping the page and hash.
  Only the exact production pages.dev name is redirected: preview builds (abc123.edmcveigh-shop.pages.dev)
  still work for testing, and /api/ is left alone (the Etsy sign-in callback is registered on pages.dev).
*/
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname === "edmcveigh-shop.pages.dev" && !url.pathname.startsWith("/api/")) {
    url.hostname = "shop.edmcveigh.com";
    return Response.redirect(url.href, 301);
  }
  return next();
}
