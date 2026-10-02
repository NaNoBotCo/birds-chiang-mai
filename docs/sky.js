/* sky.js — sun, moon and the Thai lunar day, by arithmetic.
 * Sun: NOAA solar calculator equations. Moon: Meeus, Astronomical Algorithms ch. 47–48,
 * main terms only (about a quarter of a degree). Thai lunar day: counted from the
 * published wan phra anchors for BE 2569 (Thai PBS), the same table the Coucal Clock carries.
 */
(function (G) {
  "use strict";
  var R = Math.PI / 180, TZ = 7; // Indochina Time, no daylight saving

  function jd(ms) { return ms / 86400000 + 2440587.5; }
  function T(ms) { return (jd(ms) - 2451545.0) / 36525; }
  function norm(a) { a %= 360; return a < 0 ? a + 360 : a; }

  /* --- the sun ------------------------------------------------------------ */
  function sunCore(ms) {
    var t = T(ms);
    var L0 = norm(280.46646 + t * (36000.76983 + t * 0.0003032));
    var M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    var e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    var C = Math.sin(M * R) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
      Math.sin(2 * M * R) * (0.019993 - 0.000101 * t) + Math.sin(3 * M * R) * 0.000289;
    var lon = L0 + C;
    var om = 125.04 - 1934.136 * t;
    var lam = lon - 0.00569 - 0.00478 * Math.sin(om * R);
    var eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
    var eps = eps0 + 0.00256 * Math.cos(om * R);
    var dec = Math.asin(Math.sin(eps * R) * Math.sin(lam * R)) / R;
    var y = Math.tan(eps * R / 2); y *= y;
    var eot = 4 / R * (y * Math.sin(2 * L0 * R) - 2 * e * Math.sin(M * R) +
      4 * e * y * Math.sin(M * R) * Math.cos(2 * L0 * R) -
      0.5 * y * y * Math.sin(4 * L0 * R) - 1.25 * e * e * Math.sin(2 * M * R)); // minutes
    var ra = Math.atan2(Math.cos(eps * R) * Math.sin(lam * R), Math.cos(lam * R)) / R;
    return { dec: dec, eot: eot, lam: norm(lam), ra: norm(ra), eps: eps };
  }

  function gmst(ms) {
    var d = jd(ms) - 2451545.0, t = d / 36525;
    return norm(280.46061837 + 360.98564736629 * d + t * t * 0.000387933);
  }

  function altaz(ra, dec, ms, lat, lon) {
    var H = norm(gmst(ms) + lon - ra) * R, d = dec * R, p = lat * R;
    var alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
    var az = Math.atan2(-Math.sin(H), Math.tan(d) * Math.cos(p) - Math.sin(p) * Math.cos(H));
    return { alt: alt / R, az: norm(az / R) };
  }

  function sunPos(ms, lat, lon) { var s = sunCore(ms); return altaz(s.ra, s.dec, ms, lat, lon); }

  /* Time (ms) the sun's centre crosses `zenith` degrees on the local civil day containing
   * `dayMs`, rising (+1) or setting (-1). Two passes: the second re-evaluates at the answer. */
  function sunEvent(dayMs, lat, lon, zenith, rising) {
    var d0 = localMidnight(dayMs), guess = d0 + 12 * 3600000;
    for (var i = 0; i < 2; i++) {
      var s = sunCore(guess);
      var c = (Math.cos(zenith * R) - Math.sin(lat * R) * Math.sin(s.dec * R)) /
        (Math.cos(lat * R) * Math.cos(s.dec * R));
      if (c > 1 || c < -1) return null;
      var ha = Math.acos(c) / R;
      var utcMin = 720 - 4 * (lon + (rising ? ha : -ha)) - s.eot;
      guess = utcMidnightOfLocal(d0) + utcMin * 60000;
    }
    return guess;
  }
  function localMidnight(ms) { // ms of 00:00 ICT on the ICT date of ms
    var l = ms + TZ * 3600000; return l - (((l % 86400000) + 86400000) % 86400000) - TZ * 3600000;
  }
  function utcMidnightOfLocal(localMid) { // 00:00 UTC of the same calendar date
    return localMid + TZ * 3600000;
  }

  function sunDay(ms, lat, lon) {
    return {
      dawn: sunEvent(ms, lat, lon, 96, true),
      rise: sunEvent(ms, lat, lon, 90.833, true),
      noon: null,
      set: sunEvent(ms, lat, lon, 90.833, false),
      dusk: sunEvent(ms, lat, lon, 96, false)
    };
  }

  /* --- the moon (Meeus 47, main terms) ------------------------------------ */
  function moonCore(ms) {
    var t = T(ms);
    var Lp = norm(218.3164477 + 481267.88123421 * t);
    var D = norm(297.8501921 + 445267.1114034 * t);
    var M = norm(357.5291092 + 35999.0502909 * t);
    var Mp = norm(134.9633964 + 477198.8675055 * t);
    var F = norm(93.2720950 + 483202.0175233 * t);
    var s = function (x) { return Math.sin(x * R); };
    var lon = Lp + 6.288774 * s(Mp) + 1.274027 * s(2 * D - Mp) + 0.658314 * s(2 * D) +
      0.213618 * s(2 * Mp) - 0.185116 * s(M) - 0.114332 * s(2 * F) +
      0.058793 * s(2 * D - 2 * Mp) + 0.057066 * s(2 * D - M - Mp) + 0.053322 * s(2 * D + Mp) +
      0.045758 * s(2 * D - M) - 0.040923 * s(M - Mp) - 0.034720 * s(D) - 0.030383 * s(M + Mp);
    var lat = 5.128122 * s(F) + 0.280602 * s(Mp + F) + 0.277693 * s(Mp - F) +
      0.173237 * s(2 * D - F) + 0.055413 * s(2 * D - Mp + F) + 0.046271 * s(2 * D - Mp - F);
    var sun = sunCore(ms);
    var eps = sun.eps * R, l = norm(lon) * R, b = lat * R;
    var ra = Math.atan2(Math.sin(l) * Math.cos(eps) - Math.tan(b) * Math.sin(eps), Math.cos(l)) / R;
    var dec = Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l)) / R;
    var elong = norm(lon - sun.lam);              // 0 new, 180 full
    var i = 180 - D - 6.289 * s(Mp) + 2.1 * s(M) - 1.274 * s(2 * D - Mp) - 0.658 * s(2 * D) -
      0.214 * s(2 * Mp) - 0.11 * s(D);
    return { ra: norm(ra), dec: dec, elong: elong, illum: (1 + Math.cos(i * R)) / 2 };
  }
  function moonPos(ms, lat, lon) { var m = moonCore(ms); var p = altaz(m.ra, m.dec, ms, lat, lon); p.elong = m.elong; p.illum = m.illum; return p; }

  /* The Coucal Clock's lunation gear: disc angle = 180°·parity + 180°·fraction, with the
   * fraction from the true elongation and the parity from the count of new moons. */
  var SYN = 29.530588853, NEW0 = Date.UTC(2000, 0, 6, 18, 14);
  function lunation(ms) {
    var m = moonCore(ms), f = m.elong / 360;
    var k = Math.round((ms - NEW0) / (SYN * 86400000) - f);
    var parity = ((k % 2) + 2) % 2;
    return { fraction: f, parity: parity, disc: 180 * parity + 180 * f, illum: m.illum, k: k };
  }

  /* --- Thai calendar ------------------------------------------------------ */
  var THN = "๐๑๒๓๔๕๖๗๘๙";
  function thaiNum(n) { return String(n).replace(/[0-9]/g, function (c) { return THN[+c]; }); }
  var ANCH = ("2026-01-03,x,15,2 2026-01-11,n,8,2 2026-01-18,n,15,2 2026-01-26,x,8,3 2026-02-02,x,15,3 " +
    "2026-02-10,n,8,3 2026-02-16,n,14,3 2026-02-24,x,8,4 2026-03-03,x,15,4 2026-03-11,n,8,4 2026-03-18,n,15,4 " +
    "2026-03-26,x,8,5 2026-04-02,x,15,5 2026-04-10,n,8,5 2026-04-16,n,14,5 2026-04-24,x,8,6 2026-05-01,x,15,6 " +
    "2026-05-09,n,8,6 2026-05-16,n,15,6 2026-05-24,x,8,7 2026-05-31,x,15,7 2026-06-08,n,8,7 2026-06-14,n,14,7 " +
    "2026-06-22,x,8,8 2026-06-29,x,15,8 2026-07-07,n,8,8 2026-07-14,n,15,8 2026-07-22,x,8,8b 2026-07-29,x,15,8b " +
    "2026-07-30,n,1,8b 2026-08-06,n,8,8b 2026-08-13,n,15,8b 2026-08-21,x,8,9 2026-08-28,x,15,9 2026-09-05,n,8,9 " +
    "2026-09-11,n,14,9 2026-09-19,x,8,10 2026-09-26,x,15,10 2026-10-04,n,8,10 2026-10-11,n,15,10 2026-10-19,x,8,11 " +
    "2026-10-26,x,15,11 2026-11-03,n,8,11 2026-11-09,n,14,11 2026-11-17,x,8,12 2026-11-24,x,15,12 2026-12-02,n,8,12 " +
    "2026-12-09,n,15,12 2026-12-17,x,8,1 2026-12-24,x,15,1").split(" ").map(function (r) {
      var p = r.split(","), d = p[0].split("-");
      return { day: Date.UTC(+d[0], +d[1] - 1, +d[2]) / 86400000, wax: p[1] === "x", n: +p[2], m: p[3] };
    });
  function nextMonth(m) { return m === "8" ? "8b" : m === "8b" ? "9" : m === "12" ? "1" : String(+m + 1); }
  /* lunar day for the ICT civil date of ms, or null outside the table */
  function thaiLunar(ms) {
    var day = Math.floor((ms + TZ * 3600000) / 86400000), a = null;
    for (var i = 0; i < ANCH.length; i++) if (ANCH[i].day <= day) a = ANCH[i];
    if (!a) return null;
    var n = day - a.day, wax = a.wax, d = a.n, m = a.m;
    if (wax) { d += n; if (d > 15) { wax = false; d -= 15; } }
    else if (a.n >= 14) { if (n > 0) { wax = true; d = n; m = nextMonth(m); } }
    else d += n;
    if (n > 15) return null;
    // a wan phra: waxing 8 or 15, waning 8, or the last waning day (an anchor)
    var phra = (wax && (d === 8 || d === 15)) || (!wax && d === 8) ||
      ANCH.some(function (x) { return x.day === day && !x.wax && x.n >= 14; });
    return { waxing: wax, day: d, month: m, phra: phra };
  }
  var THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม",
    "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  var THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  function local(ms) { var d = new Date(ms + TZ * 3600000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() + d.getUTCMilliseconds() / 1000 }; }
  function hhmm(ms) { if (ms == null) return "–"; var l = local(ms); return (l.h < 10 ? "0" : "") + l.h + ":" + (l.mi < 10 ? "0" : "") + l.mi; }

  G.SKY = {
    TZ: TZ, sunPos: sunPos, sunDay: sunDay, sunCore: sunCore, moonPos: moonPos, moonCore: moonCore,
    lunation: lunation, thaiLunar: thaiLunar, thaiNum: thaiNum, local: local, hhmm: hhmm,
    localMidnight: localMidnight, THAI_MONTHS: THAI_MONTHS, THAI_DAYS: THAI_DAYS,
    CM: { lat: 18.788, lon: 98.985 }, SANSAI: { lat: 18.85, lon: 99.05 }
  };
})(window);
