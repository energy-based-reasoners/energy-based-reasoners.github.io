(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var STEP_MS = 850;
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function el(tag, attrs, parent, svg) {
    var e = svg ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function fmt(v) { return (v < 0 ? "\u2212" : "") + Math.abs(v).toFixed(1); }
  function key(r, c) { return r + "," + c; }

  function buildNQ(stage, D) {
    var n = D.n, S = 36, pad = 2, W = n * S + 2 * pad;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + W, class: "ebr-multi__svg", role: "img" }, stage, true);
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++)
      el("rect", { x: pad + c * S, y: pad + r * S, width: S, height: S, class: (r + c) % 2 ? "nq-dark" : "nq-light" }, svg, true);
    el("rect", { x: pad, y: pad, width: n * S, height: n * S, class: "nq-frame" }, svg, true);
    var given = {}; D.given.forEach(function (g) { given[key(g[0], g[1])] = 1; });
    var layer = el("g", {}, svg, true), prev = null;
    return function (s) {
      layer.innerHTML = "";
      var att = {}; s.attacked.forEach(function (a) { att[key(a[0], a[1])] = 1; });
      var now = {};
      s.queens.forEach(function (q) {
        var k = key(q[0], q[1]); now[k] = 1;
        var x = pad + q[1] * S, y = pad + q[0] * S;
        if (att[k]) el("rect", { x: x, y: y, width: S, height: S, class: "nq-attack" }, layer, true);
        var cls = "nq-queen" + (given[k] ? " is-given" : att[k] ? " is-bad" : "") + (prev && !prev[k] ? " is-new" : "");
        var t = el("text", { x: x + S / 2, y: y + S / 2 + 1, class: cls }, layer, true);
        t.textContent = "\u265B";
      });
      prev = now;
      svg.setAttribute("aria-label", "N-Queens board at step " + s.t);
      return s.solved ? "solved \u2713" : s.n_queens + "/" + n + " queens" +
        (s.n_attacks ? " \u00b7 " + s.n_attacks + " attack" + (s.n_attacks > 1 ? "s" : "") : "");
    };
  }

  function buildGC(stage, D) {
    var N = D.nodes, W = 300, R = 118, cx = W / 2, cy = W / 2 + 2;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + W, class: "ebr-multi__svg", role: "img" }, stage, true);
    var xy = [];
    for (var v = 0; v < N; v++) { var a = Math.PI / 2 - 2 * Math.PI * v / N; xy.push([cx + R * Math.cos(a), cy - R * Math.sin(a)]); }
    var eg = el("g", {}, svg, true), lines = {};
    D.edges.forEach(function (e) {
      lines[key(e[0], e[1])] = el("line", { x1: xy[e[0]][0], y1: xy[e[0]][1], x2: xy[e[1]][0], y2: xy[e[1]][1], class: "gc-edge" }, eg, true);
    });
    var dots = xy.map(function (p) { return el("circle", { cx: p[0], cy: p[1], r: 15, class: "gc-node" }, svg, true); });
    var prev = null;
    return function (s) {
      var bad = {}; s.conflicts.forEach(function (c) { bad[key(c[0], c[1])] = 1; });
      for (var k in lines) lines[k].classList.toggle("is-bad", !!bad[k]);
      s.colors.forEach(function (c, v) {
        dots[v].style.fill = c >= 0 ? D.palette[c] : "#fff";
        if (prev && prev.colors[v] !== c) { dots[v].classList.remove("is-new"); void dots[v].getBBox(); dots[v].classList.add("is-new"); }
      });
      prev = s;
      svg.setAttribute("aria-label", "Graph coloring at step " + s.t);
      var nc = s.conflicts.length;
      return s.solved ? "solved \u2713" : nc + " conflict" + (nc === 1 ? "" : "s");
    };
  }

  function build(root, D, task) {
    var S = D.steps, N = S.length;
    root.innerHTML = "";
    var stage = el("div", { class: "ebr-multi__stage" }, root);
    var draw = task === "nq" ? buildNQ(stage, D) : buildGC(stage, D);
    var read = el("div", { class: "ebr-multi__read" }, root);
    var rS = el("span", {}, read), rE = el("span", {}, read), rW = el("span", { class: "ebr-multi__status" }, read);
    var ctl = el("div", { class: "ebr-multi__ctl" }, root);
    var btn = el("button", { type: "button", class: "ebr-multi__play", "aria-label": "Play" }, ctl);
    var slider = el("input", { type: "range", min: 0, max: N - 1, step: 1, value: 0, "aria-label": "Descent step" }, ctl);
    var cur = 0;
    function show(i) {
      i = Math.max(0, Math.min(N - 1, i | 0));
      var s = S[i], status = draw(s);
      rS.textContent = "step " + s.t; rE.textContent = "energy " + fmt(s.energy); rW.textContent = status;
      root.classList.toggle("is-solved", !!s.solved);
      slider.value = i; cur = i;
    }
    var timer = null, playing = false;
    function setPlaying(p) {
      playing = p; btn.classList.toggle("is-playing", p);
      btn.classList.remove("is-done"); btn.setAttribute("aria-label", p ? "Pause" : "Play");
      clearTimeout(timer); if (p) tick(cur >= N - 1 ? -1 : cur);
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
    var m = new RegExp(task + "=(\\d+)").exec(location.hash);
    if (m) { show(+m[1]); if (cur === N - 1) finish(); return; }
    if (REDUCE) { show(N - 1); finish(); return; }
    show(0);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); setPlaying(true); } });
      }, { threshold: 0.5 });
      io.observe(root);
    } else setPlaying(true);
  }

  function init() {
    var data = window.EBR_MULTI_DATA;
    document.querySelectorAll(".ebr-multi").forEach(function (root) {
      var task = root.getAttribute("data-task");
      if (data && data[task]) build(root, data[task], task);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
