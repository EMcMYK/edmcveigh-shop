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
      shop.edmcveigh.com/#policies   → shipping, returns and commission policies (text: data/policies.html)
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
  const CATEGORIES = CONFIG.categories || [
    { id: "stickers", title: "Stickers", note: "" },
    { id: "portraits", title: "House portraits", note: "" }
  ];
  const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || { id, title: id, note: "" };
  // Portraits and one-of-a-kind originals are always sold one at a time.
  const singleOnly = (p) => Boolean(p.deposit || p.oneOfAKind);

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
    // Paintings are shown whole (no cropping); everything else fills the square.
    const fit = p.category === "stickers" ? "" : " contain";
    if (img) return `<div class="mat${fit}" style="${style}"><img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy"></div>`;
    const art = p.category !== "stickers"
      ? `<div class="portrait-ph"><span>${p.category === "portraits" ? "Your home here" : esc(p.name)}</span></div>`
      : `<div class="sticker" style="--ratio:${ratioFromSize(p.size)}">${esc(p.name.replace(/ Sticker( Sheet)?$/, ""))}</div>`;
    return `<div class="mat" style="${style}">${art}<span class="ph-note">Photo coming</span></div>`;
  }

  // ---------- page chrome (header nav, banner, footer, light/dark) ----------
  // The header itself lives in index.html so the logo intro can land in it; this fills it in.
  function renderChrome(active) {
    document.getElementById("banner").textContent = CONFIG.shippingNote || "Free US shipping";
    const current = (c) => active === c.id ? 'aria-current="page"' : "";
    document.getElementById("nav").innerHTML = CATEGORIES.map((c) =>
      `<a href="#${esc(c.id)}" ${current(c)}>${esc(c.title)}</a>`).join("");
    document.getElementById("menuPanel").innerHTML =
      `<a href="#" ${active === "" ? 'aria-current="page"' : ""}><span class="label">Everything</span><span class="sub">The whole shop</span><span class="arrow" aria-hidden="true">→</span></a>` +
      CATEGORIES.map((c) =>
        `<a href="#${esc(c.id)}" ${current(c)}><span class="label">${esc(c.title)}</span><span class="sub">${esc(c.note)}</span><span class="arrow" aria-hidden="true">→</span></a>`).join("");
    closeMenu();
  }

  // Menu button (small screens): opens the section list under the header.
  function setMenu(open) {
    const btn = document.getElementById("menuBtn"), panel = document.getElementById("menuPanel");
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  function closeMenu() { setMenu(false); }
  function wireMenu() {
    const btn = document.getElementById("menuBtn"), panel = document.getElementById("menuPanel");
    btn.addEventListener("click", () => setMenu(panel.hidden));
    panel.addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { closeMenu(); btn.focus(); } });
    document.addEventListener("click", (e) => { if (!panel.hidden && !e.target.closest(".header")) closeMenu(); });
  }
  function renderFooter() {
    document.getElementById("footer").innerHTML = `<div class="wrap">
      <span>Drawn, painted, printed and cut by hand in Philadelphia. No AI.</span>
      <nav aria-label="Elsewhere">
        <a href="#policies">Shop policies</a>
        ${CONFIG.etsyUrl ? `<a href="${esc(CONFIG.etsyUrl)}" target="_blank" rel="noopener">Etsy</a>` : ""}
        ${CONFIG.instagramUrl ? `<a href="${esc(CONFIG.instagramUrl)}" target="_blank" rel="noopener">Instagram</a>` : ""}
        ${CONFIG.contactEmail ? `<span>${esc(CONFIG.contactEmail)}</span>` : ""}
      </nav>
    </div>`;
  }
  function wireModeToggle() {
    const btn = document.getElementById("modeToggle");
    const root = document.documentElement;
    const label = () => {
      const next = root.dataset.mode === "dark" ? "light" : "dark";
      btn.setAttribute("aria-label", `Switch to ${next} mode`); btn.title = `Switch to ${next} mode`;
    };
    label();
    btn.addEventListener("click", () => {
      root.dataset.mode = root.dataset.mode === "dark" ? "light" : "dark";
      try { localStorage.setItem("edm-mode", root.dataset.mode); } catch (e) { /* not saved, still switches */ }
      label();
    });
  }

  function card(p) {
    const prices = p.variants.map((v) => v.price);
    const low = Math.min(...prices), high = Math.max(...prices);
    const priceText = low === high ? money(low) : `${money(low)}–${money(high)}`;
    return `
      <a class="card ${p.soldOut ? "sold-out" : ""}" href="#${esc(p.id)}">
        <div class="frame">${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}${picture(p)}</div>
        <div class="card-body">
          <span class="card-title">${esc(p.name)}</span>
          ${p.size ? `<span class="card-meta">${esc(p.size)}</span>` : ""}
          <span class="card-price">${p.soldOut ? "Sold out" : priceText}</span>
        </div>
      </a>`;
  }

  // ---------- pages ----------
  function homePage(filter) {
    const sections = CATEGORIES.filter((c) => !filter || c.id === filter).map((c) => {
      const list = PRODUCTS.filter((p) => p.category === c.id);
      return list.length ? `
        <section class="section" id="sec-${esc(c.id)}"><div class="wrap">
          <div class="section-head"><h2>${esc(c.title)}</h2><p>${esc(c.note)}</p></div>
          <div class="grid">${list.map(card).join("")}</div>
        </div></section>` : "";
    }).join("");
    return `
      ${filter ? "" : `<section class="hello"><div class="wrap">
        <h1>ed.mcveigh shop</h1>
        <p>Hand-drawn stickers for your stuff, one-of-a-kind art for your walls. Mix and match in one order, and shipping is always free in the US.</p>
      </div></section>`}
      ${sections}`;
  }

  function productPage(p) {
    const v0 = p.variants[0];
    const many = p.variants.length > 1;
    const photos = (p.images || []);
    return `
      <div class="wrap">
        <a class="back" href="#${esc(p.category)}">← All ${esc(categoryOf(p.category).title.toLowerCase())}</a>
        <div class="product">
          <div class="gallery">
            <div class="frame" id="main-pic">${picture(p, 0)}</div>
            ${photos.length > 1 ? `<div class="thumbs">${photos.map((src, i) =>
              `<button type="button" data-pic="${i}" aria-pressed="${i === 0}" aria-label="Photo ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}
          </div>
          <div class="info">
            <h1>${esc(p.name)}</h1>
            <div class="price-line">
              <span class="price" id="price">${money(v0.price)}</span>
              ${p.deposit ? `<span class="deposit-note" id="deposit-note">${money(dueToday(p, v0))} deposit today, the rest when it's finished</span>` : ""}
            </div>
            ${p.deposit ? `<a class="policy-link" href="#policies-commissions">How the deposit, sketch and final payment work →</a>` : ""}
            ${p.size ? `<div class="size">Size: <b>${esc(p.size)}</b></div>` : ""}
            ${p.oneOfAKind && !p.soldOut ? `<div class="size">One of a kind: <b>only 1 available</b></div>` : ""}
            ${many ? `<div class="field">
              <label for="variant">${esc(p.variantLabel || "Option")}</label>
              <select id="variant">${p.variants.map((v, i) => `<option value="${i}">${esc(v.name)} — ${money(v.price)}</option>`).join("")}</select>
            </div>` : ""}
            <div class="buy-row">
              ${singleOnly(p) ? "" : `<div class="qty" role="group" aria-label="Quantity">
                <button type="button" id="qty-minus" aria-label="One fewer">−</button>
                <output id="qty" aria-live="polite">1</output>
                <button type="button" id="qty-plus" aria-label="One more">+</button>
              </div>`}
              <button class="btn" id="add" type="button" ${p.soldOut ? "disabled" : ""}>${p.soldOut ? "Sold out" : p.deposit ? "Add deposit to cart" : "Add to cart"}</button>
            </div>
            <div class="prose">
              ${shownDescription(p).map((t) => `<p>${esc(t)}</p>`).join("")}
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

  // ---------- shop policies (text lives in data/policies.html) ----------
  let policiesHtml = null;
  async function showPolicies(section) {
    app.innerHTML = `<div class="wrap"><article class="policies" id="policies-body"><p class="fineprint">Loading…</p></article></div>`;
    try {
      if (policiesHtml === null) policiesHtml = await (await fetch("data/policies.html", { cache: "no-cache" })).text();
      document.getElementById("policies-body").innerHTML = policiesHtml;
    } catch (e) {
      document.getElementById("policies-body").innerHTML = `<p class="msg error">The policies couldn't load. Please refresh the page.</p>`;
    }
    const target = section && document.getElementById(section);
    if (target) target.scrollIntoView({ block: "start" });
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
    if (p.oneOfAKind) {
      // Only one exists, so a second framing choice replaces the first instead of adding another.
      cart = cart.filter((l) => l.id !== id);
      cart.push({ id, variant, qty: 1 });
      saveCart();
      return;
    }
    const existing = cart.find((l) => l.id === id && l.variant === variant);
    if (existing && !singleOnly(p)) existing.qty = Math.min(50, existing.qty + qty);
    else if (!existing) cart.push({ id, variant, qty: singleOnly(p) ? 1 : qty });
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
          <div class="line-variant">${esc(p.variants.length > 1 ? v.name : (p.size || v.name))}${p.deposit ? " · 50% deposit" : ""}${p.oneOfAKind ? " · one of a kind" : ""}</div>
          <div class="line-actions">
            ${singleOnly(p) ? "" : `<div class="qty" role="group" aria-label="Quantity of ${esc(p.name)}">
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
      app.innerHTML = productPage(p); renderChrome(p.category);
      document.title = `${p.name} · ed.mcveigh shop`;
      wireProduct(p);
    } else if (hash === "policies" || hash.startsWith("policies-")) {
      renderChrome("");
      document.title = "Shop policies · ed.mcveigh shop";
      showPolicies(hash.slice("policies-".length));
      renderCartCount();
      if (hash === "policies") window.scrollTo(0, 0);
      return;
    } else if (hash === "thanks") {
      app.innerHTML = thanksPage(); renderChrome("");
      document.title = "Thank you · ed.mcveigh shop";
    } else {
      const filter = CATEGORIES.some((c) => c.id === hash) ? hash : "";
      app.innerHTML = homePage(filter); renderChrome(filter);
      document.title = "ed.mcveigh shop";
      if (hash === "cart") setTimeout(openCart);
    }
    renderCartCount();
    if (!document.documentElement.classList.contains("intro")) window.scrollTo(0, 0);
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
  // Header pieces work even before the products load.
  renderChrome(""); renderFooter(); wireModeToggle(); wireMenu(); renderCartCount();
  document.getElementById("open-cart").onclick = () => { closeMenu(); openCart(); };
  start();
})();

// The Etsy description repeats the "drawn by me, no AI" note that Details already shows here,
// so the shop hides that paragraph (it stays on Etsy).
function shownDescription(p) {
  const desc = p.description || [];
  const detailsSayIt = (p.details || []).some((d) => /no ai/i.test(d));
  if (!detailsSayIt) return desc;
  return desc.filter((t) => !/^(every sticker is |all of my stickers are )?drawn, designed, printed,? and cut by me\b[^]*no ai/i.test(t.trim()));
}
