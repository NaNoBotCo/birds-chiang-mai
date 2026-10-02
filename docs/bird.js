/* bird.js — every bird on this site is drawn from a few dozen numbers.
 *
 * A bird faces right. Origin = the point between its feet, on the perch; y points down.
 * Units are arbitrary ("body units"); the caller scales. A species is a parameter set
 * (see data.js); a state carries the moment: breathing, gape, head turn, tail cock, blink,
 * crest, flight. Shapes are superellipses, Bézier tubes, golden-angle spirals, the heart
 * curve and sine bands; the engraving is concentric copies of each outline.
 */
(function (G) {
  "use strict";
  var TAU = Math.PI * 2, GOLD = Math.PI * (3 - Math.sqrt(5));

  function lerp(a, b, t) { return a + (b - a) * t; }
  function hexA(hex, a) {
    var h = hex.replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&");
    var n = parseInt(h, 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }
  function mix(h1, h2, t) {
    var a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    var r = Math.round(lerp(a >> 16 & 255, b >> 16 & 255, t)), g = Math.round(lerp(a >> 8 & 255, b >> 8 & 255, t)),
      bl = Math.round(lerp(a & 255, b & 255, t));
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  // a tiny deterministic random, so a bird's speckles stay put frame to frame
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* superellipse body outline, egg-weighted toward the chest */
  function bodyPts(a, b, n, egg, k) {
    var pts = []; k = k || 48;
    for (var i = 0; i < k; i++) {
      var t = i / k * TAU, c = Math.cos(t), s = Math.sin(t);
      var x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      var y = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      y *= 1 + egg * x / a;          // fuller chest, slimmer rump
      if (y > 0) y *= 1 + 0.08 * (1 - Math.abs(x / a)); // a little belly
      pts.push([x, y]);
    }
    return pts;
  }
  function poly(ctx, pts, close) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close !== false) ctx.closePath();
  }
  function smooth(ctx, pts) { // closed Catmull-Rom through pts
    var n = pts.length; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    ctx.closePath();
  }
  function scalePts(pts, s, cx, cy) { return pts.map(function (p) { return [cx + (p[0] - cx) * s, cy + (p[1] - cy) * s]; }); }

  /* a tapered tube along a quadratic Bézier, as a polygon */
  function tube(p0, c, p1, w0, w1, k) {
    var L = [], Rr = []; k = k || 14;
    for (var i = 0; i <= k; i++) {
      var t = i / k, u = 1 - t;
      var x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
      var dx = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]), dy = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
      var l = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, t) / 2;
      L.push([x - dy / l * w, y + dx / l * w]); Rr.unshift([x + dy / l * w, y - dx / l * w]);
    }
    return L.concat(Rr);
  }

  /* engraving: concentric shrunk copies of an outline, faint */
  function engrave(ctx, pts, cx, cy, ink, n, alpha) {
    ctx.save(); ctx.strokeStyle = hexA(ink, alpha); ctx.lineWidth = 0.35;
    for (var i = 1; i <= n; i++) { smooth(ctx, scalePts(pts, 1 - i / (n + 1), cx, cy)); ctx.stroke(); }
    ctx.restore();
  }
  function hatch(ctx, x0, y0, x1, y1, ang, gap, color, lw) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw || 0.4;
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
    ctx.translate(cx, cy); ctx.rotate(ang); ctx.beginPath();
    for (var y = -r; y <= r; y += gap) { ctx.moveTo(-r, y); ctx.lineTo(r, y); }
    ctx.stroke(); ctx.restore();
  }

  /* patterns, drawn inside whatever clip is current */
  function pattern(ctx, P, box, seed) {
    if (!P) return;
    var r = rng(seed), x0 = box[0], y0 = box[1], x1 = box[2], y1 = box[3], w = x1 - x0, h = y1 - y0;
    ctx.save();
    if (P.type === "bars") {               // wavy cross-bars (owlets, nightjars, coucal young)
      ctx.strokeStyle = P.color; ctx.lineWidth = P.w || 1.1;
      for (var y = y0; y < y1; y += P.gap || 3) {
        ctx.beginPath();
        for (var x = x0; x <= x1; x += 2) ctx.lineTo(x, y + Math.sin(x * 0.35 + y) * (P.amp || 0.7));
        ctx.stroke();
      }
    } else if (P.type === "streaks") {     // short dashes, staggered rows
      ctx.strokeStyle = P.color; ctx.lineWidth = P.w || 1; ctx.lineCap = "round";
      for (var yy = y0; yy < y1; yy += P.gap || 3.2) for (var xx = x0 + (yy % 2); xx < x1; xx += (P.gap || 3.2) * 1.2) {
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - 0.6, yy + (P.len || 2.4)); ctx.stroke();
      }
    } else if (P.type === "spots") {       // golden-angle (Fermat) spiral of spots
      ctx.fillStyle = P.color;
      var cx = P.cx != null ? P.cx : (x0 + x1) / 2, cy = P.cy != null ? P.cy : (y0 + y1) / 2, n = P.n || 90;
      for (var i = 1; i < n; i++) {
        var rr = (P.scale || 1.6) * Math.sqrt(i), th = i * GOLD;
        ctx.beginPath(); ctx.arc(cx + rr * Math.cos(th), cy + rr * Math.sin(th), P.r || 0.6, 0, TAU); ctx.fill();
      }
    } else if (P.type === "scales") {      // overlapping arcs, rows offset by half
      ctx.strokeStyle = P.color; ctx.lineWidth = P.w || 0.6;
      var g = P.gap || 3;
      for (var ys = y0; ys < y1 + g; ys += g * 0.62) for (var xs = x0 + ((Math.round(ys / g / 0.62) % 2) * g / 2); xs < x1 + g; xs += g) {
        ctx.beginPath(); ctx.arc(xs, ys, g / 2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        if (P.fill) { ctx.fillStyle = P.fill; ctx.beginPath(); ctx.arc(xs, ys + g * 0.1, g * 0.16, 0, TAU); ctx.fill(); }
      }
    } else if (P.type === "mottle") {      // cryptic speckle (nightjar)
      for (var m = 0; m < (P.n || 260); m++) {
        ctx.fillStyle = (P.colors || [P.color])[m % (P.colors ? P.colors.length : 1)];
        var mx = x0 + r() * w, my = y0 + r() * h;
        ctx.beginPath(); ctx.ellipse(mx, my, 0.4 + r() * (P.size || 1.4), 0.3 + r() * 0.7, r() * 3, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------------------- */
  /* side-profile bird                                                        */
  /* ----------------------------------------------------------------------- */
  function drawSide(ctx, sp, st) {
    var D = sp.draw, c = D.col, seed = hash(sp.slug);
    var a = D.body[0], b = D.body[1], tilt = (D.tilt || 0) * Math.PI / 180;
    var breathe = 1 + 0.018 * Math.sin((st.t || 0) * 2.4 + seed);
    var legL = D.legs ? D.legs[0] : 8;
    var ink = st.ink || D.ink || "#1b140e";
    var lw = st.lw != null ? st.lw : 0.9;
    var carve = st.carve; // monochrome teak: every colour to wood tones
    function C(x, fallback) { var v = x || fallback; if (!carve) return v; return carve(v); }

    // where the body sits: belly bottom rests legL above the perch
    var bodyCy = -(legL + b * 0.82);
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    // --- legs (behind the body)
    if (D.legs) {
      ctx.strokeStyle = C(D.legs[1], "#555"); ctx.lineWidth = D.legs[2] || 1.4;
      var hips = [[a * 0.06, bodyCy + b * 0.6], [-a * 0.12, bodyCy + b * 0.6]];
      hips.forEach(function (h, i) {
        var fx = i ? -a * 0.08 : a * 0.12;
        ctx.beginPath(); ctx.moveTo(h[0], h[1]);
        if (D.legs[3]) ctx.quadraticCurveTo(h[0] - legL * 0.25, (h[1]) / 2, fx, 0); else ctx.lineTo(fx, 0);
        ctx.stroke();
        ctx.beginPath(); // toes
        ctx.moveTo(fx - 2.2, 0); ctx.lineTo(fx + 3.2, 0.2); ctx.moveTo(fx, 0); ctx.lineTo(fx + 2.4, 1.1);
        ctx.stroke();
      });
    }

    // --- tail (behind body)
    var rump = [-a * 0.9, bodyCy - b * 0.05];
    rump = rot(rump, [0, bodyCy], tilt);
    if (D.train && !st.display) drawTrainFolded(ctx, D, rump, st, C, ink, lw, seed);
    if (D.train && st.display) drawTrainFan(ctx, D, [rump[0] + a * 0.4, rump[1]], st, C, ink, seed);
    if (D.sickle) drawSickle(ctx, D, rump, st, C, ink, lw);
    if (D.tail) drawTail(ctx, D, rump, st, C, ink, lw);

    // --- body
    ctx.save();
    ctx.translate(0, bodyCy); ctx.rotate(tilt); ctx.scale(breathe, breathe);
    var pts = bodyPts(a, b, D.sq || 2.25, D.egg || 0.12);
    smooth(ctx, pts);
    ctx.fillStyle = C(c.back); ctx.fill();
    ctx.save(); smooth(ctx, pts); ctx.clip();
    // belly: everything below a gentle curve from chest to vent
    ctx.beginPath(); ctx.moveTo(a * 1.2, -b * (D.bellyLine || 0.05));
    ctx.quadraticCurveTo(0, b * 0.55, -a * 1.1, b * 0.35); ctx.lineTo(-a * 1.2, b * 2); ctx.lineTo(a * 1.2, b * 2); ctx.closePath();
    ctx.fillStyle = C(c.belly || c.back); ctx.fill();
    if (c.breast) { // breast patch on the chest
      ctx.fillStyle = C(c.breast); ctx.beginPath(); ctx.ellipse(a * 0.62, -b * 0.05, a * 0.42, b * 0.75, 0.2, 0, TAU); ctx.fill();
    }
    if (c.band) { ctx.fillStyle = C(c.band); ctx.beginPath(); ctx.ellipse(a * 0.8, -b * 0.2, a * 0.14, b * 0.8, 0.25, 0, TAU); ctx.fill(); }
    if (c.vent) { ctx.fillStyle = C(c.vent); ctx.beginPath(); ctx.ellipse(-a * 0.7, b * 0.55, a * 0.3, b * 0.35, -0.3, 0, TAU); ctx.fill(); }
    if (D.pat) D.pat.forEach(function (P, i) {
      ctx.save();
      if (P.region === "belly") { ctx.beginPath(); ctx.moveTo(a * 1.2, -b * 0.05); ctx.quadraticCurveTo(0, b * 0.55, -a * 1.1, b * 0.35); ctx.lineTo(-a * 1.2, b * 2); ctx.lineTo(a * 1.2, b * 2); ctx.closePath(); ctx.clip(); }
      if (P.region === "back") { ctx.beginPath(); ctx.rect(-a * 1.2, -b * 1.5, a * 2.4, b * 1.4); ctx.clip(); }
      if (P.region === "chest") { ctx.beginPath(); ctx.ellipse(a * 0.6, 0, a * 0.55, b * 1.1, 0.1, 0, TAU); ctx.clip(); }
      pattern(ctx, P.carve && carve ? null : Object.assign({}, P, { color: C(P.color), fill: P.fill && C(P.fill) }), [-a, -b * 1.2, a, b * 1.2], seed + i);
      ctx.restore();
    });
    if (c.gloss && !carve) { // iridescent sheen
      var g = ctx.createLinearGradient(-a, -b, a * 0.4, b * 0.5);
      g.addColorStop(0, hexA(c.gloss, 0)); g.addColorStop(0.45, hexA(c.gloss, 0.45)); g.addColorStop(1, hexA(c.gloss, 0));
      ctx.fillStyle = g; ctx.fillRect(-a, -b * 1.3, a * 2, b * 2.6);
    }
    // light from above-front, shade below-back
    var sh = ctx.createRadialGradient(a * 0.3, -b * 0.6, b * 0.2, 0, 0, a * 1.2);
    sh.addColorStop(0, "rgba(255,255,255,0.18)"); sh.addColorStop(0.6, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = sh; ctx.fillRect(-a * 1.2, -b * 1.4, a * 2.4, b * 2.8);
    engrave(ctx, pts, -a * 0.25, b * 0.35, carve ? "#2a1606" : ink, carve ? 5 : 2, carve ? 0.28 : 0.05);
    ctx.restore();
    smooth(ctx, pts); ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();

    // --- wing
    if (!st.fly) drawWingFolded(ctx, D, a, b, C, ink, lw, seed, st, carve);
    ctx.restore();
    if (st.fly) drawWingFlap(ctx, D, a, b, bodyCy, tilt, C, ink, lw, st);

    // --- neck + head
    var H = D.head, hr = H[0];
    var turn = st.turn || 0;     // -1..1 head tilt
    var neckBase = rot([a * 0.62, bodyCy - b * 0.45], [0, bodyCy], tilt);
    var head = [neckBase[0] + H[1], neckBase[1] + H[2] + (st.bob || 0)];
    var neck = D.neck;
    if (neck) {
      var ctrl = [lerp(neckBase[0], head[0], 0.5) + neck[2], lerp(neckBase[1], head[1], 0.5) + neck[3]];
      var tp = tube(neckBase, ctrl, head, neck[0], neck[1]);
      poly(ctx, tp); ctx.fillStyle = C(c.neck || c.head || c.back); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();
      if (D.hackles) drawHackles(ctx, neckBase, ctrl, head, D, C, ink);
      if (D.neckPat) { ctx.save(); poly(ctx, tp); ctx.clip(); pattern(ctx, Object.assign({}, D.neckPat, { color: C(D.neckPat.color), fill: D.neckPat.fill && C(D.neckPat.fill) }), [head[0] - 30, head[1] - 10, neckBase[0] + 10, neckBase[1] + 10], seed + 9); ctx.restore(); }
    } else {
      // short neck: a filled bridge between body front and head
      var nb = tube(neckBase, [lerp(neckBase[0], head[0], 0.5), lerp(neckBase[1], head[1], 0.5)], head, b * 1.1, hr * 1.5, 6);
      poly(ctx, nb); ctx.fillStyle = C(c.neck || c.head || c.back); ctx.fill();
      if (D.collar) { // spotted dove: a black half-collar on the nape, dotted white
        var mx = lerp(neckBase[0], head[0], 0.45) - hr * 0.35, my = lerp(neckBase[1], head[1], 0.45);
        ctx.save(); poly(ctx, nb); ctx.clip();
        ctx.fillStyle = C("#1a1412"); ctx.beginPath(); ctx.ellipse(mx, my, hr * 0.75, hr * 1.1, -0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = C("#f4efe8");
        for (var ci = 0; ci < 22; ci++) { var cr = Math.sqrt(ci) * hr * 0.2, ct = ci * GOLD; ctx.beginPath(); ctx.arc(mx + cr * Math.cos(ct), my + cr * Math.sin(ct) * 1.3, hr * 0.09, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(head[0], head[1]); ctx.rotate(turn * 0.35 + (D.headTilt || 0) * Math.PI / 180);
    drawHead(ctx, sp, D, hr, st, C, ink, lw, seed, carve);
    ctx.restore();
    ctx.restore();
  }

  function rot(p, o, t) { var x = p[0] - o[0], y = p[1] - o[1]; return [o[0] + x * Math.cos(t) - y * Math.sin(t), o[1] + x * Math.sin(t) + y * Math.cos(t)]; }

  function drawHead(ctx, sp, D, hr, st, C, ink, lw, seed, carve) {
    var c = D.col;
    // crest behind the head
    if (D.crest) drawCrest(ctx, D, hr, st, C, ink, lw, seed);
    // bill (behind head outline, in front of crest)
    drawBill(ctx, D, hr, st, C, ink, lw);
    // head disc
    ctx.beginPath(); ctx.arc(0, 0, hr, 0, TAU); ctx.fillStyle = C(c.head || c.back); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, hr, 0, TAU); ctx.clip();
    if (c.cap) { ctx.fillStyle = C(c.cap); ctx.beginPath(); ctx.ellipse(hr * 0.1, -hr * 0.75, hr * 1.05, hr * 0.62, -0.15, 0, TAU); ctx.fill(); }
    if (c.forehead) { ctx.fillStyle = C(c.forehead); ctx.beginPath(); ctx.ellipse(hr * 0.75, -hr * 0.62, hr * 0.42, hr * 0.32, 0.4, 0, TAU); ctx.fill(); }
    if (c.throat) { ctx.fillStyle = C(c.throat); ctx.beginPath(); ctx.ellipse(hr * 0.45, hr * 0.72, hr * 0.75, hr * 0.55, 0.3, 0, TAU); ctx.fill(); }
    if (c.cheek) { ctx.fillStyle = C(c.cheek); ctx.beginPath(); ctx.ellipse(hr * 0.1, hr * 0.28, hr * 0.5, hr * 0.38, 0, 0, TAU); ctx.fill(); }
    if (c.ear) { ctx.fillStyle = C(c.ear); ctx.beginPath(); ctx.ellipse(-hr * 0.12, hr * 0.02, hr * 0.26, hr * 0.22, 0, 0, TAU); ctx.fill(); }
    if (c.mask) { ctx.fillStyle = C(c.mask); ctx.beginPath(); ctx.ellipse(hr * 0.35, -hr * 0.05, hr * 0.85, hr * 0.26, 0.05, 0, TAU); ctx.fill(); }
    if (c.brow) { ctx.strokeStyle = C(c.brow); ctx.lineWidth = hr * 0.16; ctx.beginPath(); ctx.arc(hr * 0.3, hr * 0.15, hr * 0.62, -2.2, -0.9); ctx.stroke(); }
    if (c.whisker) { ctx.strokeStyle = C(c.whisker); ctx.lineWidth = hr * 0.12; ctx.beginPath(); ctx.moveTo(hr * 0.85, hr * 0.32); ctx.quadraticCurveTo(hr * 0.2, hr * 0.62, -hr * 0.45, hr * 0.45); ctx.stroke(); }
    if (c.skin) { ctx.fillStyle = C(c.skin); ctx.beginPath(); ctx.ellipse(hr * 0.2, -hr * 0.12, hr * 0.42, hr * 0.32, 0, 0, TAU); ctx.fill(); }
    if (D.headPat) pattern(ctx, Object.assign({}, D.headPat, { color: C(D.headPat.color) }), [-hr, -hr, hr, hr], seed + 3);
    var sh = ctx.createRadialGradient(hr * 0.3, -hr * 0.4, hr * 0.1, 0, 0, hr * 1.1);
    sh.addColorStop(0, "rgba(255,255,255,0.2)"); sh.addColorStop(0.7, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = sh; ctx.fillRect(-hr, -hr, hr * 2, hr * 2);
    if (c.gloss && !carve) { ctx.fillStyle = hexA(c.gloss, 0.25); ctx.beginPath(); ctx.arc(-hr * 0.2, -hr * 0.3, hr * 0.8, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, hr, 0, TAU); ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();
    if (D.comb) drawComb(ctx, D, hr, C, ink, lw);
    // eye
    var E = D.eye || [0.38, -0.12, 0.2, "#2a1a10"];
    var ex = hr * E[0], ey = hr * E[1], er = hr * E[2];
    if (E[4]) { ctx.fillStyle = C(E[4]); ctx.beginPath(); ctx.arc(ex, ey, er * 1.55, 0, TAU); ctx.fill(); }
    var blink = st.blink || 0;
    ctx.save(); ctx.translate(ex, ey); ctx.scale(1, Math.max(0.08, 1 - blink));
    ctx.fillStyle = C(E[3]); ctx.beginPath(); ctx.arc(0, 0, er, 0, TAU); ctx.fill();
    ctx.fillStyle = "#0b0806"; ctx.beginPath(); ctx.arc(er * 0.12, 0, er * (E[3] === "#0b0806" || E[3] === "#1a120c" ? 0.9 : 0.55), 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.arc(er * 0.35, -er * 0.35, er * 0.28, 0, TAU); ctx.fill();
    ctx.restore();
    if (D.wattle) { ctx.fillStyle = C(D.wattle); ctx.beginPath(); ctx.ellipse(hr * 0.7, hr * 1.0, hr * 0.22, hr * 0.42, 0.2, 0, TAU); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = lw * 0.7; ctx.stroke(); }
    // throat puff while singing (coucal, dove, koel)
    if (D.puff && st.gape > 0.05) {
      ctx.fillStyle = hexA(C(c.throat || c.neck || c.head || c.back), 0.9);
      ctx.beginPath(); ctx.ellipse(hr * 0.1, hr * 0.9, hr * 0.6 * (1 + st.gape * 0.5), hr * 0.45 * (1 + st.gape), 0, 0, TAU); ctx.fill();
    }
  }

  function drawBill(ctx, D, hr, st, C, ink, lw) {
    var B = D.bill; // [len, depth, curve, angle(deg), color, hook, gap]
    var len = B[0], dep = B[1], curve = B[2] || 0, ang = (B[3] || 0) * Math.PI / 180;
    var gape = (st.gape || 0) * (B[7] != null ? B[7] : 0.5);
    var col = C(B[4] || "#222");
    ctx.save(); ctx.translate(hr * 0.78, hr * 0.06); ctx.rotate(ang);
    // upper mandible
    ctx.save(); ctx.rotate(-gape * 0.5);
    ctx.beginPath(); ctx.moveTo(-1, -dep * 0.5);
    ctx.quadraticCurveTo(len * 0.5, -dep * 0.55 + curve * len * 0.2, len, curve * len * 0.5 + (B[5] ? dep * 0.4 : 0));
    if (B[5]) ctx.quadraticCurveTo(len * 1.02, curve * len * 0.5 + dep * 0.75, len * 0.9, curve * len * 0.45 + dep * 0.55);
    ctx.quadraticCurveTo(len * 0.5, curve * len * 0.32 + (B[6] ? -dep * 0.35 : 0), -1, 0.4);
    ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = lw * 0.8; ctx.stroke();
    ctx.restore();
    // lower mandible
    ctx.save(); ctx.rotate(gape * 0.6);
    ctx.beginPath(); ctx.moveTo(-1, 0.4);
    ctx.quadraticCurveTo(len * 0.5, curve * len * 0.32 + (B[6] ? dep * 0.45 : 0) + 0.3, len * 0.95, curve * len * 0.52 + 0.2);
    ctx.quadraticCurveTo(len * 0.5, dep * 0.5 + curve * len * 0.3, -1, dep * 0.5);
    ctx.closePath(); ctx.fillStyle = B[8] ? C(B[8]) : col; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = lw * 0.8; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  function drawCrest(ctx, D, hr, st, C, ink, lw, seed) {
    var K = D.crest, up = Math.min(1, (st.crest || 0) + (K.rest || 0));
    ctx.save(); ctx.fillStyle = C(K.color); ctx.strokeStyle = ink; ctx.lineWidth = lw * 0.8;
    if (K.type === "spike") {          // bulbul: one tall point, leaning forward
      var h = K.len * (0.8 + 0.2 * up);
      ctx.beginPath(); ctx.moveTo(-hr * 0.75, -hr * 0.35); ctx.quadraticCurveTo(-hr * 0.2, -hr - h * 0.5, hr * 0.15 + K.lean, -hr - h);
      ctx.quadraticCurveTo(hr * 0.2, -hr * 0.6, hr * 0.55, -hr * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (K.type === "fan") {     // hoopoe: rays that fold flat into an axe and open into a fan
      var n = K.n || 9;
      for (var i = 0; i < n; i++) {
        var f = i / (n - 1);
        var aFold = lerp(-2.85, -2.3, f), aOpen = lerp(-2.6, -0.35, f);
        var A = lerp(aFold, aOpen, up), L = K.len * (0.75 + 0.35 * Math.sin(f * Math.PI)) * lerp(1, 1.1, up);
        var bx = lerp(-hr * 0.5, hr * 0.5, f) * lerp(1, 0.6, up), by = -hr * 0.55;
        var tx = bx + Math.cos(A) * L, ty = by + Math.sin(A) * L;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(A);
        ctx.beginPath(); ctx.ellipse(L / 2, 0, L / 2, hr * 0.17, 0, 0, TAU); ctx.fillStyle = C(K.color); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(L * (0.9 + 0.02 * up), 0, L * (0.07 + 0.06 * up), hr * 0.15, 0, 0, TAU); ctx.fillStyle = C(K.tip); ctx.fill();
        if (K.band) { ctx.beginPath(); ctx.ellipse(L * 0.72, 0, L * 0.05, hr * 0.15, 0, 0, TAU); ctx.fillStyle = C(K.band); ctx.fill(); }
        ctx.restore();
      }
    } else if (K.type === "crown") {   // peafowl: a sheaf of bare shafts tipped with tiny fans
      for (var j = 0; j < (K.n || 11); j++) {
        var g = j / ((K.n || 11) - 1), A2 = lerp(-2.0, -1.2, g), L2 = K.len * (0.85 + 0.15 * Math.sin(g * Math.PI));
        var x2 = Math.cos(A2) * L2, y2 = -hr * 0.6 + Math.sin(A2) * L2;
        ctx.strokeStyle = C(K.color); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-hr * 0.1, -hr * 0.6); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.fillStyle = C(K.tip); ctx.beginPath(); ctx.ellipse(x2, y2, 1.6, 1.0, A2, 0, TAU); ctx.fill();
      }
    } else if (K.type === "plumes") {  // pond heron: long nape plumes trailing back
      ctx.strokeStyle = C(K.color); ctx.lineCap = "round";
      for (var p = 0; p < 3; p++) { ctx.lineWidth = 1.2 - p * 0.3; ctx.beginPath(); ctx.moveTo(-hr * 0.5, -hr * 0.2); ctx.quadraticCurveTo(-hr * 1.6, hr * 0.1 + p, -hr * 1.5 - K.len, hr * 1.2 + p * 2); ctx.stroke(); }
    } else if (K.type === "tuft") {    // a soft rounded crest
      ctx.beginPath(); ctx.ellipse(-hr * 0.35, -hr * 0.85, hr * 0.62, hr * 0.38 * (0.8 + up * 0.4), -0.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawComb(ctx, D, hr, C, ink, lw) { // junglefowl comb: sawtooth along the crown
    ctx.beginPath(); ctx.moveTo(hr * 0.75, -hr * 0.6);
    for (var i = 0; i <= 6; i++) {
      var t = i / 6, x = lerp(hr * 0.75, -hr * 0.7, t), y = -hr * (0.75 + 0.35 * Math.sin(t * Math.PI));
      ctx.lineTo(x + hr * 0.08, y - hr * 0.42); ctx.lineTo(x - hr * 0.06, y);
    }
    ctx.lineTo(-hr * 0.7, -hr * 0.5); ctx.closePath(); ctx.fillStyle = C(D.comb); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = lw * 0.7; ctx.stroke();
  }

  function drawHackles(ctx, p0, c, p1, D, C, ink) {
    ctx.save(); ctx.lineCap = "round";
    for (var i = 0; i < 26; i++) {
      var t = i / 25, u = 1 - t;
      var x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
      ctx.strokeStyle = C(i % 3 ? D.hackles : D.col.back); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x + 2, y - 3); ctx.quadraticCurveTo(x - 4, y + 3, x - 7 - 4 * u, y + 8 + 3 * u); ctx.stroke();
    }
    ctx.restore();
  }

  function drawWingFolded(ctx, D, a, b, C, ink, lw, seed, st, carve) {
    var W = D.wing, c = D.col; // [length (× body half-length), depth (× body half-height), colour, tip colour, tip drop]
    var len = a * W[0] * 1.55, dep = b * W[1] * 0.95, lift = (st.wingLift || 0) * b * 0.3;
    var S = [a * 0.5, -b * 0.42 - lift], T = [S[0] - len, -b * 0.02 + (W[4] || 0)];
    // a teardrop along the axis S→T: blunt at the shoulder, pointed at the primaries
    var top = [], bot = [];
    for (var i = 0; i <= 24; i++) {
      var u = i / 24, x = lerp(S[0], T[0], u), y = lerp(S[1], T[1], u) + Math.sin(u * Math.PI) * dep * 0.12;
      var w = dep * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.9) * (1 - 0.25 * u);
      top.push([x, y - w * 0.32]); bot.push([x, y + w * 0.78]);
    }
    var pts = top.concat(bot.reverse());
    smooth(ctx, pts); ctx.fillStyle = C(W[2] || c.back); ctx.fill();
    ctx.save(); smooth(ctx, pts); ctx.clip();
    if (W[3]) { // primaries: the back third, darker
      ctx.fillStyle = C(W[3]); ctx.beginPath(); ctx.ellipse(T[0] + len * 0.08, T[1] + dep * 0.1, len * 0.36, dep * 1.1, 0, 0, TAU); ctx.fill();
    }
    if (D.wingBars) D.wingBars.forEach(function (bar) { // [position 0..1 along wing, width, colour, angle]
      var x = lerp(S[0], T[0], bar[0]); ctx.fillStyle = C(bar[2]);
      ctx.save(); ctx.translate(x, lerp(S[1], T[1], bar[0])); ctx.rotate(bar[3] || 0.35); ctx.fillRect(-bar[1] / 2, -dep * 2, bar[1], dep * 4); ctx.restore();
    });
    if (D.wingPat) pattern(ctx, Object.assign({}, D.wingPat, { color: C(D.wingPat.color), fill: D.wingPat.fill && C(D.wingPat.fill) }), [T[0], S[1] - dep, S[0], S[1] + dep * 1.4], seed + 7);
    if (D.wingPatch) { ctx.fillStyle = C(D.wingPatch[1]); ctx.beginPath(); ctx.ellipse(lerp(S[0], T[0], D.wingPatch[0] + D.wingPatch[2] * 0.5), lerp(S[1], T[1], D.wingPatch[0]) + dep * 0.32, len * D.wingPatch[2], dep * 0.2, 0.06, 0, TAU); ctx.fill(); }
    // coverts as a row of scallops, then the long flight feathers as lines
    ctx.strokeStyle = hexA(carve ? "#2a1606" : ink, carve ? 0.45 : 0.25); ctx.lineWidth = 0.45;
    for (var k = 0; k < 6; k++) { var u2 = 0.1 + k * 0.07; ctx.beginPath(); ctx.arc(lerp(S[0], T[0], u2), lerp(S[1], T[1], u2) + dep * 0.25, dep * 0.22, 0.2, Math.PI - 0.2); ctx.stroke(); }
    for (var f = 0; f < 6; f++) { var v = f / 5; ctx.beginPath(); ctx.moveTo(lerp(S[0], T[0], 0.42), S[1] + dep * (0.05 + 0.5 * v)); ctx.quadraticCurveTo(lerp(S[0], T[0], 0.75), T[1] + dep * (0.1 + 0.35 * v), T[0] + len * 0.02 * f, T[1] + dep * 0.05 * f); ctx.stroke(); }
    ctx.restore();
    smooth(ctx, pts); ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();
  }

  function drawWingFlap(ctx, D, a, b, bodyCy, tilt, C, ink, lw, st) {
    var ph = Math.sin(st.flap || 0), W = D.wing, span = a * (W[0] + 0.6) * 1.2;
    ctx.save(); ctx.translate(a * 0.1, bodyCy - b * 0.3);
    [1, -1].forEach(function (side) {
      var tipY = -ph * span * (side > 0 ? 1 : 0.7), tipX = -a * 0.5 + side * 2;
      ctx.beginPath(); ctx.moveTo(a * 0.3, 0); ctx.quadraticCurveTo(a * 0.1, tipY * 0.6 - 4, tipX, tipY);
      ctx.quadraticCurveTo(-a * 0.2, tipY * 0.3 + 4, -a * 0.35, 2); ctx.closePath();
      ctx.fillStyle = C(side > 0 ? (W[2] || D.col.back) : mix(W[2] || D.col.back, "#000000", 0.25)); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();
    });
    ctx.restore();
  }

  function drawTail(ctx, D, rump, st, C, ink, lw) {
    var T = D.tail; // [len, w0, w1, angle(deg), color, fork, round, whiteTip, outer]
    var ang = (T[3] + (st.cock || 0) * (T[9] || 25)) * Math.PI / 180;
    var len = T[0], w0 = T[1], w1 = T[2];
    ctx.save(); ctx.translate(rump[0], rump[1]); ctx.rotate(ang);
    var fork = T[5] || 0, round = T[6] || 0;
    var pts = [[0, -w0 / 2], [len, -w1 / 2]];
    if (fork) { pts.push([len - fork * 0.3, -w1 * 0.25], [len - fork, 0], [len - fork * 0.3, w1 * 0.25]); }
    else if (round) { for (var i = 1; i < 8; i++) { var th = -Math.PI / 2 + i / 8 * Math.PI; pts.push([len + Math.cos(th) * round, Math.sin(th) * w1 / 2]); } }
    pts.push([len, w1 / 2], [0, w0 / 2]);
    if (fork) { // flared outer feathers curl outward
      pts[1] = [len + fork * 0.15, -w1 / 2 - fork * 0.12]; pts[pts.length - 2] = [len + fork * 0.15, w1 / 2 + fork * 0.12];
    }
    poly(ctx, pts); ctx.fillStyle = C(T[4] || D.col.back); ctx.fill();
    ctx.save(); poly(ctx, pts); ctx.clip();
    if (T[8]) { ctx.fillStyle = C(T[8]); ctx.fillRect(len * 0.25, w1 * 0.2, len, w1); } // outer feathers (magpie-robin white)
    if (T[7]) { // pale tips: a band across the end, scalloped
      ctx.fillStyle = C(T[7]);
      for (var k = -3; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(len + round * 0.6, k * w1 / 6, len * 0.12, w1 / 9, 0, 0, TAU); ctx.fill(); }
    }
    if (D.tailBars) { ctx.fillStyle = C(D.tailBars[1]); for (var q = 0; q < D.tailBars[0]; q++) ctx.fillRect(len * (0.2 + q * 0.8 / D.tailBars[0]), -w1, len * 0.8 / D.tailBars[0] * 0.45, w1 * 2); }
    ctx.strokeStyle = hexA(ink, 0.25); ctx.lineWidth = 0.4;
    for (var f = -2; f <= 2; f++) { ctx.beginPath(); ctx.moveTo(0, f * w0 / 6); ctx.lineTo(len, f * w1 / 5); ctx.stroke(); }
    ctx.restore();
    poly(ctx, pts); ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();
    if (D.streamers) { ctx.strokeStyle = C(T[4]); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len + D.streamers, 0.5); ctx.stroke(); }
    ctx.restore();
  }

  function drawSickle(ctx, D, rump, st, C, ink, lw) { // junglefowl: arching sickle feathers
    var S = D.sickle, sway = Math.sin((st.t || 0) * 1.3) * 0.04;
    ctx.save(); ctx.translate(rump[0], rump[1]); ctx.lineCap = "round";
    for (var i = 0; i < S.n; i++) {
      var f = i / (S.n - 1), L = S.len * (0.6 + 0.4 * Math.sin(f * Math.PI * 0.9 + 0.3));
      var a0 = -0.9 + f * 0.9 + sway;
      ctx.strokeStyle = C(i % 2 ? S.color : S.color2); ctx.lineWidth = S.w * (1 - f * 0.4);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-L * 0.5 + Math.cos(a0) * 4, -L * 0.75 + f * L * 0.4, -L * (0.7 + 0.2 * f), -L * 0.1 + f * L * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* peafowl: the train folded behind, eyespots on a golden-angle spiral */
  function eyespot(ctx, x, y, s, C) {
    ctx.fillStyle = C("#2e6b3a"); ctx.beginPath(); ctx.ellipse(x, y, s * 1.25, s * 1.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C("#b8862f"); ctx.beginPath(); ctx.ellipse(x, y, s * 0.95, s * 1.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C("#1f8a8a"); ctx.beginPath(); ctx.ellipse(x, y, s * 0.68, s * 0.85, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C("#16245e"); ctx.beginPath(); ctx.ellipse(x, y + s * 0.1, s * 0.42, s * 0.5, 0, 0, TAU); ctx.fill();
  }
  function drawTrainFolded(ctx, D, rump, st, C, ink, lw, seed) {
    var Tr = D.train, L = Tr.len, ang = Tr.ang * Math.PI / 180;
    ctx.save(); ctx.translate(rump[0], rump[1]); ctx.rotate(ang);
    var pts = [[0, -5], [L * 0.5, -Tr.w * 0.55], [L, -Tr.w * 0.22], [L * 1.04, 0], [L, Tr.w * 0.22], [L * 0.5, Tr.w * 0.55], [0, 5]];
    smooth(ctx, pts); ctx.fillStyle = C(Tr.color); ctx.fill();
    ctx.save(); smooth(ctx, pts); ctx.clip();
    ctx.strokeStyle = hexA(C("#c9d77a"), 0.5); ctx.lineWidth = 0.4;
    for (var k = -6; k <= 6; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.5, k * Tr.w * 0.05, L, k * Tr.w * 0.035); ctx.stroke(); }
    for (var i = 6; i < 70; i++) { // Fermat spiral, stretched along the train
      var r = Math.sqrt(i) / Math.sqrt(70), th = i * GOLD;
      var x = L * (0.25 + 0.75 * (0.5 + 0.5 * r * Math.cos(th))), y = Tr.w * 0.42 * r * Math.sin(th);
      eyespot(ctx, x, y, 1.6 + 1.2 * r, C);
    }
    ctx.restore(); smooth(ctx, pts); ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();
    ctx.restore();
  }
  function drawTrainFan(ctx, D, base, st, C, ink, seed) {
    var Tr = D.train, R = Tr.len * 0.85 * (st.display || 0), n = 140;
    if (R < 2) return;
    ctx.save(); ctx.translate(base[0], base[1]);
    var shiver = Math.sin((st.t || 0) * 38) * 0.012 * (st.display || 0);
    for (var i = n; i > 0; i--) { // shafts first
      var th = -Math.PI + (i * GOLD % Math.PI), rr = R * (0.55 + 0.45 * Math.sqrt(i / n));
      ctx.strokeStyle = C("#8d9a4a"); ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(th + shiver) * rr, Math.sin(th + shiver) * rr); ctx.stroke();
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = C("#3e6e2c"); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 0.98, Math.PI, TAU); ctx.closePath(); ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
    for (var j = n; j > 10; j--) { // Vogel's model: radius ∝ √i, angle = i·golden angle, folded into the upper half
      var t2 = j * GOLD, a = -Math.PI + (((t2 % TAU) + TAU) % TAU) / 2, r2 = R * Math.sqrt(j / n);
      eyespot(ctx, Math.cos(a + shiver) * r2, Math.sin(a + shiver) * r2, 1.2 + 2.6 * Math.sqrt(j / n), C);
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------------------- */
  /* owls face you                                                            */
  /* ----------------------------------------------------------------------- */
  function drawOwl(ctx, sp, st) {
    var D = sp.draw, c = D.col, ink = st.ink || "#1b140e", lw = st.lw != null ? st.lw : 0.9, seed = hash(sp.slug);
    var carve = st.carve; function C(x) { return carve ? carve(x) : x; }
    var a = D.body[0], b = D.body[1], hr = D.head[0];
    var breathe = 1 + 0.02 * Math.sin((st.t || 0) * 2 + seed);
    ctx.save(); ctx.lineJoin = "round";
    // feet
    ctx.strokeStyle = C(D.legs ? D.legs[1] : "#888"); ctx.lineWidth = 1.4;
    [-a * 0.3, a * 0.3].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x, 0); ctx.moveTo(x - 2, 0); ctx.lineTo(x + 2, 0); ctx.stroke(); });
    // tail
    ctx.fillStyle = C(c.back); ctx.beginPath(); ctx.moveTo(-a * 0.25, -b * 0.4); ctx.lineTo(-a * 0.2, 2); ctx.lineTo(a * 0.2, 2); ctx.lineTo(a * 0.25, -b * 0.4); ctx.fill();
    // body: an upright egg
    var cy = -b - 3;
    ctx.save(); ctx.translate(0, cy); ctx.scale(breathe, breathe);
    var pts = bodyPts(b, a, 2.1, -0.1).map(function (p) { return [p[1], -p[0]]; });
    smooth(ctx, pts); ctx.fillStyle = C(c.belly); ctx.fill();
    ctx.save(); smooth(ctx, pts); ctx.clip();
    if (D.pat) D.pat.forEach(function (P, i) { pattern(ctx, Object.assign({}, P, { color: C(P.color) }), [-a, -b, a, b], seed + i); });
    // wings at the sides
    ctx.fillStyle = C(c.back);
    [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.ellipse(s * a * 0.78, -b * 0.05, a * 0.42, b * 0.95, s * 0.12, 0, TAU); ctx.fill(); });
    if (D.wingPat) [-1, 1].forEach(function (s) { ctx.save(); ctx.beginPath(); ctx.ellipse(s * a * 0.78, -b * 0.05, a * 0.42, b * 0.95, s * 0.12, 0, TAU); ctx.clip(); pattern(ctx, Object.assign({}, D.wingPat, { color: C(D.wingPat.color) }), [-a * 1.3, -b, a * 1.3, b], seed + 5); ctx.restore(); });
    engrave(ctx, pts, 0, b * 0.4, carve ? "#2a1606" : ink, carve ? 5 : 2, carve ? 0.3 : 0.05);
    ctx.restore(); smooth(ctx, pts); ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();
    ctx.restore();
    // head
    var hy = cy - b * 0.95 - hr * 0.55 + (st.bob || 0), turn = (st.turn || 0) * 0.5;
    ctx.save(); ctx.translate(0, hy); ctx.rotate(turn * 0.4);
    ctx.beginPath(); ctx.ellipse(0, 0, hr * 1.12, hr, 0, 0, TAU); ctx.fillStyle = C(c.head || c.back); ctx.fill();
    ctx.save(); ctx.clip(); if (D.headPat) pattern(ctx, Object.assign({}, D.headPat, { color: C(D.headPat.color) }), [-hr * 1.2, -hr, hr * 1.2, hr], seed + 2); ctx.restore();
    ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();
    var dx = turn * hr * 0.35;
    if (D.disc === "heart") { // barn owl: the heart curve x=16sin³t, y=13cos t−5cos2t−2cos3t−cos4t
      ctx.beginPath();
      for (var i = 0; i <= 80; i++) {
        var t = i / 80 * TAU, x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        ctx.lineTo(dx + x * hr / 17, -y * hr / 17 + hr * 0.1);
      }
      ctx.closePath(); ctx.fillStyle = C(c.face); ctx.fill(); ctx.strokeStyle = C(c.rim || "#b98a4a"); ctx.lineWidth = hr * 0.08; ctx.stroke();
    } else if (c.face) {
      [-1, 1].forEach(function (s) { ctx.fillStyle = C(c.face); ctx.beginPath(); ctx.arc(dx + s * hr * 0.42, hr * 0.05, hr * 0.42, 0, TAU); ctx.fill(); });
    }
    if (c.brow) { ctx.strokeStyle = C(c.brow); ctx.lineWidth = hr * 0.12; [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.arc(dx + s * hr * 0.36, hr * 0.02, hr * 0.38, s > 0 ? -2.6 : -2.5, s > 0 ? -0.6 : -0.5); ctx.stroke(); }); }
    var E = D.eye, blink = st.blink || 0;
    [-1, 1].forEach(function (s) {
      ctx.save(); ctx.translate(dx + s * hr * E[0], hr * E[1]); ctx.scale(1, Math.max(0.08, 1 - blink));
      ctx.fillStyle = C(E[3]); ctx.beginPath(); ctx.arc(0, 0, hr * E[2], 0, TAU); ctx.fill();
      ctx.fillStyle = "#0b0806"; ctx.beginPath(); ctx.arc(0, 0, hr * E[2] * (E[3] === "#0b0806" ? 0.95 : 0.55), 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(hr * E[2] * 0.3, -hr * E[2] * 0.35, hr * E[2] * 0.25, 0, TAU); ctx.fill();
      ctx.restore();
    });
    // bill: a small hook, opening a little
    var g = (st.gape || 0) * 2;
    ctx.fillStyle = C(D.bill[4]); ctx.beginPath(); ctx.moveTo(dx - hr * 0.1, hr * 0.28); ctx.lineTo(dx + hr * 0.1, hr * 0.28); ctx.quadraticCurveTo(dx + hr * 0.05, hr * 0.55 + g, dx, hr * 0.62 + g); ctx.quadraticCurveTo(dx - hr * 0.05, hr * 0.5 + g, dx - hr * 0.1, hr * 0.28); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* a bird in flight seen from the side, small: two arcs that beat */
  function drawFlier(ctx, x, y, s, phase, color, ink) {
    var w = Math.sin(phase);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-6, -w * 5); ctx.quadraticCurveTo(-3, -1 - w * 2, 0, 0); ctx.quadraticCurveTo(3, -1 - w * 2, 6, -w * 5);
    ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.lineCap = "round"; ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0.2, 1.6, 0.9, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function draw(ctx, sp, st) { (sp.draw.face === "front" ? drawOwl : drawSide)(ctx, sp, st || {}); }

  /* bounding size, for fitting a bird into a box: [left, top, right, bottom] in body units */
  function extent(sp) {
    var D = sp.draw;
    if (D.face === "front") { var a0 = D.body[0], b0 = D.body[1], h0 = D.head[0]; return [-a0 * 1.25, -(2 * b0 + 3 + h0 * 1.6), a0 * 1.25, 3]; }
    var a = D.body[0], b = D.body[1], legL = D.legs ? D.legs[0] : 8, H = D.head;
    var top = -(legL + b * 1.8) + Math.min(0, H[2] - H[0] - (D.crest ? D.crest.len * 0.9 : 0));
    var right = a * 0.62 + H[1] + H[0] + D.bill[0] + 2;
    var tl = D.tail ? D.tail[0] : 0, tr = D.train ? D.train.len : 0, sk = D.sickle ? D.sickle.len : 0;
    var left = -a * 0.9 - (D.tail ? D.tail[2] * 0.6 : 0) - Math.max(tl * Math.abs(Math.cos(D.tail ? D.tail[3] * Math.PI / 180 : 0)), tr * 0.95, sk * 0.85) - 2;
    var bottom = Math.max(3, D.tail ? -(legL + b * 0.82) + tl * Math.sin(D.tail[3] * Math.PI / 180) + 4 : 3, D.train ? -(legL + b * 0.82) + tr * Math.sin(D.train.ang * Math.PI / 180) + 8 : 3);
    return [left, top, right, bottom];
  }

  /* draw a bird fitted into a box (x, y, w, h); returns the transform used */
  function fit(ctx, sp, st, x, y, w, h, pad, flip) {
    var e = extent(sp), bw = e[2] - e[0], bh = e[3] - e[1], s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
    ctx.save();
    var ox = x + w / 2 - (e[0] + bw / 2) * s * (flip ? -1 : 1), oy = y + h / 2 - (e[1] + bh / 2) * s;
    ctx.translate(ox, oy); ctx.scale(flip ? -s : s, s);
    draw(ctx, sp, st);
    ctx.restore();
    return { ox: ox, oy: oy, s: s };
  }

  /* a teak palette: any colour → wood, by its luminance */
  function teak(hex) {
    if (!hex || hex[0] !== "#") return hex;
    var n = parseInt(hex.slice(1).length === 3 ? hex.slice(1).replace(/./g, "$&$&") : hex.slice(1), 16);
    var l = (0.3 * (n >> 16 & 255) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255)) / 255;
    return mix("#3b1f0c", "#d9a35c", Math.pow(l, 0.8) * 0.85 + 0.12);
  }

  G.BIRD = { draw: draw, fit: fit, extent: extent, flier: drawFlier, teak: teak, mix: mix, hexA: hexA, rng: rng, hash: hash, GOLD: GOLD };
})(window);
