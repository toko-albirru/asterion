/* ASTERION — Tanya AI (tombol melayang + panel obrolan).
   Memakai /api/ai/* (backend src/ai.js → APInex). Tidak mengubah fitur lain: hanya membungkus viewer/hOpen/pvOpen
   untuk mengetahui materi yang sedang dibuka. Bergantung pada global index.html: $, esc, S, api, toast, logout, mKey, gid, hOpen. */
(function () {
  if (window.AI) return;
  var AI = window.AI = { conv: "", msgs: [], busy: false, cur: null, scope: "cur", open: false, st: null };

  /* ---------- materi yang sedang dibuka ---------- */
  function aiKey(x) {
    if (!x) return "";
    if (x.hid) return "h:" + x.hid;
    var u = String(x.u || ""), g = /drive\.google\.com\/file\/d\/|docs\.google\.com\/presentation\/d\//.test(u) ? gid(u) : "";
    return g ? "g:" + g : u ? "u:" + u : "n:" + (x.n || "");
  }
  window.aiKey = aiKey;
  function wrap(name, fn) { try { var o = window[name]; if (typeof o !== "function") return; window[name] = function () { try { fn.apply(null, arguments); } catch (e) {} return o.apply(this, arguments); }; } catch (e) {} }
  wrap("viewer", function (x) { if (x && x.n) AI.cur = { n: x.n, skey: aiKey(x), x: x }; });
  wrap("hOpen", function (x) { if (x && x.n) AI.cur = { n: x.n, skey: aiKey(x), x: x }; });
  wrap("pvOpen", function (id, name) { if (id) AI.cur = { n: name || "Materi", skey: "g:" + id }; });
  function curActive() { return !!(AI.cur && ($("hov") || $("pvm") || $("ft"))); }

  /* ---------- gaya ---------- */
  var css = "#aiFab{position:fixed;right:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:10003;width:50px;height:50px;border-radius:50%;border:1px solid rgba(245,192,74,.55);background:linear-gradient(135deg,#4b2f8f,#2a1b55);color:#f5c04a;font-size:22px;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:0;touch-action:none;-webkit-user-select:none;user-select:none}#aiFab.dg{cursor:grabbing;transition:none;opacity:.9}" +
    "#aiFab[hidden],#aiP[hidden]{display:none!important}#aiFab:active{transform:scale(.94)}" +
    "#aiP{position:fixed;z-index:10004;right:12px;bottom:12px;width:min(430px,calc(100vw - 24px));height:min(640px,calc(100dvh - 24px));display:flex;flex-direction:column;border-radius:20px;overflow:hidden;background:rgba(24,17,44,.97);color:#fff;border:1px solid rgba(255,255,255,.2);box-shadow:0 16px 60px rgba(0,0,0,.6);font:14px/1.5 Inter,system-ui,sans-serif}" +
    ":root[data-theme=light] #aiP{background:rgba(255,255,255,.98);color:#241a3f;border-color:rgba(0,0,0,.15)}" +
    "@media(max-width:560px){#aiP{right:0;bottom:0;width:100vw;height:88dvh;border-radius:20px 20px 0 0}}" +
    "#aiP .ah{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.14)}#aiP .ah b{flex:1;font:600 13px Cinzel,serif;letter-spacing:.1em;color:#f5c04a;text-align:center}" +
    "#aiP button{font:inherit;color:inherit;cursor:pointer}#aiP .ib{width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);font-size:15px;padding:0}" +
    ":root[data-theme=light] #aiP .ib{border-color:rgba(0,0,0,.18);background:rgba(0,0,0,.04)}" +
    "#aiP .sc{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1);flex-wrap:wrap}#aiP .pl{border:1px solid rgba(255,255,255,.25);background:transparent;border-radius:99px;padding:4px 11px;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    "#aiP .pl.on{background:#f5c04a;color:#1b1233;border-color:#f5c04a;font-weight:600}" +
    "#aiP .ms{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}" +
    "#aiP .m{max-width:94%;padding:9px 12px;border-radius:14px;word-wrap:break-word;overflow-wrap:anywhere}#aiP .m.u{align-self:flex-end;background:#5a3fb0;color:#fff;white-space:pre-wrap}" +
    "#aiP .m.a{align-self:flex-start;background:rgba(255,255,255,.09)}:root[data-theme=light] #aiP .m.a{background:rgba(0,0,0,.06)}#aiP .m.e{border:1px solid #f87171}" +
    "#aiP .m p{margin:0 0 6px}#aiP .m ul,#aiP .m ol{margin:4px 0 6px;padding-left:20px}#aiP .m h4{margin:8px 0 4px;color:#f5c04a;font-size:14px}#aiP .m code{background:rgba(0,0,0,.3);padding:1px 5px;border-radius:5px;font-size:12.5px}" +
    "#aiP .m table{border-collapse:collapse;font-size:12.5px;display:block;overflow-x:auto}#aiP .m td,#aiP .m th{border:1px solid rgba(255,255,255,.25);padding:3px 7px}" +
    "#aiP sup.aic{cursor:pointer;color:#f5c04a;font-weight:700;padding:0 1px}" +
    "#aiP .src{margin-top:6px;display:flex;flex-wrap:wrap;gap:5px}#aiP .sb{font-size:11.5px;border:1px solid rgba(245,192,74,.5);background:rgba(245,192,74,.1);border-radius:8px;padding:3px 8px;text-align:left;max-width:100%}" +
    "#aiP .tp{display:inline-flex;gap:4px}#aiP .tp i{width:6px;height:6px;border-radius:50%;background:#f5c04a;animation:aib 1s infinite}#aiP .tp i:nth-child(2){animation-delay:.15s}#aiP .tp i:nth-child(3){animation-delay:.3s}@keyframes aib{0%,80%,100%{opacity:.25}40%{opacity:1}}" +
    "#aiP .cp{display:flex;gap:6px;padding:0 12px 8px;flex-wrap:wrap}#aiP .cp button{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);border-radius:99px;padding:5px 11px;font-size:12px}" +
    "#aiP .fm{display:flex;gap:8px;padding:8px 12px;border-top:1px solid rgba(255,255,255,.14);align-items:flex-end}#aiP textarea{flex:1;resize:none;max-height:110px;min-height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.07);color:inherit;padding:8px 10px;font:inherit}" +
    ":root[data-theme=light] #aiP textarea{border-color:rgba(0,0,0,.2);background:#fff}#aiP .go{width:40px;height:40px;border-radius:12px;border:0;background:#f5c04a;color:#1b1233;font-size:17px;font-weight:700}#aiP .go:disabled{opacity:.45}" +
    "#aiP .nt{padding:0 12px 8px;font-size:11px;opacity:.7;display:flex;justify-content:space-between;gap:8px}" +
    "#aiP .hs{position:absolute;inset:55px 0 0 0;background:inherit;z-index:2;overflow-y:auto;padding:10px 12px}#aiP .hs[hidden]{display:none}#aiP .hr{display:flex;gap:6px;margin-bottom:6px}#aiP .hr .t{flex:1;text-align:left;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);border-radius:10px;padding:8px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    "#aiP .em{margin:auto;text-align:center;opacity:.8;padding:10px 14px}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- markdown ringan ---------- */
  function inl(t) {
    return t.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<i>$2</i>").replace(/\[(\d{1,2})\]/g, "<sup class='aic' data-n='$1'>$1</sup>");
  }
  function md(s) {
    var L = esc(s).split("\n"), out = [], list = null, tb = null, m;
    function close() { if (list) { out.push("</" + list + ">"); list = null } if (tb) { out.push("<table>" + tb.join("") + "</table>"); tb = null } }
    L.forEach(function (l) {
      if (/^\s*\|.*\|\s*$/.test(l)) { if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) return; if (list) close(); tb = tb || []; var tag = tb.length ? "td" : "th"; tb.push("<tr>" + l.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return "<" + tag + ">" + inl(c.trim()) + "</" + tag + ">" }).join("") + "</tr>"); return }
      if (tb) close();
      if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul" } out.push("<li>" + inl(m[1]) + "</li>") }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol" } out.push("<li>" + inl(m[1]) + "</li>") }
      else if ((m = l.match(/^#{1,4}\s+(.*)/))) { close(); out.push("<h4>" + inl(m[1]) + "</h4>") }
      else if (!l.trim()) { close() }
      else { close(); out.push("<p>" + inl(l) + "</p>") }
    });
    close(); return out.join("");
  }

  /* ---------- UI ---------- */
  var fab, pan, ms, ta, goB, hs;
  function build() {
    fab = document.createElement("button"); fab.id = "aiFab"; fab.type = "button"; fab.hidden = true; fab.setAttribute("aria-label", "Tanya AI"); fab.title = "Tanya AI"; fab.textContent = "✨";
    fab.onclick = function () { if (fab._moved) { fab._moved = false; return } openP() };
    document.body.appendChild(fab); dragFab(fab);
    pan = document.createElement("div"); pan.id = "aiP"; pan.hidden = true;
    pan.innerHTML = "<div class='ah'><button class='ib' data-a='hist' title='Riwayat'>🕘</button><b>TANYA AI</b><button class='ib' data-a='new' title='Percakapan baru'>＋</button><button class='ib' data-a='adm' title='Pengaturan AI (admin)' hidden>⚙</button><button class='ib' data-a='x' title='Tutup'>✕</button></div>" +
      "<div class='sc' id='aiSc'></div><div class='ms' id='aiMs'></div><div class='hs' id='aiHs' hidden></div><div class='cp' id='aiCp'></div>" +
      "<div class='fm'><textarea id='aiQ' rows='1' maxlength='2000' placeholder='Tanya tentang materi atau slide…'></textarea><button class='go' id='aiGo' type='button' aria-label='Kirim'>➤</button></div>" +
      "<div class='nt'><span>AI bisa keliru — cek kembali ke materi &amp; dosen.</span><span id='aiQt'></span></div>";
    document.body.appendChild(pan);
    ms = $("aiMs"); ta = $("aiQ"); goB = $("aiGo"); hs = $("aiHs");
    pan.addEventListener("click", onClick);
    goB.onclick = function () { send(ta.value) };
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer:coarse)").matches) { e.preventDefault(); send(ta.value) } });
    ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(110, ta.scrollHeight) + "px" });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && AI.open && !$("dlg")) closeP() });
  }
  function onClick(e) {
    var b = e.target.closest("[data-a]");
    if (b) {
      var a = b.dataset.a;
      if (a === "x") closeP(); else if (a === "new") newChat(); else if (a === "hist") toggleHist();
      else if (a === "adm") adminOpen();
      else if (a === "scope") { AI.scope = b.dataset.v; drawScope() }
      else if (a === "chip") send(b.dataset.q);
      else if (a === "src") openSrc(b.dataset.k, b.dataset.u);
      else if (a === "copy") { var m = AI.msgs[+b.dataset.i]; if (m && navigator.clipboard) navigator.clipboard.writeText(m.content).then(function () { toast("Disalin") }) }
      return;
    }
    var c = e.target.closest("sup.aic");
    if (c) { var box = c.closest(".m"), t = box && box.querySelector(".sb[data-n='" + c.dataset.n + "']"); if (t) { t.scrollIntoView({ block: "nearest" }); t.style.outline = "2px solid #f5c04a"; setTimeout(function () { t.style.outline = "" }, 1200) } }
  }
  /* tombol AI bisa digeser (tahan lalu seret); posisi diingat di perangkat ini, menempel ke tepi kiri/kanan */
  function dragFab(el) {
    var KEY = "ast.aifab", sx = 0, sy = 0, ox = 0, oy = 0, down = false, drag = false;
    function off() { var h = document.documentElement; return h.classList.contains("pane") || h.classList.contains("spon") }
    function clamp(x, y) { var m = 6, w = el.offsetWidth || 50, h = el.offsetHeight || 50; return [Math.max(m, Math.min(innerWidth - w - m, x)), Math.max(m, Math.min(innerHeight - h - m, y))] }
    function put(x, y) { var c = clamp(x, y); el.style.right = "auto"; el.style.bottom = "auto"; el.style.left = c[0] + "px"; el.style.top = c[1] + "px"; return c }
    function load() { if (off()) return; try { var o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o && typeof o.x === "number") put(o.x * innerWidth, o.y * innerHeight) } catch (e) {} }
    el.addEventListener("pointerdown", function (e) {
      if (off() || (e.pointerType === "mouse" && e.button !== 0)) return;
      var r = el.getBoundingClientRect(); down = true; drag = false; sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      try { el.setPointerCapture(e.pointerId) } catch (_) {}
    });
    el.addEventListener("pointermove", function (e) {
      if (!down) return; var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!drag && Math.abs(dx) + Math.abs(dy) < 8) return;
      drag = true; el.classList.add("dg"); put(ox + dx, oy + dy); e.preventDefault();
    });
    function end(e) {
      if (!down) return; down = false; el.classList.remove("dg");
      try { el.releasePointerCapture(e.pointerId) } catch (_) {}
      if (!drag) return; drag = false; el._moved = true; setTimeout(function () { el._moved = false }, 350);
      var r = el.getBoundingClientRect(), x = r.left + r.width / 2 < innerWidth / 2 ? 10 : innerWidth - r.width - 10, c = put(x, r.top);
      try { localStorage.setItem(KEY, JSON.stringify({ x: c[0] / innerWidth, y: c[1] / innerHeight })) } catch (_) {}
    }
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    addEventListener("resize", load); load();
  }
  function openP() {
    if (!pan) return; AI.open = true; pan.hidden = false; fab.hidden = true; hs.hidden = true;
    AI.scope = curActive() ? "cur" : "all"; drawScope(); drawChips(); draw();
    $("aiP").querySelector("[data-a=adm]").hidden = !S.admin;
    loadStatus(); setTimeout(function () { try { ta.focus() } catch (e) {} }, 60);
  }
  function closeP() { AI.open = false; pan.hidden = true; tick() }
  function newChat() { if (AI.busy) return; AI.conv = ""; AI.msgs = []; hs.hidden = true; draw(); drawChips() }
  function drawScope() {
    var has = curActive(), el = $("aiSc");
    el.innerHTML = (has ? "<button class='pl" + (AI.scope === "cur" ? " on" : "") + "' data-a='scope' data-v='cur' title='" + esc(AI.cur.n) + "'>📄 " + esc(AI.cur.n) + "</button>" : "") +
      "<button class='pl" + (AI.scope === "all" || !has ? " on" : "") + "' data-a='scope' data-v='all'>📚 Semua materi</button>";
    if (!has) AI.scope = "all";
  }
  function drawChips() {
    var el = $("aiCp"), show = !AI.msgs.length;
    var cur = AI.scope === "cur" && curActive();
    el.innerHTML = show ? (cur ? [["Jelaskan sederhana", "Jelaskan materi ini secara sederhana dan runtut, per bagian."], ["Ringkas", "Ringkas materi ini dalam poin-poin penting yang perlu dihafal."], ["Latihan soal", "Buat 5 soal latihan pilihan ganda dari materi ini beserta kunci jawaban dan pembahasan singkat."]] : [["Cari di materi", ""]].slice(0, 0)).map(function (c) { return "<button type='button' data-a='chip' data-q='" + esc(c[1]) + "'>" + esc(c[0]) + "</button>" }).join("") : "";
  }
  function srcBtns(m) {
    if (!m.cites || !m.cites.length) return "";
    return "<div class='src'>" + m.cites.map(function (c) { return "<button type='button' class='sb' data-a='src' data-n='" + c.n + "' data-k='" + esc(c.skey || "") + "'>[" + c.n + "] " + esc(c.title) + (c.loc ? " — " + esc(c.loc) : "") + "</button>" }).join("") + "</div>";
  }
  function draw(keep) {
    var atEnd = ms.scrollHeight - ms.scrollTop - ms.clientHeight < 80;
    if (!AI.msgs.length) { ms.innerHTML = "<div class='em'>✨ Tanyakan apa saja tentang materi dan slide.<br><small>Jawaban disertai rujukan sumber [1], [2]… dari materi yang sudah diindeks admin.</small></div>"; return }
    ms.innerHTML = AI.msgs.map(function (m, i) {
      if (m.role === "user") return "<div class='m u'>" + esc(m.content) + "</div>";
      return "<div class='m a" + (m.err ? " e" : "") + "'>" + (m.content ? md(m.content) : (m.pend ? "<span class='tp'><i></i><i></i><i></i></span>" : "")) + (m.pend ? "" : srcBtns(m) + (m.content && !m.err ? "<div style='margin-top:4px'><button type='button' class='ib' style='width:auto;height:auto;padding:2px 8px;font-size:11px' data-a='copy' data-i='" + i + "'>Salin</button>" + (m.model ? " <small style='opacity:.55'>" + esc(String(m.model).replace(/^free\//, "")) + "</small>" : "") + "</div>" : "")) + "</div>";
    }).join("");
    if (atEnd || !keep) ms.scrollTop = ms.scrollHeight;
  }
  var raf = 0; function drawSoon() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; draw(true) }) }

  /* ---------- kirim & baca stream ---------- */
  function setQuota(q) { var el = $("aiQt"); if (!el) return; el.textContent = q ? "Sisa hari ini: " + Math.max(0, q.lim_req - q.req) + "/" + q.lim_req + " pesan" : (S.admin ? "Admin: tanpa batas" : "") }
  async function loadStatus() {
    try { var r = await api("ai/status"); AI.st = r.j; if (r.j && r.j.quota) setQuota(r.j.quota); else setQuota(null); if (r.j && r.j.ready === false) note("AI belum dikonfigurasi. Admin perlu mengisi kunci Supabase & APInex (lihat docs/AI-SETUP.md).") } catch (e) {}
  }
  function note(t) { if (!AI.msgs.length) ms.innerHTML = "<div class='em'>" + esc(t) + "</div>" }
  async function send(q) {
    q = String(q || "").trim(); if (!q || AI.busy) return;
    AI.busy = true; goB.disabled = true; ta.value = ""; ta.style.height = "auto"; hs.hidden = true;
    var skey = AI.scope === "cur" && curActive() ? AI.cur.skey : "";
    AI.msgs.push({ role: "user", content: q }); var m = { role: "assistant", content: "", pend: true }; AI.msgs.push(m); drawChips(); draw();
    try {
      var r = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + S.t }, body: JSON.stringify({ q: q, conv: AI.conv || undefined, skey: skey || undefined }) });
      if (r.status === 401) { logout(); return }
      if (!r.ok || !/event-stream/.test(r.headers.get("content-type") || "")) {
        var j = null; try { j = await r.json() } catch (e) {}
        m.content = (j && j.err) || "Gagal menghubungi AI (kode " + r.status + ")."; m.err = true; m.pend = false; ta.value = q; if (j && j.quota) setQuota(j.quota); draw(); return;
      }
      var rd = r.body.getReader(), dec = new TextDecoder(), buf = "";
      for (;;) {
        var x = await rd.read(); if (x.done) break;
        buf += dec.decode(x.value, { stream: true });
        var k; while ((k = buf.indexOf("\n\n")) >= 0) {
          var ln = buf.slice(0, k).trim(); buf = buf.slice(k + 2); if (ln.indexOf("data:") !== 0) continue;
          var ev; try { ev = JSON.parse(ln.slice(5)) } catch (e) { continue }
          if (ev.conv) AI.conv = ev.conv;
          if (ev.t) { m.content += ev.t; m.pend = false; drawSoon() }
          if (ev.err) { m.err = true; m.content += (m.content ? "\n\n" : "") + ev.err }
          if (ev.done) { m.cites = ev.cites || []; m.model = ev.model; m.pend = false; if (ev.quota) setQuota(ev.quota) }
        }
      }
      m.pend = false; if (!m.content) { m.content = "Tidak ada jawaban. Coba lagi."; m.err = true }
    } catch (e) { m.pend = false; m.err = true; m.content = (m.content ? m.content + "\n\n" : "") + "Koneksi terputus. Coba lagi." }
    finally { AI.busy = false; goB.disabled = false; draw(); try { ta.focus() } catch (e) {} }
  }

  /* ---------- riwayat ---------- */
  async function toggleHist() {
    if (!hs.hidden) { hs.hidden = true; return }
    hs.hidden = false; hs.innerHTML = "<div class='em'>Memuat…</div>";
    try {
      var r = await api("ai/convs"), l = (r.j && r.j.convs) || [];
      hs.innerHTML = l.length ? l.map(function (c) { return "<div class='hr'><button class='t' type='button' data-id='" + esc(c.id) + "'>" + esc(c.title) + "</button><button class='ib' type='button' data-del='" + esc(c.id) + "' title='Hapus'>🗑</button></div>" }).join("") : "<div class='em'>Belum ada riwayat.</div>";
      hs.onclick = async function (e) {
        var d = e.target.closest("[data-del]"), t = e.target.closest("[data-id]");
        if (d) { var ok = window.Dlg ? await Dlg.confirm("Hapus percakapan ini?") : confirm("Hapus percakapan ini?"); if (!ok) return; await api("ai/conv/del", { m: "POST", b: { id: d.dataset.del } }); if (AI.conv === d.dataset.del) newChat(); toggleHist(); toggleHist(); return }
        if (t) { var rr = await api("ai/conv?id=" + encodeURIComponent(t.dataset.id)); if (rr.ok) { AI.conv = t.dataset.id; AI.msgs = rr.j.msgs.map(function (x) { return { role: x.role, content: x.content, cites: x.cites, model: x.model } }); hs.hidden = true; drawChips(); draw() } }
      };
    } catch (e) { hs.innerHTML = "<div class='em'>Gagal memuat riwayat.</div>" }
  }

  /* ---------- buka sumber ---------- */
  function findItem(skey) {
    var hit = null;
    (function walk(o) { if (hit || !o || typeof o !== "object") return; if (Array.isArray(o)) { o.forEach(walk); return } if (typeof o.n === "string" && (o.h || o.hid || o.u) && aiKey(o) === skey) { hit = o; return } for (var k in o) if (k !== "ui") walk(o[k]) })(S.data);
    return hit;
  }
  function openSrc(skey) {
    var x = skey && findItem(skey); if (!x) { toast("Materi sumber tidak ditemukan di daftar."); return }
    closeP();
    if (x.h || x.hid) { try { hOpen(x) } catch (e) {} } else if (/^g:/.test(skey) && window.pvOpen) { window.pvOpen(skey.slice(2), x.n, /presentation\/d\//.test(x.u || "") ? "slides" : "") } else if (x.u) window.open(x.u, "_blank", "noopener");
  }

  /* ---------- admin (dimuat saat dibutuhkan) ---------- */
  function adminOpen() {
    if (window.AI_ADMIN) { window.AI_ADMIN.open(); return }
    var s = document.createElement("script"); s.src = "ai-admin.js?v=1"; s.onload = function () { window.AI_ADMIN && window.AI_ADMIN.open() }; s.onerror = function () { toast("Gagal memuat panel admin AI") }; document.head.appendChild(s);
  }

  /* ---------- tampil/sembunyi tombol ---------- */
  function tick() {
    if (!fab) return;
    var on = !!S.t && $("shell") && !$("shell").hidden;
    fab.hidden = !on || AI.open;
    if (!on && AI.open) { AI.open = false; pan.hidden = true }
  }
  function init() { build(); setInterval(tick, 1200); tick() }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
