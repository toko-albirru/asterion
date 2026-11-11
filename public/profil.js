/* ASTERION — halaman Profil & progres.
   Dimuat setelah run.js, sebelum skrip utama index.html; memakai $, esc, api, S, toast, myName, skel milik halaman utama.
   Data dari GET /api/run/me (streak, target harian, statistik per kuliah, jam fokus, badge). */
(function () {
  "use strict";
  var token = 0;
  var pct = function (x) { return (Math.round((x || 0) * 10) / 10).toString().replace(".", ",") + "%"; };
  var fmin = function (m) { m = Math.round(m || 0); var h = Math.floor(m / 60); return h ? h + " j " + (m % 60) + " m" : m + " m"; };
  var FZ = [[0.9, "A−", "Kecil"], [1, "A", "Normal"], [1.15, "A+", "Besar"], [1.3, "A++", "Sangat besar"]];

  var CSS = ".pf-hd{display:flex;align-items:center;gap:12px;padding:14px}.pf-av{flex:none;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font:800 24px Cinzel,serif;color:#241a3f;background:linear-gradient(135deg,#f5c04a,#b18cff)}" +
    ".pf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px;margin:10px 0}.pf-st{border-radius:16px;padding:12px 6px;text-align:center}.pf-st b{display:block;font-size:20px}.pf-st small{color:var(--mut);font-size:11px}" +
    ".pf-bars{display:flex;align-items:flex-end;gap:6px;height:84px;margin:8px 0 2px}.pf-bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;font-size:10px;color:var(--mut)}.pf-bar i{display:block;width:100%;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#b18cff,#6d4bd1);min-height:3px}.pf-bar.td i{background:linear-gradient(180deg,#fbd36a,#f5c04a)}.pf-bar.z i{background:rgba(127,127,160,.3)}" +
    ".pf-cat{margin:8px 0}.pf-cat .row{display:flex;justify-content:space-between;gap:8px;font-size:13px}.pf-cat .bar{height:8px;border-radius:99px;background:rgba(127,127,160,.25);overflow:hidden;margin-top:4px}.pf-cat .bar i{display:block;height:100%;border-radius:99px}" +
    ".pf-bd{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.pf-b{border-radius:16px;padding:10px 8px;text-align:center;font-size:12px;line-height:1.35}.pf-b .ic{font-size:28px;display:block}.pf-b.lock{opacity:.5;filter:grayscale(.85)}.pf-b.got{box-shadow:0 0 0 1.5px rgba(245,192,74,.7)}.pf-b small{color:var(--mut);display:block}" +
    ".pf-fz{display:flex;gap:6px;flex-wrap:wrap}.pf-fz button{flex:1;min-width:60px;padding:9px 6px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.08);color:inherit;font:600 13px Inter,sans-serif;cursor:pointer}.pf-fz button.on{background:linear-gradient(135deg,rgba(245,192,74,.4),rgba(245,192,74,.12));border-color:rgba(245,192,74,.6)}" +
    ":root[data-theme='light'] .pf-fz button{background:rgba(48,28,88,.08)}.pf-goal{display:flex;gap:8px;align-items:center;margin-top:8px}.pf-goal input{width:90px;padding:9px;border-radius:10px;border:1px solid var(--line);background:rgba(10,6,28,.5);color:#fff;font:400 15px Inter,sans-serif}" +
    ":root[data-theme='light'] .pf-goal input{background:#fff;color:#241a3f;border-color:rgba(48,28,88,.22)}";
  (function () { var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); })();

  function fzNow() { try { return +localStorage.getItem("ast.fz") || 1; } catch (e) { return 1; } }
  function fzSet(v) { try { localStorage.setItem("ast.fz", v); } catch (e) {} document.documentElement.style.setProperty("--fz", v); }

  function fzHtml() {
    var cur = fzNow();
    return "<div class='sec'>TAMPILAN</div><div class='pn g'><b>🔠 Ukuran teks</b><div class='hint'>Memperbesar atau memperkecil isi halaman. Tersimpan di perangkat ini.</div><div class='pf-fz' data-pf='fz'>" +
      FZ.map(function (f) { return "<button data-fz='" + f[0] + "' class='" + (Math.abs(cur - f[0]) < 0.01 ? "on" : "") + "' title='" + f[2] + "'>" + f[1] + "</button>"; }).join("") + "</div></div>";
  }

  function body(j) {
    var t = j.total, acc = t.n ? t.c / t.n * 100 : 0, gp = j.goal > 0 ? Math.min(100, j.today / j.goal * 100) : 0;
    var nick = ""; // nama samaran leaderboard ditampilkan bila sudah dipakai di GAME KUIS (RS ada di run.js; di sini cukup nama asli)
    var h = "<div class='pn g pf-hd'><div class='pf-av'>" + esc((myName() || "?").charAt(0).toUpperCase()) + "</div><div style='min-width:0'><b style='font-size:17px'>" + esc(myName()) + "</b><div class='hint' style='margin:2px 0 0'>" + esc(S.u) + nick + "</div></div></div>";
    h += "<div class='pf-grid'>" +
      "<div class='pf-st g'><b>🔥 " + j.streak + "</b><small>Streak (hari)</small></div>" +
      "<div class='pf-st g'><b>🏅 " + j.best + "</b><small>Streak terbaik</small></div>" +
      "<div class='pf-st g'><b>" + t.n + "</b><small>Soal dikerjakan</small></div>" +
      "<div class='pf-st g'><b>" + pct(acc) + "</b><small>Akurasi</small></div>" +
      "<div class='pf-st g'><b>" + t.days + "</b><small>Hari belajar</small></div>" +
      "<div class='pf-st g'><b>" + fmin(j.focus.all) + "</b><small>Total waktu fokus</small></div>" +
      "<div class='pf-st g'><b>" + t.sessions + "</b><small>Sesi selesai</small></div>" +
      "<div class='pf-st g'><b>🔖 " + t.marks + "</b><small>Soal tersimpan</small></div></div>";
    h += "<div class='hint' style='text-align:center;margin:-2px 0 6px'>Streak dihitung dari hari berturut-turut dengan minimal 1 soal dikerjakan.</div>";

    // target harian + 7 hari terakhir
    var mx = Math.max(j.goal || 0, 1); j.week.forEach(function (w) { if (w.n > mx) mx = w.n; });
    h += "<div class='sec'>TARGET HARIAN</div><div class='pn g'><div class='rn-hd' style='display:flex;justify-content:space-between;gap:8px'><b>Hari ini: " + j.today + (j.goal > 0 ? "/" + j.goal : "") + " soal" + (j.goal > 0 && j.today >= j.goal ? " ✅" : "") + "</b><span class='hint' style='margin:0'>" + j.goalDays + " hari target tercapai</span></div>" +
      (j.goal > 0 ? "<div class='rn-prog'><i style='width:" + gp + "%'></i></div>" : "") +
      "<div class='pf-bars'>" + j.week.map(function (w) { return "<div class='pf-bar" + (w.today ? " td" : "") + (w.n ? "" : " z") + "'>" + (w.n || "") + "<i style='height:" + Math.round(w.n / mx * 100) + "%'></i><span>" + esc(w.d.slice(3)) + "/" + esc(w.d.slice(0, 2)) + "</span></div>"; }).join("") + "</div>" +
      "<div class='pf-goal'><label for='pfGoal' style='font-size:12px'>Target per hari</label><input id='pfGoal' type='number' min='0' max='500' inputmode='numeric' value='" + j.goal + "'><button class='btn sm' data-pf='goal' style='margin:0'>💾 Simpan</button></div><div class='hint' style='margin:6px 0 0'>Isi 0 untuk mematikan target harian.</div></div>";

    // jam fokus per minggu
    var fm = Math.max.apply(null, j.focus.weeks.map(function (w) { return w.min; }).concat([60]));
    h += "<div class='sec'>JAM FOKUS PER MINGGU</div><div class='pn g'><div class='hint' style='margin:0 0 6px'>Dari Mode Fokus 🎯 dan Pomodoro 🍅 (tombol Fokus di pojok layar).</div><div class='pf-bars'>" +
      j.focus.weeks.map(function (w, i) { return "<div class='pf-bar" + (i === j.focus.weeks.length - 1 ? " td" : "") + (w.min ? "" : " z") + "'>" + (w.min ? fmin(w.min) : "") + "<i style='height:" + Math.round(w.min / fm * 100) + "%'></i><span>" + esc(w.label) + "</span></div>"; }).join("") + "</div></div>";

    // kekuatan & kelemahan per kuliah
    var cats = j.cats.slice().sort(function (a, b) { return a.acc - b.acc; });
    h += "<div class='sec'>KEKUATAN &amp; KELEMAHAN PER KULIAH</div><div class='pn g'>";
    if (!cats.length) h += "<div class='hint' style='margin:0'>Belum ada soal yang dikerjakan. Mulai dari GAME KUIS.</div>";
    else {
      h += "<div class='hint' style='margin:0 0 6px'>Diurutkan dari yang paling lemah. Hijau ≥ 80% · kuning 60–79% · merah &lt; 60%. Data kurang dari 10 soal belum dianggap pasti.</div>";
      cats.forEach(function (c) {
        var col = c.acc >= 80 ? "var(--ok)" : c.acc >= 60 ? "var(--warn)" : "var(--bad)", lb = c.n < 10 ? "data sedikit" : c.acc >= 80 ? "kuat" : c.acc >= 60 ? "cukup" : "lemah";
        h += "<div class='pf-cat'><div class='row'><span>" + esc(c.name) + "</span><b style='color:" + col + "'>" + pct(c.acc) + "</b></div><div class='bar'><i style='width:" + Math.max(2, c.acc) + "%;background:" + col + "'></i></div><div class='hint' style='margin:2px 0 0'>" + c.c + "/" + c.n + " benar · " + lb + "</div></div>";
      });
      var weak = cats.filter(function (c) { return c.n >= 10 && c.acc < 70; })[0];
      if (weak) h += "<a class='btn s sm' href='#/run/relax/" + weak.id + "/wrong' style='margin-top:10px;display:block;text-align:center;text-decoration:none'>🔁 Ulangi soal yang salah di “" + esc(weak.name) + "”</a>";
    }
    h += "</div>";

    // badge
    h += "<div class='sec'>BADGE (" + j.badges.filter(function (b) { return b.got; }).length + "/" + j.badges.length + ")</div><div class='pf-bd'>" +
      j.badges.map(function (b) { return "<div class='pf-b g " + (b.got ? "got" : "lock") + "'><span class='ic'>" + b.icon + "</span><b>" + esc(b.name) + "</b><small>" + (b.got ? "Diraih ✓" : esc(b.desc) + " (" + b.now + "/" + b.goal + ")") + "</small></div>"; }).join("") + "</div>";

    h += fzHtml();
    h += "<div class='sec'>PINTASAN</div><a class='card g' href='#/run/saved'><span class='i'>🔖</span><span class='t'>Soal tersimpan<small>Soal penting untuk dibaca ulang</small></span><span class='a'>›</span></a>" +
      "<a class='card g' href='#/run/hist'><span class='i'>🕘</span><span class='t'>Riwayat permainan</span><span class='a'>›</span></a>" +
      "<a class='card g' href='#/run/lb/global'><span class='i'>🏆</span><span class='t'>Leaderboard global</span><span class='a'>›</span></a>";
    return h;
  }

  async function fill(k) {
    var r = await api("run/me"); var el = document.getElementById("pf"); if (k !== token || !el) return;
    if (!r.ok) { el.innerHTML = (r.s === 503 ? "<div class='pn g empty'>Database GAME KUIS belum terpasang, jadi progres belum bisa ditampilkan.</div>" : "<div class='pn g empty'>Gagal memuat profil. Coba lagi.</div>") + fzHtml(); return; }
    if (r.j.admin) { el.innerHTML = "<div class='pn g empty'>Akun admin tidak punya statistik belajar pribadi.</div>" + fzHtml(); return; }
    el.innerHTML = body(r.j);
    if (r.j.fresh && r.j.fresh.length) {
      var names = r.j.badges.filter(function (b) { return r.j.fresh.indexOf(b.id) >= 0; }).map(function (b) { return b.icon + " " + b.name; });
      if (names.length) toast("🏅 Badge baru: " + names.slice(0, 3).join(", "));
    }
  }

  window.pProfil = function () {
    var k = ++token; setTimeout(function () { fill(k); }, 0);
    return "<a class='btn s sm' href='#/' style='display:inline-block;text-decoration:none;margin:0 0 8px'>‹ Beranda</a><div id='pf'>" + (window.skel ? skel(4) : "") + "</div>";
  };

  document.addEventListener("click", async function (e) {
    var b = e.target.closest && e.target.closest("#pf [data-pf], #pf [data-fz]"); if (!b) return;
    if (b.dataset.fz) { fzSet(+b.dataset.fz); [].forEach.call(document.querySelectorAll("#pf [data-fz]"), function (x) { x.classList.toggle("on", x === b); }); return; }
    if (b.dataset.pf === "goal") {
      var n = parseInt((document.getElementById("pfGoal") || {}).value, 10);
      if (!isFinite(n) || n < 0 || n > 500) return toast("Target harus 0–500 soal.");
      b.disabled = true; var r = await api("run/prefs", { m: "POST", b: { daily_goal: n } }); b.disabled = false;
      if (!r.ok) return toast((r.j && r.j.err) || "Gagal menyimpan target");
      toast(n > 0 ? "Target harian: " + n + " soal ✓" : "Target harian dimatikan"); fill(token);
    }
  });
})();
