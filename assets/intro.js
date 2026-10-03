/*
  The ed.mcveigh logo intro (same animation as the links page):
  "ed.mcveigh" crashes together, the letters scatter, and "e." flies up into the corner logo.

  It plays once per visit, only on the front page, and is skipped for anyone with
  reduced motion turned on (index.html decides this before the page draws).
  Visitors can tap "Skip intro" at any time.
*/
(() => {
  const root = document.documentElement;
  if (!root.classList.contains("intro")) return;
  try { sessionStorage.setItem("edm-intro", "1"); } catch (e) { /* plays again next load; harmless */ }

  const slot = document.getElementById("logoSlot");
  const logoStatic = document.getElementById("logoStatic");
  const rand = (a, b) => a + Math.random() * (b - a);
  const kick = m => (Math.random() < 0.5 ? -1 : 1) * rand(0.4 * m, m);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const knock = (u, amp) => u <= 0 ? 0 : (u < 0.03 ? -amp * u / 0.03 : -amp * Math.exp(-11 * (u - 0.03)) * Math.cos(20 * (u - 0.03)));
  const squash = (u, amt) => u <= 0 ? 0 : amt * Math.exp(-22 * u);
  const env = (u, k) => u <= 0 ? 0 : (u < 0.025 ? u / 0.025 : Math.exp(-k * (u - 0.025)));
  const set = (el, x, y, r, sx, sy, o = 1) => { el.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(${sx}, ${sy})`; el.style.opacity = o; };

  // timeline in animation seconds (real = anim / SPEED)
  const SPEED = 0.75;
  const A = 0.35, B = 0.72, C = 0.86, D = 1.04, E = 1.15, Ex = E + 0.07;
  const F0 = E + 0.95, F1 = F0 + 0.6;    // fly to the corner
  const EG = 1.4, TILT = 9, ZC = 1.7;    // e grows at impact; group zoom while centred

  const overlay = document.createElement("div"); overlay.className = "overlay";
  const word = document.createElement("div"); word.className = "word"; word.setAttribute("aria-hidden", "true");
  overlay.appendChild(word);
  const hero = document.createElement("div"); hero.className = "hero"; hero.setAttribute("aria-hidden", "true");
  const skip = document.createElement("button"); skip.className = "skip"; skip.type = "button"; skip.textContent = "Skip intro";
  document.body.append(overlay, hero, skip);

  let letters, sparks = [], st, raf = 0, finished = false;

  function finish() {
    if (finished) return; finished = true;
    cancelAnimationFrame(raf);
    overlay.remove(); skip.remove(); hero.remove();
    // The animated "e." has landed exactly where the header logo sits, so swap to the real one.
    logoStatic.style.visibility = "visible";
    root.classList.add("show");
    setTimeout(() => { root.classList.remove("intro", "show"); logoStatic.style.visibility = ""; }, 1200);
  }
  skip.addEventListener("click", finish);

  function setup() {
    const vw = innerWidth, vh = innerHeight;
    const fs = Math.min(132, (vw - 40) / 6.6, vh / 5);
    word.style.fontSize = fs + "px";
    const text = "ed.mcveigh", chars = [...text], dotIdx = chars.indexOf(".");
    letters = chars.map((ch, i) => {
      const el = document.createElement("span"); el.className = "ch"; el.textContent = ch; word.appendChild(el);
      return { el, role: i === 0 ? "keep" : i === dotIdx ? "dot" : i > dotIdx ? "tail" : "fly" };
    });
    const ww = word.getBoundingClientRect().width;
    word.style.left = (vw - ww) / 2 + "px";
    word.style.top = (vh / 2 - fs * 0.55) + "px";

    const keep = letters[0], dot = letters[dotIdx], firstTail = letters[dotIdx + 1];
    const hitR = firstTail.el.getBoundingClientRect();
    const hit = { x: hitR.left, y: hitR.top + hitR.height * 0.55 };
    letters.forEach((l, i) => {
      const r = l.el.getBoundingClientRect();
      const ang = Math.atan2(r.top + r.height / 2 - hit.y + rand(-0.6, 0.6) * fs, r.left + r.width / 2 - hit.x) + rand(-1.6, 1.6);
      const v = rand(8, 17) * fs;
      l.vx = Math.cos(ang) * v; l.vy = Math.sin(ang) * v - rand(2, 6) * fs;
      l.vr = rand(-650, 650); l.grow = rand(-0.25, 0.45);
      l.j1 = { x: kick(0.11), y: kick(0.22), r: kick(22) };
      l.j2 = { x: kick(0.12), y: kick(0.24), r: kick(26) };
      l.cdir = i > dotIdx ? -(i - dotIdx) : (dotIdx - i);
      l.px = l.py = l.pr = 0;
    });

    // "e." moves into its own layer so it can zoom and fly without dragging the other letters along
    hero.style.fontSize = fs + "px";
    hero.style.left = word.style.left; hero.style.top = word.style.top;
    const w0 = word.getBoundingClientRect();
    [keep, dot].forEach(l => {
      const r = l.el.getBoundingClientRect(), c = l.el.cloneNode(true);
      c.style.position = "absolute"; c.style.left = (r.left - w0.left) + "px"; c.style.top = (r.top - w0.top) + "px";
      hero.appendChild(c); l.el.style.visibility = "hidden"; l.el = c;
    });
    const kr = keep.el.getBoundingClientRect(), dotLeft = dot.el.getBoundingClientRect().left;
    const dotTarget = gr => (kr.left + kr.width * gr * 0.97 + fs * 0.06 * gr) - dotLeft;
    const dotLift = kr.width * EG * Math.sin(TILT * Math.PI / 180) * 0.75 + fs * 0.03;
    keep.el.style.transformOrigin = "10% 85%"; dot.el.style.transformOrigin = "0% 85%";

    // where "e." sits at rest, so zooms and flights can aim at its centre
    set(keep.el, 0, 0, -TILT, EG, EG); set(dot.el, dotTarget(EG), -dotLift, 0, EG, EG);
    const a = keep.el.getBoundingClientRect(), b = dot.el.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    const cx = (Math.min(a.left, b.left) + Math.max(a.right, b.right)) / 2;
    const cy = (Math.min(a.top, b.top) + Math.max(a.bottom, b.bottom)) / 2;
    keep.el.style.transform = dot.el.style.transform = "";
    hero.style.transformOrigin = `${cx - hr.left}px ${cy - hr.top}px`;

    // the text box sits off the visible ink; these ratios (measured from the font) re-centre on the ink
    const ink = s => ({ x: 0.058 * fs * EG * s, y: 0.207 * fs * EG * s, h: 0.53 * fs * EG * s });
    st = { fs, S: fs * 1.5, S2: fs * 0.6, g: fs * 9, hit, keep, dot, dotTarget, dotLift, cx, cy, ink, fired1: false, fired2: false };
  }

  // transform for the hero: k = 0 → centred big, k = 1 → parked in the header logo
  function heroTarget(k) {
    const { cx, cy, ink, fs } = st;
    const cT = { x: innerWidth / 2 - ink(ZC).x - cx, y: innerHeight / 2 - ink(ZC).y - cy, s: ZC };
    const r = slot.getBoundingClientRect();
    const sL = r.height * 0.82 / (0.53 * fs * EG);   // e fills ~82% of the slot height
    const lT = { x: r.left + r.width / 2 - ink(sL).x - cx, y: r.top + r.height / 2 - ink(sL).y - cy, s: sL };
    return { x: cT.x + (lT.x - cT.x) * k, y: cT.y + (lT.y - cT.y) * k, s: cT.s + (lT.s - cT.s) * k };
  }
  function placeHero(k) { const t = heroTarget(k); hero.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.s})`; }

  function burst(n, power) {
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div"); el.className = "spark";
      const size = rand(0.04, 0.13) * st.fs * power; el.style.width = el.style.height = size + "px";
      overlay.appendChild(el);
      const a = rand(0, Math.PI * 2), v = rand(4, 13) * st.fs * power;
      sparks.push({ el, x: st.hit.x - size / 2, y: st.hit.y - size / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: null, life: rand(0.35, 0.7) });
    }
  }

  function frame(t) {
    const { fs, S, S2, g, dotTarget, dotLift } = st;
    const u1 = t - C, u2 = t - E;
    if (!st.fired1 && t >= C) { st.fired1 = true; burst(5, 0.6); }
    if (!st.fired2 && t >= E) { st.fired2 = true; burst(13, 0.8); }

    let tailX = 0;
    if (t >= A && t < B) tailX = S * easeOut((t - A) / (B - A));
    else if (t >= B && t < C) tailX = S * (1 - Math.pow((t - B) / (C - B), 3));
    else if (t >= C && t < D) tailX = S2 * easeOut((t - C) / (D - C));
    else if (t >= D && t < E) tailX = S2 * (1 - Math.pow((t - D) / (E - D), 2.5));

    const headX = knock(u1, fs * 0.09) * (t < E ? 1 : 0) + knock(u2, fs * 0.2);
    const sq = Math.max(squash(u1, 0.14) * (t < E ? 1 : 0), squash(u2, 0.24));
    const gv = u2 - 0.06;
    const grow = gv > 0 ? 1 + (EG - 1) * (1 - Math.exp(-6 * gv) * Math.cos(11 * gv)) : 1;
    const gp = (grow - 1) / (EG - 1);

    const shake = (u1 > 0 && t < E ? 3 * Math.exp(-16 * u1) : 0) + (u2 > 0 ? 7 * Math.exp(-10 * u2) : 0);
    overlay.style.transform = shake > 0.3 ? `translate(${rand(-1, 1) * shake}px, ${rand(-1, 1) * shake}px)` : "";

    const e1 = env(u1, 5), e2 = env(u2, 8), comp = fs * (0.14 * e1 + 0.2 * e2);
    letters.forEach(l => {
      const j = { x: (l.j1.x * e1 + l.j2.x * e2) * fs + comp * l.cdir, y: (l.j1.y * e1 + l.j2.y * e2) * fs, r: l.j1.r * e1 + l.j2.r * e2 };
      if (l.role === "keep") { set(l.el, headX + j.x, j.y, headX / fs * 5 + j.r - TILT * gp, (1 - sq) * grow, (1 + sq * 0.7) * grow); return; }
      if (l.role === "dot") {
        const f = u2 > 0.1 ? 1 - Math.exp(-8 * (u2 - 0.1)) * Math.cos(9 * (u2 - 0.1)) : 0;
        set(l.el, headX + dotTarget(grow) * f + j.x, j.y - dotLift * clamp(gp, 0, 1.1) * f, j.r * 0.5, (1 - sq) * grow, (1 + sq * 0.7) * grow); return;
      }
      if (t < Ex) {
        const base = l.role === "tail" ? tailX : headX;
        const tsq = l.role === "tail" ? Math.max(squash(u1, 0.25), squash(u2, 0.3)) : sq;
        l.px = base + j.x; l.py = j.y; l.pr = j.r;
        set(l.el, l.px, l.py, l.pr, 1 - tsq, 1 + tsq * 0.6); return;
      }
      const u = t - Ex, sc = 1 + l.grow * clamp(u * 2, 0, 1);
      set(l.el, l.px + l.vx * u, l.py + l.vy * u + 0.5 * g * u * u, l.pr + l.vr * u, sc, sc, clamp(1.6 - u * 1.6, 0, 1));
    });
    sparks.forEach(p => {
      if (p.t0 === null) p.t0 = t;
      const u = t - p.t0, k = Math.exp(-3 * u);
      set(p.el, p.x + p.vx * (1 - k) / 3, p.y + p.vy * (1 - k) / 3 + 0.5 * g * u * u, 0, 1, 1, clamp(1 - u / p.life, 0, 1));
    });

    // "e." punches to the centre on the second impact…
    const v = u2 - 0.1;
    if (v > 0 && t < F0) {
      const c = heroTarget(0);
      const kp = 1 - (1 + 11 * v) * Math.exp(-11 * v);
      const ks = 1 - Math.exp(-7 * v) * Math.cos(10 * v);
      hero.style.transform = `translate(${c.x * kp}px, ${c.y * kp}px) scale(${1 + (c.s - 1) * ks})`;
    }
    // …then flies up into the corner as the shop appears
    if (t >= F0) {
      const k = easeInOut(clamp((t - F0) / (F1 - F0), 0, 1));
      placeHero(k);
      if (!overlay.classList.contains("gone")) { overlay.classList.add("gone"); root.classList.add("show"); }
      if (k >= 1) { finish(); return false; }
    }
    return true;
  }

  function start() {
    if (finished) return;
    scrollTo(0, 0);
    setup();
    const t0 = performance.now();
    const loop = now => {
      if (finished) return;
      if (frame((now - t0) / 1000 * SPEED)) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  const fontReady = document.fonts ? document.fonts.load("80px Agbalumo") : Promise.resolve();
  Promise.race([fontReady, new Promise(r => setTimeout(r, 2000))]).then(() => setTimeout(start, 350));
})();
