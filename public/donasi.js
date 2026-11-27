/* ASTERION — Donasi: kartu di beranda, formulir pilih tampilan nama (anonim/NIM/nama/acak), kode untuk pesan Saweria,
   dinding donatur, dan pengelolaan admin. Memakai /api/don/*. Bergantung pada global index.html: $, esc, S, api, toast, Dlg. */
(function () {
  if (window.DON) return;
  var DON = window.DON = {}, box = null, info = { url: "", auto: false };

  var css = "#don{position:fixed;inset:0;z-index:10005;background:rgba(10,6,22,.72);display:flex;align-items:flex-end;justify-content:center;font:14px/1.5 Inter,system-ui,sans-serif}#don[hidden]{display:none}" +
    "#don .dx{width:min(520px,100%);max-height:92dvh;overflow:auto;background:#1c1434;color:#fff;border-radius:20px 20px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px));border:1px solid rgba(255,255,255,.18)}" +
    "@media(min-width:600px){#don{align-items:center}#don .dx{border-radius:20px}}:root[data-theme=light] #don .dx{background:#fff;color:#241a3f;border-color:rgba(0,0,0,.15)}" +
    "#don h3{margin:0 0 4px;font:600 15px Cinzel,serif;letter-spacing:.08em;color:#f5c04a}#don h4{margin:16px 0 6px;color:#f5c04a;font-size:13px}#don .mu{opacity:.75;font-size:12px}#don button{font:inherit;color:inherit;cursor:pointer}" +
    "#don .row{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border:1px solid rgba(128,128,160,.4);border-radius:12px;margin:6px 0;cursor:pointer}#don .row.on{border-color:#f5c04a;background:rgba(245,192,74,.1)}#don .row input{margin-top:3px}" +
    "#don .bt{border:1px solid rgba(128,128,160,.5);background:rgba(128,128,160,.15);border-radius:10px;padding:8px 14px;margin:6px 6px 0 0}#don .bt.p{background:#f5c04a;color:#1b1233;border-color:#f5c04a;font-weight:600}" +
    "#don .code{font:700 26px ui-monospace,monospace;letter-spacing:.12em;text-align:center;color:#f5c04a;padding:10px;border:2px dashed #f5c04a;border-radius:14px;margin:10px 0}" +
    "#don .wl{display:flex;justify-content:space-between;gap:8px;padding:6px 2px;border-bottom:1px solid rgba(128,128,160,.25)}#don table{width:100%;border-collapse:collapse;font-size:12.5px}#don td{border-bottom:1px solid rgba(128,128,160,.3);padding:5px 4px;vertical-align:top}" +
    "#don .no{color:#f87171}#don .ok{color:#4ade80}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var rp = function (n) { return "Rp" + Number(n || 0).toLocaleString("id-ID") };
  async function J(p, o) { var r = await api(p, o); if (!r.ok) throw new Error((r.j && r.j.err) || "kode " + r.s); return r.j }

  /* kartu di beranda: disisipkan tiap kali #main dirender ulang di tab beranda */
  function ensureCard() {
    var m = $("main"); if (!m || document.body.dataset.r !== "home" || $("donCard") || !S.t) return;
    var a = document.createElement("a"); a.id = "donCard"; a.className = "card g"; a.href = "#"; a.style.marginTop = "6px";
    a.innerHTML = "<span class='i'>❤️</span><span class='t'>Dukung ASTERION<small>Donasi untuk server &amp; AI · nama donatur tampil di sini</small></span><span class='a'>›</span>";
    a.addEventListener("click", function (e) { e.preventDefault(); open() });
    m.appendChild(a);
  }
  function init() {
    var m = $("main"); if (!m) return;
    new MutationObserver(ensureCard).observe(m, { childList: true }); ensureCard();
  }

  function shell() {
    if (!box) { box = document.createElement("div"); box.id = "don"; document.body.appendChild(box); box.addEventListener("click", onClick); box.addEventListener("change", onChange) }
    box.hidden = false; return box;
  }
  async function open() {
    var b = shell(); b.innerHTML = "<div class='dx'><div class='mu'>Memuat…</div></div>";
    try { info = await J("don/info") } catch (e) {}
    draw(null);
    loadWall();
  }
  function draw(res) {
    var nm = (window.MHS && MHS[S.u]) || "", adm = S.admin;
    var modes = [["acak", "Nama acak", "contoh: Sahabat Cemara Bijak"], ["anon", "Anonim", "tampil sebagai “Hamba Allah”"]].concat(adm ? [] : [["nim", "NIM", esc(S.u)], ["nama", "Nama", esc(nm || "namamu di daftar mahasiswa")]]);
    box.innerHTML = "<div class='dx'><h3>DUKUNG ASTERION ❤️</h3><div class='mu'>Donasi dipakai untuk biaya server dan AI. Berapa pun sangat berarti — terima kasih!</div>" +
      (res ? "<h4>Kode donasimu</h4><div class='code' id='dnC'>" + esc(res.code) + "</div><ol style='margin:6px 0 6px 18px;padding:0'><li>Buka halaman Saweria.</li><li>Tulis kode di atas di kolom <b>pesan</b> (boleh ditambah kalimat lain).</li><li>Selesaikan pembayaran. " + (res.auto ? "Namamu otomatis tampil di dinding setelah pembayaran terverifikasi." : "Namamu tampil setelah admin menyetujui.") + "</li></ol><p>" +
        "<button class='bt' data-a='copy'>Salin kode</button>" + (res.url ? "<a class='bt p' style='display:inline-block;text-decoration:none' href='" + esc(res.url) + "' target='_blank' rel='noopener noreferrer'>Buka Saweria ↗</a>" : "<span class='no'>Tautan Saweria belum diatur admin.</span>") + "</p><button class='bt' data-a='again'>Ubah pilihan</button>"
        : "<h4>Nama yang tampil di dinding donatur</h4>" + modes.map(function (m, i) { return "<label class='row" + (i === 0 ? " on" : "") + "'><input type='radio' name='dnM' value='" + m[0] + "'" + (i === 0 ? " checked" : "") + "><span><b>" + m[1] + "</b><br><span class='mu'>" + m[2] + "</span></span></label>" }).join("") +
        "<label class='row'><input type='checkbox' id='dnA'><span><b>Tampilkan nominal donasi</b><br><span class='mu'>Hanya jika kamu mau. Default: tidak ditampilkan.</span></span></label><button class='bt p' data-a='go'>Buat kode donasi</button>") +
      "<h4>Terima kasih kepada ❤️</h4><div id='dnW'><div class='mu'>Memuat…</div></div>" +
      (S.admin ? "<h4>Admin</h4><button class='bt' data-a='adm'>Kelola donatur</button>" : "") +
      "<p style='text-align:right;margin:14px 0 0'><button class='bt' data-a='x'>Tutup</button></p></div>";
  }
  async function loadWall() {
    try {
      var j = await J("don/wall"), el = $("dnW"); if (!el) return;
      el.innerHTML = j.items.length ? j.items.map(function (x) { return "<div class='wl'><span>" + esc(x.name) + "</span><span class='mu'>" + (x.amount ? rp(x.amount) + " · " : "") + esc((x.at || "").slice(0, 10)) + "</span></div>" }).join("") : "<div class='mu'>Belum ada donatur. Jadilah yang pertama! 🌱</div>";
    } catch (e) { var el2 = $("dnW"); if (el2) el2.innerHTML = "<div class='no'>" + esc(e.message) + "</div>" }
  }

  /* ---------- admin ---------- */
  async function admin() {
    var j = await J("don/admin/list"), l = j.items || [];
    box.innerHTML = "<div class='dx'><h3>KELOLA DONATUR</h3><div class='mu'>" + (j.auto ? "Webhook Saweria aktif (stream key terpasang)." : "SAWERIA_STREAM_KEY belum dipasang: semua donasi menunggu persetujuan manual.") + " “Pending” = belum terverifikasi; periksa dulu di dashboard Saweria sebelum menyetujui.</div>" +
      "<p><button class='bt p' data-a='add'>+ Catat donasi manual</button><button class='bt' data-a='back'>‹ Kembali</button></p><table>" +
      (l.length ? l.map(function (x) { return "<tr><td><b>" + esc(x.display) + "</b><div class='mu'>" + esc(x.mode) + (x.u ? " · " + esc(x.u) : "") + " · " + (x.amount ? rp(x.amount) : "-") + (x.show_amount ? " (tampil)" : "") + "<br>Saweria: " + esc(x.raw_name || "-") + " — " + esc((x.message || "").slice(0, 60)) + "</div></td><td><span class='" + (x.status === "paid" ? "ok" : x.status === "pending" ? "no" : "mu") + "'>" + x.status + (x.status === "pending" || x.sig_ok ? "" : "") + "</span></td><td style='white-space:nowrap'>" +
        (x.status !== "paid" ? "<button class='bt' data-s='paid' data-id='" + x.id + "'>Setujui</button>" : "<button class='bt' data-s='hidden' data-id='" + x.id + "'>Sembunyikan</button>") + "<button class='bt' data-ed='" + x.id + "' data-n='" + esc(x.display) + "'>Nama</button><button class='bt' data-dl='" + x.id + "'>Hapus</button></td></tr>" }).join("") : "<tr><td class='mu'>Belum ada data.</td></tr>") + "</table></div>";
  }

  async function onClick(e) {
    var t = e.target, a = t.closest("[data-a]"), s = t.closest("[data-s]"), ed = t.closest("[data-ed]"), dl = t.closest("[data-dl]"), rw = t.closest(".row");
    var f = function (p) { p.catch(function (er) { toast(er && er.message || "Gagal") }) };
    if (rw) setTimeout(function () { [].forEach.call(box.querySelectorAll(".row"), function (r) { var i = r.querySelector("input"); r.classList.toggle("on", i.checked) }) }, 0);
    if (s) { f(J("don/admin/set", { m: "POST", b: { id: s.dataset.id, status: s.dataset.s } }).then(admin)); return }
    if (ed) { var n = await Dlg.prompt("Nama yang tampil", ed.dataset.n, { title: "Ubah nama" }); if (n) f(J("don/admin/set", { m: "POST", b: { id: ed.dataset.ed, display: n } }).then(admin)); return }
    if (dl) { if (await Dlg.confirm("Hapus catatan donasi ini?")) f(J("don/admin/del", { m: "POST", b: { id: dl.dataset.dl } }).then(admin)); return }
    if (!a) return;
    var k = a.dataset.a;
    if (k === "x") box.hidden = true;
    else if (k === "go") f(J("don/pledge", { m: "POST", b: { mode: (box.querySelector("input[name=dnM]:checked") || {}).value, show_amount: $("dnA").checked } }).then(function (r) { draw(r); loadWall() }));
    else if (k === "again") { draw(null); loadWall() }
    else if (k === "copy") { var c = $("dnC"); if (c && navigator.clipboard) navigator.clipboard.writeText(c.textContent).then(function () { toast("Kode disalin") }) }
    else if (k === "adm") f(admin());
    else if (k === "back") { draw(null); loadWall() }
    else if (k === "add") { var nm = await Dlg.prompt("Nama yang tampil (mis. Hamba Allah)", "Hamba Allah", { title: "Donasi manual" }); if (!nm) return; var am = await Dlg.prompt("Nominal (Rp, kosongkan bila tidak ditampilkan)", "", { title: "Nominal" }); f(J("don/admin/add", { m: "POST", b: { display: nm, amount: am, show_amount: !!(am && +am > 0) } }).then(admin)) }
  }
  function onChange() { /* radio/centang ditangani lewat klik */ }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
