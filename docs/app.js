/* app.js — the sky over Doi Suthep, the Coucal Clock, the birds, the chorus, the mountain,
 * the legends, and the spectrogram that shows every sound on the page as it plays. */
(function () {
  "use strict";
  var LANG = document.documentElement.lang === "th" ? "th" : "en";
  var ROOT = document.documentElement.getAttribute("data-root") || "";
  var DATA = window.BIRDS, B = DATA.birds, BY = {}, CRED = window.CREDITS || {};
  B.forEach(function (b) { BY[b.slug] = b; });
  var S = window.SKY, BD = window.BIRD, TAU = Math.PI * 2;
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function T(o) { return o ? (o[LANG] || o.en) : ""; }
  function name(sp) { return LANG === "th" ? sp.th : sp.en; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function gauss(x, m, s) { var d = (x - m) / s; return Math.exp(-0.5 * d * d); }
  function setup(cv, aspect) {
    var r = cv.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = aspect ? Math.round(w * aspect) : Math.max(1, Math.round(r.height));
    if (aspect) cv.style.height = h + "px";
    if (cv.width !== Math.round(w * DPR) || cv.height !== Math.round(h * DPR)) { cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR); }
    var ctx = cv.getContext("2d"); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }
  function fmtHM(ms) { return S.hhmm(ms); }
  function fmtCount(sec) { sec = Math.max(0, Math.round(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s; }
  var L = window.UI || {};   // interface strings for this language, written by build.py

  /* ======================================================================= */
  /* sound                                                                    */
  /* ======================================================================= */
  var AU = { ctx: null, master: null, an: null, bufs: {}, loading: {}, playing: [] };
  function actx() {
    if (!AU.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      AU.ctx = new AC(); AU.master = AU.ctx.createGain(); AU.master.gain.value = 0.95;
      AU.an = AU.ctx.createAnalyser(); AU.an.fftSize = 2048; AU.an.smoothingTimeConstant = 0.15;
      AU.master.connect(AU.an); AU.an.connect(AU.ctx.destination);
    }
    if (AU.ctx.state === "suspended") AU.ctx.resume();
    return AU.ctx;
  }
  function hasAudio(slug) { return !!(CRED[slug] && CRED[slug].audio); }
  function load(slug) {
    if (AU.bufs[slug]) return Promise.resolve(AU.bufs[slug]);
    if (AU.loading[slug]) return AU.loading[slug];
    var c = actx();
    AU.loading[slug] = fetch(ROOT + CRED[slug].audio.file).then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { c.decodeAudioData(ab, res, rej); }); })
      .then(function (b) { AU.bufs[slug] = b; return b; });
    return AU.loading[slug];
  }
  function play(slug, opt) {
    opt = opt || {};
    if (!hasAudio(slug) || !actx()) return null;
    var c = AU.ctx, h = { slug: slug, stopped: false, an: null };
    load(slug).then(function (buf) {
      if (h.stopped) return;
      var src = c.createBufferSource(); src.buffer = buf;
      var g = c.createGain(), an = c.createAnalyser(); an.fftSize = 512;
      src.connect(g); g.connect(an);
      if (c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = clamp(opt.pan || 0, -1, 1); an.connect(p); p.connect(AU.master); }
      else an.connect(AU.master);
      var vol = opt.gain == null ? 1 : opt.gain, dur = Math.min(buf.duration, opt.max || buf.duration), t0 = c.currentTime + 0.02;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.06);
      g.gain.setValueAtTime(vol, Math.max(t0 + 0.07, t0 + dur - 0.5)); g.gain.linearRampToValueAtTime(0, t0 + dur);
      src.start(t0, 0, dur);
      h.src = src; h.g = g; h.an = an; h.buf = buf; h.dur = dur; h.t0 = t0; h.data = new Float32Array(an.fftSize);
      src.onended = function () { h.stopped = true; AU.playing = AU.playing.filter(function (x) { return x !== h; }); if (opt.onend) opt.onend(h); dockSync(); };
      AU.playing.push(h); if (opt.onstart) opt.onstart(h, buf); dockSync();
      measureLater(slug, buf);
    }).catch(function (e) { h.stopped = true; console.warn(slug, e); });
    return h;
  }
  function level(h) {
    if (!h || !h.an || h.stopped) return 0;
    if (h.an.getFloatTimeDomainData) h.an.getFloatTimeDomainData(h.data);
    var s = 0; for (var i = 0; i < h.data.length; i++) s += h.data[i] * h.data[i];
    return clamp(Math.sqrt(s / h.data.length) * 7, 0, 1);
  }
  function stop(h) {
    if (!h) return; h.stopped = true;
    try { if (h.g) h.g.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.04); if (h.src) h.src.stop(AU.ctx.currentTime + 0.2); } catch (e) { }
  }
  function stopAll() { AU.playing.slice().forEach(stop); Chorus.stop(); Scene.ambientOff(); }

  /* --- measure a recording: count the calls, find their pitch ------------- */
  function fft(re, im) {
    var n = re.length, i, j = 0, k;
    for (i = 1; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { k = re[i]; re[i] = re[j]; re[j] = k; k = im[i]; im[i] = im[j]; im[j] = k; } }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (j = 0; j < len / 2; j++) {
          var ar = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, ai = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
          re[i + j + len / 2] = re[i + j] - ar; im[i + j + len / 2] = im[i + j] - ai; re[i + j] += ar; im[i + j] += ai;
          var t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  var MEAS = {};
  function measure(buf) {
    var d = buf.getChannelData(0), sr = buf.sampleRate, hop = Math.round(sr * 0.01), n = Math.floor(d.length / hop), env = new Float32Array(n), i, j;
    for (i = 0; i < n; i++) { var s = 0; for (j = 0; j < hop; j++) { var v = d[i * hop + j]; s += v * v; } env[i] = Math.sqrt(s / hop); }
    var sorted = Array.prototype.slice.call(env).sort(function (a, b) { return a - b; });
    var peak = sorted[n - 1] || 0, med = sorted[n >> 1] || 0, thr = Math.max(peak * 0.24, med * 2.6);
    var notes = [], on = -1, gap = 0;
    for (i = 0; i < n; i++) {
      if (env[i] > thr) { if (on < 0) on = i; gap = 0; }
      else if (on >= 0) { gap++; if (gap > 6) { if (i - gap - on >= 3) notes.push([on, i - gap]); on = -1; gap = 0; } }
    }
    if (on >= 0 && n - on >= 3) notes.push([on, n - 1]);
    var N = 4096, re = new Float64Array(N), im = new Float64Array(N), freqs = [];
    notes.forEach(function (nt) {
      // the loudest frame in the note
      var best = nt[0]; for (var q = nt[0]; q <= nt[1]; q++) if (env[q] > env[best]) best = q;
      var c = Math.round(best * hop + hop / 2 - N / 2);
      for (var m = 0; m < N; m++) { var x = d[c + m] || 0; re[m] = x * (0.5 - 0.5 * Math.cos(TAU * m / (N - 1))); im[m] = 0; }
      fft(re, im);
      var bi = 0, bm = 0, lo = Math.round(250 * N / sr), hi = Math.round(11000 * N / sr);
      for (var k = lo; k < hi; k++) { var mg = re[k] * re[k] + im[k] * im[k]; if (mg > bm) { bm = mg; bi = k; } }
      freqs.push(bi * sr / N);
    });
    freqs.sort(function (a, b) { return a - b; });
    var starts = notes.map(function (nt) { return nt[0] * 0.01; }), gaps = [];
    for (i = 1; i < starts.length; i++) gaps.push(starts[i] - starts[i - 1]);
    gaps.sort(function (a, b) { return a - b; });
    return {
      secs: buf.duration, n: notes.length,
      lo: freqs.length ? freqs[Math.floor(freqs.length * 0.1)] : 0, hi: freqs.length ? freqs[Math.floor(freqs.length * 0.9)] : 0,
      gap: gaps.length >= 2 ? gaps[gaps.length >> 1] : 0
    };
  }
  function roundHz(f) { return f < 1000 ? Math.round(f / 10) * 10 : Math.round(f / 100) * 100; }
  function fmtNum(x) { return x.toLocaleString(LANG === "th" ? "th-TH" : "en-US"); }
  function measureLater(slug, buf) {
    if (MEAS[slug]) return;
    var go = function () {
      MEAS[slug] = measure(buf); var m = MEAS[slug];
      document.querySelectorAll('[data-measure="' + slug + '"]').forEach(function (el) {
        var parts = [L.m_secs.replace("{s}", m.secs.toFixed(1)), L.m_calls.replace("{n}", m.n)];
        if (m.lo) parts.push(m.hi - m.lo > 60 ? L.m_range.replace("{lo}", fmtNum(roundHz(m.lo))).replace("{hi}", fmtNum(roundHz(m.hi))) : L.m_pitch.replace("{hz}", fmtNum(roundHz(m.lo))));
        if (m.gap) parts.push(L.m_gap.replace("{g}", m.gap.toFixed(2)));
        el.textContent = L.m_lead + " " + parts.join(" · ");
        el.hidden = false;
      });
    };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 400);
  }

  /* --- the spectrogram dock --------------------------------------------- */
  var dock = document.getElementById("dock"), dockCv = dock.querySelector("canvas"), dockName = dock.querySelector(".dn"), dockHz = dock.querySelector(".dh");
  dock.querySelector("button").addEventListener("click", stopAll);
  var freqData = null, colCache = null;
  function cmap(v) { // ink → indigo → teal → gold → paper
    var st = [[0, 18, 14, 32], [0.3, 42, 46, 110], [0.55, 24, 140, 150], [0.8, 236, 178, 60], [1, 255, 246, 220]];
    for (var i = 1; i < st.length; i++) if (v <= st[i][0]) { var t = (v - st[i - 1][0]) / (st[i][0] - st[i - 1][0]); return [lerp(st[i - 1][1], st[i][1], t), lerp(st[i - 1][2], st[i][2], t), lerp(st[i - 1][3], st[i][3], t)]; }
    return [255, 246, 220];
  }
  var CMAP = []; for (var ci = 0; ci < 256; ci++) CMAP.push(cmap(ci / 255));
  function dockSync() {
    var on = AU.playing.length > 0;
    dock.classList.toggle("on", on);
    if (on) {
      var seen = {}, names = [];
      AU.playing.forEach(function (h) { if (!seen[h.slug]) { seen[h.slug] = 1; names.push(name(BY[h.slug])); } });
      dockName.textContent = names.slice(0, 4).join(" · ") + (names.length > 4 ? " +" + (names.length - 4) : "");
    }
  }
  function dockDraw() {
    if (!dock.classList.contains("on") || !AU.an) return;
    var w = dockCv.clientWidth, h = dockCv.clientHeight;
    var W = Math.round(w * DPR), H = Math.round(h * DPR);
    if (dockCv.width !== W || dockCv.height !== H) { dockCv.width = W; dockCv.height = H; colCache = null; }
    var ctx = dockCv.getContext("2d");
    if (!freqData) freqData = new Uint8Array(AU.an.frequencyBinCount);
    AU.an.getByteFrequencyData(freqData);
    var shift = Math.max(1, Math.round(2 * DPR));
    ctx.drawImage(dockCv, -shift, 0);
    if (!colCache || colCache.height !== H) colCache = ctx.createImageData(shift, H);
    var sr = AU.ctx.sampleRate, nb = freqData.length, fmin = 150, fmax = 12000, best = 0, bestF = 0;
    for (var y = 0; y < H; y++) {
      var f = fmin * Math.pow(fmax / fmin, 1 - y / H), bin = Math.min(nb - 1, Math.round(f / (sr / 2) * nb)), v = freqData[bin];
      if (v > best && f > 250) { best = v; bestF = f; }
      var c = CMAP[v];
      for (var x = 0; x < shift; x++) { var o = (y * shift + x) * 4; colCache.data[o] = c[0]; colCache.data[o + 1] = c[1]; colCache.data[o + 2] = c[2]; colCache.data[o + 3] = 255; }
    }
    ctx.putImageData(colCache, W - shift, 0);
    if (best > 90) dockHz.textContent = "≈ " + fmtNum(roundHz(bestF)) + " Hz";
  }

  /* ======================================================================= */
  /* bird state: breathing, blinking, glancing, singing                       */
  /* ======================================================================= */
  function newState(seed) { return { t: seed || 0, gape: 0, blink: 0, turn: 0, turnTo: 0, cock: 0, crest: 0, display: 0, nb: 2 + Math.random() * 3, nt: 1 + Math.random() * 3, h: null, until: 0 }; }
  function stepState(st, sp, dt) {
    st.t += dt;
    st.nb -= dt; if (st.nb < 0) { st.blinkT = 0.16; st.nb = 2.5 + Math.random() * 4; }
    if (st.blinkT > 0) { st.blinkT -= dt; st.blink = Math.sin(clamp(1 - st.blinkT / 0.16, 0, 1) * Math.PI); } else st.blink = 0;
    st.nt -= dt; if (st.nt < 0) { st.turnTo = (Math.random() * 2 - 1) * 0.5; st.nt = 1.2 + Math.random() * 3; if (Math.random() < 0.35) st.cockKick = 1; }
    st.turn += (st.turnTo - st.turn) * Math.min(1, dt * 6);
    if (st.cockKick) { st.cock = 1; st.cockKick = 0; } st.cock *= Math.pow(0.04, dt);
    var singing = st.h && !st.h.stopped, lv = singing ? level(st.h) : 0;
    st.gape += (lv * 1.3 - st.gape) * Math.min(1, dt * 18);
    var crestTo = singing ? 1 : 0; st.crest += (crestTo - st.crest) * Math.min(1, dt * 3);
    var dispTo = (singing || st.until > st.t) && sp.draw.train ? 1 : 0; st.display += (dispTo - st.display) * Math.min(1, dt * 2.2);
    if (singing && Math.random() < dt * 2) st.cockKick = 1;
    st.bob = singing ? -Math.abs(Math.sin(st.t * 9)) * lv * 1.2 : 0;
  }

  /* ======================================================================= */
  /* activity: how much a bird sings at a given moment                        */
  /* ======================================================================= */
  var dayCache = {};
  function daySun(ms, where) {
    where = where || S.CM;
    var k = Math.floor((ms + S.TZ * 3600000) / 86400000) + ":" + where.lat;
    if (!dayCache[k]) dayCache[k] = S.sunDay(ms, where.lat, where.lon);
    return dayCache[k];
  }
  function activity(sp, ms) {
    var A = sp.act || {}, d = daySun(ms), m = (ms - S.localMidnight(ms)) / 60000;
    var dawn = (d.dawn - S.localMidnight(ms)) / 60000, rise = (d.rise - S.localMidnight(ms)) / 60000, set = (d.set - S.localMidnight(ms)) / 60000, dusk = (d.dusk - S.localMidnight(ms)) / 60000;
    var a = 0;
    if (A.predawn) a = Math.max(a, A.predawn * gauss(m, dawn - 45, 32));
    if (A.dawn) a = Math.max(a, A.dawn * gauss(m, dawn + 12, 28));
    if (A.morning) a = Math.max(a, A.morning * gauss(m, rise + 100, 70));
    if (A.day) a = Math.max(a, A.day * smoothstep(rise, rise + 40, m) * (1 - smoothstep(set - 40, set, m)));
    if (A.dusk) a = Math.max(a, A.dusk * gauss(m, dusk - 8, 28));
    if (A.night) a = Math.max(a, A.night * Math.max(smoothstep(dusk + 10, dusk + 50, m), 1 - smoothstep(dawn - 50, dawn - 10, m)));
    var mo = S.local(ms).mo;
    if (A.hot) a *= (mo >= 1 && mo <= 5) ? 1 : 0.45;
    if (A.dry) a *= (mo >= 10 || mo <= 3) ? 1 : 0.55;
    return a;
  }
  // a colour that stands for each bird (its most telling feather)
  function birdInk(sp) {
    var c = sp.draw.col, pick = { "greater-coucal": "#a8481c", "asian-koel": "#3c4fb8", "oriental-magpie-robin": "#5a6e8a", "red-whiskered-bulbul": "#d8222c", "streak-eared-bulbul": "#a29563", "common-myna": "#e3b51c", "coppersmith-barbet": "#e0303a", "lineated-barbet": "#5a9a3a", "black-drongo": "#2b2f4a", "spotted-dove": "#c98f8f", "olive-backed-sunbird": "#e6c51e", "white-throated-kingfisher": "#2384dc", "large-tailed-nightjar": "#8d775b", "asian-barred-owlet": "#7a5a3a", "common-tailorbird": "#c46a2a", "eurasian-hoopoe": "#e0995a", "red-junglefowl": "#e8902c", "green-peafowl": "#1f8a7a", "chinese-pond-heron": "#8a3a22", "asian-openbill": "#9a9890", "green-tailed-sunbird": "#1f8a6a", "barn-owl": "#d4b48a", "eurasian-tree-sparrow": "#8a4a22" };
    return pick[sp.slug] || c.back;
  }

  /* ======================================================================= */
  /* 1  the sky over Doi Suthep                                               */
  /* ======================================================================= */
  var Scene = (function () {
    var cv = document.getElementById("scene"), slider = document.getElementById("tslider"), tlabel = document.getElementById("tlabel"), nowBtn = document.getElementById("tnow"), ambBtn = document.getElementById("tamb");
    if (!cv) return { ambientOff: function () { } };
    var QS = new URLSearchParams(location.search), live = !QS.has("t"), fixedMin = +(QS.get("t") || 0), W = 0, H = 0, ctx, skyC = document.createElement("canvas"), landC = document.createElement("canvas"), lastKey = "", hits = [], states = {}, labels = [], ambient = false, ambT = 0;
    var stars = (function () { var r = BD.rng(77), a = []; for (var i = 0; i < 520; i++) { var z = r() * 2 - 1, ra = r() * 360; a.push({ ra: ra, dec: Math.asin(z) * 180 / Math.PI, m: Math.pow(r(), 3), tw: r() * 6 }); } return a; })();
    function now() { return live ? Date.now() : S.localMidnight(Date.now()) + fixedMin * 60000; }
    function ridge(x, k) {
      var f = 0; for (var o = 1; o <= 5; o++) f += Math.sin(x * Math.pow(2, o) * 4.1 + o * 1.7 + k * 3) / Math.pow(2, o);
      var asp = Math.min(1, W / H * 0.75);
      if (k === 0) return H * (0.565 - asp * 0.17 * gauss(x, 0.24, 0.16) - 0.13 * gauss(x, 0.78, 0.2) - 0.022 * f);
      var g2 = 0; for (var o2 = 1; o2 <= 4; o2++) g2 += Math.abs(Math.sin(x * Math.pow(2.1, o2) * 7.3 + o2 * 2.9)) / Math.pow(2, o2);
      return H * (0.64 - asp * (0.11 * gauss(x, 0.36, 0.2) + 0.14 * gauss(x, 0.58, 0.15)) - 0.06 * smoothstep(0.1, 0.45, x) * (1 - smoothstep(0.75, 0.98, x)) - 0.035 * gauss(x, 0.88, 0.07) - 0.018 * f - 0.022 * g2);
    }
    function skyStops(alt) { // [zenith, horizon] by solar altitude
      var K = [[-18, "#05081a", "#0f1430"], [-12, "#0a0f2a", "#1d1f45"], [-8, "#16204c", "#4a3463"], [-4, "#2a3a78", "#c9636a"], [-1, "#3d5596", "#f08a52"], [2, "#5a86c8", "#f7b56a"], [8, "#4f8fd6", "#cfe3ee"], [30, "#3f86d6", "#c6e4f6"]];
      if (alt <= K[0][0]) return [K[0][1], K[0][2]];
      for (var i = 1; i < K.length; i++) if (alt <= K[i][0]) { var t = (alt - K[i - 1][0]) / (K[i][0] - K[i - 1][0]); return [BD.mix(K[i - 1][1], K[i][1], t), BD.mix(K[i - 1][2], K[i][2], t)]; }
      return [K[K.length - 1][1], K[K.length - 1][2]];
    }
    function azX(az) { return W / 2 + (az - 270) / 62 * W / 2; }
    function altY(alt) { return H * 0.6 - alt / 48 * H * 0.6; }
    function paintSky(ms, sun) {
      skyC.width = W * DPR; skyC.height = H * DPR; var c = skyC.getContext("2d"); c.setTransform(DPR, 0, 0, DPR, 0, 0);
      var st = skyStops(sun.alt), g = c.createLinearGradient(0, 0, 0, H * 0.7);
      g.addColorStop(0, st[0]); g.addColorStop(1, st[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
      var evening = sun.az > 180;
      // sun glow (only when the sun is in the western half we face)
      if (evening && sun.alt > -10) {
        var sx = azX(sun.az), sy = altY(sun.alt), rg = c.createRadialGradient(sx, sy, 2, sx, sy, W * 0.55);
        rg.addColorStop(0, "rgba(255,214,150," + (0.75 * smoothstep(-10, 0, sun.alt)) + ")"); rg.addColorStop(1, "rgba(255,190,120,0)");
        c.fillStyle = rg; c.fillRect(0, 0, W, H);
      }
      // dawn, sun behind us: the Earth's shadow, and the pink Belt of Venus above it
      if (!evening && sun.alt > -7 && sun.alt < 4) {
        var k = Math.sin(clamp((sun.alt + 7) / 11, 0, 1) * Math.PI), hz = H * 0.56;
        var bg = c.createLinearGradient(0, hz - H * 0.22, 0, hz);
        bg.addColorStop(0, "rgba(244,170,190,0)"); bg.addColorStop(0.55, "rgba(244,170,190," + 0.55 * k + ")"); bg.addColorStop(0.8, "rgba(110,120,170," + 0.55 * k + ")"); bg.addColorStop(1, "rgba(80,90,140," + 0.6 * k + ")");
        c.fillStyle = bg; c.fillRect(0, hz - H * 0.22, W, H * 0.22);
      }
      if (sun.alt > -1 && evening) { // the sun itself
        var px = azX(sun.az), py = altY(sun.alt);
        c.fillStyle = "rgba(255,240,200,0.95)"; c.beginPath(); c.arc(px, py, Math.max(9, W * 0.012), 0, TAU); c.fill();
      }
    }
    function paintLand(ms, sun) {
      landC.width = W * DPR; landC.height = H * DPR; var c = landC.getContext("2d"); c.setTransform(DPR, 0, 0, DPR, 0, 0);
      var st = skyStops(sun.alt), day = smoothstep(-8, 6, sun.alt), dawnLit = (sun.az < 180) ? Math.sin(clamp((sun.alt + 1) / 9, 0, 1) * Math.PI) : 0;
      var far = BD.mix(BD.mix("#151b33", "#7d8fb0", day), st[1], 0.38), near = BD.mix(BD.mix("#0c1122", "#3d5a4a", day), st[1], 0.12);
      if (dawnLit > 0) near = BD.mix(near, "#c8826a", dawnLit * 0.35);
      [[0, far], [1, near]].forEach(function (L2) {
        c.beginPath(); c.moveTo(0, H);
        for (var x = 0; x <= W; x += 3) c.lineTo(x, ridge(x / W, L2[0]));
        c.lineTo(W, H); c.closePath(); c.fillStyle = L2[1]; c.fill();
      });
      // forest texture on the near ridge: tiny crowns along contour lines
      c.save(); c.beginPath(); c.moveTo(0, H); for (var x2 = 0; x2 <= W; x2 += 3) c.lineTo(x2, ridge(x2 / W, 1)); c.lineTo(W, H); c.clip();
      var r = BD.rng(5);
      for (var i = 0; i < 900; i++) { var fx = r() * W, fy = ridge(fx / W, 1) + r() * H * 0.2; c.fillStyle = "rgba(0,0,0," + (0.05 + r() * 0.08) + ")"; c.beginPath(); c.arc(fx, fy, 1 + r() * 2.2, 0, TAU); c.fill(); }
      c.restore();
      // Wat Phra That Doi Suthep, a gold point on the slope; lit at night
      var wx = W * 0.47, wy = lerp(ridge(0.47, 1), H * 0.635, 0.42), night = 1 - day;
      var gl = c.createRadialGradient(wx, wy, 0, wx, wy, 26 * (0.4 + night));
      gl.addColorStop(0, "rgba(255,210,110," + (0.35 + 0.6 * night) + ")"); gl.addColorStop(1, "rgba(255,200,90,0)");
      c.fillStyle = gl; c.beginPath(); c.arc(wx, wy, 30, 0, TAU); c.fill();
      c.fillStyle = "#ffd77a"; c.beginPath(); c.moveTo(wx, wy - 6); c.lineTo(wx + 2.4, wy + 1.5); c.lineTo(wx - 2.4, wy + 1.5); c.fill();
      // town canopy: rain trees as clusters of circles; a chedi; palms
      var canopyY = H * 0.70, tree = BD.mix(BD.mix("#0a110d", "#2f5a32", day), st[1], 0.06);
      var r2 = BD.rng(11);
      c.fillStyle = tree;
      c.fillRect(0, canopyY, W, H * 0.12);
      for (var t = 0; t < 26; t++) {
        var tx = r2() * W, tr = W * (0.025 + r2() * 0.04), ty = canopyY - tr * 0.2;
        for (var k = 0; k < 7; k++) { var a = Math.PI + k / 6 * Math.PI; c.beginPath(); c.arc(tx + Math.cos(a) * tr * 0.8, ty + Math.sin(a) * tr * 0.45, tr * (0.42 + 0.12 * r2()), 0, TAU); c.fill(); }
      }
      // Wat Chedi Luang: square tiers, a bell, a broken top
      var cx = W * 0.73, cb = canopyY + H * 0.01, cw = W * 0.09, ch = H * 0.17;
      c.fillStyle = BD.mix(BD.mix("#1b1210", "#9a6a4a", day), st[1], 0.15);
      for (var lv = 0; lv < 4; lv++) { var ww = cw * (1 - lv * 0.18), hh = ch * 0.14; c.fillRect(cx - ww / 2, cb - hh * (lv + 1), ww, hh + 1); }
      c.beginPath(); c.moveTo(cx - cw * 0.22, cb - ch * 0.56); c.quadraticCurveTo(cx - cw * 0.24, cb - ch * 0.85, cx - cw * 0.06, cb - ch * 0.93); c.lineTo(cx + cw * 0.02, cb - ch * 0.98); c.lineTo(cx + cw * 0.09, cb - ch * 0.9); c.quadraticCurveTo(cx + cw * 0.24, cb - ch * 0.84, cx + cw * 0.22, cb - ch * 0.56); c.closePath(); c.fill();
      for (var p = 0; p < 3; p++) { var px = W * (0.12 + p * 0.33 + 0.05), base = canopyY + 4, top = canopyY - H * (0.12 + 0.03 * p); c.strokeStyle = tree; c.lineWidth = 2.2; c.beginPath(); c.moveTo(px, base); c.quadraticCurveTo(px + 6, (base + top) / 2, px + 3, top); c.stroke(); for (var f = 0; f < 9; f++) { var fa = -Math.PI / 2 + (f - 4) * 0.42; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px + 3, top); c.quadraticCurveTo(px + 3 + Math.cos(fa) * 16, top + Math.sin(fa) * 16 - 6, px + 3 + Math.cos(fa) * 30, top + Math.sin(fa) * 26 + 12); c.stroke(); } }
      // the old city wall: brick courses
      var wy0 = H * 0.8, wy1 = H * 0.845, brick = BD.mix(BD.mix("#1c1210", "#9b5a3c", day), st[1], 0.08);
      c.fillStyle = brick; c.fillRect(0, wy0, W, wy1 - wy0);
      c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.6;
      for (var by = wy0; by < wy1; by += 5) { c.beginPath(); c.moveTo(0, by); c.lineTo(W, by); c.stroke(); for (var bx = ((by - wy0) / 5 % 2) * 7; bx < W; bx += 14) { c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by + 5); c.stroke(); } }
      // the moat: the sky, flipped
      var g = c.createLinearGradient(0, wy1, 0, H); g.addColorStop(0, BD.mix(st[1], "#0b1a22", 0.35)); g.addColorStop(1, BD.mix(st[0], "#08121a", 0.45));
      c.fillStyle = g; c.fillRect(0, wy1, W, H - wy1);
    }
    function moon(c, ms) {
      var m = S.moonPos(ms, S.CM.lat, S.CM.lon); if (m.alt < -2) return;
      var x = azX(m.az), y = altY(m.alt), r = Math.max(9, W * 0.013); if (x < -20 || x > W + 20) { // keep a visible moon in frame when it is behind us but up
        if (m.alt < 8) return; x = clamp(x, W * 0.06, W * 0.94);
      }
      var sun = S.sunPos(ms, S.CM.lat, S.CM.lon), lit = m.illum, waxing = m.elong < 180;
      c.save(); c.translate(x, y);
      var gl = c.createRadialGradient(0, 0, r, 0, 0, r * 5); gl.addColorStop(0, "rgba(255,250,230," + 0.25 * lit + ")"); gl.addColorStop(1, "rgba(255,250,230,0)"); c.fillStyle = gl; c.beginPath(); c.arc(0, 0, r * 5, 0, TAU); c.fill();
      c.rotate(waxing ? 0 : Math.PI); // in the evening sky a waxing moon is lit on the right, toward the set sun
      c.fillStyle = "rgba(40,48,70,0.6)"; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.fillStyle = "#fbf3dc"; c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); c.ellipse(0, 0, Math.abs(1 - 2 * lit) * r, r, 0, Math.PI / 2, -Math.PI / 2, lit > 0.5); c.fill();
      c.restore();
    }
    function catenary(x0, x1, yTop, sag) {
      var L2 = (x1 - x0) / 2, a = L2; for (var i = 0; i < 30; i++) { a = L2 * L2 / (2 * sag) + sag / 6; } // shallow-sag approximation, refined below
      for (var j = 0; j < 20; j++) { var f = a * (Math.cosh(L2 / a) - 1) - sag, fp = Math.cosh(L2 / a) - 1 - (L2 / a) * Math.sinh(L2 / a); a -= f / fp; }
      var xm = (x0 + x1) / 2;
      return function (x) { return yTop + sag - a * (Math.cosh((x - xm) / a) - 1); };
    }
    var wires = [];
    var cast = [];
    function roster(sunAlt) { // who is out at this light
      var day = sunAlt > 3, night = sunAlt < -8, tw = !day && !night;
      var r = [];
      if (day) r.push(["common-myna", 0, 0.2, 0], ["common-myna", 0, 0.255, 1], ["black-drongo", 0, 0.37, 0], ["spotted-dove", 0, 0.5, 1], ["red-whiskered-bulbul", 0, 0.62, 0], ["oriental-magpie-robin", 0, 0.73, 1], ["eurasian-tree-sparrow", 0, 0.82, 0], ["eurasian-tree-sparrow", 0, 0.86, 1], ["streak-eared-bulbul", 1, 0.3, 0], ["white-throated-kingfisher", 1, 0.6, 1], ["coppersmith-barbet", 1, 0.7, 0]);
      if (tw) r.push(["oriental-magpie-robin", 0, 0.3, 0], ["common-myna", 0, 0.46, 1], ["common-myna", 0, 0.5, 0], ["common-myna", 0, 0.54, 1], ["black-drongo", 0, 0.66, 0], ["eurasian-tree-sparrow", 0, 0.78, 1], ["eurasian-tree-sparrow", 0, 0.81, 0], ["eurasian-tree-sparrow", 0, 0.84, 1], ["spotted-dove", 1, 0.4, 0]);
      if (night) r.push(["barn-owl", "poleL", 0, 0], ["asian-barred-owlet", "poleR", 0, 0]);
      r.push(["asian-koel", "branch", 0, 1]);
      r.push(["greater-coucal", "bush", day ? 0 : 1, 0]);
      if (!night) r.push(["chinese-pond-heron", "moat", 0, 1]);
      return r;
    }
    function resize() {
      var o = setup(cv); ctx = o.ctx; W = o.w; H = o.h; lastKey = "";
      var p0 = W * 0.045, p1 = W * 0.955, top = H * 0.36;
      wires = [catenary(p0, p1, top, H * 0.06), catenary(p0, p1, top + H * 0.045, H * 0.085), catenary(p0, p1, top + H * 0.075, H * 0.12)];
    }
    var t0 = performance.now() / 1000, fliers = [];
    function frame(dt, tt) {
      if (!W) return;
      var ms = now(), sun = S.sunPos(ms, S.CM.lat, S.CM.lon), key = Math.round(ms / 60000) + ":" + W + ":" + H;
      if (key !== lastKey) { lastKey = key; paintSky(ms, sun); paintLand(ms, sun); cast = roster(sun.alt); }
      ctx.drawImage(skyC, 0, 0, W, H);
      // stars, turning about the pole
      var dark = 1 - smoothstep(-14, -5, sun.alt);
      if (dark > 0.01) {
        stars.forEach(function (s) {
          var p = altazStar(s, ms); if (p.alt < 2) return;
          var x = azX(p.az), y = altY(p.alt); if (x < 0 || x > W) return;
          var a = dark * (0.25 + 0.75 * s.m) * (0.75 + 0.25 * Math.sin(tt * 2 + s.tw));
          ctx.fillStyle = "rgba(255,250,235," + a + ")"; ctx.fillRect(x, y, 1 + s.m * 1.6, 1 + s.m * 1.6);
        });
      }
      moon(ctx, ms);
      flocks(ctx, sun, tt, ms);
      ctx.drawImage(landC, 0, 0, W, H);
      // moat shimmer
      var wy1 = H * 0.845; ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1;
      for (var k = 0; k < 9; k++) { var yy = wy1 + (k + 1) * (H - wy1) / 10; ctx.beginPath(); for (var x = 0; x <= W; x += 8) ctx.lineTo(x, yy + Math.sin(x * 0.03 + tt * 1.2 + k) * 1.4); ctx.stroke(); }
      lotus(ctx, sun, tt);
      poles(ctx, sun);
      hits = [];
      var pxcm = clamp(Math.min(W, H * 1.8) / 360, 1.6, 4.6);
      bush(ctx, sun, tt, pxcm, true);
      branch(ctx, sun, tt, true);
      cast.forEach(function (c, i) { placeBird(c, i, dt, pxcm, tt); });
      bush(ctx, sun, tt, pxcm, false);
      branch(ctx, sun, tt, false);
      night(ctx, sun, tt, ms);
      drawLabels(dt);
      if (ambient) { ambT -= dt; if (ambT < 0) { ambT = 2.5 + Math.random() * 4; ambientSing(ms); } }
    }
    function altazStar(s, ms) {
      var d = (ms / 86400000 + 2440587.5) - 2451545.0, g = (280.46061837 + 360.98564736629 * d) % 360;
      var H2 = ((g + S.CM.lon - s.ra) % 360) * Math.PI / 180, dec = s.dec * Math.PI / 180, p = S.CM.lat * Math.PI / 180;
      var alt = Math.asin(Math.sin(p) * Math.sin(dec) + Math.cos(p) * Math.cos(dec) * Math.cos(H2));
      var az = Math.atan2(-Math.sin(H2), Math.tan(dec) * Math.cos(p) - Math.sin(p) * Math.cos(H2));
      return { alt: alt * 180 / Math.PI, az: ((az * 180 / Math.PI) + 360) % 360 };
    }
    function poles(c, sun) {
      var day = smoothstep(-8, 6, sun.alt), col = BD.mix("#05070d", "#3a3430", day);
      [W * 0.045, W * 0.955].forEach(function (x) {
        c.fillStyle = col; c.fillRect(x - 5, H * 0.3, 10, H * 0.7);
        c.fillRect(x - 26, H * 0.355, 52, 5);
        c.fillStyle = BD.mix("#05070d", "#cfcfc4", day); [-20, 0, 20].forEach(function (d) { c.fillRect(x + d - 2, H * 0.345, 4, 10); });
      });
      c.strokeStyle = BD.mix("#020305", "#1d1b1a", day);
      wires.forEach(function (f, i) { c.lineWidth = i === 2 ? 2.6 : 1.4; c.beginPath(); for (var x = W * 0.045; x <= W * 0.955; x += 6) c.lineTo(x, f(x)); c.stroke(); });
      // a coil of spare cable on the right pole, as Chiang Mai poles carry
      c.lineWidth = 1.6; c.beginPath();
      for (var t = 0; t <= TAU * 5; t += 0.15) { var cx = W * 0.955 - 14 + t * 0.6, cy = H * 0.47; c.lineTo(cx + Math.cos(t) * 13, cy + Math.sin(t) * 18); }
      c.stroke();
    }
    function bush(c, sun, tt, pxcm, back) { // a lantana thicket, front-left; the coucal lives in it
      var day = smoothstep(-8, 6, sun.alt), bx = W * 0.11, by = H * 0.95, R = H * 0.16;
      var r = BD.rng(back ? 3 : 4), n = back ? 70 : 46;
      for (var i = 0; i < n; i++) {
        var a = Math.PI + r() * Math.PI, rr = R * Math.sqrt(r()) * (back ? 1 : 0.95), x = bx + Math.cos(a) * rr * 1.5, y = by + Math.sin(a) * rr + (back ? 0 : R * 0.18);
        if (!back && y < by - R * 0.55) continue;
        c.fillStyle = BD.mix(BD.mix("#050a07", "#2e5a2a", day), "#4a7a3a", r() * 0.5 * day);
        c.save(); c.translate(x, y); c.rotate(r() * TAU + Math.sin(tt * 0.8 + i) * 0.05); c.beginPath(); c.ellipse(0, 0, 9, 4.5, 0, 0, TAU); c.fill(); c.restore();
        if (!back && r() < 0.18) { var fc = ["#f2a03a", "#e8507a", "#f4d03a"][i % 3]; c.fillStyle = BD.mix("#202020", fc, day * 0.9 + 0.1); for (var p = 0; p < 6; p++) { var pa = p / 6 * TAU; c.beginPath(); c.arc(x + 6 + Math.cos(pa) * 2.2, y - 4 + Math.sin(pa) * 2.2, 1.3, 0, TAU); c.fill(); } }
      }
    }
    function branch(c, sun, tt, back) { // a rain-tree bough from the top-right corner, leaves in pinnate rows
      var day = smoothstep(-8, 6, sun.alt), col = BD.mix("#040705", "#2c4f2a", day);
      var p0 = [W * 1.02, H * 0.02], p1 = [W * 0.8, H * 0.2], cpt = [W * 0.9, H * 0.18];
      if (back) { c.strokeStyle = BD.mix("#050505", "#3e2e22", day); c.lineWidth = 9; c.lineCap = "round"; c.beginPath(); c.moveTo(p0[0], p0[1]); c.quadraticCurveTo(cpt[0], cpt[1], p1[0], p1[1]); c.stroke(); }
      var r = BD.rng(back ? 21 : 22);
      for (var s = 0; s < (back ? 10 : 6); s++) {
        var t = r(), x = lerp(lerp(p0[0], cpt[0], t), lerp(cpt[0], p1[0], t), t), y = lerp(lerp(p0[1], cpt[1], t), lerp(cpt[1], p1[1], t), t);
        var ang = (back ? -2.4 : 1.9) + (r() - 0.5) * 1.6 + Math.sin(tt * 0.7 + s) * 0.03, len = H * (0.07 + r() * 0.07);
        if (!back && t > 0.75) continue;
        c.strokeStyle = col; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
        for (var k = 1; k < 9; k++) { var u = k / 9, lx = x + Math.cos(ang) * len * u, ly = y + Math.sin(ang) * len * u; [-1, 1].forEach(function (sd) { c.fillStyle = col; c.save(); c.translate(lx, ly); c.rotate(ang + sd * 1.1); c.beginPath(); c.ellipse(5, 0, 5.5, 2, 0, 0, TAU); c.fill(); c.restore(); }); }
      }
    }
    function lotus(c, sun, tt) { // rose curves on the moat: r = cos(3θ) petals
      var day = smoothstep(-8, 6, sun.alt), r = BD.rng(31);
      for (var i = 0; i < 7; i++) {
        var x = W * (0.25 + r() * 0.55), y = H * (0.88 + r() * 0.1), s = 8 + r() * 8;
        c.fillStyle = BD.mix("#08140f", "#3f6a3a", day); c.beginPath(); c.ellipse(x, y, s * 1.6, s * 0.45, 0, 0.25, TAU - 0.25); c.lineTo(x, y); c.fill();
        if (i % 2 === 0) { c.fillStyle = BD.mix("#20141a", "#f08aa8", day * 0.9 + 0.1); c.beginPath(); for (var t = 0; t <= Math.PI; t += 0.05) { var rr = s * 0.9 * Math.abs(Math.cos(3 * t)); c.lineTo(x + 6 + Math.cos(t + Math.PI) * rr, y - 4 + Math.sin(t + Math.PI) * rr * 1.2); } c.fill(); }
      }
    }
    function placeBird(cs, i, dt, pxcm, tt) {
      var sp = BY[cs[0]]; if (!sp) return;
      var key = cs.join("|"), st = states[key] || (states[key] = newState(i * 1.7));
      stepState(st, sp, dt);
      var ex = BD.extent(sp), wUnits = Math.max(ex[2] - ex[0], ex[3] - ex[1]), s = pxcm * sp.cm / wUnits * (sp.slug === "greater-coucal" ? 0.75 : 1);
      var x, y, flip = !!cs[3];
      if (typeof cs[1] === "number") { x = W * cs[2]; y = wires[cs[1]](x); }
      else if (cs[1] === "poleL") { x = W * 0.045; y = H * 0.3; }
      else if (cs[1] === "poleR") { x = W * 0.955 - 20; y = H * 0.355; }
      else if (cs[1] === "branch") { x = W * 0.86; y = H * 0.155; }
      else if (cs[1] === "bush") { x = W * 0.12; y = H * (cs[2] ? 0.8 : 0.9); s *= 1.1; }
      else if (cs[1] === "moat") { x = W * 0.33; y = H * 0.845; s *= 0.75; }
      if (cs[1] === "moat" && W < 600) x = W * 0.4;
      ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
      BD.draw(ctx, sp, { t: st.t, gape: st.gape, blink: st.blink, turn: st.turn, cock: st.cock, crest: st.crest, display: st.display, bob: st.bob, lw: 0.9 / Math.max(0.6, s) * 0.9 });
      ctx.restore();
      var bx0 = x + (flip ? -ex[2] : ex[0]) * s, bx1 = x + (flip ? -ex[0] : ex[2]) * s;
      hits.push({ x0: Math.min(bx0, bx1) - 8, x1: Math.max(bx0, bx1) + 8, y0: y + ex[1] * s - 8, y1: y + ex[3] * s + 8, sp: sp, st: st, x: x, y: y + ex[1] * s });
    }
    function flocks(c, sun, tt, ms) {
      var evening = sun.az > 180;
      if (sun.alt > 4) { // swiftlets
        for (var i = 0; i < 7; i++) { var k = 0.6 + i * 0.13, x = W * (0.5 + 0.46 * Math.sin(tt * 0.11 * k + i * 2)), y = H * (0.16 + 0.1 * Math.sin(tt * 0.27 * k + i)); BD.flier(c, x, y, 1.1, tt * 22 + i, "rgba(30,30,40,0.75)"); }
      }
      if (evening && sun.alt > -6 && sun.alt < 6) { // egrets heading to roost, in a V
        var period = 46, u = ((tt % period) / period), lead = [W * (1.15 - u * 1.4), H * (0.22 + 0.04 * Math.sin(u * 3))];
        for (var j = 0; j < 9; j++) { var row = Math.ceil(j / 2), side = j % 2 ? 1 : -1; BD.flier(c, lead[0] + row * 16, lead[1] + side * row * 9, 1.4, tt * 6 + j * 0.6, "rgba(250,248,240,0.95)"); }
      }
      if (sun.alt < -1 && sun.alt > -14) { // bats
        for (var b = 0; b < 10; b++) { var bx = W * (0.15 + 0.7 * ((Math.sin(tt * 0.31 + b * 7.1) + 1) / 2)), by = H * (0.25 + 0.15 * Math.sin(tt * 0.73 + b * 3.3) + 0.03 * Math.sin(tt * 5 + b)); BD.flier(c, bx, by, 0.9, tt * 30 + b, "rgba(12,10,14,0.9)"); }
      }
    }
    function night(c, sun, tt, ms) {
      var dark = 1 - smoothstep(-10, -2, sun.alt);
      if (dark > 0) { // fireflies on the moat edge and in the thicket
        for (var i = 0; i < 28; i++) {
          var x = W * (0.03 + ((i * 0.61803) % 1) * 0.6) + Math.sin(tt * 0.4 + i) * 12, y = H * (0.78 + ((i * 0.381966) % 1) * 0.18) + Math.cos(tt * 0.5 + i * 2) * 8;
          var a = dark * Math.max(0, Math.sin(tt * 1.7 + i * 2.3)) ;
          var g = c.createRadialGradient(x, y, 0, x, y, 7); g.addColorStop(0, "rgba(220,255,140," + a + ")"); g.addColorStop(1, "rgba(220,255,140,0)"); c.fillStyle = g; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill();
        }
      }
      // Yi Peng: the full moon of the twelfth month; lanterns rise
      var lu = S.thaiLunar(ms), yipeng = lu && lu.month === "12" && ((lu.waxing && lu.day >= 14) || (!lu.waxing && lu.day <= 1));
      if (yipeng && dark > 0.3) {
        for (var l = 0; l < 34; l++) {
          var p = ((tt * 0.012 + l * 0.0294) % 1), lx = W * (0.08 + ((l * 0.7548) % 1) * 0.84) + Math.sin(tt * 0.3 + l) * 20, ly = H * (0.8 - p * 0.8), s = 2 + 3 * (1 - p);
          var g2 = c.createRadialGradient(lx, ly, 0, lx, ly, s * 4); g2.addColorStop(0, "rgba(255,190,90," + 0.9 * (1 - p) + ")"); g2.addColorStop(1, "rgba(255,150,60,0)");
          c.fillStyle = g2; c.beginPath(); c.arc(lx, ly, s * 4, 0, TAU); c.fill(); c.fillStyle = "rgba(255,230,170," + (1 - p) + ")"; c.fillRect(lx - s / 2, ly - s * 0.7, s, s * 1.3);
        }
      }
    }
    function drawLabels(dt) {
      labels = labels.filter(function (l) { return l.life > 0; });
      labels.forEach(function (l) {
        l.life -= dt; var a = clamp(l.life, 0, 1);
        ctx.font = "600 " + (W < 600 ? 13 : 15) + "px var(--thai), system-ui, sans-serif";
        var tw = ctx.measureText(l.text).width, x = clamp(l.x - tw / 2 - 10, 6, W - tw - 26), y = Math.max(8, l.y - 40);
        ctx.globalAlpha = a; ctx.fillStyle = "rgba(255,250,238,0.94)"; roundRect(ctx, x, y, tw + 20, 28, 14); ctx.fill();
        ctx.fillStyle = "#1f160e"; ctx.fillText(l.text, x + 10, y + 19); ctx.globalAlpha = 1;
      });
    }
    function sing(hit, gain) {
      var sp = hit.sp, h = play(sp.slug, { pan: (hit.x / W) * 1.6 - 0.8, gain: gain == null ? 1 : gain, max: 14 });
      hit.st.h = h; hit.st.until = hit.st.t + 6;
      labels.push({ x: hit.x, y: hit.y, text: LANG === "th" ? sp.th + " · " + sp.en : sp.en + " · " + sp.th, life: hasAudio(sp.slug) ? 5 : 3.5 });
    }
    function ambientSing(ms) {
      var pool = hits.filter(function (h) { return hasAudio(h.sp.slug) && (!h.st.h || h.st.h.stopped); });
      if (!pool.length) return;
      var w = pool.map(function (h) { return 0.05 + activity(h.sp, ms); }), tot = w.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * tot;
      for (var i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { sing(pool[i], 0.55); return; } }
    }
    cv.addEventListener("pointerdown", function (e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (var i = hits.length - 1; i >= 0; i--) { var h = hits[i]; if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) { sing(h); return; } }
    });
    cv.addEventListener("pointermove", function (e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, on = hits.some(function (h) { return x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1; });
      cv.style.cursor = on ? "pointer" : "default";
    });
    if (QS.has("card")) document.body.classList.add("cardmode");
    function syncLabel() {
      var ms = now(), d = daySun(ms);
      tlabel.textContent = (live ? L.now + " · " : "") + fmtHM(ms);
      nowBtn.hidden = live;
      if (!live) { slider.value = fixedMin; return; } slider.value = Math.round((ms - S.localMidnight(ms)) / 60000);
    }
    function paintSlider() { // the track is the day's sky, hour by hour
      var base = S.localMidnight(Date.now()), stops = [];
      for (var hh = 0; hh <= 24; hh += 1) { var s = S.sunPos(base + hh * 3600000, S.CM.lat, S.CM.lon); stops.push(skyStops(s.alt)[1] + " " + (hh / 24 * 100).toFixed(1) + "%"); }
      slider.style.background = "linear-gradient(90deg," + stops.join(",") + ")";
    }
    slider.addEventListener("input", function () { live = false; fixedMin = +slider.value; lastKey = ""; syncLabel(); });
    nowBtn.addEventListener("click", function () { live = true; lastKey = ""; syncLabel(); });
    ambBtn.addEventListener("click", function () { ambient = !ambient; ambBtn.setAttribute("aria-pressed", ambient); ambBtn.textContent = ambient ? L.amb_on : L.amb_off; if (ambient) { actx(); ambT = 0; } });
    setInterval(syncLabel, 15000);
    resize(); syncLabel(); paintSlider();
    window.addEventListener("resize", function () { resize(); });
    return { frame: frame, ambientOff: function () { if (ambient) ambBtn.click(); }, el: cv };
  })();
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  /* ======================================================================= */
  /* 2  the Coucal Clock                                                      */
  /* ======================================================================= */
  var Clock = (function () {
    var cv = document.getElementById("clockface"); if (!cv) return null;
    var el = { dawn: document.getElementById("c-dawn"), dusk: document.getElementById("c-dusk"), next: document.getElementById("c-next"), moon: document.getElementById("c-moon"), lunar: document.getElementById("c-lunar") };
    var btnCall = document.getElementById("c-call"), btnSound = document.getElementById("c-sound"), btnWarp = document.getElementById("c-warp");
    var sound = false, warp = false, warpStart = 0, warpBase = 0, call = null, lastCheck = Date.now(), W = 0, ctx, sideSt = [newState(1), newState(2)], birdSt = newState(3);
    var coucal = BY["greater-coucal"];
    var MOON_R = 0.3508, HUMP_R = 0.4266, HUMP_X = 0.7083, PLATE_Y = -0.0894, DISC_R = 0.5506, DISC_CY = 0.0708; // fitted on the clock; see the moon note
    function clockNow() { return warp ? warpBase + (performance.now() - warpStart) * 1440 : Date.now(); } // a day a minute
    var TEAK = ["#5a2e12", "#7a4320", "#9a5a2c", "#b8773c"];
    function wood(c, x0, y0, x1, y1, dark) {
      var g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, dark ? "#4a250e" : TEAK[2]); g.addColorStop(0.5, dark ? "#5e3214" : TEAK[3]); g.addColorStop(1, dark ? "#3a1c0a" : TEAK[1]);
      return g;
    }
    function grain(c, x0, y0, w, h, u, seed) { // sine-perturbed lines, as in plain-sawn teak
      var r = BD.rng(seed); c.save(); c.strokeStyle = "rgba(40,18,4,0.22)"; c.lineWidth = 0.08 * u;
      for (var i = 0; i < 26; i++) { var y = y0 + r() * h, ph = r() * 6, amp = (0.2 + r() * 0.6) * u, f = (0.5 + r()) / u; c.beginPath(); for (var x = x0; x <= x0 + w; x += u * 0.5) c.lineTo(x, y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.3); c.stroke(); }
      c.restore();
    }
    function spiral(c, x, y, a, turns, dir, u) { // logarithmic spiral r = a·e^(bθ): the curl at the end of a kanok flame
      c.beginPath(); for (var t = 0; t <= turns * TAU; t += 0.12) { var r = a * Math.exp(-0.22 * t) * u; c.lineTo(x + dir * Math.cos(t) * r, y - Math.sin(t) * r); } c.stroke();
    }
    function draw(t) {
      var o = setup(cv, 1.28); ctx = o.ctx; W = o.w; var u = W / 100, c = ctx;
      c.clearRect(0, 0, W, W * 1.28);
      var ms = clockNow(), lt = S.local(ms), d = daySun(ms, S.SANSAI);
      var P = function (x, y) { return [x * u, y * u]; };
      // shadow
      var sg = c.createRadialGradient(50 * u, 124 * u, 2 * u, 50 * u, 124 * u, 30 * u); sg.addColorStop(0, "rgba(60,30,10,0.25)"); sg.addColorStop(1, "rgba(60,30,10,0)"); c.fillStyle = sg; c.fillRect(0, 110 * u, W, 18 * u);
      // --- pendulum: a Bodhi leaf, beating once a second
      var th = 0.09 * Math.sin(t * Math.PI), pv = P(50, 92), Lp = 26 * u, bob = [pv[0] + Math.sin(th) * Lp, pv[1] + Math.cos(th) * Lp];
      c.strokeStyle = "#b8862f"; c.lineWidth = 0.7 * u; c.beginPath(); c.moveTo(pv[0], pv[1]); c.lineTo(bob[0], bob[1]); c.stroke();
      c.save(); c.translate(bob[0], bob[1]); c.rotate(-th);
      c.beginPath(); for (var i = 0; i <= 80; i++) { var tt = i / 80 * TAU, x = 16 * Math.pow(Math.sin(tt), 3), y = 13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt); y = -y; if (y > 8) y += (y - 8) * (y - 8) * 0.12; c.lineTo(x * 0.33 * u, (y * 0.33 + 3) * u); } c.closePath();
      var lg = c.createLinearGradient(-5 * u, 0, 5 * u, 8 * u); lg.addColorStop(0, "#f0cf6a"); lg.addColorStop(1, "#a7731f"); c.fillStyle = lg; c.fill(); c.strokeStyle = "#6a4310"; c.lineWidth = 0.25 * u; c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 8.5 * u); for (var v = 1; v < 5; v++) { c.moveTo(0, v * 1.6 * u); c.lineTo(-(5 - v) * 0.9 * u, v * 1.6 * u - 1.4 * u); c.moveTo(0, v * 1.6 * u); c.lineTo((5 - v) * 0.9 * u, v * 1.6 * u - 1.4 * u); } c.strokeStyle = "rgba(90,55,10,0.55)"; c.lineWidth = 0.18 * u; c.stroke();
      c.restore();
      // --- weights: lotus buds on chains, falling from dawn to dawn
      var sinceDawn = ((ms - d.dawn) / 86400000 + 1) % 1;
      [40, 60].forEach(function (xx, k) {
        var wy = 101 + 15 * (k ? (sinceDawn + 0.5) % 1 : sinceDawn);
        c.strokeStyle = "#8a6420"; c.lineWidth = 0.22 * u;
        for (var y2 = 95; y2 < wy; y2 += 1.1) { c.beginPath(); c.ellipse(xx * u, y2 * u, (y2 * 10 % 2 < 1 ? 0.35 : 0.15) * u, 0.55 * u, 0, 0, TAU); c.stroke(); }
        c.save(); c.translate(xx * u, (wy + 3.5) * u);
        c.beginPath(); c.moveTo(0, -3.5 * u); c.bezierCurveTo(2.6 * u, -1.5 * u, 2.4 * u, 3 * u, 0, 4.4 * u); c.bezierCurveTo(-2.4 * u, 3 * u, -2.6 * u, -1.5 * u, 0, -3.5 * u);
        var bg = c.createLinearGradient(-2 * u, 0, 2 * u, 0); bg.addColorStop(0, "#9a6a1c"); bg.addColorStop(0.5, "#f2d27a"); bg.addColorStop(1, "#8a5a14"); c.fillStyle = bg; c.fill();
        c.strokeStyle = "rgba(80,45,5,0.6)"; c.lineWidth = 0.18 * u; c.beginPath(); c.moveTo(0, -3.2 * u); c.quadraticCurveTo(1.4 * u, 0.5 * u, 0, 4.2 * u); c.moveTo(0, -3.2 * u); c.quadraticCurveTo(-1.4 * u, 0.5 * u, 0, 4.2 * u); c.stroke();
        c.restore();
      });
      // --- case
      c.fillStyle = wood(c, 16 * u, 24 * u, 84 * u, 97 * u); roundRect(c, 16 * u, 24 * u, 68 * u, 73 * u, 2 * u); c.fill();
      c.save(); roundRect(c, 16 * u, 24 * u, 68 * u, 73 * u, 2 * u); c.clip(); grain(c, 16 * u, 24 * u, 68 * u, 73 * u, u, 9); c.restore();
      c.strokeStyle = "#3a1c0a"; c.lineWidth = 0.35 * u; roundRect(c, 16 * u, 24 * u, 68 * u, 73 * u, 2 * u); c.stroke();
      // carved border: a band of rhombi (the diamond of Lanna and Akha cloth)
      var band = function (x0, y0, x1, y1) {
        var len = Math.hypot(x1 - x0, y1 - y0), n = Math.round(len / 2.6), dx = (x1 - x0) / n, dy = (y1 - y0) / n, nx = -dy / Math.hypot(dx, dy), ny = dx / Math.hypot(dx, dy);
        for (var k = 0; k < n; k++) { var cx = (x0 + dx * (k + 0.5)) * u, cy = (y0 + dy * (k + 0.5)) * u; c.fillStyle = k % 2 ? "#4a250e" : "#d49a52"; c.beginPath(); c.moveTo(cx + dx * 0.5 * u, cy + dy * 0.5 * u); c.lineTo(cx + nx * 1.05 * u, cy + ny * 1.05 * u); c.lineTo(cx - dx * 0.5 * u, cy - dy * 0.5 * u); c.lineTo(cx - nx * 1.05 * u, cy - ny * 1.05 * u); c.closePath(); c.fill(); }
      };
      band(19, 27.5, 81, 27.5); band(19, 93.5, 81, 93.5); band(19, 27.5, 19, 93.5); band(81, 27.5, 81, 93.5);
      // --- the paired carved coucals on lotus brackets, facing in
      [[0, false], [1, true]].forEach(function (s) {
        var st = sideSt[s[0]]; stepState(st, coucal, 1 / 60); st.h = call && call.h;
        var ex = BD.extent(coucal), sc = 25 * u / (ex[2] - ex[0]), lx0 = (s[1] ? 90 : 10) * u, ox = lx0 + (s[1] ? 1 : -1) * ((ex[0] + ex[2]) / 2) * sc + (s[1] ? -2 : 2) * u;
        c.save(); c.translate(ox, 81.6 * u); c.scale(s[1] ? -sc : sc, sc);
        BD.draw(c, coucal, { t: st.t, blink: st.blink, turn: st.turn * 0.5, gape: call && call.out > 0.8 ? st.gape * 0.6 : 0, carve: BD.teak, ink: "#2a1606", lw: 0.7 });
        c.restore();
        // the lotus bracket: rose-curve petals in teak
        var lx = (s[1] ? 90 : 10) * u, ly = 84.5 * u; c.fillStyle = wood(c, lx - 6 * u, ly, lx + 6 * u, ly + 5 * u); c.beginPath();
        for (var a = Math.PI; a <= TAU + 0.001; a += 0.04) { var rr = 6.5 * u * (0.65 + 0.35 * Math.abs(Math.cos(3.5 * a))); c.lineTo(lx + Math.cos(a) * rr, ly - Math.sin(a) * rr * 0.75); } c.closePath(); c.fill(); c.strokeStyle = "#3a1c0a"; c.lineWidth = 0.25 * u; c.stroke();
      });
      // --- roof: two tiers, bargeboards, kanok curls, kalae horns crossing at the apex
      [[6, 30, 50, 8], [14, 24, 50, 12]].forEach(function (rf, k) {
        c.beginPath(); c.moveTo(rf[0] * u, rf[1] * u); c.lineTo(rf[2] * u, rf[3] * u); c.lineTo((100 - rf[0]) * u, rf[1] * u); c.lineTo((100 - rf[0] - 4) * u, (rf[1] + 2) * u); c.lineTo(rf[2] * u, (rf[3] + 4.5) * u); c.lineTo((rf[0] + 4) * u, (rf[1] + 2) * u); c.closePath();
        c.fillStyle = wood(c, 0, rf[3] * u, 0, rf[1] * u, k === 0); c.fill(); c.strokeStyle = "#2a1406"; c.lineWidth = 0.3 * u; c.stroke();
      });
      // gable face with sun rays round the door
      c.beginPath(); c.moveTo(22 * u, 24 * u); c.lineTo(50 * u, 16.5 * u); c.lineTo(78 * u, 24 * u); c.closePath(); c.fillStyle = wood(c, 0, 16 * u, 0, 24 * u); c.fill();
      c.save(); c.clip(); c.strokeStyle = "rgba(60,25,5,0.4)"; c.lineWidth = 0.25 * u; for (var ray = 0; ray < 17; ray++) { var ra = Math.PI + ray / 16 * Math.PI; c.beginPath(); c.moveTo(50 * u, 23 * u); c.lineTo(50 * u + Math.cos(ra) * 40 * u, 23 * u + Math.sin(ra) * 40 * u); c.stroke(); } c.restore();
      // bargeboards: scale-carved strokes along the upper roof, curling up at the eaves
      c.strokeStyle = "#e0ad62"; c.lineWidth = 0.55 * u; c.lineCap = "round";
      [-1, 1].forEach(function (sd) {
        c.beginPath(); c.moveTo(50 * u, 8 * u); c.lineTo((50 + sd * 44) * u, 30 * u); c.stroke();
        spiral(c, (50 + sd * 44.5) * u, 29.2 * u, 2.4, 2.2, -sd, u);
        // kalae: the board runs on past the apex, crossing its partner, and ends in a curl
        c.beginPath(); c.moveTo(50 * u, 8 * u); c.quadraticCurveTo((50 - sd * 4) * u, 4 * u, (50 - sd * 6.5) * u, 2.2 * u); c.lineWidth = 0.9 * u; c.stroke(); c.lineWidth = 0.45 * u;
        spiral(c, (50 - sd * 7.2) * u, 2.6 * u, 1.6, 1.8, sd, u);
      });
      // --- the door, and the bird that comes out of it
      var dc = [50, 22.4], dw = 10, dh = 8.6, open = call ? call.open : 0, out = call ? call.out : 0;
      c.fillStyle = "#1a0c04"; c.beginPath(); c.moveTo((dc[0] - dw / 2) * u, (dc[1] + dh / 2) * u); c.lineTo((dc[0] - dw / 2) * u, (dc[1] - dh / 4) * u); c.quadraticCurveTo(dc[0] * u, (dc[1] - dh * 0.95) * u, (dc[0] + dw / 2) * u, (dc[1] - dh / 4) * u); c.lineTo((dc[0] + dw / 2) * u, (dc[1] + dh / 2) * u); c.closePath(); c.fill();
      if (out > 0.02) { // perch slides out; the bird steps onto it
        stepState(birdSt, coucal, 1 / 60); birdSt.h = call.h;
        c.fillStyle = "#c89048"; c.fillRect((dc[0] - 3) * u, (dc[1] + dh / 2 - 0.6) * u, (6 + 9 * out) * u, 0.9 * u);
        var bs = 0.19 * u * (0.55 + 0.45 * out);
        c.save(); c.translate((dc[0] + 3 * out) * u, (dc[1] + dh / 2 - 0.5) * u); c.scale(bs, bs);
        BD.draw(c, coucal, { t: birdSt.t, gape: birdSt.gape, blink: birdSt.blink, turn: birdSt.turn * 0.3, bob: birdSt.bob, lw: 0.9 });
        c.restore();
      }
      [-1, 1].forEach(function (sd) { // two leaves on hinges: width ∝ cos(opening angle)
        var hw = dw / 2 * Math.cos(open * Math.PI * 0.46), hx = dc[0] + sd * dw / 2;
        c.fillStyle = wood(c, (hx - sd * hw) * u, 0, hx * u, 0); c.beginPath(); c.moveTo(hx * u, (dc[1] + dh / 2) * u); c.lineTo(hx * u, (dc[1] - dh / 4) * u); c.lineTo((hx - sd * hw) * u, (dc[1] - dh * 0.55 + (1 - Math.cos(open * 1.4)) * 1.5) * u); c.lineTo((hx - sd * hw) * u, (dc[1] + dh / 2) * u); c.closePath(); c.fill(); c.strokeStyle = "#2a1406"; c.lineWidth = 0.25 * u; c.stroke();
      });
      // --- dial
      var C0 = [50, 56], R = 24;
      c.save(); c.translate(C0[0] * u, C0[1] * u);
      c.fillStyle = "#2a1406"; c.beginPath(); c.arc(0, 0, (R + 0.9) * u, 0, TAU); c.fill();
      // naga ring: two rows of scales, gold over green
      c.fillStyle = "#1f4a3a"; c.beginPath(); c.arc(0, 0, R * u, 0, TAU); c.fill();
      for (var row = 0; row < 2; row++) { var rr2 = (R - 0.8 - row * 1.2) * u, n2 = 72; for (var k2 = 0; k2 < n2; k2++) { var a2 = (k2 + row * 0.5) / n2 * TAU; c.strokeStyle = row ? "#c8902a" : "#e8c060"; c.lineWidth = 0.22 * u; c.beginPath(); c.arc(Math.cos(a2) * rr2, Math.sin(a2) * rr2, 1.1 * u, a2 + Math.PI * 0.6, a2 + Math.PI * 1.4); c.stroke(); } }
      var face = c.createRadialGradient(-6 * u, -8 * u, 2 * u, 0, 0, 22 * u); face.addColorStop(0, "#fffaf0"); face.addColorStop(1, "#efdfbf");
      c.fillStyle = face; c.beginPath(); c.arc(0, 0, 21.4 * u, 0, TAU); c.fill();
      // engraved rose: r = cos(6θ), faint
      c.strokeStyle = "rgba(160,110,40,0.16)"; c.lineWidth = 0.15 * u; for (var e = 0; e < 3; e++) { c.beginPath(); for (var a3 = 0; a3 <= TAU + 0.01; a3 += 0.02) { var rr3 = (9 + e * 3.5) * u * (0.75 + 0.25 * Math.cos(6 * a3 + e)); c.lineTo(Math.cos(a3) * rr3, Math.sin(a3) * rr3); } c.stroke(); }
      for (var m = 0; m < 60; m++) { var am = m / 60 * TAU, big = m % 5 === 0; c.strokeStyle = "#5a3412"; c.lineWidth = (big ? 0.35 : 0.15) * u; c.beginPath(); c.moveTo(Math.sin(am) * 20.9 * u, -Math.cos(am) * 20.9 * u); c.lineTo(Math.sin(am) * (big ? 19.6 : 20.2) * u, -Math.cos(am) * (big ? 19.6 : 20.2) * u); c.stroke(); }
      c.fillStyle = "#3a1c0a"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = "600 " + (3.3 * u) + "px 'Noto Serif Thai', 'Noto Sans Thai', serif";
      for (var hN = 1; hN <= 12; hN++) { var ah = hN / 12 * TAU; c.fillText(S.thaiNum(hN), Math.sin(ah) * 17.2 * u, -Math.cos(ah) * 17.2 * u + 0.2 * u); }
      c.restore();
      moonWindow(c, [50 * u, 47 * u], 6.4 * u, ms, u);
      sunRing(c, [50 * u, 65.5 * u], 5.6 * u, ms, d, u);
      // hands: Lanna spear leaves
      var hr = (lt.h % 12 + lt.mi / 60 + lt.s / 3600) / 12 * TAU, mn = (lt.mi + lt.s / 60) / 60 * TAU, sc = (warp ? 0 : Math.floor(lt.s)) / 60 * TAU;
      hand(c, C0, hr, 12.5, 2.3, "#2a1406", u, true); hand(c, C0, mn, 18.4, 1.7, "#2a1406", u, true);
      if (!warp) { c.save(); c.translate(C0[0] * u, C0[1] * u); c.rotate(sc); c.strokeStyle = "#b5231c"; c.lineWidth = 0.25 * u; c.beginPath(); c.moveTo(0, 4 * u); c.lineTo(0, -20 * u); c.stroke(); c.fillStyle = "#b5231c"; c.beginPath(); c.arc(0, 3.4 * u, 0.9 * u, 0, TAU); c.fill(); c.restore(); }
      // lotus boss: eight petals
      c.save(); c.translate(C0[0] * u, C0[1] * u); c.fillStyle = "#c8902a"; c.beginPath(); for (var a4 = 0; a4 <= TAU; a4 += 0.05) { var rr4 = 1.6 * u * (0.6 + 0.4 * Math.abs(Math.cos(4 * a4))); c.lineTo(Math.cos(a4) * rr4, Math.sin(a4) * rr4); } c.fill(); c.fillStyle = "#5a3412"; c.beginPath(); c.arc(0, 0, 0.5 * u, 0, TAU); c.fill(); c.restore();
      // date plate
      c.fillStyle = "#f7ecd4"; roundRect(c, 27 * u, 82.2 * u, 46 * u, 9.6 * u, 1 * u); c.fill(); c.strokeStyle = "#8a5a24"; c.lineWidth = 0.3 * u; c.stroke();
      var lu = S.thaiLunar(ms);
      c.fillStyle = "#2a1406"; c.textAlign = "center"; c.font = "600 " + (2.55 * u) + "px 'Noto Sans Thai', sans-serif";
      c.fillText("วัน" + S.THAI_DAYS[lt.wd] + " " + S.thaiNum(lt.d) + " " + S.THAI_MONTHS[lt.mo] + " พ.ศ. " + S.thaiNum(lt.y + 543), 50 * u, 85 * u);
      c.font = (2.4 * u) + "px 'Noto Sans Thai', sans-serif";
      var lline = lu ? (lu.waxing ? "ขึ้น " : "แรม ") + S.thaiNum(lu.day) + " ค่ำ เดือน " + (lu.month === "8b" ? "๘ หลัง" : S.thaiNum(lu.month)) + (lu.phra ? " · วันพระ" : "") : "ไม่ทราบข้างขึ้นข้างแรม";
      c.fillStyle = lu && lu.phra ? "#9a1c14" : "#4a2a10"; c.fillText(lline, 50 * u, 88.2 * u);
      if (LANG === "en") { c.font = (1.9 * u) + "px system-ui, sans-serif"; c.fillStyle = "#6a4a2a"; c.fillText(lu ? (lu.waxing ? "waxing " : "waning ") + lu.day + ", lunar month " + (lu.month === "8b" ? "8 (second)" : lu.month) + (lu.phra ? " · wan phra" : "") : "lunar day not in table", 50 * u, 90.8 * u); }
    }
    function hand(c, C0, ang, len, wid, col, u, shadow) {
      c.save(); c.translate(C0[0] * u, C0[1] * u); c.rotate(ang);
      var path = function () { c.beginPath(); c.moveTo(0, 3 * u); c.bezierCurveTo(wid * u, 0, wid * u, -len * 0.45 * u, wid * 0.55 * u, -len * 0.7 * u); c.quadraticCurveTo(wid * 1.15 * u, -len * 0.8 * u, 0, -len * u); c.quadraticCurveTo(-wid * 1.15 * u, -len * 0.8 * u, -wid * 0.55 * u, -len * 0.7 * u); c.bezierCurveTo(-wid * u, -len * 0.45 * u, -wid * u, 0, 0, 3 * u); };
      if (shadow) { c.save(); c.translate(0.5 * u, 0.7 * u); path(); c.fillStyle = "rgba(40,20,0,0.22)"; c.fill(); c.restore(); }
      path(); c.fillStyle = col; c.fill();
      c.strokeStyle = "#c8902a"; c.lineWidth = 0.18 * u; c.beginPath(); c.moveTo(0, 1 * u); c.lineTo(0, -len * 0.9 * u); c.stroke();
      c.restore();
    }
    /* The moon window, as the Coucal Clock draws it: a disc carrying TWO moons turns 180° a
     * lunation behind a plate with two humps. Proportions fitted against the real moon. */
    function moonWindow(c, ctr, r, ms, u) {
      var lun = S.lunation(ms), disc = lun.disc;
      c.save(); c.translate(ctr[0], ctr[1]);
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.save(); c.clip();
      var sky = c.createLinearGradient(0, -r, 0, r); sky.addColorStop(0, "#0e1838"); sky.addColorStop(1, "#24366e"); c.fillStyle = sky; c.fillRect(-r, -r, 2 * r, 2 * r);
      c.fillStyle = "#f6e9c0"; [[-0.58, -0.58], [0.58, -0.54], [-0.2, -0.86], [0.24, -0.82], [-0.84, -0.2], [0.84, -0.16], [0.02, -0.62]].forEach(function (s) { c.beginPath(); c.arc(s[0] * r, s[1] * r, 0.035 * r, 0, TAU); c.fill(); });
      [1, 0].forEach(function (i) {
        var th = (disc - 90 + 180 * i) * Math.PI / 180, mx = DISC_R * Math.sin(th) * r, my = (DISC_CY - DISC_R * Math.cos(th)) * r, mr = MOON_R * r;
        var mg = c.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr); mg.addColorStop(0, "#fff8e0"); mg.addColorStop(1, "#e8cf86");
        c.fillStyle = mg; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.strokeStyle = "#a8822a"; c.lineWidth = 0.12 * u; c.stroke();
        c.fillStyle = "#8a6420"; [-0.3, 0.3].forEach(function (sx) { c.beginPath(); c.arc(mx + mr * sx, my - mr * 0.24, mr * 0.11, 0, TAU); c.fill(); });
        c.strokeStyle = "#8a6420"; c.lineWidth = mr * 0.09; c.beginPath(); c.arc(mx, my + mr * 0.05, mr * 0.42, 0.35, Math.PI - 0.35); c.stroke();
      });
      // the plate and its two cloud humps
      var plate = "#efdfbf";
      c.fillStyle = plate; c.fillRect(-r, PLATE_Y * r, 2 * r, 2 * r);
      [-1, 1].forEach(function (sd) { c.beginPath(); c.arc(sd * HUMP_X * r, PLATE_Y * r, HUMP_R * r, 0, TAU); c.fill(); });
      c.strokeStyle = "#8a5a24"; c.lineWidth = 0.14 * u;
      [-1, 1].forEach(function (sd) { c.beginPath(); c.arc(sd * HUMP_X * r, PLATE_Y * r, HUMP_R * r, Math.PI, TAU); c.stroke(); [[-0.36, 0.3, 0.2], [0.02, 0.16, 0.24], [0.4, 0.34, 0.18]].forEach(function (q) { c.strokeStyle = "rgba(138,90,36,0.5)"; c.beginPath(); c.arc((sd * HUMP_X + q[0] * HUMP_R) * r, (PLATE_Y + q[1] * HUMP_R) * r, q[2] * HUMP_R * r, Math.PI * 1.08, Math.PI * 2.64); c.stroke(); }); c.strokeStyle = "#8a5a24"; });
      c.beginPath(); c.moveTo(-r, PLATE_Y * r); c.lineTo((-HUMP_X - HUMP_R) * r, PLATE_Y * r); c.moveTo((-HUMP_X + HUMP_R) * r, PLATE_Y * r); c.lineTo((HUMP_X - HUMP_R) * r, PLATE_Y * r); c.moveTo((HUMP_X + HUMP_R) * r, PLATE_Y * r); c.lineTo(r, PLATE_Y * r); c.stroke();
      c.restore();
      c.strokeStyle = "#c8902a"; c.lineWidth = 0.5 * u; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
      c.restore();
    }
    /* 24-hour ring: day in gold, night in indigo, two red marks where the coucal calls */
    function sunRing(c, ctr, r, ms, d, u) {
      var mid = S.localMidnight(ms), ang = function (t) { return Math.PI / 2 + (t - mid) / 86400000 * TAU; }; // midnight at the bottom, noon at the top
      c.save(); c.translate(ctr[0], ctr[1]);
      c.fillStyle = "#1b2347"; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      var seg = function (t0, t1, col, r0) { c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * (r0 || 1), ang(t0), ang(t1)); c.arc(0, 0, r * 0.62, ang(t1), ang(t0), true); c.closePath(); c.fill(); };
      seg(d.dawn, d.rise, "#d9826a"); seg(d.set, d.dusk, "#d9826a"); seg(d.rise, d.set, "#f2c45a");
      c.fillStyle = "#f7ecd4"; c.beginPath(); c.arc(0, 0, r * 0.6, 0, TAU); c.fill();
      [d.dawn, d.dusk].forEach(function (t) { var a = ang(t); c.fillStyle = "#b5231c"; c.beginPath(); c.arc(Math.cos(a) * r * 0.81, Math.sin(a) * r * 0.81, r * 0.11, 0, TAU); c.fill(); });
      var a = ang(ms); c.strokeStyle = "#2a1406"; c.lineWidth = 0.28 * u; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); c.stroke();
      c.fillStyle = "#c8902a"; c.beginPath(); c.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.12, 0, TAU); c.fill();
      c.fillStyle = "#3a1c0a"; c.font = (1.5 * u) + "px 'Noto Sans Thai', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("๒๔", 0, r * 0.05);
      c.restore();
      c.strokeStyle = "#c8902a"; c.lineWidth = 0.4 * u; c.beginPath(); c.arc(ctr[0], ctr[1], r, 0, TAU); c.stroke();
    }
    function trigger() {
      if (call && !call.done) return;
      call = { t0: performance.now() / 1000, open: 0, out: 0, h: null, done: false };
      if (sound || !call.silent) {
        setTimeout(function () { if (call) call.h = play("greater-coucal", { max: 9, gain: 1 }); }, 1100);
      }
    }
    function stepCall() {
      if (!call) return;
      var e = performance.now() / 1000 - call.t0, dur = call.h && call.h.dur ? call.h.dur : (hasAudio("greater-coucal") ? 9 : 4);
      var tEnd = 1.2 + dur;
      call.open = e < 0.7 ? smoothstep(0, 0.7, e) : e < tEnd + 0.6 ? 1 : 1 - smoothstep(tEnd + 0.6, tEnd + 1.3, e);
      call.out = e < 0.7 ? 0 : e < 1.2 ? smoothstep(0.7, 1.2, e) : e < tEnd ? 1 : 1 - smoothstep(tEnd, tEnd + 0.6, e);
      if (e > tEnd + 1.4 && (!call.h || call.h.stopped)) { call.done = true; call = null; }
    }
    function info() {
      var ms = clockNow(), n = S.SANSAI, d0 = daySun(ms, n), d1 = daySun(ms + 86400000, n);
      var nd = d0.dawn > ms ? d0.dawn : d1.dawn, nk = d0.dusk > ms ? d0.dusk : d1.dusk;
      el.dawn.textContent = fmtHM(nd); el.dusk.textContent = fmtHM(nk);
      var nx = Math.min(nd, nk); el.next.textContent = (nx === nd ? L.dawn : L.dusk) + " · " + (warp ? fmtHM(nx) : L.in_ + " " + fmtCount((nx - ms) / 1000));
      var lun = S.lunation(ms); el.moon.textContent = Math.round(lun.illum * 100) + "% · " + (lun.fraction < 0.5 ? L.waxing : L.waning);
      var lu = S.thaiLunar(ms);
      el.lunar.textContent = lu ? (LANG === "th" ? (lu.waxing ? "ขึ้น " : "แรม ") + lu.day + " ค่ำ เดือน " + (lu.month === "8b" ? "8 หลัง" : lu.month) + (lu.phra ? " · วันพระ" : "") : (lu.waxing ? "waxing " : "waning ") + lu.day + ", month " + lu.month + (lu.phra ? " · wan phra" : "")) : "–";
    }
    var lastMs = Date.now();
    function tick(t) {
      stepCall(); draw(t);
      var ms = clockNow(), d = daySun(ms, S.SANSAI), dP = daySun(ms - 86400000, S.SANSAI);
      [d.dawn, d.dusk, dP.dawn, dP.dusk].forEach(function (ev) { if (ev > lastMs && ev <= ms && (sound || warp)) trigger(); });
      lastMs = ms;
    }
    btnCall.addEventListener("click", function () { actx(); trigger(); });
    btnSound.addEventListener("click", function () { sound = !sound; btnSound.setAttribute("aria-pressed", sound); btnSound.textContent = sound ? L.sound_on : L.sound_off; if (sound) actx(); });
    btnWarp.addEventListener("click", function () {
      warp = !warp; btnWarp.setAttribute("aria-pressed", warp); btnWarp.textContent = warp ? L.warp_on : L.warp_off;
      if (warp) { actx(); warpBase = Date.now(); warpStart = performance.now(); } lastMs = clockNow();
    });
    setInterval(info, 1000); info();
    return { tick: tick };
  })();

  /* the call through the year */
  (function year() {
    var cv = document.getElementById("year"); if (!cv) return;
    var out = document.getElementById("year-facts"), y = S.local(Date.now()).y, days = [];
    for (var i = 0; i < 366; i++) { var ms = Date.UTC(y, 0, 1 + i, 5) ; if (S.local(ms).y !== y) break; var d = S.sunDay(ms, S.SANSAI.lat, S.SANSAI.lon), mid = S.localMidnight(ms); days.push({ ms: ms, dawn: (d.dawn - mid) / 60000, dusk: (d.dusk - mid) / 60000 }); }
    function ext(k, f) { return days.reduce(function (a, b) { return f(b[k], a[k]) ? b : a; }); }
    var eD = ext("dawn", function (a, b) { return a < b; }), lD = ext("dawn", function (a, b) { return a > b; }), eK = ext("dusk", function (a, b) { return a < b; }), lK = ext("dusk", function (a, b) { return a > b; });
    function dstr(ms) { var l = S.local(ms); return LANG === "th" ? l.d + " " + S.THAI_MONTHS[l.mo] : l.d + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][l.mo]; }
    function mstr(m) { var h = Math.floor(m / 60), mi = Math.round(m % 60); if (mi === 60) { h++; mi = 0; } return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi; }
    out.innerHTML = L.year_facts.replace("{ed}", dstr(eD.ms)).replace("{edt}", mstr(eD.dawn)).replace("{ld}", dstr(lD.ms)).replace("{ldt}", mstr(lD.dawn))
      .replace("{ek}", dstr(eK.ms)).replace("{ekt}", mstr(eK.dusk)).replace("{lk}", dstr(lK.ms)).replace("{lkt}", mstr(lK.dusk));
    var hover = -1;
    function draw() {
      var o = setup(cv, 0.46), c = o.ctx, w = o.w, h = o.h, pad = { l: 46, r: 12, t: 14, b: 26 }, ph = (h - pad.t - pad.b - 16) / 2;
      c.clearRect(0, 0, w, h);
      var today = Math.floor((Date.now() - Date.UTC(y, 0, 1)) / 86400000);
      [["dawn", 0, "#d9826a"], ["dusk", 1, "#5a4a9a"]].forEach(function (p) {
        var top = pad.t + p[1] * (ph + 16), vals = days.map(function (d) { return d[p[0]]; }), lo = Math.min.apply(null, vals) - 4, hi = Math.max.apply(null, vals) + 4;
        var X = function (i) { return pad.l + i / (days.length - 1) * (w - pad.l - pad.r); }, Y = function (v) { return top + (v - lo) / (hi - lo) * ph; };
        c.fillStyle = p[1] ? "rgba(90,74,154,0.07)" : "rgba(217,130,106,0.08)"; c.fillRect(pad.l, top, w - pad.l - pad.r, ph);
        c.strokeStyle = "rgba(60,40,20,0.15)"; c.lineWidth = 1; c.font = "11px system-ui, sans-serif"; c.fillStyle = "#6a4a2a"; c.textAlign = "right"; c.textBaseline = "middle";
        for (var mm = Math.ceil(lo / 15) * 15; mm <= hi; mm += 15) { c.beginPath(); c.moveTo(pad.l, Y(mm)); c.lineTo(w - pad.r, Y(mm)); c.stroke(); if (mm % 30 === 0) c.fillText(mstr(mm), pad.l - 6, Y(mm)); }
        c.strokeStyle = p[2]; c.lineWidth = 2.5; c.beginPath(); days.forEach(function (d, i) { c.lineTo(X(i), Y(d[p[0]])); }); c.stroke();
        c.textAlign = "left"; c.fillStyle = p[2]; c.font = "600 12px var(--thai), system-ui"; c.fillText(p[1] ? L.dusk : L.dawn, pad.l + 6, top + 10);
        if (today >= 0 && today < days.length) { c.fillStyle = "#b5231c"; c.beginPath(); c.arc(X(today), Y(days[today][p[0]]), 5, 0, TAU); c.fill(); }
        if (hover >= 0) { c.strokeStyle = "rgba(40,20,0,0.5)"; c.beginPath(); c.moveTo(X(hover), top); c.lineTo(X(hover), top + ph); c.stroke(); c.fillStyle = "#1f160e"; c.beginPath(); c.arc(X(hover), Y(days[hover][p[0]]), 3.5, 0, TAU); c.fill(); }
      });
      c.fillStyle = "#6a4a2a"; c.textAlign = "center"; c.font = "11px system-ui"; c.textBaseline = "alphabetic";
      for (var mo = 0; mo < 12; mo++) { var di = Math.floor((Date.UTC(y, mo, 15) - Date.UTC(y, 0, 1)) / 86400000); c.fillText(LANG === "th" ? ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][mo] : ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][mo], pad.l + di / (days.length - 1) * (w - pad.l - pad.r), h - 8); }
      if (hover >= 0) { var dd = days[hover]; document.getElementById("year-hover").textContent = dstr(dd.ms) + " · " + L.dawn + " " + mstr(dd.dawn) + " · " + L.dusk + " " + mstr(dd.dusk); }
    }
    cv.addEventListener("pointermove", function (e) { var r = cv.getBoundingClientRect(), x = e.clientX - r.left; hover = clamp(Math.round((x - 46) / (r.width - 58) * (days.length - 1)), 0, days.length - 1); draw(); });
    cv.addEventListener("pointerleave", function () { hover = -1; draw(); document.getElementById("year-hover").textContent = ""; });
    draw(); window.addEventListener("resize", draw);
  })();

  /* ======================================================================= */
  /* 3  the birds                                                             */
  /* ======================================================================= */
  var Cards = (function () {
    var cards = [].slice.call(document.querySelectorAll(".card[data-slug]")), vis = new Set();
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) vis.add(e.target); else vis.delete(e.target); }); }, { rootMargin: "120px" }) : null;
    cards.forEach(function (card) {
      var sp = BY[card.dataset.slug]; card._sp = sp; card._st = newState(Math.random() * 9); card._cv = card.querySelector("canvas");
      if (io) io.observe(card); else vis.add(card);
      var btn = card.querySelector(".play");
      var go = function () {
        if (card._st.h && !card._st.h.stopped) { stop(card._st.h); return; }
        card._st.h = play(sp.slug, { onend: function () { btn.classList.remove("on"); }, onstart: function () { btn.classList.add("on"); } });
        card._st.until = card._st.t + 5;
        if (!card._st.h) card._st.until = card._st.t + 4; // no recording: the bird still displays
      };
      if (btn) btn.addEventListener("click", go);
      card._cv.addEventListener("click", go);
    });
    // filter chips
    var chips = [].slice.call(document.querySelectorAll(".chips button"));
    chips.forEach(function (b) { b.addEventListener("click", function () {
      chips.forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      var f = b.dataset.f; cards.forEach(function (c) { c.hidden = f !== "all" && c._sp.hab.indexOf(f) < 0; });
    }); });
    function frame(dt) {
      vis.forEach(function (card) {
        if (card.hidden) return;
        var st = card._st, sp = card._sp; stepState(st, sp, dt);
        var o = setup(card._cv), c = o.ctx; c.clearRect(0, 0, o.w, o.h);
        // a perch line under every bird, drawn as a twig
        BD.fit(c, sp, { t: st.t, gape: st.gape, blink: st.blink, turn: st.turn, cock: st.cock, crest: st.crest, display: st.display, bob: st.bob, lw: 1.1 }, 0, 0, o.w, o.h, 12 + st.display * o.h * 0.22, false);
      });
    }
    return { frame: frame };
  })();

  /* ======================================================================= */
  /* 4  the chorus wheel                                                      */
  /* ======================================================================= */
  var Chorus = (function () {
    var cv = document.getElementById("ring"), btn = document.getElementById("ch-play"), lab = document.getElementById("ch-time"), top3 = document.getElementById("ch-top");
    if (!cv) return { stop: function () { }, frame: function () { } };
    var sel = B.filter(function (b) { return hasAudio(b.slug) || true; });
    var minute = Math.round((Date.now() - S.localMidnight(Date.now())) / 60000), playing = false, voices = {}, drag = false, hover = -1, W = 0, R = 0, r0 = 0;
    function msAt(m) { return S.localMidnight(Date.now()) + m * 60000; }
    function ang(m) { return Math.PI / 2 + m / 1440 * TAU; } // midnight at the bottom, noon at the top
    function draw() {
      var o = setup(cv, 1), c = o.ctx; W = o.w; R = W * 0.47; r0 = R * 0.34;
      c.clearRect(0, 0, W, W); c.save(); c.translate(W / 2, W / 2);
      var d = daySun(Date.now()), mid = S.localMidnight(Date.now()), mm = function (t) { return (t - mid) / 60000; };
      // sky band behind: 96 wedges coloured by the sun
      for (var k = 0; k < 96; k++) { var m0 = k * 15, s = S.sunPos(msAt(m0 + 7), S.CM.lat, S.CM.lon); c.fillStyle = s.alt > 0 ? BD.mix("#f7e2a8", "#fff3d0", clamp(s.alt / 40, 0, 1)) : s.alt > -6 ? "#f0b8a0" : s.alt > -12 ? "#b9b4d6" : "#d8d8ea"; c.beginPath(); c.arc(0, 0, R, ang(m0), ang(m0 + 15.5)); c.arc(0, 0, r0 * 0.96, ang(m0 + 15.5), ang(m0), true); c.closePath(); c.fill(); }
      var n = sel.length, tw = (R - r0) / n;
      sel.forEach(function (sp, i) {
        var ri = r0 + i * tw, col = birdInk(sp);
        c.fillStyle = col; c.globalAlpha = hover === i ? 1 : 0.82;
        c.beginPath();
        for (var m = 0; m <= 1440; m += 10) { var a = activity(sp, msAt(m)), rr = ri + tw * 0.08 + tw * 0.84 * a; c.lineTo(Math.cos(ang(m)) * rr, Math.sin(ang(m)) * rr); }
        for (var m2 = 1440; m2 >= 0; m2 -= 10) { var rr2 = ri + tw * 0.08; c.lineTo(Math.cos(ang(m2)) * rr2, Math.sin(ang(m2)) * rr2); }
        c.closePath(); c.fill(); c.globalAlpha = 1;
      });
      // hour ticks and labels
      c.fillStyle = "#5a3a1a"; c.font = "600 " + Math.max(10, W * 0.024) + "px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      for (var hh = 0; hh < 24; hh += 3) { var a2 = ang(hh * 60); c.fillText(hh, Math.cos(a2) * (R + W * 0.0), Math.sin(a2) * (R + W * 0.0)); }
      // dawn and dusk marks
      [d.dawn, d.dusk].forEach(function (t) { var a3 = ang(mm(t)); c.strokeStyle = "#b5231c"; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(Math.cos(a3) * r0, Math.sin(a3) * r0); c.lineTo(Math.cos(a3) * R, Math.sin(a3) * R); c.stroke(); c.setLineDash([]); });
      // the hand
      var a4 = ang(minute); c.strokeStyle = "#1f160e"; c.lineWidth = 3; c.beginPath(); c.moveTo(Math.cos(a4) * r0 * 0.9, Math.sin(a4) * r0 * 0.9); c.lineTo(Math.cos(a4) * R * 1.02, Math.sin(a4) * R * 1.02); c.stroke();
      c.fillStyle = "#1f160e"; c.beginPath(); c.arc(Math.cos(a4) * R * 1.02, Math.sin(a4) * R * 1.02, 8, 0, TAU); c.fill();
      // centre: the time, and a sun or moon
      c.fillStyle = "#fffaf0"; c.beginPath(); c.arc(0, 0, r0 * 0.9, 0, TAU); c.fill();
      var s2 = S.sunPos(msAt(minute), S.CM.lat, S.CM.lon);
      c.fillStyle = s2.alt > 0 ? "#f2b632" : "#3a4a8a"; c.beginPath(); c.arc(0, -r0 * 0.35, r0 * 0.16, 0, TAU); c.fill();
      if (s2.alt <= 0) { c.fillStyle = "#fffaf0"; c.beginPath(); c.arc(r0 * 0.07, -r0 * 0.39, r0 * 0.14, 0, TAU); c.fill(); }
      c.fillStyle = "#1f160e"; c.font = "700 " + (r0 * 0.36) + "px 'Fraunces', Georgia, serif"; c.fillText(S.hhmm(msAt(minute)), 0, r0 * 0.12);
      c.restore();
      lab.textContent = S.hhmm(msAt(minute));
      var ranked = sel.map(function (sp) { return [sp, activity(sp, msAt(minute))]; }).sort(function (a, b) { return b[1] - a[1]; }).filter(function (x) { return x[1] > 0.12; }).slice(0, 5);
      top3.textContent = ranked.length ? ranked.map(function (x) { return name(x[0]); }).join(" · ") : L.quiet;
      if (hover >= 0) top3.textContent = name(sel[hover]) + " — " + L.ring_hint;
    }
    function pick(e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2, rr = Math.hypot(x, y) * W / r.width;
      return { a: Math.atan2(y, x), r: rr };
    }
    function setFromAngle(a) { var m = ((a - Math.PI / 2) / TAU * 1440 + 1440 * 2) % 1440; minute = Math.round(m); draw(); if (playing) schedule(true); }
    cv.addEventListener("pointerdown", function (e) { drag = true; cv.setPointerCapture(e.pointerId); setFromAngle(pick(e).a); });
    cv.addEventListener("pointermove", function (e) { var p = pick(e); if (drag) setFromAngle(p.a); else { var i = Math.floor((p.r - r0) / ((R - r0) / sel.length)); var nh = (p.r > r0 && p.r < R) ? i : -1; if (nh !== hover) { hover = nh; draw(); } } });
    cv.addEventListener("pointerup", function () { drag = false; });
    cv.addEventListener("pointerleave", function () { if (hover >= 0) { hover = -1; draw(); } });
    cv.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowUp") { minute = (minute + 15) % 1440; draw(); } if (e.key === "ArrowLeft" || e.key === "ArrowDown") { minute = (minute + 1425) % 1440; draw(); } });
    document.querySelectorAll("[data-at]").forEach(function (b) { b.addEventListener("click", function () {
      var d = daySun(Date.now()), mid = S.localMidnight(Date.now()), at = b.dataset.at;
      minute = at === "dawn" ? Math.round((d.dawn - mid) / 60000) : at === "dusk" ? Math.round((d.dusk - mid) / 60000) : at === "noon" ? 720 : 0;
      draw(); if (playing) schedule(true);
    }); });
    function schedule(changed) {
      var ms = msAt(minute);
      sel.forEach(function (sp, i) {
        if (!hasAudio(sp.slug)) return;
        var a = activity(sp, ms), v = voices[sp.slug] || (voices[sp.slug] = { next: performance.now() / 1000 + Math.random() * 3, h: null, pan: (i / sel.length) * 1.6 - 0.8 });
        v.a = a;
        if (changed && a < 0.12 && v.h) { stop(v.h); v.h = null; }
      });
    }
    function tick() {
      if (!playing) return;
      var now = performance.now() / 1000;
      sel.forEach(function (sp) {
        var v = voices[sp.slug]; if (!v || v.a < 0.12) return;
        if ((!v.h || v.h.stopped) && now > v.next) {
          v.h = play(sp.slug, { gain: 0.35 + 0.55 * v.a, pan: v.pan, max: 10, onend: function () { v.next = performance.now() / 1000 + (2 + Math.random() * 7) / Math.max(0.2, v.a); } });
          v.next = now + 999;
        }
      });
    }
    btn.addEventListener("click", function () {
      playing = !playing; btn.setAttribute("aria-pressed", playing); btn.textContent = playing ? L.chorus_stop : L.chorus_play;
      if (playing) { actx(); voices = {}; schedule(false); } else Object.keys(voices).forEach(function (k) { stop(voices[k].h); });
    });
    setInterval(tick, 300);
    draw(); window.addEventListener("resize", draw);
    return { stop: function () { if (playing) btn.click(); } };
  })();

  /* ======================================================================= */
  /* 5  up the mountain                                                       */
  /* ======================================================================= */
  (function ladder() {
    var cv = document.getElementById("mountain"); if (!cv) return;
    var stations = DATA.places, keys = ["moat", "wat_suthep", "suthep", "chiangdao", "phahompok", "inthanon"];
    var order = B.slice().sort(function (a, b) { return a.alt[1] - b.alt[1] || a.alt[0] - b.alt[0]; });
    var hits = [], states = {}, hover = null;
    function draw(dt) {
      var o = setup(cv, cv.clientWidth < 640 ? 0.9 : 0.5), c = o.ctx, w = o.w, h = o.h, top = 24, bot = h - 34, Y = function (m) { return bot - m / 2800 * (bot - top); };
      c.clearRect(0, 0, w, h);
      // sky band, then the mountain through the six stations
      var g = c.createLinearGradient(0, top, 0, bot); g.addColorStop(0, "#dfe9f2"); g.addColorStop(1, "#fbf3e2"); c.fillStyle = g; c.fillRect(0, top - 24, w, bot - top + 24);
      var xs = keys.map(function (k, i) { return w * (0.06 + i / (keys.length - 1) * 0.88); });
      c.beginPath(); c.moveTo(0, bot);
      for (var x = 0; x <= w; x += 2) {
        var u = x / w, i = Math.min(keys.length - 2, Math.max(0, Math.floor((u - 0.06) / 0.88 * (keys.length - 1)))), t = clamp(((u - 0.06) / 0.88 * (keys.length - 1)) - i, 0, 1);
        var a0 = stations[keys[i]].alt, a1 = stations[keys[i + 1]].alt, base = lerp(a0, a1, t * t * (3 - 2 * t));
        if (u < 0.06) base = stations.moat.alt; if (u > 0.94) base = stations.inthanon.alt - (u - 0.94) * 4000;
        var f = 0; for (var oc = 1; oc <= 5; oc++) f += Math.sin(u * Math.pow(2, oc) * 9 + oc) / Math.pow(2, oc);
        c.lineTo(x, Y(base + f * 90 * clamp(base / 800, 0.2, 1)));
      }
      c.lineTo(w, bot); c.closePath();
      var mg = c.createLinearGradient(0, top, 0, bot); mg.addColorStop(0, "#5f7d6a"); mg.addColorStop(1, "#a9b98e"); c.fillStyle = mg; c.fill();
      // altitude lines
      c.strokeStyle = "rgba(40,30,20,0.12)"; c.fillStyle = "#6a5a4a"; c.font = "11px system-ui"; c.textAlign = "left";
      for (var m = 0; m <= 2500; m += 500) { c.beginPath(); c.moveTo(0, Y(m)); c.lineTo(w, Y(m)); c.stroke(); c.fillText(fmtNum(m) + " m", 4, Y(m) - 3); }
      // stations
      c.textAlign = "center"; c.font = "600 " + (w < 640 ? 10 : 12) + "px var(--thai), system-ui";
      keys.forEach(function (k, i) { var st = stations[k], yy = Y(st.alt) + 26, xx = clamp(xs[i], 50, w - 50); c.fillStyle = "#fff"; c.beginPath(); c.arc(xs[i], Y(st.alt), 4, 0, TAU); c.fill(); c.shadowColor = "rgba(0,0,0,.55)"; c.shadowBlur = 4; if (w >= 640) c.fillText(LANG === "th" ? st.th : st.en, xx, yy); c.font = "11px system-ui"; c.fillText(fmtNum(st.alt) + " m", xx, w >= 640 ? yy + 14 : yy - 8); c.shadowBlur = 0; c.font = "600 " + (w < 640 ? 10 : 12) + "px var(--thai), system-ui"; });
      // a column for each bird: the height band where it lives, the bird on top
      hits = [];
      var n = order.length, cw = w * 0.9 / n;
      order.forEach(function (sp, i) {
        var x = w * 0.05 + (i + 0.5) * cw, y0 = Y(sp.alt[0]), y1 = Y(sp.alt[1]), col = birdInk(sp);
        c.fillStyle = BD.hexA(col, hover === sp ? 0.85 : 0.45); roundRect(c, x - cw * 0.18, y1, cw * 0.36, y0 - y1, cw * 0.18); c.fill();
        var st = states[sp.slug] || (states[sp.slug] = newState(i)); stepState(st, sp, dt || 0.016);
        var bw = Math.min(cw * 1.6, 56), bh = bw;
        BD.fit(c, sp, { t: st.t, gape: st.gape, blink: st.blink, turn: st.turn, crest: st.crest, display: st.display, lw: 0.8 }, x - bw / 2, y1 - bh - 2, bw, bh, 2, i % 2 === 1);
        hits.push({ x0: x - bw / 2, x1: x + bw / 2, y0: y1 - bh, y1: y0, sp: sp, st: st });
      });
      if (hover) { c.fillStyle = "#1f160e"; c.font = "600 13px var(--thai), system-ui"; c.textAlign = "center"; var hh = hits.filter(function (q) { return q.sp === hover; })[0]; if (hh) c.fillText(name(hover) + " · " + fmtNum(hover.alt[0]) + "–" + fmtNum(hover.alt[1]) + " m", clamp((hh.x0 + hh.x1) / 2, 90, w - 90), Math.min(bot + 22, hh.y1 + 18)); }
    }
    function at(e) { var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return hits.filter(function (h) { return x >= h.x0 && x <= h.x1 && y >= h.y0 - 10 && y <= h.y1 + 10; })[0]; }
    cv.addEventListener("pointermove", function (e) { var h = at(e); hover = h ? h.sp : null; cv.style.cursor = h ? "pointer" : "default"; });
    cv.addEventListener("pointerdown", function (e) { var h = at(e); if (h) { hover = h.sp; h.st.h = play(h.sp.slug); h.st.until = h.st.t + 5; } });
    window.LADDER = draw;
  })();

  /* ======================================================================= */
  /* 6  legends, drawn                                                        */
  /* ======================================================================= */
  var Glyphs = (function () {
    var list = [].slice.call(document.querySelectorAll("canvas[data-glyph]"));
    function hamsa(c, w, h, t) { // the hamsa on its pole: an S-curved neck, a body, a tail of kanok flames
      var s = Math.min(w, h) / 100; c.save(); c.translate(w / 2, h * 0.55); c.scale(s, s);
      c.strokeStyle = "#8a5a24"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 8); c.lineTo(0, 46); c.stroke();
      for (var k = 0; k < 3; k++) { c.fillStyle = "#c8902a"; c.beginPath(); c.ellipse(0, 20 + k * 9, 4 - k * 0.6, 1.6, 0, 0, TAU); c.fill(); }
      var bob = Math.sin(t * 1.2) * 1.5; c.translate(0, bob);
      c.fillStyle = "#e9c25c"; c.strokeStyle = "#6a4310"; c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, 2, 20, 8, -0.06, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(14, -2); c.bezierCurveTo(28, -6, 10, -22, 20, -32); c.bezierCurveTo(24, -36, 30, -34, 32, -30); c.lineTo(38, -29); c.lineTo(31, -27); c.bezierCurveTo(26, -28, 22, -24, 22, -18); c.bezierCurveTo(22, -8, 30, -2, 18, 5); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#3a1c0a"; c.beginPath(); c.arc(27, -31, 1, 0, TAU); c.fill();
      for (var f = 0; f < 5; f++) { // tail flames: log spirals
        var a0 = Math.PI + 0.35 - f * 0.22, bx = -18, by = 0;
        c.strokeStyle = "#c8902a"; c.lineWidth = 2.2 - f * 0.25; c.beginPath();
        for (var q = 0; q <= 1; q += 0.04) { var rr = 6 + q * 24, aa = a0 - q * 0.9 + Math.sin(t * 2 + f) * 0.04; c.lineTo(bx + Math.cos(aa) * rr, by + Math.sin(aa) * rr * 0.9 - q * q * 10); }
        var ex = bx + Math.cos(a0 - 0.9) * 30, ey = by + Math.sin(a0 - 0.9) * 27 - 10; c.stroke();
        c.beginPath(); for (var z = 0; z < 9; z += 0.3) { var r3 = 4 * Math.exp(-0.25 * z); c.lineTo(ex + Math.cos(z) * r3, ey - 4 + Math.sin(z) * r3); } c.stroke();
      }
      c.restore();
    }
    function karawek(c, w, h, t) { // the karawek sings; every creature stops; rings spread
      var sp = BY["green-tailed-sunbird"], s = { t: t, gape: 0.4 + 0.4 * Math.abs(Math.sin(t * 6)), crest: 1, carve: function (hex) { return BD.mix(hex || "#888888", "#e3b04a", 0.55); }, ink: "#5a3a10", lw: 1.1 };
      for (var k = 0; k < 6; k++) { var p = ((t * 0.35 + k / 6) % 1); c.strokeStyle = "rgba(200,144,42," + (1 - p) * 0.55 + ")"; c.lineWidth = 2; c.beginPath(); c.arc(w * 0.62, h * 0.4, 10 + p * Math.max(w, h) * 0.55, 0, TAU); c.stroke(); }
      BD.fit(c, sp, s, w * 0.1, h * 0.1, w * 0.8, h * 0.8, 6, false);
    }
    function garuda(c, w, h, t) { // spread wings: two fans of feathers about the shoulders, red and gold
      var s = Math.min(w, h) / 100, flap = Math.sin(t * 1.4) * 0.05; c.save(); c.translate(w / 2, h * 0.58); c.scale(s, s);
      [-1, 1].forEach(function (sd) {
        for (var i = 0; i < 11; i++) { var a = -Math.PI / 2 + sd * (0.25 + i * 0.13 + flap), L2 = 30 + 14 * Math.sin(i / 10 * Math.PI) - i * 0.6;
          c.save(); c.translate(sd * 6, -10); c.rotate(a + Math.PI / 2); c.fillStyle = i % 2 ? "#c8302a" : "#e0a83a"; c.strokeStyle = "#5a2a0a"; c.lineWidth = 0.6;
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sd * -4, -L2 * 0.5, 0, -L2); c.quadraticCurveTo(sd * 4, -L2 * 0.5, 0, 0); c.fill(); c.stroke(); c.restore(); }
      });
      c.fillStyle = "#c8302a"; c.beginPath(); c.ellipse(0, 4, 9, 16, 0, 0, TAU); c.fill(); c.strokeStyle = "#5a2a0a"; c.stroke();
      c.fillStyle = "#2a6a3a"; c.beginPath(); c.arc(0, -17, 7, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = "#e0a83a"; c.beginPath(); c.moveTo(-5, -22); for (var k = 0; k < 5; k++) { c.lineTo(-4 + k * 0.6, -24 - k * 3); c.lineTo(4 - k * 0.6, -24 - k * 3); } c.lineTo(5, -22); c.fill(); c.beginPath(); c.moveTo(-1, -40); c.lineTo(0, -46); c.lineTo(1, -40); c.fill();
      c.fillStyle = "#e0a83a"; c.beginPath(); c.moveTo(3, -16); c.quadraticCurveTo(9, -15, 6, -11); c.lineTo(3, -13); c.fill();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(2, -18, 1.4, 0, TAU); c.fill(); c.fillStyle = "#000"; c.beginPath(); c.arc(2.4, -18, 0.7, 0, TAU); c.fill();
      c.restore();
    }
    function kinnari(c, w, h, t) { // a pair of kanok curls, mirrored, breathing
      var s = Math.min(w, h) / 100; c.save(); c.translate(w / 2, h / 2); c.scale(s, s);
      [-1, 1].forEach(function (sd) {
        c.strokeStyle = sd > 0 ? "#c8902a" : "#b5231c"; c.lineWidth = 3;
        c.beginPath(); for (var th = 0; th < 4.6 * Math.PI; th += 0.05) { var r = 26 * Math.exp(-0.17 * th) * (1 + 0.03 * Math.sin(t * 1.5)); c.lineTo(sd * (20 + Math.cos(th) * r), -Math.sin(th) * r - 2); } c.stroke();
        c.beginPath(); c.moveTo(sd * 46, -2); c.quadraticCurveTo(sd * 30, 30, 0, 34); c.stroke();
      });
      c.restore();
    }
    var fns = { hamsa: hamsa, karawek: karawek, garuda: garuda, kinnari: kinnari };
    function frame(t) { list.forEach(function (cv) { var r = cv.getBoundingClientRect(); if (r.bottom < -50 || r.top > innerHeight + 50) return; var o = setup(cv), c = o.ctx; c.clearRect(0, 0, o.w, o.h); fns[cv.dataset.glyph](c, o.w, o.h, t); }); }
    return { frame: frame };
  })();

  /* ======================================================================= */
  /* one loop for everything that moves                                       */
  /* ======================================================================= */
  var last = performance.now(), sceneVisible = true, clockVisible = true;
  if ("IntersectionObserver" in window) {
    var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.target.id === "scene") sceneVisible = e.isIntersecting; if (e.target.id === "clockface") clockVisible = e.isIntersecting; }); });
    ["scene", "clockface"].forEach(function (id) { var el = document.getElementById(id); if (el) io2.observe(el); });
  }
  function loop(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now; var t = now / 1000;
    if (sceneVisible) Scene.frame(dt, t);
    if (Clock && clockVisible) Clock.tick(t);
    Cards.frame(dt);
    if (window.LADDER) { var m = document.getElementById("mountain"), r = m.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) window.LADDER(dt); }
    Glyphs.frame(t);
    dockDraw();
    requestAnimationFrame(loop);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { });
  requestAnimationFrame(loop);

  // language toggle remembers the reader's choice
  document.querySelectorAll("[data-lang]").forEach(function (a) { a.addEventListener("click", function () { try { localStorage.setItem("bcm-lang", a.dataset.lang); } catch (e) { } }); });
})();
