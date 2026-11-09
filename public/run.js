/* ASTERION RUN — halaman mahasiswa + panel admin.
   Dimuat sebelum skrip utama index.html; memakai $, esc, api, S, toast milik halaman utama. */
(function () {
  "use strict";
  var RS = { route: 0, cats: null, set: null, game: null, rv: null, imp: null };
  var LET = ["A", "B", "C", "D", "E"], CSSC = ["#b18cff", "#4cc9f0", "#4ade80", "#fbbf24", "#ff6b9a"];
  var g = function (i) { return document.getElementById(i); };
  var rapi = function (p, o) { return api("run/" + p, o); };
  var pct = function (x) { return (Math.round((x || 0) * 10) / 10).toString().replace(".", ",") + "%"; };
  var fdur = function (ms) { var s = Math.round((ms || 0) / 1000), m = Math.floor(s / 60); return m + ":" + String(s % 60).padStart(2, "0"); };
  var fdate = function (t) { return t ? new Date(t).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; };
  var alive = function (k) { return RS.route === k && g("rr"); };
  var setRR = function (h) { var e = g("rr"); if (e) e.innerHTML = h; };
  var medal = function (r) { return r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "#" + r; };
  var nmOf = function (u) { return (window.MHS || {})[String(u || "").toUpperCase()] || u; };
  var tag = function (t, c) { return "<span class='tag " + (c || "") + "'>" + t + "</span>"; };

  var CSS = "a.btn{display:inline-block;text-decoration:none;text-align:center}.btn.d{background:rgba(239,68,68,.35);color:#fff;border:1px solid var(--line)}.btn.sm{padding:7px 12px;font-size:12px;margin-top:6px}" +
    ".rn-hero{border-radius:24px;padding:20px 18px;margin:6px 0 14px;text-align:center;background:linear-gradient(135deg,rgba(177,140,255,.28),rgba(245,192,74,.14));border:1px solid rgba(245,192,74,.4)}" +
    ".rn-hero h1{font-size:clamp(26px,8vw,40px);margin:0 0 4px}.rn-hero p{margin:6px 0 12px;color:var(--mut);font-size:13px;line-height:1.5}" +
    ".rn-row{display:flex;flex-wrap:wrap;gap:8px}.rn-row>*{flex:1;min-width:130px}" +
    ".rn-cat{padding:14px}.rn-cat b{font-size:16px}.rn-cat .mt{margin:8px 0}.rn-me{font-size:12px;color:var(--gold);margin:4px 0 8px}" +
    ".rn-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:12px 0}.rn-st{border-radius:16px;padding:12px 8px;text-align:center}.rn-st b{display:block;font-size:22px}.rn-st small{color:var(--mut);font-size:11px}" +
    ".rn-big{text-align:center;padding:22px 10px}.rn-big .sc{font:900 54px Cinzel,serif;background:linear-gradient(180deg,#fff,var(--gold));-webkit-background-clip:text;background-clip:text;color:transparent}.rn-big small{color:var(--mut)}" +
    ".rn-lb{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;margin-bottom:6px}.rn-lb.me{box-shadow:0 0 0 2px rgba(245,192,74,.7)}.rn-lb .r{width:38px;text-align:center;font-weight:700;color:var(--gold)}.rn-lb .n{flex:1;min-width:0}.rn-lb .n small{display:block;color:var(--mut);font-size:11px}.rn-lb .v{text-align:right;font-weight:700}.rn-lb .v small{display:block;color:var(--mut);font-weight:400;font-size:11px}" +
    ".rn-rv{border-radius:20px;padding:14px;margin-bottom:12px}.rn-rv .q{white-space:pre-line;line-height:1.5;margin:6px 0 10px;overflow-wrap:anywhere}.rn-rv img{max-width:100%;border-radius:10px;background:#fff;margin-bottom:8px}" +
    ".rn-op{display:flex;gap:8px;padding:8px 10px;border-radius:12px;margin-bottom:5px;background:rgba(255,255,255,.06);border:1px solid transparent;font-size:14px;line-height:1.4;overflow-wrap:anywhere}.rn-op b{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;color:#161222;font-size:12px}" +
    ".rn-op.key{border-color:var(--ok);background:rgba(74,222,128,.14)}.rn-op.bad{border-color:var(--bad);background:rgba(248,113,113,.14)}.rn-op i{margin-left:auto;font-style:normal;font-size:11px;white-space:nowrap;padding-left:6px}" +
    ".rn-ex{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(245,192,74,.1);border:1px solid rgba(245,192,74,.35);font-size:13px;line-height:1.5;white-space:pre-line}.rn-ex.no{color:var(--mut);background:rgba(255,255,255,.05);border-color:var(--line)}" +
    ".rn-nums{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}.rn-nums button{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.08);color:#fff;font-size:12px;cursor:pointer}.rn-nums .ok{background:rgba(74,222,128,.3)}.rn-nums .no{background:rgba(248,113,113,.3)}.rn-nums .bl{background:rgba(148,163,184,.3)}.rn-nums .cur{outline:2px solid var(--gold)}" +
    ".rn-hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.rn-hd .sp{flex:1}.rn-s-ok{color:var(--ok)}.rn-s-warn{color:var(--warn)}.rn-s-bad{color:var(--bad)}" +
    ".rn-it{border-radius:18px;padding:12px;margin-bottom:10px;border-left:5px solid var(--ok)}.rn-it.warn{border-left-color:var(--warn)}.rn-it.bad{border-left-color:var(--bad)}.rn-it.off{opacity:.55}" +
    ".rn-it .q{white-space:pre-line;font-size:14px;line-height:1.45;margin:6px 0;overflow-wrap:anywhere}.rn-it .o{font-size:13px;line-height:1.4;padding:3px 0;overflow-wrap:anywhere}.rn-it .o.k{color:var(--ok);font-weight:700}" +
    ".rn-ed textarea,.rn-ed input[type=text],.rn-ed select{width:100%;padding:9px;border-radius:10px;border:1px solid var(--line);background:rgba(10,6,28,.5);color:#fff;font:400 14px Inter,sans-serif;margin:3px 0}.rn-ed .k{display:flex;gap:6px;align-items:flex-start}.rn-ed .k input[type=radio]{margin-top:14px;accent-color:#f5c04a}" +
    ".rn-bar{position:sticky;bottom:78px;z-index:20;border-radius:16px;padding:10px 12px;margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:rgba(26,18,48,.92)}.rn-bar .t{flex:1;font-size:12px;min-width:140px}" +
    ".rn-prog{height:8px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden;margin:8px 0}.rn-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#b18cff,#f5c04a);transition:width .2s}" +
    ".rn-tb{width:100%;border-collapse:collapse;font-size:12px}.rn-tb th,.rn-tb td{padding:7px 6px;border-bottom:1px solid rgba(255,255,255,.12);text-align:left;vertical-align:top}.rn-tb th{color:var(--gold);font-weight:600}.rn-sc{overflow-x:auto}" +
    ".rn-tg{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:13px}.rn-tg input{width:auto}" +
    ".rn-nk{padding:12px 14px;margin:0 0 12px}.rn-nk.ask{border:1px solid rgba(245,192,74,.6);background:linear-gradient(135deg,rgba(245,192,74,.16),rgba(177,140,255,.14))}.rn-nk input.in{margin:8px 0 4px}" +
    ".rn-qo{width:100%;text-align:left;color:#fff;cursor:pointer;font-family:inherit;margin-bottom:8px;padding:12px}.rn-qo:hover:not(:disabled){border-color:var(--gold)}.rn-qo:disabled{cursor:default;color:#fff;opacity:1}.rn-qo.ok{border-color:var(--ok);background:rgba(74,222,128,.22)}.rn-qo.no{border-color:var(--bad);background:rgba(248,113,113,.22)}.rn-qo.sel{border-color:var(--gold);background:rgba(245,192,74,.16)}" +
    ".rn-qz .q{white-space:pre-line;line-height:1.55;font-size:15px;margin:10px 0 14px;overflow-wrap:anywhere}.rn-qz img{max-width:100%;border-radius:10px;background:#fff;margin-bottom:10px}.rn-qt{font:700 18px Inter,sans-serif;font-variant-numeric:tabular-nums}.rn-qt.low{color:var(--bad)}.rn-qo.key{border-color:var(--ok);background:rgba(74,222,128,.14)}.rn-qf{text-align:center;font-weight:700;margin:6px 0;min-height:22px}" +
    ".rn-exo{flex:1 0 100%;margin-top:6px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.08);font-size:12px;line-height:1.45;white-space:pre-line;color:var(--mut);text-align:left;font-weight:400}" +
    ".rn-op,.rn-qo{flex-wrap:wrap}.rn-pf input.in{margin:6px 0;padding:9px;border-radius:10px;border:1px solid var(--line);background:rgba(10,6,28,.5);color:#fff;font:400 15px Inter,sans-serif}" +
    ".ex-hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.ex-hd .sp{flex:1}" +
    ".ex-nums{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}.ex-nums button{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.08);color:#fff;font-size:12px;cursor:pointer;font-family:inherit}" +
    ".ex-nums .ans{background:rgba(74,222,128,.35);border-color:var(--ok)}.ex-nums .flg{box-shadow:inset 0 0 0 2px var(--warn);color:var(--warn);font-weight:700}.ex-nums .cur{outline:2px solid var(--gold)}" +
    ".rn-qo.pick{border-color:var(--gold);background:rgba(245,192,74,.18)}.rn-flag{border-color:var(--warn);color:var(--warn)}";
  (function () { var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); })();

  function errBox(r) {
    if (r && r.s === 503) return "<div class='pn g'><b>⚙️ Database belum dipasang</b><div class='hint'>ASTERION RUN memakai Cloudflare D1 (binding <code>DB</code>). Admin: ikuti <b>PANDUAN.md</b> (buat database, jalankan migrasi, pasang binding, deploy ulang). Fitur lain ASTERION tetap berjalan normal.</div></div>";
    return "<div class='pn g empty'>" + esc((r && r.j && r.j.err) || "Gagal memuat. Coba lagi.") + "</div>";
  }
  function destroyGame() { if (RS.game) { try { RS.game.destroy(); } catch (e) {} RS.game = null; document.body.style.overflow = ""; } }
  window.addEventListener("hashchange", function () { if (RS.game && !/^#\/run\/(play|tutorial)/.test(location.hash)) destroyGame(); if (RS.quiz && !/^#\/run\/quiz/.test(location.hash)) quizStop(); if (RS.exam && !/^#\/run\/exam/.test(location.hash)) examStop(); });
  function loadGameLib() { return window.AsterionGame ? Promise.resolve() : window.AsterionPdf && 0 ? 0 : new Promise(function (res, rej) { var s = document.createElement("script"); s.src = "run-game.js"; s.onload = res; s.onerror = function () { rej(new Error("run-game.js tidak ditemukan")); }; document.head.appendChild(s); }); }
  function loadPdfLib() { return window.AsterionPdf ? Promise.resolve() : new Promise(function (res, rej) { var s = document.createElement("script"); s.src = "run-pdf.js"; s.onload = res; s.onerror = function () { rej(new Error("run-pdf.js tidak ditemukan")); }; document.head.appendChild(s); }); }

  /* ======================= ROUTER ======================= */
  window.pRun = function (P) {
    var k = ++RS.route; setTimeout(function () { rRoute(P, k); }, 0);
    return "<div id='rr'><div class='empty'>Memuat…</div></div>";
  };
  async function rRoute(P, k) {
    var sub = P[1] || "";
    if (sub === "play") return startFlow(+P[2], k);
    if (sub === "tutorial") return tutorial(k);
    if (sub === "quiz") return quizFlow(+P[2], k);
    if (sub === "exam") return examFlow(+P[2], k);
    destroyGame(); quizStop(); examStop();
    try {
      if (sub === "") return await home(k);
      if (sub === "lb") return await lbPage(P[2] || "", P[3] || "all", k);
      if (sub === "hist") return await histPage(k);
      if (sub === "result") return await resultPage(P[2], k);
      if (sub === "review") return await reviewPage(P[2], k);
      if (sub === "admin") return S.admin ? await adminRoute(P, k) : (location.hash = "#/run");
      location.hash = "#/run";
    } catch (e) { if (e !== 0 && alive(k)) setRR("<div class='pn g empty'>Terjadi kesalahan: " + esc(e.message || e) + "</div>"); }
  }

  /* ======================= BERANDA ======================= */
  async function home(k) {
    var r = await rapi("cats"); if (!alive(k)) return; if (!r.ok) return setRR(errBox(r));
    RS.cats = r.j.cats; RS.set = r.j.settings;
    var h = "<div class='rn-hero g'><h1>ASTERION RUN</h1><div class='yr' style='color:var(--gold);letter-spacing:.35em;font-size:11px'>3D · EDUKASI · KEDOKTERAN</div><p>Berlari di lintasan lima jalur dan jawab soal dengan melewati gerbang <b>A–E</b> — atau pilih <b>Mode Soal</b> kalau mau langsung mengerjakan soal tanpa game. Skor: benar +1, salah/kosong 0. Waktu <b>per soal</b>. Setelah selesai, kamu mendapat pembahasan semua soal.</p>" +
      "<div class='rn-row'><a class='btn s' href='#/run/lb/global'>🌍 Leaderboard global</a><a class='btn s' href='#/run/hist'>🕘 Riwayat</a><a class='btn s' href='#/run/tutorial'>🎮 Tutorial</a>" + (S.admin ? "<a class='btn' href='#/run/admin'>⚙️ Panel Admin</a>" : "") + "</div></div>";
    RS.nick = r.j.nick; RS.prefs = r.j.prefs;
    h += nickBar() + prefsBar() + "<div class='sec'>PILIH KATEGORI</div>";
    if (!RS.cats.length) h += "<div class='pn g empty'>Belum ada kategori." + (S.admin ? " Buat di Panel Admin." : "") + "</div>";
    RS.cats.forEach(function (c) {
      var can = c.aq > 0 && (c.active || S.admin);
      h += "<div class='pn g rn-cat'><div class='rn-hd'><b>" + esc(c.name) + "</b>" + (c.active ? "" : tag("Nonaktif", "warn")) + "</div>" + (c.descr ? "<div class='hint' style='margin:4px 0'>" + esc(c.descr) + "</div>" : "") +
        "<div class='mt'>" + tag("📝 " + c.aq + " soal aktif") + tag("🎯 " + c.play + " soal dimainkan") + tag("⏱ " + c.q_time + " dtk/soal") + tag("👥 " + c.players + " pemain") + "</div>" +
        (c.me ? "<div class='rn-me'>Terbaikmu: <b>" + c.me.score + "/" + c.me.total + "</b> (" + pct(c.me.acc) + ") · peringkat <b>#" + c.me.rank + "</b></div>" : "<div class='rn-me' style='color:var(--mut)'>Kamu belum pernah bermain di kategori ini.</div>") +
        "<div class='rn-row'>" + (can ? modeBtns(c) : "<button class='btn' disabled style='opacity:.5'>Belum ada soal aktif</button>") +
        "<a class='btn s' href='#/run/lb/" + c.id + "'>🏆 Leaderboard</a></div></div>";
    });
    setRR(h);
  }

  // tiga mode per kategori: 🎮 game 3D, 📝 mode soal (pembahasan langsung), 🎓 simulasi ujian (jawaban muncul di akhir).
  // Sesi yang tersimpan hanya bisa dilanjutkan pada mode yang sama.
  function modeBtns(c) {
    var rs = c.resume, rm = rs ? rs.mode || "game" : "", prog = rs ? " (" + rs.cur + "/" + rs.total + ")" : "";
    var NM = { game: "game", quiz: "Mode Soal", exam: "Simulasi Ujian" };
    var warn = function (m) { return rs && rm !== m ? " data-warn='Ada sesi " + (NM[rm] || rm) + " yang belum selesai" + prog + " di kategori ini. Mulai sesi baru dengan mode lain? Sesi lama akan dibatalkan.'" : ""; };
    return "<button class='btn' data-ra='go-mode' data-href='#/run/play/" + c.id + "'" + warn("game") + ">" + (rm === "game" ? "▶ Lanjutkan game" + prog : "🎮 Main game") + "</button>" +
      "<button class='btn s' data-ra='go-mode' data-href='#/run/quiz/" + c.id + "'" + warn("quiz") + ">" + (rm === "quiz" ? "▶ Lanjutkan soal" + prog : "📝 Mode Soal") + "</button>" +
      "<button class='btn s' data-ra='go-mode' data-href='#/run/exam/" + c.id + "'" + warn("exam") + ">" + (rm === "exam" ? "▶ Lanjutkan ujian" + prog : "🎓 Simulasi Ujian") + "</button>" +
      (rs ? "<button class='btn s' data-ra='cat-reset' data-cid='" + c.id + "' data-mode='" + rm + "' title='Ulang dari soal 1'>🔄 Reset" + prog + "</button>" : "");
  }

  /* ======================= PENGATURAN PRIBADI (jumlah soal) ======================= */
  function prefsBar() {
    var pf = RS.prefs || { per_session: 0 };
    return "<div class='pn g rn-pf' id='rnPf'><div class='rn-hd'><b>⚙️ Jumlah soal sekali main</b><span class='sp'></span><span class='hint' style='margin:0'>khusus akunmu</span></div>" +
      "<div class='hint' style='margin:6px 0'>Atur sendiri berapa soal yang ingin dikerjakan setiap sesi (game, mode soal, maupun ujian). Isi <b>0</b> untuk mengikuti pengaturan kategori. Soal tidak diulang sampai bank soal kategori habis.</div>" +
      "<div class='rn-row'><input id='rnPfN' class='in' type='number' min='0' max='500' inputmode='numeric' value='" + (pf.per_session || 0) + "' style='flex:1;min-width:90px'>" +
      "<button class='btn sm' id='rnPfS' data-ra='pf-save' style='flex:none;min-width:110px'>💾 Simpan</button></div></div>";
  }
  async function savePrefs() {
    var el = g("rnPfN"); if (!el) return; var n = parseInt(el.value, 10);
    if (!isFinite(n) || n < 0 || n > 500) { toast("Jumlah soal harus 0–500."); return; }
    var r = await rapi("prefs", { m: "POST", b: { per_session: n } });
    if (!r.ok) { toast((r.j && r.j.err) || "Gagal menyimpan"); return; }
    RS.prefs = r.j; toast(n > 0 ? "Jumlah soal per sesi: " + n : "Mengikuti pengaturan kategori");
  }

  /* ======================= NAMA SAMARAN LEADERBOARD ======================= */
  function nickBar(ask) {
    if (S.admin) return "";
    return "<div class='pn g rn-nk" + (ask && !RS.nick ? " ask" : "") + "' id='rnNk'>" + nickInner(!RS.nick, ask) + "</div>";
  }
  function nickInner(edit, ask) {
    if (!edit) return "<div class='rn-hd'><span>Nama di leaderboard: <b>" + esc(RS.nick) + "</b></span><span class='sp'></span><button class='btn s sm' data-ra='nick-edit'>✏️ Ubah</button></div><div class='hint' style='margin:4px 0 0'>Boleh nama samaran bebas. Kalau diganti, nama di semua leaderboard (termasuk yang lama) ikut berubah.</div>";
    return "<b>" + (RS.nick ? "Ubah nama leaderboard" : ask ? "🎉 Satu langkah lagi — beri nama untuk leaderboard" : "Pilih nama untuk leaderboard") + "</b><div class='hint' style='margin:4px 0 0'>2–20 karakter, boleh nama samaran. Nama ini yang dilihat teman-temanmu.</div>" +
      "<input id='rnNkI' class='in' maxlength='20' autocomplete='off' placeholder='mis. Dokter Bintang' value=\"" + esc(RS.nick || "") + "\"><div class='rn-row'><button class='btn sm' data-ra='nick-save'>Simpan</button>" + (RS.nick ? "<button class='btn s sm' data-ra='nick-cancel'>Batal</button>" : "") + "</div>";
  }

  /* ======================= GAME ======================= */
  async function ensureSettings() { if (!RS.set) { var r = await rapi("settings"); RS.set = r.ok ? r.j : {}; } }
  async function startFlow(cid, k) {
    destroyGame(); setRR("<div class='empty'>Menyiapkan permainan…</div>");
    try {
      await ensureSettings(); await loadGameLib();
      var done = false; try { done = localStorage.getItem("runTut:" + S.u) === "1"; } catch (e) {}
      if (!done) { await runTutorial(); if (RS.route !== k) return; }
      var r = await rapi("start", { m: "POST", b: { cat: cid, mode: "game" } }); if (RS.route !== k) return;
      if (!r.ok) { toast((r.j && r.j.err) || "Gagal memulai"); location.replace("#/run"); return; }
      var p = r.j;
      if (p.adjusted) toast("Soal aktif hanya " + p.total + " (target " + p.requested + "): sesi disesuaikan.");
      if (p.paused) { var rr = await rapi("resume", { m: "POST", b: { sid: p.sid } }); if (rr.ok) p.remaining = rr.j.remaining; }
      launch(p);
    } catch (e) { if (e !== 0) { toast(e.message || "Gagal memulai game"); location.replace("#/run"); } }
  }
  function launch(p) {
    var sid = p.sid;
    document.body.style.overflow = "hidden";
    RS.game = AsterionGame.play({
      qs: p.qs, cur: p.cur, score: p.score, qTime: p.q_time, remaining: p.status === "active" ? p.remaining : null, fresh: p.status === "ready", settings: RS.set,
      host: {
        begin: function () { return rapi("begin", { m: "POST", b: { sid: sid } }).then(function (r) { return r.j; }); },
        answer: function (idx, ans) { return rapi("answer", { m: "POST", b: { sid: sid, idx: idx, ans: ans } }).then(function (r) { return { ok: r.ok, status: r.s, j: r.j || {} }; }); },
        pause: function () { return rapi("pause", { m: "POST", b: { sid: sid } }); },
        resume: function () { return rapi("resume", { m: "POST", b: { sid: sid } }).then(function (r) { return r.j; }); },
        resync: function () { return rapi("session?sid=" + sid).then(function (r) { return r.ok ? r.j : null; }); },
        done: function () { destroyGame(); location.replace("#/run/result/" + sid); },
        exit: function () { destroyGame(); location.replace("#/run"); },
        toast: toast,
      },
    });
  }
  function runTutorial() {
    return new Promise(function (res) {
      var fin = function () { try { localStorage.setItem("runTut:" + S.u, "1"); } catch (e) {} destroyGame(); res(); };
      document.body.style.overflow = "hidden";
      RS.game = AsterionGame.play({
        tutorial: true, qTime: 60, settings: RS.set || {}, cur: 0, score: 0,
        qs: [{ idx: 0, q: "Latihan: arahkan karaktermu melewati gerbang C, lalu lihat efek jawaban benar/salah.", o: { A: "Gerbang paling kiri", B: "Gerbang kedua", C: "Gerbang tengah (jawaban latihan)", D: "Gerbang keempat", E: "Gerbang paling kanan" }, img: "" }],
        host: { answer: function () { return Promise.resolve({ ok: true, j: {} }); }, done: fin, exit: fin, toast: toast },
      });
    });
  }
  async function tutorial(k) {
    setRR("<div class='empty'>Memuat tutorial…</div>");
    try { await ensureSettings(); await loadGameLib(); await runTutorial(); } catch (e) { toast(e.message || "Gagal"); }
    if (RS.route === k) location.replace("#/run");
  }

  /* ======================= MODE SOAL (tanpa game) =======================
     Memakai sesi, timer per soal, dan penilaian yang sama persis dengan game (server yang menilai), hanya tampilannya berupa halaman soal biasa.
     Skor ikut leaderboard. Setelah tiap soal dijawab, kunci & pembahasan langsung tampil; timer soal berikutnya mulai saat pemain menekan Lanjut. */
  function quizStop() { var Q = RS.quiz; if (!Q) return; clearInterval(Q.tm); clearTimeout(Q.fb); document.removeEventListener("keydown", Q.kd); RS.quiz = null; }
  async function quizFlow(cid, k) {
    quizStop(); destroyGame(); setRR("<div class='empty'>Menyiapkan soal…</div>");
    try {
      await ensureSettings();
      var r = await rapi("start", { m: "POST", b: { cat: cid, mode: "quiz" } }); if (RS.route !== k) return;
      if (!r.ok) { toast((r.j && r.j.err) || "Gagal memulai"); location.replace("#/run"); return; }
      var p = r.j;
      if (p.adjusted) toast("Soal aktif hanya " + p.total + " (target " + p.requested + "): sesi disesuaikan.");
      var Q = RS.quiz = { k: k, cid: cid, sid: p.sid, name: "", qs: p.qs, total: p.total, qTime: p.q_time * 1000, cur: p.cur, score: p.score, hist: {}, view: null, dl: 0, busy: false, paused: false, tm: 0, fb: 0, kd: null };
      Q.kd = function (e) { if (!RS.quiz || RS.quiz !== Q || e.ctrlKey || e.metaKey || e.altKey) return; var t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return; if (Q.review && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); if (Q.view == null) quizNext(); return; } var L = String(e.key || "").toUpperCase(); if (LET.indexOf(L) >= 0 && !Q.review) quizAnswer(L); };
      document.addEventListener("keydown", Q.kd);
      var c = (RS.cats || []).filter(function (x) { return x.id === cid; })[0]; Q.name = c ? c.name : "";
      if (p.status === "ready") {
        setRR("<div class='rn-hero g'><h1 style='font-size:clamp(22px,6vw,30px)'>📝 Mode Soal</h1><p>" + (Q.name ? "<b>" + esc(Q.name) + "</b><br>" : "") + p.total + " soal · <b>" + p.q_time + " detik</b> per soal · tanpa game.<br>Jawab dengan menekan pilihan A–E (di komputer bisa pakai tombol keyboard A–E). Setelah menjawab, kunci dan pembahasan langsung muncul; timer soal berikutnya mulai saat kamu menekan Lanjut.</p><div class='rn-row'><button class='btn' data-ra='qz-begin'>▶ Mulai</button><a class='btn s' href='#/run'>Kembali</a></div></div>");
        return;
      }
      var rem = p.remaining;
      if (p.paused) { var rr = await rapi("resume", { m: "POST", b: { sid: p.sid } }); if (RS.route !== k || RS.quiz !== Q) return; if (rr.ok) { if (rr.j.status === "done") { quizStop(); location.replace("#/run/result/" + p.sid); return; } Q.cur = rr.j.cur; Q.score = rr.j.score; rem = rr.j.remaining; } }
      Q.dl = performance.now() + (rem == null ? Q.qTime : rem); quizDraw(); quizTick();
    } catch (e) { if (e !== 0) { toast(e.message || "Gagal memulai"); location.replace("#/run"); } }
  }
  async function quizBegin() {
    var Q = RS.quiz; if (!Q) return;
    var r = await rapi("begin", { m: "POST", b: { sid: Q.sid } }); if (!RS.quiz || RS.quiz !== Q) return;
    if (!r.ok) { toast((r.j && r.j.err) || "Gagal memulai"); return; }
    Q.dl = performance.now() + (r.j.remaining == null ? Q.qTime : r.j.remaining); quizDraw(); quizTick();
  }
  function quizTick() {
    var Q = RS.quiz; if (!Q) return; clearInterval(Q.tm);
    Q.tm = setInterval(function () {
      if (RS.quiz !== Q || RS.route !== Q.k || !g("rr")) return quizStop();
      var rem = Q.dl - performance.now(), el = g("qzT"), bar = g("qzBar");
      if (el && !Q.paused && !Q.review) { el.textContent = "⏱ " + fdur(Math.max(0, rem)); el.className = "rn-qt" + (rem < 10000 ? " low" : ""); }
      if (bar && !Q.review) bar.style.width = Math.max(0, Math.min(100, rem / Q.qTime * 100)) + "%";
      if (rem <= 0 && !Q.busy && !Q.paused) quizAnswer(null);
    }, 150);
  }
  function quizDraw() {
    var Q = RS.quiz; if (!Q || RS.route !== Q.k || !g("rr")) return quizStop();
    var q = Q.qs[Q.cur]; if (!q) return;
    var h = "<div class='rn-qz'><div class='rn-hd'><b>Soal " + (Q.cur + 1) + "/" + Q.total + "</b><span class='tag'>Skor " + Q.score + "</span><span class='sp'></span><span class='rn-qt' id='qzT'></span></div>" +
      "<div class='rn-prog'><i id='qzBar' style='width:100%;transition:none'></i></div>" +
      "<div class='pn g' style='padding:14px'>" + String(q.img || "").split(",").filter(Boolean).map(function (id) { return "<img alt='Gambar soal' src='/api/run/img/" + encodeURIComponent(id) + "'>"; }).join("") + "<div class='q'>" + esc(q.q) + "</div>";
    LET.forEach(function (L, i) { if (!q.o[L]) return; h += "<button class='rn-op rn-qo' data-ra='qz-ans' data-v2='" + L + "'><b style='background:" + CSSC[i] + "'>" + L + "</b><span>" + esc(q.o[L]) + "</span></button>"; });
    h += "<div class='rn-qf' id='qzF'></div></div><div class='rn-row' style='margin-top:10px'>" + (RS.set && RS.set.pause ? "<button class='btn s sm' data-ra='qz-pause'>⏸ Jeda</button>" : "") + "<button class='btn s sm' data-ra='qz-reset'>🔄 Reset ujian</button><button class='btn s sm' data-ra='qz-exit'>✕ Keluar</button></div></div>";
    setRR(h); window.scrollTo(0, 0);
    var rem = Q.dl - performance.now(), el = g("qzT"); if (el) { el.textContent = "⏱ " + fdur(Math.max(0, rem)); el.className = "rn-qt" + (rem < 10000 ? " low" : ""); }
  }
  async function quizAnswer(ans) {
    var Q = RS.quiz; if (!Q || Q.busy || Q.paused || !g("qzT")) return; Q.busy = true;
    var idx = Q.cur, btns = [].slice.call(document.querySelectorAll("#rr .rn-qo"));
    btns.forEach(function (x) { x.disabled = true; if (x.dataset.v2 === ans) x.classList.add("sel"); });
    var r; try { r = await rapi("answer", { m: "POST", b: { sid: Q.sid, idx: idx, ans: ans } }); } catch (e) { if (e === 0) return; r = null; }
    if (!RS.quiz || RS.quiz !== Q) return;
    if (!r) { toast("Koneksi terputus. Coba lagi."); Q.busy = false; btns.forEach(function (x) { x.disabled = false; }); return; }
    if (!r.ok) return quizResync(Q, r);
    var j = r.j, t0 = performance.now(); Q.score = j.score;
    Q.hist[idx] = { q: Q.qs[idx], ans: ans, j: j }; Q.view = null;
    Q.review = j; quizShowRev(Q, idx); // timer soal berikutnya baru berjalan setelah "Lanjut" ditekan (server menahan sesi sampai resume)
  }
  function quizRevTag(Lt, key, ans) { var isKey = !!key && Lt === key, isMine = Lt === ans; return { cls: isKey ? "key" : isMine ? "bad" : "", tg: (isKey ? "<i class='rn-s-ok'>✔ KUNCI</i>" : "") + (isMine && !isKey ? "<i class='rn-s-bad'>✘ jawabanmu</i>" : isMine ? "<i>jawabanmu</i>" : "") }; }
  function quizRevInfo(x) { // kunci + status + pembahasan (sama dengan halaman pembahasan)
    var j = x.j, ans = x.ans, key = j.ans || "", stt = j.correct ? ["BENAR", "rn-s-ok", "+1"] : j.blank ? ["TIDAK DIJAWAB", "rn-s-warn", "0"] : ["SALAH", "rn-s-bad", "0"];
    var info = "<div class='hint' style='margin:8px 2px;text-align:left;font-weight:400'>Jawaban pemain: <b>" + (ans || "—") + "</b> · Kunci: <b class='rn-s-ok'>" + esc(key || "—") + "</b> · Status: <b class='" + stt[1] + "'>" + stt[0] + "</b> · Skor: <b>" + stt[2] + "</b></div>";
    var exH = j.explain ? (j.expl ? "<div class='rn-ex' style='text-align:left'><b>Pembahasan</b><br>" + esc(j.expl) + "</div>" : "<div class='rn-ex no' style='text-align:left'>Pembahasan belum tersedia untuk soal ini.</div>") : "";
    return info + exH;
  }
  function quizShowRev(Q, idx) { // tampilan setelah menjawab: opsi kunci hijau, jawaban salah merah
    var x = Q.hist[idx], j = x.j, key = j.ans || "", btns = [].slice.call(document.querySelectorAll("#rr .rn-qo")), f = g("qzF");
    btns.forEach(function (b) { var t = quizRevTag(b.dataset.v2, key, x.ans); b.disabled = true; b.classList.remove("sel", "ok", "no", "key", "bad"); if (t.cls) b.classList.add(t.cls); if (t.tg) b.insertAdjacentHTML("beforeend", t.tg); if (j.ex && j.ex[b.dataset.v2]) b.insertAdjacentHTML("beforeend", optEx(j.ex, b.dataset.v2)); });
    if (f) {
      var dn = Object.keys(Q.hist).map(Number).sort(function (a, b) { return a - b; });
      var jump = dn.length > 1 ? "<div class='rn-row' style='justify-content:center;margin-top:10px'><select id='qzJump' class='in' style='flex:1;max-width:240px;padding:9px;border-radius:10px;border:1px solid var(--line);background:rgba(10,6,28,.5);color:#fff;font:400 14px Inter,sans-serif'>" + dn.map(function (n) { return "<option value='" + n + "'" + (n === idx ? " selected" : "") + ">Ke nomor " + (n + 1) + "</option>"; }).join("") + "</select></div>" : "";
      f.style.textAlign = "center"; f.innerHTML = quizRevInfo(x) + jump + "<div class='rn-row' style='justify-content:center;margin-top:12px'>" + (idx > 0 ? "<button class='btn s' data-ra='qz-hp' data-v2='" + (idx - 1) + "'>‹ Soal sebelumnya</button>" : "") + "<button class='btn' data-ra='qz-next'>" + (j.done ? "Lihat hasil ▶" : "Lanjut ▶") + "</button></div>";
      var jj = g("qzJump"); if (jj) jj.addEventListener("change", function () { quizHist(+jj.value); });
      try { f.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
    }
    var tm = g("qzT"); if (tm) { tm.textContent = ""; tm.className = "rn-qt"; }
  }
  function quizHist(i) { // lihat soal sebelumnya (hanya baca); timer tetap ditahan karena soal sekarang sudah dijawab
    var Q = RS.quiz; if (!Q || !Q.review || Q.nexting) return; var x = Q.hist[i]; if (!x) return; Q.view = i; var q = x.q, key = x.j.ans || "";
    var h = "<div class='rn-qz'><div class='rn-hd'><b>Tinjau soal " + (i + 1) + "/" + Q.total + "</b><span class='sp'></span><span class='tag'>Skor " + Q.score + "</span></div><div class='pn g' style='padding:14px'>" + String(q.img || "").split(",").filter(Boolean).map(function (id) { return "<img alt='Gambar soal' src='/api/run/img/" + encodeURIComponent(id) + "'>"; }).join("") + "<div class='q'>" + esc(q.q) + "</div>";
    LET.forEach(function (L, k) { if (!q.o[L]) return; var t = quizRevTag(L, key, x.ans); h += "<div class='rn-op " + t.cls + "'><b style='background:" + CSSC[k] + "'>" + L + "</b><span>" + esc(q.o[L]) + "</span>" + t.tg + optEx(x.j.ex, L) + "</div>"; });
    h += quizRevInfo(x) + "<div class='rn-row' style='justify-content:center;margin-top:12px'>" + (i > 0 ? "<button class='btn s' data-ra='qz-hp' data-v2='" + (i - 1) + "'>‹ Sebelumnya</button>" : "") + (i < Q.cur ? "<button class='btn s' data-ra='qz-hp' data-v2='" + (i + 1) + "'>Berikutnya ›</button>" : "") + "<button class='btn' data-ra='qz-hb'>↩ Kembali ke soal " + (Q.cur + 1) + "</button></div>" +
      "<div class='rn-row' style='justify-content:center;margin-top:8px'><select id='qzJump2' class='in' style='flex:1;max-width:260px;padding:9px;border-radius:10px;border:1px solid var(--line);background:rgba(10,6,28,.5);color:#fff;font:400 14px Inter,sans-serif'>" + Object.keys(Q.hist).map(Number).sort(function (a, b) { return a - b; }).map(function (n) { return "<option value='" + n + "'" + (n === i ? " selected" : "") + ">Ke nomor " + (n + 1) + "</option>"; }).join("") + "</select></div></div></div>";
    setRR(h); window.scrollTo(0, 0);
    var j2 = g("qzJump2"); if (j2) j2.addEventListener("change", function () { quizHist(+j2.value); });
  }
  function quizBack() { var Q = RS.quiz; if (!Q || !Q.review || Q.view == null) return; Q.view = null; quizDraw(); quizShowRev(Q, Q.cur); }
  async function quizNext() {
    var Q = RS.quiz; if (!Q || !Q.review || Q.nexting) return; var j = Q.review;
    if (j.done) { quizStop(); location.replace("#/run/result/" + Q.sid); return; }
    Q.nexting = true;
    var r; try { r = await rapi("resume", { m: "POST", b: { sid: Q.sid } }); } catch (e) { Q.nexting = false; if (e === 0) return; toast("Koneksi terputus. Coba lagi."); return; }
    if (!RS.quiz || RS.quiz !== Q) return; Q.nexting = false;
    if (!r.ok) { toast((r.j && r.j.err) || "Gagal melanjutkan"); return; }
    if (r.j.status === "done") { quizStop(); location.replace("#/run/result/" + Q.sid); return; }
    Q.review = null; Q.cur = r.j.cur; Q.score = r.j.score; Q.dl = performance.now() + (r.j.remaining == null ? Q.qTime : r.j.remaining); Q.busy = false; quizDraw();
  }
  async function quizResync(Q, r) { // jawaban ditolak: samakan dengan keadaan di server
    var msg = r.j && r.j.err;
    if (r.s === 400 && r.j && r.j.remaining) { Q.dl = performance.now() + r.j.remaining + 150; Q.busy = false; var bs = document.querySelectorAll("#rr .rn-qo"); [].forEach.call(bs, function (x) { x.disabled = false; x.classList.remove("sel"); }); return; } // jam server sedikit tertinggal
    var n = await rapi("session?sid=" + Q.sid); if (!RS.quiz || RS.quiz !== Q) return;
    if (!n.ok) { toast(msg || "Koneksi bermasalah. Coba lagi."); Q.busy = false; var bs2 = document.querySelectorAll("#rr .rn-qo"); [].forEach.call(bs2, function (x) { x.disabled = false; x.classList.remove("sel"); }); return; }
    if (n.j.status === "done") { quizStop(); location.replace("#/run/result/" + Q.sid); return; }
    Q.cur = n.j.cur; Q.score = n.j.score; Q.dl = performance.now() + (n.j.remaining == null ? Q.qTime : n.j.remaining); Q.busy = false; quizDraw();
  }
  async function quizPause() {
    var Q = RS.quiz; if (!Q || Q.busy || Q.paused) return; Q.paused = true;
    var r = await rapi("pause", { m: "POST", b: { sid: Q.sid } }); if (!RS.quiz || RS.quiz !== Q) return;
    if (!r.ok) { Q.paused = false; toast((r.j && r.j.err) || "Gagal menjeda"); return; }
    setRR("<div class='pn g rn-big'><div style='font-size:42px'>⏸</div><b>Dijeda</b><div class='hint'>Soal disembunyikan selama jeda. Satu jeda maksimal 5 menit — setelah itu waktu berjalan lagi.</div><button class='btn' data-ra='qz-resume' style='margin-top:10px'>▶ Lanjutkan</button></div>");
  }
  async function quizResume() {
    var Q = RS.quiz; if (!Q) return;
    var r = await rapi("resume", { m: "POST", b: { sid: Q.sid } }); if (!RS.quiz || RS.quiz !== Q) return;
    if (!r.ok) { toast((r.j && r.j.err) || "Gagal melanjutkan"); return; }
    if (r.j.status === "done") { quizStop(); location.replace("#/run/result/" + Q.sid); return; }
    Q.paused = false; Q.cur = r.j.cur; Q.score = r.j.score; Q.dl = performance.now() + (r.j.remaining == null ? Q.qTime : r.j.remaining); quizDraw();
  }
  async function quizReset() { // ulang dari awal: sesi sekarang dibatalkan (skor tidak dihitung), soal diacak ulang
    var Q = RS.quiz; if (!Q || Q.paused || Q.nexting) return;
    if (!confirm("Reset ujian? Semua jawaban di sesi ini dihapus dan kamu mulai lagi dari soal 1 (skor sesi ini tidak dihitung).")) return;
    var sid = Q.sid, cid = Q.cid, k = Q.k; Q.paused = true; // kunci layar selama proses reset
    var r; try { r = await rapi("abandon", { m: "POST", b: { sid: sid } }); } catch (e) { if (e === 0) return; r = null; }
    if (!RS.quiz || RS.quiz !== Q) return;
    if (!r || !r.ok) { Q.paused = false; toast((r && r.j && r.j.err) || "Gagal mereset. Coba lagi."); return; }
    quizFlow(cid, k);
  }
  async function quizExit() {
    var Q = RS.quiz; if (!Q) return;
    if (!confirm("Keluar dari sesi? Kamu bisa melanjutkannya nanti dari menu kategori." + (RS.set && RS.set.pause ? "" : " Perhatian: waktu soal yang sedang berjalan tetap berjalan."))) return;
    if (RS.set && RS.set.pause && !Q.paused && !Q.busy) { try { await rapi("pause", { m: "POST", b: { sid: Q.sid } }); } catch (e) {} }
    quizStop(); location.hash = "#/run";
  }

  /* ======================= HASIL & PEMBAHASAN ======================= */
  async function resultPage(sid, k) {
    var r = await rapi("result?sid=" + encodeURIComponent(sid)); if (!alive(k)) return; if (!r.ok) return setRR(errBox(r));
    var s = r.j.s, own = s.u === S.u && !S.admin; if (own) RS.nick = r.j.nick;
    var h = "<div class='sec'>HASIL</div>" + (own ? nickBar(true) : "") + "<div class='pn g rn-big'><small>" + (s.mode === "quiz" ? "📝 " : "🎮 ") + esc(s.cat_name) + (s.u !== S.u ? " · " + esc(nmOf(s.u)) + " (" + esc(s.u) + ")" + (r.j.nick ? " · “" + esc(r.j.nick) + "”" : "") : "") + "</small><div class='sc'>" + s.score + "<span style='font-size:26px'>/" + s.total + "</span></div><small>Akurasi " + pct(s.acc) + "</small></div>" +
      "<div class='rn-grid'><div class='rn-st g'><b class='rn-s-ok'>" + s.correct + "</b><small>Benar</small></div><div class='rn-st g'><b class='rn-s-bad'>" + s.wrong + "</b><small>Salah</small></div><div class='rn-st g'><b>" + s.blank + "</b><small>Kosong</small></div>" +
      "<div class='rn-st g'><b>" + pct(s.acc) + "</b><small>Akurasi</small></div><div class='rn-st g'><b>" + fdur(s.dur) + "</b><small>Durasi</small></div><div class='rn-st g'><b>" + (s.rank ? "#" + s.rank : "—") + "</b><small>Peringkat kategori</small></div></div>" +
      "<a class='card g' href='#/run/review/" + esc(s.id) + "'><span class='i'>📖</span><span class='t'>Lihat pembahasan " + s.total + " soal<small>Semua soal: benar, salah, dan tidak dijawab</small></span><span class='a'>›</span></a>" +
      "<a class='card g' href='#/run/lb/" + s.cat_id + "'><span class='i'>🏆</span><span class='t'>Leaderboard kategori</span><span class='a'>›</span></a>" +
      "<a class='card g' href='#/run/play/" + s.cat_id + "'><span class='i'>🔁</span><span class='t'>Main lagi</span><span class='a'>›</span></a><a class='card g' href='#/run'><span class='i'>🏠</span><span class='t'>Kembali ke ASTERION RUN</span><span class='a'>›</span></a>";
    setRR(h);
  }
  /* ======================= MODE SIMULASI UJIAN =======================
     Saat memilih jawaban, kunci & pembahasan TIDAK muncul. Jawaban boleh diubah, dinilai hanya setelah "Kumpulkan".
     Navigasi bebas: sebelumnya/berikutnya, lompat ke nomor mana pun, dan tandai soal (flag) untuk ditinjau. */
  var imgs = function (q) { return String(q.img || "").split(",").filter(Boolean).map(function (id) { return "<img alt='Gambar soal' src='/api/run/img/" + encodeURIComponent(id) + "'>"; }).join(""); };
  var optEx = function (ex, L) { return ex && ex[L] ? "<div class='rn-exo'>" + esc(ex[L]) + "</div>" : ""; };
  function examStop() { var E = RS.exam; if (!E) return; clearInterval(E.tm); document.removeEventListener("keydown", E.kd); RS.exam = null; }
  async function examFlow(cid, k) {
    examStop(); quizStop(); destroyGame(); setRR("<div class='empty'>Menyiapkan simulasi ujian…</div>");
    try {
      await ensureSettings();
      var r = await rapi("start", { m: "POST", b: { cat: cid, mode: "exam" } }); if (RS.route !== k) return;
      if (!r.ok) { toast((r.j && r.j.err) || "Gagal memulai"); location.replace("#/run"); return; }
      var p = r.j;
      if (p.adjusted) toast("Soal aktif hanya " + p.total + " (target " + p.requested + "): sesi disesuaikan.");
      if (p.cycle) toast("Bank soal kategori sudah habis dipakai — putaran baru dimulai.");
      var c = (RS.cats || []).filter(function (x) { return x.id === cid; })[0];
      var E = RS.exam = { k: k, cid: cid, sid: p.sid, name: c ? c.name : "", total: p.total, limit: p.limit || p.q_time * 1000 * p.total, qTime: p.q_time * 1000, dl: 0, cur: p.cur || 0, qs: p.qs || [], ans: {}, flag: {}, busy: false, sent: false, tm: 0, kd: null };
      (p.qs || []).forEach(function (q) { if (q.chosen) E.ans[q.idx] = q.chosen; if (q.flag) E.flag[q.idx] = 1; });
      E.kd = function (e) {
        var X = RS.exam; if (!X || X !== E || X.sent || e.ctrlKey || e.metaKey || e.altKey) return;
        var t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
        if (e.key === "ArrowLeft") { e.preventDefault(); return examGo(E.cur - 1); }
        if (e.key === "ArrowRight") { e.preventDefault(); return examGo(E.cur + 1); }
        if (e.key === "f" || e.key === "F") { e.preventDefault(); return examFlag(); }
        var L = String(e.key || "").toUpperCase(); if (LET.indexOf(L) >= 0) { e.preventDefault(); examPick(L); }
      };
      document.addEventListener("keydown", E.kd);
      if (p.status === "ready") { setRR(examIntro(E)); examBind(); return; }
      E.dl = performance.now() + (p.remaining == null ? E.limit : p.remaining);
      examDraw(); examTick();
    } catch (e) { if (e !== 0) { toast(e.message || "Gagal memulai"); location.replace("#/run"); } }
  }
  function examIntro(E) {
    return "<div class='rn-hero g'><h1 style='font-size:clamp(22px,6vw,30px)'>🎓 Simulasi Ujian</h1><p>" + (E.name ? "<b>" + esc(E.name) + "</b><br>" : "") +
      "<b>" + E.total + " soal</b> · waktu total <b>" + fdur(E.limit) + "</b> (" + Math.round(E.qTime / 1000) + " dtk × " + E.total + " soal).<br>" +
      "Jawaban <b>tidak langsung dinilai</b>: kunci dan pembahasan tidak muncul sampai kamu menekan <b>Kumpulkan</b>. Kamu tetap bisa kembali ke nomor sebelumnya, berikutnya, atau lompat ke nomor mana pun, dan menandai soal (🚩) untuk ditinjau.</p>" +
      "<div class='rn-row'><button class='btn' id='exStart'>▶ Mulai ujian</button><a class='btn s' href='#/run'>Kembali</a></div></div>";
  }
  function examBind() { var b = g("exStart"); if (b) b.addEventListener("click", examBegin); }
  async function examBegin() {
    var E = RS.exam; if (!E) return; var b = g("exStart"); if (b) { b.disabled = true; b.textContent = "Memulai…"; }
    var r = await rapi("begin", { m: "POST", b: { sid: E.sid } }); if (!RS.exam || RS.exam !== E) return;
    if (!r.ok) { toast((r.j && r.j.err) || "Gagal memulai"); examBind(); return; }
    E.dl = performance.now() + (r.j.remaining == null ? E.limit : r.j.remaining);
    examDraw(); examTick();
  }
  function examTick() {
    var E = RS.exam; if (!E) return; clearInterval(E.tm);
    E.tm = setInterval(function () {
      if (RS.exam !== E || RS.route !== E.k || !g("rr")) return examStop();
      var rem = E.dl - performance.now(), el = g("exT");
      if (el) { el.textContent = "⏱ " + fdur(Math.max(0, rem)); el.className = "rn-qt" + (rem < 60000 ? " low" : ""); }
      if (rem <= 0 && !E.busy && !E.sent) { toast("Waktu habis — jawaban dikumpulkan otomatis."); examSubmit(true); }
    }, 250);
  }
  function examDraw() {
    var E = RS.exam; if (!E || RS.route !== E.k || !g("rr")) return examStop();
    var q = E.qs[E.cur]; if (!q) return;
    var chosen = E.ans[E.cur], fl = !!E.flag[E.cur], answered = Object.keys(E.ans).length, flagged = Object.keys(E.flag).length;
    var h = "<div class='rn-qz'><div class='rn-hd'><b>Soal " + (E.cur + 1) + "/" + E.total + "</b><span class='tag'>✍️ " + answered + " dijawab</span>" + (flagged ? "<span class='tag' style='color:var(--warn)'>🚩 " + flagged + "</span>" : "") + "<span class='sp'></span><span class='rn-qt' id='exT'></span></div>" +
      "<div class='rn-prog'><i style='width:" + (E.total ? answered / E.total * 100 : 0) + "%'></i></div>" +
      "<div class='pn g' style='padding:14px'>" + imgs(q) + "<div class='q'>" + esc(q.q) + "</div>";
    LET.forEach(function (L, i) { if (!q.o[L]) return; h += "<button class='rn-op rn-qo" + (chosen === L ? " pick" : "") + "' data-ex-pick='" + L + "'><b style='background:" + CSSC[i] + "'>" + L + "</b><span>" + esc(q.o[L]) + "</span></button>"; });
    h += "</div>" +
      "<div class='ex-nums'>" + E.qs.map(function (x, i) { return "<button class='" + (E.ans[i] ? "ans " : "") + (E.flag[i] ? "flg " : "") + (i === E.cur ? "cur" : "") + "' data-ex-go='" + i + "'>" + (i + 1) + "</button>"; }).join("") + "</div>" +
      "<div class='rn-row'><button class='btn s' data-ex-nav='-1'" + (E.cur <= 0 ? " disabled" : "") + ">‹ Sebelumnya</button>" +
      "<button class='btn s' data-ex-nav='1'" + (E.cur >= E.total - 1 ? " disabled" : "") + ">Berikutnya ›</button></div>" +
      "<div class='rn-row'><select class='in' id='exJump' style='flex:1;min-width:140px;padding:9px;border-radius:10px;border:1px solid var(--line);background:rgba(10,6,28,.5);color:#fff;font:400 14px Inter,sans-serif'>" + E.qs.map(function (x, i) { return "<option value='" + i + "'" + (i === E.cur ? " selected" : "") + ">Ke nomor " + (i + 1) + (E.ans[i] ? " ✓" : "") + (E.flag[i] ? " 🚩" : "") + "</option>"; }).join("") + "</select>" +
      "<button class='btn s " + (fl ? "rn-flag" : "") + "' data-ex-flag>" + (fl ? "🚩 Ditandai" : "🚩 Tandai soal") + "</button></div>" +
      "<div class='rn-row'><button class='btn' data-ex-submit style='flex:1'>📤 Kumpulkan ujian</button><a class='btn s' href='#/run'>✕ Keluar</a></div>" +
      "<div class='hint' style='text-align:center;margin-top:8px'>Jawaban tersimpan otomatis. Kunci & pembahasan hanya muncul setelah ujian dikumpulkan.</div></div>";
    setRR(h); window.scrollTo(0, 0); examBindNav();
    var rem = E.dl - performance.now(), el = g("exT"); if (el) { el.textContent = "⏱ " + fdur(Math.max(0, rem)); el.className = "rn-qt" + (rem < 60000 ? " low" : ""); }
  }
  function examBindNav() {
    var rr = g("rr"); if (!rr) return;
    [].forEach.call(rr.querySelectorAll("[data-ex-pick]"), function (b) { b.addEventListener("click", function () { examPick(b.dataset.exPick); }); });
    [].forEach.call(rr.querySelectorAll("[data-ex-go]"), function (b) { b.addEventListener("click", function () { examGo(+b.dataset.exGo); }); });
    [].forEach.call(rr.querySelectorAll("[data-ex-nav]"), function (b) { b.addEventListener("click", function () { examGo(RS.exam.cur + (+b.dataset.exNav)); }); });
    var f = rr.querySelector("[data-ex-flag]"); if (f) f.addEventListener("click", examFlag);
    var s = rr.querySelector("[data-ex-submit]"); if (s) s.addEventListener("click", function () { examSubmit(false); });
    var j = g("exJump"); if (j) j.addEventListener("change", function () { examGo(+j.value); });
  }
  async function examPick(L) {
    var E = RS.exam; if (!E || E.busy || E.sent) return;
    var idx = E.cur; E.ans[idx] = L; examDraw();
    E.busy = true;
    var r; try { r = await rapi("exam/save", { m: "POST", b: { sid: E.sid, idx: idx, ans: L } }); } catch (e) { if (e === 0) return; r = null; }
    E.busy = false;
    if (!RS.exam || RS.exam !== E) return;
    if (!r || !r.ok) toast((r && r.j && r.j.err) || "Gagal menyimpan jawaban");
  }
  async function examFlag() {
    var E = RS.exam; if (!E || E.sent) return;
    var idx = E.cur, on = E.flag[idx] ? 0 : 1; if (on) E.flag[idx] = 1; else delete E.flag[idx];
    examDraw();
    var r; try { r = await rapi("exam/save", { m: "POST", b: { sid: E.sid, idx: idx, flag: on } }); } catch (e) { return; }
    if (!RS.exam || RS.exam !== E) return;
    if (!r.ok) toast((r.j && r.j.err) || "Gagal menyimpan tanda");
  }
  function examGo(i) { var E = RS.exam; if (!E) return; i = Math.max(0, Math.min(E.total - 1, i)); if (i === E.cur) return; E.cur = i; examDraw(); }
  async function examSubmit(auto) {
    var E = RS.exam; if (!E || E.sent) return;
    var blank = E.total - Object.keys(E.ans).length;
    if (!auto && !confirm("Kumpulkan ujian sekarang?" + (blank ? "\n\nMasih ada " + blank + " soal belum dijawab." : "") + "\nJawaban tidak bisa diubah setelah dikumpulkan.")) return;
    E.sent = true; E.busy = true; clearInterval(E.tm);
    var r; try { r = await rapi("exam/submit", { m: "POST", b: { sid: E.sid } }); } catch (e) { if (e === 0) return; r = null; }
    if (!r || !r.ok) { E.sent = false; E.busy = false; toast((r && r.j && r.j.err) || "Gagal mengumpulkan"); examTick(); return; }
    var sid = E.sid; examStop(); location.replace("#/run/result/" + sid);
  }

  async function reviewPage(sid, k) {
    var r = await rapi("result?sid=" + encodeURIComponent(sid)); if (!alive(k)) return; if (!r.ok) return setRR(errBox(r));
    RS.rv = { sid: sid, s: r.j.s, items: r.j.items, ex: r.j.explain, f: "all", i: 0 }; rvDraw();
  }
  function rvList() { var rv = RS.rv; return rv.items.map(function (x, i) { return i; }).filter(function (i) { var x = rv.items[i]; return rv.f === "all" || (rv.f === "ok" && x.correct) || (rv.f === "no" && x.chosen && !x.correct) || (rv.f === "bl" && !x.chosen); }); }
  function rvDraw() {
    var rv = RS.rv; if (!rv || !g("rr")) return; var L = rvList(); if (L.length && L.indexOf(rv.i) < 0) rv.i = L[0];
    var x = rv.items[rv.i], pos = L.indexOf(rv.i), chip = function (f, t, n) { return "<a href='javascript:void 0' class='chip g" + (rv.f === f ? " on" : "") + "' data-ra='rv-f' data-v2='" + f + "'>" + t + " (" + n + ")</a>"; };
    var cnt = { ok: rv.items.filter(function (i) { return i.correct; }).length, no: rv.items.filter(function (i) { return i.chosen && !i.correct; }).length, bl: rv.items.filter(function (i) { return !i.chosen; }).length };
    var h = "<div class='rn-hd'><div class='sec' style='margin:6px 0;flex:1'>PEMBAHASAN · " + esc(rv.s.cat_name) + "</div></div><div class='chips'>" + chip("all", "Semua", rv.items.length) + chip("ok", "Benar", cnt.ok) + chip("no", "Salah", cnt.no) + chip("bl", "Tidak dijawab", cnt.bl) + "</div>";
    h += "<div class='rn-nums'>" + L.map(function (i) { var it = rv.items[i]; return "<button class='" + (it.correct ? "ok" : it.chosen ? "no" : "bl") + (i === rv.i ? " cur" : "") + "' data-ra='rv-go' data-v2='" + i + "'>" + (i + 1) + "</button>"; }).join("") + "</div>";
    if (!x) h += "<div class='pn g empty'>Tidak ada soal pada filter ini.</div>";
    else {
      var st = x.correct ? ["BENAR", "ok", "+1"] : x.chosen ? ["SALAH", "bad", "0"] : ["TIDAK DIJAWAB", "bl", "0"];
      h += "<div class='rn-rv g'><div class='rn-hd'><b>SOAL " + (rv.i + 1) + "</b><span class='sp'></span><span class='tag " + (st[1] === "ok" ? "ok" : st[1] === "bad" ? "" : "warn") + "' style='" + (st[1] === "bad" ? "background:rgba(248,113,113,.25);color:var(--bad)" : "") + "'>" + st[0] + " · skor " + st[2] + "</span></div>" +
        String(x.img || "").split(",").filter(Boolean).map(function (id) { return "<img alt='Gambar soal' loading='lazy' src='/api/run/img/" + encodeURIComponent(id) + "'>"; }).join("") + "<div class='q'>" + esc(x.q) + "</div>";
      LET.forEach(function (Lt, i) {
        if (!x.o[Lt]) return; var isKey = Lt === x.ans, isMine = Lt === x.chosen, cls = isKey ? "key" : isMine ? "bad" : "";
        h += "<div class='rn-op " + cls + "'><b style='background:" + CSSC[i] + "'>" + Lt + "</b><span>" + esc(x.o[Lt]) + "</span>" + (isKey ? "<i class='rn-s-ok'>✔ KUNCI</i>" : "") + (isMine && !isKey ? "<i class='rn-s-bad'>✘ jawabanmu</i>" : isMine ? "<i>jawabanmu</i>" : "") + optEx(x.ex, Lt) + "</div>";
      });
      h += "<div class='hint' style='margin:8px 2px'>Jawaban pemain: <b>" + (x.chosen || "—") + "</b> · Kunci: <b class='rn-s-ok'>" + x.ans + "</b> · Status: <b>" + st[0] + "</b> · Skor: <b>" + st[2] + "</b></div>";
      h += rv.ex ? (x.expl ? "<div class='rn-ex'><b>Pembahasan</b><br>" + esc(x.expl) + "</div>" : "<div class='rn-ex no'>Pembahasan belum tersedia.</div>") : "<div class='rn-ex no'>Pembahasan dinonaktifkan untuk kategori ini.</div>";
      h += "</div><div class='rn-row'><button class='btn s' data-ra='rv-p' " + (pos <= 0 ? "disabled style='opacity:.4'" : "") + ">‹ Sebelumnya</button><div class='hint' style='flex:.4;text-align:center;align-self:center;margin:0'>" + (rv.i + 1) + "/" + rv.items.length + "</div><button class='btn s' data-ra='rv-n' " + (pos >= L.length - 1 ? "disabled style='opacity:.4'" : "") + ">Berikutnya ›</button></div>" +
        "<div class='rn-row' style='margin-top:8px'><select id='rvJump' class='in' style='flex:1;min-width:150px;padding:9px;border-radius:10px;border:1px solid var(--line);background:rgba(10,6,28,.5);color:#fff;font:400 14px Inter,sans-serif'>" + L.map(function (i) { var it = rv.items[i]; return "<option value='" + i + "'" + (i === rv.i ? " selected" : "") + ">Ke nomor " + (i + 1) + (it.correct ? " ✔" : it.chosen ? " ✘" : " ○") + (it.flag ? " 🚩" : "") + "</option>"; }).join("") + "</select></div>";
    }
    h += "<div class='rn-row' style='margin-top:12px'><a class='btn s' href='#/run/result/" + esc(rv.sid) + "'>↩ Ringkasan hasil</a><a class='btn s' href='#/run'>🏠 Dashboard ASTERION RUN</a></div>";
    setRR(h); window.scrollTo(0, 0);
    var jp = g("rvJump"); if (jp) jp.addEventListener("change", function () { rv.i = +jp.value; rvDraw(); });
  }

  async function histPage(k) {
    var r = await rapi("history"); if (!alive(k)) return; if (!r.ok) return setRR(errBox(r));
    var h = "<div class='sec'>RIWAYAT PERMAINAN</div>";
    if (!r.j.rows.length) h += "<div class='pn g empty'>Belum ada permainan selesai.</div>";
    r.j.rows.forEach(function (x) { h += "<a class='card g' href='#/run/result/" + esc(x.id) + "'><span class='i'>" + (x.mode === "quiz" ? "📝" : "🎮") + "</span><span class='t'>" + esc(x.cat_name) + "<small>" + fdate(x.fin) + " · ✔" + x.correct + " ✘" + x.wrong + " ○" + x.blank + " · " + fdur(x.dur) + (x.rank ? " · peringkat #" + x.rank : "") + "</small></span><span class='v' style='text-align:right;font-weight:700'>" + x.score + "/" + x.total + "<small style='display:block;color:var(--mut);font-weight:400'>" + pct(x.acc) + "</small></span></a>"; });
    setRR(h);
  }

  /* ======================= LEADERBOARD ======================= */
  function lbRows(j, glob) {
    var h = "";
    if (!j.rows.length) return "<div class='pn g empty'>Belum ada data pada periode ini.</div>";
    j.rows.forEach(function (x) {
      var me = !!x.me;
      h += "<div class='rn-lb g" + (me ? " me" : "") + "'><div class='r'>" + medal(x.rank) + "</div><div class='n'><b>" + esc(x.nick) + "</b>" + (me ? " " + tag("kamu", "ok") : "") + "<small>" + (S.admin ? esc(nmOf(x.u)) + " · " + esc(x.u) + " · " : "") + (glob ? x.games + " permainan · " + x.cats + " kategori" : "Waktu " + fdur(x.dur)) + "</small></div><div class='v'>" + (glob ? pct(x.acc) : x.score + "/" + x.total) + "<small>" + (glob ? "skor global" : "akurasi " + pct(x.acc)) + "</small></div></div>";
    });
    if (j.me && j.me.rank > j.rows.length) h += "<div class='hint' style='text-align:center'>Peringkatmu: <b>#" + j.me.rank + "</b> dari " + j.count + " pemain</div>";
    return h;
  }
  async function lbBody(cat, per, glob) {
    var r = await rapi("lb?cat=" + encodeURIComponent(cat) + "&p=" + per); if (!r.ok) return errBox(r);
    if ("nick" in r.j) RS.nick = r.j.nick;
    return (glob ? "<div class='hint'>Skor global = <b>rata-rata akurasi terbaik</b> di setiap kategori yang pernah kamu mainkan. Karena memakai rata-rata persentase, jumlah soal tiap kategori berbeda tidak memengaruhi, dan memainkan lebih banyak kategori tidak otomatis menambah skor. Seri → waktu total lebih cepat.</div>" : "<div class='hint'>Memakai skor terbaik tiap mahasiswa. Seri → akurasi, lalu waktu lebih cepat.</div>") + lbRows(r.j, glob);
  }
  async function lbPage(cat, per, k) {
    if (!RS.cats) { var c = await rapi("cats"); if (!alive(k)) return; if (!c.ok) return setRR(errBox(c)); RS.cats = c.j.cats; RS.set = c.j.settings; }
    if (!cat) cat = RS.cats.length ? String(RS.cats[0].id) : "global";
    var glob = cat === "global", opts = "<option value='global'" + (glob ? " selected" : "") + ">🌍 Global (semua kategori)</option>" + RS.cats.map(function (c) { return "<option value='" + c.id + "'" + (String(c.id) === cat ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("");
    var chips = [["all", "Sepanjang waktu"], ["month", "Bulan ini"], ["week", "Minggu ini"]].map(function (p) { return "<a class='chip g" + (per === p[0] ? " on" : "") + "' href='#/run/lb/" + cat + "/" + p[0] + "'>" + p[1] + "</a>"; }).join("");
    setRR("<div class='sec'>LEADERBOARD</div><div id='rnNkW'></div><select class='in' id='rnLbSel' data-per='" + per + "'>" + opts + "</select><div class='chips'>" + chips + "</div><div id='rnLbB'><div class='empty'>Memuat…</div></div>");
    var b = await lbBody(cat, per, glob); if (alive(k) && g("rnLbB")) g("rnLbB").innerHTML = b;
    if (alive(k) && g("rnNkW")) g("rnNkW").innerHTML = nickBar();
  }

  /* ======================= PANEL ADMIN ======================= */
  var ANAV = [["", "📊 Ringkasan"], ["cats", "🗂️ Kategori"], ["q", "📝 Soal"], ["import", "📥 Impor PDF"], ["lb", "🏆 Leaderboard"], ["settings", "🎛️ Pengaturan"], ["audit", "🧾 Audit"]];
  function anav(cur) { return "<div class='chips'>" + ANAV.map(function (n) { return "<a class='chip g" + (cur === n[0] ? " on" : "") + "' href='#/run/admin" + (n[0] ? "/" + n[0] : "") + "'>" + n[1] + "</a>"; }).join("") + "</div>"; }
  async function adminCats() { if (!RS.cats) { var c = await rapi("cats"); if (c.ok) { RS.cats = c.j.cats; RS.set = c.j.settings; } } return RS.cats || []; }
  async function adminRoute(P, k) {
    var sub = P[2] || ""; RS.cats = null;
    if (sub === "") return adminHome(k);
    if (sub === "cats") return adminCatsPage(k);
    if (sub === "q") return adminQ(+P[3] || 0, k);
    if (sub === "import") return adminImport(k);
    if (sub === "lb") return adminLb(P[3] || "global", P[4] || "all", k);
    if (sub === "settings") return adminSettings(k);
    if (sub === "audit") return adminAudit(k);
    location.hash = "#/run/admin";
  }
  async function adminHome(k) {
    var r = await rapi("admin/stats"); if (!alive(k)) return; if (!r.ok) return setRR(errBox(r)); var d = r.j;
    var h = "<div class='sec'>PANEL ASTERION RUN</div>" + anav("") + "<div class='rn-grid'>" + [["Kategori", d.cats], ["Soal aktif", d.qActive], ["Soal nonaktif", d.qInactive], ["Mahasiswa bermain", d.players], ["Total permainan", d.games], ["Rata² akurasi", pct(d.acc)]].map(function (x) { return "<div class='rn-st g'><b>" + x[1] + "</b><small>" + x[0] + "</small></div>"; }).join("") + "</div>";
    h += "<div class='sec'>PER KATEGORI</div><div class='pn g rn-sc'><table class='rn-tb'><tr><th>Kategori</th><th>Soal</th><th>Main</th><th>Pemain</th><th>Akurasi</th></tr>" + d.byCat.map(function (c) { return "<tr><td><a href='#/run/admin/q/" + c.id + "' style='color:var(--gold)'>" + esc(c.name) + "</a>" + (c.active ? "" : " " + tag("off", "warn")) + "</td><td>" + c.aq + "/" + c.tq + "</td><td>" + c.games + "</td><td>" + c.players + "</td><td>" + (c.games ? pct(c.acc) : "—") + "</td></tr>"; }).join("") + "</table></div>";
    h += "<div class='sec'>AKTIVITAS TERBARU</div><div class='pn g rn-sc'>" + (d.recent.length ? "<table class='rn-tb'>" + d.recent.map(function (x) { return "<tr><td>" + fdate(x.fin) + "</td><td>" + esc(nmOf(x.u)) + "<small style='display:block;color:var(--mut)'>" + esc(x.u) + (x.nick ? " · “" + esc(x.nick) + "”" : "") + "</small></td><td>" + (x.mode === "quiz" ? "📝 " : "🎮 ") + esc(x.cat_name) + "</td><td><a href='#/run/review/" + esc(x.id) + "' style='color:var(--gold)'>" + x.score + "/" + x.total + "</a></td></tr>"; }).join("") + "</table>" : "<div class='empty'>Belum ada aktivitas.</div>") + "</div>";
    setRR(h);
  }
  function chk(id, label, on) { return "<label class='rn-tg'><input type='checkbox' id='" + id + "'" + (on ? " checked" : "") + "> " + label + "</label>"; }
  function catForm(c) {
    var i = c ? c.id : 0;
    return "<div class='pn g'><b>" + (c ? esc(c.name) : "＋ Kategori baru") + "</b><label>Nama kategori</label><input id='cn" + i + "' value=\"" + esc(c ? c.name : "") + "\" placeholder='mis. UB 3.3 Acromion'><label>Deskripsi</label><textarea id='cd" + i + "' rows='2'>" + esc(c ? c.descr : "") + "</textarea>" +
      "<div class='rn-row'><div><label>Soal per sesi (0 = semua)</label><input id='cp" + i + "' type='number' min='0' max='500' value='" + (c ? c.per_session : 20) + "'></div><div><label>Waktu PER SOAL (detik)</label><input id='ct" + i + "' type='number' min='10' max='600' value='" + (c ? c.q_time : 60) + "'></div></div>" +
      chk("cx" + i, "Tampilkan pembahasan setelah sesi", c ? c.show_explain : 1) + chk("ca" + i, "Kategori aktif (dapat dimainkan mahasiswa)", c ? c.active : 1) +
      "<div class='rn-row'><button class='btn sm' data-ra='cat-save' data-id='" + i + "'>Simpan</button>" + (c ? "<button class='btn s sm' data-ra='cat-mv' data-id='" + i + "' data-v2='-1' title='Naikkan'>↑</button><button class='btn s sm' data-ra='cat-mv' data-id='" + i + "' data-v2='1' title='Turunkan'>↓</button><a class='btn s sm' href='#/run/admin/q/" + c.id + "'>Kelola soal</a><button class='btn d sm' data-ra='cat-del' data-id='" + i + "'>Hapus</button>" : "") + "</div></div>";
  }
  async function adminCatsPage(k) {
    var r = await rapi("admin/stats"); if (!alive(k)) return; if (!r.ok) return setRR(errBox(r));
    setRR("<div class='sec'>KATEGORI</div>" + anav("cats") + catForm(null) + r.j.byCat.map(catForm).join("") + "<div class='hint'>Menghapus kategori ikut menghapus bank soalnya. Riwayat permainan mahasiswa tetap tersimpan (snapshot).</div>");
  }

  /* ---- editor soal (dipakai bank soal & preview impor) ---- */
  var MAXIMG = 6;
  function ensureCss() {
    if (g("rnXcss")) return; var st = document.createElement("style"); st.id = "rnXcss";
    st.textContent = ".pvimgs{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.pvim{position:relative;border-radius:10px;background:#fff;overflow:hidden;border:1px solid rgba(255,255,255,.2);max-width:100%}" +
      ".pvim img{display:block;max-height:120px;max-width:170px;object-fit:contain}.pvim .meta{font-size:10px;padding:2px 6px;background:rgba(0,0,0,.72);color:#fff}.pvim .meta.low{background:#b45309}" +
      ".pvim .x{position:absolute;top:3px;right:3px;width:24px;height:24px;border-radius:12px;border:0;background:rgba(0,0,0,.7);color:#fff;font-size:13px;cursor:pointer;padding:0;min-width:0;flex:none}" +
      ".pvim select{display:block;width:100%;font-size:11px;border:0;border-top:1px solid #ddd;background:#f3f4f6;color:#111;padding:3px}" +
      ".rn-modal{position:fixed;inset:0;z-index:99999;background:rgba(5,6,20,.92);display:flex;flex-direction:column;padding:10px;gap:8px;color:#fff}.rn-modal .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.rn-modal .bar .sp{flex:1}" +
      ".rn-modal .stage{flex:1;overflow:auto;-webkit-overflow-scrolling:touch}.rn-modal .wrap{position:relative;max-width:900px;margin:0 auto;touch-action:none;user-select:none;-webkit-user-select:none;cursor:crosshair}.rn-modal .wrap img{display:block;width:100%;background:#fff;pointer-events:none}" +
      ".rn-modal .sel{position:absolute;border:2px solid #7c5cff;background:rgba(124,92,255,.25);pointer-events:none}.rn-modal .hint{opacity:.85;font-size:12px}";
    document.head.appendChild(st);
  }
  function imgSrc(m) { return m.data ? m.data : "/api/run/img/" + encodeURIComponent(m.id); }
  function qEd(it, ctx) {
    ensureCss();
    var h = "<div class='rn-ed' " + ctx + "><label>Pertanyaan</label><textarea data-f='q' rows='3'>" + esc(it.q) + "</textarea>";
    LET.forEach(function (L) { var f = L.toLowerCase(); h += "<div class='k'><input type='radio' name='k" + (it._u || it.id || 0) + "' data-f='ans' value='" + L + "'" + (it.ans === L ? " checked" : "") + " title='Kunci jawaban'><div style='flex:1'><label>Pilihan " + L + (it.ans === L ? " ✔ kunci" : "") + "</label><textarea data-f='" + f + "' rows='2'>" + esc(it[f]) + "</textarea></div></div>"; });
    h += "<label>Pembahasan (kosongkan bila belum ada — tidak akan dikarang)</label><textarea data-f='expl' rows='3'>" + esc(it.expl) + "</textarea><div class='rn-row'><div><label>Kesulitan</label><select data-f='diff'>" + [[1, "Mudah"], [2, "Sedang"], [3, "Sulit"]].map(function (d) { return "<option value='" + d[0] + "'" + (+it.diff === d[0] ? " selected" : "") + ">" + d[1] + "</option>"; }).join("") + "</select></div><div><label>Nomor asli</label><input type='text' data-f='num' value='" + esc(it.num || "") + "'></div></div>" +
      (it.imgs ? "" : (function () {
        var ids = String(it.img || "").split(",").filter(Boolean);
        return "<label>Gambar pendukung (maks. " + MAXIMG + ")</label><div class='pvimgs' data-strip>" + ids.map(function (id) { return "<div class='pvim' data-iid='" + esc(id) + "'><img alt='' src='/api/run/img/" + esc(id) + "'><button class='x' data-ra='img-rm' data-iid='" + esc(id) + "' title='Lepas gambar'>✕</button></div>"; }).join("") + "</div>" +
          "<div class='rn-row'><input type='file' accept='image/*' multiple data-ra-file='img'></div><input type='hidden' data-f='img' value='" + esc(ids.join(",")) + "'>";
      })()) + "</div>";
    return h;
  }
  function readEd(box) {
    var o = {}; [].forEach.call(box.querySelectorAll("[data-f]"), function (e) { var f = e.dataset.f; if (f === "ans") { if (e.checked) o.ans = e.value; } else o[f] = e.value; });
    o.num = parseInt(o.num, 10) || null; o.diff = +o.diff || 2; return o;
  }
  function pickImage(file) {
    return new Promise(function (res, rej) {
      var im = new Image(), u = URL.createObjectURL(file);
      im.onload = function () { var s = Math.min(1, 1000 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); var q = 0.85, d = c.toDataURL("image/jpeg", q); while (d.length > 850000 && q > 0.3) { q -= 0.15; d = c.toDataURL("image/jpeg", q); } res(d); };
      im.onerror = function () { rej(new Error("Gambar tidak bisa dibaca")); }; im.src = u;
    });
  }
  async function uploadImg(file) { var d = await pickImage(file), r = await rapi("admin/img", { m: "POST", b: { data: d } }); if (!r.ok) throw new Error((r.j && r.j.err) || "Gagal mengunggah gambar"); return r.j.id; }

  async function adminQ(cid, k) {
    var cats = await adminCats(); if (!alive(k)) return; if (!cats.length) return setRR("<div class='sec'>SOAL</div>" + anav("q") + "<div class='pn g empty'>Buat kategori dulu.</div>");
    if (!cid) cid = cats[0].id; var st = RS.qf = RS.qf && RS.qf.cid === cid ? RS.qf : { cid: cid, s: "", act: "", pg: 0 };
    var r = await rapi("admin/q?cat=" + cid + "&s=" + encodeURIComponent(st.s) + "&active=" + st.act + "&page=" + st.pg); if (!alive(k)) return; if (!r.ok) return setRR(errBox(r));
    RS.qrows = r.j.rows;
    var h = "<div class='sec'>BANK SOAL</div>" + anav("q") + "<select class='in' id='rnQCat'>" + cats.map(function (c) { return "<option value='" + c.id + "'" + (c.id === cid ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select>" +
      "<div class='pn g'><div class='rn-row'><input class='in' id='rnQs' placeholder='Cari kata kunci…' value=\"" + esc(st.s) + "\"><select class='in' id='rnQa' style='margin:0'><option value=''>Semua status</option><option value='1'" + (st.act === "1" ? " selected" : "") + ">Aktif</option><option value='0'" + (st.act === "0" ? " selected" : "") + ">Nonaktif</option></select></div><div class='rn-row' style='margin-top:8px'><button class='btn s sm' data-ra='q-find'>Cari</button><a class='btn sm' href='#/run/admin/import'>📥 Impor PDF/Excel/CSV</a><button class='btn s sm' data-ra='q-exp' data-v2='csv'>⬇ Ekspor CSV</button><button class='btn s sm' data-ra='q-exp' data-v2='json'>⬇ Ekspor JSON</button></div></div>" +
      "<div class='hint'>" + r.j.total + " soal · halaman " + (st.pg + 1) + "/" + Math.max(1, Math.ceil(r.j.total / 50)) + "</div><div id='rnQL'>";
    r.j.rows.forEach(function (x, i) { h += qRow(x, i); });
    h += "</div><div class='rn-row'><button class='btn s sm' data-ra='q-pg' data-v2='-1' " + (st.pg ? "" : "disabled style='opacity:.4'") + ">‹ Sebelumnya</button><button class='btn s sm' data-ra='q-pg' data-v2='1' " + ((st.pg + 1) * 50 >= r.j.total ? "disabled style='opacity:.4'" : "") + ">Berikutnya ›</button></div>";
    setRR(h);
  }
  function qRow(x, i) {
    return "<div class='rn-it g" + (x.active ? "" : " off") + (x.verified ? "" : " warn") + "' id='qr" + x.id + "'><div class='rn-hd'><b>#" + (x.num || "—") + "</b>" + tag("kunci " + x.ans, "ok") + (x.active ? "" : tag("nonaktif", "warn")) + (x.verified ? "" : tag("belum diverifikasi", "warn")) + (x.expl ? "" : tag("tanpa pembahasan")) + (x.img ? tag("🖼️") : "") + "<span class='sp'></span><small style='color:var(--mut)'>" + esc(x.src) + "</small></div><div class='q'>" + esc(x.q.length > 220 ? x.q.slice(0, 220) + "…" : x.q) + "</div>" +
      "<div class='rn-row'><button class='btn s sm' data-ra='q-edit' data-id='" + x.id + "' data-i='" + i + "'>✎ Edit</button><button class='btn s sm' data-ra='q-tog' data-id='" + x.id + "' data-v2='" + (x.active ? 0 : 1) + "'>" + (x.active ? "Nonaktifkan" : "Aktifkan") + "</button><button class='btn d sm' data-ra='q-del' data-id='" + x.id + "'>Hapus</button></div></div>";
  }

  /* ---- impor ---- */
  var STC = { ok: ["ok", "Kunci terdeteksi"], warn: ["warn", "Perlu diperiksa"], bad: ["bad", "Gagal / kunci tidak ditemukan"] };
  async function adminImport(k) {
    var cats = await adminCats(); if (!alive(k)) return; if (!cats.length) return setRR("<div class='sec'>IMPOR</div>" + anav("import") + "<div class='pn g empty'>Buat kategori dulu di menu Kategori.</div>");
    var im = RS.imp, h = "<div class='sec'>IMPOR SOAL</div>" + anav("import") + "<div class='pn g'><b>1 · Pilih kategori & berkas</b><label>Kategori tujuan</label><select class='in' id='rnIc'>" + cats.map(function (c) { return "<option value='" + c.id + "'" + (im && im.cat === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select>" +
      "<div class='dz' id='rnDz'>📄 Pilih atau seret PDF soal (boleh banyak)<small>PDF teks, anotasi highlight, hasil scan (OCR), dua kolom, bergambar (gambar ikut diekstrak) · atau .xlsx / .csv (kolom: pertanyaan, A–E, kunci, pembahasan)</small></div><input type='file' id='rnIf' accept='.pdf,.csv,.xlsx,.xls,application/pdf' multiple hidden><div id='rnPg'></div>" +
      "<div class='hint'>Kunci jawaban dibaca dari <b>highlight</b> pada PDF. Bila tidak yakin, sistem <b>tidak menebak</b> — soal ditandai merah. Pembahasan hanya diambil dari PDF; bila tidak ada, dibiarkan kosong.</div></div><div id='rnPv'></div>";
    setRR(h); if (im) pvDraw();
  }
  async function doImport(files) {
    var cat = +g("rnIc").value, box = g("rnPg"), all = [], warns = [], names = [];
    RS.imp = { cat: cat, items: [], src: "", files: [], warns: [], f: "all", un: [] };
    try {
      await loadPdfLib();
      for (var i = 0; i < files.length; i++) {
        var f = files[i], nm = f.name; names.push(nm);
        var prog = function (p) { box.innerHTML = "<div class='hint'>" + esc(nm) + " — " + esc(p.stage) + "</div><div class='rn-prog'><i style='width:" + Math.round((((i) + (p.pct || 0)) / files.length) * 100) + "%'></i></div>"; };
        prog({ stage: "Membuka berkas…", pct: 0 });
        var res = /\.pdf$/i.test(nm) ? await AsterionPdf.parsePdf(f, { progress: prog }) : await AsterionPdf.parseSheet(f);
        (res.unassigned || []).forEach(function (m) { m.src = nm; RS.imp.un.push(m); });
        res.items.forEach(function (x) { x.src = nm; x._u = all.length + Math.random(); all.push(x); }); (res.warnings || []).forEach(function (w) { warns.push(nm + ": " + w); });
        if (res.ocrPages && res.ocrPages.length) warns.push(nm + ": halaman " + res.ocrPages.join(", ") + " dibaca dengan OCR — periksa teks & kunci dengan teliti.");
        if (/\.pdf$/i.test(nm)) RS.imp.files.push(f);
      }
    } catch (e) { box.innerHTML = "<div class='err'>Gagal memproses: " + esc(e.message || e) + "</div>"; return; }
    RS.imp.items = all; RS.imp.src = names.join(", ").slice(0, 190); RS.imp.warns = warns; box.innerHTML = ""; pvDraw();
  }
  function recount(it) { var v = AsterionPdf.validate(it); it.status = v.status; it.notes = (it.via === "admin" ? ["Diedit/diverifikasi admin"] : []).concat(v.notes); }
  function fileOf(x) { var f = RS.imp && RS.imp.files.filter(function (p) { return p.name === x.src; })[0]; return f || null; }
  function pvImgs(x, i) {
    var a = x.imgs || [], low = a.some(function (m) { return m.conf === "low"; }), h = "<div class='pvimgs'>";
    a.forEach(function (m, k) {
      h += "<div class='pvim'><img alt='' src='" + esc(imgSrc(m)) + "'><div class='meta" + (m.conf === "low" ? " low" : "") + "'>" + (m.page ? "hal. " + m.page : "") + (m.kind === "manual" ? " · manual" : m.via === "embedded" ? " · asli" : m.via ? " · potongan" : "") + (m.conf === "low" ? " · ⚠ periksa" : "") + "</div>" +
        "<button class='x' data-ra='pv-im-rm' data-i='" + i + "' data-k='" + k + "' title='Lepas gambar'>✕</button>" +
        "<select data-ra-sel='pv-im-mv' data-i='" + i + "' data-k='" + k + "'><option value=''>⇄ Pindah ke soal…</option>" + RS.imp.items.map(function (y, j) { return j === i ? "" : "<option value='" + j + "'>#" + (y.num || "?") + "</option>"; }).join("") + "</select></div>";
    });
    h += "</div><div class='rn-row' style='margin-bottom:6px'>" + (fileOf(x) ? "<button class='btn s sm' data-ra='pv-crop' data-i='" + i + "'>✂ Potong dari halaman PDF</button>" : "") +
      (a.length < MAXIMG ? "<label class='btn s sm' style='display:inline-block;text-align:center;cursor:pointer;margin:0'>＋ Unggah gambar<input type='file' accept='image/*' hidden data-ra-file='pv-img' data-i='" + i + "'></label>" : "") +
      (low ? "<button class='btn sm' data-ra='pv-im-ok' data-i='" + i + "'>✔ Gambar sudah sesuai</button>" : "") + "</div>";
    return h;
  }
  function pvTray() {
    var im = RS.imp, un = im.un || []; if (!un.length) return "";
    var h = "<div class='pn g'><b>🖼 Gambar terdeteksi tapi belum terpasang (" + un.length + ")</b><div class='hint'>Pilih soal tujuan, atau buang bila hanya hiasan (logo/ornamen).</div><div class='pvimgs'>";
    un.forEach(function (m, k) {
      h += "<div class='pvim'><img alt='' src='" + esc(imgSrc(m)) + "'><div class='meta'>" + esc(m.src || "") + " · hal. " + m.page + "</div><button class='x' data-ra='pv-un-rm' data-k='" + k + "' title='Buang'>✕</button>" +
        "<select data-ra-sel='pv-un-as' data-k='" + k + "'><option value=''>Pasang ke soal…</option>" + im.items.map(function (y, j) { return "<option value='" + j + "'>#" + (y.num || "?") + (y.page ? " (hal. " + y.page + ")" : "") + "</option>"; }).join("") + "</select></div>";
    });
    return h + "</div></div>";
  }
  // potong gambar manual dari halaman PDF sumber (area dipilih dengan geser)
  async function openCrop(i) {
    var im = RS.imp, x = im.items[i], f = fileOf(x); if (!f) return toast("Berkas PDF sumber tidak tersedia."); ensureCss(); await loadPdfLib();
    var st = { pn: x.page || 1, pages: 0, fr: null, start: null }, m = document.createElement("div"); m.className = "rn-modal";
    m.innerHTML = "<div class='bar'><b>Potong gambar untuk soal #" + esc(x.num || "?") + "</b><button class='btn s sm' data-c='prev'>◀</button><span data-c='lbl'></span><button class='btn s sm' data-c='next'>▶</button><span class='sp'></span><button class='btn sm' data-c='ok'>✂ Potong &amp; pasang</button><button class='btn s sm' data-c='x'>Tutup</button></div>" +
      "<div class='hint'>Geser pada halaman untuk memilih area gambar/diagram/tabel. Hasil dirender ulang dengan resolusi tinggi.</div><div class='stage'><div class='wrap' data-c='wrap'><img alt='' data-c='img'><div class='sel' data-c='sel' hidden></div></div></div>";
    document.body.appendChild(m);
    var q = function (k) { return m.querySelector("[data-c=" + k + "]"); }, img = q("img"), sel = q("sel"), wrap = q("wrap");
    async function load() { q("lbl").textContent = "Memuat…"; try { var p = await AsterionPdf.pagePreview(f, st.pn, 900); st.pages = p.pages; img.src = p.data; q("lbl").textContent = "Halaman " + st.pn + " / " + p.pages; } catch (e) { q("lbl").textContent = "Gagal memuat halaman"; } sel.hidden = true; st.fr = null; }
    var pos = function (e) { var r = wrap.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
    wrap.onpointerdown = function (e) { st.start = pos(e); wrap.setPointerCapture(e.pointerId); sel.hidden = false; };
    wrap.onpointermove = function (e) { if (!st.start) return; var p = pos(e), a = st.start; st.fr = { x0: Math.min(a.x, p.x), y0: Math.min(a.y, p.y), x1: Math.max(a.x, p.x), y1: Math.max(a.y, p.y) }; sel.style.cssText = "left:" + st.fr.x0 * 100 + "%;top:" + st.fr.y0 * 100 + "%;width:" + (st.fr.x1 - st.fr.x0) * 100 + "%;height:" + (st.fr.y1 - st.fr.y0) * 100 + "%"; };
    wrap.onpointerup = function () { st.start = null; };
    m.onclick = async function (e) {
      var c = e.target.dataset && e.target.dataset.c;
      if (c === "x") m.remove(); else if (c === "prev" && st.pn > 1) { st.pn--; load(); } else if (c === "next" && st.pn < st.pages) { st.pn++; load(); }
      else if (c === "ok") {
        if (!st.fr || st.fr.x1 - st.fr.x0 < 0.02 || st.fr.y1 - st.fr.y0 < 0.02) return toast("Pilih area dengan menggeser pada halaman.");
        if ((x.imgs || []).length >= MAXIMG) return toast("Maksimal " + MAXIMG + " gambar per soal.");
        try { var r = await AsterionPdf.cropFromPdf(f, st.pn, st.fr); (x.imgs = x.imgs || []).push(r); recount(x); m.remove(); pvDraw(); toast("Gambar dipasang ke soal #" + (x.num || "?") + " ✓"); } catch (er) { toast(er.message || "Gagal memotong"); }
      }
    };
    load();
  }
  function pvDraw() {
    var im = RS.imp, el = g("rnPv"); if (!im || !el) return;
    var inc = im.items.filter(function (x) { return x.active !== false; }), c = { ok: 0, warn: 0, bad: 0 }; im.items.forEach(function (x) { c[x.status]++; });
    var badInc = inc.filter(function (x) { return x.status === "bad"; }).length;
    var h = "<div class='pn g'><b>2 · Periksa hasil ekstraksi</b><div class='mt'>" + tag("🟢 " + c.ok + " yakin", "ok") + tag("🟡 " + c.warn + " periksa", "warn") + tag("🔴 " + c.bad + " gagal") + tag(im.items.length + " soal")+ "</div>" + im.warns.map(function (w) { return "<div class='note'>⚠ " + esc(w) + "</div>"; }).join("") +
      "<div class='chips' style='margin-top:10px'>" + [["all", "Semua"], ["ok", "🟢"], ["warn", "🟡"], ["bad", "🔴"], ["img", "🖼 Gambar"]].map(function (f) { return "<a href='javascript:void 0' class='chip g" + (im.f === f[0] ? " on" : "") + "' data-ra='pv-f' data-v2='" + f[0] + "'>" + f[1] + "</a>"; }).join("") + "</div></div>";
    h += pvTray();
    im.items.forEach(function (x, i) {
      if (im.f === "img") { if (!(x.imgs && x.imgs.length) && !/gambar|tabel/i.test((x.notes || []).join(" "))) return; }
      else if (im.f !== "all" && x.status !== im.f) return;
      h += "<div class='rn-it g " + x.status + (x.active === false ? " off" : "") + "' id='pv" + i + "'><div class='rn-hd'><b>#" + (x.num || "?") + "</b><span class='rn-s-" + x.status + "'>● " + STC[x.status][1] + "</span>" + (x.via ? tag("via " + esc(x.via)) : "") + (x.page ? tag("hal. " + x.page) : "") + "<span class='sp'></span></div>" +
        (x.notes && x.notes.length ? "<div class='note'>" + x.notes.map(esc).join(" · ") + "</div>" : "") + "<div id='pvb" + i + "'>" + pvView(x, i) + "</div><div class='rn-row'><button class='btn s sm' data-ra='pv-edit' data-i='" + i + "'>✎ Edit</button><button class='btn s sm' data-ra='pv-act' data-i='" + i + "'>" + (x.active === false ? "Sertakan" : "Nonaktifkan") + "</button><button class='btn d sm' data-ra='pv-del' data-i='" + i + "'>✕ Hapus</button></div></div>";
    });
    h += "<div class='rn-bar g'><div class='t'>" + inc.length + " soal akan disimpan ke bank soal" + (badInc ? " · <b class='rn-s-bad'>" + badInc + " masih gagal — perbaiki atau hapus/nonaktifkan</b>" : "") + "</div><button class='btn s sm' data-ra='pv-clear'>Batal</button><button class='btn sm' data-ra='pv-save' " + (badInc || !inc.length ? "disabled style='opacity:.45'" : "") + ">💾 Simpan ke Bank Soal</button></div><div id='rnSv'></div>";
    var y = window.scrollY; el.innerHTML = h; window.scrollTo(0, y);
  }
  function pvView(x, i) {
    return "<div class='q'>" + esc(x.q || "(pertanyaan kosong)") + "</div>" + pvImgs(x, i) + LET.map(function (L) { var v = x[L.toLowerCase()]; return v || x.ans === L ? "<div class='o" + (x.ans === L ? " k" : "") + "'>" + L + ". " + esc(v) + (x.ans === L ? " ✔" : "") + "</div>" : ""; }).join("") + (x.expl ? "<div class='rn-ex' style='font-size:12px'><b>Pembahasan:</b> " + esc(x.expl.length > 300 ? x.expl.slice(0, 300) + "…" : x.expl) + "</div>" : "<div class='hint'>Pembahasan: belum tersedia</div>");
  }
  async function pvSave() {
    var im = RS.imp, items = im.items.filter(function (x) { return x.active !== false; }), warn = items.filter(function (x) { return x.status === "warn"; }).length;
    if (warn && !confirm(warn + " soal berstatus KUNING (perlu pemeriksaan). Dengan menyimpan, kamu menyatakan sudah memeriksanya. Lanjutkan?")) return;
    var box = g("rnSv"), added = 0, dup = 0, filled = 0, errs = [], pend = [], seen = {};
    items.forEach(function (x) { (x.imgs || []).forEach(function (m) { if (!m.id && m.data) pend.push(m); }); });
    for (var u = 0; u < pend.length; u++) { // gambar disimpan permanen di server lebih dulu (ID dari isi → aman diulang)
      box.innerHTML = "<div class='hint'>Mengunggah gambar " + (u + 1) + "/" + pend.length + "…</div><div class='rn-prog'><i style='width:" + Math.round((u / pend.length) * 100) + "%'></i></div>";
      if (seen[pend[u].data]) { pend[u].id = seen[pend[u].data]; continue; }
      var ru = await rapi("admin/img", { m: "POST", b: { data: pend[u].data } });
      if (!ru.ok) { box.innerHTML = "<div class='err'>Gagal mengunggah gambar: " + esc((ru.j && ru.j.err) || ru.s) + ". Tidak ada soal yang disimpan; coba lagi atau lepas gambar tsb.</div>"; return; }
      pend[u].id = seen[pend[u].data] = ru.j.id;
    }
    for (var i = 0; i < items.length; i += 50) {
      box.innerHTML = "<div class='hint'>Menyimpan… " + Math.min(i + 50, items.length) + "/" + items.length + "</div><div class='rn-prog'><i style='width:" + Math.round((i / items.length) * 100) + "%'></i></div>";
      var chunk = items.slice(i, i + 50).map(function (x) { return { num: x.num, q: x.q, a: x.a, b: x.b, c: x.c, d: x.d, e: x.e, ans: x.ans, expl: x.expl, ex: x.ex || null, diff: x.diff, img: x.imgs && x.imgs.length ? x.imgs.map(function (m) { return m.id; }).filter(Boolean).join(",") : (x.img || ""), active: x.active !== false }; });
      var r = await rapi("admin/import", { m: "POST", b: { cat: im.cat, src: im.src, items: chunk } });
      if (!r.ok) { box.innerHTML = "<div class='err'>Gagal menyimpan: " + esc((r.j && r.j.err) || r.s) + ". Soal yang sudah tersimpan dilewati otomatis bila diulang.</div>"; return; }
      added += r.j.added; dup += r.j.dup; filled += r.j.filled || 0; (r.j.errors || []).forEach(function (e) { errs.push("soal ke-" + (i + e.i + 1) + ": " + e.err); });
    }
    for (var f = 0; f < im.files.length; f++) { // arsip PDF asli (opsional, perlu R2)
      try { var rr = await fetch("/api/run/admin/up/pdf?cat=" + im.cat + "&name=" + encodeURIComponent(im.files[f].name), { method: "POST", headers: { authorization: "Bearer " + S.t, "content-type": "application/pdf" }, body: im.files[f] }); if (rr.status === 501) break; } catch (e) {}
    }
    RS.imp = null; g("rnPv").innerHTML = "<div class='pn g'><b>✅ Selesai</b><div class='hint'>" + added + " soal disimpan dan aktif" + (dup ? ", " + dup + " dilewati (sudah ada)" : "") + (filled ? ", gambar ditambahkan ke " + filled + " soal lama" : "") + (errs.length ? ", " + errs.length + " ditolak:<br>" + errs.map(esc).join("<br>") : "") + ".</div><a class='btn' href='#/run/admin/q/" + im.cat + "'>Buka bank soal</a></div>";
  }

  async function adminLb(cat, per, k) {
    var cats = await adminCats(); if (!alive(k)) return; var glob = cat === "global";
    var chips = [["all", "Sepanjang waktu"], ["month", "Bulan ini"], ["week", "Minggu ini"]].map(function (p) { return "<a class='chip g" + (per === p[0] ? " on" : "") + "' href='#/run/admin/lb/" + cat + "/" + p[0] + "'>" + p[1] + "</a>"; }).join("");
    setRR("<div class='sec'>LEADERBOARD & PEMAIN</div>" + anav("lb") + "<select class='in' id='rnLbSel' data-adm='1' data-per='" + per + "'><option value='global'" + (glob ? " selected" : "") + ">🌍 Global</option>" + cats.map(function (c) { return "<option value='" + c.id + "'" + (String(c.id) === cat ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select><div class='chips'>" + chips + "</div><div id='rnLbB'><div class='empty'>Memuat…</div></div>" +
      "<div class='pn g'><b>Detail performa mahasiswa</b><label>NIM / username</label><input id='rnUsr' placeholder='G0025001'><button class='btn sm' data-ra='usr'>Lihat riwayat</button><div id='rnUh'></div></div><div class='pn g'><b>Nama samaran pemain</b><div class='hint'>Siapa memakai nama apa. Hapus nama yang tidak pantas — pemain akan tampil sebagai Anonim sampai memilih nama baru.</div><div id='rnNicks' class='rn-sc'><div class='empty'>Memuat…</div></div></div><div class='hint'>Skor tidak dapat diubah dari panel. Semua tindakan admin tercatat di menu Audit.</div>");
    var b = await lbBody(cat, per, glob); if (alive(k) && g("rnLbB")) g("rnLbB").innerHTML = b;
    if (alive(k)) await adminNicks(k);
  }
  async function adminNicks(k) {
    var r = await rapi("admin/nicks"); if (!alive(k) || !g("rnNicks")) return;
    g("rnNicks").innerHTML = r.ok && r.j.rows.length ? "<table class='rn-tb'><tr><th>Nama samaran</th><th>Akun asli</th><th></th></tr>" + r.j.rows.map(function (x) { return "<tr><td><b>" + esc(x.nick) + "</b></td><td>" + esc(nmOf(x.u)) + "<small style='display:block;color:var(--mut)'>" + esc(x.u) + "</small></td><td><button class='btn d sm' data-ra='nick-reset' data-u='" + esc(x.u) + "'>Hapus</button></td></tr>"; }).join("") + "</table>" : "<div class='hint'>" + (r.ok ? "Belum ada yang memilih nama samaran." : "Gagal memuat.") + "</div>";
  }
  async function adminSettings(k) {
    var r = await rapi("settings"); if (!alive(k)) return; if (!r.ok) return setRR(errBox(r)); var s = r.j;
    setRR("<div class='sec'>PENGATURAN GAME</div>" + anav("settings") + "<div class='pn g'>" + chk("sSound", "Efek suara tersedia (pemain tetap bisa mematikan)", s.sound) + chk("sFx", "Efek visual (getaran layar, kilatan, partikel)", s.fx) + chk("sExp", "Fitur pembahasan (global)", s.explain) + chk("sPause", "Izinkan jeda (tombol pause)", s.pause) + "<label>Mode grafis</label><select class='in' id='sGfx'><option value='high'" + (s.gfx === "high" ? " selected" : "") + ">Tinggi (anti-aliasing, partikel penuh)</option><option value='low'" + (s.gfx === "low" ? " selected" : "") + ">Ringan (untuk HP lama)</option></select><button class='btn' data-ra='set-save'>Simpan</button><div class='hint'>Jumlah soal, waktu per soal, pembahasan per kategori, dan status aktif diatur di menu <a href='#/run/admin/cats' style='color:var(--gold)'>Kategori</a>. Status soal diatur di menu Soal.</div></div>");
  }
  async function adminAudit(k) {
    var r = await rapi("admin/audit"); if (!alive(k)) return; if (!r.ok) return setRR(errBox(r));
    setRR("<div class='sec'>AUDIT LOG</div>" + anav("audit") + "<div class='pn g rn-sc'><table class='rn-tb'>" + r.j.rows.map(function (x) { return "<tr><td>" + fdate(x.t) + "</td><td>" + esc(x.act) + "</td><td>" + esc(x.detail) + "</td></tr>"; }).join("") + "</table></div>");
  }

  /* ======================= EVENT ======================= */
  async function refreshCats() { RS.cats = null; }
  document.addEventListener("change", async function (e) {
    var t = e.target; if (!t.closest || !t.closest("#rr")) return;
    if (t.id === "rnLbSel") location.hash = "#/run/" + (t.dataset.adm ? "admin/lb" : "lb") + "/" + t.value + "/" + (t.dataset.per || "all");
    else if (t.id === "rnQCat") { RS.qf = null; location.hash = "#/run/admin/q/" + t.value; }
    else if (t.id === "rnIf") { if (t.files.length) doImport([].slice.call(t.files)); t.value = ""; }
    else if (t.dataset.raFile === "img") {
      var box = t.closest("[data-id],[data-i]"), hid2 = box.querySelector("[data-f=img]"), strip = box.querySelector("[data-strip]"); if (!t.files.length) return; toast("Mengunggah gambar…");
      try {
        for (var fi = 0; fi < t.files.length; fi++) {
          var cur = hid2.value.split(",").filter(Boolean); if (cur.length >= MAXIMG) { toast("Maksimal " + MAXIMG + " gambar."); break; }
          var id = await uploadImg(t.files[fi]); if (cur.indexOf(id) >= 0) continue; cur.push(id); hid2.value = cur.join(",");
          var nd2 = document.createElement("div"); nd2.className = "pvim"; nd2.dataset.iid = id; nd2.innerHTML = "<img alt='' src='/api/run/img/" + esc(id) + "'><button class='x' data-ra='img-rm' data-iid='" + esc(id) + "' title='Lepas gambar'>✕</button>"; if (strip) strip.appendChild(nd2);
        }
        t.value = ""; toast("Gambar terunggah ✓ — klik Simpan");
      } catch (er) { toast(er.message); }
    }
    else if (t.dataset.raFile === "pv-img") {
      var xi2 = RS.imp.items[+t.dataset.i]; if (!t.files.length) return;
      try { for (var fj = 0; fj < t.files.length && (xi2.imgs = xi2.imgs || []).length < MAXIMG; fj++) xi2.imgs.push({ data: await pickImage(t.files[fj]), page: xi2.page || 0, via: "upload", kind: "manual", conf: "ok" }); recount(xi2); pvDraw(); } catch (er) { toast(er.message); }
    }
    else if (t.dataset.raSel === "pv-im-mv" && t.value !== "") {
      var imx = RS.imp, src = imx.items[+t.dataset.i], dst = imx.items[+t.value]; if ((dst.imgs = dst.imgs || []).length >= MAXIMG) return toast("Soal tujuan sudah punya " + MAXIMG + " gambar.");
      var mv = src.imgs.splice(+t.dataset.k, 1)[0]; mv.conf = "ok"; dst.imgs.push(mv); recount(src); recount(dst); pvDraw(); toast("Gambar dipindah ke soal #" + (dst.num || "?"));
    }
    else if (t.dataset.raSel === "pv-un-as" && t.value !== "") {
      var imy = RS.imp, dy = imy.items[+t.value]; if ((dy.imgs = dy.imgs || []).length >= MAXIMG) return toast("Soal tujuan sudah punya " + MAXIMG + " gambar.");
      var mu = imy.un.splice(+t.dataset.k, 1)[0]; delete mu.src; mu.conf = "ok"; dy.imgs.push(mu); recount(dy); pvDraw(); toast("Gambar dipasang ke soal #" + (dy.num || "?"));
    }
  });
  document.addEventListener("click", async function (e) {
    var dz = e.target.closest && e.target.closest("#rnDz"); if (dz) { g("rnIf").click(); return; }
    var b = e.target.closest && e.target.closest("[data-ra]"); if (!b || !b.closest("#rr")) return;
    var a = b.dataset.ra, id = +b.dataset.id, i = +b.dataset.i, v = b.dataset.v2, rv = RS.rv, im = RS.imp;
    try {
      if (a === "cat-reset") { // ulang dari awal: batalkan sesi yang sedang berjalan di kategori ini (mode game maupun mode soal)
        if (b.disabled) return; if (!confirm("Reset ujian di kategori ini? Progres sesi yang sedang berjalan dihapus dan kamu bisa mulai lagi dari soal 1 (skor sesi itu tidak dihitung).")) return;
        b.disabled = true; var rs0 = await rapi("start", { m: "POST", b: { cat: +b.dataset.cid, mode: b.dataset.mode } });
        var ok0 = rs0.ok && rs0.j && rs0.j.sid && rs0.j.status !== "done"; if (ok0) { var ra0 = await rapi("abandon", { m: "POST", b: { sid: rs0.j.sid } }); ok0 = ra0.ok; }
        toast(ok0 ? "Sesi direset ✓ — mulai lagi dari soal 1" : ((rs0.j && rs0.j.err) || "Gagal mereset. Coba lagi.")); RS.cats = null; route(); return;
      }
      if (a === "go-mode") { if (b.dataset.warn && !confirm(b.dataset.warn)) return; location.hash = b.dataset.href; }
      else if (a === "nick-edit") { g("rnNk").className = "pn g rn-nk"; g("rnNk").innerHTML = nickInner(true); var ni = g("rnNkI"); if (ni) { ni.focus(); ni.select(); } }
      else if (a === "nick-cancel") g("rnNk").innerHTML = nickInner(false);
      else if (a === "nick-save") {
        var nv = (g("rnNkI").value || "").trim(); if (!nv) return toast("Nama belum diisi.");
        b.disabled = true; var rn = await rapi("nick", { m: "POST", b: { nick: nv } }); b.disabled = false;
        if (!rn.ok) return toast((rn.j && rn.j.err) || "Gagal menyimpan nama");
        RS.nick = rn.j.nick; toast("Nama tersimpan ✓"); route(); // muat ulang halaman: leaderboard & hasil langsung memakai nama baru
      }
      else if (a === "nick-reset") { if (!confirm("Hapus nama samaran " + nmOf(b.dataset.u) + "?")) return; var rz = await rapi("admin/nick", { m: "POST", b: { u: b.dataset.u, nick: "" } }); toast(rz.ok ? "Nama dihapus" : "Gagal"); route(); }
      else if (a === "qz-begin") quizBegin();
      else if (a === "qz-ans") quizAnswer(b.dataset.v2);
      else if (a === "qz-next") quizNext();
      else if (a === "qz-hp") quizHist(+b.dataset.v2);
      else if (a === "qz-hb") quizBack();
      else if (a === "qz-pause") quizPause();
      else if (a === "qz-resume") quizResume();
      else if (a === "qz-exit") quizExit();
      else if (a === "qz-reset") quizReset();
      else if (a === "rv-n" || a === "rv-p") { var L = rvList(), p = L.indexOf(rv.i) + (a === "rv-n" ? 1 : -1); if (p >= 0 && p < L.length) { rv.i = L[p]; rvDraw(); } }
      else if (a === "rv-go") { rv.i = +v; rvDraw(); } else if (a === "rv-f") { rv.f = v; rv.i = -1; rvDraw(); }
      else if (a === "cat-save") {
        var body = { id: id || undefined, name: g("cn" + id).value, descr: g("cd" + id).value, per_session: +g("cp" + id).value, q_time: +g("ct" + id).value, show_explain: g("cx" + id).checked, active: g("ca" + id).checked };
        var r = await rapi("admin/cat", { m: "POST", b: body }); if (!r.ok) return toast((r.j && r.j.err) || "Gagal"); toast("Tersimpan ✓"); RS.cats = null; route();
      } else if (a === "cat-mv") { var rm = await rapi("admin/cat/move", { m: "POST", b: { id: id, dir: +v } }); if (!rm.ok) toast((rm.j && rm.j.err) || "Gagal"); RS.cats = null; route();
      } else if (a === "cat-del") { if (!confirm("Hapus kategori beserta seluruh bank soalnya? Riwayat permainan tetap tersimpan.")) return; var r2 = await rapi("admin/cat/del", { m: "POST", b: { id: id } }); toast(r2.ok ? "Kategori dihapus" : "Gagal"); RS.cats = null; route(); }
      else if (a === "q-find") { RS.qf.s = g("rnQs").value.trim(); RS.qf.act = g("rnQa").value; RS.qf.pg = 0; route(); }
      else if (a === "q-pg") { RS.qf.pg = Math.max(0, RS.qf.pg + +v); route(); }
      else if (a === "q-edit") { var row = g("qr" + id), it = RS.qrows[i]; row.innerHTML = qEd(it, "data-id='" + id + "'") + "<div class='rn-row'><button class='btn sm' data-ra='q-save' data-id='" + id + "'>💾 Simpan</button><button class='btn s sm' data-ra='q-cancel'>Batal</button></div>"; row.dataset.act = it.active; }
      else if (a === "q-cancel") route();
      else if (a === "q-save") { var row2 = g("qr" + id), o = readEd(row2); o.id = id; o.active = row2.dataset.act === "1" || row2.dataset.act === "true" ? 1 : 0; var r3 = await rapi("admin/q", { m: "POST", b: o }); if (!r3.ok) return toast((r3.j && r3.j.err) || "Gagal menyimpan"); toast("Soal diperbarui ✓"); route(); }
      else if (a === "img-rm") { var bx = b.closest("[data-id],[data-i]"), hid = bx.querySelector("[data-f=img]"); hid.value = hid.value.split(",").filter(function (z) { return z && z !== b.dataset.iid; }).join(","); var nd = b.closest("[data-iid]"); if (nd) nd.remove(); toast("Gambar dilepas — klik Simpan"); }
      else if (a === "q-tog") { await rapi("admin/q/toggle", { m: "POST", b: { ids: [id], active: +v } }); route(); }
      else if (a === "q-del") { if (b.dataset.arm) { await rapi("admin/q/del", { m: "POST", b: { ids: [id] } }); route(); } else { b.dataset.arm = 1; b.textContent = "Yakin hapus?"; setTimeout(function () { b.textContent = "Hapus"; delete b.dataset.arm; }, 2500); } }
      else if (a === "q-exp") {
        var cid = RS.qf.cid, r4 = await rapi("admin/export?cat=" + cid); if (!r4.ok) return toast("Gagal ekspor"); await loadPdfLib();
        var txt = v === "csv" ? "﻿" + AsterionPdf.toCsv(r4.j.rows) : JSON.stringify(r4.j.rows, null, 1), bl = new Blob([txt], { type: v === "csv" ? "text/csv" : "application/json" }), u = URL.createObjectURL(bl), l = document.createElement("a"); l.href = u; l.download = "bank-soal-" + cid + "." + v; l.click(); setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
      }
      else if (a === "pv-f") { im.f = v; pvDraw(); }
      else if (a === "pv-del") { if (confirm("Hapus soal ini dari hasil ekstraksi?")) { im.items.splice(i, 1); pvDraw(); } }
      else if (a === "pv-act") { im.items[i].active = im.items[i].active === false; pvDraw(); }
      else if (a === "pv-clear") { if (confirm("Buang hasil ekstraksi ini?")) { RS.imp = null; g("rnPv").innerHTML = ""; } }
      else if (a === "pv-edit") { var body2 = g("pvb" + i), it2 = im.items[i]; body2.innerHTML = qEd(it2, "data-i='" + i + "'") + "<div class='rn-row'><button class='btn sm' data-ra='pv-ok' data-i='" + i + "'>✔ Selesai edit</button><button class='btn s sm' data-ra='pv-cancel'>Batal</button></div>"; }
      else if (a === "pv-cancel") pvDraw();
      else if (a === "pv-ok") { var o2 = readEd(g("pvb" + i)), it3 = im.items[i]; Object.assign(it3, { q: o2.q, a: o2.a, b: o2.b, c: o2.c, d: o2.d, e: o2.e, expl: o2.expl, diff: o2.diff, num: o2.num, ans: o2.ans || it3.ans || null }); (it3.imgs || []).forEach(function (m) { m.conf = "ok"; }); it3.via = "admin"; recount(it3); pvDraw(); }
      else if (a === "pv-im-rm") { var xi = im.items[i]; xi.imgs.splice(+b.dataset.k, 1); recount(xi); pvDraw(); }
      else if (a === "pv-im-ok") { var xo = im.items[i]; xo.imgs.forEach(function (m) { m.conf = "ok"; }); recount(xo); pvDraw(); }
      else if (a === "pv-crop") await openCrop(i);
      else if (a === "pv-un-rm") { im.un.splice(+b.dataset.k, 1); pvDraw(); }
      else if (a === "pv-save") await pvSave();
      else if (a === "usr") {
        var u2 = g("rnUsr").value.trim().toUpperCase(), r5 = await rapi("admin/sessions?u=" + encodeURIComponent(u2)); if (!r5.ok) return toast("Gagal");
        g("rnUh").innerHTML = r5.j.rows.length ? "<table class='rn-tb' style='margin-top:8px'>" + r5.j.rows.map(function (x) { return "<tr><td>" + fdate(x.fin) + "</td><td>" + esc(x.cat_name) + "</td><td><a style='color:var(--gold)' href='#/run/review/" + esc(x.id) + "'>" + x.score + "/" + x.total + "</a></td><td>" + pct(x.acc) + "</td><td>" + fdur(x.dur) + "</td></tr>"; }).join("") + "</table>" : "<div class='hint'>Belum ada permainan untuk " + esc(u2) + ".</div>";
      }
      else if (a === "set-save") { var r6 = await rapi("admin/settings", { m: "POST", b: { sound: g("sSound").checked, fx: g("sFx").checked, explain: g("sExp").checked, pause: g("sPause").checked, gfx: g("sGfx").value } }); RS.set = null; toast(r6.ok ? "Pengaturan tersimpan ✓" : "Gagal"); }
    } catch (er) { if (er !== 0) toast(er.message || "Terjadi kesalahan"); }
  });
  document.addEventListener("input", function (e) { /* tidak ada: editor membaca nilai saat disimpan */ });
  document.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target && e.target.id === "rnNkI") { var sb = document.querySelector("#rnNk [data-ra=nick-save]"); if (sb) sb.click(); } });
  ["dragenter", "dragover"].forEach(function (ev) { document.addEventListener(ev, function (e) { var z = e.target.closest && e.target.closest("#rnDz"); if (z) { e.preventDefault(); z.classList.add("on"); } }); });
  document.addEventListener("dragleave", function (e) { var z = e.target.closest && e.target.closest("#rnDz"); if (z) z.classList.remove("on"); });
  document.addEventListener("drop", function (e) { var z = e.target.closest && e.target.closest("#rnDz"); if (z) { e.preventDefault(); z.classList.remove("on"); doImport([].slice.call(e.dataTransfer.files)); } });
})();
