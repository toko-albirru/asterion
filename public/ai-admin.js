/* ASTERION — Dasbor admin AI: model/prompt/kuota, pemakaian token, pengguna, dan INDEKS MATERI untuk RAG.
   Ekstraksi teks (HTML + PPTX) berjalan di browser admin (hemat CPU Worker), lalu dikirim per materi ke /api/ai/admin/doc.
   Bergantung pada global index.html: $, esc, S, api, toast, Dlg, lib, CDN, fUrl, dan AI/aiKey dari ai.js. */
(function () {
  if (window.AI_ADMIN) return;
  var A = window.AI_ADMIN = { open: open }, root, tab = "cfg", CFG = null, INFO = {}, stop = false, running = false;

  var css = "#aad{position:fixed;inset:0;z-index:10005;background:#120c22;color:#fff;display:flex;flex-direction:column;font:14px/1.45 Inter,system-ui,sans-serif}" +
    ":root[data-theme=light] #aad{background:#f7f5fa;color:#241a3f}#aad .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(128,128,160,.3);flex-wrap:wrap}" +
    "#aad .hd b{font:600 13px Cinzel,serif;letter-spacing:.1em;color:#f5c04a;margin-right:auto}#aad button{font:inherit;color:inherit;cursor:pointer}" +
    "#aad .tb{border:1px solid rgba(128,128,160,.45);background:transparent;border-radius:99px;padding:5px 12px}#aad .tb.on,#aad .bt.p{background:#f5c04a;color:#1b1233;border-color:#f5c04a;font-weight:600}" +
    "#aad .bd{flex:1;overflow:auto;padding:14px;max-width:900px;width:100%;margin:0 auto}#aad .bt{border:1px solid rgba(128,128,160,.5);background:rgba(128,128,160,.15);border-radius:10px;padding:7px 12px;margin:0 6px 6px 0}" +
    "#aad label{display:block;margin:10px 0 3px;font-size:12px;opacity:.8}#aad input[type=text],#aad input[type=number],#aad textarea,#aad select{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(128,128,160,.5);background:rgba(128,128,160,.12);color:inherit;padding:8px 10px;font:inherit}" +
    "#aad textarea{min-height:76px;resize:vertical;font-family:ui-monospace,monospace;font-size:12.5px}#aad .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}#aad .ck{display:flex;gap:8px;align-items:center;margin:8px 0}#aad .ck input{width:auto}" +
    "#aad table{width:100%;border-collapse:collapse;font-size:12.5px;margin:6px 0 14px}#aad td,#aad th{border-bottom:1px solid rgba(128,128,160,.3);padding:5px 6px;text-align:left;vertical-align:top}" +
    "#aad .lg{font:12px/1.5 ui-monospace,monospace;background:rgba(0,0,0,.25);border-radius:10px;padding:8px 10px;height:190px;overflow:auto;white-space:pre-wrap;margin:8px 0}" +
    "#aad .ok{color:#4ade80}#aad .no{color:#f87171}#aad h4{margin:16px 0 6px;color:#f5c04a}#aad .mu{opacity:.7;font-size:12px}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var fmt = function (n) { return Number(n || 0).toLocaleString("id-ID") };
  function open() {
    if (!root) { root = document.createElement("div"); root.id = "aad"; document.body.appendChild(root); root.addEventListener("click", onClick); root.addEventListener("change", onChange) }
    root.hidden = false; render();
  }
  function shell(body) {
    var T = [["cfg", "Model & Prompt"], ["use", "Penggunaan"], ["rag", "Materi (RAG)"], ["usr", "Pengguna"]];
    root.innerHTML = "<div class='hd'><b>ADMIN AI</b>" + T.map(function (t) { return "<button class='tb" + (tab === t[0] ? " on" : "") + "' data-t='" + t[0] + "'>" + t[1] + "</button>" }).join("") + "<button class='tb' data-x='1'>✕ Tutup</button></div><div class='bd' id='aadB'>" + body + "</div>";
  }
  function render() { shell("<div class='mu'>Memuat…</div>"); ({ cfg: rCfg, use: rUse, rag: rRag, usr: rUsr })[tab]().catch(function (e) { $("aadB").innerHTML = "<div class='no'>Gagal: " + esc(e && e.message || e) + "</div>" }) }
  async function J(p, o) { var r = await api(p, o); if (!r.ok) throw new Error((r.j && r.j.err) || "kode " + r.s); return r.j }

  /* ---------- Model & Prompt ---------- */
  async function rCfg() {
    var j = await J("ai/admin/cfg"); CFG = j.cfg; INFO = j; var c = CFG;
    var flag = function (v, n) { return "<span class='" + (v ? "ok" : "no") + "'>" + (v ? "✓" : "✗") + " " + n + "</span>" };
    $("aadB").innerHTML = "<p>" + flag(j.db, "Supabase") + " &nbsp; " + flag(j.key, "APINEX_API_KEY") + " &nbsp; " + flag(j.drive, "DRIVE_API_KEY (opsional)") + " &nbsp; " + flag(j.cf_ai, "Workers AI (cadangan)") + "</p><p class='mu'>Base URL: " + esc(j.base) + "</p>" +
      "<div class='ck'><input type='checkbox' id='aEn'" + (c.enabled ? " checked" : "") + "><span>AI aktif untuk mahasiswa</span></div>" +
      "<div class='ck'><input type='checkbox' id='aCa'" + (c.cache ? " checked" : "") + "><span>Cache jawaban pertanyaan pembuka yang sama (hemat token)</span></div>" +
      "<div class='ck'><input type='checkbox' id='aFb'" + (c.fallback_ai ? " checked" : "") + "><span>Cadangan terakhir: Workers AI bila semua model APInex gagal</span></div>" +
      "<h4>Routing model</h4><div class='mu'>Satu model per baris; urutan = urutan cadangan. <b>fast</b> untuk pertanyaan ringan, <b>smart</b> untuk yang kompleks (penjelasan mekanisme, soal latihan, konteks besar).</div>" +
      "<label>Tier fast</label><textarea id='aFa'>" + esc(c.tiers.fast.join("\n")) + "</textarea><label>Tier smart</label><textarea id='aSm'>" + esc(c.tiers.smart.join("\n")) + "</textarea>" +
      "<label>Paksa tier</label><select id='aFo'>" + [["", "Otomatis"], ["fast", "Selalu fast"], ["smart", "Selalu smart"]].map(function (o) { return "<option value='" + o[0] + "'" + (c.force_tier === o[0] ? " selected" : "") + ">" + o[1] + "</option>" }).join("") + "</select>" +
      "<p><button class='bt' data-a='test'>Tes semua model</button></p><div id='aadT' class='mu'></div>" +
      "<h4>Kuota & konteks</h4><div class='g2'><div><label>Pesan per akun per hari</label><input type='number' id='aQr' value='" + c.quota.req + "'></div><div><label>Token per akun per hari</label><input type='number' id='aQt' value='" + c.quota.tok + "'></div>" +
      "<div><label>Riwayat dikirim (pesan)</label><input type='number' id='aHi' value='" + c.ctx.history + "'></div><div><label>Potongan materi per jawaban</label><input type='number' id='aCh' value='" + c.ctx.chunks + "'></div>" +
      "<div><label>Maks. token jawaban</label><input type='number' id='aMo' value='" + c.ctx.max_out + "'></div><div><label>Maks. karakter konteks</label><input type='number' id='aWh' value='" + c.ctx.whole_chars + "'></div></div>" +
      "<h4>Prompt sistem</h4><textarea id='aPr' style='min-height:200px'>" + esc(c.prompt) + "</textarea>" +
      "<p><button class='bt p' data-a='save'>Simpan pengaturan</button></p>";
  }
  var lines = function (id) { return $(id).value.split("\n").map(function (s) { return s.trim() }).filter(Boolean) };
  async function saveCfg() {
    var b = { enabled: $("aEn").checked, cache: $("aCa").checked, fallback_ai: $("aFb").checked, force_tier: $("aFo").value, tiers: { fast: lines("aFa"), smart: lines("aSm") }, quota: { req: +$("aQr").value, tok: +$("aQt").value }, ctx: { history: +$("aHi").value, chunks: +$("aCh").value, max_out: +$("aMo").value, whole_chars: +$("aWh").value }, prompt: $("aPr").value };
    var j = await J("ai/admin/cfg", { m: "PUT", b: b }); CFG = j.cfg; toast("✓ Pengaturan AI tersimpan"); rCfg();
  }
  async function testAll() {
    var ms = lines("aFa").concat(lines("aSm")).filter(function (m, i, a) { return a.indexOf(m) === i }), el = $("aadT"); el.innerHTML = "";
    for (var i = 0; i < ms.length; i++) {
      el.innerHTML += "<div id='tm" + i + "'>" + esc(ms[i]) + " … menguji</div>";
      try { var r = await J("ai/admin/test", { m: "POST", b: { model: ms[i] } }); $("tm" + i).innerHTML = esc(ms[i]) + " " + (r.ok ? "<span class='ok'>✓ " + r.ms + " ms</span> “" + esc(r.text) + "”" : "<span class='no'>✗ " + esc(r.err || "gagal") + "</span>") }
      catch (e) { $("tm" + i).innerHTML = esc(ms[i]) + " <span class='no'>✗ " + esc(e.message) + "</span>" }
    }
  }

  /* ---------- Penggunaan ---------- */
  async function rUse(d) {
    d = d || 7; var j = await J("ai/admin/stats?d=" + d), tt = 0;
    var tbl = function (h, rows) { return "<table><tr>" + h.map(function (x) { return "<th>" + x + "</th>" }).join("") + "</tr>" + (rows.length ? rows.map(function (r) { return "<tr>" + r.map(function (x) { return "<td>" + x + "</td>" }).join("") + "</tr>" }).join("") : "<tr><td colspan='" + h.length + "' class='mu'>Belum ada data</td></tr>") + "</table>" };
    (j.daily || []).forEach(function (x) { tt += +x.tin + +x.tout });
    $("aadB").innerHTML = "<label>Periode</label><select id='aDy'>" + [7, 30, 90].map(function (n) { return "<option value='" + n + "'" + (n === d ? " selected" : "") + ">" + n + " hari</option>" }).join("") + "</select>" +
      "<p>Total token periode ini: <b>" + fmt(tt) + "</b> · materi terindeks: <b>" + j.docs + "</b> dokumen (" + fmt(j.chunks) + " potongan)</p>" +
      "<h4>Per hari</h4>" + tbl(["Tanggal", "Pengguna", "Pesan", "Token masuk", "Token keluar"], (j.daily || []).map(function (x) { return [x.day, x.users, fmt(x.req), fmt(x.tin), fmt(x.tout)] })) +
      "<h4>Pengguna teratas</h4>" + tbl(["Akun", "Pesan", "Token"], (j.users || []).map(function (x) { return [esc(x.u) + (window.MHS && MHS[x.u] ? " <span class='mu'>" + esc(MHS[x.u]) + "</span>" : ""), fmt(x.req), fmt(x.tok)] })) +
      "<h4>Per model (jawaban)</h4>" + tbl(["Model", "Jawaban", "Token masuk", "Token keluar"], (j.models || []).map(function (x) { return [esc(x.model), x.n, fmt(x.tin), fmt(x.tout)] })) +
      "<h4>Kesehatan model (sejak awal)</h4>" + tbl(["Model", "Berhasil", "Gagal", "Terakhir", "Galat terakhir"], (j.model_stats || []).map(function (x) { return [esc(x.model), x.ok, x.fail, x.last_ms == null ? "-" : x.last_ms + " ms", esc((x.last_err || "").slice(0, 80))] }));
    $("aDy").onchange = function () { rUse(+this.value).catch(function (e) { toast(e.message) }) };
  }

  /* ---------- Pengguna ---------- */
  async function rUsr() {
    var j = await J("ai/admin/users"), l = j.users || [];
    $("aadB").innerHTML = "<p class='mu'>Atur batas khusus atau blokir akun tertentu. Kosongkan batas = ikut pengaturan umum.</p><div class='g2'><div><label>NIM</label><input type='text' id='uU' placeholder='G0025001'></div><div><label>Catatan</label><input type='text' id='uN'></div>" +
      "<div><label>Batas pesan/hari</label><input type='number' id='uR'></div><div><label>Batas token/hari</label><input type='number' id='uT'></div></div><div class='ck'><input type='checkbox' id='uB'><span>Blokir dari fitur AI</span></div><p><button class='bt p' data-a='usave'>Simpan</button></p>" +
      "<table><tr><th>NIM</th><th>Status</th><th>Pesan</th><th>Token</th><th>Catatan</th></tr>" + (l.length ? l.map(function (u) { return "<tr data-u='" + esc(u.u) + "' data-b='" + (u.blocked ? 1 : 0) + "' data-r='" + (u.req_limit || "") + "' data-t='" + (u.tok_limit || "") + "' data-n='" + esc(u.note || "") + "' style='cursor:pointer'><td>" + esc(u.u) + "</td><td>" + (u.blocked ? "<span class='no'>diblokir</span>" : "aktif") + "</td><td>" + (u.req_limit || "-") + "</td><td>" + (u.tok_limit || "-") + "</td><td>" + esc(u.note || "") + "</td></tr>" }).join("") : "<tr><td colspan='5' class='mu'>Belum ada pengaturan khusus</td></tr>") + "</table>";
  }

  /* ---------- Materi (RAG): ekstraksi teks di browser ---------- */
  var fnv = function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0).toString(36) + "-" + s.length };
  var MAXC = 1500;
  function pack(secs) { // secs: [{loc, text}] → potongan ≤ ±1500 karakter; seksi kecil digabung
    var out = [], pend = null;
    function push(loc, text) { text = text.trim(); if (text.length < 5) return; if (pend && pend.text.length < 400 && pend.text.length + text.length <= MAXC) { pend.text += "\n\n" + (loc ? loc + "\n" : "") + text; return } if (pend) out.push(pend); pend = { loc: loc, text: (loc ? loc + "\n" : "") + text } }
    secs.forEach(function (s) {
      var t = s.text; if (t.length <= MAXC) { push(s.loc, t); return }
      var ls = t.split("\n"), cur = "", n = 1;
      ls.forEach(function (l) { while (l.length > 3000) { if (cur) { push(s.loc + (n > 1 ? " (lanj. " + n + ")" : ""), cur); cur = ""; n++ } push(s.loc + " (lanj. " + n + ")", l.slice(0, 3000)); n++; l = l.slice(3000) } if (cur && cur.length + l.length > MAXC) { push(s.loc + (n > 1 ? " (lanj. " + n + ")" : ""), cur); cur = ""; n++ } cur += (cur ? "\n" : "") + l });
      if (cur) push(s.loc + (n > 1 ? " (lanj. " + n + ")" : ""), cur);
    });
    if (pend) out.push(pend);
    return out.map(function (p) { return { loc: p.loc, content: p.text.slice(0, 3900) } });
  }
  var BLK = /^(P|DIV|LI|UL|OL|TABLE|TR|SECTION|ARTICLE|BLOCKQUOTE|PRE|BR|HR|DD|DT|DL|FIGURE|FIGCAPTION|HEADER|FOOTER|MAIN|ASIDE|FORM|DETAILS|SUMMARY|THEAD|TBODY)$/;
  function htmlChunks(html) {
    var d = new DOMParser().parseFromString(html, "text/html");
    d.querySelectorAll("script,style,noscript,svg,img,iframe,canvas,video,audio,template,head,nav").forEach(function (n) { n.remove() });
    var secs = [], head = "", lines = [], cur = "";
    function endLine() { var t = cur.replace(/\s+/g, " ").trim(); cur = ""; if (t.length > 1) lines.push(t) }
    function endSec() { endLine(); if (lines.length) secs.push({ loc: head, text: lines.join("\n") }); lines = [] }
    (function walk(n) {
      if (n.nodeType === 3) { cur += n.nodeValue; return }
      if (n.nodeType !== 1) return;
      var t = n.tagName;
      if (/^H[1-6]$/.test(t)) { endSec(); var hh = (n.textContent || "").replace(/\s+/g, " ").trim(); if (hh) head = hh.slice(0, 110); return }
      if (t === "TD" || t === "TH") { if (cur.trim()) cur += " | " }
      var b = BLK.test(t); if (b) endLine();
      for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
      if (b) endLine();
    })(d.body || d.documentElement);
    endSec();
    return pack(secs);
  }
  var dec = function (s) { return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n) }).replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)) }).replace(/&amp;/g, "&") };
  function xmlText(xml) {
    var out = [];
    (xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) || []).forEach(function (p) { var t = []; p.replace(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\s*\/>/g, function (m, x) { t.push(x === undefined ? "\n" : x) }); var s = dec(t.join("")).replace(/[ \t]+/g, " ").trim(); if (s) out.push(s) });
    return out.join("\n");
  }
  async function pptxChunks(buf) {
    await lib(CDN + "jszip/3.10.1/jszip.min.js");
    var z = await JSZip.loadAsync(buf), pf = z.file("ppt/presentation.xml"); if (!pf) return null;
    var str = async function (p) { var f = z.file(p); return f ? await f.async("string") : "" };
    var px = await pf.async("string"), rels = await str("ppt/_rels/presentation.xml.rels"), map = {}, order = [];
    rels.replace(/<Relationship\b[^>]*>/g, function (r) { var id = (r.match(/\bId="([^"]+)"/) || [])[1], tg = (r.match(/\bTarget="([^"]+)"/) || [])[1]; if (id && tg) map[id] = tg });
    px.replace(/<p:sldId\b[^>]*>/g, function (s) { var rid = (s.match(/\br:id="([^"]+)"/) || [])[1]; if (rid && map[rid]) order.push("ppt/" + map[rid].replace(/^\/?(ppt\/)?/, "")) });
    if (!order.length) order = Object.keys(z.files).filter(function (k) { return /^ppt\/slides\/slide\d+\.xml$/.test(k) }).sort(function (a, b) { return parseInt(a.match(/(\d+)\.xml/)[1]) - parseInt(b.match(/(\d+)\.xml/)[1]) });
    var pieces = [];
    for (var i = 0; i < order.length; i++) {
      var path = order[i], xml = await str(path), txt = xmlText(xml), note = "";
      var base = path.split("/").pop(), rl = await str("ppt/slides/_rels/" + base + ".rels"), nm = rl.match(/Target="[^"]*notesSlides\/([^"]+)"/);
      if (nm) note = xmlText(await str("ppt/notesSlides/" + nm[1])).split("\n").filter(function (l) { return !/^[‹<]?#[›>]?$|^\d{1,3}$/.test(l.trim()) }).join("\n");
      var body = (txt + (note ? "\nCatatan pembicara: " + note : "")).trim();
      if (body.length >= 3) pieces.push({ n: i + 1, text: body });
    }
    var out = [], grp = [], len = 0;
    function flush() { if (!grp.length) return; var a = grp[0].n, b = grp[grp.length - 1].n; out.push({ loc: a === b ? "Slide " + a : "Slide " + a + "–" + b, content: grp.map(function (p) { return "Slide " + p.n + ": " + p.text }).join("\n\n").slice(0, 3900) }); grp = []; len = 0 }
    pieces.forEach(function (p) { if (grp.length && len + p.text.length > 1200) flush(); grp.push(p); len += p.text.length });
    flush();
    return out;
  }

  var logEl = null;
  function log(t, cls) { if (!logEl) return; var d = document.createElement("div"); if (cls) d.className = cls; d.textContent = t; logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight }
  function collect() {
    var out = [], seen = {};
    (function walk(o, blk) {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) { o.forEach(function (x) { walk(x, blk) }); return }
      if (typeof o.n === "string" && (o.h || o.hid || o.u)) { var k = aiKey(o); if ((o.h || o.hid || /^g:/.test(k)) && !seen[k]) { seen[k] = 1; out.push({ x: o, key: k, blk: blk }) } return }
      var nb = typeof o.n === "string" && o.n ? o.n : blk;
      for (var p in o) { if (p === "ui" || p === "sheet" || p === "drive") continue; walk(o[p], nb) }
    })(S.data, "");
    return out;
  }
  async function indexItem(it, existing, force) {
    var x = it.x, chunks, kind;
    if (x.h || x.hid) {
      var html = x.h;
      if (!html) { var r = await api("html?id=" + encodeURIComponent(x.hid)); if (!r.ok || !r.j || typeof r.j.h !== "string") throw new Error("file HTML tidak terbaca"); html = r.j.h }
      chunks = htmlChunks(html); kind = "html";
    } else {
      var id = it.key.slice(2), k = /presentation\/d\//.test(x.u || "") ? "slides" : "";
      var resp = await fetch(fUrl(id, k), { headers: { authorization: "Bearer " + S.t } });
      if (!resp.ok) throw new Error("Drive " + resp.status + " (pastikan dibagikan 'siapa saja yang memiliki link')");
      var buf = await resp.arrayBuffer(), h = new Uint8Array(buf, 0, 4);
      if (h[0] === 0x25 && h[1] === 0x50) throw new Error("PDF dilewati (belum didukung)");
      if (!(h[0] === 0x50 && h[1] === 0x4b)) throw new Error("bukan file PPTX");
      chunks = await pptxChunks(buf); kind = "pptx"; if (!chunks) throw new Error("bukan file PowerPoint");
    }
    if (!chunks.length) throw new Error("tidak ada teks (slide berisi gambar saja?)");
    var hash = fnv(chunks.map(function (c) { return c.content }).join("\u0001"));
    if (!force && existing[it.key] && existing[it.key].hash === hash) return "tidak berubah, dilewati";
    var res = await J("ai/admin/doc", { m: "POST", b: { skey: it.key, title: x.n, block: it.blk, kind: kind, url: x.u || "", hash: hash, chunks: chunks } });
    return res.n + " potongan";
  }
  async function runIndex(items, force) {
    if (running) { toast("Indeks sedang berjalan"); return } running = true; stop = false;
    var existing = {}; try { ((await J("ai/admin/docs")).docs || []).forEach(function (d) { existing[d.skey] = d }) } catch (e) {}
    var okN = 0, bad = 0;
    for (var i = 0; i < items.length && !stop; i++) {
      var it = items[i], pre = "(" + (i + 1) + "/" + items.length + ") " + it.x.n;
      try { log(pre + " → " + await indexItem(it, existing, force), "ok"); okN++ } catch (e) { log(pre + " ✗ " + (e && e.message || e), "no"); bad++ }
    }
    running = false; log((stop ? "Dihentikan. " : "Selesai. ") + okN + " berhasil, " + bad + " gagal/dilewati.", stop || bad ? "no" : "ok");
    if (tab === "rag") listDocs();
  }
  async function rRag() {
    var items = collect(), dr = (S.data && S.data.drive) || [];
    $("aadB").innerHTML = "<p class='mu'>Ekstrak teks dari materi HTML dan slide PPT lalu simpan ke Supabase agar AI bisa menjawab berdasarkan materi dan menyebut sumbernya. Terdeteksi di daftar materi: <b>" + items.length + "</b> item (HTML + PPT/Slides). Kerjakan dari browser ini; biarkan tab tetap terbuka sampai selesai.</p>" +
      "<div class='ck'><input type='checkbox' id='rF'><span>Indeks ulang semua (abaikan 'tidak berubah')</span></div>" +
      "<p><button class='bt p' data-a='idxall'>Indeks semua materi (" + items.length + ")</button><button class='bt' data-a='stop'>Hentikan</button></p>" +
      "<h4>Folder Google Drive</h4><div class='mu'>Mengambil semua PPT/Google Slides di dalam folder (maks. 3 tingkat subfolder). Butuh DRIVE_API_KEY dan folder dibagikan ke “siapa saja yang memiliki link”.</div><p>" +
      dr.map(function (f, i) { return "<button class='bt' data-a='idxdrv' data-i='" + i + "'>" + esc(f.n) + "</button>" }).join("") + "<button class='bt' data-a='idxdrv' data-i='-1'>Folder lain…</button></p>" +
      "<div class='lg' id='aadL'>Siap.</div><h4>Materi terindeks</h4><div id='aadD'><div class='mu'>Memuat…</div></div>";
    logEl = $("aadL"); logEl.textContent = ""; listDocs();
  }
  async function listDocs() {
    try {
      var l = (await J("ai/admin/docs")).docs || [], el = $("aadD"); if (!el) return;
      el.innerHTML = l.length ? "<table><tr><th>Materi</th><th>Jenis</th><th>Bagian</th><th>Aktif</th><th></th></tr>" + l.map(function (d) { return "<tr><td>" + esc(d.title) + "<div class='mu'>" + esc(d.block || "") + " · " + esc((d.updated_at || "").slice(0, 10)) + "</div></td><td>" + esc(d.kind) + "</td><td>" + d.n_chunks + "</td><td><input type='checkbox' data-tg='" + d.id + "'" + (d.enabled ? " checked" : "") + "></td><td><button class='bt' data-del='" + d.id + "'>Hapus</button></td></tr>" }).join("") + "</table>" : "<div class='mu'>Belum ada materi yang diindeks.</div>";
    } catch (e) { var el2 = $("aadD"); if (el2) el2.innerHTML = "<div class='no'>" + esc(e.message) + "</div>" }
  }
  async function idxDrive(i) {
    var u = ""; if (+i >= 0) u = ((S.data.drive || [])[+i] || {}).u || ""; else u = await Dlg.prompt("Tempel tautan folder Google Drive (atau tautan pendek seperti uns.id/…)", "", { title: "Indeks folder Drive" });
    if (!u) return; log("Membaca isi folder Drive…");
    var fl; try { fl = (await J("ai/admin/drive?u=" + encodeURIComponent(u))).files } catch (e) { log("✗ " + e.message, "no"); return }
    if (!fl.length) { log("Tidak ada PPT/Google Slides di folder itu.", "no"); return }
    log(fl.length + " file ditemukan.");
    runIndex(fl.map(function (f) { return { key: "g:" + f.id, blk: ((+i >= 0 && S.data.drive[+i].n) ? S.data.drive[+i].n.replace(/\s*-\s*Google Drive.*$/i, "") + " / " : "") + f.path.replace(/\/$/, ""), x: { n: f.name, u: f.k === "slides" ? "https://docs.google.com/presentation/d/" + f.id : "https://drive.google.com/file/d/" + f.id + "/view" } } }), $("rF") && $("rF").checked);
  }

  /* ---------- event ---------- */
  function onClick(e) {
    var t = e.target.closest("[data-t]"), x = e.target.closest("[data-x]"), a = e.target.closest("[data-a]"), dl = e.target.closest("[data-del]"), tr = e.target.closest("tr[data-u]");
    if (x) { root.hidden = true; return }
    if (t) { tab = t.dataset.t; render(); return }
    if (dl) { Dlg.confirm("Hapus materi ini dari indeks AI? (materi aslinya tidak berubah)").then(function (ok) { if (ok) J("ai/admin/doc/del", { m: "POST", b: { id: +dl.dataset.del } }).then(listDocs).catch(function (er) { toast(er.message) }) }); return }
    if (tr) { $("uU").value = tr.dataset.u; $("uB").checked = tr.dataset.b === "1"; $("uR").value = tr.dataset.r; $("uT").value = tr.dataset.t; $("uN").value = tr.dataset.n; return }
    if (!a) return;
    var k = a.dataset.a, f = function (p) { p.catch(function (er) { toast(er && er.message || "Gagal") }) };
    if (k === "save") f(saveCfg()); else if (k === "test") f(testAll());
    else if (k === "idxall") f(runIndex(collect(), $("rF").checked)); else if (k === "stop") { stop = true }
    else if (k === "idxdrv") f(idxDrive(a.dataset.i));
    else if (k === "usave") f(J("ai/admin/users", { m: "POST", b: { u: $("uU").value, blocked: $("uB").checked, req_limit: $("uR").value, tok_limit: $("uT").value, note: $("uN").value } }).then(function () { toast("✓ Tersimpan"); rUsr() }));
  }
  function onChange(e) {
    var g = e.target.closest("[data-tg]"); if (!g) return;
    J("ai/admin/doc/toggle", { m: "POST", b: { id: +g.dataset.tg, enabled: g.checked } }).catch(function (er) { toast(er.message); g.checked = !g.checked });
  }
})();
