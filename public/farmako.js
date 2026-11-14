/* ASTERION — PHARMACOLOGY SESSION (halaman mahasiswa).
   Dimuat setelah run.js; memakai $, esc, api, S, toast, skel, cards milik index.html.
   Semua isi (obat, kategori, interaksi, soal) berasal dari API /api/farmako — tidak ada daftar statis kategori di sini. */
(function () {
  "use strict";
  var F = { route: 0, meta: null, cmp: [], g: { cats: [], mode: "", diff: 0, n: 0 }, play: null, timer: 0, sg: {} };
  var g = function (i) { return document.getElementById(i); };
  var fapi = function (p, o) { return api("farmako/" + p, o); };
  var SRC = { drugbank: "DrugBank", ddinter: "DDInter 2.0", kegg: "KEGG DRUG", pubchem: "PubChem", rxnorm: "RxNorm", chembl: "ChEMBL", openfda: "openFDA (label FDA)", manual: "Entri Admin" };
  var fdate = function (t) { return t ? new Date(t).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—"; };
  var setF = function (h) { var e = g("fm"); if (e) e.innerHTML = h; };
  var alive = function (k) { return F.route === k && g("fm"); };
  var NA = "<span class='fm-na'>Data belum tersedia.</span>";
  var DISC = "<div class='fm-disc'>ⓘ Fitur ini adalah <b>sarana edukasi</b> dan bukan pengganti penilaian klinis profesional. Isi hanya berasal dari data yang telah dimuat dan dipublikasikan di Asterion.</div>";
  var srcName = function (s) { return SRC[s] || s || "—"; };
  var srcTag = function (s, id) { return "<span class='tag fm-src' title='Sumber data'>" + esc(srcName(s)) + (id ? " · " + esc(id) : "") + "</span>"; };
  var stTag = function (st) { var m = (F.meta && F.meta.status) || {}; return "<span class='tag " + (st === "published" ? "ok" : "warn") + "'>" + esc(m[st] || st) + "</span>"; };
  function sevCls(l) { l = String(l || "").toLowerCase(); return l === "contraindicated" || l === "major" ? "bad" : l === "moderate" ? "warn" : l === "minor" ? "ok" : "neu"; }
  var sevTag = function (l) { return "<span class='fm-sev " + sevCls(l) + "'>" + esc(l || "Unknown") + "</span>"; };
  async function meta() { if (!F.meta) { var r = await fapi("meta"); if (r.ok) F.meta = r.j; } return F.meta || { fields: {}, kinds: {}, modes: {}, diffs: {}, status: {}, sections: {} }; }
  window.FM = { api: fapi, srcName: srcName, srcTag: srcTag, stTag: stTag, sevTag: sevTag, fdate: fdate, meta: meta, SRC: SRC, F: F };

  // teks sederhana: paragraf, "- " daftar, tabel "a | b | c", **tebal** (selalu di-escape dulu)
  function md(s) {
    var L = String(s || "").replace(/\r/g, "").split("\n"), out = [], i = 0, inl = function (x) { return esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); };
    var isLi = function (l) { return /^\s*[-•]\s+/.test(l); }, isRow = function (l) { return l != null && l.indexOf("|") >= 0; }, isSep = function (l) { return /^\s*\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/.test(l); };
    while (i < L.length) {
      var l = L[i];
      if (!l.trim()) { i++; continue; }
      if (isLi(l)) { var li = []; while (i < L.length && isLi(L[i])) { li.push("<li>" + inl(L[i].replace(/^\s*[-•]\s+/, "")) + "</li>"); i++; } out.push("<ul>" + li.join("") + "</ul>"); continue; }
      if (isRow(l) && isRow(L[i + 1])) { var rows = []; while (i < L.length && isRow(L[i])) { if (!isSep(L[i])) rows.push(L[i].trim().replace(/^\||\|$/g, "").split("|")); i++; } out.push("<div class='fm-tw'><table class='fm-tb'>" + rows.map(function (r, k) { return "<tr>" + r.map(function (c) { return (k ? "<td>" : "<th>") + inl(c.trim()) + (k ? "</td>" : "</th>"); }).join("") + "</tr>"; }).join("") + "</table></div>"); continue; }
      var p = [l]; i++; while (i < L.length && L[i].trim() && !isLi(L[i]) && !(isRow(L[i]) && isRow(L[i + 1]))) { p.push(L[i]); i++; } out.push("<p>" + inl(p.join(" ")) + "</p>");
    }
    return out.join("");
  }
  window.FM.md = md;
  // pemformat teks label (judul bagian + paragraf) ada di farmako-md.js; dipakai bila tersedia
  if (window.FMmd) { md = window.FMmd; window.FM.md = md; }
  // judul nama obat berhuruf besar di awal kata (metformin -> Metformin); fungsinya di farmako-md.js
  var capn = function (v) { return window.FMmd && window.FMmd.cap ? window.FMmd.cap(v) : String(v == null ? "" : v); };

  var CSS = ".fm-hero{border-radius:24px;padding:20px 18px;margin:6px 0 14px;text-align:center;background:linear-gradient(135deg,rgba(177,140,255,.22),rgba(245,192,74,.12));border:1px solid rgba(245,192,74,.35)}.fm-hero h1{font-size:clamp(24px,7vw,36px);margin:0 0 4px}.fm-hero p{margin:6px 0 4px;color:var(--mut);font-size:13px;line-height:1.5}" +
    ".fm-row{display:flex;flex-wrap:wrap;gap:8px}.fm-row>*{flex:1;min-width:130px}.fm-row>a.btn,.fm-row>button.btn{display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;margin-top:0}a.btn{display:inline-block;text-decoration:none;text-align:center}" +
    ".fm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}.fm-st{border-radius:16px;padding:12px 8px;text-align:center}.fm-st b{display:block;font-size:22px}.fm-st small{color:var(--mut);font-size:11px}" +
    ".fm-chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.fm-chips .chip.on{font-weight:700}" +
    ".fm-sgw{position:relative}.fm-sg{position:absolute;left:0;right:0;top:100%;z-index:60;margin-top:4px;border-radius:14px;max-height:min(60vh,380px);overflow:auto;background:var(--bg1);border:1px solid var(--line);box-shadow:0 14px 34px rgba(8,4,24,.45)}:root[data-theme=light] .fm-sg{background:#fff}" +
    ".fm-it{display:flex;gap:10px;align-items:center;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--line);text-decoration:none;color:inherit}.fm-it:last-child{border-bottom:0}.fm-it.on,.fm-it:hover{background:rgba(245,192,74,.16)}.fm-it .ic{flex:none;font-size:18px}.fm-it .tx{flex:1;min-width:0}.fm-it b{display:block;font-size:14px;overflow-wrap:anywhere}.fm-it small{display:block;color:var(--mut);font-size:11px;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fm-it mark{background:rgba(245,192,74,.4);color:inherit;border-radius:3px;padding:0 1px}.fm-sg .fm-msg{padding:12px;color:var(--mut);font-size:13px}" +
    ".fm-card{padding:14px;border-radius:18px;margin-bottom:10px;display:block;color:inherit;text-decoration:none}.fm-card b{font-size:15px}.fm-card small{display:block;color:var(--mut);font-size:12px;margin-top:3px;line-height:1.45}.fm-card .fm-top{display:flex;gap:8px;align-items:flex-start}.fm-card .fm-top>div{flex:1;min-width:0}" +
    ".fm-na{color:var(--mut);font-style:italic;font-size:13px}.fm-disc{font-size:12px;line-height:1.5;color:var(--mut);padding:10px 12px;border-radius:12px;border:1px dashed var(--line);margin:10px 0}.fm-warn{padding:10px 12px;border-radius:12px;border:1px solid rgba(251,191,36,.5);background:rgba(251,191,36,.12);font-size:13px;line-height:1.5;margin:10px 0}" +
    ".fm-sec{border-radius:18px;padding:14px;margin:10px 0}.fm-sec>h3{margin:0 0 8px;font:700 12px Cinzel,serif;letter-spacing:.14em;color:var(--gold);text-transform:uppercase}.fm-kv{display:grid;grid-template-columns:minmax(110px,32%) 1fr;gap:6px 12px;font-size:13px;line-height:1.5}.fm-kv>b{color:var(--mut);font-weight:600}.fm-kv>div{overflow-wrap:anywhere}@media(max-width:520px){.fm-kv{grid-template-columns:1fr}.fm-kv>b{margin-top:6px}}" +
    ".fm-fact{padding:8px 0;border-bottom:1px dashed var(--line);font-size:13px;line-height:1.55}.fm-fact:last-child{border-bottom:0}.fm-fact .fm-fh{font-weight:700;font-size:12px;color:var(--gold);margin-bottom:3px}.fm-fact .fm-v{white-space:pre-line;overflow-wrap:anywhere}.fm-src{font-size:10px!important;margin:2px 4px 2px 0;display:inline-block}" +
    ".fm-md p{margin:0 0 10px;line-height:1.65;font-size:14px;overflow-wrap:anywhere}.fm-md p:last-child{margin-bottom:0}.fm-md .fm-h{margin:14px 0 6px;font-size:12.5px;font-weight:700;color:var(--gold);letter-spacing:.02em}.fm-md .fm-h2{margin:12px 0 5px;font-size:12px;font-weight:600;color:var(--mut);letter-spacing:.02em}.fm-md .fm-cap{margin:12px 0 6px;font-size:12px;font-weight:600;color:var(--gold);line-height:1.45}.fm-md .fm-cap+div{margin-top:0}.fm-tb th[scope=row]{font-weight:600;color:inherit;white-space:normal;min-width:104px}.fm-tb .fm-n{color:var(--mut);font-weight:400;font-size:11px}.fm-md ul{margin:0 0 10px;padding-left:20px;line-height:1.6;font-size:14px}.fm-tw{overflow-x:auto;margin:0 0 10px}.fm-tb{border-collapse:collapse;width:100%;font-size:13px}.fm-tb th,.fm-tb td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.fm-tb th{color:var(--gold);font-weight:600;white-space:nowrap}" +
    ".fm-sev{display:inline-block;font:700 11px Inter,sans-serif;padding:3px 10px;border-radius:999px;border:1px solid var(--line)}.fm-sev.bad{background:rgba(248,113,113,.22);color:var(--bad);border-color:var(--bad)}.fm-sev.warn{background:rgba(251,191,36,.2);color:var(--warn);border-color:var(--warn)}.fm-sev.ok{background:rgba(74,222,128,.18);color:var(--ok);border-color:var(--ok)}.fm-sev.neu{background:rgba(128,128,160,.2)}" +
    ".fm-pair{border-radius:18px;padding:14px;margin-bottom:12px;border-left:5px solid var(--line)}.fm-pair.bad{border-left-color:var(--bad)}.fm-pair.warn{border-left-color:var(--warn)}.fm-pair.ok{border-left-color:var(--ok)}.fm-pair h4{margin:0 0 6px;font-size:15px}.fm-ib{padding:10px 0;border-top:1px dashed var(--line)}.fm-pick{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.fm-pk{display:inline-flex;align-items:center;gap:6px;padding:6px 6px 6px 12px;border-radius:999px;font-size:13px;font-weight:600}.fm-pk button{border:0;background:rgba(128,128,160,.3);color:inherit;border-radius:50%;width:22px;height:22px;cursor:pointer}" +
    ".fm-bar{position:sticky;bottom:78px;z-index:20;border-radius:16px;padding:10px 12px;margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--bg1);border:1px solid var(--gold)}:root[data-theme=light] .fm-bar{background:#fff}.fm-bar .t{flex:1;font-size:12px;min-width:140px}.fm-bar .btn{margin-top:0}" +
    ".fm-prog{height:8px;border-radius:99px;background:rgba(128,128,160,.25);overflow:hidden;margin:8px 0}.fm-prog i{display:block;height:100%;background:linear-gradient(90deg,#b18cff,#f5c04a);transition:width .25s}" +
    ".fm-crumb{font-size:12px;color:var(--mut);margin:4px 2px 8px}.fm-crumb a{color:var(--gold);text-decoration:none}.fm-x{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.fm-x .sp{flex:1}" +
    ".fm-q{font-size:16px;line-height:1.55;margin:10px 0 14px;overflow-wrap:anywhere}.fm-op{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;color:inherit;cursor:pointer;font:inherit;font-size:14px;line-height:1.45;margin-bottom:8px;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(128,128,160,.1)}.fm-op:hover:not(:disabled){border-color:var(--gold)}.fm-op b{flex:none;width:24px;height:24px;border-radius:50%;background:rgba(245,192,74,.25);display:flex;align-items:center;justify-content:center;font-size:12px}.fm-op:disabled{cursor:default}.fm-op.ok{border-color:var(--ok);background:rgba(74,222,128,.16)}.fm-op.no{border-color:var(--bad);background:rgba(248,113,113,.16)}" +
    ".fm-ex{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(245,192,74,.1);border:1px solid rgba(245,192,74,.35);font-size:13px;line-height:1.5;white-space:pre-line;overflow-wrap:anywhere}.fm-tm{height:6px;border-radius:99px;background:rgba(128,128,160,.25);overflow:hidden}.fm-tm i{display:block;height:100%;width:100%;background:var(--gold);transform-origin:left}.fm-big{text-align:center;padding:22px 10px}.fm-big .sc{font:900 54px Cinzel,serif;color:var(--gold)}" +
    ".fm-cmp th:first-child,.fm-cmp td:first-child{color:var(--gold);font-weight:600;width:28%}.fm-cmp td{font-size:12.5px;line-height:1.5;white-space:pre-line}.fm-star{cursor:pointer;border:0;background:none;font-size:20px;color:var(--gold);padding:2px 6px}.fm-mc{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;margin-bottom:8px;color:inherit;text-decoration:none}.fm-mc .ck{flex:none;width:22px;height:22px;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:12px}.fm-mc.done .ck{background:var(--ok);border-color:var(--ok);color:#06240f}.fm-mc.dis{opacity:.5;pointer-events:none}" +
    ".fm-tbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;border-radius:14px;margin:8px 0 4px}.fm-trb{display:inline-block;font:600 10px Inter,sans-serif;color:var(--mut);margin-left:6px;vertical-align:middle}" +
    ".fm-sel{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:16px;margin-bottom:8px;cursor:pointer}.fm-sel input{width:auto;margin-top:3px}.fm-sel.on{box-shadow:0 0 0 2px var(--gold)}";
  (function () { var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); })();

  /* ======================= SMART SEARCH / AUTOCOMPLETE =======================
     <input data-fmsg="drug|cat|material|game|all" data-pick="go|cb"> — saran dari /api/farmako/suggest (debounce, keyboard, sentuh). */
  var ICON = { drug: "💊", cat: "🗂️", material: "📖" };
  function hl(text, q) { var t = String(text || ""), i = t.toLowerCase().indexOf(String(q).toLowerCase()); if (i < 0 || !q) return esc(t); return esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length)); }
  function hrefOf(it) { return it.t === "drug" ? "#/farmako/obat/" + it.id : it.t === "cat" ? "#/farmako/belajar/" + it.id : "#/farmako/materi/" + it.id; }
  function sgBox(inp) { var w = inp.parentNode, b = w.querySelector(".fm-sg"); if (!b) { b = document.createElement("div"); b.className = "fm-sg g"; b.setAttribute("role", "listbox"); b.hidden = true; w.appendChild(b); } return b; }
  function sgClose(inp) { var b = inp.parentNode.querySelector(".fm-sg"); if (b) b.hidden = true; inp.setAttribute("aria-expanded", "false"); }
  function sgRender(inp, st) {
    var b = sgBox(inp), q = inp.value.trim(); b.hidden = false; inp.setAttribute("aria-expanded", "true");
    if (st.loading && !st.items.length) { b.innerHTML = "<div class='fm-msg'>⏳ Mencari…</div>"; return; }
    if (st.fail) { b.innerHTML = "<div class='fm-msg'>Pencarian gagal. Coba lagi.</div>"; return; }
    if (!st.items.length) { b.innerHTML = "<div class='fm-msg'>Tidak ada hasil untuk “" + esc(q) + "”. Pencarian hanya mencakup data yang sudah dipublikasikan.</div>"; return; }
    b.innerHTML = (st.loading ? "<div class='fm-msg'>⏳ Memperbarui…</div>" : "") + st.items.map(function (it, i) {
      var sub = [it.matched ? "dikenal juga sebagai " + it.matched : "", it.sub, it.descr].filter(Boolean).join(" · ");
      return "<a class='fm-it" + (i === st.sel ? " on" : "") + "' role='option' data-i='" + i + "' href='" + (inp.dataset.pick === "cb" ? "javascript:void(0)" : hrefOf(it)) + "'><span class='ic'>" + (ICON[it.t] || "•") + "</span><span class='tx'><b>" + hl(it.name, q) + "</b><small>" + esc(sub) + "</small></span></a>";
    }).join("");
  }
  function sgPick(inp, it) {
    sgClose(inp);
    if (inp.dataset.pick === "cb") { inp.value = ""; var cb = F.sg[inp.id] && F.sg[inp.id].cb; if (cb) cb(it); return; }
    location.hash = hrefOf(it);
  }
  var sgTimers = {};
  document.addEventListener("input", function (e) {
    var inp = e.target; if (!inp || !inp.dataset || !inp.dataset.fmsg) return;
    var id = inp.id || (inp.id = "sg" + Math.random().toString(36).slice(2, 7)), st = F.sg[id] = F.sg[id] || { items: [], sel: -1, seq: 0 }, q = inp.value.trim();
    clearTimeout(sgTimers[id]);
    if (!q) { st.items = []; sgClose(inp); return; }
    st.loading = true; st.fail = false; sgRender(inp, st);
    sgTimers[id] = setTimeout(async function () {
      var my = ++st.seq;
      try {
        var r = await fapi("suggest?q=" + encodeURIComponent(q) + "&scope=" + (inp.dataset.fmsg || "all") + (inp.dataset.adm ? "&adm=1" : ""));
        if (my !== st.seq) return; st.loading = false;
        if (!r.ok) st.fail = true; else { st.items = r.j.items || []; st.sel = -1; }
      } catch (er) { if (my !== st.seq) return; st.loading = false; st.fail = true; }
      if (document.activeElement === inp) sgRender(inp, st);
    }, 180);
  });
  document.addEventListener("keydown", function (e) {
    var inp = e.target; if (!inp || !inp.dataset || !inp.dataset.fmsg) return;
    var st = F.sg[inp.id]; if (!st) return;
    var b = inp.parentNode.querySelector(".fm-sg"), open = b && !b.hidden;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (!open || !st.items.length) return; e.preventDefault(); st.sel = (st.sel + (e.key === "ArrowDown" ? 1 : -1) + st.items.length) % st.items.length; sgRender(inp, st); var on = b.querySelector(".on"); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter") { if (open && st.items[st.sel >= 0 ? st.sel : 0] && !st.loading) { e.preventDefault(); sgPick(inp, st.items[st.sel >= 0 ? st.sel : 0]); } else if (inp.dataset.pick !== "cb" && inp.dataset.fmsg !== "game" && inp.value.trim()) { e.preventDefault(); sgClose(inp); location.hash = "#/farmako/obat/cari/" + encodeURIComponent(inp.value.trim()); } }
    else if (e.key === "Escape") sgClose(inp);
  });
  document.addEventListener("pointerdown", function (e) { var it = e.target.closest && e.target.closest(".fm-it"); if (it) { e.preventDefault(); var inp = it.closest(".fm-sgw").querySelector("input"), st = F.sg[inp.id]; if (st && st.items[+it.dataset.i]) sgPick(inp, st.items[+it.dataset.i]); return; } document.querySelectorAll(".fm-sg").forEach(function (b) { if (!b.parentNode.contains(e.target)) b.hidden = true; }); });
  document.addEventListener("click", function (e) { var it = e.target.closest && e.target.closest(".fm-it"); if (it) e.preventDefault(); });
  document.addEventListener("focusin", function (e) { var inp = e.target; if (inp && inp.dataset && inp.dataset.fmsg && F.sg[inp.id] && inp.value.trim() && F.sg[inp.id].items.length) sgRender(inp, F.sg[inp.id]); });
  function searchBox(id, scope, ph, pick, cb, extra) {
    F.sg[id] = { items: [], sel: -1, seq: 0, cb: cb }; return "<div class='fm-sgw'><input id='" + id + "' class='in' type='search' autocomplete='off' role='combobox' aria-expanded='false' aria-autocomplete='list' data-fmsg='" + scope + "' data-pick='" + (pick || "go") + "'" + (extra || "") + " placeholder='" + esc(ph) + "' style='margin:0'></div>";
  }
  window.FM.searchBox = searchBox;

  /* ======================= ROUTER ======================= */
  window.pFarmako = function (P) { var k = ++F.route; clearInterval(F.timer); F.timer = 0; setTimeout(function () { fRoute(P, k); }, 0); return "<div id='fm'>" + skel(4) + "</div>"; };
  async function fRoute(P, k) {
    var s = P[1] || ""; await meta();
    try {
      if (s === "") return await home(k);
      if (s === "belajar") return P[2] ? await catPage(+P[2], k) : await learnHome(k);
      if (s === "materi") return await materialPage(+P[2], k);
      if (s === "obat") return P[2] === "cari" ? await library(k, decodeURIComponent(P[3] || "")) : P[2] ? await drugPage(+P[2], k) : await library(k, "");
      if (s === "banding") return await comparePage(+P[2], +P[3], k);
      if (s === "interaksi") return await checker(k, (P[2] || "").split(",").map(Number).filter(Boolean));
      if (s === "game") return await gameRoute(P, k);
      if (s === "tersimpan") return await savedPage(k);
      if (s === "usul") return await usulPage(k);
      if (s === "admin") { if (!S.admin) { location.hash = "#/farmako"; return; } return await loadAdmin(P, k); }
      location.hash = "#/farmako";
    } catch (e) { if (e !== 0 && alive(k)) setF("<div class='pn g empty'>Terjadi kesalahan: " + esc(e.message || e) + "</div>"); }
  }
  function loadAdmin(P, k) {
    return new Promise(function (res, rej) {
      var go = function () { if (alive(k)) window.FMAdmin(P, k, { set: setF, alive: alive }).then(res, rej); else res(); };
      if (window.FMAdmin) return go();
      var s = document.createElement("script"); s.src = "farmako-admin.js?v=12"; s.onload = go; s.onerror = function () { rej(new Error("farmako-admin.js tidak ditemukan")); }; document.head.appendChild(s);
    });
  }
  var bigCard = function (href, ico, t, sub) { return "<a class='card g' href='" + href + "'><span class='i'>" + ico + "</span><span class='t'>" + esc(t) + "<small>" + esc(sub) + "</small></span><span class='a'>›</span></a>"; };
  var back = function (href, t) { return "<div class='fm-row' style='margin-top:12px'><a class='btn s' href='" + href + "'>" + esc(t) + "</a></div>"; };
  var usulLink = "<div class='fm-row' style='margin-top:10px'><a class='btn s' href='#/farmako/usul'>➕ Usulkan obat yang belum ada</a></div>";
  var emptyNote = function () { return "<div class='pn g empty'>Belum ada data farmakologi yang dipublikasikan.<br><small>" + (S.admin ? "Impor data dari DrugBank, DDInter, KEGG DRUG, PubChem, atau RxNorm di <a style='color:var(--gold)' href='#/farmako/admin/impor'>Panel Admin</a>, lalu verifikasi dan publikasikan." : "Admin perlu mengimpor, memverifikasi, dan mempublikasikan data terlebih dahulu.") + "</small></div>"; };

  /* ======================= TERJEMAHAN (Indonesia) =======================
     Elemen [data-tr="fact:ID:value"] / [data-tr="inter:ID:mechanism"]. Terjemahan mesin selalu berlabel; teks asli bisa dilihat kembali. */
  var TR = { lang: (function () { try { return localStorage.getItem("fm_lang") || "id"; } catch (e) { return "id"; } })(), map: {}, need: [], busy: 0, provider: true };
  var trBar = function () { return "<div class='fm-tbar g'><span>🌐 Bahasa isi:</span><button class='chip g" + (TR.lang === "id" ? " on" : "") + "' data-lang='id'>Indonesia</button><button class='chip g" + (TR.lang === "en" ? " on" : "") + "' data-lang='en'>Asli</button><span id='fmTrSt' class='hint' style='margin:0;flex:1;min-width:120px'></span></div><div class='hint' style='margin:0 0 8px'>Terjemahan dibuat mesin dan bisa keliru; teks asli (Inggris) tetap rujukan.</div>"; };
  var trSpan = function (ent, id, field, text) { return text ? "<span data-tr='" + ent + ":" + id + ":" + field + "'>" + esc(text) + "</span>" : ""; };
  var trSt = function (t) { var e = g("fmTrSt"); if (e) e.textContent = t; };
  function trPaint() {
    [].forEach.call(document.querySelectorAll("#fm [data-tr]"), function (e) {
      if (e._o == null) e._o = e.textContent;
      var m = TR.map[e.dataset.tr], on = TR.lang === "id" && m && m.text && m.status !== "id";
      e.textContent = on ? m.text : e._o;
      if (on) { var b = document.createElement("span"); b.className = "fm-trb"; b.textContent = m.status === "verified" ? "✔ terjemahan terverifikasi" : "🌐 terjemahan mesin"; e.appendChild(b); }
    });
  }
  // Seluruh interaksi obat ditampilkan langsung di Detail Obat (bukan hanya jumlah / tombol).
  function interBlock(x) {
    var head = "<div class='fm-fact'><div class='fm-fh'>Interaksi Obat</div>";
    if (!x || !x.total) return head + "<div class='fm-na'>Belum ada interaksi terpublikasi untuk obat ini.</div><div class='hint' style='margin:0'>Setelah admin mengimpor lalu mempublikasikan data, seluruh interaksi langsung tampil di sini.</div></div>";
    var sevTag = function (s) {
      if (!s) return "<span class='tag'>keparahan tidak disebutkan</span>";
      var t = String(s).toLowerCase(), c = /contra|major|tinggi|berat/.test(t) ? "warn" : /moderate|sedang/.test(t) ? "warn" : "ok";
      return "<span class='tag " + c + "'>" + esc(s) + "</span>";
    };
    var card = function (o, title) {
      var h = "<div class='fm-fact' style='border-left:3px solid var(--gold);margin:8px 0'><div class='fm-x'><b style='flex:1'>" + title + "</b>" + sevTag(o.severity) + "</div>";
      if (o.src || o.sid) h += "<div class='hint' style='margin:2px 0'>Sumber: " + esc((FM.srcName ? FM.srcName(o.src) : o.src) || "—") + (o.sid ? " · ID " + esc(o.sid) : "") + "</div>";
      [["Mekanisme kerja", "mechanism"], ["Efek klinis", "effect"], ["Penanganan", "management"], ["Bukti / rujukan", "evidence"]].forEach(function (f) {
        if (o[f[1]]) h += "<div style='margin-top:6px'><div class='fm-fh' style='margin:0'>" + f[0] + "</div><div class='fm-v' data-tr='inter:" + o.id + ":" + f[1] + "'>" + esc(o[f[1]]) + "</div></div>";
      });
      return h + "</div>";
    };
    var h = head + "<div class='hint' style='margin:0'><b>" + x.total + "</b> interaksi terpublikasi — seluruhnya ditampilkan di bawah ini (antar-obat: " + x.ddi.length + ").</div>";
    if (x.ddi.length) h += "<div class='fm-sec g' style='margin-top:8px'><b style='font-size:13px'>Antar-obat (" + x.ddi.length + ")</b></div>" + x.ddi.map(function (o) {
      var t = o.other && o.other.name ? "<a style='color:var(--gold)' href='#/farmako/obat/" + o.other.id + "'>" + esc(o.other.name) + "</a>" : esc(o.subject || "—");
      return card(o, "⚠️ " + t);
    }).join("");
    [["food", "Makanan"], ["disease", "Penyakit"], ["alcohol", "Alkohol"]].forEach(function (gp) {
      var arr = x[gp[0]] || [];
      if (arr.length) h += "<div class='fm-sec g' style='margin-top:8px'><b style='font-size:13px'>" + gp[1] + " (" + arr.length + ")</b></div>" + arr.map(function (o) { return card(o, "⚠️ " + esc(o.subject || "—")); }).join("");
    });
    return h + "<div class='fm-row' style='margin-top:8px'><a class='btn s' href='#/farmako/interaksi'>🔍 Periksa kombinasi obat lain</a></div></div>";
  }

  async function trApply(k) {
    var els = [].slice.call(document.querySelectorAll("#fm [data-tr]")); if (!els.length) return; trPaint();
    var keys = []; els.forEach(function (e) { if (keys.indexOf(e.dataset.tr) < 0) keys.push(e.dataset.tr); });
    var items = keys.map(function (x) { var p = x.split(":"); return { ent: p[0], ref: +p[1], field: p[2] }; });
    var r = await fapi("tr/get", { m: "POST", b: { items: items } }); if (!alive(k) || !r.ok) return;
    Object.keys(r.j.map).forEach(function (x) { TR.map[x] = r.j.map[x]; }); TR.need = r.j.need.slice(); TR.provider = r.j.provider; trPaint(); await trRun(k);
  }
  async function trRun(k) {
    if (TR.lang !== "id" || !TR.need.length) return;
    if (!TR.provider) return trSt("Terjemahan belum diaktifkan oleh admin — menampilkan teks asli.");
    if (TR.busy) return; TR.busy = 1; var total = TR.need.length, n = 0;
    try {
      while (TR.need.length && TR.lang === "id" && alive(k)) {
        var key = TR.need[0], p = key.split(":"); trSt("🌐 Menerjemahkan " + (n + 1) + "/" + total + "…");
        var r = await fapi("tr/do", { m: "POST", b: { ent: p[0], ref: +p[1], field: p[2] } });
        if (!r.ok) { trSt((r.j && r.j.err) || "Terjemahan gagal — menampilkan teks asli."); break; }
        TR.map[key] = { text: r.j.text, status: r.j.status }; TR.need.shift(); n++; trPaint();
      }
      if (!TR.need.length) trSt("✓ Terjemahan selesai");
    } finally { TR.busy = 0; }
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-lang]"); if (!b || !g("fm")) return;
    TR.lang = b.dataset.lang; try { localStorage.setItem("fm_lang", TR.lang); } catch (er) { }
    [].forEach.call(document.querySelectorAll("[data-lang]"), function (x) { x.classList.toggle("on", x.dataset.lang === TR.lang); });
    trPaint(); if (TR.lang === "id") trRun(F.route); else trSt("");
  });

  /* ======================= BERANDA ======================= */
  async function home(k) {
    var r = await fapi("home"); if (!alive(k)) return; if (!r.ok) return setF("<div class='pn g empty'>" + esc((r.j && r.j.err) || "Gagal memuat") + "</div>");
    var j = r.j, c = j.counts, pct = j.progress.total ? Math.round(j.progress.done * 100 / j.progress.total) : 0;
    var h = "<div class='fm-hero g'><h1>💊 Pharmacology Session</h1><p>Pusat belajar farmakologi: materi terstruktur, pustaka obat, pemeriksa interaksi, dan permainan edukatif — semuanya bersumber dari database terverifikasi.</p></div>" +
      "<div class='pn g' style='margin-top:0'>" + searchBox("fmQ", "all", "Cari obat, golongan, kategori, atau materi… (mis. “Para”, “Beta”)") + "</div>";
    if (!c.drugs && !c.materials) h += emptyNote();
    h += bigCard("#/farmako/belajar", "📚", "Pembelajaran Farmakologi", c.materials + " materi · " + c.categories + " kategori") + bigCard("#/farmako/obat", "💊", "Pustaka Obat", c.drugs + " obat") + bigCard("#/farmako/interaksi", "⚠️", "Pemeriksa Interaksi Obat", c.interactions + " data interaksi terpublikasi") + bigCard("#/farmako/game", "🎮", "Permainan Farmakologi", "Pilih kategori, mode, lalu bermain");
    h += "<div class='fm-grid'><div class='fm-st g'><b>" + pct + "%</b><small>progres belajar (" + j.progress.done + "/" + j.progress.total + ")</small><div class='fm-prog'><i style='width:" + pct + "%'></i></div></div><a class='fm-st g' style='text-decoration:none;color:inherit' href='#/farmako/tersimpan'><b>★</b><small>Obat & materi tersimpan</small></a></div>";
    if (j.recent.length) h += "<div class='sec'>TERAKHIR DIBUKA</div>" + j.recent.map(function (x) { return "<a class='fm-card g' href='" + hrefOf(x) + "'><div class='fm-top'><div><b>" + (x.t === "drug" ? "💊 " : "📖 ") + esc(capn(x.name)) + "</b>" + (x.sub ? "<small>" + esc(x.sub) + "</small>" : "") + "</div></div></a>"; }).join("");
    if (j.saved.length) h += "<div class='sec'>OBAT TERSIMPAN</div><div class='fm-chips'>" + j.saved.map(function (x) { return "<a class='chip g' href='#/farmako/obat/" + x.id + "'>💊 " + esc(capn(x.name)) + "</a>"; }).join("") + "</div>";
    if (j.topCats.length) h += "<div class='sec'>KATEGORI</div><div class='fm-chips'>" + j.topCats.map(function (x) { return "<a class='chip g' href='#/farmako/belajar/" + x.id + "'>" + esc(capn(x.name)) + " (" + x.drugs + ")</a>"; }).join("") + "</div>";
    h += "<div class='sec'>AKSES CEPAT</div><div class='fm-row'><a class='btn' href='#/farmako/interaksi'>⚠️ Cek interaksi</a><a class='btn' href='#/farmako/game'>🎮 Main game</a><a class='btn s' href='#/farmako/usul'>➕ Usulkan obat</a></div>" + DISC;
    if (S.admin) h += "<div class='fm-row'><a class='btn s' href='#/farmako/admin'>🛠️ Panel Admin Farmakologi</a></div>";
    setF(h);
  }

  /* ======================= PEMBELAJARAN ======================= */
  async function learnHome(k) {
    var kind = F.kind || "", rc = await fapi("cats?parent=0" + (kind ? "&kind=" + kind : "")), rm = await fapi("materials"); if (!alive(k)) return;
    var cj = rc.j || { cats: [], kinds: {} }, mats = (rm.j && rm.j.rows) || [], gen = mats.filter(function (m) { return m.general; }), done = mats.filter(function (m) { return m.done; }).length;
    var h = "<div class='pn g' style='margin-top:0'>" + searchBox("fmQ", "all", "Cari materi, golongan, atau kategori…") + "</div>";
    h += "<div class='fm-x'><b>Progres belajar</b><span class='sp'></span><small class='hint' style='margin:0'>" + done + " dari " + mats.length + " materi selesai</small></div><div class='fm-prog'><i style='width:" + (mats.length ? Math.round(done * 100 / mats.length) : 0) + "%'></i></div>";
    h += "<div class='sec'>FARMAKOLOGI UMUM</div>" + (gen.length ? gen.map(matCard).join("") : "<div class='pn g empty'>Materi farmakologi umum belum dipublikasikan.</div>");
    h += "<div class='sec'>FARMAKOLOGI SISTEMIK & KLINIS</div><div class='fm-chips'><a class='chip g" + (!kind ? " on" : "") + "' data-fk=''>Semua</a>" + Object.keys(cj.kinds).map(function (kk) { return "<a class='chip g" + (kind === kk ? " on" : "") + "' data-fk='" + esc(kk) + "'>" + esc((F.meta.kinds[kk] || kk) + " (" + cj.kinds[kk] + ")") + "</a>"; }).join("") + "</div>";
    h += cj.cats.length ? cj.cats.map(catCard).join("") : (mats.length ? "<div class='pn g empty'>Belum ada kategori berisi obat terpublikasi." + "</div>" : "");
    var other = mats.filter(function (m) { return !m.general; });
    if (other.length) h += "<div class='sec'>MATERI LAINNYA</div>" + other.map(matCard).join("");
    setF(h + back("#/farmako", "‹ Pharmacology Session"));
  }
  var catCard = function (c) { return "<a class='fm-card g' href='#/farmako/belajar/" + c.id + "'><div class='fm-top'><div><b>" + esc(c.name) + "</b><small>" + esc(F.meta.kinds[c.kind] || c.kind) + " · " + c.drugs + " obat" + (c.subs ? " · " + c.subs + " subkategori" : "") + (c.descr ? "<br>" + esc(c.descr) : "") + "</small></div><span style='color:var(--gold)'>›</span></div></a>"; };
  var matCard = function (m) { return "<a class='fm-mc g" + (m.done ? " done" : "") + "' href='#/farmako/materi/" + m.id + "'><span class='ck'>" + (m.done ? "✓" : "") + "</span><b style='flex:1;font-size:14px'>" + esc(m.title) + "</b><span style='color:var(--gold)'>›</span></a>"; };
  document.addEventListener("click", function (e) { var c = e.target.closest && e.target.closest("[data-fk]"); if (c && g("fm")) { F.kind = c.dataset.fk; learnHome(F.route); } });

  async function catPage(id, k) {
    var r = await fapi("cat/" + id); if (!alive(k)) return; if (!r.ok) return setF("<div class='pn g empty'>" + esc((r.j && r.j.err) || "Kategori tidak ditemukan") + "</div>" + back("#/farmako/belajar", "‹ Pembelajaran"));
    var j = r.j, c = j.cat;
    var h = "<div class='fm-crumb'><a href='#/farmako/belajar'>Pembelajaran</a>" + j.crumbs.map(function (x) { return " › <a href='#/farmako/belajar/" + x.id + "'>" + esc(capn(x.name)) + "</a>"; }).join("") + "</div>";
    h += "<div class='fm-sec g'><h3>" + esc(F.meta.kinds[c.kind] || c.kind) + "</h3><b style='font-size:18px'>" + esc(c.name) + "</b>" + (c.descr ? "<div class='hint'>" + esc(c.descr) + "</div>" : "") + "<div class='fm-row' style='margin-top:8px'>" + "<span class='tag'>" + j.total + " obat</span>" + (c.src && c.src !== "manual" ? srcTag(c.src, c.sid) : "") + "</div></div>";
    h += "<div class='pn g' style='margin-top:0'>" + searchBox("fmQ", "all", "Cari di seluruh materi & obat…") + "</div>";
    if (j.materials.length) h += "<div class='sec'>MATERI</div>" + j.materials.map(function (m) { return matCard({ id: m.id, title: m.title }); }).join("");
    if (j.kids.length) h += "<div class='sec'>SUBKATEGORI</div>" + j.kids.map(catCard).join("");
    if (j.drugs.length) {
      h += "<div class='sec'>PERBANDINGAN OBAT DALAM KATEGORI</div><div class='fm-sec g'><div class='fm-tw'><table class='fm-tb'><tr><th>Obat</th><th>Golongan</th><th>Mekanisme kerja</th><th>Indikasi</th></tr>" + j.drugs.map(function (d) { return "<tr><td><a style='color:var(--gold)' href='#/farmako/obat/" + d.id + "'>" + esc(capn(d.generic)) + "</a></td><td>" + (esc(d.pharm_class) || NA) + "</td><td>" + (esc(d.moa) || NA) + "</td><td>" + (esc(d.ind) || NA) + "</td></tr>"; }).join("") + "</table></div><div class='hint' style='margin-bottom:0'>Kolom mekanisme & indikasi menampilkan kalimat pertama dari data sumber; buka profil obat untuk teks lengkap dan sumbernya." + (j.total > j.drugs.length ? " Menampilkan " + j.drugs.length + " dari " + j.total + " obat." : "") + "</div></div>";
    } else if (!j.kids.length && !j.materials.length) h += "<div class='pn g empty'>Belum ada obat terpublikasi pada kategori ini.</div>";
    setF(h + back(c.parent_id ? "#/farmako/belajar/" + c.parent_id : "#/farmako/belajar", "‹ Kembali"));
  }

  async function materialPage(id, k) {
    var r = await fapi("material/" + id); if (!alive(k)) return; if (!r.ok) return setF("<div class='pn g empty'>" + esc((r.j && r.j.err) || "Materi tidak ditemukan") + "</div>" + back("#/farmako/belajar", "‹ Pembelajaran"));
    var m = r.j, sec = F.meta.sections, keys = Object.keys(sec).filter(function (x) { return m.body[x]; }), nav = keys.map(function (x) { return "<a class='chip g' data-jump='fms-" + x + "'>" + esc(sec[x]) + "</a>"; }).join("");
    var h = "<div class='fm-x'><h2 style='margin:0;flex:1;font-size:20px'>" + esc(m.title) + "</h2><button class='fm-star' data-fb='material:" + m.id + "' aria-label='Simpan materi'>" + (m.bookmarked ? "★" : "☆") + "</button></div>" + (nav ? "<div class='fm-chips'>" + nav + "</div>" : "");
    if (!keys.length) h += "<div class='pn g empty'>Materi ini belum memiliki isi.</div>";
    keys.forEach(function (x) { h += "<div class='fm-sec g' id='fms-" + x + "'><h3>" + esc(sec[x]) + "</h3><div class='fm-md'>" + md(m.body[x]) + "</div></div>"; });
    h += "<div class='fm-sec g'><h3>Referensi dan sumber data</h3>" + (m.refs.length ? "<ol style='margin:0;padding-left:20px;font-size:13px;line-height:1.6'>" + m.refs.map(function (x) { return "<li>" + esc(x.text) + (x.doi ? " DOI: " + esc(x.doi) : "") + (x.pmid ? " PMID: " + esc(x.pmid) : "") + (x.url ? " — <a style='color:var(--gold)' target='_blank' rel='noopener noreferrer' href='" + esc(x.url) + "'>tautan</a>" : "") + "</li>"; }).join("") + "</ol>" : NA) + "<div style='margin-top:8px'>" + srcTag(m.src, m.sid) + " <span class='tag'>Diperbarui " + fdate(m.updated) + "</span></div></div>";
    h += "<div class='fm-bar g'><span class='t'>" + (m.done ? "✓ Materi ditandai selesai" : "Sudah selesai membaca?") + "</span><button class='btn" + (m.done ? " s" : "") + "' data-fd='" + m.id + ":" + (m.done ? 0 : 1) + "'>" + (m.done ? "Batalkan tanda selesai" : "✓ Tandai selesai") + "</button></div>";
    if (m.related.length) h += "<div class='sec'>MATERI TERKAIT</div>" + m.related.map(function (x) { return matCard({ id: x.id, title: x.title }); }).join("");
    setF(h + back(m.cat_id ? "#/farmako/belajar/" + m.cat_id : "#/farmako/belajar", "‹ Kembali"));
  }
  document.addEventListener("click", async function (e) {
    var b = e.target.closest && e.target.closest("[data-jump]"); if (b) { var t = g(b.dataset.jump); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    b = e.target.closest && e.target.closest("[data-fd]"); if (b && g("fm")) { var p = b.dataset.fd.split(":"); var r = await fapi("progress", { m: "POST", b: { id: +p[0], done: +p[1] } }); if (r.ok) { toast(+p[1] ? "Materi ditandai selesai ✓" : "Tanda selesai dibatalkan"); materialPage(+p[0], F.route); } return; }
    b = e.target.closest && e.target.closest("[data-fb]"); if (b && g("fm")) { var q = b.dataset.fb.split(":"), on = b.textContent.trim() === "☆"; var r2 = await fapi("bookmark", { m: "POST", b: { kind: q[0], id: +q[1], on: on ? 1 : 0 } }); if (r2.ok) { b.textContent = on ? "★" : "☆"; toast(on ? "Disimpan ★" : "Dihapus dari tersimpan"); } else toast((r2.j && r2.j.err) || "Gagal"); }
  });

  /* ======================= PUSTAKA OBAT ======================= */
  var LIB = { cls: "", cat: 0, pg: 0, q: "" };
  async function library(k, q0) {
    if (q0 !== "") { LIB.q = q0; LIB.pg = 0; }
    var rc = await fapi("cats?kind=" + (LIB.kind || "organ_system")), cats = (rc.j && rc.j.cats) || [], kinds = (rc.j && rc.j.kinds) || {};
    if (!alive(k)) return;
    setF("<div id='fmLib'></div>");
    F.libCats = cats; F.libKinds = kinds; await libDraw(k);
  }
  async function libDraw(k) {
    var r = await fapi("drugs?q=" + encodeURIComponent(LIB.q) + "&cat=" + LIB.cat + "&cls=" + encodeURIComponent(LIB.cls) + "&pg=" + LIB.pg); if (!g("fmLib") || F.route !== k) return;
    var j = r.j || { rows: [], total: 0, classes: [] }, kinds = F.libKinds || {};
    var h = "<div class='pn g' style='margin-top:0'>" + "<div class='fm-sgw'><input id='fmLq' class='in' type='search' placeholder='Cari nama generik, nama dagang, sinonim…' value='" + esc(LIB.q) + "' autocomplete='off' role='combobox' aria-expanded='false' data-fmsg='drug' data-pick='go' style='margin:0'></div>" +
      "<div class='fm-row' style='margin-top:10px'><select id='fmLk' class='in' style='margin:0'>" + ["organ_system", "pharm_class", "ther_class", "indication", "target", "moa", "classification", "atc", "other"].filter(function (x) { return kinds[x] || (LIB.kind || "organ_system") === x; }).map(function (x) { return "<option value='" + x + "'" + ((LIB.kind || "organ_system") === x ? " selected" : "") + ">" + esc(F.meta.kinds[x] || x) + "</option>"; }).join("") + "</select>" +
      "<select id='fmLc' class='in' style='margin:0'><option value='0'>Semua kategori</option>" + (F.libCats || []).map(function (c) { return "<option value='" + c.id + "'" + (LIB.cat === c.id ? " selected" : "") + ">" + esc((c.parent_id ? "— " : "") + c.name) + " (" + c.drugs + ")</option>"; }).join("") + "</select>" +
      "<select id='fmLg' class='in' style='margin:0'><option value=''>Semua golongan</option>" + (j.classes || []).map(function (c) { return "<option value='" + esc(c.toLowerCase()) + "'" + (LIB.cls === c.toLowerCase() ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></div></div>";
    h += "<div class='hint'>" + j.total + " obat" + (LIB.q ? " untuk “" + esc(LIB.q) + "”" : "") + " <a style='color:var(--gold);cursor:pointer' data-lr='1'>· reset filter</a> · <a style='color:var(--gold)' href='#/farmako/tersimpan'>★ tersimpan</a></div>";
    if (!j.rows.length) h += (j.total === 0 && !LIB.q && !LIB.cat && !LIB.cls) ? emptyNote() : "<div class='pn g empty'>Tidak ada obat yang cocok dengan pencarian/filter ini.</div>";
    h += j.rows.map(function (d) { var on = F.cmp.indexOf(d.id) >= 0; return "<div class='fm-card g'><div class='fm-top'><a style='flex:1;min-width:0;color:inherit;text-decoration:none' href='#/farmako/obat/" + d.id + "'><b>💊 " + esc(capn(d.generic)) + "</b><small>" + esc(d.pharm_class || "Golongan belum tersedia") + (d.brands.length ? " · " + esc(d.brands.join(", ")) : "") + (d.summary ? "<br>" + esc(d.summary) : "") + "</small></a><button class='chip g" + (on ? " on" : "") + "' data-cmp='" + d.id + "' title='Pilih untuk dibandingkan'>⇄</button></div></div>"; }).join("");
    var pages = Math.ceil(j.total / 40); if (pages > 1) h += "<div class='fm-row'><button class='btn s' data-lp='-1'" + (LIB.pg ? "" : " disabled") + ">‹ Sebelumnya</button><span class='hint' style='text-align:center;align-self:center;margin:0'>Halaman " + (LIB.pg + 1) + " / " + pages + "</span><button class='btn s' data-lp='1'" + (LIB.pg + 1 < pages ? "" : " disabled") + ">Berikutnya ›</button></div>";
    if (F.cmp.length) h += "<div class='fm-bar g'><span class='t'>⇄ " + F.cmp.length + "/2 obat dipilih untuk dibandingkan</span>" + (F.cmp.length === 2 ? "<a class='btn' href='#/farmako/banding/" + F.cmp[0] + "/" + F.cmp[1] + "'>Bandingkan</a>" : "") + "<button class='btn s' data-cmpx='1'>Kosongkan</button></div>";
    g("fmLib").innerHTML = h + usulLink + back("#/farmako", "‹ Pharmacology Session");
  }
  document.addEventListener("change", function (e) {
    if (!g("fmLib")) return; var t = e.target;
    if (t.id === "fmLk") { LIB.kind = t.value; LIB.cat = 0; LIB.pg = 0; library(F.route, ""); } else if (t.id === "fmLc") { LIB.cat = +t.value; LIB.pg = 0; libDraw(F.route); } else if (t.id === "fmLg") { LIB.cls = t.value; LIB.pg = 0; libDraw(F.route); }
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-lp],[data-lr],[data-cmp],[data-cmpx]"); if (!t || !g("fmLib")) return;
    if (t.dataset.lp) { LIB.pg = Math.max(0, LIB.pg + +t.dataset.lp); libDraw(F.route); window.scrollTo(0, 0); }
    else if (t.dataset.lr) { LIB.q = ""; LIB.cat = 0; LIB.cls = ""; LIB.pg = 0; library(F.route, ""); }
    else if (t.dataset.cmpx) { F.cmp = []; libDraw(F.route); }
    else { var id = +t.dataset.cmp, i = F.cmp.indexOf(id); if (i >= 0) F.cmp.splice(i, 1); else { if (F.cmp.length >= 2) F.cmp.shift(); F.cmp.push(id); } libDraw(F.route); }
  });
  document.addEventListener("keydown", function (e) { if (e.target && e.target.id === "fmLq" && e.key === "Enter" && !(F.sg.fmLq && F.sg.fmLq.items.length && F.sg.fmLq.sel >= 0)) { LIB.q = e.target.value.trim(); LIB.pg = 0; var b = e.target.parentNode.querySelector(".fm-sg"); if (b) b.hidden = true; libDraw(F.route); e.stopImmediatePropagation(); e.preventDefault(); } }, true);

  var GRP = [
    ["Informasi Farmakologi", ["moa", "targets", "pd", "pk", "absorption", "distribution", "metabolism", "excretion", "half_life", "bioavailability"]],
    ["Informasi Klinis", ["indications", "contraindications", "adverse", "warnings", "interactions", "routes", "dosing"]],
  ];
  function factsHtml(facts, keys, required) {
    return keys.map(function (f) {
      var v = facts.filter(function (x) { return x.field === f; });
      if (!v.length && !required.includes(f)) return "";
      return "<div class='fm-fact'><div class='fm-fh'>" + esc(F.meta.fields[f] || f) + "</div>" + (v.length ? v.map(function (x) { return "<div>" + srcTag(x.src, x.sid) + "<span class='hint' style='margin:0'>diperbarui " + fdate(x.updated) + "</span></div><div class='fm-v' data-tr='fact:" + x.id + ":value'>" + esc(x.value) + "</div>"; }).join("<div style='height:6px'></div>") : NA) + "</div>";
    }).join("");
  }
  async function drugPage(id, k) {
    var r = await fapi("drug/" + id); if (!alive(k)) return; if (!r.ok) return setF("<div class='pn g empty'>" + esc((r.j && r.j.err) || "Obat tidak ditemukan") + "</div>" + back("#/farmako/obat", "‹ Pustaka Obat"));
    var j = r.j, d = j.drug, br = j.names.filter(function (n) { return n.kind === "brand"; }), sy = j.names.filter(function (n) { return n.kind === "synonym"; });
    var uq = function (a) { var s = {}; return a.filter(function (n) { var k2 = n.name.toLowerCase(); if (s[k2]) return false; s[k2] = 1; return true; }); };
    var h = "<div class='fm-x'><h2 style='margin:0;flex:1;font-size:22px'>💊 " + esc(capn(d.generic)) + "</h2><button class='fm-star' data-fb='drug:" + d.id + "' aria-label='Simpan obat'>" + (j.bookmarked ? "★" : "☆") + "</button></div><div style='margin:4px 0 8px'>" + stTag(d.status) + " <span class='tag'>Diperbarui " + fdate(d.updated) + "</span></div>";
    h += "<div class='fm-row'><a class='btn s' href='#/farmako/interaksi/" + d.id + "'>⚠️ Cek interaksi</a><button class='btn s' data-cmp1='" + d.id + "'>⇄ Bandingkan</button></div>" + trBar();
    h += "<div class='fm-sec g'><h3>A. Informasi Dasar</h3><div class='fm-kv'><b>Nama generik</b><div>" + esc(capn(d.generic)) + "</div><b>Nama dagang</b><div>" + (br.length ? uq(br).map(function (n) { return esc(n.name); }).join(", ") : NA) + "</div>" + (sy.length ? "<b>Sinonim</b><div>" + uq(sy).map(function (n) { return esc(n.name); }).join(", ") + "</div>" : "") + "<b>Golongan farmakologis</b><div>" + (esc(d.pharm_class) || NA) + "</div><b>Golongan terapeutik</b><div>" + (esc(d.ther_class) || NA) + "</div><b>Klasifikasi</b><div>" + (esc(d.classification) || NA) + "</div>" + (j.cats.length ? "<b>Kategori</b><div>" + j.cats.map(function (c) { return "<a class='tag' style='text-decoration:none;margin:0 4px 4px 0;display:inline-block' href='#/farmako/belajar/" + c.id + "'>" + esc(c.name) + "</a>"; }).join("") + "</div>" : "") + "<b>Identitas di database</b><div>" + (j.xref.length ? j.xref.map(function (x) { return srcTag(x.src, x.sid); }).join("") : NA) + "</div></div></div>";
    h += GRP.map(function (gr, gi) { var req = gi === 0 ? ["moa", "targets", "pk"] : ["indications", "contraindications", "adverse"]; return "<div class='fm-sec g'><h3>" + (gi ? "C. " : "B. ") + gr[0] + "</h3>" + (factsHtml(j.facts, gr[1], req) || NA) + (gi === 1 ? interBlock(j.inter) : "") + "</div>"; }).join("");
    var extra = factsHtml(j.facts, ["notes", "physchem"], []);
    h += "<div class='fm-sec g'><h3>D. Informasi Tambahan</h3>" + (extra || "") + "<div class='fm-fact'><div class='fm-fh'>Obat dalam golongan yang sama</div>" + (j.same.length ? j.same.map(function (x) { return "<a class='chip g' style='display:inline-block;margin:2px' href='#/farmako/obat/" + x.id + "'>" + esc(capn(x.generic)) + "</a>"; }).join("") : NA) + "</div><div class='fm-fact'><div class='fm-fh'>Obat dengan mekanisme serupa</div>" + (j.similar.length ? j.similar.map(function (x) { return "<a class='chip g' style='display:inline-block;margin:2px' href='#/farmako/obat/" + x.id + "'>" + esc(capn(x.generic)) + "</a>"; }).join("") : NA) + "</div>" + (j.related.length ? "<div class='fm-fact'><div class='fm-fh'>Obat terkait (kategori sama)</div>" + j.related.map(function (x) { return "<a class='chip g' style='display:inline-block;margin:2px' href='#/farmako/obat/" + x.id + "'>" + esc(capn(x.generic)) + "</a>"; }).join("") + "</div>" : "") + "<div class='fm-fact'><div class='fm-fh'>Sumber database</div>" + (j.xref.length ? j.xref.map(function (x) { return srcTag(x.src, x.sid) + "<span class='hint' style='margin:0'>sinkron " + fdate(x.synced) + "</span> "; }).join("<br>") : srcTag("manual")) + "</div></div>" + DISC;
    setF(h + back("#/farmako/obat", "‹ Pustaka Obat")); trApply(k);
  }
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-cmp1]"); if (!b || !g("fm")) return; var id = +b.dataset.cmp1; if (F.cmp.indexOf(id) < 0) { if (F.cmp.length >= 2) F.cmp.shift(); F.cmp.push(id); } if (F.cmp.length === 2) location.hash = "#/farmako/banding/" + F.cmp[0] + "/" + F.cmp[1]; else { toast("Dipilih ✓ — pilih obat kedua di Pustaka Obat"); location.hash = "#/farmako/obat"; } });
  async function comparePage(a, b, k) {
    var r = await fapi("compare?a=" + a + "&b=" + b); if (!alive(k)) return; if (!r.ok) return setF("<div class='pn g empty'>" + esc((r.j && r.j.err) || "Gagal") + "</div>" + back("#/farmako/obat", "‹ Pustaka Obat"));
    var D = r.j.drugs, row = function (l, f) { return "<tr><td>" + esc(l) + "</td>" + D.map(function (d) { return "<td>" + f(d) + "</td>"; }).join("") + "</tr>"; };
    var fv = function (key) { return function (d) { var v = d.facts.filter(function (x) { return x.field === key; }); return v.length ? v.map(function (x) { return srcTag(x.src, x.sid) + "<br>" + esc(x.value); }).join("<br><br>") : NA; }; };
    var rows = row("Golongan farmakologis", function (d) { return esc(d.pharm_class) || NA; }) + row("Golongan terapeutik", function (d) { return esc(d.ther_class) || NA; });
    ["moa", "targets", "indications", "contraindications", "pk", "adverse"].forEach(function (f) { rows += row(F.meta.fields[f], fv(f)); });
    rows += row("Interaksi (data terpublikasi)", function (d) { return d.interactions ? d.interactions + " data" : NA; });
    setF("<h2 style='font-size:18px'>⇄ Perbandingan Obat</h2><div class='fm-sec g'><div class='fm-tw'><table class='fm-tb fm-cmp'><tr><th></th>" + D.map(function (d) { return "<th><a style='color:var(--gold)' href='#/farmako/obat/" + d.id + "'>" + esc(capn(d.generic)) + "</a></th>"; }).join("") + "</tr>" + rows + "</table></div></div><div class='fm-row'><a class='btn' href='#/farmako/interaksi/" + a + "," + b + "'>⚠️ Cek interaksi keduanya</a></div>" + DISC + back("#/farmako/obat", "‹ Pustaka Obat"));
  }

  /* ======================= PEMERIKSA INTERAKSI ======================= */
  var CK = { picks: [] };
  async function checker(k, pre) {
    if (pre.length) { CK.picks = []; var rr = await Promise.all(pre.slice(0, 12).map(function (i) { return fapi("drug/" + i); })); rr.forEach(function (x) { if (x.ok) CK.picks.push({ id: x.j.drug.id, name: x.j.drug.generic }); }); }
    if (!alive(k)) return;
    setF("<h2 style='font-size:18px'>⚠️ Pemeriksa Interaksi Obat</h2><div class='fm-disc'>Pilih dua obat atau lebih. Hanya data interaksi yang telah <b>dipublikasikan</b> di Asterion yang diperiksa; setiap hasil menyertakan sumber database.</div><div class='pn g' style='margin-top:0'><label style='margin-top:0'>Tambah obat</label>" + searchBox("fmCk", "drug", "Ketik nama obat… (mis. “Warf”, “Asp”, “Ibu”)", "cb", function (it) { if (it.t !== "drug") return; if (!CK.picks.some(function (p) { return p.id === it.id; })) { if (CK.picks.length >= 12) return toast("Maksimal 12 obat"); CK.picks.push({ id: it.id, name: it.name }); } ckDraw(); }) + "<div id='fmPk' class='fm-pick'></div><div class='fm-row'><button class='btn' id='fmGo'>🔍 Periksa interaksi</button><button class='btn s' data-ckx='1'>Kosongkan</button></div></div><div id='fmRes'></div>" + back("#/farmako", "‹ Pharmacology Session"));
    ckDraw(); if (CK.picks.length >= 1 && pre.length) ckRun();
  }
  function ckDraw() { var e = g("fmPk"); if (!e) return; e.innerHTML = CK.picks.length ? CK.picks.map(function (p, i) { return "<span class='fm-pk g'>💊 " + esc(capn(p.name)) + "<button data-ckr='" + i + "' aria-label='Hapus " + esc(capn(p.name)) + "'>✕</button></span>"; }).join("") : "<span class='hint' style='margin:0'>Belum ada obat dipilih.</span>"; }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-ckr],[data-ckx],#fmGo"); if (!t || !g("fmPk")) return;
    if (t.dataset.ckr != null) { CK.picks.splice(+t.dataset.ckr, 1); ckDraw(); var rs = g("fmRes"); if (rs) rs.innerHTML = ""; } else if (t.dataset.ckx) { CK.picks = []; ckDraw(); g("fmRes").innerHTML = ""; } else ckRun();
  });
  async function ckRun() {
    var res = g("fmRes"); if (!res) return;
    if (CK.picks.length < 1) return toast("Pilih minimal satu obat dulu");
    if (CK.picks.length < 2) toast("Pilih minimal dua obat untuk memeriksa interaksi antarobat");
    res.innerHTML = skel(2); var r = await fapi("interact", { m: "POST", b: { ids: CK.picks.map(function (p) { return p.id; }) } }); if (!g("fmRes")) return;
    if (!r.ok) { res.innerHTML = "<div class='pn g empty'>" + esc((r.j && r.j.err) || "Gagal memeriksa") + "</div>"; return; }
    var j = r.j, h = "", item = function (i) {
      return "<div class='fm-ib'><div class='fm-x'>" + sevTag(i.severity) + srcTag(i.src, i.sid) + (i.verified_at ? "<span class='tag'>Diverifikasi " + fdate(i.verified_at) + "</span>" : "") + "</div><div class='fm-kv' style='margin-top:8px'>" + (i.subject ? "<b>Keterangan</b><div>" + esc(i.subject) + "</div>" : "") + "<b>Tingkat keparahan</b><div>" + esc(i.severity || "Unknown") + " <span class='hint' style='margin:0'>(label asli " + esc(srcName(i.src)) + ")</span></div><b>Mekanisme interaksi</b><div>" + (trSpan("inter", i.id, "mechanism", i.mechanism) || NA) + "</div><b>Dampak klinis</b><div>" + (trSpan("inter", i.id, "effect", i.effect) || NA) + "</div><b>Rekomendasi pengelolaan</b><div>" + (trSpan("inter", i.id, "management", i.management) || NA) + "</div><b>Bukti pendukung</b><div>" + (trSpan("inter", i.id, "evidence", i.evidence) || NA) + "</div></div></div>";
    };
    if (j.missing && j.missing.length) h += "<div class='fm-warn'>Sebagian obat tidak ditemukan atau belum dipublikasikan dan dilewati.</div>";
    if (j.drugs.length < 2) h += "<div class='fm-warn'>Butuh minimal dua obat terpublikasi untuk pemeriksaan pasangan.</div>";
    j.pairs.forEach(function (p) {
      var worst = p.items[0] ? sevCls(p.items[0].severity) : "";
      h += "<div class='fm-pair g " + worst + "'><h4>" + esc(p.a) + " + " + esc(p.b) + " <span class='tag'>Drug-Drug Interaction</span></h4>" + (p.found ? p.items.map(item).join("") : "<div class='fm-ib' style='border-top:0'><b>Data interaksi tidak tersedia</b><div class='hint' style='margin:4px 0 0'>Tidak adanya data <u>bukan berarti</u> kombinasi ini aman. Rujuk sumber klinis resmi sebelum mengambil keputusan.</div></div>") + "</div>";
    });
    if (j.combos.length) h += "<div class='sec'>INTERAKSI KOMBINASI &gt; 2 OBAT</div>" + j.combos.map(function (c) { return "<div class='fm-pair g " + sevCls(c.severity) + "'><h4>" + c.members.map(esc).join(" + ") + "</h4>" + item(c) + "</div>"; }).join("");
    var lab = { food: "Drug-Food Interaction", disease: "Drug-Disease Interaction", alcohol: "Drug-Alcohol Interaction" };
    Object.keys(j.other).forEach(function (t) { if (j.other[t].length) h += "<div class='sec'>" + lab[t].toUpperCase() + "</div>" + j.other[t].map(function (i) { return "<div class='fm-pair g " + sevCls(i.severity) + "'><h4>" + esc(i.drug) + " <span class='tag'>" + lab[t] + "</span></h4>" + item(i) + "</div>"; }).join(""); });
    var srcs = {}; j.pairs.forEach(function (p) { p.items.forEach(function (i) { srcs[i.src] = 1; }); }); j.combos.concat(j.other.food, j.other.disease, j.other.alcohol).forEach(function (i) { srcs[i.src] = 1; });
    h += "<div class='fm-disc'><b>Keterbatasan:</b> hasil mencakup " + (Object.keys(srcs).length ? "sumber: " + Object.keys(srcs).map(srcName).join(", ") : "data terpublikasi (tidak ada kecocokan sumber)") + ". " + (srcs.ddinter ? "Data DDInter 2.0 © Computational Biology &amp; Drug Design Group, lisensi CC BY-NC-SA 4.0 (khusus non-komersial). " : "") + "Klasifikasi keparahan ditampilkan apa adanya dari tiap sumber dan tidak dipetakan ulang; bila beberapa sumber berbeda, semuanya ditampilkan. Pemeriksaan: " + fdate(j.at) + ".</div>" + DISC;
    res.innerHTML = trBar() + h; trApply(F.route);
  }

  /* ======================= PERMAINAN ======================= */
  async function gameRoute(P, k) {
    var s = P[2] || "";
    if (s === "") return gameCats(k);
    if (s === "sub") return gameSub(+P[3], k);
    if (s === "set") return gameSet(k);
    if (s === "play") return gamePlay(k);
    if (s === "hasil") return gameResult(P[3], k);
    if (s === "riwayat") return gameHist(k);
    location.hash = "#/farmako/game";
  }
  var gc = null;
  async function gameCatsLoad() { if (!gc) { var r = await fapi("game/cats"); gc = r.ok ? r.j : { cats: [], modes: {}, diffs: {} }; setTimeout(function () { gc = null; }, 30000); } return gc; }
  async function gameCats(k) {
    var d = await gameCatsLoad(); if (!alive(k)) return; F.g = { cats: [], mode: "", diff: 0, n: 0 }; var kind = F.gkind || "";
    var roots = d.cats.filter(function (c) { return !d.cats.some(function (x) { return x.id === c.parent_id; }); }), kinds = {}; roots.forEach(function (c) { kinds[c.kind] = (kinds[c.kind] || 0) + 1; });
    var list = roots.filter(function (c) { return !kind || c.kind === kind; });
    var h = "<h2 style='font-size:18px'>🎮 Permainan Farmakologi</h2><div class='fm-disc'>Langkah 1 dari 3 — <b>pilih kategori</b> terlebih dahulu. Soal dibuat dari data terpublikasi (jawaban benar = isi database; pembahasan menyertakan sumber).</div><div class='pn g' style='margin-top:0'>" + searchBox("fmGq", "game", "Cari kategori permainan… (mis. “Beta”)") + "</div>";
    if (!d.cats.length) return setF(h + "<div class='pn g empty'>Belum ada kategori dengan soal yang tersedia.<br><small>Soal dibentuk otomatis dari obat terpublikasi yang memiliki data golongan, mekanisme, indikasi, efek samping, atau interaksi.</small></div>" + back("#/farmako", "‹ Pharmacology Session"));
    h += "<div class='fm-chips'><a class='chip g" + (!kind ? " on" : "") + "' data-gk=''>Semua</a>" + Object.keys(kinds).map(function (kk) { return "<a class='chip g" + (kind === kk ? " on" : "") + "' data-gk='" + esc(kk) + "'>" + esc(F.meta.kinds[kk] || kk) + " (" + kinds[kk] + ")</a>"; }).join("") + "</div>";
    h += list.map(function (c) { return "<a class='fm-card g' href='#/farmako/game/sub/" + c.id + "'><div class='fm-top'><div><b>" + esc(c.name) + "</b><small>" + esc(c.descr) + "<br>" + c.subs + " subkategori · " + c.avail.mixed + " soal tersedia</small></div><span style='color:var(--gold)'>›</span></a>"; }).join("");
    setF(h + "<div class='fm-row'><a class='btn s' href='#/farmako/game/riwayat'>🕘 Riwayat</a><a class='btn s' href='#/farmako'>‹ Kembali</a></div>");
  }
  document.addEventListener("click", function (e) { var c = e.target.closest && e.target.closest("[data-gk]"); if (c && g("fm")) { F.gkind = c.dataset.gk; gameCats(F.route); } });
  async function gameSub(id, k) {
    var d = await gameCatsLoad(); if (!alive(k)) return; var c = d.cats.find(function (x) { return x.id === id; }); if (!c) { location.hash = "#/farmako/game"; return; }
    var kids = d.cats.filter(function (x) { return x.parent_id === id; }); F.g.cats = F.g.cats && F.g.root === id ? F.g.cats : []; F.g.root = id;
    if (!kids.length) { F.g.cats = [id]; location.replace("#/farmako/game/set"); return; }
    var sel = F.g.cats.length ? F.g.cats : kids.map(function (x) { return x.id; });
    setF("<h2 style='font-size:18px'>🎮 " + esc(c.name) + "</h2><div class='fm-disc'>Langkah 2 dari 3 — pilih satu atau beberapa <b>subkategori</b>. Hanya subkategori yang memiliki soal yang ditampilkan.</div>" + kids.map(function (x) { return "<label class='fm-sel g" + (sel.indexOf(x.id) >= 0 ? " on" : "") + "'><input type='checkbox' data-gsub='" + x.id + "'" + (sel.indexOf(x.id) >= 0 ? " checked" : "") + "><div><b>" + esc(capn(x.name)) + "</b><small class='hint' style='display:block;margin:2px 0 0'>" + x.subs + " subkategori · " + x.avail.mixed + " soal tersedia</small></div></label>"; }).join("") +
      "<div class='fm-bar g'><span class='t' id='fmSn'>" + sel.length + " dipilih</span><button class='btn' id='fmSgo'>Lanjut ›</button></div>" + back("#/farmako/game", "‹ Ganti kategori"));
    F.g.cats = sel;
  }
  document.addEventListener("change", function (e) { var c = e.target; if (!c.dataset || c.dataset.gsub == null || !g("fm")) return; var id = +c.dataset.gsub, i = F.g.cats.indexOf(id); if (c.checked && i < 0) F.g.cats.push(id); if (!c.checked && i >= 0) F.g.cats.splice(i, 1); c.closest(".fm-sel").classList.toggle("on", c.checked); var n = g("fmSn"); if (n) n.textContent = F.g.cats.length + " dipilih"; });
  document.addEventListener("click", function (e) { if (e.target.id === "fmSgo" && g("fm")) { if (!F.g.cats.length) return toast("Pilih minimal satu subkategori"); location.hash = "#/farmako/game/set"; } });
  async function gameSet(k) {
    var d = await gameCatsLoad(); if (!alive(k)) return; if (!F.g.cats.length) { location.hash = "#/farmako/game"; return; }
    var cs = d.cats.filter(function (x) { return F.g.cats.indexOf(x.id) >= 0; }), av = {}; Object.keys(d.modes).forEach(function (m) { av[m] = cs.reduce(function (s, c) { return s + (c.avail[m] || 0); }, 0); });
    var ICO = { class: "🧬", mechanism: "⚙️", indication: "🎯", adverse: "⚠️", mixed: "🎲", interaction: "🔗" };
    setF("<h2 style='font-size:18px'>🎮 Pengaturan Permainan</h2><div class='fm-disc'>Langkah 3 dari 3. Kategori: <b>" + cs.map(function (c) { return esc(c.name); }).join(", ") + "</b></div><div class='sec'>MODE PERMAINAN</div>" +
      Object.keys(d.modes).map(function (m) { var n = av[m] || 0; return "<a class='fm-mc g" + (n ? "" : " dis") + "' data-gm='" + m + "' style='cursor:pointer;" + (F.g.mode === m ? "box-shadow:0 0 0 2px var(--gold)" : "") + "'><span style='font-size:22px'>" + ICO[m] + "</span><span style='flex:1'><b style='font-size:14px'>" + esc(d.modes[m].n) + "</b><small class='hint' style='display:block;margin:2px 0 0'>" + esc(d.modes[m].d) + " · " + n + " soal tersedia</small></span></a>"; }).join("") +
      "<div class='sec'>TINGKAT KESULITAN</div><div class='fm-chips'>" + [1, 2, 3].map(function (x) { return "<a class='chip g" + (F.g.diff === x ? " on" : "") + "' data-gd='" + x + "'>" + esc(d.diffs[x].n) + " · " + d.diffs[x].sec + " dtk/soal</a>"; }).join("") + "</div><div class='hint'>Pemula: jawaban benar dibedakan dari pilihan berbeda kategori. Menengah: pilihan pengecoh dari kategori yang sama. Lanjutan: arah pertanyaan dibalik, ditambah soal interaksi dan soal admin tingkat lanjut.</div>" +
      "<div class='sec'>JUMLAH SOAL</div><div class='fm-chips'>" + [5, 10, 15, 20].map(function (x) { return "<a class='chip g" + (F.g.n === x ? " on" : "") + "' data-gn='" + x + "'>" + x + " soal</a>"; }).join("") + "</div>" +
      "<div class='fm-bar g'><span class='t'>" + (F.g.mode && F.g.diff && F.g.n ? "Siap bermain" : "Lengkapi semua pengaturan") + "</span><button class='btn' id='fmStart'" + (F.g.mode && F.g.diff && F.g.n ? "" : " disabled") + ">▶ Mulai</button></div>" + back("#/farmako/game", "‹ Ganti kategori"));
  }
  document.addEventListener("click", async function (e) {
    var t = e.target.closest && e.target.closest("[data-gm],[data-gd],[data-gn],#fmStart"); if (!t || !g("fm")) return;
    if (t.dataset.gm) F.g.mode = t.dataset.gm; else if (t.dataset.gd) F.g.diff = +t.dataset.gd; else if (t.dataset.gn) F.g.n = +t.dataset.gn;
    else { if (t.disabled) return; t.disabled = true; var r = await fapi("game/start", { m: "POST", b: { cats: F.g.cats, mode: F.g.mode, diff: F.g.diff, n: F.g.n } }); if (!r.ok) { t.disabled = false; toast((r.j && r.j.err) || "Gagal memulai"); return; } if (r.j.short) toast("Soal tersedia hanya " + r.j.total + " untuk pilihan ini"); F.play = { sid: r.j.sid, qs: r.j.questions, sec: r.j.sec, i: 0, score: 0, streak: 0, ok: 0, lock: false }; location.hash = "#/farmako/game/play"; return; }
    gameSet(F.route);
  });
  function gamePlay(k) {
    var P = F.play; if (!P) { location.replace("#/farmako/game"); return; } if (P.i >= P.qs.length) { location.replace("#/farmako/game/hasil/" + P.sid); return; }
    var q = P.qs[P.i], L = "ABCD"; P.lock = false; P.t0 = Date.now();
    setF("<div class='fm-x'><b>Soal " + (P.i + 1) + "/" + P.qs.length + "</b><span class='sp'></span><span class='tag'>Skor " + P.score + "</span><span class='tag warn'>🔥 " + P.streak + "</span></div><div class='fm-tm' style='margin:8px 0'><i id='fmTi'></i></div><div class='fm-sec g'><div class='fm-q'>" + esc(q.q) + "</div><div id='fmOp'>" + q.opts.map(function (o, i) { return "<button class='fm-op' data-go='" + i + "'><b>" + L[i] + "</b><span>" + esc(o) + "</span></button>"; }).join("") + "</div><div id='fmEx'></div></div><div class='fm-row'><a class='btn s' href='#/farmako/game'>✕ Keluar</a></div>");
    var tot = P.sec * 1000, bar = g("fmTi"); F.timer = setInterval(function () { var left = tot - (Date.now() - P.t0); if (bar) bar.style.transform = "scaleX(" + Math.max(0, left / tot) + ")"; if (left <= 0 && !P.lock) gameAnswer(null); }, 100);
  }
  async function gameAnswer(ch) {
    var P = F.play; if (!P || P.lock) return; P.lock = true; clearInterval(F.timer); F.timer = 0;
    var ms = Math.min(P.sec * 1000, Date.now() - P.t0), r = await fapi("game/answer", { m: "POST", b: { sid: P.sid, idx: P.i, choice: ch, ms: ms } });
    if (!g("fmOp")) return; if (!r.ok) { toast((r.j && r.j.err) || "Gagal mengirim jawaban"); P.lock = false; return; }
    var j = r.j, q = P.qs[P.i]; P.score = j.score; P.streak = j.streak; if (j.ok) P.ok++;
    [].forEach.call(g("fmOp").children, function (b, i) { b.disabled = true; if (q.opts[i] === j.correct) b.classList.add("ok"); else if (i === ch) b.classList.add("no"); });
    g("fmEx").innerHTML = "<div class='fm-ex'><b>" + (ch == null ? "⏱ Waktu habis" : j.ok ? "✓ Benar! +" + j.gain : "✗ Kurang tepat") + "</b>\nJawaban: " + esc(j.correct) + (j.expl ? "\n\n" + esc(j.expl) : "") + "</div><div style='margin-top:6px'>" + (j.src ? srcTag(j.src, j.sid) : "") + "</div><button class='btn w' id='fmNext'>" + (j.done ? "Lihat hasil ›" : "Soal berikutnya ›") + "</button>";
    P.done = j.done;
  }
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-go],#fmNext"); if (!b || !g("fm") || !F.play) return; if (b.dataset.go != null) gameAnswer(+b.dataset.go); else { F.play.i++; if (F.play.done) location.hash = "#/farmako/game/hasil/" + F.play.sid; else gamePlay(F.route); } });
  document.addEventListener("keydown", function (e) { if (!g("fmOp") || !F.play || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; var i = "1234".indexOf(e.key); if (i >= 0 && !F.play.lock && F.play.qs[F.play.i] && i < F.play.qs[F.play.i].opts.length) gameAnswer(i); else if ((e.key === "Enter" || e.key === " ") && g("fmNext")) { e.preventDefault(); g("fmNext").click(); } });
  async function gameResult(sid, k) {
    var r = await fapi("game/result?sid=" + encodeURIComponent(sid || "")); if (!alive(k)) return; if (!r.ok) return setF("<div class='pn g empty'>" + esc((r.j && r.j.err) || "Hasil tidak ditemukan") + "</div>" + back("#/farmako/game", "‹ Permainan"));
    var j = r.j, md2 = (F.meta.modes[j.mode] || {}).n || j.mode, df = (F.meta.diffs[j.diff] || {}).n || j.diff, acc = j.total ? Math.round(j.correct * 100 / j.total) : 0;
    setF("<div class='fm-big g'><div style='font-size:13px;color:var(--mut)'>" + esc(md2) + " · " + esc(df) + "</div><div class='sc'>" + j.score + "</div><small>skor</small><div class='fm-grid'><div class='fm-st g'><b>" + j.correct + "/" + j.total + "</b><small>benar (" + acc + "%)</small></div><div class='fm-st g'><b>🔥 " + j.best_streak + "</b><small>streak terbaik</small></div><div class='fm-st g'><b>" + Math.round(j.dur / 1000) + " dtk</b><small>durasi</small></div></div></div>" +
      "<div class='fm-row'><button class='btn' data-again='1'>🔁 Ulangi</button><a class='btn s' href='#/farmako/game'>Pilih kategori lain</a></div><div class='sec'>PEMBAHASAN</div>" +
      j.review.map(function (x, i) { return "<div class='fm-sec g'><div class='fm-x'><b>" + (i + 1) + ".</b><span class='tag " + (x.ok ? "ok" : "warn") + "'>" + (x.ok ? "Benar" : x.answered ? "Salah" : "Tidak dijawab") + "</span>" + (x.src ? srcTag(x.src, x.sid) : "") + "</div><div class='fm-q' style='font-size:14px'>" + esc(x.q) + "</div><div style='font-size:13px'>Jawaban benar: <b>" + esc(x.correct) + "</b>" + (x.chosen && !x.ok ? "<br>Jawabanmu: " + esc(x.chosen) : "") + "</div>" + (x.expl ? "<div class='fm-ex'>" + esc(x.expl) + "</div>" : "") + "</div>"; }).join("") + "<div class='fm-row'><a class='btn s' href='#/farmako/game/riwayat'>🕘 Riwayat</a><a class='btn s' href='#/farmako'>🏠 Beranda</a></div>");
  }
  document.addEventListener("click", async function (e) { var b = e.target.closest && e.target.closest("[data-again]"); if (!b || !g("fm")) return; if (!F.g.cats.length) { location.hash = "#/farmako/game"; return; } b.disabled = true; var r = await fapi("game/start", { m: "POST", b: { cats: F.g.cats, mode: F.g.mode, diff: F.g.diff, n: F.g.n } }); if (!r.ok) { b.disabled = false; toast((r.j && r.j.err) || "Gagal memulai"); return; } F.play = { sid: r.j.sid, qs: r.j.questions, sec: r.j.sec, i: 0, score: 0, streak: 0, ok: 0, lock: false }; location.hash = "#/farmako/game/play"; });
  async function gameHist(k) {
    var r = await fapi("game/history"); if (!alive(k)) return; var j = r.j || { rows: [], best: 0 };
    setF("<h2 style='font-size:18px'>🕘 Riwayat Permainan</h2>" + (j.rows.length ? "<div class='hint'>Skor tertinggi: <b>" + (j.best || 0) + "</b></div>" + j.rows.map(function (x) { return "<a class='fm-card g' href='#/farmako/game/hasil/" + esc(x.id) + "'><div class='fm-top'><div><b>" + esc((F.meta.modes[x.mode] || {}).n || x.mode) + " · " + esc((F.meta.diffs[x.diff] || {}).n || x.diff) + "</b><small>" + fdate(x.fin) + " · " + x.correct + "/" + x.total + " benar · skor " + x.score + "</small></div><span style='color:var(--gold)'>›</span></div></a>"; }).join("") : "<div class='pn g empty'>Belum ada permainan yang selesai.</div>") + back("#/farmako/game", "‹ Permainan"));
  }

  /* ======================= USULKAN OBAT ======================= */
  async function usulPage(k) {
    var r = await fapi("usul/saya"); if (!alive(k)) return; var rows = (r.j && r.j.rows) || [], ST = { pending: ["Menunggu admin", "warn"], approved: ["Disetujui", "ok"], rejected: ["Ditolak", ""] };
    setF("<h2 style='font-size:18px'>➕ Usulkan Obat</h2><div class='fm-disc'>Tidak menemukan obat yang Anda cari? Usulkan <b>namanya</b>. Admin akan memeriksa; bila disetujui, informasinya diambil dari sumber terpercaya (bukan dari ketikan pengusul). Usulan tidak langsung tampil di Pustaka.</div><div class='pn g' style='margin-top:0'><label for='uN'>Nama generik obat *</label><input id='uN' class='in' maxlength='100' placeholder='mis. metformin' autocomplete='off'><label for='uB'>Nama dagang (opsional)</label><input id='uB' class='in' maxlength='200' placeholder='mis. Glucophage'><label for='uT'>Catatan / sumber (opsional)</label><textarea id='uT' rows='2' maxlength='500' placeholder='Mis. dipakai di skenario PBL, atau tautan rujukan'></textarea><div class='fm-row'><button class='btn' data-fu='send'>📨 Kirim usulan</button></div><div id='uOut' class='hint'></div></div>" +
      "<div class='sec'>USULAN SAYA</div>" + (rows.length ? rows.map(function (x) { var st = ST[x.status] || [x.status, ""]; return "<div class='fm-card g'><div class='fm-top'><div><b>💊 " + esc(capn(x.name)) + "</b><small>" + fdate(x.created) + (x.brands ? " · " + esc(x.brands) : "") + (x.admin_note ? "<br>Catatan admin: " + esc(x.admin_note) : "") + (x.status === "approved" ? "<br>" + (x.pub ? "<a style='color:var(--gold)' href='#/farmako/obat/" + x.drug_id + "'>Lihat di Pustaka ›</a>" : "Sedang diisi datanya oleh admin.") : "") + "</small></div><span class='tag " + st[1] + "'>" + st[0] + "</span></div></div>"; }).join("") : "<div class='pn g empty'>Belum ada usulan.</div>") + back("#/farmako/obat", "‹ Pustaka Obat"));
  }
  document.addEventListener("click", async function (e) {
    var b = e.target.closest && e.target.closest("[data-fu=send]"); if (!b || !g("uN")) return;
    var name = g("uN").value.trim(); if (name.length < 2) return toast("Isi nama obat dulu"); b.disabled = true;
    var r = await fapi("usul", { m: "POST", b: { name: name, brands: g("uB").value, note: g("uT").value } }); b.disabled = false; var o = g("uOut");
    if (!r.ok) { o.textContent = (r.j && r.j.err) || "Gagal mengirim"; return; }
    if (r.j.exists) { o.innerHTML = esc(r.j.msg) + (r.j.published ? " <a style='color:var(--gold)' href='#/farmako/obat/" + r.j.id + "'>Buka ›</a>" : ""); return; }
    if (r.j.dup) { o.textContent = r.j.msg; return; }
    toast("Usulan terkirim ✓"); usulPage(F.route);
  });

  async function savedPage(k) {
    var r = await fapi("bookmarks"); if (!alive(k)) return; var j = r.j || { drugs: [], materials: [] };
    setF("<h2 style='font-size:18px'>★ Tersimpan</h2><div class='sec'>OBAT</div>" + (j.drugs.length ? j.drugs.map(function (d) { return "<a class='fm-card g' href='#/farmako/obat/" + d.id + "'><b>💊 " + esc(capn(d.name)) + "</b>" + (d.sub ? "<small>" + esc(d.sub) + "</small>" : "") + "</a>"; }).join("") : "<div class='pn g empty'>Belum ada obat tersimpan. Ketuk ☆ pada profil obat.</div>") + "<div class='sec'>MATERI</div>" + (j.materials.length ? j.materials.map(function (m) { return matCard({ id: m.id, title: m.name }); }).join("") : "<div class='pn g empty'>Belum ada materi tersimpan.</div>") + back("#/farmako", "‹ Pharmacology Session"));
  }
  window.addEventListener("hashchange", function () { if (!/^#\/farmako\/game\/play/.test(location.hash)) { clearInterval(F.timer); F.timer = 0; } });
})();
