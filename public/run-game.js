/* ASTERION RUN — engine game 3D (Three.js) + HUD.
   Pemain menjawab dengan menggerakkan karakter ke gerbang A–E.
   Skor akademik HANYA ditentukan server (+1 benar, 0 salah/kosong); obstacle & energi murni visual. */
(function () {
  "use strict";
  var LET = ["A", "B", "C", "D", "E"], COL = [0xb18cff, 0x4cc9f0, 0x4ade80, 0xfbbf24, 0xff6b9a], CSSC = ["#b18cff", "#4cc9f0", "#4ade80", "#fbbf24", "#ff6b9a"];
  var LW = 2.4, LANES = 5, SPEED = 20, GATE_DIST = 95, GATE_MIN = 24, FB_MS = 2400;
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
    ".rg-hud{position:relative;flex:none;padding:calc(6px + env(safe-area-inset-top,0px)) 10px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;background:linear-gradient(#150e2c,#1a1136);border-bottom:1px solid rgba(245,192,74,.28);z-index:2}" +
    ".rg-bar{width:min(720px,100%);flex:none;display:flex;align-items:center;gap:8px}" +
    ".rg-pill{padding:6px 10px;border-radius:999px;background:rgba(20,12,44,.78);border:1px solid rgba(255,255,255,.2);font-weight:600;font-size:12px;white-space:nowrap}" +
    ".rg-pill.ok{color:#4ade80}.rg-pill.en{color:#f5c04a}" +
    ".rg-prog{flex:1;height:8px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden}.rg-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#b18cff,#f5c04a);transition:width .4s}" +
    ".rg-btn{width:36px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(20,12,44,.78);color:#fff;font-size:16px;cursor:pointer;flex:none}" +
    ".rg-card{width:min(720px,100%);flex:none;overflow:visible;border-radius:14px;padding:6px 10px;background:rgba(255,255,255,.05);border:1px solid rgba(245,192,74,.35)}" +
    ".rg-tm{display:flex;align-items:center;gap:10px;margin-bottom:3px}.rg-tmv{font:700 22px Cinzel,Georgia,serif;color:#f5c04a;min-width:2.2ch;text-align:right}" +
    ".rg-tmb{flex:1;height:7px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden}.rg-tmb i{display:block;height:100%;width:100%;background:#4ade80;transition:background .3s}" +
    ".rg-tm.warn .rg-tmv{color:#fbbf24}.rg-tm.warn .rg-tmb i{background:#fbbf24}.rg-tm.crit .rg-tmv{color:#f87171;animation:rgp .5s infinite alternate}.rg-tm.crit .rg-tmb i{background:#f87171}" +
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
    ".rg-foot{position:relative;flex:none;padding:6px 10px calc(8px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;align-items:center;gap:10px;min-height:54px;background:linear-gradient(#150e2c,#0f0a1f);border-top:1px solid rgba(245,192,74,.2);z-index:2}" +
    ".rg-ready{pointer-events:auto;padding:12px 18px;border-radius:999px;border:0;background:linear-gradient(135deg,#f5c04a,#e08a2e);color:#241a3f;font:700 14px Inter,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4)}" +
    ".rg-ready.pulse{animation:rgp .6s infinite alternate}" +
    ".rg-lane{padding:8px 14px;border-radius:999px;font-weight:700;background:rgba(20,12,44,.78);border:2px solid #fff;color:#fff}" +
    ".rg-msg{position:absolute;left:0;right:0;top:38%;text-align:center;pointer-events:none;font:900 clamp(34px,10vw,64px) Cinzel,Georgia,serif;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.7)}" +
    ".rg-msg.pop{animation:rgpop .9s ease-out both}.rg-msg.pop.long{animation-duration:2.3s}.rg-msg.ok{color:#4ade80}.rg-msg.bad{color:#f87171}.rg-msg.blank{color:#cbd5e1}.rg-msg small.rg-key{color:#fde68a;font-size:18px;margin-top:8px}.rg-msg small.rg-key b{color:#4ade80;font-size:24px}.rg-msg small{display:block;font:600 15px Inter,sans-serif;margin-top:4px;color:#e9ddff}" +
    "@keyframes rgpop{0%{transform:scale(.4);opacity:0}25%{transform:scale(1.12);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}" +
    ".rg-flash{position:absolute;inset:0;pointer-events:none;opacity:0}.rg-flash.ok{animation:rgfl .6s ease-out;background:radial-gradient(circle,rgba(74,222,128,.0),rgba(74,222,128,.5))}.rg-flash.bad{animation:rgfl .6s ease-out;background:radial-gradient(circle,rgba(248,113,113,0),rgba(248,113,113,.55))}" +
    "@keyframes rgfl{0%{opacity:1}100%{opacity:0}}" +
    ".rg.shake canvas{animation:rgsh .35s}@keyframes rgsh{20%{transform:translate(-6px,3px)}40%{transform:translate(6px,-3px)}60%{transform:translate(-4px,2px)}80%{transform:translate(3px,-2px)}}" +
    ".rg-ov{position:absolute;inset:0;background:rgba(10,6,24,.82);display:flex;align-items:center;justify-content:center;padding:20px;z-index:5;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
    ".rg-box{width:min(380px,100%);border-radius:22px;padding:20px;background:linear-gradient(160deg,rgba(58,42,102,.95),rgba(26,18,48,.98));border:1px solid rgba(245,192,74,.4);text-align:center}" +
    ".rg-box h3{margin:0 0 6px;font:900 20px Cinzel,Georgia,serif;color:#f5c04a;letter-spacing:.06em}.rg-box p{margin:6px 0 14px;color:#d9cdf5;line-height:1.5;font-size:13px}" +
    ".rg-box button{display:block;width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;font:600 14px Inter,sans-serif;cursor:pointer}" +
    ".rg-box button.pri{background:linear-gradient(135deg,#f5c04a,#e08a2e);color:#241a3f;border:0;font-weight:700}" +
    ".rg-tut{position:absolute;left:50%;transform:translateX(-50%);bottom:12px;width:min(420px,calc(100% - 24px));text-align:center;padding:12px 14px;border-radius:16px;background:rgba(18,10,40,.88);border:1px solid #f5c04a;font-weight:600;line-height:1.4;pointer-events:none}" +
    ".rg-tut small{display:block;color:#d9cdf5;font-weight:400;margin-top:3px}" +
    ".rg-lb{position:absolute;inset:0;z-index:6;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;padding:12px}.rg-lb img{max-width:100%;max-height:100%;background:#fff;border-radius:8px}" +
    ".rg-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:#d9cdf5;text-align:center;padding:20px}" +
    ":root[data-theme=\"light\"] .rg{background:#e6eeff;color:#241a3f}" +
    ":root[data-theme=\"light\"] .rg-hud{background:linear-gradient(#f8f5ff,#ebe5fa)}" +
    ":root[data-theme=\"light\"] .rg-pill{background:rgba(255,255,255,.92);border-color:rgba(48,28,88,.22);color:#241a3f}" +
    ":root[data-theme=\"light\"] .rg-pill.ok{color:#127a3e}" +
    ":root[data-theme=\"light\"] .rg-pill.en{color:#9a6a12}" +
    ":root[data-theme=\"light\"] .rg-prog{background:rgba(48,28,88,.16)}" +
    ":root[data-theme=\"light\"] .rg-tmb{background:rgba(48,28,88,.16)}" +
    ":root[data-theme=\"light\"] .rg-btn{background:rgba(255,255,255,.92);border-color:rgba(48,28,88,.22);color:#241a3f}" +
    ":root[data-theme=\"light\"] .rg-card{background:rgba(255,255,255,.82);border-color:rgba(154,106,18,.45)}" +
    ":root[data-theme=\"light\"] .rg-tmv{color:#9a6a12}" +
    ":root[data-theme=\"light\"] .rg-tm.warn .rg-tmv{color:#b7791f}" +
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
    ":root[data-theme=\"light\"] .rg-box{background:linear-gradient(160deg,#fff,#f1ebfc);border-color:rgba(154,106,18,.5)}" +
    ":root[data-theme=\"light\"] .rg-box h3{color:#9a6a12}" +
    ":root[data-theme=\"light\"] .rg-box p{color:#4b3f66}" +
    ":root[data-theme=\"light\"] .rg-box button{background:rgba(48,28,88,.08);color:#241a3f;border-color:rgba(48,28,88,.22)}" +
    ":root[data-theme=\"light\"] .rg-box button.pri{background:linear-gradient(135deg,#f5c04a,#e08a2e);color:#241a3f;border:0}" +
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
    root.innerHTML = '<div class="rg-hud"><div class="rg-bar"><span class="rg-pill" id="rgN">Soal 1/1</span><div class="rg-prog"><i id="rgP"></i></div><span class="rg-pill ok" id="rgS" title="Skor akademik">✔ 0</span><span class="rg-pill en" id="rgE" title="Energi (hiasan, tidak memengaruhi skor)">✨ 0</span>' +
      '<button class="rg-btn" id="rgSnd" aria-label="Suara">🔊</button><button class="rg-btn" id="rgPause" aria-label="Jeda">⏸</button></div>' +
      '<div class="rg-card" id="rgCard"><div class="rg-tm" id="rgTm"><span class="rg-tmv" id="rgTv">60</span><div class="rg-tmb"><i id="rgTb"></i></div></div><div class="rg-q" id="rgQ"></div><div class="rg-imgs" id="rgI" hidden></div><ul class="rg-opts" id="rgO"></ul></div>' +
      '<button class="rg-tg" id="rgTg">Sembunyikan pilihan ▲</button></div>' +
      '<div class="rg-stage" id="rgStage"><canvas></canvas><div class="rg-flash"></div><div class="rg-msg" id="rgM"></div><div class="rg-tut" id="rgT" hidden></div></div>' +
      '<div class="rg-foot"><span class="rg-lane" id="rgL">Jalur C</span><button class="rg-ready" id="rgR">⏩ Siap menjawab</button></div>' +
      '<div class="rg-load" id="rgLd"><div style="font-size:34px">🏃</div><div>Memuat dunia 3D…</div></div>';
    document.body.appendChild(root);
    var $ = function (id) { return root.querySelector("#" + id); };
    if (TUT) { $("rgTm").style.display = "none"; $("rgP").parentNode.style.visibility = "hidden"; $("rgS").style.display = "none"; }

    var st = { phase: "load", cur: cfg.cur || 0, lane: 2, x: 0, y: 0, vy: 0, slideT: 0, stumbleT: 0, invul: 0, speedMul: 1, remMs: qTime, qEnd: 0, locked: false, paused: false, gate: null, gateSpawned: false, score: cfg.score || 0, energy: 0, obsT: 1.2, runT: 0, pose: { l: 0, r: 0, al: 0, ar: 0, bx: -0.16, by: 0, bz: 0 }, tutStep: 0, tutT: 0, destroyed: false, lastSec: -1 };
    var qs = cfg.qs, raf = 0, last = 0;
    var R, scene, cam, player, parts = [], world = { obs: [], coins: [], gates: [], pyl: [], arch: [], holo: [] };

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
      var m = $("rgM"); m.className = "rg-msg"; void m.offsetWidth; m.innerHTML = html; m.className = "rg-msg " + (cls || "") + (ms === 0 ? "" : " pop");
      if (ms === 0) return; clearTimeout(msg.h); msg.h = setTimeout(function () { m.innerHTML = ""; }, 950);
    }
    function flash(c) { if (!fx) return; var f = root.querySelector(".rg-flash"); f.className = "rg-flash"; void f.offsetWidth; f.className = "rg-flash " + c; }
    function shake() { if (!fx) return; root.classList.remove("shake"); void root.offsetWidth; root.classList.add("shake"); }
    function sndUI() { $("rgSnd").textContent = snd.on ? "🔊" : "🔇"; }
    sndUI(); if (S.sound === 0) $("rgSnd").style.display = "none";

    /* ---------- tiga dimensi ---------- */
    function mkMat(c, o) { return new T.MeshBasicMaterial(Object.assign({ color: c }, o || {})); }
    function mkLam(c, o) { return new T.MeshLambertMaterial(Object.assign({ color: c }, o || {})); }
    function box(w, h, d, m) { return new T.Mesh(new T.BoxGeometry(w, h, d), m); }
    var G = {}; // geometri/material bersama
    var LT = function () { return document.documentElement.getAttribute("data-theme") === "light"; };
    function initShared() {
      G.coin = new T.OctahedronGeometry(0.34); G.coinM = mkMat(0xffd166);
      G.postG = new T.BoxGeometry(0.22, 1, 0.22); G.purple = mkLam(0x5b3fb0, { emissive: 0x2a1b66 }); G.gold = mkMat(0xf5c04a); G.red = mkMat(0xff6b9a, { transparent: true, opacity: 0.95 });
      G.foamG = new T.RingGeometry(0.95, 2.1, 24); G.foam = mkMat(0xffffff, { transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide }); G.dark = mkLam(0x2a1c52); G.white = mkLam(0xf4f0ff); G.wall = mkLam(0x2b2442);
      G.ltc = []; G.lt = LET.map(function (L, i) {
        var c = document.createElement("canvas"); c.width = c.height = 128; G.ltc.push(c); return new T.CanvasTexture(c);
      }); paintLt();
    }
    function paintLt() {
      var light = LT();
      G.ltc.forEach(function (c, i) {
        var g = c.getContext("2d"); g.clearRect(0, 0, 128, 128);
        g.fillStyle = light ? "rgba(255,255,255,.95)" : "rgba(10,6,24,.85)"; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = CSSC[i]; g.stroke();
        g.fillStyle = light ? "#241a3f" : "#fff"; g.font = "900 78px Cinzel,Georgia,serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(L_(i), 64, 70);
        G.lt[i].needsUpdate = true;
      });
    }
    function L_(i) { return LET[i]; }
    var floorCv;
    function paintFloor() {
      var light = LT(), g = floorCv.getContext("2d");
      var gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, light ? "#cbc0ea" : "#1d1438"); gr.addColorStop(1, light ? "#b9ace0" : "#150e2c"); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = light ? "rgba(190,125,10,.85)" : "rgba(245,192,74,.6)"; g.lineWidth = 4; for (var i = 0; i <= LANES; i++) { var x = (i * 512) / LANES; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
      g.strokeStyle = light ? "rgba(70,40,150,.45)" : "rgba(177,140,255,.35)"; g.lineWidth = 3; [0, 256].forEach(function (y) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); });
      g.fillStyle = light ? "rgba(60,40,110,.07)" : "rgba(255,255,255,.05)"; for (var k = 0; k < 40; k++) g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    function floorTex() {
      floorCv = document.createElement("canvas"); floorCv.width = floorCv.height = 512; paintFloor();
      var t = new T.CanvasTexture(floorCv); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
    }
    var floorT, laneGlow, moon, amb, dirL, gndM, starsP, moonCv, moonTex, cloudG, seaCv, seaT;
    function paintSea() {
      var light = LT(), g = seaCv.getContext("2d"), N = 256, i, k;
      var gr = g.createLinearGradient(0, 0, 0, N);
      gr.addColorStop(0, light ? "#2f86d6" : "#041a46"); gr.addColorStop(1, light ? "#4a9de6" : "#062a66"); g.fillStyle = gr; g.fillRect(0, 0, N, N);
      g.lineCap = "round";
      for (i = 0; i < 14; i++) {
        var y0 = (i * 37 + (i % 3) * 11) % N, amp = 3 + (i % 4) * 2, cyc = 2 + (i % 3), ph = i * 1.7;
        [-N, 0, N].forEach(function (off) {
          g.beginPath();
          for (var x = 0; x <= N; x += 4) { var y = y0 + off + Math.sin((x / N) * cyc * 6.283 + ph) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y); }
          if (light) { g.strokeStyle = "rgba(255,255,255,.38)"; g.lineWidth = 2.5; g.shadowBlur = 0; }
          else { g.strokeStyle = i % 2 ? "rgba(40,255,225,.55)" : "rgba(90,170,255,.5)"; g.lineWidth = 2.5; g.shadowColor = i % 2 ? "#19ffe0" : "#4aa8ff"; g.shadowBlur = 12; }
          g.stroke();
        });
      }
      g.shadowBlur = 0;
      for (k = 0; k < (light ? 40 : 70); k++) {
        var sx = Math.random() * N, sy = Math.random() * N, r = 1 + Math.random() * (light ? 1.5 : 2.2);
        if (light) { g.fillStyle = "rgba(255,255,255,.7)"; } else { g.fillStyle = Math.random() < 0.5 ? "rgba(120,255,235,.95)" : "rgba(150,210,255,.95)"; g.shadowColor = "#2ff"; g.shadowBlur = 10; }
        [-N, 0, N].forEach(function (o) { g.beginPath(); g.arc(sx, sy + o, r, 0, 7); g.fill(); });
        g.shadowBlur = 0;
      }
      if (seaT) seaT.needsUpdate = true;
    }
    function paintMoon() {
      var g = moonCv.getContext("2d"), light = LT(); g.clearRect(0, 0, 128, 128);
      var rg = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      if (light) { rg.addColorStop(0, "rgba(255,236,170,1)"); rg.addColorStop(0.45, "rgba(245,192,74,.9)"); rg.addColorStop(1, "rgba(245,192,74,0)"); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); }
      else {
        rg.addColorStop(0, "rgba(200,215,255,.5)"); rg.addColorStop(0.5, "rgba(170,190,255,.18)"); rg.addColorStop(1, "rgba(170,190,255,0)"); g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
        g.fillStyle = "#eef2ff"; g.beginPath(); g.arc(64, 64, 26, 0, 7); g.fill();
        g.fillStyle = "rgba(150,160,200,.35)"; [[54, 56, 6], [74, 70, 7], [66, 50, 4], [56, 76, 4]].forEach(function (c) { g.beginPath(); g.arc(c[0], c[1], c[2], 0, 7); g.fill(); });
      }
      moonTex.needsUpdate = true;
    }
    function buildScene() {
      scene = new T.Scene(); scene.background = new T.Color(0x120c24); scene.fog = new T.Fog(0x120c24, 30, 140);
      amb = new T.AmbientLight(0xcbb8ff, 0.85); scene.add(amb); var dl = dirL = new T.DirectionalLight(0xffffff, 0.8); dl.position.set(3, 8, 6); scene.add(dl);
      var LEN = 320; floorT = floorTex(); floorT.repeat.set(1, LEN / (LANES * LW));
      var fl = new T.Mesh(new T.PlaneGeometry(LANES * LW, LEN), mkMat(0xffffff, { map: floorT })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, -LEN / 2 + 25); scene.add(fl);
      seaCv = document.createElement("canvas"); seaCv.width = seaCv.height = 256; seaT = new T.CanvasTexture(seaCv); seaT.wrapS = seaT.wrapT = T.RepeatWrapping; seaT.repeat.set(4, 8); seaT.anisotropy = 4; paintSea();
      gndM = mkMat(0xffffff, { map: seaT }); var gnd = new T.Mesh(new T.PlaneGeometry(160, LEN), gndM); gnd.rotation.x = -Math.PI / 2; gnd.position.set(0, -0.06, -LEN / 2 + 25); scene.add(gnd);
      [-1, 1].forEach(function (s) { var rail = box(0.14, 0.3, LEN, G.gold); rail.position.set(s * (LANES * LW / 2 + 0.07), 0.15, -LEN / 2 + 25); scene.add(rail); });
      laneGlow = new T.Mesh(new T.PlaneGeometry(LW - 0.15, 36), mkMat(0xffffff, { transparent: true, opacity: 0.13, depthWrite: false })); laneGlow.rotation.x = -Math.PI / 2; laneGlow.position.set(0, 0.03, -14); scene.add(laneGlow);
      // pylon sisi jalan
      var N = low ? 9 : 16, sp = 14;
      [-1, 1].forEach(function (s) {
        for (var i = 0; i < N; i++) {
          var h = 5 + ((i * 7) % 5), g = new T.Group(); g.userData.sp = sp * N;
          var b = box(1.3, h + 3, 1.3, G.dark); b.position.y = (h - 3) / 2; g.add(b);
          var pl = box(1.9, 0.4, 1.9, G.dark); pl.position.y = 0.2; g.add(pl);
          var foam = new T.Mesh(G.foamG, G.foam); foam.rotation.x = -Math.PI / 2; foam.position.y = -0.02; g.add(foam);
          var stripe = box(0.12, h * 0.85, 0.06, i % 2 ? G.gold : mkMat(0xb18cff)); stripe.position.set(-s * 0.66, h / 2, 0); g.add(stripe);
          var cap = box(1.5, 0.2, 1.5, mkMat(0xb18cff)); cap.position.y = h; g.add(cap);
          g.position.set(s * (LANES * LW / 2 + 2.2), 0, 8 - i * sp); scene.add(g); world.pyl.push(g);
        }
      });
      // lengkung emas di atas lintasan
      for (var a = 0; a < (low ? 3 : 6); a++) {
        var arc = new T.Mesh(new T.TorusGeometry(LANES * LW / 2 + 0.6, 0.07, 6, 36, Math.PI), G.gold); arc.position.set(0, 0, -a * 38 + 5); arc.userData.sp = 38 * (low ? 3 : 6); scene.add(arc); world.arch.push(arc);
      }
      // bintang & bulan
      var pos = []; for (var s2 = 0; s2 < (low ? 150 : 420); s2++) { var th = Math.random() * 6.283, ph = Math.random() * 1.2 + 0.1, r = 220 + Math.random() * 60; pos.push(Math.cos(th) * Math.cos(ph) * r, Math.sin(ph) * r * 0.9 + 6, -Math.abs(Math.sin(th) * Math.cos(ph) * r) - 30); }
      var sg = new T.BufferGeometry(); sg.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      starsP = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, fog: false })); scene.add(starsP);
      moonCv = document.createElement("canvas"); moonCv.width = moonCv.height = 128; moonTex = new T.CanvasTexture(moonCv); paintMoon();
      moon = new T.Sprite(new T.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false })); moon.scale.set(60, 60, 1); moon.renderOrder = 5; moon.material.depthTest = false; moon.position.set(45, 48, -240); scene.add(moon);
      // awan siang hari
      var cc = document.createElement("canvas"); cc.width = 128; cc.height = 64; var cg2 = cc.getContext("2d");
      [[40, 38, 22], [64, 28, 26], [90, 38, 22], [64, 42, 30]].forEach(function (b) { var r = cg2.createRadialGradient(b[0], b[1], 2, b[0], b[1], b[2]); r.addColorStop(0, "rgba(255,255,255,.95)"); r.addColorStop(1, "rgba(255,255,255,0)"); cg2.fillStyle = r; cg2.fillRect(0, 0, 128, 64); });
      var ctex = new T.CanvasTexture(cc); cloudG = new T.Group();
      for (var q = 0; q < (low ? 22 : 48); q++) {
        var cl = new T.Sprite(new T.SpriteMaterial({ map: ctex, fog: false, depthWrite: false, transparent: true, opacity: 0.85 })); var sc = 45 + Math.random() * 50; cl.scale.set(sc * 2, sc, 1);
        cl.position.set(-230 + Math.random() * 460, 12 + Math.random() * 80, -200 - Math.random() * 60); cl.userData.v = 0.6 + Math.random() * 1.2; cl.renderOrder = 0; cloudG.add(cl);
      }
      scene.add(cloudG);
      buildPlayer(); applyTheme();
    }
    function applyTheme() {
      if (!scene) return; var light = LT();
      scene.background.setHex(light ? 0xcfdcf5 : 0x120c24); scene.fog.color.setHex(light ? 0xcfdcf5 : 0x120c24);
      amb.color.setHex(light ? 0xffffff : 0xcbb8ff); amb.intensity = light ? 0.8 : 0.85; dirL.intensity = light ? 0.6 : 0.8;
      G.dark.color.setHex(light ? 0x6a5aac : 0x2a1c52); G.foam.color.setHex(light ? 0xffffff : 0x4dffe6); G.wall.color.setHex(light ? 0x56468f : 0x2b2442); G.white.color.setHex(light ? 0x22264f : 0xf4f0ff);
      laneGlow.material.color.setHex(light ? 0x7a5ae0 : 0xffffff); starsP.visible = !light;
      moon.material.transparent = true; cloudG.visible = light; paintMoon();
      paintFloor(); floorT.needsUpdate = true; paintLt(); paintSea();
    }
    var limbs = {};
    function buildPlayer() {
      player = new T.Group(); var body = new T.Group(); player.add(body); limbs.body = body;
      var skin = mkLam(0xf1c9a5), coat = G.white, scrub = mkLam(0x6b3fc4), pants = mkLam(0x3b2a78), shoe = mkLam(0xf5c04a);
      var torso = box(0.72, 0.92, 0.42, coat); torso.position.y = 1.0; body.add(torso);
      var panel = box(0.4, 0.5, 0.03, scrub); panel.position.set(0, 1.0, 0.22); body.add(panel);
      var lc = document.createElement("canvas"); lc.width = lc.height = 128; var lg = lc.getContext("2d");
      lg.fillStyle = "#f5c04a"; lg.font = "900 84px Cinzel,Georgia,serif"; lg.textAlign = "center"; lg.textBaseline = "middle"; lg.fillText("25", 64, 70);
      var logo = new T.Mesh(new T.PlaneGeometry(0.36, 0.36), new T.MeshBasicMaterial({ map: new T.CanvasTexture(lc), transparent: true })); logo.position.set(0, 1.0, 0.25); body.add(logo);
      var head = new T.Mesh(new T.SphereGeometry(0.29, 16, 12), skin); head.position.y = 1.7; body.add(head);
      var cap = new T.Mesh(new T.SphereGeometry(0.31, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), scrub); cap.position.y = 1.74; body.add(cap);
      var steth = new T.Mesh(new T.TorusGeometry(0.22, 0.035, 8, 18), G.gold); steth.rotation.x = Math.PI / 2; steth.position.y = 1.43; body.add(steth);
      [-1, 1].forEach(function (s) {
        var arm = new T.Group(); arm.position.set(s * 0.46, 1.38, 0); var a = box(0.17, 0.66, 0.17, coat); a.position.y = -0.3; arm.add(a);
        var hand = new T.Mesh(new T.SphereGeometry(0.1, 8, 8), skin); hand.position.y = -0.68; arm.add(hand); body.add(arm); limbs[s < 0 ? "aL" : "aR"] = arm;
        var leg = new T.Group(); leg.position.set(s * 0.19, 0.58, 0); var l = box(0.24, 0.55, 0.25, pants); l.position.y = -0.27; leg.add(l);
        var sh = box(0.27, 0.14, 0.38, shoe); sh.position.set(0, -0.58, 0.05); leg.add(sh); body.add(leg); limbs[s < 0 ? "lL" : "lR"] = leg;
      });
      body.scale.setScalar(1.15); var sh2 = new T.Mesh(new T.CircleGeometry(0.55, 20), mkMat(0x000000, { transparent: true, opacity: 0.4 })); sh2.rotation.x = -Math.PI / 2; sh2.position.y = 0.02; limbs.shadow = sh2;
      player.add(sh2); scene.add(player);
    }
    function sizeCam() {
      var stg = $("rgStage"), w = (stg && stg.clientWidth) || innerWidth, h = (stg && stg.clientHeight) || innerHeight, asp = w / h;
      R.setSize(w, h, false); cam.aspect = asp;
      var Dz = Math.max(6.6, Math.min(24, 6.3 / (0.637 * asp))), Hy = 2.6 + Dz * 0.27;
      cam.fov = 65; cam.userData.base = { y: Hy, z: Dz, tz: -Dz * 1.3 - 4 }; cam.updateProjectionMatrix(); if (!cam.userData.init) { cam.userData.init = 1; cam.position.set(0, Hy, Dz); }
    }
    function initGL() {
      try { R = new T.WebGLRenderer({ canvas: root.querySelector("canvas"), antialias: !low, powerPreference: "high-performance" }); }
      catch (e) { throw new Error("WebGL tidak tersedia di perangkat/browser ini."); }
      R.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 2));
      cam = new T.PerspectiveCamera(65, 1, 0.1, 400); initShared(); buildScene(); sizeCam();
    }

    /* ---------- obstacle / energi / gerbang ---------- */
    function mkObstacle(type, lane, z) {
      var g = new T.Group(), x = laneX(lane), w = LW * 0.86;
      if (type === "hurdle") {
        var bar = box(w, 0.2, 0.2, G.red); bar.position.y = 0.55; g.add(bar);
        [-1, 1].forEach(function (s) { var p = new T.Mesh(G.postG, G.purple); p.scale.y = 0.6; p.position.set(s * w / 2, 0.3, 0); g.add(p); });
      } else if (type === "beam") {
        var b2 = box(w, 0.3, 0.3, G.red); b2.position.y = 1.55; g.add(b2);
        [-1, 1].forEach(function (s) { var p = new T.Mesh(G.postG, G.purple); p.scale.y = 2.7; p.position.set(s * w / 2, 1.35, 0); g.add(p); });
      } else { // block
        var bk = box(w * 0.9, 1.4, 1.1, G.purple); bk.position.y = 0.7; g.add(bk); var st2 = box(w * 0.92, 0.18, 1.12, G.red); st2.position.y = 1.2; g.add(st2);
      }
      g.position.set(x, 0, z); scene.add(g); var o = { g: g, type: type, lane: lane, hit: false, dying: false }; world.obs.push(o); return o;
    }
    function mkCoin(lane, z, y) { var m = new T.Mesh(G.coin, G.coinM); m.scale.z = 0.4; m.position.set(laneX(lane), y || 1.0, z); scene.add(m); var c = { m: m, lane: lane, got: false }; world.coins.push(c); return c; }
    function spawnPattern() {
      var r = Math.random(), type = r < 0.4 ? "hurdle" : r < 0.7 ? "beam" : "block", n = type === "block" ? 1 + (Math.random() < 0.4 ? 1 : 0) : 1 + ((Math.random() * 3) | 0), lanes = [];
      while (lanes.length < n) { var l = (Math.random() * LANES) | 0; if (lanes.indexOf(l) < 0) lanes.push(l); }
      lanes.forEach(function (l) { mkObstacle(type, l, -125); });
      var free = []; for (var i = 0; i < LANES; i++) if (lanes.indexOf(i) < 0) free.push(i);
      var cl = free[(Math.random() * free.length) | 0]; for (var k = 0; k < 5; k++) mkCoin(cl, -118 - k * 1.9);
      if (type !== "block" && Math.random() < 0.5) { var jl = lanes[0]; for (var j = 0; j < 3; j++) mkCoin(jl, -127 - (j - 1) * 1.6, 1.6 + (j === 1 ? 0.5 : 0)); }
    }
    function killAhead() { // buang yang masih jauh di depan agar jalur jawaban bersih
      world.obs.forEach(function (o) { if (o.g.position.z < -14) o.dying = true; });
      world.coins.forEach(function (c) { if (c.m.position.z < -14) c.dying = true; });
    }
    function spawnGates() {
      if (st.gateSpawned) return;
      var dist = GATE_DIST; if (isFinite(st.remMs)) { dist = Math.min(GATE_DIST, (st.remMs / 1000 - 0.5) * SPEED); if (dist < GATE_MIN) { host.toast && host.toast("Waktu terlalu mepet untuk memanggil gerbang"); return; } }
      st.gateSpawned = true; killAhead(); sfx.gate();
      var q = cur(), grp = new T.Group(); grp.position.z = -dist;
      LET.forEach(function (L, i) {
        var has = !!q.o[L], g = new T.Group(), c = has ? COL[i] : (LT() ? 0xa9a1c8 : 0x3a3355), x = laneX(i);
        [-1, 1].forEach(function (s) { var p = box(0.3, 3.6, 0.5, mkMat(c)); p.position.set(x + s * (LW / 2 - 0.2), 1.8, 0); g.add(p); });
        var top = box(LW - 0.1, 0.45, 0.5, mkMat(c)); top.position.set(x, 3.6, 0); g.add(top);
        if (has) {
          var sp = new T.Sprite(new T.SpriteMaterial({ map: G.lt[i], fog: false, depthTest: false })); sp.scale.set(1.9, 1.9, 1); sp.position.set(x, 4.7, 0); sp.renderOrder = 10; g.add(sp);
          var f = new T.Mesh(new T.PlaneGeometry(LW - 0.5, 3.4), mkMat(c, { transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false })); f.position.set(x, 1.8, 0); g.add(f);
          var fs = new T.Mesh(new T.PlaneGeometry(LW - 0.2, 3), mkMat(c, { transparent: true, opacity: 0.28, depthWrite: false })); fs.rotation.x = -Math.PI / 2; fs.position.set(x, 0.04, 0); g.add(fs);
        } else { var wall = box(LW - 0.4, 3.4, 0.4, G.wall); wall.position.set(x, 1.7, 0); g.add(wall); }
        grp.add(g);
      });
      scene.add(grp); st.gate = { g: grp, done: false }; world.gates.push(st.gate);
      msg("GERBANG JAWABAN!<small>Pilih jalur lalu lewati gerbangnya</small>", "", 700);
      $("rgR").hidden = true;
    }
    function burst(x, y, z, color, n) {
      if (!fx) return; n = low ? n >> 1 : n;
      for (var i = 0; i < n; i++) {
        var m = new T.Mesh(new T.BoxGeometry(0.14, 0.14, 0.14), mkMat(color, { transparent: true })); m.position.set(x, y, z); scene.add(m);
        parts.push({ m: m, vx: (Math.random() - 0.5) * 7, vy: Math.random() * 6 + 2, vz: (Math.random() - 0.5) * 6, t: 0.9 });
      }
    }

    /* ---------- kontrol ---------- */
    function tutAct(a) { if (TUT && st.phase === "q") { var s = TUT_STEPS[st.tutStep]; if (s && s.id === a) { st.tutStep++; st.tutT = 0; showTut(); } } }
    function laneOk(i) { var q = cur(); return !q || !!q.o[LET[i]]; }
    function move(d) {
      if (st.paused || st.phase === "end" || st.phase === "load") return;
      var n = st.lane + d; if (n < 0 || n >= LANES) return; if (!laneOk(n)) return; st.lane = n; sfx.lane(); tutAct(d < 0 ? "left" : "right");
    }
    function jump() { if (st.paused || st.y > 0.01 || st.phase === "load" || st.phase === "end") return; st.vy = 9.2; st.slideT = 0; sfx.jump(); tutAct("jump"); }
    function slide() { if (st.paused || st.phase === "load" || st.phase === "end") return; if (st.y > 0.01) st.vy = -14; st.slideT = 0.75; sfx.slide(); tutAct("slide"); }
    function onKey(e) {
      if (e.repeat && !/Arrow|^[ADWS]$/i.test(e.key)) return; var k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") move(-1);
      else if (k === "ArrowRight" || k === "d" || k === "D") move(1);
      else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") jump();
      else if (k === "ArrowDown" || k === "s" || k === "S") slide();
      else if (k === "Enter" || k === "f" || k === "F") callGate();
      else if (k === "Escape" || k === "p" || k === "P") togglePause();
      else return; e.preventDefault();
    }
    var tx = null, ty = null, sw = false;
    function skip(t) { return t.closest && t.closest(".rg-hud,.rg-card,.rg-btn,.rg-ready,.rg-ov,.rg-tg,.rg-lb"); }
    function onTS(e) { if (skip(e.target)) { tx = null; return; } var t = e.touches[0]; tx = t.clientX; ty = t.clientY; sw = false; }
    function onTM(e) {
      if (tx == null || sw) return; var t = e.touches[0], dx = t.clientX - tx, dy = t.clientY - ty;
      if (Math.abs(dx) < 26 && Math.abs(dy) < 26) return; sw = true;
      if (Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? -1 : 1); else if (dy < 0) jump(); else slide(); e.preventDefault();
    }
    function onTE() { tx = null; }
    function callGate() { if (st.phase === "count" && !TUT && !st.paused) { st.queuedGate = true; return; } if (st.phase === "q" && !st.locked && !st.gateSpawned && !st.paused) { if (TUT && TUT_STEPS[st.tutStep] && TUT_STEPS[st.tutStep].id !== "gate") return; spawnGates(); if (TUT) { st.tutStep = 99; showTut(); } } }

    /* ---------- alur soal ---------- */
    function showQuestion(i, rem) {
      st.cur = i; st.phase = "q"; st.locked = false; st.gateSpawned = false; st.gate = null; st.lastSec = -1;
      st.remMs = TUT ? Infinity : Math.min(qTime, rem == null ? qTime : rem); st.qEnd = performance.now() + st.remMs;
      if (!laneOk(st.lane)) { for (var k = 0; k < LANES; k++) if (laneOk(k)) { st.lane = k; break; } }
      renderQ(); $("rgR").hidden = false; $("rgR").classList.toggle("pulse", TUT); setTimerUI();
      if (st.queuedGate) { st.queuedGate = false; spawnGates(); }
    }
    function feedback(r, letter) {
      var lane = letter ? LET.indexOf(letter) : st.lane, x = laneX(lane);
      var kn = ""; // kunci tidak ditulis; cukup pilihan soal diwarnai: benar = hijau, jawaban salah = merah
      [].forEach.call(root.querySelectorAll("#rgO li"), function (li) { li.classList.remove("on", "ok", "no"); if (r.ans && li.dataset.l === r.ans) li.classList.add("ok"); else if (letter && li.dataset.l === letter && !r.correct) li.classList.add("no"); });
      if (r.correct && letter) { var cl = root.querySelector("#rgO li[data-l='" + letter + "']"); if (cl) cl.classList.add("ok"); }
      if (root.classList.contains("min")) { root.classList.remove("min"); $("rgTg").textContent = "Sembunyikan pilihan ▲"; fitHud(); }
      if (r.blank) { msg("WAKTU HABIS<small>Tidak dijawab · 0 poin</small>" + kn, "blank long"); sfx.blank(); flash("bad"); }
      else if (r.correct) { msg("BENAR! +1" + kn, "ok long"); sfx.ok(); flash("ok"); burst(x, 1.4, 0, 0x4ade80, 26); burst(x, 1.4, 0, 0xf5c04a, 18); st.score = r.score != null ? r.score : st.score + 1; }
      else { msg("SALAH<small>0 poin · lanjut ke soal berikutnya</small>" + kn, "bad long"); sfx.bad(); flash("bad"); shake(); burst(x, 1.4, 0, 0xf87171, 22); if (r.score != null) st.score = r.score; }
      $("rgS").textContent = "✔ " + st.score;
    }
    async function submitAnswer(letter) {
      if (st.locked) return; st.locked = true; st.pending = letter; var idx = st.cur, r = null;
      for (var k = 0; k < 6 && !r; k++) {
        try { r = await host.answer(idx, letter); } catch (e) { r = { ok: false, status: 0 }; }
        if (st.destroyed) return;
        if (!r.ok && r.status === 0) { host.toast && host.toast("Koneksi bermasalah, mencoba lagi…"); r = null; await sleep(800 * (k + 1)); }
      }
      if (!r) { host.toast && host.toast("Gagal mengirim jawaban."); showPauseMenu("Koneksi terputus", "Jawabanmu belum terkirim. Periksa internet lalu coba lagi.", true); return; }
      if (!r.ok) { // 409: urutan tidak sinkron → ikuti server
        var p = host.resync ? await host.resync() : null; if (st.destroyed) return;
        if (p && p.status === "done") return finishGame(); if (p && p.qs) { qs = p.qs; st.score = p.score || st.score; showQuestion(p.cur, p.remaining); return; }
        host.toast && host.toast(r.j && r.j.err || "Sinkronisasi gagal"); return;
      }
      st.phase = "fb"; feedback(r.j, letter);
      if (r.j.done) { await sleep(FB_MS); if (!st.destroyed) finishGame(); return; }
      await sleep(FB_MS); if (st.destroyed) return;
      if (st.paused) { st.pendingNext = r.j; return; }
      showQuestion(st.cur + 1, qTime);
    }
    function finishGame() {
      if (st.destroyed || st.phase === "end") return; st.phase = "end"; sfx.end();
      if (TUT) { showPauseMenu("Latihan selesai 🎉", "Kamu sudah siap! Di permainan sungguhan, setiap soal punya waktu sendiri dan skor ditentukan oleh jawabanmu.", false, "Mulai bermain ▶"); return; }
      msg("SELESAI!", "ok"); setTimeout(function () { host.done && host.done(); }, 900);
    }
    function onGatePass() {
      var lane = st.lane, L = LET[lane]; st.gate.done = true;
      if (TUT) { var ok = L === "C"; st.phase = "fb"; feedback({ correct: ok, blank: false, score: 0, ans: "C" }, L); st.locked = true; setTimeout(function () { if (!st.destroyed) finishGame(); }, 1300); return; }
      submitAnswer(L);
    }

    /* ---------- tutorial ---------- */
    var TUT_STEPS = [
      { id: "left", t: "Geser ke KIRI", s: "← / A  ·  swipe ke kiri" }, { id: "right", t: "Geser ke KANAN", s: "→ / D  ·  swipe ke kanan" },
      { id: "jump", t: "LOMPAT melewati palang rendah", s: "↑ / W / Spasi  ·  swipe ke atas", spawn: "hurdle" },
      { id: "slide", t: "SLIDE di bawah palang tinggi", s: "↓ / S  ·  swipe ke bawah", spawn: "beam" },
      { id: "gate", t: "Tekan “Siap menjawab”, lalu arahkan ke gerbang C", s: "Pada permainan asli, jalur menentukan jawabanmu (A–E)" },
    ];
    function showTut() {
      var b = $("rgT"); if (!TUT) return; var s = TUT_STEPS[st.tutStep];
      if (!s) { b.hidden = st.tutStep === 99 ? false : true; if (st.tutStep === 99) { b.innerHTML = "Arahkan karaktermu ke <b>gerbang C</b>!<small>Gerbang di jalur lain = jawaban lain</small>"; } return; }
      b.hidden = false; b.innerHTML = "<span style='color:#f5c04a'>Langkah " + (st.tutStep + 1) + "/" + TUT_STEPS.length + "</span><br>" + s.t + "<small>" + s.s + "</small>";
    }

    /* ---------- jeda / keluar ---------- */
    var ov = null;
    function closeOv() { if (ov) { ov.remove(); ov = null; } }
    function showPauseMenu(title, text, retry, primary) {
      closeOv(); ov = el("div", "rg-ov"); var b = el("div", "rg-box"); b.innerHTML = "<h3></h3><p></p>"; b.firstChild.textContent = title; b.lastChild.textContent = text; ov.appendChild(b);
      var add = function (label, cls, fn) { var x = el("button", cls); x.textContent = label; x.onclick = fn; b.appendChild(x); return x; };
      if (st.phase === "end" && TUT) add(primary || "Lanjut", "pri", function () { host.done && host.done(); });
      else if (retry) add("Coba kirim lagi", "pri", function () { closeOv(); st.locked = false; submitAnswer(st.pending); });
      else add("▶ Lanjutkan", "pri", function () { togglePause(); });
      if (!(st.phase === "end" && TUT)) {
        if (S.sound !== 0) add(snd.on ? "🔊 Suara: hidup" : "🔇 Suara: mati", "", function (e) { toggleSnd(); e.target.textContent = snd.on ? "🔊 Suara: hidup" : "🔇 Suara: mati"; });
        add(TUT ? "Lewati tutorial" : "Keluar (bisa dilanjutkan nanti)", "", function () { if (TUT) { host.done && host.done(); } else { host.exit && host.exit(); } });
      }
      root.appendChild(ov);
    }
    function toggleSnd() { snd.on = !snd.on; try { localStorage.setItem("runSnd", snd.on ? "1" : "0"); } catch (e) {} sndUI(); }
    async function togglePause() {
      if (st.phase === "load" || st.phase === "end") return;
      if (!st.paused) {
        if (S.pause === 0 && !TUT) { return; }
        st.paused = true; st.pauseRem = st.remMs;
        showPauseMenu("Jeda", TUT ? "Latihan dijeda." : "Waktu soal berhenti sementara (satu jeda maksimal 5 menit, setelah itu waktu berjalan lagi).");
        if (!TUT && host.pause && st.phase === "q") host.pause().catch(function () {});
      } else {
        closeOv(); st.paused = false;
        if (!TUT && host.resume && (st.phase === "q" || st.phase === "fb")) { try { var r = await host.resume(); if (r && r.remaining != null && st.phase === "q") st.remMs = Math.min(qTime, r.remaining); else st.remMs = st.pauseRem; } catch (e) { st.remMs = st.pauseRem; } } else st.remMs = st.pauseRem;
        st.qEnd = performance.now() + st.remMs;
        if (st.pendingNext) { st.pendingNext = null; showQuestion(st.cur + 1, qTime); }
      }
    }
    function onVis() { if (document.hidden && !st.paused && (st.phase === "q" || st.phase === "fb") && S.pause !== 0) togglePause(); }

    /* ---------- loop ---------- */
    function update(dt) {
      var t = performance.now();
      // timer
      if (st.phase === "q" && !st.paused && !TUT) {
        st.remMs = Math.max(0, st.qEnd - t); setTimerUI();
        if (st.remMs <= 0 && !st.locked) { msg("", ""); submitAnswer(null); } // submitAnswer sendiri yang mengunci
      }
      st.invul = Math.max(0, st.invul - dt); st.stumbleT = Math.max(0, st.stumbleT - dt);
      var targetMul = st.stumbleT > 0 ? 0.12 : 1; st.speedMul += (targetMul - st.speedMul) * Math.min(1, dt * (targetMul < st.speedMul ? 14 : 2.6)); // jatuh cepat, pulih perlahan
      var v = SPEED * st.speedMul * (st.phase === "load" ? 0 : 1), gv = SPEED * st.speedMul; st.runT += dt * (3 + 6.5 * st.speedMul);
      // lantai & dunia
      seaT.offset.y += (v * dt) / 40 + dt * 0.02; seaT.offset.x += dt * 0.015;
      if (!low && !LT()) gndM.color.setScalar(0.85 + 0.15 * Math.sin(t / 700)); else gndM.color.setScalar(1);
      floorT.offset.y += (v * dt) / (LANES * LW); laneGlow.position.x += (laneX(st.lane) - laneGlow.position.x) * Math.min(1, dt * 14);
      laneGlow.material.color.setHex(laneOk(st.lane) ? COL[st.lane] : 0x666666);
      world.pyl.forEach(function (g) { g.position.z += v * dt; if (g.position.z > 14) g.position.z -= g.userData.sp; });
      world.arch.forEach(function (g) { g.position.z += v * dt; if (g.position.z > 10) g.position.z -= g.userData.sp; });
      world.holo.forEach(function (g) { g.position.z += v * dt; g.rotation.y += dt * 1.2; if (g.position.z > 10) g.position.z -= g.userData.sp; });
      moon.position.x = 45 + Math.sin(t / 9000) * 4;
      if (cloudG && cloudG.visible) cloudG.children.forEach(function (c) { c.position.x += c.userData.v * dt; if (c.position.x > 240) c.position.x = -240; var dx = Math.abs(c.position.x - moon.position.x) / (c.scale.x * 0.5 + 40), dy = Math.abs(c.position.y - moon.position.y) / (c.scale.y * 0.5 + 40); c.material.opacity = Math.min(0.88, 0.1 + Math.max(dx, dy) * 0.8); });
      // pemain
      var tx2 = laneX(st.lane); st.x += (tx2 - st.x) * Math.min(1, dt * 15);
      if (st.y > 0 || st.vy > 0) { st.vy -= 26 * dt; st.y += st.vy * dt; if (st.y <= 0) { st.y = 0; st.vy = 0; } }
      st.slideT = Math.max(0, st.slideT - dt);
      player.position.set(st.x, st.y, 0);
      var ph = st.runT, sl = st.slideT > 0, air = st.y > 0.02, hurt = st.stumbleT > 0, B = limbs.body, P = st.pose;
      var sn = Math.sin(ph), k = Math.min(1, dt * 20), tg;
      if (sl) tg = { l: 1.35, r: 1.35, al: -0.7, ar: -0.7, bx: 0.95, by: -0.3, bz: 0 };
      else if (air) tg = { l: 0.7, r: -0.45, al: 2.3, ar: 2.3, bx: -0.12, by: 0, bz: 0 };
      else if (hurt) { var hs = Math.sin(ph) * 0.35; tg = { l: hs, r: -hs, al: 1.5 + sn * 0.25, ar: 1.5 - sn * 0.25, bx: 0.3, by: -0.06, bz: 0 }; }
      else { var amp = 0.5 + 0.35 * st.speedMul, dip = 0.5 * (1 - Math.cos(amp * sn)) * 0.7; tg = { l: amp * sn, r: -amp * sn, al: -amp * sn * 1.05, ar: amp * sn * 1.05, bx: -0.16, by: -dip, bz: sn * 0.04 }; }
      for (var key in tg) P[key] += (tg[key] - P[key]) * k;
      var lean = Math.max(-0.3, Math.min(0.3, (tx2 - st.x) * -0.18)); // miring halus saat pindah jalur
      limbs.lL.rotation.x = P.l; limbs.lR.rotation.x = P.r; limbs.aL.rotation.x = P.al; limbs.aR.rotation.x = P.ar;
      B.scale.set(1.15, 1.15, 1.15); B.rotation.x = P.bx; B.rotation.z = lean + P.bz; B.rotation.y = P.bz * 1.5;
      B.position.set(0, P.by + 0.67 * (1 - Math.cos(P.bx)), -0.67 * Math.sin(P.bx)); // memutar badan di pinggul, bukan di kaki
      limbs.shadow.position.y = -st.y + 0.02; limbs.shadow.scale.setScalar(1 - Math.min(0.5, st.y * 0.2));
      player.visible = st.invul > 0 ? Math.floor(t / 80) % 2 === 0 : true;
      // obstacle & koin
      var runningWorld = st.phase === "q" || st.phase === "fb" || st.phase === "count";
      if (runningWorld && !st.gateSpawned && st.phase !== "fb" && (!TUT || TUT_STEPS[st.tutStep] && TUT_STEPS[st.tutStep].spawn)) {
        st.obsT -= dt; if (st.obsT <= 0) { if (TUT) { var sp = TUT_STEPS[st.tutStep].spawn; mkObstacle(sp, st.lane, -90); mkCoin(st.lane, -84); st.obsT = 3.2; } else { spawnPattern(); st.obsT = 1.3 + Math.random() * 0.9; } }
      } else if (st.gateSpawned) st.obsT = 1.6;
      world.obs.forEach(function (o) {
        o.g.position.z += v * dt;
        if (o.dying) { o.g.scale.multiplyScalar(0.82); if (o.g.scale.x < 0.05) o.rm = true; }
        if (!o.hit && !o.dying && o.g.position.z > -0.55 && o.g.position.z < 0.55 && o.lane === st.lane) {
          var hitIt = o.type === "hurdle" ? st.y < 0.62 : o.type === "beam" ? st.slideT <= 0 : st.y < 1.45;
          if (hitIt) { o.hit = true; if (st.invul <= 0) { st.invul = 1.7; st.stumbleT = 1.3; sfx.bump(); shake(); burst(st.x, 0.8, 0, 0xff6b9a, 10); } }
        }
        if (o.g.position.z > 9) o.rm = true;
      });
      world.coins.forEach(function (c) {
        c.m.position.z += v * dt; c.m.rotation.y += dt * 4;
        if (c.dying) { c.m.scale.multiplyScalar(0.8); if (c.m.scale.x < 0.05) c.rm = true; }
        if (!c.got && !c.dying && c.lane === st.lane && Math.abs(c.m.position.z) < 0.7 && Math.abs(c.m.position.y - (st.y + 1.0)) < 1.1) { c.got = true; c.rm = true; st.energy++; $("rgE").textContent = "✨ " + st.energy; sfx.coin(); burst(c.m.position.x, c.m.position.y, 0, 0xffd166, 5); }
        if (c.m.position.z > 9) c.rm = true;
      });
      [world.obs, world.coins].forEach(function (arr) { for (var i = arr.length - 1; i >= 0; i--) if (arr[i].rm) { var o = arr[i]; scene.remove(o.g || o.m); arr.splice(i, 1); } });
      // gerbang
      for (var gi = world.gates.length - 1; gi >= 0; gi--) {
        var g = world.gates[gi]; g.g.position.z += (g === st.gate && st.phase === "q" ? gv * (st.rawDt || dt) : v * dt); // gerbang ikut melambat saat menabrak → waktu terbuang; tetap pakai waktu nyata agar tidak terpengaruh FPS rendah
        if (g === st.gate && !g.done && g.g.position.z >= 0.2 && st.phase === "q" && !st.locked) onGatePass();
        if (g.g.position.z > 12) { scene.remove(g.g); world.gates.splice(gi, 1); if (st.gate === g) st.gate = null; }
      }
      // partikel
      for (var pi = parts.length - 1; pi >= 0; pi--) {
        var p = parts[pi]; p.t -= dt; p.vy -= 18 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.m.material.opacity = Math.max(0, p.t / 0.9);
        if (p.t <= 0 || p.m.position.y < 0) { scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); parts.splice(pi, 1); }
      }
      // kamera
      var b = cam.userData.base; cam.position.x += (st.x * 0.35 - cam.position.x) * Math.min(1, dt * 8); cam.position.y += (b.y + Math.min(0.4, st.y * 0.15) - cam.position.y) * Math.min(1, dt * 8); cam.position.z = b.z; cam.lookAt(st.x * 0.2, 0.5, b.tz);
      markLane(false);
    }
    function tick(t) {
      if (st.destroyed) return; raf = requestAnimationFrame(tick);
      var raw = (t - last) / 1000 || 0.016, dt = Math.min(0.05, raw); st.rawDt = Math.min(0.25, raw); last = t;
      if (!st.paused) update(dt); R.render(scene, cam);
    }

    /* ---------- hitung mundur & mulai ---------- */
    async function countdown() {
      st.phase = "count"; if (!TUT) { for (var n = 3; n >= 1; n--) { msg(String(n), "", 0); sfx.cd(); await sleep(850); if (st.destroyed) return; } msg("GO!", "ok"); sfx.go(); }
      if (!TUT && cfg.fresh && host.begin) { try { var b = await host.begin(); if (b && b.remaining != null) { qTime = Math.max(qTime, 0); } } catch (e) {} }
      if (st.destroyed) return;
      showQuestion(st.cur, cfg.remaining != null ? Math.max(0, cfg.remaining - (performance.now() - t0)) : qTime);
      if (TUT) { st.tutStep = 0; showTut(); }
    }

    /* ---------- pasang ---------- */
    var onResize = function () { fitHud(); if (R) sizeCam(); }, ro = null, tmo = null;
    try { tmo = new MutationObserver(function () { applyTheme(); }); tmo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) {}
    try { if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe($("rgStage")); } } catch (e) {}
    $("rgSnd").onclick = function () { ac(); toggleSnd(); }; $("rgPause").onclick = togglePause; $("rgR").onclick = callGate;
    $("rgTg").onclick = function () { root.classList.toggle("min"); $("rgTg").textContent = root.classList.contains("min") ? "Tampilkan pilihan ▼" : "Sembunyikan pilihan ▲"; fitHud(); };
    $("rgI").onclick = function (e) { var t = e.target; if (!t || t.tagName !== "IMG") return; var lb = el("div", "rg-lb"), im = el("img"); im.src = t.src; lb.appendChild(im); lb.onclick = function () { lb.remove(); }; root.appendChild(lb); };
    window.addEventListener("keydown", onKey); window.addEventListener("resize", onResize); document.addEventListener("visibilitychange", onVis);
    root.addEventListener("touchstart", onTS, { passive: true }); root.addEventListener("touchmove", onTM, { passive: false }); root.addEventListener("touchend", onTE);
    root.addEventListener("pointerdown", function () { ac(); }, { once: true }); ac();

    var ctrl = {
      state: st,
      destroy: function () {
        if (st.destroyed) return; st.destroyed = true; cancelAnimationFrame(raf); try { ro && ro.disconnect(); tmo && tmo.disconnect(); } catch (e) {}
        window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis);
        try { if (R) { R.dispose(); R.forceContextLoss && R.forceContextLoss(); } } catch (e) {} root.remove();
      },
    };
    loadThree().then(function () {
      T = window.THREE; if (st.destroyed) return; initGL(); var ld = $("rgLd"); if (ld) ld.remove(); renderQ(); last = performance.now(); raf = requestAnimationFrame(tick); countdown();
    }).catch(function (e) {
      var ld = $("rgLd"); if (ld) { ld.innerHTML = ""; var d = el("div"); d.textContent = e.message || "Gagal memulai game."; var b = el("button", "rg-ready"); b.textContent = "Kembali"; b.onclick = function () { host.exit && host.exit(); }; ld.appendChild(d); ld.appendChild(b); }
    });
    return ctrl;
  }
  window.AsterionGame = { play: play };
})();
