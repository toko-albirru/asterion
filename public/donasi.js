/* ASTERION — Donasi: teks berjalan donatur di beranda, kartu "Dukung ASTERION", formulir pilihan nama (anonim/NIM/nama/nama sendiri),
   kode untuk pesan Saweria, dan pengelolaan admin. Memakai /api/don/*. Bergantung pada global index.html: $, esc, S, api, toast, Dlg. */
(function () {
  if (window.DON) return;
  var DON = window.DON = {}, box = null, info = { url: "", auto: false }, WALL = null, WALL_T = 0, busy = false;

  var css = ".dtk{overflow:hidden;white-space:nowrap;border-radius:14px;border:1px solid rgba(245,192,74,.4);background:rgba(245,192,74,.09);padding:9px 0;margin:0 0 12px;cursor:pointer;font-size:13.5px}" +
    ".dtk .tr{display:inline-flex;animation:dtk var(--d,30s) linear infinite;will-change:transform}.dtk:hover .tr,.dtk:active .tr{animation-play-state:paused}" +
    ".dtk .tg{display:inline-flex;gap:38px;padding-right:38px}.dtk .tg i{font-style:italic;opacity:.8}.dtk .tg b{color:#f5c04a}@keyframes dtk{from{transform:translateX(0)}to{transform:translateX(-50%)}}" +
    "@media(prefers-reduced-motion:reduce){.dtk{overflow-x:auto}.dtk .tr{animation:none}}" +
    "#don{position:fixed;inset:0;z-index:10005;background:rgba(10,6,22,.72);display:flex;align-items:flex-end;justify-content:center;font:14px/1.5 Inter,system-ui,sans-serif}#don[hidden]{display:none}" +
    "#don .dx{width:min(520px,100%);max-height:92dvh;overflow:auto;background:#1c1434;color:#fff;border-radius:20px 20px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px));border:1px solid rgba(255,255,255,.18)}" +
    "@media(min-width:600px){#don{align-items:center}#don .dx{border-radius:20px}}:root[data-theme=light] #don .dx{background:#fff;color:#241a3f;border-color:rgba(0,0,0,.15)}" +
    "#don h3{margin:0 0 4px;font:600 15px Cinzel,serif;letter-spacing:.08em;color:#f5c04a}#don h4{margin:16px 0 6px;color:#f5c04a;font-size:13px}#don .mu{opacity:.75;font-size:12px}#don button{font:inherit;color:inherit;cursor:pointer}" +
    "#don .row{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border:1px solid rgba(128,128,160,.4);border-radius:12px;margin:6px 0;cursor:pointer}#don .row.on{border-color:#f5c04a;background:rgba(245,192,74,.1)}#don .row input[type=radio],#don .row input[type=checkbox]{margin-top:3px}" +
    "#don input[type=text]{width:100%;box-sizing:border-box;margin-top:6px;border-radius:10px;border:1px solid rgba(128,128,160,.5);background:rgba(128,128,160,.12);color:inherit;padding:8px 10px;font:inherit}" +
    "#don .bt{border:1px solid rgba(128,128,160,.5);background:rgba(128,128,160,.15);border-radius:10px;padding:8px 14px;margin:6px 6px 0 0}#don .bt.p{background:#f5c04a;color:#1b1233;border-color:#f5c04a;font-weight:600}" +
    "#don .code{font:700 26px ui-monospace,monospace;letter-spacing:.12em;text-align:center;color:#f5c04a;padding:10px;border:2px dashed #f5c04a;border-radius:14px;margin:10px 0}" +
    "#don .imp{background:rgba(245,192,74,.16);border:1px solid #f5c04a;border-radius:12px;padding:9px 11px;margin:8px 0;font-size:14px}#don .imp b{color:#f5c04a;font-size:15px}" +
    "#don table{width:100%;border-collapse:collapse;font-size:12.5px}#don td{border-bottom:1px solid rgba(128,128,160,.3);padding:5px 4px;vertical-align:top}#don .no{color:#f87171}#don .ok{color:#4ade80}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var rp = function (n) { return "Rp" + Number(n || 0).toLocaleString("id-ID") };
  async function J(p, o) { var r = await api(p, o); if (!r.ok) throw new Error((r.j && r.j.err) || "kode " + r.s); return r.j }

  /* ---------- beranda: teks berjalan + kartu ---------- */
  async function wall() {
    if (WALL && Date.now() - WALL_T < 300000) return WALL;
    var j = await J("don/wall"); WALL = j.items || []; WALL_T = Date.now(); return WALL;
  }
  function tickerEl(items) {
    var L = items.slice(), chars = function (a) { return a.reduce(function (n, x) { return n + x.name.length + (x.msg ? x.msg.length : 0) + 6 }, 0) };
    for (var g = 0; chars(L) < 130 && g < 8; g++) L = L.concat(items); // cukup panjang agar putaran tidak kosong
    var grp = "<span class='tg'>" + L.map(function (x) { return "<span>❤️ <b>" + esc(x.name) + "</b>" + (x.amount ? " · " + rp(x.amount) : "") + (x.msg ? " <i>“" + esc(x.msg) + "”</i>" : "") + "</span>" }).join("") + "</span>";
    var el = document.createElement("div"); el.id = "donTk"; el.className = "dtk"; el.setAttribute("role", "marquee"); el.setAttribute("aria-label", "Terima kasih kepada para donatur");
    el.innerHTML = "<div class='tr' style='--d:" + Math.max(22, Math.round(chars(L) * 0.32)) + "s'>" + grp + grp + "</div>";
    el.addEventListener("click", open); return el;
  }
  function ensure() {
    var m = $("main"); if (!m || document.body.dataset.r !== "home" || !S.t) return;
    if (!$("donCard")) {
      var a = document.createElement("a"); a.id = "donCard"; a.className = "card g"; a.href = "#"; a.style.marginTop = "6px";
      a.innerHTML = "<span class='i'>❤️</span><span class='t'>Dukung ASTERION<small>Donasi untuk server &amp; AI</small></span><span class='a'>›</span>";
      a.addEventListener("click", function (e) { e.preventDefault(); open() }); m.appendChild(a);
    }
    if (!$("donTk") && !busy) {
      busy = true;
      wall().then(function (items) {
        var mm = $("main"); if (!items.length || !mm || document.body.dataset.r !== "home" || $("donTk")) return;
        mm.insertBefore(tickerEl(items), mm.firstChild);
      }).catch(function () {}).then(function () { busy = false });
    }
  }
  function init() { var m = $("main"); if (!m) return; new MutationObserver(ensure).observe(m, { childList: true }); ensure() }

  /* ---------- formulir donasi ---------- */
  function shell() {
    if (!box) { box = document.createElement("div"); box.id = "don"; document.body.appendChild(box); box.addEventListener("click", onClick) }
    box.hidden = false; return box;
  }
  async function open() {
    shell(); box.innerHTML = "<div class='dx'><div class='mu'>Memuat…</div></div>";
    try { info = await J("don/info") } catch (e) {}
    draw(null);
  }
  function draw(res) {
    var nm = (window.MHS && MHS[S.u]) || "", adm = S.admin;
    var modes = [["anon", "Anonim", "tampil sebagai “Hamba Allah”"]].concat(adm ? [] : [["nim", "NIM", esc(S.u)], ["nama", "Nama di daftar mahasiswa", esc(nm || "namamu")]]).concat([["bebas", "Nama pilihanku sendiri", "<input type='text' id='dnN' maxlength='30' placeholder='mis. Hamba Allah, Alumni 2020, atau namamu'>"]]);
    box.innerHTML = "<div class='dx'><h3>DUKUNG ASTERION ❤️</h3><div class='mu'>Donasi dipakai untuk biaya server dan AI. Berapa pun sangat berarti — terima kasih!</div>" +
      (res ? "<h4>Kode donasimu</h4><div class='code' id='dnC'>" + esc(res.code) + "</div>" +
        "<ol style='margin:6px 0 6px 18px;padding:0'><li>Buka halaman Saweria.</li><li><div class='imp'><b>Tulis kode di atas di kolom PESAN Saweria</b> (boleh ditambah kalimat lain).<br><span class='mu'>Kode inilah yang membuat namamu tampil sesuai pilihanmu tadi.</span></div></li><li>Selesaikan pembayaran. " + (res.auto ? "Namamu otomatis muncul di teks berjalan beranda setelah pembayaran terverifikasi." : "Namamu muncul setelah admin menyetujui.") + "</li></ol>" +
        "<p class='mu'>Tanpa kode, namamu tampil sesuai nama yang kamu ketik di Saweria. Pesanmu di Saweria ikut tampil di teks berjalan (tautan dan nomor telepon otomatis dibuang).</p><p>" +
        "<button class='bt' data-a='copy'>Salin kode</button>" + (res.url ? "<a class='bt p' style='display:inline-block;text-decoration:none' href='" + esc(res.url) + "' target='_blank' rel='noopener noreferrer'>Buka Saweria ↗</a>" : "<span class='no'>Tautan Saweria belum diatur admin.</span>") + "</p><button class='bt' data-a='again'>Ubah pilihan</button>"
        : "<h4>Nama yang tampil di teks berjalan</h4>" + modes.map(function (m, i) { return "<label class='row" + (i === 0 ? " on" : "") + "'><input type='radio' name='dnM' value='" + m[0] + "'" + (i === 0 ? " checked" : "") + "><span style='flex:1'><b>" + m[1] + "</b><br><span class='mu'>" + m[2] + "</span></span></label>" }).join("") +
        "<label class='row'><input type='checkbox' id='dnA'><span><b>Tampilkan nominal donasi</b><br><span class='mu'>Hanya jika kamu mau. Default: tidak ditampilkan.</span></span></label><button class='bt p' data-a='go'>Buat kode donasi</button>") +
      (S.admin ? "<h4>Admin</h4><button class='bt' data-a='adm'>Kelola donatur</button>" : "") +
      "<p style='text-align:right;margin:14px 0 0'><button class='bt' data-a='x'>Tutup</button></p></div>";
  }

  /* ---------- admin ---------- */
  async function admin() {
    WALL = null;
    var j = await J("don/admin/list"), l = j.items || [];
    box.innerHTML = "<div class='dx'><h3>KELOLA DONATUR</h3><div class='mu'>" + (j.auto ? "Webhook Saweria aktif (stream key terpasang)." : "SAWERIA_STREAM_KEY belum dipasang: semua donasi menunggu persetujuan manual.") + " “Pending” = belum terverifikasi; periksa dulu di dashboard Saweria sebelum menyetujui. Nama dan pesan yang tampil di teks berjalan bisa diubah atau disembunyikan di sini.</div>" +
      "<p><button class='bt p' data-a='add'>+ Catat donasi / beri nama sendiri</button><button class='bt' data-a='back'>‹ Kembali</button></p><table>" +
      (l.length ? l.map(function (x) { return "<tr><td><b>" + esc(x.display) + "</b><div class='mu'>" + esc(x.mode) + (x.u ? " · " + esc(x.u) : "") + " · " + (x.amount ? rp(x.amount) : "-") + (x.show_amount ? " (nominal tampil)" : "") + "<br>Saweria: " + esc(x.raw_name || "-") + " — “" + esc((x.message || "").slice(0, 80)) + "”</div></td><td><span class='" + (x.status === "paid" ? "ok" : x.status === "pending" ? "no" : "mu") + "'>" + x.status + "</span></td><td style='white-space:nowrap'>" +
        (x.status !== "paid" ? "<button class='bt' data-s='paid' data-id='" + x.id + "'>Setujui</button>" : "<button class='bt' data-s='hidden' data-id='" + x.id + "'>Sembunyikan</button>") + "<button class='bt' data-ed='" + x.id + "' data-n='" + esc(x.display) + "'>Ubah nama</button><button class='bt' data-dl='" + x.id + "'>Hapus</button></td></tr>" }).join("") : "<tr><td class='mu'>Belum ada data.</td></tr>") + "</table></div>";
  }

  async function onClick(e) {
    var t = e.target, a = t.closest("[data-a]"), s = t.closest("[data-s]"), ed = t.closest("[data-ed]"), dl = t.closest("[data-dl]"), rw = t.closest(".row");
    var f = function (p) { p.catch(function (er) { toast(er && er.message || "Gagal") }) };
    if (rw) setTimeout(function () { [].forEach.call(box.querySelectorAll(".row"), function (r) { var i = r.querySelector("input[type=radio],input[type=checkbox]"); if (i) r.classList.toggle("on", i.checked) }); var fr = box.querySelector("input[name=dnM][value=bebas]"); if (fr && fr.checked && $("dnN")) $("dnN").focus() }, 0);
    if (s) { f(J("don/admin/set", { m: "POST", b: { id: s.dataset.id, status: s.dataset.s } }).then(admin)); return }
    if (ed) { var n = await Dlg.prompt("Nama yang tampil", ed.dataset.n, { title: "Ubah nama" }); if (n) f(J("don/admin/set", { m: "POST", b: { id: ed.dataset.ed, display: n } }).then(admin)); return }
    if (dl) { if (await Dlg.confirm("Hapus catatan donasi ini?")) f(J("don/admin/del", { m: "POST", b: { id: dl.dataset.dl } }).then(admin)); return }
    if (!a) return;
    var k = a.dataset.a;
    if (k === "x") { box.hidden = true; WALL = null }
    else if (k === "go") { var mode = (box.querySelector("input[name=dnM]:checked") || {}).value, nmv = $("dnN") ? $("dnN").value : ""; if (mode === "bebas" && !nmv.trim()) { toast("Isi nama pilihanmu dulu"); return } f(J("don/pledge", { m: "POST", b: { mode: mode, name: nmv, show_amount: $("dnA").checked } }).then(function (r) { draw(r) })) }
    else if (k === "again" || k === "back") draw(null);
    else if (k === "copy") { var c = $("dnC"); if (c && navigator.clipboard) navigator.clipboard.writeText(c.textContent).then(function () { toast("Kode disalin") }) }
    else if (k === "adm") f(admin());
    else if (k === "add") { var nm = await Dlg.prompt("Nama yang tampil (bebas, mis. Hamba Allah)", "Hamba Allah", { title: "Catat donasi" }); if (!nm) return; var am = await Dlg.prompt("Nominal (Rp, kosongkan bila tidak ditampilkan)", "", { title: "Nominal" }); f(J("don/admin/add", { m: "POST", b: { display: nm, amount: am, show_amount: !!(am && +am > 0) } }).then(admin)) }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
