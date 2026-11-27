/* =====================================================================
   SPLIT SCREEN
   - 4 susunan: 2 kolom · 2 kolom (kiri lebar) · 1 besar + 2 tumpuk · 2×2
   - batas antar panel bisa digeser (mouse / sentuh / keyboard); klik 2× = ukuran awal
   - tiap panel = satu salinan penuh aplikasi (iframe "?pane=1"), jadi di tiap panel
     bebas membuka kuis, materi HTML, materi lain, farmakologi, dst. secara mandiri
   - login dipakai bersama lewat localStorage yang sama (satu origin)
   ===================================================================== */
(function () {
  "use strict";
  if (window.PANE) return; // panel tidak boleh membuka split di dalam split

  var KEY = "ast.split";
  var GAP = 3, MIN = 0.12, MAXR = 0.88;
  var LAY = {
    a: { n: 2, cx: 0.5, ry: 0.5, t: "2 panel sama lebar" },
    b: { n: 2, cx: 0.66, ry: 0.5, t: "2 panel, kiri lebih lebar" },
    c: { n: 3, cx: 0.55, ry: 0.5, t: "1 besar + 2 bertumpuk" },
    d: { n: 4, cx: 0.5, ry: 0.5, t: "4 panel (2×2)" }
  };
  var DEF_HASH = ["", "#/run", "#/materi", "#/farmako"];

  function ls(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clamp(v) { return Math.min(MAXR, Math.max(MIN, v)); }
  function okHash(h) { return typeof h === "string" && /^#\/?[^\s<>"'\\]{0,300}$/.test(h) ? h : ""; }

  var st = ls(KEY) || {};
  st.lay = LAY[st.lay] ? st.lay : "a";
  st.cx = clamp(+st.cx || LAY[st.lay].cx);
  st.ry = clamp(+st.ry || LAY[st.lay].ry);
  if (typeof st.tr !== "boolean") st.tr = window.innerWidth < window.innerHeight; // HP tegak → atas/bawah
  st.hs = Array.isArray(st.hs) ? st.hs.map(okHash) : [];

  var root, area, bar, panes = [], sp = {}, maxI = -1, saveT = 0, HEADH = 27, FXIDS = ["fxBtn", "fxP", "fxOver"], fxHome = {}, tick = 0, HTML = document.documentElement;

  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      lsSet(KEY, { lay: st.lay, cx: st.cx, ry: st.ry, tr: st.tr, hs: panes.length ? panes.map(function (p, i) { return p.hash || st.hs[i] || ""; }) : st.hs });
    }, 250);
  }

  /* ---------- CSS ---------- */
  var css = [
    "#split{position:fixed;inset:0;z-index:10010;display:flex;flex-direction:column;color:#fff;font:600 12px Inter,system-ui,sans-serif;pointer-events:none}",
    ":root[data-theme=light] #split{color:#241a3f}",
    "#split .sp-bar,#split .sp-h,#split .sp-s,#split .sp-p:not(.host){pointer-events:auto}",
    "html.spon{overflow:hidden;background:#0d0820!important}",
    ":root[data-theme=light].spon{background:#e4dff0!important}",
    /* aplikasi yang sedang berjalan DIKECILKAN jadi panel 1 (bukan dimuat ulang), jadi kuis/materi/scroll tetap utuh.
       transform pada body membuat semua elemen fixed (nav, materi layar penuh, kuis) ikut terkurung di dalamnya */
    "html.spon body{position:fixed!important;left:var(--p0x);top:var(--p0y);width:var(--p0w);height:var(--p0h);min-height:0!important;overflow:hidden;transform:translateZ(0);border-radius:0 0 12px 12px;background-color:#2a1d4e;background-image:linear-gradient(180deg,#1b1430 0,#2b1f52 34%,#4a2f86 68%,#6d43bd 100%);background-attachment:scroll;padding-bottom:0}",
    ":root[data-theme=light].spon body{background-color:#F7F5FA;background-image:linear-gradient(180deg,var(--bg0) 0,var(--bg1) 40%,var(--bg2) 100%)}",
    "html.spon #shell{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}", /* #shell yang menggulir; body diam supaya menu bawah (fixed) tidak ikut terguling */
    "html.spon.p0off body{visibility:hidden;pointer-events:none}",
    ".sp-p.host .sp-in{background:transparent;box-shadow:none}",
    "#split[hidden]{display:none}",
    /* tombol Fokus dipindah ke luar body selama split, supaya melayang di atas semua panel */
    "html.spon>.fx{z-index:10020}html.spon>.fxo{z-index:10021}html.spon>.fxp{z-index:10022}body.fxon~.fxp{display:none!important}",
    ".sp-bar{flex:none;display:flex;align-items:center;gap:6px;padding:6px 8px;padding-top:max(6px,env(safe-area-inset-top));background:rgba(26,18,48,.96);border-bottom:1px solid rgba(255,255,255,.12)}",
    ":root[data-theme=light] .sp-bar{background:rgba(255,255,255,.92);border-bottom-color:rgba(48,28,88,.14)}",
    ".sp-bar b{font:700 11px Cinzel,serif;letter-spacing:.14em;color:#f5c04a;margin:0 6px 0 4px;white-space:nowrap}",
    ":root[data-theme=light] .sp-bar b{color:#9a6a12}",
    ".sp-bar .sp-gap{flex:1}",
    ".sp-b{flex:none;min-width:38px;height:34px;padding:0 8px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:inherit;font:600 14px Inter,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px}",
    ":root[data-theme=light] .sp-b{border-color:rgba(48,28,88,.22);background:rgba(48,28,88,.06)}",
    ".sp-b.on{border-color:#f5c04a;background:rgba(245,192,74,.22);box-shadow:inset 0 0 0 1px #f5c04a}",
    ".sp-b svg{display:block}",
    ".sp-b.x{background:rgba(248,113,113,.18);border-color:rgba(248,113,113,.55)}",
    ".sp-area{position:relative;flex:1;min-height:0;overflow:hidden;touch-action:none}",
    ".sp-p{position:absolute;padding:" + GAP + "px;box-sizing:border-box}",
    ".sp-p[hidden]{display:none}",
    ".sp-in{width:100%;height:100%;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.2);background:#161222;box-shadow:0 4px 18px rgba(0,0,0,.28)}",
    ":root[data-theme=light] .sp-in{border-color:rgba(48,28,88,.24);background:#f7f5fa}",
    ".sp-h{flex:none;height:26px;display:flex;align-items:center;gap:2px;padding:0 3px 0 9px;background:rgba(26,18,48,.92);color:#f5c04a;font:600 11px Inter,sans-serif}",
    ":root[data-theme=light] .sp-h{background:rgba(255,255,255,.96);color:#6b4a0c;border-bottom:1px solid rgba(48,28,88,.12)}",
    ".sp-h i{flex:none;font-style:normal;opacity:.7;margin-right:5px}",
    ".sp-h span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".sp-h button{flex:none;width:26px;height:22px;border:0;border-radius:7px;background:transparent;color:inherit;font-size:13px;cursor:pointer}",
    ".sp-h button:hover{background:rgba(255,255,255,.14)}",
    ".sp-in iframe{flex:1;min-height:0;width:100%;border:0;display:block;background:transparent}",
    "#split.drag iframe{pointer-events:none}",
    "#split.drag,#split.drag *{user-select:none;-webkit-user-select:none}",
    ".sp-s{position:absolute;z-index:5;touch-action:none;outline:none}",
    ".sp-s[hidden]{display:none}",
    ".sp-s::before{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:99px;background:rgba(245,192,74,.55);transition:background .12s,transform .12s}",
    ".sp-s.v{width:20px;cursor:col-resize}.sp-s.v::before{width:5px;height:44px}",
    ".sp-s.h{height:20px;cursor:row-resize}.sp-s.h::before{width:44px;height:5px}",
    ".sp-s.c{width:26px;height:26px;cursor:move}.sp-s.c::before{width:14px;height:14px;border-radius:50%}",
    ".sp-s:hover::before,.sp-s:focus-visible::before,.sp-s.on::before{background:#f5c04a;box-shadow:0 0 0 3px rgba(245,192,74,.28)}",
    "@media (max-width:420px){.sp-bar b{display:none}.sp-b{min-width:34px;padding:0 5px}}"
  ].join("\n");
  var stl = document.createElement("style");
  stl.textContent = css;
  document.head.appendChild(stl);

  /* ---------- ikon susunan (sama dengan gambar pilihan) ---------- */
  function ico(l) {
    var r = {
      a: [[1, 1, 13, 18], [16, 1, 13, 18]],
      b: [[1, 1, 18, 18], [21, 1, 8, 18]],
      c: [[1, 1, 13, 18], [16, 1, 13, 8.5], [16, 10.5, 13, 8.5]],
      d: [[1, 1, 13, 8.5], [16, 1, 13, 8.5], [1, 10.5, 13, 8.5], [16, 10.5, 13, 8.5]]
    }[l];
    return "<svg width='30' height='20' viewBox='0 0 30 20' aria-hidden='true'>" + r.map(function (q) {
      return "<rect x='" + q[0] + "' y='" + q[1] + "' width='" + q[2] + "' height='" + q[3] + "' rx='2.2' fill='currentColor' fill-opacity='.28' stroke='currentColor' stroke-width='1.3'/>";
    }).join("") + "</svg>";
  }

  /* ---------- geometri ---------- */
  // Koordinat dihitung dalam bentuk "kiri-kanan"; bila st.tr (putar) sumbu x dan y ditukar.
  function rects() {
    var c = st.cx, r = st.ry, R;
    if (st.lay === "a" || st.lay === "b") R = [[0, 0, c, 1], [c, 0, 1 - c, 1]];
    else if (st.lay === "c") R = [[0, 0, c, 1], [c, 0, 1 - c, r], [c, r, 1 - c, 1 - r]];
    else R = [[0, 0, c, r], [c, 0, 1 - c, r], [0, r, c, 1 - r], [c, r, 1 - c, 1 - r]];
    if (st.tr) R = R.map(function (q) { return [q[1], q[0], q[3], q[2]]; });
    return R;
  }
  function pct(v) { return (v * 100).toFixed(4) + "%"; }

  function placeLine(el, orient, pos, from, to) {
    var s = el.style;
    el.classList.remove("v", "h");
    el.classList.add(orient);
    if (orient === "v") { s.left = "calc(" + pct(pos) + " - 10px)"; s.top = pct(from); s.height = pct(to - from); s.width = ""; }
    else { s.top = "calc(" + pct(pos) + " - 10px)"; s.left = pct(from); s.width = pct(to - from); s.height = ""; }
    el.setAttribute("aria-orientation", orient === "v" ? "vertical" : "horizontal");
  }

  function apply() {
    var n = LAY[st.lay].n, R = rects(), i;
    while (panes.length < n) mkPane(panes.length);
    for (i = 0; i < panes.length; i++) {
      var p = panes[i], show = i < n && (maxI < 0 || maxI === i), q = maxI === i ? [0, 0, 1, 1] : (R[i] || [0, 0, 1, 1]);
      p.el.hidden = !show;
      p.el.style.left = pct(q[0]); p.el.style.top = pct(q[1]);
      p.el.style.width = pct(q[2]); p.el.style.height = pct(q[3]);
      p.btnMax.textContent = maxI === i ? "🗗" : "⤢";
      p.btnMax.title = maxI === i ? "Kembalikan ukuran" : "Perbesar panel ini";
      if (i === 0) placeHost(show, q);
    }
    // pembatas
    var vis = maxI < 0, L = st.lay;
    sp.cx.hidden = !vis;
    sp.ry.hidden = !vis || (L !== "c" && L !== "d");
    sp.c.hidden = !vis || L !== "d";
    if (vis) {
      var o1 = st.tr ? "h" : "v", o2 = st.tr ? "v" : "h";
      placeLine(sp.cx, o1, st.cx, 0, 1);
      if (L === "c") placeLine(sp.ry, o2, st.ry, st.cx, 1);
      else if (L === "d") placeLine(sp.ry, o2, st.ry, 0, 1);
      if (L === "d") {
        var cs = sp.c.style, X = st.tr ? st.ry : st.cx, Y = st.tr ? st.cx : st.ry;
        cs.left = "calc(" + pct(X) + " - 13px)"; cs.top = "calc(" + pct(Y) + " - 13px)";
      }
    }
    [].forEach.call(bar.querySelectorAll("[data-lay]"), function (b) { b.classList.toggle("on", b.dataset.lay === st.lay); });
    bar.querySelector("[data-act=rot]").classList.toggle("on", st.tr);
    save();
  }

  /* ---------- panel 1 = aplikasi utama yang sedang berjalan ---------- */
  function placeHost(show, q) {
    HTML.classList.toggle("p0off", !show);
    if (!show) return;
    var a = area.getBoundingClientRect(), S = HTML.style;
    S.setProperty("--p0x", (a.left + q[0] * a.width + GAP + 1).toFixed(1) + "px");
    S.setProperty("--p0y", (a.top + q[1] * a.height + GAP + HEADH).toFixed(1) + "px");
    S.setProperty("--p0w", Math.max(60, q[2] * a.width - 2 * GAP - 2).toFixed(1) + "px");
    S.setProperty("--p0h", Math.max(60, q[3] * a.height - 2 * GAP - HEADH - 1).toFixed(1) + "px");
  }
  function hostTitle() {
    if (!panes[0]) return;
    var hv = document.getElementById("hov"), hb = hv && hv.querySelector(".hvbar b"), t = document.getElementById("ttl");
    panes[0].ttl.textContent = ((hb && hb.textContent) || (t && t.textContent) || "ASTERION").slice(0, 80);
  }
  function moveFx(on) { // Fokus/Pomodoro: melayang di atas seluruh split, bukan terkurung di panel 1
    FXIDS.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      if (on) { if (el.parentNode !== HTML) { fxHome[id] = { p: el.parentNode, n: el.nextSibling }; HTML.appendChild(el); } }
      else if (fxHome[id]) { var h = fxHome[id]; h.p.insertBefore(el, h.n && h.n.parentNode === h.p ? h.n : null); delete fxHome[id]; }
    });
  }
  var _sc = window.scrollTo; // body-lah yang menggulir saat split aktif
  window.scrollTo = function (a, b) {
    if (HTML.classList.contains("spon")) { var y = a && typeof a === "object" ? (a.top || 0) : (b || 0); var sh = document.getElementById("shell"); if (sh) sh.scrollTop = y; return; }
    return _sc.apply(window, arguments);
  };

  /* ---------- panel ---------- */
  function paneSrc(h) { return location.pathname + "?pane=1" + (h || ""); }

  function mkPane(i) {
    var el = document.createElement("div"); el.className = "sp-p"; el.hidden = true;
    el.innerHTML = "<div class='sp-in'><div class='sp-h'><i>" + (i + 1) + "</i><span>Memuat…</span>" +
      "<button type='button' data-pa='rl' title='Muat ulang panel'>↻</button>" +
      "<button type='button' data-pa='mx' title='Perbesar panel ini'>⤢</button></div>" +
      "<iframe allow='fullscreen; autoplay; clipboard-write' allowfullscreen title='Panel " + (i + 1) + "'></iframe></div>";
    var p = { el: el, f: el.querySelector("iframe"), ttl: el.querySelector(".sp-h span"), btnMax: el.querySelector("[data-pa=mx]"), hash: st.hs[i] || DEF_HASH[i] || "" };
    if (i === 0) { // panel 1 adalah halaman ini sendiri: tidak ada iframe, tidak ada muat ulang
      el.classList.add("host"); p.f.remove(); p.f = null; el.querySelector("[data-pa=rl]").remove();
      var sp0 = document.createElement("div"); sp0.style.flex = "1"; el.querySelector(".sp-in").appendChild(sp0);
    } else p.f.src = paneSrc(p.hash);
    el.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-pa]"); if (!b) return;
      if (b.dataset.pa === "mx") { maxI = maxI === i ? -1 : i; apply(); }
      else if (b.dataset.pa === "rl" && p.f) { p.ttl.textContent = "Memuat…"; p.f.src = paneSrc(p.hash); }
    });
    panes[i] = p;
    area.appendChild(el);
  }

  /* ---------- geser pembatas ---------- */
  function bindSplitter(el, which) {
    var rect = null;
    function mv(e) {
      if (!rect) return;
      var fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
      if (which === "cx" || which === "c") st.cx = clamp(st.tr ? fy : fx);
      if (which === "ry" || which === "c") st.ry = clamp(st.tr ? fx : fy);
      apply();
    }
    function up(e) {
      if (!rect) return;
      rect = null; el.classList.remove("on"); root.classList.remove("drag");
      try { el.releasePointerCapture(e.pointerId); } catch (x) {}
    }
    el.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      e.preventDefault();
      rect = area.getBoundingClientRect();
      el.classList.add("on"); root.classList.add("drag");
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
    });
    el.addEventListener("pointermove", mv);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("dblclick", function () {
      if (which === "cx" || which === "c") st.cx = LAY[st.lay].cx;
      if (which === "ry" || which === "c") st.ry = LAY[st.lay].ry;
      apply();
    });
    el.addEventListener("keydown", function (e) {
      var k = e.key, d = 0, ax = null;
      if (k === "ArrowLeft") { d = -0.02; ax = "x"; } else if (k === "ArrowRight") { d = 0.02; ax = "x"; }
      else if (k === "ArrowUp") { d = -0.02; ax = "y"; } else if (k === "ArrowDown") { d = 0.02; ax = "y"; }
      if (!ax) return;
      e.preventDefault();
      var useCx = which === "cx" || which === "c", useRy = which === "ry" || which === "c";
      if (useCx && ((ax === "y") === st.tr)) st.cx = clamp(st.cx + d);
      if (useRy && ((ax === "x") === st.tr)) st.ry = clamp(st.ry + d);
      apply();
    });
  }

  /* ---------- bangun UI ---------- */
  function build() {
    if (root) return;
    root = document.createElement("div"); root.id = "split"; root.hidden = true;
    root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Split screen");
    var lays = Object.keys(LAY).map(function (k) {
      return "<button type='button' class='sp-b' data-lay='" + k + "' title='" + LAY[k].t + "' aria-label='" + LAY[k].t + "'>" + ico(k) + "</button>";
    }).join("");
    root.innerHTML = "<div class='sp-bar'><b>SPLIT</b>" + lays +
      "<button type='button' class='sp-b' data-act='rot' title='Putar susunan (kiri‑kanan ⇄ atas‑bawah)' aria-label='Putar susunan'>⟳</button>" +
      "<button type='button' class='sp-b' data-act='eq' title='Samakan ukuran panel' aria-label='Samakan ukuran'>⚖</button>" +
      "<span class='sp-gap'></span>" +
      "<button type='button' class='sp-b x' data-act='close' title='Tutup split screen' aria-label='Tutup split screen'>✕</button></div>" +
      "<div class='sp-area'></div>";
    HTML.appendChild(root);
    area = root.querySelector(".sp-area"); bar = root.querySelector(".sp-bar");
    ["cx", "ry", "c"].forEach(function (k) {
      var s = document.createElement("div");
      s.className = "sp-s " + (k === "c" ? "c" : ""); s.tabIndex = 0; s.setAttribute("role", "separator");
      s.setAttribute("aria-label", "Geser untuk mengubah ukuran panel"); s.hidden = true;
      area.appendChild(s); sp[k] = s; bindSplitter(s, k);
    });
    bar.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button"); if (!b) return;
      if (b.dataset.lay) {
        if (b.dataset.lay !== st.lay) { st.lay = b.dataset.lay; st.cx = LAY[st.lay].cx; st.ry = LAY[st.lay].ry; maxI = -1; apply(); }
      } else if (b.dataset.act === "rot") { st.tr = !st.tr; apply(); }
      else if (b.dataset.act === "eq") { st.cx = LAY[st.lay].cx; st.ry = LAY[st.lay].ry; apply(); }
      else if (b.dataset.act === "close") close();
    });
    window.addEventListener("resize", function () { if (root && !root.hidden) apply(); });
  }

  function open() {
    build();
    var y0 = window.pageYOffset || 0, sh = document.getElementById("shell");
    root.hidden = false; HTML.classList.add("spon"); moveFx(true);
    if (sh) sh.scrollTop = y0;
    apply(); hostTitle();
    clearInterval(tick); tick = setInterval(hostTitle, 600);
  }
  function close() {
    if (!root) return;
    root.hidden = true; maxI = -1; clearInterval(tick);
    var sh = document.getElementById("shell"), y1 = sh ? sh.scrollTop : 0;
    HTML.classList.remove("spon", "p0off"); moveFx(false);
    if (sh) sh.scrollTop = 0;
    _sc.call(window, 0, y1);
    ["--p0x", "--p0y", "--p0w", "--p0h"].forEach(function (k) { HTML.style.removeProperty(k); });
    save();
  }

  /* ---------- pesan dari panel ---------- */
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || typeof e.data !== "object") return;
    var d = e.data, i;
    if (d.astp) {
      for (i = 0; i < panes.length; i++) if (panes[i].f.contentWindow === e.source) {
        panes[i].hash = okHash(d.h);
        panes[i].ttl.textContent = String(d.t || "").slice(0, 80) || "ASTERION";
        save();
      }
    } else if (d.astan && typeof d.astan === "object" && window.AN) { // statistik buka halaman/materi dari panel digabung ke induk
      var a = d.astan, k;
      for (k in (a.pv || {})) AN.pv[k] = (AN.pv[k] || 0) + (+a.pv[k] || 0);
      for (k in (a.it || {})) { var o = AN.it[k], v = a.it[k]; if (v && v.length) AN.it[k] = [String(v[0]).slice(0, 160), (o ? o[1] : 0) + (+v[1] || 0)]; }
    } else if (d.astfx) { if (typeof hvFocus === "function") hvFocus();
    } else if (d.astout) { close(); if (window.S && S.t && typeof logout === "function") logout(); }
  });

  /* ---------- tombol pembuka ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#splitBtn");
    if (b) { e.preventDefault(); open(); }
  });

  window.Split = { open: open, close: close };
})();
