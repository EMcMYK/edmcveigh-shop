/*
  The "e." logo spin on hover (the e. Spinner animation): the e winds back, whips around three times,
  overshoots and springs home to its tilt, while the dot pulses.

  It draws a copy of the logo on a canvas laid exactly over the real one, plays once, then hands back
  to the real logo, so nothing about the logo's normal look changes. Reduced-motion visitors never see it.
  Used by the shop (assets/spin-logo.js) and the links page (landing/spin-logo.js): keep the two copies the same.

  Usage: edmSpinLogo(hoverTarget, logoElementContainingSpansDotEandDotD)
*/
window.edmSpinLogo = function (trigger, logo) {
  if (!trigger || !logo || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const eEl = logo.querySelector(".e"), dEl = logo.querySelector(".d");
  if (!eEl || !dEl) return;

  const TURNS = 3, OVERSHOOT = 28, T_WIND = 0.14, T_SPIN = 0.62, T_SETTLE = 1.0, LEN = T_WIND + T_SPIN + T_SETTLE;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeInOutQuart = (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2);
  const spinAt = (t) => {
    if (t <= 0 || t >= LEN) return 0;
    if (t < T_WIND) return -16 * easeOut(t / T_WIND);
    t -= T_WIND;
    if (t < T_SPIN) return -16 + (360 * TURNS + OVERSHOOT + 16) * easeInOutQuart(t / T_SPIN);
    t -= T_SPIN;
    return 360 * TURNS + OVERSHOOT * Math.exp(-4.2 * t) * Math.cos(8.5 * t);
  };
  const dotScaleAt = (t) => {
    const mid = T_WIND + T_SPIN / 2, half = 0.42, p = (t - (mid - half)) / (2 * half);
    return p <= 0 || p >= 1 ? 1 : 1 + 0.4 * Math.pow(Math.sin(p * Math.PI), 2);
  };

  // Where a glyph sits on the page, untransformed: its box, baseline, font, and its own transform to re-apply.
  function place(el) {
    const cs = getComputedStyle(el), saved = el.style.transform;
    el.style.transform = "none";
    const box = el.getBoundingClientRect();
    const mark = document.createElement("span");
    mark.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    el.appendChild(mark);
    const baseline = mark.getBoundingClientRect().top;
    mark.remove();
    el.style.transform = saved;
    const [ox, oy] = cs.transformOrigin.split(" ").map(parseFloat);
    const m = cs.transform && cs.transform !== "none" ? new DOMMatrix(cs.transform) : new DOMMatrix();
    return { box, base: baseline - box.top, size: parseFloat(cs.fontSize), family: cs.fontFamily, ox, oy, m, ch: el.textContent };
  }

  let playing = false;
  function play() {
    if (playing) return;
    playing = true;
    const E = place(eEl), D = place(dEl), color = getComputedStyle(eEl).color;
    const pad = E.box.height;                                   // room for the spin and the trail
    const left = Math.min(E.box.left, D.box.left) - pad, top = Math.min(E.box.top, D.box.top) - pad;
    const w = Math.max(E.box.right, D.box.right) + pad - left, h = Math.max(E.box.bottom, D.box.bottom) + pad - top;
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const c = document.createElement("canvas");
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = `position:absolute;left:${left + scrollX}px;top:${top + scrollY}px;width:${w}px;height:${h}px;pointer-events:none;z-index:50`;
    document.body.appendChild(c);
    const ctx = c.getContext("2d");
    const ink = (g) => {                                          // centre of a glyph's ink, in its own box
      ctx.font = `${g.size}px ${g.family}`;
      const mt = ctx.measureText(g.ch);
      return { x: (mt.actualBoundingBoxRight - mt.actualBoundingBoxLeft) / 2, y: g.base - (mt.actualBoundingBoxAscent - mt.actualBoundingBoxDescent) / 2 };
    };
    const eC = ink(E), dC = ink(D);

    function glyph(g, extra) {                                    // draw one glyph with its CSS transform, plus extra
      ctx.save();
      ctx.translate(g.box.left - left + g.ox, g.box.top - top + g.oy);
      ctx.transform(g.m.a, g.m.b, g.m.c, g.m.d, g.m.e, g.m.f);
      ctx.translate(-g.ox, -g.oy);
      extra();
      ctx.font = `${g.size}px ${g.family}`; ctx.textBaseline = "alphabetic"; ctx.fillStyle = color;
      ctx.fillText(g.ch, 0, g.base);
      ctx.restore();
    }
    function render(t, prevA) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const ds = dotScaleAt(t);
      glyph(D, () => { ctx.translate(dC.x, dC.y); ctx.scale(ds, ds); ctx.translate(-dC.x, -dC.y); });
      const a = spinAt(t), sweep = Math.min(Math.abs(a - prevA), 320);
      const spinE = (deg) => glyph(E, () => { ctx.translate(eC.x, eC.y); ctx.rotate(deg * Math.PI / 180); ctx.translate(-eC.x, -eC.y); });
      if (sweep < 1.5) { spinE(a); return; }
      const n = Math.min(28, Math.max(6, Math.round(sweep / 7))), dir = Math.sign(a - prevA);
      for (let i = n - 1; i >= 0; i--) {                         // motion blur: fading copies along the arc
        const f = i / (n - 1);
        ctx.globalAlpha = i === 0 ? 0.9 : (0.55 / n) * 4 * (1 - f * 0.8);
        spinE(a - dir * sweep * f);
      }
      ctx.globalAlpha = 1;
    }

    eEl.style.visibility = dEl.style.visibility = "hidden";
    let start = null;
    requestAnimationFrame(function frame(now) {
      if (start === null) start = now;
      const t = (now - start) / 1000;
      if (t < LEN) { render(t, spinAt(Math.max(0, t - 1.6 / 60))); requestAnimationFrame(frame); return; }
      eEl.style.visibility = dEl.style.visibility = "";
      c.remove();
      playing = false;
    });
  }

  const go = () => {
    if (document.fonts && !document.fonts.check(`20px ${getComputedStyle(eEl).fontFamily}`)) return;
    if (getComputedStyle(logo).visibility === "hidden") return;   // e.g. while the intro is still running
    play();
  };
  trigger.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") go(); });
  trigger.addEventListener("touchstart", go, { passive: true });
};
