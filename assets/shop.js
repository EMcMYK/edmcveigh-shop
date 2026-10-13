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
  const CHECKOUT_KEY = "edm-checkout";
  const app = document.getElementById("app");
  let PRODUCTS = [];
  let LABELS = {};   // shop-only names for options, from products.json "optionLabels" (Etsy keeps its own)
  const optName = (name) => LABELS[name] || name;
  let gallery = null; // the product page's photo controls, for the left/right keys

  // Left/right arrow keys flip through a product's photos, unless someone is typing,
  // using the option menu, or has the cart or menu open.
  document.addEventListener("keydown", (e) => {
    if (!gallery || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.target.closest("input, select, textarea, [contenteditable]")) return;
    if (document.querySelector("#drawer-root .drawer") || !document.getElementById("menuPanel").hidden) return;
    e.preventDefault();
    e.key === "ArrowRight" ? gallery.next() : gallery.prev();
  });
  let cart = loadCart();

  // ---------- small helpers ----------
  // The email address as a mail link (opens the visitor's mail app). `after` is punctuation that
  // follows it in a sentence.
  function emailLink(after = "") {
    const e = esc(CONFIG.contactEmail);
    return `<a class="email-link" href="mailto:${e}">${e}</a>${esc(after)}`;
  }
  const money = (n) => "$" + n.toFixed(2).replace(/\.00$/, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = (id) => PRODUCTS.find((p) => p.id === id);
  const CATEGORIES = CONFIG.categories || [
    { id: "stickers", title: "Stickers", note: "" },
    { id: "portraits", title: "House portraits", note: "" }
  ];
  const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || { id, title: id, note: "" };
  // One-of-a-kind originals and portrait deposits are sold one at a time (more than one house
  // is a custom quote by email).
  const singleOnly = (p) => Boolean(p.oneOfAKind || p.deposit);
  const inCategory = (id) => PRODUCTS.filter((p) => p.category === id);
  // A section with a single product (house portraits) links straight to that product.
  const sectionHref = (c) => { const list = inCategory(c.id); return "#" + (list.length === 1 ? list[0].id : c.id); };

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
    const fit = p.category === "stickers" ? "" : " natural";
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
      `<a href="${esc(sectionHref(c))}" ${current(c)}>${esc(c.title)}</a>`).join("") +
      `<a href="#about" ${active === "about" ? 'aria-current="page"' : ""}>About</a>` +
      `<a href="#contact" ${active === "contact" ? 'aria-current="page"' : ""}>Contact</a>`;
    document.getElementById("menuPanel").innerHTML =
      CATEGORIES.map((c) =>
        `<a href="${esc(sectionHref(c))}" ${current(c)}><span class="label">${esc(c.title)}</span><span class="sub">${esc(c.note)}</span><span class="arrow" aria-hidden="true">→</span></a>`).join("") +
      `<a href="#about" ${active === "about" ? 'aria-current="page"' : ""}><span class="label">About</span><span class="sub">Who makes all this</span><span class="arrow" aria-hidden="true">→</span></a>` +
      `<a href="#contact" ${active === "contact" ? 'aria-current="page"' : ""}><span class="label">Contact</span><span class="sub">Questions, portraits, wholesale</span><span class="arrow" aria-hidden="true">→</span></a>`;
    closeMenu();
  }

  // Menu button (small screens): opens the section list under the header.
  function setMenu(open) {
    const btn = document.getElementById("menuBtn"), panel = document.getElementById("menuPanel");
    panel.hidden = !open;
    document.body.classList.toggle("menu-open", open); // the phone buy bar steps aside while it's open
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
      <span>Drawn, painted, printed and cut by hand in Philadelphia.</span>
      <nav aria-label="Elsewhere">
        <a href="#policies">Shop policies</a>
        ${CONFIG.etsyUrl ? `<a href="${esc(CONFIG.etsyUrl)}" target="_blank" rel="noopener">Etsy</a>` : ""}
        ${CONFIG.instagramUrl ? `<a href="${esc(CONFIG.instagramUrl)}" target="_blank" rel="noopener">Instagram</a>` : ""}
        ${CONFIG.contactEmail ? emailLink() : ""}
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
          <span class="card-title">${esc(p.category === "stickers" ? p.name.replace(/ Sticker$/, "") : p.name)}</span>
          ${p.oneOfAKind && !p.soldOut ? `<span class="card-meta">One of a kind</span>` : ""}
          ${p.size ? `<span class="card-meta">${esc(p.size)}</span>` : ""}
          <span class="card-price">${p.soldOut ? (p.oneOfAKind ? `Sold <span class="found">· found a home</span>` : "Sold out") : priceText}</span>
        </div>
      </a>`;
  }

  // In the description's finish list, "• Holographic: …" uses the shop's label too.
  function relabel(paragraphs) {
    return paragraphs.map((t) => Object.entries(LABELS).reduce((acc, [from, to]) =>
      acc.replace(new RegExp(`(^|\\n)(\\s*[•\\-–]\\s+)${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s+\\w+)?:`, "g"), `$1$2${to}:`), t));
  }

  // "email me" / "Email me" in product text becomes a mail link (takes already-escaped text).
  const mailify = (html) => CONFIG.contactEmail
    ? html.replace(/\b(email me)\b/gi, (m) => `<a class="email-link" href="mailto:${esc(CONFIG.contactEmail)}">${m}</a>`)
    : html;
  const escMail = (t) => mailify(esc(t));

  // ---------- pages ----------
  // A section's grid, split into its groups (config.js "groups", e.g. stickers: Philly, then Cats).
  function grids(c, list) {
    if (!c.groups || !c.groups.length) return `<div class="grid">${list.map(card).join("")}</div>`;
    const tests = c.groups.map((g) => ({ ...g, re: new RegExp(g.match, "i") }));
    const groupOf = (p) => tests.find((g) => g.re.test(p.name));
    const parts = [{ title: c.otherTitle || "More", items: list.filter((p) => !groupOf(p)) }]
      .concat(tests.map((g) => ({ title: g.title, items: list.filter((p) => groupOf(p) === g) })))
      .filter((g) => g.items.length);
    if (parts.length < 2) return `<div class="grid">${list.map(card).join("")}</div>`;
    const gid = (g) => `grp-${c.id}-${g.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return `<nav class="jump jump-groups" aria-label="${esc(c.title)} groups">${parts.map((g) =>
        `<a href="#${esc(c.id)}" data-jump="${gid(g)}">${esc(g.title)}</a>`).join("")}</nav>` +
      parts.map((g) => `<div class="group" id="${gid(g)}">
        <h3 class="group-head">${esc(g.title)}</h3>
        <div class="grid">${g.items.map(card).join("")}</div>
      </div>`).join("");
  }

  function section(c, list, back) {
    return `
        <section class="section" id="sec-${esc(c.id)}"><div class="wrap">
          ${back ? `<a class="back back-all" href="#">← Everything</a>` : ""}
          <div class="section-head">${back ? `<h1>${esc(c.title)}</h1>` : `<h2>${esc(c.title)}</h2>`}<p>${esc(c.note)}</p></div>
          ${grids(c, list)}
        </div></section>`;
  }

  // The front page's feature for a section marked "feature" in config.js (house portraits):
  // its first product's first photo, laid on the mat like a print, with the way in.
  function feature(c, p) {
    const prices = p.variants.map((v) => v.price);
    const from = Math.min(...prices);
    const img = p.images && p.images[0];
    return `
        <section class="feature-sec" id="sec-${esc(c.id)}"><div class="wrap">
          <a class="feature" href="#${esc(p.id)}">
            <div class="feature-mat">${img
              ? `<img class="feature-print" src="${esc(img)}" alt="A finished ${esc(c.title.toLowerCase().replace(/s$/, ""))}: ${esc(p.summary || p.name)}">`
              : `<div class="portrait-ph"><span>Your home here</span></div>`}</div>
            <div class="feature-body">
              <h2>${esc(c.title)}</h2>
              <p>${esc(p.summary || c.note)}</p>
              <p class="feature-price">From ${money(from)}${p.deposit ? ` · ${Math.round(p.deposit * 100)}% deposit to start` : ""}</p>
              <span class="btn feature-cta">${esc(c.cta || "Take a look")}</span>
            </div>
          </a>
        </div></section>`;
  }

  function homePage(filter) {
    if (filter) {
      const c = categoryOf(filter);
      return section(c, inCategory(c.id), true);
    }
    const shown = CATEGORIES.map((c) => ({ c, list: inCategory(c.id) })).filter((x) => x.list.length);
    const featured = shown.filter((x) => x.c.feature);
    return `
      <section class="hello"><div class="wrap">
        <h1>ed.mcveigh shop</h1>
        <p>Drawn by hand in Philadelphia: stickers for your stuff, one-of-a-kind paintings for your walls, and pen and ink portraits of your home. Mix and match in one order, and shipping is always free in the US.</p>
        <nav class="jump" aria-label="Jump to a section">${shown.filter((x) => !x.c.feature).map((x) =>
          `<a href="${esc(sectionHref(x.c))}" data-jump="sec-${esc(x.c.id)}">${esc(x.c.title)}</a>`).join("")}</nav>
      </div></section>
      ${featured.map((x) => feature(x.c, x.list[0])).join("")}
      ${shown.filter((x) => !x.c.feature).map((x) => section(x.c, x.list)).join("")}
      <section class="about-strip"><div class="wrap">
        <a class="about-card" href="#about">
          <img src="images/about/drafting-set-detail.webp" width="900" height="1200" loading="lazy" alt="Close-up of vintage drafting compasses and dividers in a purple velvet case.">
          <div class="about-card-body">
            <h2>Who makes all this</h2>
            <p>One Philadelphia artist. I draw my house portraits with my grandfather’s drafting tools from the ’50s, found in my grandmother’s attic.</p>
            <span class="policy-link">Read the story</span>
          </div>
        </a>
      </div></section>`;
  }

  // In-page jumps (front page section chips): scroll there, and the address bar stays put.
  function wireJumps() {
    app.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", (e) => {
      const target = document.getElementById(a.dataset.jump);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }));
  }

  // Options like "Pen & ink only, framed": when every option is the same few choices
  // joined by commas, each choice is its own question (style, then finish) instead of one long menu.
  // The questions' names come from the option label ("Style and finish"). Returns null otherwise.
  function optionAxes(p) {
    if (p.variants.length < 3) return null;
    const parts = p.variants.map((v) => optName(v.name).split(/,\s*/));
    const n = parts[0].length;
    if (n < 2 || parts.some((x) => x.length !== n)) return null;
    if (new Set(parts.map((x) => x.join("|"))).size !== parts.length) return null;
    const values = Array.from({ length: n }, (_, i) => [...new Set(parts.map((x) => x[i]))]);
    if (values.reduce((a, x) => a * x.length, 1) !== parts.length) return null;
    const names = String(p.variantLabel || "").split(/\s+and\s+|,\s*/i);
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    // what each choice adds to the cheapest combination (watercolor +$40, framed +$25)
    const low = Math.min(...p.variants.map((v) => v.price));
    const adds = values.map((vals, i) => Object.fromEntries(vals.map((val) =>
      [val, Math.min(...p.variants.filter((_, k) => parts[k][i] === val).map((v) => v.price)) - low])));
    // the included choice first, then the add-ons (Pen & ink only, then Add watercolor)
    values.forEach((vals, i) => vals.sort((a, b) => adds[i][a] - adds[i][b]));
    // how a choice reads on its button: the product's "choiceLabels" ("Add watercolor"), else the option name
    const labels = p.choiceLabels || {};
    const label = (val) => labels[val] || cap(val);
    // when prices simply add up (base + each add-on), the total can be shown as a sum
    const additive = p.variants.every((v, k) => v.price === low + parts[k].reduce((s, val, i) => s + adds[i][val], 0));
    return { parts, values, adds, label, additive, low, names: values.map((_, i) => cap(names.length === n ? names[i] : `Option ${i + 1}`)), cap };
  }

  // Before any choice: "$185 for a pen & ink portrait. Watercolor and a frame are optional add-ons."
  function priceIntro(p, axes) {
    const extras = axes.values.flatMap((vals, i) => vals.filter((x) => axes.adds[i][x] > 0).map((x) => axes.label(x).replace(/^add /i, "")));
    const list = extras.length > 1 ? `${extras.slice(0, -1).join(", ")} and ${extras[extras.length - 1]}` : extras.join("");
    return `${money(axes.low)} for a ${p.baseLabel || "base"}.${list ? ` ${list.charAt(0).toUpperCase() + list.slice(1)} ${extras.length > 1 ? "are optional add-ons" : "is an optional add-on"}.` : ""}`;
  }

  // `v` is null while option questions are still unanswered (no price to show yet).
  const buyLabel = (p, v) => p.soldOut ? (p.oneOfAKind ? "Sold · found a home" : "Sold out")
    : p.deposit ? `Add deposit to cart<span class="pay-amount">${v ? ` – ${money(dueToday(p, v))}` : ""}</span>` : "Add to cart";
  // One way of saying a deposit price everywhere: "$210", "$105 today, the rest when it's finished".
  const lowest = (p) => Math.min(...p.variants.map((v) => v.price));
  const todayNote = (p, v) => v ? `${money(dueToday(p, v))} today, the rest when it's finished`
    : `${Math.round(p.deposit * 100)}% today, the rest when it's finished`;
  const barPrice = (p, v, label) => p.deposit
    ? (v ? `${money(v.price)} · ${money(dueToday(p, v))} today` : `From ${money(lowest(p))} · ${Math.round(p.deposit * 100)}% today`)
    : `${money(v.price)}${label ? ` · ${label}` : ""}`;

  // Reasons to trust buying here: shipping, who handles payment, and who you're buying from.
  // (The Etsy shop is linked from the footer and About, not here, so it doesn't pull people away.)
  function trustLine() {
    return `<p class="trust">
      <span>Free US shipping</span>
      <span>Secure checkout with Stripe</span>
      <span>Sold and shipped by me</span>
    </p>`;
  }

  // More from the same section under a product, its own group first (Philly stickers, then the rest).
  function related(p) {
    const c = categoryOf(p.category);
    const list = inCategory(p.category).filter((x) => x.id !== p.id && !x.soldOut);
    if (list.length < 2) return "";
    const re = (c.groups || []).map((g) => new RegExp(g.match, "i"));
    const groupOf = (x) => re.findIndex((r) => r.test(x.name));
    const mine = groupOf(p);
    const picks = list.filter((x) => groupOf(x) === mine).concat(list.filter((x) => groupOf(x) !== mine)).slice(0, 4);
    return `<section class="related" aria-labelledby="related-title">
      <div class="section-head"><h2 id="related-title">More ${esc(c.title.toLowerCase())}</h2><p><a class="policy-link" href="#${esc(c.id)}">See all</a></p></div>
      <div class="grid">${picks.map(card).join("")}</div>
    </section>`;
  }

  function productPage(p) {
    const v0 = p.variants[0];
    const many = p.variants.length > 1;
    const axes = many ? optionAxes(p) : null;
    const samePrice = p.variants.every((v) => v.price === v0.price);
    const vStart = axes ? null : v0; // option questions start unanswered, so nothing looks pre-picked
    const cols = axes ? Math.max(...axes.values.map((x) => x.length)) : 1;
    const photos = (p.images || []);
    const solo = inCategory(p.category).length === 1;
    return `
      <div class="wrap">
        ${solo ? `<a class="back" href="#">← Everything</a>`
          : `<a class="back" href="#${esc(p.category)}">← All ${esc(categoryOf(p.category).title.toLowerCase())}</a>`}
        <div class="product">
          <div class="gallery">
            <div class="stage" id="stage">
              <div class="frame" id="main-pic">${picture(p, 0)}</div>
            </div>
            ${photos.length > 1 ? `<div class="thumb-row">
              <button type="button" class="pic-arrow" id="pic-prev" aria-label="Previous photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <div class="thumbs">${photos.map((src, i) =>
                `<button type="button" data-pic="${i}" aria-pressed="${i === 0}" aria-label="Photo ${i + 1} of ${photos.length}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>
              <button type="button" class="pic-arrow" id="pic-next" aria-label="Next photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </div>` : ""}
          </div>
          <div class="info">
            <h1>${esc(p.name)}</h1>
            <div class="price-line">
              <span class="price" id="price">${vStart ? money(v0.price) : `From ${money(lowest(p))}`}</span>
              ${p.deposit ? `<span class="deposit-note" id="deposit-note">${todayNote(p, vStart)}</span>` : ""}
            </div>
            ${axes && axes.additive ? `<p class="price-math" id="price-math">${esc(priceIntro(p, axes))}</p>` : ""}
            ${p.size ? `<div class="size">Size: <b>${esc(p.size)}</b></div>` : ""}
            ${p.oneOfAKind && !p.soldOut ? `<div class="size">One of a kind: <b>only 1 available</b></div>` : ""}
            <div class="buy" id="buy" style="--cols:${cols}">
              ${axes ? axes.values.map((vals, i) => `<fieldset class="choice" id="axis-${i}">
                <legend>${esc(axes.names[i])}<span class="choice-need"> · choose one</span></legend>
                <div class="choices">${vals.map((val) => `<label><input type="radio" name="axis-${i}" value="${esc(val)}"><span class="opt"><svg class="tick" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9.5l3.6 3.4 7.4-8"/></svg><span class="opt-text">${esc(axes.label(val))}${axes.adds[i][val] > 0 ? ` <span class="opt-add">+${money(axes.adds[i][val])}</span>` : ""}</span></span></label>`).join("")}</div>
              </fieldset>`).join("")
              : many ? `<div class="field">
                <label for="variant">${esc(p.variantLabel || "Option")}</label>
                <span class="select"><select id="variant">${p.variants.map((v, i) => `<option value="${i}">${esc(optName(v.name))}${samePrice ? "" : ` — ${money(v.price)}`}</option>`).join("")}</select></span>
              </div>` : ""}
              <div class="buy-row">
                ${singleOnly(p) ? "" : `<div class="qty" role="group" aria-label="Quantity">
                  <button type="button" id="qty-minus" aria-label="One fewer">−</button>
                  <output id="qty" aria-live="polite">1</output>
                  <button type="button" id="qty-plus" aria-label="One more">+</button>
                </div>`}
                <button class="btn" id="add" type="button" ${p.soldOut ? "disabled" : ""}>${buyLabel(p, vStart)}</button>
              </div>
              ${p.deposit && !p.soldOut ? `<p class="buy-note">More than one house? Add each one to your cart, or ${CONFIG.contactEmail ? `<a class="email-link" href="mailto:${esc(CONFIG.contactEmail)}">email me</a>` : "email me"} about a multi-house discount.</p>` : ""}
            </div>
            ${p.steps && p.steps.length ? `<section class="steps" aria-labelledby="how-it-works">
              <h2 id="how-it-works">How it works</h2>
              <ol class="steps-list">${p.steps.map((t) => `<li><span>${escMail(t)}</span></li>`).join("")}</ol>
              ${p.deposit ? `<p class="steps-note">${CONFIG.contactEmail ? `Photos of your home go to ${emailLink(".")} ` : ""}At checkout there's a box for your deadline or any notes. <a class="policy-link" href="#policies-commissions">Full commission policy</a></p>` : ""}
            </section>` : ""}
            ${p.soldOut ? "" : trustLine()}
            <div class="prose">
              ${describe(relabel(shownDescription(p)), escMail, p.collapse)}
              ${p.details && p.details.length ? `<h2>Details</h2><ul>${p.details.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
              ${p.policy ? `<p class="fineprint">${escMail(p.policy)}</p>` : ""}
              ${p.disclaimer ? `<p class="fineprint">${esc(p.disclaimer)}</p>` : ""}
            </div>
          </div>
        </div>
        ${related(p)}
        ${p.soldOut ? "" : `<div class="buybar" id="buybar" hidden>
          <div class="buybar-text"><span class="buybar-name">${esc(p.name)}</span><span class="buybar-price" id="buybar-price">${barPrice(p, vStart, "")}</span></div>
          <button class="btn" type="button" id="buybar-btn">${many ? `Choose ${esc((p.variantLabel || "options").toLowerCase())}` : p.deposit ? buyLabel(p, v0) : "Add to cart"}</button>
        </div>`}
      </div>`;
  }

  let buyWatch = null; // shows the phone buy bar while the real buy button is off screen
  function wireProduct(p) {
    const sel = document.getElementById("variant");
    const axes = p.variants.length > 1 ? optionAxes(p) : null;
    let qty = 1, vi = axes ? null : 0; // null until every option question is answered
    const current = () => p.variants[vi];
    const update = () => {
      const v = current();
      document.getElementById("price").textContent = money(v.price);
      const dn = document.getElementById("deposit-note");
      if (dn) dn.textContent = todayNote(p, v);
      document.querySelectorAll(".pay-amount").forEach((el) => el.textContent = (p.deposit ? " – " : "") + money(dueToday(p, v) * qty));
      const bp = document.getElementById("buybar-price");
      if (bp) bp.textContent = barPrice(p, v, "");
      const bb = document.getElementById("buybar-btn");
      if (bb && axes) bb.textContent = "Check out"; // every question answered: the bar can finish the job
      // the total as a sum: "$185 portrait + $40 watercolor + $25 frame"
      const pm = document.getElementById("price-math");
      if (pm && axes && axes.additive) {
        const extras = axes.parts[vi].map((val, i) => axes.adds[i][val] > 0 ? ` + ${money(axes.adds[i][val])} ${axes.label(val).replace(/^add (a |an )?/i, "")}` : "").join("");
        pm.textContent = extras ? `${money(axes.low)} ${p.baseLabel || "base"}${extras} = ${money(v.price)}`
          : `${money(axes.low)} ${p.baseLabel || "base"}, no add-ons`;
      }
    };
    if (sel) sel.addEventListener("change", () => { vi = Number(sel.value); update(); });
    const unanswered = () => axes ? axes.values.map((_, i) => i).filter((i) => !document.querySelector(`input[name="axis-${i}"]:checked`)) : [];
    // Option buttons: one per row as soon as any label would otherwise wrap (depends on the
    // column's width, not the screen's, so it also covers the narrow two-column layout).
    const buyBox = document.getElementById("buy");
    const fit = () => {
      if (!axes) return;
      buyBox.classList.remove("stacked");
      // room for the label plus the check's side padding on both sides (so the label stays centred)
      const tight = [...buyBox.querySelectorAll(".choices .opt")].some((o) => {
        const pad = parseFloat(getComputedStyle(o).paddingLeft) * 2;
        return o.querySelector(".opt-text").offsetWidth + pad > o.clientWidth;
      });
      buyBox.classList.toggle("stacked", tight);
    };
    if (axes && "ResizeObserver" in window) new ResizeObserver(fit).observe(buyBox);
    if (axes) document.fonts?.ready.then(fit);
    fit();
    if (axes) document.getElementById("buy").addEventListener("change", (e) => {
      if (!e.target.matches("input[type=radio]")) return;
      e.target.closest(".choice").classList.remove("needs");
      e.target.closest(".choice").querySelectorAll("input").forEach((x) => x.removeAttribute("aria-invalid"));
      if (unanswered().length) return;
      const picked = axes.values.map((_, i) => document.querySelector(`input[name="axis-${i}"]:checked`).value);
      const i = axes.parts.findIndex((x) => x.every((val, k) => val === picked[k]));
      if (i !== -1) { vi = i; update(); }
    });
    const out = document.getElementById("qty");
    const setQty = (n) => { qty = Math.max(1, Math.min(50, n)); if (out) out.textContent = qty; update(); };
    document.getElementById("qty-minus")?.addEventListener("click", () => setQty(qty - 1));
    document.getElementById("qty-plus")?.addEventListener("click", () => setQty(qty + 1));
    // Photos: thumbnails, arrows (desktop), swipe (phones) and the keyboard's left/right keys.
    const total = (p.images || []).length;
    let shown = 0;
    const show = (i) => {
      if (total < 2) return;
      shown = (i + total) % total;
      document.getElementById("main-pic").innerHTML = picture(p, shown);
      const img = document.querySelector("#main-pic img");
      if (img) img.complete ? pin() : img.addEventListener("load", pin, { once: true });
      document.querySelectorAll("[data-pic]").forEach((x) => {
        const on = Number(x.dataset.pic) === shown;
        x.setAttribute("aria-pressed", on);
        if (on) x.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      });
    };
    document.querySelectorAll("[data-pic]").forEach((b) => b.addEventListener("click", () => show(Number(b.dataset.pic))));
    document.getElementById("pic-prev")?.addEventListener("click", () => show(shown - 1));
    document.getElementById("pic-next")?.addEventListener("click", () => show(shown + 1));
    const stage = document.getElementById("stage");
    let x0 = null, y0 = null;
    stage.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    stage.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) show(shown + (dx < 0 ? 1 : -1));
      x0 = y0 = null;
    }, { passive: true });
    gallery = total > 1 ? { next: () => show(shown + 1), prev: () => show(shown - 1) } : null;
    // Computers: keep the photos in view while reading, but only when they fit on the screen.
    const gal = document.querySelector(".gallery");
    const pin = () => gal.classList.toggle("pinned", gal.offsetHeight < innerHeight - document.querySelector(".header").offsetHeight - 40);
    gal.querySelectorAll("img").forEach((img) => img.complete || img.addEventListener("load", pin, { once: true }));
    pin(); onresize = pin;
    const buy = () => {
      // Unanswered questions: point to them instead of guessing
      const missing = unanswered();
      if (missing.length) {
        missing.forEach((i) => {
          const f = document.getElementById(`axis-${i}`);
          f.classList.add("needs");
          f.querySelectorAll("input").forEach((x) => x.setAttribute("aria-invalid", "true"));
        });
        document.querySelector(`input[name="axis-${missing[0]}"]`).focus();
        return;
      }
      const result = addToCart(p.id, vi, qty);
      // the open cart is the confirmation; say so when a one-of-a-kind's earlier choice was swapped out
      openCart(result === "replaced" ? { text: `There's only one ${p.name}, so this choice replaced the one already in your cart.` } : null);
    };
    document.getElementById("add").addEventListener("click", buy);
    // Phone buy bar: adds straight away, or takes you to the options first when there are some.
    const bar = document.getElementById("buybar");
    if (bar && "IntersectionObserver" in window) {
      document.getElementById("buybar-btn").addEventListener("click", () => {
        // All answered: add it, then straight to payment, unless other things are in the cart (show them first)
        if (axes && !unanswered().length) { buy(); return cart.length > 1 ? null : checkout(); }
        if (p.variants.length < 2) return buy(); // nothing to choose: just add it
        // options to choose (a menu or questions): take them there first
        const target = document.getElementById("buy");
        target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
        target.querySelector("input[type=radio]")?.focus({ preventScroll: true });
      });
      // Hidden while the real buy button or the page footer is on screen, so neither gets covered.
      const onScreen = new Set();
      buyWatch = new IntersectionObserver((entries) => {
        entries.forEach((e) => e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target));
        bar.hidden = onScreen.size > 0;
      });
      buyWatch.observe(document.getElementById("add"));
      buyWatch.observe(document.getElementById("footer"));
    }
  }

  // ---------- shop policies (text lives in data/policies.html) ----------
  let policiesHtml = null;
  async function showPolicies(section) {
    app.innerHTML = `<div class="wrap"><article class="policies" id="policies-body"><p class="fineprint">Loading…</p></article></div>`;
    try {
      if (policiesHtml === null) policiesHtml = await (await fetch("data/policies.html", { cache: "no-cache" })).text();
      document.getElementById("policies-body").innerHTML = policiesHtml;
      document.querySelectorAll("#policies-body a[href^='mailto:']").forEach((a) => a.classList.add("email-link"));
    } catch (e) {
      document.getElementById("policies-body").innerHTML = `<p class="msg error">The policies couldn't load. Please refresh the page.</p>`;
    }
    const target = section && document.getElementById(section);
    if (target) target.scrollIntoView({ block: "start" });
  }

  // ---------- contact (one question at a time, like the portfolio's contact page) ----------
  // Messages are sent through Web3Forms when config.js has a "contactFormKey"; until then, Send
  // opens the visitor's email app with everything filled in.
  const CONTACT = {
    topics: [
      { v: "order", label: "A question about an order", sub: "Shipping, a missing package, a change" },
      { v: "portrait", label: "A house portrait", sub: "A deadline, more than one house, photos" },
      { v: "wholesale", label: "Wholesale", sub: "Carrying my stickers in your shop" },
      { v: "other", label: "Something else", sub: "Or just hello" }
    ],
    steps: {
      portraitTopic: { type: "choice", key: "about", label: "About", q: "What about your portrait?",
        opts: ["A deadline or gift date", "More than one house", "Sending photos of the home", "Something else"].map((v) => ({ v, label: v }))
          // the form can't carry photos (Web3Forms' free plan is text only), so this one points to email instead
          .map((o) => o.v.startsWith("Sending photos") ? { ...o, photos: true } : o) },
      order: { type: "line", key: "order", label: "Order", q: "Which order is it?", field: "Order number or email you ordered with",
        hint: "From your Stripe receipt. Optional, but it helps me find it fast.", optional: true },
      message: { type: "message", key: "message", label: "Message", q: "What would you like to say?" },
      who: { type: "who", label: "Your details", q: "Where can I reach you?", hint: "Only used to reply to you." }
    },
    routes: { order: ["order", "message", "who"], portrait: ["portraitTopic", "message", "who"], wholesale: ["message", "who"], other: ["message", "who"] },
    hints: {
      order: "What happened, and what would you like me to do?",
      portrait: "A gift date, how many houses, anything that matters to you.",
      wholesale: "Your shop's name and where it is, and what you have in mind.",
      other: "A line or two is plenty."
    }
  };
  const ARROW = `<svg class="go" viewBox="0 0 22 12" aria-hidden="true"><path d="M1 6h18M14 1.5 19 6l-5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function contactPage() {
    return `<div class="wrap"><section class="contact" aria-labelledby="contact-title">
      <h1 id="contact-title">Contact</h1>
      <div class="contact-prog" id="c-prog" hidden><div class="bar"><i></i></div><span id="c-count"></span></div>
      <div id="c-stage" aria-live="polite"></div>
      <div class="contact-foot" id="c-foot" hidden><button type="button" class="link-btn" id="c-back">← Back</button></div>
      ${CONFIG.contactEmail ? `<p class="fineprint contact-direct">Prefer email? Write to ${emailLink(".")}</p>` : ""}
    </section></div>`;
  }

  function wireContact() {
    const S = CONTACT, A = {}, stage = document.getElementById("c-stage");
    let idx = 0, toReview = false, onPhotos = false;
    const topicLabel = () => (S.topics.find((t) => t.v === A.topic) || {}).label || "";
    const path = () => ["topic"].concat(S.routes[A.topic] || []);
    const step = (k) => k === "topic" ? { type: "choice", key: "topic", label: "Topic", q: "What's it about?", opts: S.topics } : S.steps[k];
    const rows = () => path().flatMap((k) => {
      const s = step(k);
      if (s.type === "who") return [["Name", A.name, k], ["Email", A.email, k]];
      return [[s.label, k === "topic" ? topicLabel() : A[s.key], k]];
    });
    const text = () => rows().filter((r) => r[1]).map((r) => `${r[0]}: ${r[1]}`).join("\n");
    const subject = () => `Shop: ${topicLabel() || "Hello"}${A.name ? ` · ${A.name}` : ""}`;
    const mailto = () => `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent(subject())}&body=${encodeURIComponent(text())}`;
    const heading = (q) => `<h2 id="c-q" tabindex="-1">${esc(q)}</h2>`;

    function render(focus = true) {
      onPhotos = false;
      const p = path(), prog = document.getElementById("c-prog"), foot = document.getElementById("c-foot");
      const kind = idx === -1 ? "thanks" : idx >= p.length ? "review" : step(p[idx]).type;
      prog.hidden = kind === "thanks" || !A.topic; foot.hidden = kind === "thanks" || idx === 0;
      const pct = kind === "review" ? 100 : Math.round(idx / p.length * 100);
      prog.querySelector("i").style.width = (A.topic ? pct : 0) + "%";
      document.getElementById("c-count").textContent = kind === "review" ? "Review" : A.topic ? `Step ${idx + 1} of ${p.length}` : "";
      stage.innerHTML = kind === "choice" ? choice(step(p[idx])) : kind === "line" || kind === "message" ? entry(step(p[idx]), kind)
        : kind === "who" ? who(step(p[idx])) : kind === "review" ? review() : thanks();
      wire(kind, p[idx]);
      if (focus) document.getElementById("c-q")?.focus();
    }
    const next = () => { idx = toReview ? path().length : idx + 1; toReview = false; render(); };

    function choice(s) {
      return `<div class="c-step" role="group" aria-labelledby="c-q">${heading(s.q)}
        <div class="c-opts">${s.opts.map((o, i) => `<button type="button" class="c-opt" data-i="${i}" aria-pressed="${A[s.key] === o.v}">
          <span class="t">${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</span>${ARROW}</button>`).join("")}</div></div>`;
    }
    function entry(s, kind) {
      const long = kind === "message";
      const hint = long ? S.hints[A.topic] : s.hint;
      return `<form class="c-step" novalidate aria-labelledby="c-q">${heading(s.q)}${hint ? `<p class="c-hint">${esc(hint)}</p>` : ""}
        <div class="field"><label for="c-in">${esc(long ? "Message" : s.field)}${s.optional ? " (optional)" : ""}</label>
        ${long ? `<textarea id="c-in" rows="6" maxlength="3000">${esc(A[s.key] || "")}</textarea>` : `<input id="c-in" type="text" maxlength="200" value="${esc(A[s.key] || "")}">`}</div>
        <p class="c-err" id="c-err" role="alert"></p>
        <button class="btn" type="submit">${s.optional && !A[s.key] ? "Skip" : "Continue"}</button></form>`;
    }
    function who(s) {
      return `<form class="c-step" novalidate aria-labelledby="c-q">${heading(s.q)}<p class="c-hint">${esc(s.hint)}</p>
        <div class="field"><label for="c-name">Name</label><input id="c-name" type="text" autocomplete="name" maxlength="120" value="${esc(A.name || "")}"></div>
        <div class="field"><label for="c-email">Email</label><input id="c-email" type="email" autocomplete="email" maxlength="200" value="${esc(A.email || "")}"></div>
        <p class="c-err" id="c-err" role="alert"></p>
        <button class="btn" type="submit">Review message</button></form>`;
    }
    function review() {
      return `<div class="c-step" role="group" aria-labelledby="c-q">${heading("Ready to send?")}<p class="c-hint">Here's what I'll get. You can change anything.</p>
        <dl class="c-sum">${rows().map((r, i) => `<div><dt>${esc(r[0])}</dt><dd class="${r[1] ? "" : "none"}">${esc(r[1] || "Skipped")}</dd>
          ${r[0] === "Email" ? "<span></span>" : `<button type="button" class="link-btn" data-change="${r[2]}" aria-label="Change ${esc(r[0].toLowerCase())}">Change</button>`}</div>`).join("")}</dl>
        <label class="c-trap" aria-hidden="true">Leave this empty <input type="checkbox" id="c-bot" tabindex="-1"></label>
        <p class="c-err" id="c-err" role="alert"></p>
        <button class="btn" type="button" id="c-send">Send message</button>
        ${CONFIG.contactFormKey ? "" : `<p class="fineprint">This opens your email app with everything filled in.</p>`}</div>`;
    }
    function thanks() {
      const first = (A.name || "").split(" ")[0];
      return `<div class="c-step c-thanks" role="group" aria-labelledby="c-q">${heading(`Thank you${first ? `, ${first}` : ""}!`)}
        <p class="c-hint">${CONFIG.contactFormKey ? `Your message is on its way. I'll reply to ${esc(A.email)}.`
          : `Your email app should have opened with the message ready to send. If nothing opened, email ${emailLink(".")}`}</p>
        <a class="btn btn-link" href="#">Back to the shop</a></div>`;
    }

    // Photos can't go through the form: say so, and make emailing them easy (with or without a mail app).
    function photos() {
      const to = CONFIG.contactEmail;
      const subj = encodeURIComponent("House portrait photos");
      onPhotos = true;
      document.getElementById("c-foot").hidden = false;
      document.getElementById("c-prog").hidden = true; // a dead end, not a step
      stage.innerHTML = `<div class="c-step" role="group" aria-labelledby="c-q">${heading("Photos go by email")}
        <p class="c-hint">This form can't take photos, so please email them to <b>${esc(to)}</b>. Send at least one clear, straight-on photo of the home, and include the name you ordered under.</p>
        <div class="c-acts">
          <a class="btn btn-link" href="mailto:${esc(to)}?subject=${subj}">Email your photos</a>
          <button type="button" class="btn btn-secondary" id="c-copy">Copy email address</button>
        </div>
        <p class="fineprint">No email app on this computer? Copy the address into Gmail, Outlook or whatever you use.</p></div>`;
      const copy = document.getElementById("c-copy");
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(to); copy.textContent = "Copied"; }
        catch { copy.textContent = to; } // clipboard blocked: show it to copy by hand
        setTimeout(() => { if (copy.textContent === "Copied") copy.textContent = "Copy email address"; }, 1800);
      });
      document.getElementById("c-q").focus();
    }

    function wire(kind, k) {
      if (kind === "choice") {
        const s = step(k);
        stage.querySelectorAll(".c-opt").forEach((b) => b.addEventListener("click", () => {
          const o = s.opts[b.dataset.i];
          if (s.key === "topic" && A.topic !== o.v) { delete A.about; delete A.order; toReview = false; }
          A[s.key] = o.v;
          stage.querySelectorAll(".c-opt").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          setTimeout(o.photos ? photos : next, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200);
        }));
      }
      const form = stage.querySelector("form"), err = document.getElementById("c-err");
      const fail = (input, msg) => { err.textContent = msg; input.setAttribute("aria-invalid", "true"); input.focus(); };
      if (kind === "line" || kind === "message") {
        const s = step(k), input = document.getElementById("c-in"), btn = form.querySelector(".btn");
        if (s.optional) input.addEventListener("input", () => { btn.textContent = input.value.trim() ? "Continue" : "Skip"; });
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          A[s.key] = input.value.trim();
          if (!s.optional && !A[s.key]) return fail(input, "Please write a message first.");
          next();
        });
      }
      if (kind === "who") form.addEventListener("submit", (e) => {
        e.preventDefault();
        const n = document.getElementById("c-name"), m = document.getElementById("c-email");
        [n, m].forEach((x) => x.removeAttribute("aria-invalid"));
        if (!n.value.trim()) return fail(n, "Please add your name.");
        if (!m.value.trim() || !m.checkValidity()) return fail(m, "That email address looks incomplete.");
        A.name = n.value.trim(); A.email = m.value.trim(); next();
      });
      if (kind === "review") {
        stage.querySelectorAll("[data-change]").forEach((b) => b.addEventListener("click", () => {
          toReview = b.dataset.change !== "topic"; idx = path().indexOf(b.dataset.change); render();
        }));
        const send = document.getElementById("c-send");
        send.addEventListener("click", async () => {
          if (!CONFIG.contactFormKey) { location.href = mailto(); idx = -1; return render(); }
          send.disabled = true; send.textContent = "Sending…"; err.textContent = "";
          try {
            const res = await fetch("https://api.web3forms.com/submit", {
              method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ access_key: CONFIG.contactFormKey, subject: subject(), from_name: "ed.mcveigh shop",
                name: A.name, email: A.email, topic: topicLabel(), about: A.about || "", order: A.order || "", message: A.message || "",
                botcheck: document.getElementById("c-bot").checked })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || res.status);
            idx = -1; render();
          } catch (e2) {
            console.error("Contact form failed", e2);
            send.disabled = false; send.textContent = "Try again";
            err.innerHTML = `That didn't send, but your message is still here. Try again, or email it to ${emailLink(".")}`;
          }
        });
      }
    }
    // Back from the photos note returns to the portrait question it came from
    document.getElementById("c-back").addEventListener("click", () => { toReview = false; if (onPhotos) return render(); if (idx > 0) { idx--; render(); } });
    render(false);
  }

  // ---------- about (text lives in data/about.html) ----------
  let aboutHtml = null;
  async function showAbout() {
    app.innerHTML = `<div class="wrap"><article class="policies about" id="about-body"><p class="fineprint">Loading…</p></article></div>`;
    try {
      if (aboutHtml === null) aboutHtml = await (await fetch("data/about.html", { cache: "no-cache" })).text();
      document.getElementById("about-body").innerHTML = aboutHtml;
      document.querySelectorAll("#about-body a[href^='mailto:']").forEach((a) => a.classList.add("email-link"));
    } catch (e) {
      document.getElementById("about-body").innerHTML = `<p class="msg error">This page couldn't load. Please refresh.</p>`;
    }
  }

  // The cart only empties after a real checkout: Stripe sends people back with ?checkout=done,
  // and this tab remembers what was in the order (opening #thanks by hand changes nothing).
  let celebrate = false;
  function thanksPage() {
    let order = null;
    try { order = JSON.parse(sessionStorage.getItem(CHECKOUT_KEY)); sessionStorage.removeItem(CHECKOUT_KEY); } catch { /* not saved */ }
    const paid = Boolean(order) || /[?&]checkout=done\b/.test(location.search);
    if (paid) {
      celebrate = true; // the "e." spins once when the page appears (route() plays it)
      cart = []; saveCart();
      if (location.search) history.replaceState(null, "", location.pathname + location.hash);
    }
    const portraits = order ? (order.portraits ?? (order.portrait ? 1 : 0)) : 1; // unknown order: show the portrait step too
    const homes = portraits > 1 ? "each home" : "the home";
    const mailto = CONFIG.contactEmail ? `mailto:${esc(CONFIG.contactEmail)}?subject=${encodeURIComponent("House portrait photo" + (portraits > 1 ? "s" : ""))}` : "";
    const recap = order && order.recap && order.recap.length ? `<div class="recap">
        <h2>Your order</h2>
        <ul>${order.recap.map((l) => `<li><span>${esc(l.name)}${l.qty > 1 ? ` × ${l.qty}` : ""}${l.option ? `<small>${esc(l.option)}${l.deposit ? " · 50% deposit" : ""}</small>` : ""}</span><b>${money(l.today)}</b></li>`).join("")}</ul>
      </div>` : "";
    return `<div class="wrap"><section class="thanks">
      <h1>Thank you!</h1>
      <p class="lead">${paid ? `Your order is in. Stripe is emailing you a receipt${order && !order.shipsNow ? "." : ", and I'll ship your order soon."}`
        : "If you've just checked out, Stripe is emailing you a receipt."}</p>
      ${recap}
      ${portraits ? `<div class="note">
        <h2>${order ? `Next: email me a photo of ${homes}` : "Ordered a house portrait?"}</h2>
        <p>Send at least one clear, straight-on photo of ${homes}${CONFIG.contactEmail ? ` to ${emailLink(",")}` : ","} plus any details that matter to you. I'll send a pencil sketch to approve before I start inking. Turnaround is usually 2 to 4 weeks from sketch approval.</p>
        ${mailto ? `<a class="btn btn-link" href="${mailto}">Email your photo${portraits > 1 ? "s" : ""}</a>` : ""}
      </div>` : ""}
      <a class="btn btn-link ${portraits ? "btn-secondary" : ""}" href="#">Keep shopping</a>
    </section></div>`;
  }

  // ---------- cart ----------
  // Returns "replaced" when a one-of-a-kind's earlier choice was swapped out.
  function addToCart(id, variant, qty) {
    const p = byId(id);
    if (p.oneOfAKind) {
      // Only one exists, so a second framing choice replaces the first instead of adding another.
      const had = cart.find((l) => l.id === id);
      cart = cart.filter((l) => l.id !== id);
      cart.push({ id, variant, qty: 1 });
      saveCart();
      return had && had.variant !== variant ? "replaced" : "";
    }
    if (p.deposit) {
      // Each portrait is a different house: always its own line (House 1, House 2…), one deposit each.
      cart.push({ id, variant, qty: 1 });
      saveCart();
      return "";
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

  // `message` is a note or error to show; `focus` is a selector for what gets keyboard focus
  // after the cart redraws (so changing a quantity doesn't throw you back to the top).
  let cartOpener = null, removed = null;
  function openCart(message, focus) {
    cart = validLines();
    const root = document.getElementById("drawer-root");
    if (!root.querySelector(".drawer")) cartOpener = document.activeElement;
    let total = 0, later = 0;
    const houses = (id) => cart.filter((l) => l.id === id).length;
    const rows = cart.map((l, i) => {
      const p = byId(l.id), v = p.variants[l.variant];
      // portraits: number the houses when there's more than one
      const house = p.deposit && houses(p.id) > 1 ? `House ${cart.slice(0, i + 1).filter((x) => x.id === p.id).length} · ` : "";
      const today = dueToday(p, v) * l.qty;
      total += today; later += (v.price * l.qty) - today;
      return `<div class="line">
        ${picture(p)}
        <div>
          <a class="line-name" href="#${esc(p.id)}" data-close>${esc(p.name)}</a>
          <div class="line-variant">${esc(house)}${esc(p.variants.length > 1 ? optName(v.name) : (p.size || v.name))}${p.deposit ? " · 50% deposit" : ""}${p.oneOfAKind ? " · one of a kind" : ""}</div>
          ${singleOnly(p) ? "" : `<div class="line-actions"><div class="qty" role="group" aria-label="Quantity of ${esc(p.name)}">
              <button type="button" data-dec="${i}" aria-label="One fewer">−</button><output>${l.qty}</output><button type="button" data-inc="${i}" aria-label="One more">+</button>
            </div></div>`}
        </div>
        <div class="line-end">
          <div class="line-price">${money(today)}</div>
          <button type="button" class="trash" data-remove="${i}" aria-label="Remove ${esc(p.name)}" title="Remove"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button>
        </div>
      </div>`;
    }).join("");
    root.innerHTML = `
      <div class="scrim" id="scrim"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div class="drawer-head"><h2 id="cart-title">Your cart</h2><button class="icon-btn" id="close-cart" type="button" aria-label="Close cart">×</button></div>
        <div class="lines">${removed ? `<div class="msg undo" role="status">Removed ${esc(byId(removed.line.id).name)}. <button type="button" class="link-btn" id="undo">Undo</button></div>` : ""}${rows || `<div class="empty"><p>Nothing in here yet.${byId("cheesesteak") && !byId("cheesesteak").soldOut ? ` The <a href="#cheesesteak" data-close>cheesesteak sticker</a> is a good place to start.` : ""}</p><a class="btn btn-link" href="#" id="cart-browse">Browse the shop</a></div>`}</div>
        ${cart.length ? `<div class="drawer-foot">
          <div class="sum-row"><span>Shipping</span><span class="free">Free</span></div>
          <div class="sum-row total"><span>Due today</span><span>${money(total)}</span></div>
          ${later > 0 ? `<div class="fineprint">Plus ${money(later)} for the portrait balance, invoiced when it's finished.</div>` : ""}
          ${message ? `<div class="msg ${message.error ? "error" : ""}" role="alert">${esc(message.text)}</div>` : ""}
          <button class="btn" id="checkout" type="button">Check out</button>
          <button class="btn btn-secondary" id="keep-shopping" type="button">Continue shopping</button>
          <div class="fineprint">You'll pay on Stripe's secure checkout page, where any sales tax is added. Cards, Apple Pay and Google Pay accepted. <a href="#policies" data-close>Shipping and returns</a></div>
        </div>` : ""}
      </aside>`;
    document.getElementById("scrim").onclick = closeCart;
    document.getElementById("close-cart").onclick = closeCart;
    const browse = document.getElementById("cart-browse");
    if (browse) browse.onclick = () => closeCart(false);
    root.querySelectorAll("[data-close]").forEach((a) => a.onclick = () => closeCart(false));
    const redraw = (sel) => { removed = null; saveCart(); openCart(null, sel); };
    root.querySelectorAll("[data-inc]").forEach((b) => b.onclick = () => { const i = b.dataset.inc; cart[i].qty = Math.min(50, cart[i].qty + 1); redraw(`[data-inc="${i}"]`); });
    root.querySelectorAll("[data-dec]").forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.dec), l = cart[i];
      if (l.qty > 1) { l.qty--; redraw(`[data-dec="${i}"]`); }
      else { removed = { line: cart.splice(i, 1)[0], index: i }; saveCart(); openCart(null, "#undo"); }
    });
    root.querySelectorAll("[data-remove]").forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.remove);
      removed = { line: cart.splice(i, 1)[0], index: i }; saveCart(); openCart(null, "#undo");
    });
    const undo = document.getElementById("undo");
    if (undo) undo.onclick = () => {
      cart.splice(Math.min(removed.index, cart.length), 0, removed.line);
      redraw(`[data-remove="${Math.min(removed.index, cart.length - 1)}"]`);
    };
    document.getElementById("checkout")?.addEventListener("click", checkout);
    const keep = document.getElementById("keep-shopping");
    if (keep) keep.onclick = () => closeCart();
    (focus && root.querySelector(focus) || document.getElementById("close-cart")).focus();
    document.addEventListener("keydown", drawerKeys);
  }
  // `restore` returns focus to whatever opened the cart (not when following a link out of it).
  function closeCart(restore = true) {
    document.getElementById("drawer-root").innerHTML = "";
    document.removeEventListener("keydown", drawerKeys);
    removed = null;
    if (restore) (cartOpener && document.contains(cartOpener) ? cartOpener : document.getElementById("open-cart")).focus();
    cartOpener = null;
  }
  // Escape closes the cart; Tab stays inside it while it's open.
  function drawerKeys(e) {
    if (e.key === "Escape") return closeCart();
    if (e.key !== "Tab") return;
    const items = [...document.querySelectorAll("#drawer-root .drawer :is(a[href], button:not(:disabled))")];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function checkout() {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      openCart({ text: "Checkout only runs on the real site (Cloudflare runs it). On shop.edmcveigh.com or your pages.dev address, this button opens Stripe's checkout page." });
      return;
    }
    if (window.SHOP_DEMO) {
      openCart({ text: "This is a preview, so checkout is switched off. On your live site, this button opens Stripe's checkout page with everything in the cart." });
      return;
    }
    startCheckout(cart.map(({ id, variant, qty }) => ({ id, variant, qty })), document.getElementById("checkout"), null);
  }
  // Sends items to Stripe's checkout page. `msg` shows errors (or null to show them in the cart).
  async function startCheckout(items, btn, msg) {
    const label = btn.innerHTML;
    btn.disabled = true; btn.textContent = "Opening checkout…";
    if (msg) msg.hidden = true;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      let data = {};
      try { data = await res.json(); } catch { /* an error page instead of an answer */ }
      if (!res.ok || !data.url) throw Object.assign(new Error(data.error || ""), { shown: Boolean(data.error) });
      // Remembered for the thank-you page, which empties the cart and tailors its note.
      const lines = items.map((l) => byId(l.id)).filter(Boolean);
      const recap = items.map((l) => { const p = byId(l.id); const v = p && p.variants[l.variant];
        return p && v ? { name: p.name, option: p.variants.length > 1 ? optName(v.name) : "", qty: l.qty, today: dueToday(p, v) * l.qty, deposit: Boolean(p.deposit) } : null; }).filter(Boolean);
      try { sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({ portraits: lines.filter((p) => p.deposit).length, shipsNow: lines.some((p) => !p.deposit), recap })); } catch { /* not saved */ }
      window.location.href = data.url; // Stripe's hosted checkout page
    } catch (err) {
      if (!err.shown) console.error("Checkout failed", err);
      const reason = err.shown ? err.message : "Checkout didn't open.";
      const text = `${reason} Nothing was charged. Please try again, or email me if it keeps happening.`;
      if (msg) { btn.disabled = false; btn.innerHTML = label; msg.textContent = text; msg.hidden = false; }
      else openCart({ error: true, text });
    }
  }

  // ---------- router ----------
  function route() {
    gallery = null;
    if (buyWatch) { buyWatch.disconnect(); buyWatch = null; }
    onresize = null;
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
    } else if (hash === "contact") {
      app.innerHTML = contactPage(); renderChrome("contact");
      document.title = "Contact · ed.mcveigh shop";
      wireContact();
    } else if (hash === "about") {
      renderChrome("about");
      document.title = "About · ed.mcveigh shop";
      showAbout();
      renderCartCount();
      window.scrollTo(0, 0);
      return;
    } else if (hash === "thanks") {
      app.innerHTML = thanksPage(); renderChrome("");
      if (celebrate) { celebrate = false; setTimeout(() => window.edmLogoSpin && window.edmLogoSpin(), 450); }
      document.title = "Thank you · ed.mcveigh shop";
    } else {
      const filter = CATEGORIES.some((c) => c.id === hash) ? hash : "";
      const only = filter && inCategory(filter);
      if (only && only.length === 1) { location.replace("#" + only[0].id); return; }
      app.innerHTML = homePage(filter); renderChrome(filter); wireJumps();
      document.title = filter ? `${categoryOf(filter).title} · ed.mcveigh shop` : "ed.mcveigh shop";
      if (hash === "cart") setTimeout(openCart);
    }
    renderCartCount();
    if (!document.documentElement.classList.contains("intro")) window.scrollTo(0, 0);
  }

  async function start() {
    try {
      const data = window.SHOP_PRODUCTS || await (await fetch("data/products.json", { cache: "no-cache" })).json();
      PRODUCTS = data.products || [];
      LABELS = data.optionLabels || {};
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
// It also drops the "Not affiliated with…" paragraph when the product's disclaimer already says it
// in the fine print, so it shows once.
function shownDescription(p) {
  let desc = p.description || [];
  const squash = (t) => String(t).toLowerCase().replace(/[^a-z]+/g, " ").trim();
  if (p.disclaimer) desc = desc.filter((t) => !/^not affiliated with\b/i.test(t.trim()) && squash(t) !== squash(p.disclaimer));
  const detailsSayIt = (p.details || []).some((d) => /no ai/i.test(d));
  if (!detailsSayIt) return desc;
  return desc.filter((t) => !/^(every sticker is |all of my stickers are )?drawn, designed, printed,? and cut by me\b[^]*no ai/i.test(t.trim()));
}

// Turns description paragraphs into the same look as the Details section:
// a short line ending in ":" (or starting with ✦) becomes a small heading, and lines starting
// with "•" or "-" become a list. Lines under a heading on their own also become a list.
function describe(paragraphs, esc, fold = []) {
  const isBullet = (l) => /^\s*[•\-–]\s+/.test(l);
  const strip = (l) => l.replace(/^\s*[•\-–]\s+/, "");
  const isHeading = (l) => /^✦/.test(l.trim()) || (/:\s*$/.test(l) && l.trim().length <= 40);
  const heading = (l) => `<h2>${esc(l.trim().replace(/^✦\s*/, "").replace(/:\s*$/, ""))}</h2>`;
  const list = (lines) => `<ul>${lines.map((l) => `<li>${esc(strip(l))}</li>`).join("")}</ul>`;
  const title = (l) => l.trim().replace(/^✦\s*/, "").replace(/:\s*$/, "");
  let out = "", afterHeading = false, folded = false;
  for (const para of paragraphs) {
    let lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    folded = false;
    if (lines.length && isHeading(lines[0]) && (lines.length > 1 || /:\s*$/.test(lines[0]) || /^✦/.test(lines[0]))) {
      // a section named in the product's "collapse" list starts closed, behind its heading
      if ((fold || []).includes(title(lines[0]))) { out += `<details class="fold"><summary>${esc(title(lines[0]))}</summary>`; folded = true; }
      else out += heading(lines[0]);
      lines = lines.slice(1); afterHeading = true;
      if (!lines.length) { if (folded) out += "</details>"; continue; }
    }
    const firstBullet = lines.findIndex(isBullet);
    if (firstBullet === -1) {
      // plain lines: a list when they sit under their own heading (e.g. two finishes), else a paragraph
      out += afterHeading && lines.length > 1 ? list(lines) : `<p>${esc(lines.join("\n"))}</p>`;
    } else {
      if (firstBullet > 0) out += `<p>${esc(lines.slice(0, firstBullet).join("\n"))}</p>`;
      out += list(lines.slice(firstBullet));
    }
    if (folded) out += "</details>";
    afterHeading = false;
  }
  return out;
}
