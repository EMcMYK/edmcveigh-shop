/*
  ed.mcveigh shop — the whole storefront in one script.

  What it does:
  - Loads products from data/products.json (you never need to edit this file to add products).
  - Shows pages based on the part of the address after "#":
      shop.edmcveigh.com/            → all products
      shop.edmcveigh.com/#stickers   → stickers only
      shop.edmcveigh.com/#portraits  → house portraits only
      shop.edmcveigh.com/#cat-burger → one product (uses the product's id)
      shop.edmcveigh.com/#thanks     → shown after someone pays
  - Keeps a cart in the visitor's browser and sends it to /api/checkout,
    which hands the customer off to Stripe's secure checkout page.
*/
(function () {
  "use strict";

  const CONFIG = window.SHOP_CONFIG || {};
  const CART_KEY = "edm-cart-v1";
  const app = document.getElementById("app");
  let PRODUCTS = [];
  let cart = loadCart();

  // ---------- small helpers ----------
  const money = (n) => "$" + n.toFixed(2).replace(/\.00$/, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = (id) => PRODUCTS.find((p) => p.id === id);

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* private window: cart still works until the page closes */ }
    renderCartCount();
  }

  // Portraits are paid as a deposit at checkout; this is what's charged today.
  function dueToday(product, variant) {
    return product.deposit ? Math.round(variant.price * product.deposit * 100) / 100 : variant.price;
  }

  // Width ÷ height from a size like 3.23" wide × 1.32" tall, used to shape the placeholder sticker.
  function ratioFromSize(size) {
    const m = String(size).match(/([\d.]+)\D+([\d.]+)/);
    if (!m) return 1;
    const r = parseFloat(m[1]) / parseFloat(m[2]);
    return Math.min(Math.max(r, 0.55), 2.4);
  }

  // A product's picture: its first photo, or a drawn placeholder until photos are added.
  function picture(p, index = 0) {
    const style = `--swatch:${esc(p.swatch || "#2e6b47")}`;
    const img = p.images && p.images[index];
    if (img) return `<div class="mat" style="${style}"><img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy"></div>`;
    const art = p.category === "portraits"
      ? `<div class="portrait-ph"><span>Your home here</span></div>`
      : `<div class="sticker" style="--ratio:${ratioFromSize(p.size)}">${esc(p.name.replace(/ Sticker( Sheet)?$/, ""))}</div>`;
    return `<div class="mat" style="${style}">${art}<span class="ph-note">Photo coming</span></div>`;
  }

  // ---------- layout ----------
  function shell(content, active) {
    return `
      <div class="banner">${esc(CONFIG.shippingNote || "Free US shipping")}</div>
      <header class="header"><div class="wrap">
        <a class="wordmark" href="#">ed.mcveigh<small>shop</small></a>
        <nav class="nav" aria-label="Shop sections">
          <a href="#stickers" ${active === "stickers" ? 'aria-current="page"' : ""}>Stickers</a>
          <a href="#portraits" ${active === "portraits" ? 'aria-current="page"' : ""}>House portraits</a>
        </nav>
        <button class="cart-btn" id="open-cart" type="button" aria-label="Open cart">Cart <span class="count" id="cart-count">0</span></button>
      </div></header>
      <main>${content}</main>
      <footer class="footer"><div class="wrap">
        <span>Drawn, printed and cut by hand in the Philadelphia area. No AI.</span>
        <nav aria-label="Elsewhere">
          ${CONFIG.etsyUrl ? `<a href="${esc(CONFIG.etsyUrl)}" target="_blank" rel="noopener">Etsy</a>` : ""}
          ${CONFIG.instagramUrl ? `<a href="${esc(CONFIG.instagramUrl)}" target="_blank" rel="noopener">Instagram</a>` : ""}
          ${CONFIG.contactEmail ? `<span>${esc(CONFIG.contactEmail)}</span>` : ""}
        </nav>
      </div></footer>
      <div id="drawer-root"></div>`;
  }

  function card(p) {
    const prices = p.variants.map((v) => v.price);
    const low = Math.min(...prices), high = Math.max(...prices);
    const priceText = low === high ? money(low) : `${money(low)}–${money(high)}`;
    return `
      <a class="card ${p.soldOut ? "sold-out" : ""}" href="#${esc(p.id)}">
        <div style="position:relative">${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}${picture(p)}</div>
        <div class="card-body">
          <span class="card-title">${esc(p.name)}</span>
          <span class="card-meta">${esc(p.size)}</span>
          <span class="card-price">${p.soldOut ? "Sold out" : priceText}</span>
        </div>
      </a>`;
  }

  // ---------- pages ----------
  function homePage(filter) {
    const stickers = PRODUCTS.filter((p) => p.category === "stickers");
    const portraits = PRODUCTS.filter((p) => p.category === "portraits");
    const section = (title, note, list, id) => list.length ? `
      <section class="section" id="sec-${id}"><div class="wrap">
        <div class="section-head"><h2>${title}</h2><p>${note}</p></div>
        <div class="grid">${list.map(card).join("")}</div>
      </div></section>` : "";
    return `
      ${filter ? "" : `<section class="intro"><div class="wrap">
        <h1>Philly stickers and house portraits, <em>drawn by hand.</em></h1>
        <p>Every sticker is drawn, printed and cut by me. Every portrait is an original pen and ink drawing. Mix and match designs in one order, and shipping is always free in the US.</p>
      </div></section>`}
      ${filter !== "portraits" ? section("Stickers", "Glossy, waterproof, die cut", stickers, "stickers") : ""}
      ${filter !== "stickers" ? section("House portraits", "Original 8×10 pen and ink", portraits, "portraits") : ""}`;
  }

  function productPage(p) {
    const v0 = p.variants[0];
    const many = p.variants.length > 1;
    const photos = (p.images || []);
    return `
      <div class="wrap">
        <a class="back" href="#${p.category === "portraits" ? "portraits" : "stickers"}">← All ${p.category === "portraits" ? "house portraits" : "stickers"}</a>
        <div class="product">
          <div class="gallery">
            <div id="main-pic">${picture(p, 0)}</div>
            ${photos.length > 1 ? `<div class="thumbs">${photos.map((src, i) =>
              `<button type="button" data-pic="${i}" aria-pressed="${i === 0}" aria-label="Photo ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}
          </div>
          <div class="info">
            <h1>${esc(p.name)}</h1>
            <div class="price-line">
              <span class="price" id="price">${money(v0.price)}</span>
              ${p.deposit ? `<span class="deposit-note" id="deposit-note">${money(dueToday(p, v0))} deposit today, the rest when it's finished</span>` : ""}
            </div>
            <div class="size">Size: <b>${esc(p.size)}</b></div>
            ${many ? `<div class="field">
              <label for="variant">${esc(p.variantLabel || "Option")}</label>
              <select id="variant">${p.variants.map((v, i) => `<option value="${i}">${esc(v.name)} — ${money(v.price)}</option>`).join("")}</select>
            </div>` : ""}
            <div class="buy-row">
              ${p.deposit ? "" : `<div class="qty" role="group" aria-label="Quantity">
                <button type="button" id="qty-minus" aria-label="One fewer">−</button>
                <output id="qty" aria-live="polite">1</output>
                <button type="button" id="qty-plus" aria-label="One more">+</button>
              </div>`}
              <button class="btn" id="add" type="button" ${p.soldOut ? "disabled" : ""}>${p.soldOut ? "Sold out" : p.deposit ? "Add deposit to cart" : "Add to cart"}</button>
            </div>
            <div class="prose">
              ${(p.description || []).map((t) => `<p>${esc(t)}</p>`).join("")}
              ${p.details && p.details.length ? `<h3>Details</h3><ul>${p.details.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
              ${p.steps && p.steps.length ? `<h3>How it works</h3><ol>${p.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}
              ${p.policy ? `<p class="fineprint">${esc(p.policy)}</p>` : ""}
              ${p.deposit && CONFIG.contactEmail ? `<p class="fineprint">Photos of your home go to <b>${esc(CONFIG.contactEmail)}</b>.</p>` : ""}
              ${p.disclaimer ? `<p class="fineprint">${esc(p.disclaimer)}</p>` : ""}
            </div>
          </div>
        </div>
      </div>`;
  }

  function wireProduct(p) {
    let qty = 1;
    const sel = document.getElementById("variant");
    const current = () => p.variants[sel ? Number(sel.value) : 0];
    if (sel) sel.addEventListener("change", () => {
      document.getElementById("price").textContent = money(current().price);
      const dn = document.getElementById("deposit-note");
      if (dn) dn.textContent = `${money(dueToday(p, current()))} deposit today, the rest when it's finished`;
    });
    const out = document.getElementById("qty");
    const setQty = (n) => { qty = Math.max(1, Math.min(50, n)); if (out) out.textContent = qty; };
    document.getElementById("qty-minus")?.addEventListener("click", () => setQty(qty - 1));
    document.getElementById("qty-plus")?.addEventListener("click", () => setQty(qty + 1));
    document.querySelectorAll("[data-pic]").forEach((b) => b.addEventListener("click", () => {
      document.getElementById("main-pic").innerHTML = picture(p, Number(b.dataset.pic));
      document.querySelectorAll("[data-pic]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    }));
    document.getElementById("add").addEventListener("click", () => {
      addToCart(p.id, sel ? Number(sel.value) : 0, qty);
      toast("Added to cart");
      openCart();
    });
  }

  function thanksPage() {
    cart = []; saveCart();
    return `<div class="wrap"><section class="thanks">
      <h1>Thank you!</h1>
      <p>Your order is in. Stripe is emailing you a receipt, and I'll ship your order soon.</p>
      <p>Ordered a house portrait? Email a clear, straight-on photo of the home${CONFIG.contactEmail ? ` to <b>${esc(CONFIG.contactEmail)}</b>` : ""}, plus your deadline and any details that matter to you. I'll send a pencil sketch to approve before I start inking.</p>
      <p><a href="#">Back to the shop</a></p>
    </section></div>`;
  }

  // ---------- cart ----------
  function addToCart(id, variant, qty) {
    const p = byId(id);
    const existing = cart.find((l) => l.id === id && l.variant === variant);
    if (existing && !p.deposit) existing.qty = Math.min(50, existing.qty + qty);
    else if (!existing) cart.push({ id, variant, qty: p.deposit ? 1 : qty });
    saveCart();
  }
  function validLines() {
    // Drops anything that's no longer in products.json (renamed, removed, sold out).
    return cart.filter((l) => { const p = byId(l.id); return p && !p.soldOut && p.variants[l.variant]; });
  }
  function renderCartCount() {
    const el = document.getElementById("cart-count");
    if (el) el.textContent = cart.reduce((n, l) => n + l.qty, 0);
  }

  function openCart(message) {
    cart = validLines();
    const root = document.getElementById("drawer-root");
    let total = 0, later = 0;
    const rows = cart.map((l, i) => {
      const p = byId(l.id), v = p.variants[l.variant];
      const today = dueToday(p, v) * l.qty;
      total += today; later += (v.price * l.qty) - today;
      return `<div class="line">
        ${picture(p)}
        <div>
          <div class="line-name">${esc(p.name)}</div>
          <div class="line-variant">${esc(p.variants.length > 1 ? v.name : p.size)}${p.deposit ? " · 50% deposit" : ""}</div>
          <div class="line-actions">
            ${p.deposit ? "" : `<div class="qty" role="group" aria-label="Quantity of ${esc(p.name)}">
              <button type="button" data-dec="${i}" aria-label="One fewer">−</button><output>${l.qty}</output><button type="button" data-inc="${i}" aria-label="One more">+</button>
            </div>`}
            <button type="button" class="link-btn" data-remove="${i}">Remove</button>
          </div>
        </div>
        <div class="line-price">${money(today)}</div>
      </div>`;
    }).join("");
    root.innerHTML = `
      <div class="scrim" id="scrim"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div class="drawer-head"><h2 id="cart-title">Your cart</h2><button class="icon-btn" id="close-cart" type="button" aria-label="Close cart">×</button></div>
        <div class="lines">${rows || `<p class="empty">Your cart is empty.</p>`}</div>
        ${cart.length ? `<div class="drawer-foot">
          <div class="sum-row"><span>Shipping</span><span class="free">Free</span></div>
          <div class="sum-row total"><span>Due today</span><span>${money(total)}</span></div>
          ${later > 0 ? `<div class="fineprint">Plus ${money(later)} for the portrait balance, invoiced when it's finished.</div>` : ""}
          ${message ? `<div class="msg ${message.error ? "error" : ""}">${esc(message.text)}</div>` : ""}
          <button class="btn" id="checkout" type="button">Check out</button>
          <div class="fineprint">You'll pay on Stripe's secure checkout page. Cards, Apple Pay and Google Pay accepted.</div>
        </div>` : ""}
      </aside>`;
    document.getElementById("scrim").onclick = closeCart;
    document.getElementById("close-cart").onclick = closeCart;
    root.querySelectorAll("[data-inc]").forEach((b) => b.onclick = () => { cart[b.dataset.inc].qty = Math.min(50, cart[b.dataset.inc].qty + 1); saveCart(); openCart(); });
    root.querySelectorAll("[data-dec]").forEach((b) => b.onclick = () => { const l = cart[b.dataset.dec]; l.qty > 1 ? l.qty-- : cart.splice(b.dataset.dec, 1); saveCart(); openCart(); });
    root.querySelectorAll("[data-remove]").forEach((b) => b.onclick = () => { cart.splice(b.dataset.remove, 1); saveCart(); openCart(); });
    document.getElementById("checkout")?.addEventListener("click", checkout);
    document.getElementById("close-cart").focus();
    document.addEventListener("keydown", escClose);
  }
  function closeCart() {
    document.getElementById("drawer-root").innerHTML = "";
    document.removeEventListener("keydown", escClose);
  }
  function escClose(e) { if (e.key === "Escape") closeCart(); }

  async function checkout() {
    const btn = document.getElementById("checkout");
    if (window.SHOP_DEMO) {
      openCart({ text: "This is a preview, so checkout is switched off. On your live site, this button opens Stripe's checkout page with everything in the cart." });
      return;
    }
    btn.disabled = true; btn.textContent = "Opening checkout…";
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.map(({ id, variant, qty }) => ({ id, variant, qty })) })
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout isn't available right now.");
      window.location.href = data.url; // Stripe's hosted checkout page
    } catch (err) {
      openCart({ error: true, text: err.message + " Please try again, or email me if it keeps happening." });
    }
  }

  function toast(text) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  // ---------- router ----------
  function route() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const p = byId(hash);
    if (p) {
      app.innerHTML = shell(productPage(p), p.category);
      document.title = `${p.name} · ed.mcveigh shop`;
      wireProduct(p);
    } else if (hash === "thanks") {
      app.innerHTML = shell(thanksPage());
      document.title = "Thank you · ed.mcveigh shop";
    } else {
      const filter = hash === "stickers" || hash === "portraits" ? hash : "";
      app.innerHTML = shell(homePage(filter), filter);
      document.title = "ed.mcveigh shop";
      if (hash === "cart") setTimeout(openCart);
    }
    document.getElementById("open-cart").onclick = () => openCart();
    renderCartCount();
    window.scrollTo(0, 0);
  }

  async function start() {
    try {
      const data = window.SHOP_PRODUCTS || await (await fetch("data/products.json", { cache: "no-cache" })).json();
      PRODUCTS = data.products || [];
    } catch (e) {
      app.innerHTML = `<div class="wrap"><p class="msg error" style="margin-top:40px">The product list couldn't load. If you just edited data/products.json, check it for a missing comma or quote.</p></div>`;
      console.error(e);
      return;
    }
    window.addEventListener("hashchange", route);
    route();
  }
  start();
})();
