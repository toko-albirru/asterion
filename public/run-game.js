/* ASTERION RUN — engine game 3D (Three.js) + HUD.
   Pemain menjawab dengan menggerakkan karakter ke gerbang A–E.
   Skor akademik HANYA ditentukan server (+1 benar, 0 salah/kosong); obstacle & energi murni visual. */
(function () {
  "use strict";
  var LET = ["A", "B", "C", "D", "E"], COL = [0xb18cff, 0x4cc9f0, 0x4ade80, 0xfb923c, 0xff6b9a], CSSC = ["#b18cff", "#4cc9f0", "#4ade80", "#fb923c", "#ff6b9a"];
  var PLANK_L = 22, TUN_L = 12, LW = 2.4, LANES = 5, SPEED = 20, GATE_DIST = 95, GATE_MIN = 24, FB_MS = 2400;
  var laneX = function (i) { return (i - 2) * LW; };
  var THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", p3;
  function loadThree() {
    if (window.THREE) return Promise.resolve();
    return p3 || (p3 = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = THREE_URL; s.onload = res;
      s.onerror = function () { p3 = null; rej(new Error("Gagal memuat Three.js")); }; document.head.appendChild(s);
    }));
  }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------------- suara (WebAudio, tanpa berkas) ---------------- */
  var AC = null;
  function ac() { try { if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } if (AC && AC.state === "suspended") AC.resume(); } catch (e) {} return AC; }
  var snd = { on: true };
  function tone(f, d, type, vol, at, to) {
    if (!snd.on) return; var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + (at || 0);
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
  }
  var sfx = {
    coin: function () { tone(988, 0.07, "triangle", 0.12); tone(1319, 0.1, "triangle", 0.12, 0.06); },
    jump: function () { tone(280, 0.16, "square", 0.05, 0, 640); }, slide: function () { tone(520, 0.18, "sawtooth", 0.04, 0, 180); },
    lane: function () { tone(330, 0.05, "triangle", 0.06); },
    bump: function () { tone(110, 0.22, "sawtooth", 0.12, 0, 60); },
    gate: function () { tone(220, 0.5, "sawtooth", 0.07, 0, 880); },
    ok: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, "triangle", 0.15, i * 0.09); }); },
    bad: function () { tone(190, 0.34, "sawtooth", 0.14, 0, 80); tone(150, 0.34, "square", 0.08, 0.05, 70); },
    blank: function () { tone(260, 0.25, "sine", 0.1, 0, 200); },
    tick: function () { tone(1100, 0.04, "square", 0.05); },
    cd: function () { tone(660, 0.12, "triangle", 0.14); }, go: function () { tone(990, 0.35, "triangle", 0.16); tone(1320, 0.35, "triangle", 0.1, 0.05); },
    end: function () { [392, 523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.3, "triangle", 0.14, i * 0.1); }); },
  };

  /* ---------------- CSS ---------------- */
  var CSS = ".rg{position:fixed;inset:0;z-index:200;background:#120c24;color:#fff;font:14px Inter,system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;display:flex;flex-direction:column}" +
    ".rg-stage{position:relative;flex:1 1 0;min-height:0;overflow:hidden}.rg canvas{position:absolute;inset:0;width:100%;height:100%;display:block}" +
    ".rg *{box-sizing:border-box}.rg [hidden]{display:none!important}" +
    ".rg-hud{position:relative;flex:none;padding:calc(6px + env(safe-area-inset-top,0px)) 10px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;background:linear-gradient(#150e2c,#1a1136);border-bottom:1px solid rgba(52,211,153,.28);z-index:2}" +
    ".rg-bar{width:min(720px,100%);flex:none;display:flex;align-items:center;gap:8px}" +
    ".rg-pill{padding:6px 10px;border-radius:999px;background:rgba(20,12,44,.78);border:1px solid rgba(255,255,255,.2);font-weight:600;font-size:12px;white-space:nowrap}" +
    ".rg-pill.ok{color:#4ade80}" +
    ".rg-prog{flex:1;height:8px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden}.rg-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#b18cff,#34d399);transition:width .4s}" +
    ".rg-btn{width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(20,12,44,.78);color:#fff;font-size:16px;cursor:pointer;flex:none}" +
    ".rg-card{width:min(720px,100%);flex:none;overflow:visible;border-radius:14px;padding:6px 10px;background:rgba(255,255,255,.05);border:1px solid rgba(52,211,153,.35)}" +
    ".rg-tm{display:flex;align-items:center;gap:10px;margin-bottom:3px}.rg-tmv{font:700 22px Cinzel,Georgia,serif;color:#34d399;min-width:2.2ch;text-align:right}" +
    ".rg-tmb{flex:1;height:7px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden}.rg-tmb i{display:block;height:100%;width:100%;background:#4ade80;transition:background .3s}" +
    ".rg-tm.warn .rg-tmv{color:#fb923c}.rg-tm.warn .rg-tmb i{background:#fb923c}.rg-tm.crit .rg-tmv{color:#f87171;animation:rgp .5s infinite alternate}.rg-tm.crit .rg-tmb i{background:#f87171}" +
    "@keyframes rgp{to{transform:scale(1.18)}}" +
    ".rg-q{font-size:var(--fq,13.5px);line-height:1.3;white-space:pre-line;overflow-wrap:anywhere}" +
    ".rg-imgs{display:flex;justify-content:center;align-items:flex-start;gap:6px;margin-top:4px}.rg-img{display:block;min-width:0;max-width:100%;max-height:var(--imh,20vh);object-fit:contain;border-radius:8px;cursor:zoom-in;background:#fff}.rg-imgs.n2 .rg-img{max-width:49%}.rg-imgs.n3 .rg-img,.rg-imgs.n4 .rg-img{max-width:32%}.rg-imerr{font-size:12px;opacity:.85;padding:8px 10px;border:1px dashed currentColor;border-radius:8px;cursor:pointer}" +
    ".rg-opts{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:2px}" +
    ".rg-opts li{display:flex;gap:6px;align-items:flex-start;padding:2px 6px;border-radius:10px;background:rgba(255,255,255,.06);font-size:var(--fo,13px);line-height:1.25;border:1px solid transparent;overflow-wrap:anywhere;min-width:0}" +
    ".rg-opts li b{flex:none;width:1.7em;height:1.7em;border-radius:50%;display:grid;place-items:center;color:#120c24;font-size:.9em}" +
    ".rg-opts li.on{border-color:#fff;background:rgba(255,255,255,.2)}" +
    ".rg-opts li.ok{border-color:#4ade80;background:rgba(74,222,128,.32);box-shadow:0 0 0 1px #4ade80 inset}.rg-opts li.no{border-color:#f87171;background:rgba(248,113,113,.34);box-shadow:0 0 0 1px #f87171 inset}" +
    ".rg-tg{flex:none;align-self:flex-end;font-size:11px;color:#d9cdf5;background:none;border:0;cursor:pointer;padding:0 6px}" +
    ".rg.min .rg-opts{display:none}@media (min-width:640px){.rg-opts{grid-template-columns:1fr 1fr}}.rg.two .rg-opts{grid-template-columns:1fr 1fr}" +
    ".rg-foot{position:relative;flex:none;padding:6px 10px calc(8px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;align-items:center;gap:10px;min-height:54px;background:linear-gradient(#150e2c,#0f0a1f);border-top:1px solid rgba(52,211,153,.2);z-index:2}" +
    ".rg-ready{pointer-events:auto;padding:12px 18px;border-radius:999px;border:0;background:linear-gradient(135deg,#34d399,#059669);color:#241a3f;font:700 14px Inter,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4)}" +
    ".rg-ready.pulse{animation:rgp .6s infinite alternate}" +
    ".rg-lane{padding:8px 14px;border-radius:999px;font-weight:700;background:rgba(20,12,44,.78);border:2px solid #fff;color:#fff}" +
    ".rg-msg{position:absolute;left:0;right:0;top:38%;text-align:center;pointer-events:none;font:900 clamp(34px,10vw,64px) Cinzel,Georgia,serif;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.7)}" +
    ".rg-msg.pop{animation:rgpop .9s ease-out both}.rg-msg.pop.long{animation-duration:2.3s}.rg-msg.ok{color:#4ade80}.rg-msg.bad{color:#f87171}.rg-msg.blank{color:#cbd5e1}.rg-msg small.rg-key{color:#bbf7d0;font-size:18px;margin-top:8px}.rg-msg small.rg-key b{color:#4ade80;font-size:24px}.rg-msg small{display:block;font:600 15px Inter,sans-serif;margin-top:4px;color:#e9ddff}" +
    "@keyframes rgpop{0%{transform:scale(.4);opacity:0}25%{transform:scale(1.12);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}" +
    ".rg-flash{position:absolute;inset:0;pointer-events:none;opacity:0}.rg-flash.ok{animation:rgfl .6s ease-out;background:radial-gradient(circle,rgba(74,222,128,.0),rgba(74,222,128,.5))}.rg-flash.bad{animation:rgfl .6s ease-out;background:radial-gradient(circle,rgba(248,113,113,0),rgba(248,113,113,.55))}" +
    "@keyframes rgfl{0%{opacity:1}100%{opacity:0}}" +
    ".rg.shake canvas{animation:rgsh .35s}@keyframes rgsh{20%{transform:translate(-6px,3px)}40%{transform:translate(6px,-3px)}60%{transform:translate(-4px,2px)}80%{transform:translate(3px,-2px)}}" +
    ".rg-ov{position:absolute;inset:0;background:rgba(10,6,24,.82);display:flex;align-items:center;justify-content:center;padding:20px;z-index:5;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
    ".rg-box{width:min(380px,100%);border-radius:22px;padding:20px;background:linear-gradient(160deg,rgba(58,42,102,.95),rgba(26,18,48,.98));border:1px solid rgba(52,211,153,.4);text-align:center}" +
    ".rg-box h3{margin:0 0 6px;font:900 20px Cinzel,Georgia,serif;color:#34d399;letter-spacing:.06em}.rg-box p{margin:6px 0 14px;color:#d9cdf5;line-height:1.5;font-size:13px}" +
    ".rg-box button{display:block;width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;font:600 14px Inter,sans-serif;cursor:pointer}" +
    ".rg-box button.pri{background:linear-gradient(135deg,#34d399,#059669);color:#241a3f;border:0;font-weight:700}" +
    ".rg-tut{position:absolute;left:50%;transform:translateX(-50%);bottom:12px;width:min(420px,calc(100% - 24px));text-align:center;padding:12px 14px;border-radius:16px;background:rgba(18,10,40,.88);border:1px solid #34d399;font-weight:600;line-height:1.4;pointer-events:none}" +
    ".rg-tut small{display:block;color:#d9cdf5;font-weight:400;margin-top:3px}" +
    ".rg-lb{position:absolute;inset:0;z-index:6;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;padding:12px}.rg-lb img{max-width:100%;max-height:100%;background:#fff;border-radius:8px}" +
    ".rg-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:#d9cdf5;text-align:center;padding:20px}" +
    ":root[data-theme=\"light\"] .rg{background:#e6eeff;color:#241a3f}" +
    ":root[data-theme=\"light\"] .rg-hud{background:linear-gradient(#f8f5ff,#ebe5fa)}" +
    ":root[data-theme=\"light\"] .rg-pill{background:rgba(255,255,255,.92);border-color:rgba(48,28,88,.22);color:#241a3f}" +
    ":root[data-theme=\"light\"] .rg-pill.ok{color:#127a3e}" +
    ":root[data-theme=\"light\"] .rg-prog{background:rgba(48,28,88,.16)}" +
    ":root[data-theme=\"light\"] .rg-tmb{background:rgba(48,28,88,.16)}" +
    ":root[data-theme=\"light\"] .rg-btn{background:rgba(255,255,255,.92);border-color:rgba(48,28,88,.22);color:#241a3f}" +
    ":root[data-theme=\"light\"] .rg-card{background:rgba(255,255,255,.82);border-color:rgba(5,150,105,.45)}" +
    ":root[data-theme=\"light\"] .rg-tmv{color:#047857}" +
    ":root[data-theme=\"light\"] .rg-tm.warn .rg-tmv{color:#c2410c}" +
    ":root[data-theme=\"light\"] .rg-tm.crit .rg-tmv{color:#c62828}" +
    ":root[data-theme=\"light\"] .rg-opts li{background:rgba(48,28,88,.07)}" +
    ":root[data-theme=\"light\"] .rg-opts li.on{border-color:#4a2f86;background:rgba(122,90,220,.22)}" +
    ":root[data-theme=\"light\"] .rg-opts li.ok{border-color:#127a3e;background:rgba(34,160,80,.24);box-shadow:0 0 0 1px #127a3e inset}" +
    ":root[data-theme=\"light\"] .rg-opts li.no{border-color:#c62828;background:rgba(220,60,60,.22);box-shadow:0 0 0 1px #c62828 inset}" +
    ":root[data-theme=\"light\"] .rg-tg{color:#4b3f66}" +
    ":root[data-theme=\"light\"] .rg-foot{background:linear-gradient(#ebe5fa,#f8f5ff)}" +
    ":root[data-theme=\"light\"] .rg-lane{background:rgba(255,255,255,.94);border-color:#241a3f;color:#241a3f}" +
    ":root[data-theme=\"light\"] .rg-msg{color:#241a3f;text-shadow:0 2px 16px rgba(255,255,255,.95)}" +
    ":root[data-theme=\"light\"] .rg-msg.ok{color:#127a3e}" +
    ":root[data-theme=\"light\"] .rg-msg.bad{color:#c62828}" +
    ":root[data-theme=\"light\"] .rg-msg.blank{color:#4b3f66}" +
    ":root[data-theme=\"light\"] .rg-ov{background:rgba(238,233,252,.86)}" +
    ":root[data-theme=\"light\"] .rg-box{background:linear-gradient(160deg,#fff,#f1ebfc);border-color:rgba(5,150,105,.5)}" +
    ":root[data-theme=\"light\"] .rg-box h3{color:#047857}" +
    ":root[data-theme=\"light\"] .rg-box p{color:#4b3f66}" +
    ":root[data-theme=\"light\"] .rg-box button{background:rgba(48,28,88,.08);color:#241a3f;border-color:rgba(48,28,88,.22)}" +
    ":root[data-theme=\"light\"] .rg-box button.pri{background:linear-gradient(135deg,#34d399,#059669);color:#241a3f;border:0}" +
    ":root[data-theme=\"light\"] .rg-tut{background:rgba(255,255,255,.94);color:#241a3f}" +
    ":root[data-theme=\"light\"] .rg-tut small{color:#4b3f66}" +
    ":root[data-theme=\"light\"] .rg-load{color:#4b3f66}";
  function injectCss() { if (document.getElementById("rg-css")) return; var s = document.createElement("style"); s.id = "rg-css"; s.textContent = CSS; document.head.appendChild(s); }

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ================================================================ */
  function play(cfg) {
    injectCss();
    var host = cfg.host, S = cfg.settings || {}, TUT = !!cfg.tutorial, T = window.THREE;
    var low = S.gfx === "low", fx = S.fx !== 0 && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    var stored = null; try { stored = localStorage.getItem("runSnd"); } catch (e) {}
    snd.on = S.sound !== 0 && stored !== "0";
    var qTime = (cfg.qTime || 60) * 1000, t0 = performance.now();

    var root = el("div", "rg"); root.id = "rg";
    root.innerHTML = '<div class="rg-hud"><div class="rg-bar"><span class="rg-pill" id="rgN">Soal 1/1</span><div class="rg-prog"><i id="rgP"></i></div><span class="rg-pill ok" id="rgS" title="Skor akademik">✔ 0</span>' +
      '<button class="rg-btn" id="rgSnd" aria-label="Suara">🔊</button><button class="rg-btn" id="rgPause" aria-label="Jeda">⏸</button></div>' +
      '<div class="rg-card" id="rgCard"><div class="rg-tm" id="rgTm"><span class="rg-tmv" id="rgTv">60</span><div class="rg-tmb"><i id="rgTb"></i></div></div><div class="rg-q" id="rgQ"></div><div class="rg-imgs" id="rgI" hidden></div><ul class="rg-opts" id="rgO"></ul></div>' +
      '<button class="rg-tg" id="rgTg">Sembunyikan pilihan ▲</button></div>' +
      '<div class="rg-stage" id="rgStage"><canvas></canvas><div class="rg-flash"></div><div class="rg-msg" id="rgM"></div><div class="rg-tut" id="rgT" hidden></div></div>' +
      '<div class="rg-foot"><span class="rg-lane" id="rgL">Jalur C</span><button class="rg-ready" id="rgR">⏩ Siap menjawab</button></div>' +
      '<div class="rg-load" id="rgLd"><div style="font-size:34px">🏃</div><div>Memuat dunia 3D…</div></div>';
    document.body.appendChild(root);
    var $ = function (id) { return root.querySelector("#" + id); };
    if (TUT) { $("rgTm").style.display = "none"; $("rgP").parentNode.style.visibility = "hidden"; $("rgS").style.display = "none"; }

    var st = { phase: "load", cur: cfg.cur || 0, lane: 2, x: 0, y: 0, vy: 0, slideT: 0, stumbleT: 0, invul: 0, speedMul: 1, remMs: qTime, qEnd: 0, locked: false, paused: false, gate: null, gateSpawned: false, score: cfg.score || 0, obsT: 1.2, runT: 0, pose: { l: 0, r: 0, al: 0, ar: 0, bx: -0.16, by: 0, bz: 0 }, tutStep: 0, tutT: 0, destroyed: false, lastSec: -1 };
    var qs = cfg.qs, raf = 0, last = 0;
    var R, scene, cam, player, parts = [], world = { obs: [], gates: [], pyl: [], arch: [], holo: [] };

    /* ---------- HUD ---------- */
    function cur() { return qs[st.cur]; }
    function renderQ() {
      var q = cur(); if (!q) return;
      $("rgN").textContent = TUT ? "Latihan" : "Soal " + (st.cur + 1) + "/" + qs.length;
      $("rgP").style.width = (TUT ? 0 : (st.cur / qs.length) * 100) + "%";
      $("rgQ").textContent = q.q;
      var im = $("rgI"), ids = String(q.img || "").split(",").filter(Boolean); // ID tunggal (soal lama) atau beberapa ID dipisah koma
      im.innerHTML = ""; im.className = "rg-imgs n" + Math.min(4, ids.length); im.hidden = !ids.length;
      ids.forEach(function (id) {
        var g = el("img", "rg-img"); g.alt = "Gambar soal"; g.decoding = "async"; g.onload = fitHud;
        g.onerror = function () { var e = el("div", "rg-imerr"); e.textContent = "Gambar gagal dimuat — ketuk untuk mencoba lagi"; e.onclick = function () { var n = el("img", "rg-img"); n.alt = "Gambar soal"; n.src = "/api/run/img/" + encodeURIComponent(id) + "?r=" + Date.now(); n.onerror = g.onerror; n.onload = fitHud; e.replaceWith(n); }; g.replaceWith(e); fitHud(); };
        g.src = "/api/run/img/" + encodeURIComponent(id); im.appendChild(g);
      });
      var ul = $("rgO"); ul.innerHTML = "";
      LET.forEach(function (L, i) {
        if (!q.o[L]) return;
        var li = el("li"); li.dataset.l = L; var b = el("b"); b.textContent = L; b.style.background = CSSC[i]; var s = el("span"); s.textContent = q.o[L]; li.appendChild(b); li.appendChild(s); ul.appendChild(li);
      });
      markLane(true); fitHud();
    }
    /* Soal + semua pilihan (sampai E) harus tampil utuh TANPA scroll.
       Urutan: kecilkan font → pilihan jadi 2 kolom → kecilkan gambar. */
    function fitHud() {
      var hud = root.querySelector(".rg-hud"); if (!hud || !root.clientHeight) return;
      var limit = root.clientHeight * (root.clientWidth < 640 ? 0.62 : 0.5), fs;
      var imgs = root.querySelector("#rgI"), hasImg = imgs && !imgs.hidden;
      var apply = function (q, o, imh) {
        root.style.setProperty("--fq", q + "px"); root.style.setProperty("--fo", o + "px"); root.style.setProperty("--imh", imh + "vh");
      };
      var fits = function () { return hud.offsetHeight <= limit; };
      var done = false;
      root.classList.remove("two");
      // 1) font turun bertahap (1 kolom di HP)
      for (fs = 13.5; fs >= 7.5; fs -= 0.5) { apply(fs, fs - 0.5, 20); if (fits()) { done = true; break; } }
      // 2) pilihan 2 kolom, font dicoba lagi dari besar
      if (!done) {
        root.classList.add("two");
        for (fs = 13.5; fs >= 7.5; fs -= 0.5) { apply(fs, fs - 0.5, 20); if (fits()) { done = true; break; } }
      }
      // 3) gambar dikecilkan (tetap bisa diketuk untuk zoom)
      if (!done && hasImg) {
        var hs = [14, 10, 7, 5, 3.5, 2.5];
        for (var i = 0; i < hs.length; i++) { apply(7.5, 7, hs[i]); if (fits()) { done = true; break; } }
      }
    }
    var lastMark = -1;
    function markLane(force) {
      if (!force && lastMark === st.lane) return; lastMark = st.lane;
      var L = LET[st.lane], q = cur(), has = q && q.o[L], b = $("rgL");
      b.textContent = "Jalur " + L; b.style.borderColor = CSSC[st.lane]; b.style.opacity = has ? 1 : 0.5;
      [].forEach.call($("rgO").children, function (li) { li.classList.toggle("on", li.dataset.l === L); });
    }
    function setTimerUI() {
      if (TUT) return;
      var s = Math.max(0, Math.ceil(st.remMs / 1000)), tm = $("rgTm");
      if (s !== st.lastSec) { st.lastSec = s; $("rgTv").textContent = s; if (s <= 10 && s > 0 && st.phase === "q" && !st.paused) sfx.tick(); }
      $("rgTb").style.width = Math.max(0, Math.min(100, (st.remMs / qTime) * 100)) + "%";
      tm.className = "rg-tm" + (s <= 5 ? " crit" : s <= 10 ? " warn" : "");
    }
    function msg(html, cls, ms) {
      var m = $("rgM"); m.className = "rg-msg"; void m.offsetWidth; m.innerHTML = html; m.className = "rg-msg " + (cls || 
