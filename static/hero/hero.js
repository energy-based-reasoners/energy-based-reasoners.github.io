(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var STEP_MS = 700;
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function el(tag, attrs, parent, ns) {
    var e = ns ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function fmt(v) { return (v < 0 ? "\u2212" : "") + Math.abs(v).toFixed(1); }

  function build(root, data, base) {
    var W = data.image.width, H = data.image.height, S = data.steps, N = S.length;
    root.innerHTML = "";
    var land = el("div", { class: "ebr-hero__land" }, root);
    var pic = el("div", { class: "ebr-hero__pic" }, land);
    var picEl = el("picture", {}, pic);
    el("source", { srcset: base + "surface.webp", type: "image/webp" }, picEl);
    el("img", { src: base + "surface.png", alt: "Learned energy landscape for one Sudoku puzzle", width: W, height: H }, picEl);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "ebr-hero__overlay", "aria-hidden": "true" }, pic, true);
    function pts(arr) { return arr.map(function (p) { return (p[0] * W).toFixed(1) + "," + (p[1] * H).toFixed(1); }).join(" "); }
    el("polyline", { points: pts(data.guide), class: "ebr-hero__ghost" }, svg, true);
    var trail = el("g", {}, svg, true);
    var trailLines = data.segments.map(function (sg) { return el("polyline", { points: pts(sg), class: "ebr-hero__trail" }, trail, true); });
    var halo = el("circle", { r: 15, class: "ebr-hero__halo" }, svg, true);
    var dot = el("circle", { r: 8.5, class: "ebr-hero__dot" }, svg, true);
    svg.appendChild(halo); svg.appendChild(dot);
    var dbg = /debug/.test(location.hash);
    if (dbg) { land.querySelector("img").src = base + "debug_align.png"; root.classList.add("is-debug"); }
    var cb = el("div", { class: "ebr-hero__cbar" }, land);
    el("span", { class: "ebr-hero__cbl" }, cb).textContent = "Energy";
    var bar = el("span", { class: "ebr-hero__cbbar" }, cb);
    var cs = data.colorbar.colors, n = cs.length, g = [];
    if (data.colorbar.bands) cs.forEach(function (c, k) { g.push(c + " " + (100 * k / n).toFixed(2) + "%", c + " " + (100 * (k + 1) / n).toFixed(2) + "%"); });
    else cs.forEach(function (c, k) { g.push(c + " " + (100 * k / (n - 1)).toFixed(2) + "%"); });
    bar.style.background = "linear-gradient(90deg," + g.join(",") + ")";
    var cbm = el("span", { class: "ebr-hero__cbm" }, bar);
    var lo = el("span", { class: "ebr-hero__cbt" }, cb); lo.textContent = "low";
    cb.insertBefore(lo, bar);
    el("span", { class: "ebr-hero__cbt" }, cb).textContent = "high";

    var side = el("div", { class: "ebr-hero__side" }, root);
    var board = el("div", { class: "ebr-hero__board", role: "img" }, side);
    var cells = [];
    for (var i = 0; i < 81; i++) {
      var r = (i / 9) | 0, c = i % 9;
      var cl = "ebr-hero__cell" + (data.inputs[i] ? " is-given" : "") + (c % 3 === 2 && c < 8 ? " bR" : "") + (r % 3 === 2 && r < 8 ? " bB" : "");
      cells.push(el("div", { class: cl }, board));
    }
    var read = el("div", { class: "ebr-hero__read", "aria-live": "off" }, side);
    var rStep = el("span", {}, read), rE = el("span", {}, read), rW = el("span", { class: "ebr-hero__wrong" }, read);
    var ctl = el("div", { class: "ebr-hero__ctl" }, side);
    var btn = el("button", { type: "button", class: "ebr-hero__play", "aria-label": "Play" }, ctl);
    var slider = el("input", { type: "range", min: 0, max: N - 1, step: 1, value: 0, "aria-label": "Descent step" }, ctl);

    var cur = -1, raf = 0;
    function place(p) { dot.setAttribute("cx", p[0] * W); dot.setAttribute("cy", p[1] * H); halo.setAttribute("cx", p[0] * W); halo.setAttribute("cy", p[1] * H); }
    function glide(from, to) {
      cancelAnimationFrame(raf);
      if (Math.abs(to - from) !== 1) { place([S[to].x, S[to].y]); return; }
      var pts = from < to ? data.segments[from] : data.segments[to].slice().reverse();
      var len = [0];
      for (var i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) * W, (pts[i][1] - pts[i - 1][1]) * H));
      var total = len[len.length - 1] || 1, t0 = performance.now(), dur = STEP_MS * 0.8;
      (function frame(now) {
        var u = Math.min(1, (now - t0) / dur); u = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        var target = u * total, j = 1;
        while (j < len.length - 1 && len[j] < target) j++;
        var f = (target - len[j - 1]) / ((len[j] - len[j - 1]) || 1);
        place([pts[j - 1][0] + f * (pts[j][0] - pts[j - 1][0]), pts[j - 1][1] + f * (pts[j][1] - pts[j - 1][1])]);
        if (u < 1) raf = requestAnimationFrame(frame);
      })(t0);
    }
    function show(t) {
      t = Math.max(0, Math.min(N - 1, t | 0));
      var s = S[t], prev = cur >= 0 ? S[cur] : null;
      if (cur < 0 || REDUCE) place([s.x, s.y]); else glide(cur, t);
      trailLines.forEach(function (ln, k) {
        var age = t - 1 - k;
        ln.style.opacity = age < 0 ? 0 : Math.max(0.12, 1 - age * 0.11);
      });
      for (var i = 0; i < 81; i++) {
        var d = s.digits[i], c = cells[i];
        c.textContent = d || "";
        c.classList.toggle("is-wrong", d !== data.labels[i]);
        if (prev && prev.digits[i] !== d && Math.abs(t - cur) === 1) {
          c.classList.remove("is-flash"); void c.offsetWidth; c.classList.add("is-flash");
        }
      }
      var solved = s.wrong === 0;
      root.classList.toggle("is-solved", solved);
      rStep.textContent = "step " + s.t;
      rE.textContent = "energy " + fmt(s.energy);
      rW.textContent = solved ? "solved \u2713" : s.wrong + " wrong cells";
      board.setAttribute("aria-label", "Sudoku at step " + s.t + ": " + rW.textContent);
      var f = (s.energy - data.colorbar.min) / (data.colorbar.max - data.colorbar.min);
      cbm.style.left = (100 * Math.max(0, Math.min(1, f))) + "%";
      slider.value = t; cur = t;
    }

    var timer = null, playing = false;
    function setPlaying(p) {
      playing = p; btn.classList.toggle("is-playing", p);
      btn.classList.remove("is-done"); btn.setAttribute("aria-label", p ? "Pause" : "Play");
      clearTimeout(timer);
      if (p) tick(cur >= N - 1 ? -1 : cur);
    }
    function finish() {
      playing = false; btn.classList.remove("is-playing"); btn.classList.add("is-done"); btn.setAttribute("aria-label", "Replay");
    }
    function tick(from) {
      if (from === -1) { show(0); timer = setTimeout(function () { tick(0); }, STEP_MS); return; }
      var nx = from + 1;
      if (nx > N - 1) { finish(); return; }
      show(nx);
      if (nx === N - 1) { finish(); return; }
      timer = setTimeout(function () { tick(nx); }, STEP_MS);
    }
    btn.addEventListener("click", function () { setPlaying(!playing); });
    slider.addEventListener("input", function () { setPlaying(false); show(+slider.value); if (cur === N - 1) finish(); });

    var m = /step=(\d+)/.exec(location.hash);
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (m) { show(+m[1]); if (cur === N - 1) finish(); return; }
    if (reduce) { root.classList.add("is-reduced"); show(N - 1); finish(); return; }
    show(0);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { io.disconnect(); setPlaying(true); }
        });
      }, { threshold: 0.4 });
      io.observe(root);
    } else setPlaying(true);
  }

  function init() {
    document.querySelectorAll(".ebr-hero").forEach(function (root) {
      var base = root.hasAttribute("data-src") ? root.getAttribute("data-src") : "static/hero/";
      if (window.EBR_HERO_DATA) return build(root, window.EBR_HERO_DATA, base);
      fetch(base + "path.json").then(function (r) { return r.json(); }).then(function (d) { build(root, d, base); })
        .catch(function () { root.innerHTML = '<img src="' + base + 'surface.png" alt="Energy landscape" style="max-width:100%">'; });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
