/* ASTERION RUN — pembaca PDF soal pilihan ganda (berjalan di browser admin)
   Pendekatan bertingkat:
   1) ekstraksi teks (pdf.js) → baris, kolom (1/2 kolom, judul selebar halaman), soal / pilihan A–E / pembahasan
   2) anotasi Highlight PDF (koordinat quadPoints) → pilihan yang tertimpa highlight
   3) analisis visual hasil render (warna latar & warna teks pada baris pilihan)
   4) OCR (Tesseract.js, per KATA lalu disusun ulang oleh penata kolom yang sama) untuk halaman scan
   5) GAMBAR: (a) gambar embedded dibaca dari operator PDF (posisi presisi + piksel asli),
      (b) fallback: potong dari kanvas hasil render (diagram/grafik/tabel vektor, halaman scan),
      lalu setiap gambar dikaitkan ke soal berdasarkan urutan baca (halaman → kolom → posisi), petunjuk teks, dan jarak.
   Bila kunci tidak yakin → TIDAK menebak: ans=null, status "bad" (KUNCI TIDAK TERDETEKSI). */
(function () {
  var CDN = "https://cdnjs.cloudflare.com/ajax/libs/", PV = "3.11.174", LET = ["A", "B", "C", "D", "E"];
  var cache = {};
  function loadScript(u) {
    return cache[u] || (cache[u] = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = u; s.onload = res;
      s.onerror = function () { delete cache[u]; rej(new Error("Gagal memuat pustaka: " + u)); };
      document.head.appendChild(s);
    }));
  }
  async function pdfjs() {
    if (window.pdfjsLib && pdfjsLib.__asterion) return pdfjsLib;
    await loadScript(CDN + "pdf.js/" + PV + "/pdf.min.js");
    var code = await (await fetch(CDN + "pdf.js/" + PV + "/pdf.worker.min.js")).text(); // worker lintas-origin lewat Blob
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    pdfjsLib.__asterion = 1;
    return pdfjsLib;
  }
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  var median = function (a) { if (!a.length) return 0; a = a.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; };

  /* ---------- geometri ---------- */
  function rectOf(vp, x0, y0, x1, y1) {
    var r = vp.convertToViewportRectangle([x0, y0, x1, y1]);
    return { x0: Math.min(r[0], r[2]), x1: Math.max(r[0], r[2]), y0: Math.min(r[1], r[3]), y1: Math.max(r[1], r[3]) };
  }
  function interArea(a, b) {
    var w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    return w > 0 && h > 0 ? w * h : 0;
  }
  var area = function (a) { return Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0); };
  function unionR(a, b) { return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }; }

  /* ---------- pola baris soal (dipakai juga oleh penata layout) ---------- */
  var reQ = /^\s*(\d{1,4})\s*[.)]\s+(\S.*)$/, reQe = /^\s*(\d{1,4})\s*[.)]\s*$/;
  var reQ2 = /^\s*(?:no\.?|nomor|soal)\s*\(?(\d{1,4})\)?\s*[.):\-]\s*(\S.*)?$/i, reQ3 = /^\s*\((\d{1,4})\)\s+(\S.*)$/;
  function qStart(t) { var m = reQ.exec(t) || reQe.exec(t) || reQ2.exec(t) || reQ3.exec(t); return m ? { n: +m[1], rest: (m[2] || "").trim() } : null; }
  var reOS = /^\s*(?:[•·\-–*]\s*)?[\(\[]?([A-Ea-e])\s*[.)\]]\s*(\S.*)?$/;                // opsi (ketat)
  var reOO = /^\s*(?:[•·\-–*]\s*)?[\(\[]?([A-Ea-e8@0O€(])\s*[.,):;\]]\s*(\S.*)?$/;       // opsi (toleran salah-baca OCR)
  var OCRA = { "8": "B", "@": "A", "0": "D", "O": "D", "€": "E", "(": "C" };
  function optStart(t, ocr, expect) {
    var m = reOS.exec(t); if (m) return { L: m[1].toUpperCase(), rest: (m[2] || "").trim() };
    if (ocr && (m = reOO.exec(t))) {
      var c = m[1], U = c.toUpperCase(); if (/[A-E]/.test(U)) return { L: U, rest: (m[2] || "").trim() };
      if (OCRA[c] && OCRA[c] === expect) return { L: OCRA[c], rest: (m[2] || "").trim() };
    }
    return null;
  }
  var reExp = /^\s*(pembahasan|penjelasan|explanation|rationale)\s*[:\-–]?\s*(.*)$/i;
  var reKey = /^\s*(?:jawaban|kunci)(?:\s+(?:benar|jawaban|yang\s+benar))?\s*[:\-–=]\s*\(?([A-Ea-e])\)?(?![A-Za-z])\s*[.):\-]?\s*(.*)$/i;
  var reKey2 = /^\s*jawaban\s+(?:yang\s+)?(?:benar|tepat)\s+(?:adalah|ialah)\s*:?\s*\(?([A-Ea-e])\)?(?![A-Za-z])\s*[.):\-]?\s*(.*)$/i;
  var reHead = /^\s*(kunci\s*jawaban|pembahasan|jawaban\s*(?:dan|&)\s*pembahasan|kunci\s*(?:dan|&)\s*pembahasan|answer\s*key|daftar\s*jawaban)(\s+soal)?\s*:?\s*$/i;
  var reHeadBare = /^\s*(kunci|jawaban)\s*:?\s*$/i; // hanya dianggap judul bagian kunci bila baris berikutnya berupa tabel kunci
  var rePgNo = /^\s*[-–]?\s*(?:halaman|hal\.?|page)?\s*\d+\s*(?:(?:dari|of|\/)\s*\d+)?\s*[-–]?\s*$/i;
  var rePair = /(\d{1,4})\s*[.):\-–=]?\s*\(?([A-Ea-e])\)?(?![A-Za-z0-9])/g;
  var reFigCue = /\b(gambar|diagram|grafik|foto|preparat|sediaan|histolog\w*|ilustrasi|tabel|skema|bagan|mikrograf|kurva|rontgen|ekg|gambaran)\b/i;
  var reFigStrong = /(perhatikan|lihat|amati|cermati)\s+(?:\w+\s+){0,2}(gambar|diagram|grafik|foto|tabel|skema|bagan|kurva|preparat|sediaan)|(?:pada|dari|berdasarkan|di\s*bawah|di\s*atas)\s+(?:\w+\s+){0,2}(gambar|diagram|grafik|tabel|skema|bagan|kurva)|(gambar|diagram|grafik|tabel|skema|bagan|kurva|foto)\s+(berikut|di\s*(?:atas|bawah)|tersebut)/i;
  var structLine = function (t) { return !!(qStart(t) || reOS.test(t) || reExp.test(t) || reKey.test(t) || reKey2.test(t)); };

  /* ---------- layout halaman: kolom, pemisah selebar halaman, urutan baca ---------- */
  function clusterRows(arr) {
    arr = arr.slice().sort(function (a, b) { return (a.y0 + a.y1) - (b.y0 + b.y1); });
    var rows = [], row = null;
    arr.forEach(function (it) {
      var cy = (it.y0 + it.y1) / 2, h = it.y1 - it.y0;
      if (row && (Math.abs(cy - row.cy) <= 0.55 * Math.min(h, row.h) || (h < 0.5 * row.h && cy >= row.y0 - 0.1 * row.h && cy <= row.y1 + 0.1 * row.h))) {
        row.it.push(it); if (h >= 0.5 * row.h) { row.cy = (row.cy * (row.it.length - 1) + cy) / row.it.length; row.h = Math.max(row.h, h); row.y0 = Math.min(row.y0, it.y0); row.y1 = Math.max(row.y1, it.y1); }
      } else { row = { cy: cy, h: h, it: [it], y0: it.y0, y1: it.y1 }; rows.push(row); }
    });
    return rows;
  }
  function rowText(r) {
    var its = r.it.slice().sort(function (a, b) { return a.x0 - b.x0; }), t = "", prev = null;
    its.forEach(function (i) {
      if (prev && i.x0 - prev.x1 > 0.18 * (i.y1 - i.y0) && !/\s$/.test(t) && !/^\s/.test(i.s)) t += " ";
      t += i.s; prev = i;
    });
    return t.replace(/\s+/g, " ").trim();
  }
  // Cari "selokan" (celah vertikal) di sekitar tengah halaman. Toleran terhadap beberapa judul/baris yang melintas
  // (dianggap pemisah selebar halaman), dan menolak tata letak yang sebenarnya hanya pilihan berbentuk grid.
  function makeLayout(items, W, H, wide) {
    var lay = { g: null, seps: [] };
    var body = items.filter(function (i) { return i.y0 > H * 0.06 && i.y1 < H * 0.94 && (i.x1 - i.x0) < W * 0.55; });
    if (body.length >= 12) {
      var Wn = Math.ceil(W) + 4, d = new Int32Array(Wn), cov = new Int32Array(Wn);
      body.forEach(function (i) { d[Math.max(0, Math.floor(i.x0))]++; d[Math.min(Wn - 1, Math.ceil(i.x1) + 1)]--; });
      for (var x = 0, run = 0; x < Wn; x++) { run += d[x]; cov[x] = run; }
      var tol = Math.max(2, Math.round(body.length * 0.03)), best = null, start = -1, lo = Math.floor(W * 0.3), hi = Math.ceil(W * 0.7);
      for (x = lo; x <= hi + 1; x++) {
        var free = x <= hi && cov[x] <= tol;
        if (free && start < 0) start = x;
        if (!free && start >= 0) { if (!best || x - 1 - start > best.e - best.s) best = { s: start, e: x - 1 }; start = -1; }
      }
      if (best && best.e - best.s >= W * 0.012) {
        var g = (best.s + best.e) / 2; lay.bw = best.e - best.s;
        var Lb = body.filter(function (i) { return (i.x0 + i.x1) / 2 < g; }), Rb = body.filter(function (i) { return (i.x0 + i.x1) / 2 >= g; });
        var Lr = clusterRows(Lb), Rr = clusterRows(Rb), ys = function (a) { var mn = 1e9, mx = -1; a.forEach(function (i) { mn = Math.min(mn, i.y0); mx = Math.max(mx, i.y1); }); return mx - mn; };
        var Ll = Lr.map(rowText).map(function (t) { return t.length; }), Rl = Rr.map(rowText).map(function (t) { return t.length; });
        var aligned = function (rows) { // baris kolom sungguhan berawal di x yang sama (rata kiri)
          var xs = rows.map(function (r) { return Math.min.apply(0, r.it.map(function (i) { return i.x0; })); }), md = median(xs);
          return xs.filter(function (v) { return Math.abs(v - md) <= W * 0.02; }).length / xs.length;
        };
        var qc = function (rows) { return rows.filter(function (r) { return qStart(rowText(r)); }).length; };
        var longRows = median(Ll) >= 14 && median(Rl) >= 14, bothQ = qc(Lr) >= 1 && qc(Rr) >= 1;   // kolom kanan juga punya nomor soal ⇒ kolom sungguhan, bukan grid pilihan
        if (Lr.length >= 4 && Rr.length >= 4 && (longRows || bothQ) && ys(Lb) >= H * 0.12 && ys(Rb) >= H * 0.12 && aligned(Rr) >= 0.6 && aligned(Lr) >= 0.5) lay.g = g;
      }
    }
    if (lay.g !== null) {
      var g2 = lay.g, seps = [], bw = Math.max(W * 0.012, lay.bw || 0);
      clusterRows(items).forEach(function (row) {
        var Lx = -1e9, Rx = 1e9, nL = 0, nR = 0, cross = [];
        row.it.forEach(function (i) {
          var c = (i.x0 + i.x1) / 2; if (c < g2) { Lx = Math.max(Lx, i.x1); nL++; } else { Rx = Math.min(Rx, i.x0); nR++; }
          if (i.x0 < g2 - 0.25 * bw && i.x1 > g2 + 0.25 * bw) cross.push(i);
        });
        var bridge = nL && nR && Rx - Lx < 0.5 * bw;   // baris tersambung melewati selokan (judul/keterangan selebar halaman)
        if (bridge) row.it.forEach(function (i) { i._span = true; });
        else cross.forEach(function (i) { i._span = true; });
        if (bridge || cross.length) { var y0 = 1e9, y1 = -1; row.it.forEach(function (i) { if (i._span) { y0 = Math.min(y0, i.y0); y1 = Math.max(y1, i.y1); } }); seps.push({ y0: y0, y1: y1 }); }
      });
      (wide || []).forEach(function (r) { seps.push({ y0: r.y0, y1: r.y1 }); });
      seps.sort(function (a, b) { return a.y0 - b.y0; });
      var m = []; seps.forEach(function (s) { var l = m[m.length - 1]; if (l && s.y0 <= l.y1 + 1) l.y1 = Math.max(l.y1, s.y1); else m.push({ y0: s.y0, y1: s.y1 }); });
      lay.seps = m;
    }
    // nomor blok urutan baca: band b → kiri 3b, kanan 3b+1, pemisah 3b+2
    lay.blk = function (cx, cy, spanning) {
      if (lay.g === null) return 0;
      var si = -1, above = 0;
      for (var k = 0; k < lay.seps.length; k++) { var s = lay.seps[k]; if (cy >= s.y0 - 1 && cy <= s.y1 + 1) { si = k; break; } if (s.y1 < cy) above++; }
      if (si >= 0 && spanning) return si * 3 + 2;
      return above * 3 + (cx < lay.g ? 0 : 1);
    };
    return lay;
  }
  // item → baris, dengan urutan baca sesuai layout; baris bergaya "A. x     C. y" (grid) dipecah per sel
  function buildLines(items, lay, ocr) {
    var byBlk = {};
    items.forEach(function (i) {
      var span = lay.g !== null && !!i._span;
      var b = lay.blk((i.x0 + i.x1) / 2, (i.y0 + i.y1) / 2, span); i.blk = b; (byBlk[b] = byBlk[b] || []).push(i);
    });
    var out = [];
    Object.keys(byBlk).map(Number).sort(function (a, b) { return a - b; }).forEach(function (b) {
      clusterRows(byBlk[b]).forEach(function (row) {
        var its = row.it.slice().sort(function (a, c) { return a.x0 - c.x0; }), h = row.h, segs = [], cur = null, prev = null;
        its.forEach(function (i) {
          var gap = prev ? i.x0 - prev.x1 : 0;
          if (!cur || gap > 2.6 * h) { cur = { it: [], x0: 1e9, y0: 1e9, x1: -1, y1: -1, t: "" }; segs.push(cur); }
          if (cur.it.length && gap > 0.18 * (i.y1 - i.y0) && !/\s$/.test(cur.t) && !/^\s/.test(i.s)) cur.t += " ";
          cur.t += i.s; cur.it.push(i); prev = i;
          cur.x0 = Math.min(cur.x0, i.x0); cur.y0 = Math.min(cur.y0, i.y0); cur.x1 = Math.max(cur.x1, i.x1); cur.y1 = Math.max(cur.y1, i.y1);
        });
        segs.forEach(function (s) { s.t = s.t.replace(/\s+/g, " ").trim(); });
        segs = segs.filter(function (s) { return s.t; }); if (!segs.length) return;
        var optSegs = segs.filter(function (s) { return optStart(s.t, ocr, ""); });
        if (segs.length >= 2 && optSegs.length >= 2 && optSegs.length === segs.length) { // grid pilihan → satu "baris" per sel
          segs.forEach(function (s) { out.push({ t: s.t, x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, blk: b, grid: true }); });
        } else {
          var tt = segs.map(function (s) { return s.t; }).join(" "), x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
          segs.forEach(function (s) { x0 = Math.min(x0, s.x0); y0 = Math.min(y0, s.y0); x1 = Math.max(x1, s.x1); y1 = Math.max(y1, s.y1); });
          out.push({ t: tt, x0: x0, y0: y0, x1: x1, y1: y1, blk: b });
        }
      });
    });
    return out;
  }

  /* ---------- OCR (halaman scan): per KATA, lalu disusun oleh penata layout yang sama ---------- */
  var ocrW = null;
  async function ocrStart(opt, P) {
    if (ocrW) return ocrW;
    await loadScript((opt && opt.tesseractSrc) || CDN + "tesseract.js/4.1.1/tesseract.min.js");
    var o = { logger: function (m) { if (m && m.status && P) P({ ocr: m.status, p: m.progress || 0 }); } };
    ["workerPath", "corePath", "langPath"].forEach(function (k) { if (opt && opt[k]) o[k] = opt[k]; });
    var lang = (opt && opt.lang) || "ind+eng", w = await Tesseract.createWorker(o);
    await w.loadLanguage(lang); await w.initialize(lang);
    return (ocrW = w);
  }
  async function ocrStop() { if (ocrW) { try { await ocrW.terminate(); } catch (e) {} ocrW = null; } }
  // salinan untuk OCR: latar terang berwarna (highlight) diputihkan & noise dibersihkan; kanvas asli tetap dipakai untuk deteksi highlight
  function ocrPrep(src) {
    var cv = newCanvas(src.width, src.height), x = cv.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0);
    var im = x.getImageData(0, 0, cv.width, cv.height), d = im.data;
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), lum = 0.299 * r + 0.587 * g + 0.114 * b;
      var v = (lum > 110 && mx - mn > 40) || lum > 195 ? 255 : lum; d[i] = d[i + 1] = d[i + 2] = v;
    }
    x.putImageData(im, 0, 0); return cv;
  }
  async function ocrWords(canvas, opt, P) {
    var w = await ocrStart(opt, P), r = await w.recognize(ocrPrep(canvas)), d = r.data, words = d.words;
    if (!words || !words.length) { words = []; (d.lines || []).forEach(function (l) { (l.words || []).forEach(function (x) { words.push(x); }); }); }
    return words.filter(function (x) { return x.text && x.text.trim() && (x.confidence == null || x.confidence >= 25); }).map(function (x) {
      return { s: x.text.trim(), x0: x.bbox.x0, y0: x.bbox.y0, x1: x.bbox.x1, y1: x.bbox.y1, conf: x.confidence, ocr: true };
    });
  }

  /* ---------- parser struktur soal ---------- */
  function newQ(n, t, line, i) { return { num: n, q: t, o: {}, ol: {}, ql: line ? [line] : [], cnt: 0, last: "", inExp: false, expl: "", ex: {}, exL: "", textKey: "", i0: i, i1: i }; }
  // pembahasan per pilihan: baris "A. …" / "A) …" di dalam blok pembahasan
  var reOptExp = /^\s*\(?([A-Ea-e])\)?\s*[.):\-–]\s+(\S.*)$/;
  function nextMissing(o) { for (var k = 0; k < 5; k++) if (!(LET[k] in o)) return LET[k]; return ""; }
  function lookA(L, i) { for (var k = i + 1; k < Math.min(L.length, i + 13); k++) { var m = optStart(L[k].t, !!L[k].ocr, "A"); if (m && m.L === "A") return true; } return false; }
  function looksKeyTable(L, i) { return i < L.length && /^\s*\d{1,4}\s*[.):\-–=]?\s*\(?[A-Ea-e]\)?(?![A-Za-z0-9])/.test(L[i].t); }
  function pairsOf(t) { // "1. C 2. E 3. B" / "5-A 6-B" → [[1,"C"],…] bila baris hampir seluruhnya pasangan nomor–kunci
    var m, ps = []; rePair.lastIndex = 0;
    while ((m = rePair.exec(t))) ps.push([+m[1], m[2].toUpperCase()]);
    if (!ps.length) return null;
    var left = t.replace(rePair, "").replace(/[\s,;|.\-–:]+/g, "");
    return left.length <= Math.floor(t.length * 0.1) ? ps : null;
  }
  function splitInline(rest, L) { // "x B. y C. z" → bagian-bagian; hanya bila ≥2 penanda berurutan (aman dari "Vitamin B. Kekurangan…")
    var i = LET.indexOf(L), pos = [], from = 0;
    for (var k = i + 1; k < 5; k++) {
      var re = new RegExp("\\s" + LET[k] + "[.)]\\s+(?=\\S)", "g"); re.lastIndex = from; var m = re.exec(rest); if (!m) break;
      pos.push({ L: LET[k], s: m.index, e: m.index + m[0].length }); from = m.index + m[0].length;
    }
    if (pos.length < 2) return null;
    var parts = [{ L: L, t: rest.slice(0, pos[0].s).trim() }];
    pos.forEach(function (p, j) { parts.push({ L: p.L, t: rest.slice(p.e, j + 1 < pos.length ? pos[j + 1].s : rest.length).trim() }); });
    return parts;
  }

  function parse(L) {
    var Q = [], owner = new Array(L.length), cur = null, last = 0, mode = "front", bq = null, bn = {}, kt = {}, qnums = {};
    function own(q, i) { owner[i] = q; if (i > q.i1) q.i1 = i; }
    function push(q, i) { Q.push(q); cur = q; last = q.num; qnums[q.num] = 1; own(q, i); }
    function cat(a, b) { return a + (a ? " " : "") + b; }
    for (var i = 0; i < L.length; i++) {
      var ln = L[i], t = ln.t, m, ocr = !!ln.ocr;
      if (mode === "front") {
        // kepala bagian kunci/pembahasan di AKHIR dokumen selalu pindah mode;
        // kepala "PEMBAHASAN:" yang menyusul KUNCI: tetap milik soal berjalan (pembahasan per soal)
        var hardHead = /^\s*(kunci\s*jawaban|kunci\s*(?:dan|&)\s*pembahasan|jawaban\s*(?:dan|&)\s*pembahasan|answer\s*key|daftar\s*jawaban)(\s+soal)?\s*:?\s*$/i.test(t);
        if (cur && Q.length && (hardHead || ((reHead.test(t) || (reHeadBare.test(t) && looksKeyTable(L, i + 1))) && !cur.inExp)) && (cur.cnt >= 2 || cur.inExp)) { mode = "back"; bq = null; continue; }
        if ((m = reKey.exec(t) || reKey2.exec(t)) && cur && cur.cnt >= 2) { cur.textKey = m[1].toUpperCase(); cur.inExp = true; if (m[2]) cur.expl = cat(cur.expl, m[2]); own(cur, i); continue; }
        if ((m = reExp.exec(t)) && cur && cur.cnt >= 1) { cur.inExp = true; if (m[2]) cur.expl = cat(cur.expl, m[2]); own(cur, i); continue; }
        var qs = qStart(t);
        if (qs) {
          var n = qs.n, ok = !cur || (cur.cnt >= 2 && !cur.inExp && n > last) || (cur.cnt >= 1 && !cur.inExp && n === last + 1) ||
            (cur.inExp && n > last && n - last <= 3 && lookA(L, i)) || (cur.cnt >= 2 && n === 1 && last > 1 && lookA(L, i)); // nomor 1 lagi = bagian/bab baru
          if (ok) { push(newQ(n, qs.rest, qs.rest ? ln : null, i), i); continue; }
        }
        if (cur && !cur.inExp) {
          var ex = nextMissing(cur.o), om = optStart(t, ocr, ex);
          if (om && !(om.L in cur.o) && (om.L === ex || ln.grid)) {
            var sp = om.rest ? splitInline(om.rest, om.L) : null;
            if (sp) sp.forEach(function (p) { cur.o[p.L] = p.t; cur.ol[p.L] = [ln]; cur.last = p.L; cur.cnt++; });
            else { cur.o[om.L] = om.rest; cur.ol[om.L] = [ln]; cur.last = om.L; cur.cnt++; }
            own(cur, i); continue;
          }
        }
        if (!cur) continue; // teks sebelum soal pertama (judul/petunjuk)
        own(cur, i);
        if (cur.inExp) { // pembahasan per pilihan (A–E) dipisah dari pembahasan umum
          var xm = reOptExp.exec(t);
          if (xm) { cur.exL = xm[1].toUpperCase(); cur.ex[cur.exL] = cat(cur.ex[cur.exL] || "", xm[2]); }
          else if (cur.exL) cur.ex[cur.exL] = cat(cur.ex[cur.exL] || "", t);
          else cur.expl = cat(cur.expl, t);
        }
        else if (cur.last) { cur.o[cur.last] = cat(cur.o[cur.last], t); cur.ol[cur.last].push(ln); }
        else { cur.q = cat(cur.q, t); cur.ql.push(ln); }
      } else { // bagian kunci/pembahasan di akhir dokumen
        if (reHead.test(t) || reHeadBare.test(t)) { bq = null; continue; }
        var pr = pairsOf(t);
        if (pr) { pr.forEach(function (p) { if (!(p[0] in kt)) kt[p[0]] = p[1]; }); bq = null; continue; }
        var e = /^\s*(\d{1,4})\s*[.)\-:]?\s+(\S.*)$/.exec(t) || /^\s*(\d{1,4})\s*[.)\-:]\s*(.*)$/.exec(t);
        if (e && (!bq || +e[1] === bq.n + 1 || (+e[1] > bq.n && (+e[1] - bq.n <= 5 || qnums[+e[1]])))) {
          var rest = e[2] || "", key = "", mk = /^\(?([A-Ea-e])\)?(?![A-Za-z])\s*[.):\-]?\s*(.*)$/.exec(rest) || reKey.exec(rest) || reKey2.exec(rest);
          if (mk) { key = mk[1].toUpperCase(); rest = mk[2] || ""; }
          rest = rest.replace(/^\s*(pembahasan|penjelasan)\s*[:\-–]?\s*/i, "");
          bq = { n: +e[1], key: key, expl: rest }; (bn[bq.n] = bn[bq.n] || []).push(bq);
        } else if (bq) bq.expl = cat(bq.expl, t);
      }
    }
    Q.forEach(function (q) { // gabungkan bagian belakang
      var es = bn[q.num], e = es && es.shift();
      if (e) { if (e.key && !q.textKey) q.textKey = e.key; if (e.expl && !q.expl) q.expl = e.expl; }
      if (!q.textKey && kt[q.num]) q.textKey = kt[q.num];
    });
    Q.owner = owner;
    return Q;
  }

  /* ---------- keputusan kunci & status ---------- */
  function decide(q) {
    var sc = function (f) { return LET.map(function (L) { var a = q.ol[L]; return a ? Math.max.apply(0, a.map(function (l) { return l[f] || 0; })) : 0; }); };
    function top(arr) { var b = -1, bi = -1, s = -1; arr.forEach(function (v, i) { if (v > b) { s = b; b = v; bi = i; } else if (v > s) s = v; }); return { i: bi, v: b, s: s < 0 ? 0 : s }; }
    var an = top(sc("ann")), bg = top(sc("bg")), ik = top(sc("ink")), notes = [], key = null, via = "";
    var byAnn = an.v >= 0.25 && an.v - an.s >= 0.2 ? LET[an.i] : "";
    var byBg = bg.v >= 0.3 && bg.v - bg.s >= 0.15 ? LET[bg.i] : "";
    var byInk = ik.v >= 0.06 && ik.s < 0.03 ? LET[ik.i] : "";
    if (byAnn) { key = byAnn; via = "highlight"; }
    else if (byBg) { key = byBg; via = "visual"; }
    else if (byInk) { key = byInk; via = "warna-teks"; notes.push("Kunci dari warna teks, mohon periksa."); }
    else if (q.textKey) { key = q.textKey; via = "teks"; notes.push("Kunci dari tulisan “Jawaban: …” / tabel kunci, bukan highlight."); }
    var conflict = [byAnn, byBg, q.textKey].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (conflict.length > 1) notes.push("Penanda kunci saling berbeda (" + conflict.join("/") + ") — periksa.");
    if (key && !q.o[key]) { notes.push("Kunci menunjuk pilihan kosong."); key = null; via = ""; }
    var n = LET.filter(function (L) { return q.o[L]; }).length, st = "ok";
    if (!key) { st = "bad"; notes.push("KUNCI TIDAK TERDETEKSI"); }
    else if (via !== "highlight" && via !== "visual") st = "warn";
    if (n < 2) { st = "bad"; notes.push("Pilihan jawaban tidak terbaca."); }
    else if (n < 5) { if (st === "ok") st = "warn"; notes.push("Hanya " + n + " pilihan terbaca (seharusnya 5)."); }
    if (conflict.length > 1 && st === "ok") st = "warn";
    if ((q.q || "").length < 8) { if (st === "ok") st = "warn"; notes.push("Pertanyaan sangat pendek."); }
    return { ans: key, via: via, status: st, notes: notes };
  }

  /* ---------- pemeriksaan mutu (dipakai saat impor DAN saat admin menyunting di preview) ---------- */
  var SEV = { ok: 0, warn: 1, bad: 2 };
  var worst = function (a, b) { return SEV[a] >= SEV[b] ? a : b; };
  var hasImg = function (it) { return !!((it.imgs && it.imgs.length) || it.img); };
  function quality(it) {
    var notes = [], st = "ok", seen = {}, dup = false;
    LET.forEach(function (L) { var v = String(it[L.toLowerCase()] || "").toLowerCase().replace(/\s+/g, " ").trim(); if (!v) return; if (seen[v]) dup = true; seen[v] = 1; });
    if (dup) { notes.push("Dua pilihan memiliki teks yang sama."); st = "warn"; }
    LET.forEach(function (L, i) {
      var v = String(it[L.toLowerCase()] || ""); if (v.length > 400) { notes.push("Pilihan " + L + " sangat panjang — mungkin teks lain ikut terbaca."); st = "warn"; }
      var N = LET[i + 1]; if (N && !String(it[N.toLowerCase()] || "").trim() && new RegExp("\\s" + N + "[.)]\\s+\\S").test(v)) { notes.push("Pilihan " + N + " tampaknya menyatu dengan pilihan " + L + "."); st = "warn"; }
    });
    if (!hasImg(it) && reFigStrong.test(it.q || "")) { notes.push("Soal merujuk gambar/tabel, tetapi belum ada gambar terpasang."); st = "warn"; }
    (it.imgs || []).forEach(function (g) { if (g && g.conf === "low") { notes.push("Gambar hal. " + g.page + " dikaitkan berdasarkan jarak — pastikan sesuai soal."); st = "warn"; } });
    return { status: st, notes: notes.filter(function (x, i, a) { return a.indexOf(x) === i; }) };
  }
  // validasi ulang satu soal hasil impor (mis. setelah disunting admin)
  function validate(it) {
    var notes = [], st = "ok", n = LET.filter(function (L) { return String(it[L.toLowerCase()] || "").trim(); }).length;
    var key = it.ans && String(it[it.ans.toLowerCase()] || "").trim() ? it.ans : null;
    if (!key) { st = "bad"; notes.push(it.ans ? "Kunci menunjuk pilihan kosong." : "KUNCI TIDAK TERDETEKSI"); }
    else if (["highlight", "visual", "berkas", "admin"].indexOf(it.via) < 0) { st = "warn"; notes.push("Kunci berasal dari " + (it.via || "teks") + " — periksa."); }
    if (n < 2) { st = "bad"; notes.push("Pilihan jawaban tidak terbaca."); } else if (n < 5) { st = worst(st, "warn"); notes.push("Hanya " + n + " pilihan terisi."); }
    if (String(it.q || "").trim().length < 8) { st = worst(st, "warn"); notes.push("Pertanyaan sangat pendek."); }
    var q = quality(it); return { status: worst(st, q.status), notes: notes.concat(q.notes) };
  }

  /* ======================= GAMBAR ======================= */
  var MAXSIDE = 1100, B64MAX = 640000;
  function newCanvas(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  // kanvas → data-URL (PNG untuk grafik datar, JPEG untuk foto/histologi) dengan batas ukuran agar muat di D1
  function encodeCanvas(cv) {
    var w = cv.width, h = cv.height, k = Math.min(1, MAXSIDE / Math.max(w, h)), q = 0.88, png = false, out, url = "", it;
    function draw() { out = newCanvas(w * k, h * k); var x = out.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, out.width, out.height); x.imageSmoothingQuality = "high"; x.drawImage(cv, 0, 0, out.width, out.height); }
    draw();
    var d = out.getContext("2d").getImageData(0, 0, out.width, out.height).data, seen = {}, n = 0, step = Math.max(1, Math.floor(d.length / 4 / 4000)) * 4;
    for (var i = 0; i < d.length; i += step) { var key = (d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4); if (!seen[key]) { seen[key] = 1; n++; } }
    png = n < 40;
    for (it = 0; it < 12; it++) {
      url = png ? out.toDataURL("image/png") : out.toDataURL("image/jpeg", q);
      if (url.length - url.indexOf(",") - 1 <= B64MAX) break;
      if (png) png = false; else if (q > 0.62) q -= 0.08; else { k *= 0.85; q = 0.85; draw(); }
    }
    return { data: url, w: out.width, h: out.height };
  }
  function aHash(cv) { // sidik jari kasar gambar (untuk membuang logo/watermark yang berulang)
    var s = newCanvas(8, 8), x = s.getContext("2d"); x.drawImage(cv, 0, 0, 8, 8);
    var d = x.getImageData(0, 0, 8, 8).data, g = [], m = 0, i;
    for (i = 0; i < 256; i += 4) { var v = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; g.push(v); m += v; }
    m /= 64; return g.map(function (v) { return v > m ? 1 : 0; }).join("") + ":" + Math.round(cv.width / 20) + "x" + Math.round(cv.height / 20);
  }
  function diffCanvas(a, b) { // selisih rata-rata (0–255) dua kanvas pada 24×24
    var s = 24, ca = newCanvas(s, s), cb = newCanvas(s, s), xa = ca.getContext("2d"), xb = cb.getContext("2d");
    [[xa, a], [xb, b]].forEach(function (p) { p[0].fillStyle = "#fff"; p[0].fillRect(0, 0, s, s); p[0].drawImage(p[1], 0, 0, s, s); });
    var da = xa.getImageData(0, 0, s, s).data, db = xb.getImageData(0, 0, s, s).data, t = 0, n = 0;
    for (var i = 0; i < da.length; i += 4) { t += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); n += 3; }
    return t / n;
  }
  function compose(A, B) { return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]]; }

  // (a) gambar embedded: lintasi operator halaman sambil melacak matriks (CTM) → kotak tiap gambar di piksel kanvas
  async function embeddedBoxes(page, vp, lib) {
    var ol = await page.getOperatorList(), OPS = lib.OPS, fn = ol.fnArray, ar = ol.argsArray, ctm = [1, 0, 0, 1, 0, 0], st = [], out = [];
    for (var k = 0; k < fn.length; k++) {
      var f = fn[k], a = ar[k];
      if (f === OPS.save) st.push(ctm.slice());
      else if (f === OPS.restore) { if (st.length) ctm = st.pop(); }
      else if (f === OPS.transform) ctm = compose(ctm, a);
      else if (f === OPS.paintFormXObjectBegin) { st.push(ctm.slice()); if (a && a[0]) ctm = compose(ctm, a[0]); }
      else if (f === OPS.paintFormXObjectEnd) { if (st.length) ctm = st.pop(); }
      else if (f === OPS.paintImageXObject || (OPS.paintJpegXObject && f === OPS.paintJpegXObject) || f === OPS.paintInlineImageXObject) {
        var inl = f === OPS.paintInlineImageXObject, pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(function (u) { return vp.convertToViewportPoint(ctm[0] * u[0] + ctm[2] * u[1] + ctm[4], ctm[1] * u[0] + ctm[3] * u[1] + ctm[5]); });
        var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
        var eps = 1e-3 * (Math.abs(ctm[0]) + Math.abs(ctm[3]) + 1e-9);
        out.push({ x0: Math.min.apply(0, xs), x1: Math.max.apply(0, xs), y0: Math.min.apply(0, ys), y1: Math.max.apply(0, ys), id: inl ? null : a[0], data: inl ? a[0] : null, inline: inl,
          axis: Math.abs(ctm[1]) < eps && Math.abs(ctm[2]) < eps && ctm[0] > 0 && ctm[3] > 0 && !vp.rotation });
      }
    }
    return out;
  }
  // piksel asli gambar embedded → kanvas (atau null bila bentuk datanya tidak dikenali)
  function nativeCanvas(page, box) {
    var obj = null;
    try { obj = box.inline ? box.data : (/^g_/.test(box.id) ? page.commonObjs.get(box.id) : page.objs.get(box.id)); } catch (e) { return null; }
    if (!obj) return null;
    try {
      var cv, x;
      if (obj.bitmap) { cv = newCanvas(obj.bitmap.width, obj.bitmap.height); x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(obj.bitmap, 0, 0); return cv; }
      var w = obj.width, h = obj.height, d = obj.data; if (!w || !h || !d) return null;
      var rgba = new Uint8ClampedArray(w * h * 4), i, j;
      if (obj.kind === 3 || d.length === w * h * 4) { for (i = 0; i < rgba.length; i += 4) { var al = d[i + 3] / 255; rgba[i] = d[i] * al + 255 * (1 - al); rgba[i + 1] = d[i + 1] * al + 255 * (1 - al); rgba[i + 2] = d[i + 2] * al + 255 * (1 - al); rgba[i + 3] = 255; } }
      else if (obj.kind === 2 || d.length === w * h * 3) { for (i = 0, j = 0; i < w * h * 3; i += 3, j += 4) { rgba[j] = d[i]; rgba[j + 1] = d[i + 1]; rgba[j + 2] = d[i + 2]; rgba[j + 3] = 255; } }
      else if (obj.kind === 1) { var rb = (w + 7) >> 3; for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) { var bit = (d[yy * rb + (xx >> 3)] >> (7 - (xx & 7))) & 1, o = (yy * w + xx) * 4; rgba[o] = rgba[o + 1] = rgba[o + 2] = bit ? 255 : 0; rgba[o + 3] = 255; } }
      else return null;
      cv = newCanvas(w, h); cv.getContext("2d").putImageData(new ImageData(rgba, w, h), 0, 0); return cv;
    } catch (e) { return null; }
  }
  // (b) fallback: potong wilayah dari halaman (dirender ulang lebih tajam hanya untuk wilayah tsb)
  async function renderRegion(page, S, r, long, noUp) {
    var w = r.x1 - r.x0, h = r.y1 - r.y0, f = noUp ? 1 : Math.min(4.5 / S, Math.max(1, long / Math.max(w, h))), T = S * f, vp = page.getViewport({ scale: T });
    var cv = newCanvas(w * f, h * f), x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: x, viewport: vp, transform: [1, 0, 0, 1, -r.x0 * f, -r.y0 * f] }).promise;
    return cv;
  }
  function cropCanvas(src, r) { var cv = newCanvas(r.x1 - r.x0, r.y1 - r.y0); cv.getContext("2d").drawImage(src, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 0, 0, cv.width, cv.height); return cv; }

  // deteksi gambar/diagram/grafik/tabel pada piksel (halaman teks, vektor, maupun scan)
  function detectBlobs(ctx, W, H, S, items, medH) {
    var c = Math.max(5, Math.round(S * 3)), gw = Math.ceil(W / c), gh = Math.ceil(H / c), N = gw * gh, data = ctx.getImageData(0, 0, W, H).data, i, x, y;
    var rs = [], gs = [], bs = [];
    for (i = 0; i < data.length; i += 4 * 97) { rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]); }
    var br = median(rs), bg = median(gs), bb = median(bs), ink = new Uint16Array(N), tone = new Uint16Array(N), pix = new Uint16Array(N);
    for (y = 0; y < H; y++) {
      var row = ((y / c) | 0) * gw;
      for (x = 0; x < W; x++) {
        var p = (y * W + x) * 4, r = data[p], g = data[p + 1], b = data[p + 2], ci = row + ((x / c) | 0); pix[ci]++;
        if (Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb)) > 30) { ink[ci]++; if (0.299 * r + 0.587 * g + 0.114 * b > 40) tone[ci]++; }
      }
    }
    var txt = new Uint8Array(N);
    items.forEach(function (it) {
      var h = it.y1 - it.y0, px = Math.max(2, h * 0.25), py = Math.max(1, h * 0.12);
      var a0 = Math.max(0, Math.floor((it.x0 - px) / c)), a1 = Math.min(gw - 1, Math.floor((it.x1 + px) / c)), b0 = Math.max(0, Math.floor((it.y0 - py) / c)), b1 = Math.min(gh - 1, Math.floor((it.y1 + py) / c));
      for (var yy = b0; yy <= b1; yy++) for (var xx = a0; xx <= a1; xx++) txt[yy * gw + xx] = 1;
    });
    var fig = new Uint8Array(N);
    for (i = 0; i < N; i++) { var cp = pix[i] || 1; fig[i] = tone[i] / cp >= 0.45 ? 2 : (!txt[i] && ink[i] / cp >= 0.05) ? 1 : 0; }
    var lab = new Int32Array(N).fill(-1), comps = [], R = 2;
    for (i = 0; i < N; i++) {
      if (!fig[i] || lab[i] >= 0) continue;
      var id = comps.length, cp2 = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, n: 0, ph: 0, tx: 0, cells: [] }, stack = [i]; lab[i] = id;
      while (stack.length) {
        var u = stack.pop(), ux = u % gw, uy = (u / gw) | 0;
        cp2.n++; cp2.cells.push(u); if (fig[u] === 2) cp2.ph++; if (txt[u]) cp2.tx++;
        cp2.x0 = Math.min(cp2.x0, ux); cp2.x1 = Math.max(cp2.x1, ux); cp2.y0 = Math.min(cp2.y0, uy); cp2.y1 = Math.max(cp2.y1, uy);
        for (var dy = -R; dy <= R; dy++) for (var dx = -R; dx <= R; dx++) {
          var vx = ux + dx, vy = uy + dy; if (vx < 0 || vy < 0 || vx >= gw || vy >= gh) continue;
          var v = vy * gw + vx; if (fig[v] && lab[v] < 0) { lab[v] = id; stack.push(v); }
        }
      }
      comps.push(cp2);
    }
    var res = [];
    comps.forEach(function (k) {
      // pangkas baris/kolom tepi yang jarang (mis. baris teks di atas gambar yang ikut tersambung)
      var photo0 = k.ph / k.n >= 0.5, rc = {}, cc = {};
      k.cells.forEach(function (u) { if (photo0 && fig[u] !== 2) return; var ux = u % gw, uy = (u / gw) | 0; rc[uy] = (rc[uy] || 0) + 1; cc[ux] = (cc[ux] || 0) + 1; });
      var wc = k.x1 - k.x0 + 1, hc = k.y1 - k.y0 + 1, tr = photo0 ? 0.25 : 0.08, rmin = Math.max(2, tr * wc), cmin = Math.max(2, tr * hc);
      while (k.y0 < k.y1 && (rc[k.y0] || 0) < rmin) k.y0++; while (k.y1 > k.y0 && (rc[k.y1] || 0) < rmin) k.y1--;
      while (k.x0 < k.x1 && (cc[k.x0] || 0) < cmin) k.x0++; while (k.x1 > k.x0 && (cc[k.x1] || 0) < cmin) k.x1--;
      var rect = { x0: k.x0 * c, y0: k.y0 * c, x1: Math.min(W, (k.x1 + 1) * c), y1: Math.min(H, (k.y1 + 1) * c) }, bw = rect.x1 - rect.x0, bh = rect.y1 - rect.y0;
      if (bw < 30 * S || bh < 24 * S) return;
      if (Math.max(bw / bh, bh / bw) > 14) return;                          // garis/aturan
      if (bw * bh >= 0.85 * W * H) return;                                   // latar seluruh halaman
      if (bh <= 5 * medH && k.tx / k.n >= 0.55) return;                      // highlight (1–3 baris) di belakang teks
      if (k.n / ((k.x1 - k.x0 + 1) * (k.y1 - k.y0 + 1)) < 0.03) return;      // terlalu jarang
      var inside = items.filter(function (it) { return interArea(it, rect) >= 0.85 * area(it); }), chars = 0, st = 0;
      inside.forEach(function (it) { chars += it.s.length; if (structLine(it.s)) st++; });
      if (st >= 2 || (chars > 160 && k.ph / k.n < 0.3)) return;              // bingkai berisi soal/teks, bukan gambar
      rect.photo = k.ph / k.n >= 0.5; res.push(rect);
    });
    return res;
  }
  // kotak yang bersentuhan digabung (gambar yang dipotong-potong menjadi strip)
  function mergeTouching(boxes, gap) {
    var gs = boxes.map(function (b) { return { r: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }, m: [b] }; }), ch = true;
    while (ch) {
      ch = false;
      for (var i = 0; i < gs.length && !ch; i++) for (var j = i + 1; j < gs.length && !ch; j++) {
        var a = gs[i].r, b = gs[j].r;
        if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) { gs[i] = { r: unionR(a, b), m: gs[i].m.concat(gs[j].m) }; gs.splice(j, 1); ch = true; }
      }
    }
    return gs;
  }

  // satu halaman → daftar gambar (kotak + jenis); item teks di dalam gambar vektor/scan dibuang dari bahan parser
  async function pageFigures(page, vp, lib, canvas, ctx, items, S, ocr) {
    var W = canvas.width, H = canvas.height, heights = items.map(function (i) { return i.y1 - i.y0; }), medH = median(heights) || 12 * S, out = [];
    var emb = [];
    if (!ocr) { try { emb = await embeddedBoxes(page, vp, lib); } catch (e) { emb = []; } }
    emb = emb.filter(function (b) { var w = b.x1 - b.x0, h = b.y1 - b.y0; return w >= 28 * S && h >= 22 * S && w * h < 0.85 * W * H; });
    mergeTouching(emb, 1.5).forEach(function (g) {
      var single = g.m.length === 1; out.push({ x0: g.r.x0, y0: g.r.y0, x1: g.r.x1, y1: g.r.y1, kind: "embedded", box: single ? g.m[0] : null, photo: true });
    });
    detectBlobs(ctx, W, H, S, items, medH).forEach(function (b) {
      var covered = out.some(function (o) { return o.kind === "embedded" && interArea(o, b) >= 0.5 * Math.min(area(o), area(b)); });
      if (!covered) out.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, kind: ocr ? "scan" : "vector", photo: b.photo });
    });
    out = out.filter(function (f) { // logo/ornamen kecil di margin atas/bawah
      var cy = (f.y0 + f.y1) / 2, small = (f.x1 - f.x0) < 0.25 * W;
      return !(small && (cy < 0.075 * H || cy > 0.925 * H));
    });
    return { figs: out, medH: medH };
  }

  // gambar → kanvas hasil akhir (embedded bila valid, jika tidak potong dari halaman)
  async function figureCanvas(page, S, canvas, f, ocr) {
    var pad = 4 * S, W = canvas.width, H = canvas.height;
    var r = { x0: Math.max(0, Math.floor(f.x0 - (f.kind === "embedded" ? 0 : pad))), y0: Math.max(0, Math.floor(f.y0 - (f.kind === "embedded" ? 0 : pad))), x1: Math.min(W, Math.ceil(f.x1 + (f.kind === "embedded" ? 0 : pad))), y1: Math.min(H, Math.ceil(f.y1 + (f.kind === "embedded" ? 0 : pad))) };
    var base = cropCanvas(canvas, r);
    if (f.kind === "embedded" && f.box && f.box.axis) {
      var nv = nativeCanvas(page, f.box);
      if (nv && nv.width >= 24 && nv.height >= 20 && diffCanvas(nv, base) < 40) return { cv: nv, via: "embedded" };
    }
    if (ocr) return { cv: base, via: "crop" };
    try { var hi = await renderRegion(page, S, r, MAXSIDE); return { cv: hi, via: "crop" }; } catch (e) { return { cv: base, via: "crop" }; }
  }

  /* ---------- kaitkan gambar ke soal ---------- */
  function figKey(a, b) { return a.p !== b.p ? a.p - b.p : a.blk !== b.blk ? a.blk - b.blk : a.cy - b.cy; }
  function cueScore(q) { return !q ? 0 : reFigStrong.test(q.q) ? 2 : reFigCue.test(q.q) ? 1 : 0; }
  function assignFigs(Q, L, figs, S) {
    var owner = Q.owner, un = [], far = 90 * S;
    figs.sort(figKey);
    figs.forEach(function (f) {
      var j = 0; while (j < L.length && figKey({ p: L[j].p, blk: L[j].blk, cy: (L[j].y0 + L[j].y1) / 2 }, f) <= 0) j++;
      var pv = j - 1, nx = j, qP = pv >= 0 ? owner[pv] : null, qN = nx < L.length ? owner[nx] : null, q = null, conf = "ok";
      if (qP && qP === qN) q = qP;
      else if (qP || qN) {
        var dP = qP && L[pv].p === f.p && L[pv].blk === f.blk ? f.y0 - L[pv].y1 : 1e9, dN = qN && L[nx].p === f.p && L[nx].blk === f.blk ? L[nx].y0 - f.y1 : 1e9;
        var sP = cueScore(qP) - ((qP && qP.imgs && qP.imgs.length) ? 1 : 0), sN = cueScore(qN);
        if (!qP) { q = (sN > 0 || dN <= far) ? qN : null; conf = sN > 0 ? "ok" : "low"; }
        else if (!qN) { q = (sP > 0 || dP <= far) ? qP : null; conf = sP > 0 ? "ok" : "low"; }
        else if (sN > sP) q = qN;
        else if (sP > sN) q = qP;
        else { q = dN < dP ? qN : qP; var lo = Math.min(dN, dP), hi = Math.max(dN, dP); conf = hi < 1e8 && lo / Math.max(1, hi) > 0.6 ? "low" : "ok"; if (lo > far) q = null; }
      }
      if (q) { (q.imgs = q.imgs || []).push({ data: f.data, w: f.w, h: f.h, page: f.p, via: f.via, kind: f.kind, conf: conf, sig: f.sig }); }
      else un.push({ data: f.data, w: f.w, h: f.h, page: f.p, via: f.via, kind: f.kind, sig: f.sig });
    });
    return un;
  }
  function annRects(annots, vp) {
    var out = [];
    (annots || []).forEach(function (an) {
      if (an.subtype !== "Highlight") return;
      var qp = an.quadPoints, pts = [];
      if (qp && qp.length) {
        if (typeof qp[0] === "number") { for (var i = 0; i + 7 < qp.length; i += 8) pts.push(qp.slice(i, i + 8)); }
        else if (Array.isArray(qp[0]) && qp[0].length === 4 && qp[0][0] && typeof qp[0][0] === "object") qp.forEach(function (q) { pts.push([].concat.apply([], q.map(function (p) { return [p.x, p.y]; }))); });
        else if (qp[0] && typeof qp[0] === "object" && "x" in qp[0]) { for (var j = 0; j + 3 < qp.length; j += 4) pts.push([].concat.apply([], qp.slice(j, j + 4).map(function (p) { return [p.x, p.y]; }))); }
        else if (Array.isArray(qp[0]) && typeof qp[0][0] === "number") qp.forEach(function (q) { pts.push(q); });
      }
      if (!pts.length && an.rect) pts.push([an.rect[0], an.rect[1], an.rect[2], an.rect[1], an.rect[0], an.rect[3], an.rect[2], an.rect[3]]);
      pts.forEach(function (q) {
        var xs = [], ys = [];
        for (var k = 0; k < q.length; k += 2) { xs.push(q[k]); ys.push(q[k + 1]); }
        out.push(rectOf(vp, Math.min.apply(0, xs), Math.min.apply(0, ys), Math.max.apply(0, xs), Math.max.apply(0, ys)));
      });
    });
    return out;
  }
  // metrik visual per baris: bg = pecahan piksel terang berwarna (highlight), ink = pecahan piksel gelap berwarna (teks berwarna)
  function visual(ctx, W, H, l) {
    var x = Math.max(0, Math.floor(l.x0)), y = Math.max(0, Math.floor(l.y0)), w = Math.min(W - x, Math.ceil(l.x1 - l.x0)), h = Math.min(H - y, Math.ceil(l.y1 - l.y0));
    if (w < 3 || h < 3) return { bg: 0, ink: 0 };
    var d = ctx.getImageData(x, y, w, h).data, n = w * h, bg = 0, ink = 0;
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn, lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 120 && c > 45) bg++; else if (lum < 130 && c > 70) ink++;
    }
    return { bg: bg / n, ink: ink / n };
  }


  /* ======================= PIPELINE PDF ======================= */
  async function parsePdf(file, opt) {
    opt = opt || {};
    var P = opt.progress || function () {}, lib = await pdfjs();
    var buf = await file.arrayBuffer(), doc = await lib.getDocument({ data: buf }).promise;
    var pages = [], ocrPages = [], warns = [], figsAll = [], canvas = document.createElement("canvas");
    try {
      for (var pn = 1; pn <= doc.numPages; pn++) {
        P({ stage: "Membaca halaman " + pn + " / " + doc.numPages, pct: (pn - 1) / doc.numPages });
        var page = await doc.getPage(pn), vp1 = page.getViewport({ scale: 1 }), tc = await page.getTextContent(), items = [];
        var S0 = 2, tmpItems = [];
        tc.items.forEach(function (it) {
          if (!it.str || !it.str.trim()) return;
          var tr = it.transform; if (Math.abs(tr[1]) > 0.5 * Math.abs(tr[0]) + 1e-6 && Math.abs(tr[2]) > 0) { if (Math.abs(tr[1]) > Math.abs(tr[0])) return; } // teks miring/vertikal (watermark)
          tmpItems.push(it);
        });
        var chars = tmpItems.reduce(function (n, i) { return n + i.str.length; }, 0), ocr = chars < 25;
        var S = Math.min(ocr ? 2.5 : S0, 3200 / Math.max(vp1.width, vp1.height)), vp = page.getViewport({ scale: S });
        canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
        var ctx = canvas.getContext("2d", { willReadFrequently: true }), W = canvas.width, H = canvas.height;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
        try { await page.getOperatorList(); } catch (e) {}
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (ocr) {
          P({ stage: "OCR halaman " + pn + " (scan terdeteksi)…", pct: (pn - 1) / doc.numPages });
          try { items = await ocrWords(canvas, opt, P); ocrPages.push(pn); }
          catch (e) { items = []; warns.push("Halaman " + pn + " berupa gambar dan OCR gagal dimuat (" + e.message + ")."); }
        } else tmpItems.forEach(function (it) {
          var tr = it.transform, h = Math.abs(it.height) || Math.hypot(tr[2], tr[3]) || 10;
          var r = rectOf(vp, tr[4], tr[5] - h * 0.22, tr[4] + it.width, tr[5] + h * 0.82); r.s = it.str; items.push(r);
        });
        var ff = await pageFigures(page, vp, lib, canvas, ctx, items, S, ocr), figs = ff.figs;
        if (opt.debug && (opt.debugPage || 1) === pn) opt._raw = { items: items.map(function (i) { return [Math.round(i.x0), Math.round(i.y0), Math.round(i.x1), Math.round(i.y1), i.s]; }), figs: figs.map(function (f) { return [f.kind, Math.round(f.x0), Math.round(f.y0), Math.round(f.x1), Math.round(f.y1)]; }) };
        items = items.filter(function (it) { return !figs.some(function (f) { return interArea(it, f) >= 0.85 * area(it); }); }); // label/teks di dalam gambar bukan bagian soal
        var wide = figs.filter(function (f) { return f.x1 - f.x0 > 0.55 * W; }), lay = makeLayout(items, W, H, wide), lines = buildLines(items, lay, ocr);
        var annots = []; try { annots = annRects(await page.getAnnotations({ intent: "display" }), vp); } catch (e) {}
        lines.forEach(function (l) {
          var ar = (l.x1 - l.x0) * (l.y1 - l.y0) || 1, a = 0;
          annots.forEach(function (r) { a = Math.max(a, interArea(l, r) / ar); });
          var v = visual(ctx, W, H, l);
          l.ann = a; l.bg = v.bg; l.ink = v.ink; l.p = pn; l.H = H; l.ocr = ocr;
        });
        for (var fi = 0; fi < figs.length; fi++) { // ekstraksi gambar: embedded → fallback potong
          var f = figs[fi];
          try {
            var fc = await figureCanvas(page, S, canvas, f, ocr), enc = encodeCanvas(fc.cv);
            f.data = enc.data; f.w = enc.w; f.h = enc.h; f.via = fc.via; f.sig = aHash(fc.cv); f.p = pn; f.cy = (f.y0 + f.y1) / 2;
            f.blk = lay.blk((f.x0 + f.x1) / 2, f.cy, f.x1 - f.x0 > 0.55 * W); figsAll.push(f);
          } catch (e) { warns.push("Gambar pada halaman " + pn + " gagal diekstrak (" + e.message + ") — gunakan “Potong dari halaman”."); }
        }
        pages.push(lines); try { page.cleanup(); } catch (e) {}
        await tick();
      }
    } finally { await ocrStop(); }
    // buang header/footer berulang & nomor halaman
    var freq = {}, key = function (t) { return t.toLowerCase().replace(/\d+/g, "#"); };
    pages.forEach(function (ls) { ls.forEach(function (l) { if (l.y1 < l.H * 0.07 || l.y0 > l.H * 0.93) freq[key(l.t)] = (freq[key(l.t)] || 0) + 1; }); });
    var minRep = Math.max(2, Math.ceil(doc.numPages * 0.4)), all = [];
    pages.forEach(function (ls) {
      ls.forEach(function (l) {
        var margin = l.y1 < l.H * 0.07 || l.y0 > l.H * 0.93;
        if (margin && !structLine(l.t) && (rePgNo.test(l.t) || freq[key(l.t)] >= minRep)) return; // jangan pernah buang baris soal/pilihan
        all.push(l);
      });
    });
    // buang gambar dekoratif yang berulang di banyak halaman (logo, watermark)
    var sigPages = {}; figsAll.forEach(function (f) { (sigPages[f.sig] = sigPages[f.sig] || {})[f.p] = 1; });
    var rep = Math.max(3, Math.ceil(doc.numPages * 0.4)); figsAll = figsAll.filter(function (f) { return Object.keys(sigPages[f.sig]).length < rep; });
    P({ stage: "Menyusun soal, kunci & gambar…", pct: 0.97 });
    var Q = parse(all), un = assignFigs(Q, all, figsAll, 2);
    var items = Q.map(function (q) {
      var d = decide(q), o = { num: q.num, q: q.q.trim(), expl: (q.expl || "").trim(), ex: Object.keys(q.ex || {}).length ? q.ex : null, diff: 2, ans: d.ans, via: d.via, active: true, img: "", imgs: q.imgs || [], ocr: !!(q.ql[0] && q.ql[0].ocr),
        page: (q.ql[0] || (q.ol.A || [])[0] || {}).p || 0 };
      LET.forEach(function (L) { o[L.toLowerCase()] = (q.o[L] || "").trim(); });
      var ql = quality(o); o.status = worst(d.status, ql.status); o.notes = d.notes.concat(ql.notes);
      return o;
    });
    if (!items.length) warns.push("Tidak ada soal yang dikenali. Pastikan format “1. Pertanyaan” diikuti pilihan “A.” hingga “E.”.");
    var nums = items.map(function (i) { return i.num; }), seen = {}, dupN = [], miss = [];
    nums.forEach(function (n) { if (seen[n]) dupN.push(n); seen[n] = 1; });
    if (nums.length > 1) { var mx = Math.max.apply(0, nums), mn = Math.min.apply(0, nums); if (mx - mn < 2000) for (var k = mn; k <= mx; k++) if (!seen[k]) miss.push(k); }
    if (miss.length) warns.push("Nomor soal tidak ditemukan: " + miss.slice(0, 30).join(", ") + (miss.length > 30 ? "…" : "") + " — kemungkinan gagal terbaca, periksa halaman terkait.");
    if (dupN.length) warns.push("Nomor soal muncul lebih dari sekali: " + dupN.slice(0, 20).join(", ") + ".");
    if (un.length) warns.push(un.length + " gambar terdeteksi tetapi belum bisa dikaitkan ke soal — lihat bagian “Gambar belum terpasang”.");
    var res = { items: items, pages: doc.numPages, ocrPages: ocrPages, warnings: warns, unassigned: un, figCount: figsAll.length };
    if (opt.debug) res.debug = { raw: opt._raw, lines: all.map(function (l) { return [l.p, l.blk, Math.round(l.x0), Math.round(l.y0), l.t, +(l.ann || 0).toFixed(2), +(l.bg || 0).toFixed(2)]; }), figs: figsAll.map(function (f) { return [f.p, f.kind, f.via, Math.round(f.x0), Math.round(f.y0), Math.round(f.x1), Math.round(f.y1)]; }) };
    return res;
  }

  /* ---------- bantuan editor: pratinjau halaman & potong manual ---------- */
  var docs = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  async function openDoc(file) {
    var d = docs && docs.get(file);
    if (!d) { d = (async function () { var lib = await pdfjs(); return lib.getDocument({ data: await file.arrayBuffer() }).promise; })(); if (docs) docs.set(file, d); }
    return d;
  }
  async function pagePreview(file, pn, maxW) {
    var doc = await openDoc(file), page = await doc.getPage(pn), v1 = page.getViewport({ scale: 1 }), S = (maxW || 900) / v1.width, vp = page.getViewport({ scale: S });
    var cv = newCanvas(vp.width, vp.height), x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: x, viewport: vp }).promise;
    return { data: cv.toDataURL("image/jpeg", 0.85), w: cv.width, h: cv.height, pages: doc.numPages };
  }
  // fr = pecahan 0..1 dari lebar/tinggi halaman
  async function cropFromPdf(file, pn, fr) {
    var doc = await openDoc(file), page = await doc.getPage(pn), v1 = page.getViewport({ scale: 1 });
    var r = { x0: Math.max(0, fr.x0 * v1.width), y0: Math.max(0, fr.y0 * v1.height), x1: Math.min(v1.width, fr.x1 * v1.width), y1: Math.min(v1.height, fr.y1 * v1.height) };
    if (r.x1 - r.x0 < 4 || r.y1 - r.y0 < 4) throw new Error("Area potong terlalu kecil.");
    var enc = encodeCanvas(await renderRegion(page, 1, r, MAXSIDE)); return { data: enc.data, w: enc.w, h: enc.h, page: pn, via: "crop", kind: "manual", conf: "ok" };
  }

  function csvParse(t) {
    var R = [], r = [], f = "", q = false, sep = (t.split("\n")[0].match(/;/g) || []).length > (t.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === sep) { r.push(f); f = ""; }
      else if (c === "\n") { r.push(f); R.push(r); r = []; f = ""; } else if (c !== "\r") f += c;
    }
    if (f || r.length) { r.push(f); R.push(r); }
    return R;
  }
  function rowsToItems(rows) {
    var h = rows[0].map(function (x) { return String(x || "").trim().toLowerCase(); }), idx = function () { for (var a = 0; a < arguments.length; a++) { var k = h.indexOf(arguments[a]); if (k >= 0) return k; } return -1; };
    var C = { num: idx("no", "nomor", "num"), q: idx("pertanyaan", "soal", "question", "q"), a: idx("a"), b: idx("b"), c: idx("c"), d: idx("d"), e: idx("e"), ans: idx("kunci", "jawaban", "answer", "ans", "key"), expl: idx("pembahasan", "penjelasan", "explanation"), diff: idx("kesulitan", "diff", "level") };
    if (C.q < 0 || C.a < 0 || C.ans < 0) throw new Error("Header kolom harus berisi: pertanyaan, A, B, C, D, E, kunci (opsional: no, pembahasan, kesulitan).");
    var g = function (r, i) { return i < 0 ? "" : String(r[i] == null ? "" : r[i]).trim(); };
    return rows.slice(1).filter(function (r) { return g(r, C.q); }).map(function (r) {
      var o = { num: +g(r, C.num) || null, q: g(r, C.q), ans: g(r, C.ans).toUpperCase().slice(0, 1), expl: g(r, C.expl), diff: +g(r, C.diff) || 2, active: true, img: "", imgs: [], via: "berkas", page: 0 };
      LET.forEach(function (L) { o[L.toLowerCase()] = g(r, C[L.toLowerCase()]); });
      var d = decide({ o: LET.reduce(function (m, L) { m[L] = o[L.toLowerCase()]; return m; }, {}), ol: {}, textKey: o.ans, q: o.q });
      o.status = d.ans ? (d.status === "bad" ? "bad" : "ok") : "bad"; o.notes = d.notes.filter(function (n) { return !/Kunci dari tulisan/.test(n); });
      if (o.status === "warn") o.status = "ok";
      return o;
    });
  }
  async function parseSheet(file) {
    var name = file.name.toLowerCase(), rows;
    if (/\.xlsx?$/.test(name)) {
      await loadScript(CDN + "xlsx/0.18.5/xlsx.full.min.js");
      var wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    } else rows = csvParse(await file.text());
    if (!rows.length) throw new Error("Berkas kosong.");
    return { items: rowsToItems(rows), pages: 0, ocrPages: [], warnings: [] };
  }
  function toCsv(rows) {
    var esc = function (v) { v = String(v == null ? "" : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return ["no,pertanyaan,A,B,C,D,E,kunci,pembahasan,kesulitan"].concat(rows.map(function (r) { return [r.num || "", r.q, r.a, r.b, r.c, r.d, r.e, r.ans, r.expl, r.diff].map(esc).join(","); })).join("\r\n");
  }

  window.AsterionPdf = { parsePdf: parsePdf, parseSheet: parseSheet, toCsv: toCsv, decide: decide, validate: validate, quality: quality, loadScript: loadScript, pagePreview: pagePreview, cropFromPdf: cropFromPdf, encodeCanvas: encodeCanvas, _parse: parse };
})();
