/* ASTERION — pemformat teks label obat untuk halaman Farmakologi.
   Teks label (openFDA/FDA) sering datang sebagai satu blok tanpa baris baru, sehingga tampil
   "menumpuk" dan sulit dibaca. Modul ini menstrukturkan teks tersebut menjadi:
     - judul bagian bernomor ("12.3 Pharmacokinetics", "6.1 Clinical Trials Experience"),
     - judul studi ("Treating to New Targets Study (TNT)"),
     - daftar rujukan silang ("Myopathy and Rhabdomyolysis [see Warnings and Precautions (5.1) ]"),
     - tabel angka FDA ("Table 1: … Nasopharyngitis 8.2 12.9 …"),
     - enumerasi bersistem ("Body as a whole: malaise, pyrexia"),
     - paragraf pendek (kalimat/klausa panjang dipecah agar terbaca).
   Semua isi di-escape lebih dulu. Diuji terpisah: scripts/test-teks-label.mjs */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.FMmd = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var REF_SEE = /\[(see\s[^\]\n]{2,90})\]/g;
  var REF_NUM = /\(\s?(?:1[0-7]|[1-9])\.\d{1,2}(?:\s*,\s*(?:1[0-7]|[1-9])\.\d{1,2})*\s?\)(?=\s*(?:$|[.;,:]|\s[A-Z\u2022]))/g;
  // rujukan silang label ("[see Warnings (5.1)]", "(1.1)") diredam supaya isi kalimat yang menonjol
  function inline(x) {
    return esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(REF_SEE, "<span class='fm-ref'>[$1]</span>").replace(REF_NUM, function (m) { return "<span class='fm-ref'>" + m + "</span>"; });
  }

  // Judul bagian baku label obat. Hanya judul yang dikenal yang dijadikan heading, supaya nama obat
  // di awal kalimat (mis. "Simvastatin is a lactone…") tidak salah dianggap judul.
  var TITLES = [
    "Mechanism of Action", "Pharmacokinetics", "Pharmacodynamics", "Indications and Usage",
    "Dosage and Administration", "Contraindications", "Warnings and Precautions", "Adverse Reactions",
    "Drug Interactions", "Use in Specific Populations", "Clinical Pharmacology", "Clinical Studies",
    "Nonclinical Toxicology", "How Supplied", "Storage and Handling", "Patient Counseling Information",
    "Information for Patients", "Overdosage", "Pregnancy", "Nursing Mothers", "Pediatric Use",
    "Geriatric Use", "Renal Impairment", "Hepatic Impairment", "Absorption", "Distribution",
    "Metabolism", "Excretion", "Specific Populations", "Drug Interaction Studies", "Microbiology",
    "Immunogenicity", "Clinical Trial Experience", "Clinical Trials Experience", "Postmarketing Experience",
    "Pharmacogenomics", "Carcinogenesis, Mutagenesis, Impairment of Fertility",
    "Animal Pharmacology and/or Toxicology", "Laboratory Abnormalities", "Hypersensitivity Reactions",
    "Drug Abuse and Dependence", "Description", "Clinical Trials", "Pediatric Patients", "Geriatric Patients"
  ];
  var TITLE_ALT = TITLES.slice().sort(function (a, b) { return b.length - a.length; })
    .map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
  var MARK_RE = new RegExp("\\s*(\\d{1,2}(?:\\.\\d{1,2}){0,3})\\s+(" + TITLE_ALT + ")(?=[\\s:.,)]|$)", "gi");
  var TITLE_LINE_RE = new RegExp("^(" + TITLE_ALT + ")\\s*:?$", "i");

  // ---------- 1. daftar rujukan silang: "A [see X (5.1) ] B [see Y (5.2) ]" ----------
  // Label FDA menulis daftar seperti ini dalam satu paragraf. Dipecah menjadi item daftar.
  var CROSS_RUN = /((?:[^\[\]:.;\n]{4,90}?\[see\s[^\]\n]{2,70}\]\s*){2,})/g;
  function crossLists(t) {
    return t.replace(CROSS_RUN, function (run) {
      var items = run.match(/[^\[\]]+?\[see\s[^\]\n]{2,70}\]/g) || [];
      if (items.length < 2) return run;
      return "\n\n" + items.map(function (x) { return "@@L:" + x.trim() + "@@"; }).join("\n") + "\n\n";
    });
  }

  // ---------- 1b. butir "•" yang menempel dalam satu paragraf → daftar ----------
  // Teks label FDA: "…indicated: To reduce the risk of: • MI, stroke (1.1) • Adults with … (1.2) Limitations of Use: …"
  var BUL = /\s*[\u2022\u25CF\u25AA\u2023\u25E6]\s+/g;
  var ITEM_END = /\(\s?\d{1,2}(?:\.\d{1,2})*(?:\s*,\s*\d{1,2}(?:\.\d{1,2})*)*\s?\)\s+(?=[A-Z])/;
  function bullets(t) {
    if (!/[\u2022\u25CF\u25AA\u2023\u25E6]\s/.test(t)) return t;
    var lines = t.replace(BUL, "\n@@B:").split("\n"), out = [], prevB = false;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.slice(0, 4) !== "@@B:") { out.push((prevB ? "\n" : "") + l); prevB = false; continue; }
      var item = l.slice(4).trim(), rest = "", m = ITEM_END.exec(item);
      if (m) { rest = item.slice(m.index + m[0].length); item = item.slice(0, m.index + m[0].trim().length); }
      var nextIsB = i + 1 < lines.length && lines[i + 1].slice(0, 4) === "@@B:";
      if (!m && !nextIsB) { var sp = /^(.{40,}?[.!?])\s+(?=[A-Z])/.exec(item); if (sp) { rest = item.slice(sp[0].length); item = sp[1]; } }
      out.push((prevB ? "" : "\n\n") + "@@L:" + item + "@@");
      prevB = true;
      if (rest) { out.push("\n\n" + rest); prevB = false; }
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n");
  }
  var LEADS = ["Important Limitations of Use", "Limitations of Use", "Important Administration Instructions", "Recommended Dosage", "Recommended Dose", "Dosage Adjustments?", "Risk Summary", "Clinical Considerations", "Pediatric Patients", "Geriatric Patients", "Adults", "Pregnancy", "Lactation", "Boxed Warning", "Warning", "Note", "Examples"];
  var LEAD_RE = new RegExp("(^|[.!?)\\]]\\s+)(" + LEADS.join("|") + "):\\s+", "gm");
  function leads(t) { return t.replace(LEAD_RE, function (m, pre, lab) { return pre + "\n\n**" + lab + ":** "; }); }

  // ---------- 2. judul bagian bernomor yang tidak ada di daftar baku ----------
  // Berlaku juga untuk judul hasil terjemahan ("6.1 Pengalaman Uji Klinis"). Hanya menerima
  // rangkaian kata berhuruf kapital, minimal dua kata, dan diikuti awal kalimat baru.
  var STOP = {
    Because: 1, Since: 1, Although: 1, However: 1, Therefore: 1, Thus: 1, The: 1, This: 1, These: 1,
    Those: 1, In: 1, For: 1, To: 1, When: 1, While: 1, If: 1, All: 1, Most: 1, No: 1, There: 1,
    Patients: 1, Data: 1, Results: 1, Studies: 1, Treatment: 1, Doses: 1, A: 1, An: 1, It: 1, We: 1,
    At: 1, On: 1, By: 1, From: 1, With: 1, And: 1, Or: 1, But: 1, As: 1, Such: 1, Each: 1, Every: 1,
    Some: 1, Many: 1, Only: 1, After: 1, Before: 1, During: 1, Following: 1, Based: 1, According: 1,
    Karena: 1, Untuk: 1, Pada: 1, Dalam: 1, Dengan: 1, Dari: 1, Yang: 1, Jika: 1, Bila: 1, Saat: 1,
    Ini: 1, Itu: 1, Semua: 1, Sebagian: 1, Pasien: 1, Data: 1, Hasil: 1
  };
  function markGenericPlain(t) {
    var out = "", i = 0, n = t.length, lastCh = "";
    while (i < n) {
      var num = /^(\d{1,2}(?:\.\d{1,2}){1,3})\s+/.exec(t.slice(i, i + 20));
      if (num && (!lastCh || /[.;:)\]]/.test(lastCh))) {
        var rest = t.slice(i + num[0].length);
        var ws = rest.split(/\s+/), k = 0;
        while (k < ws.length && k < 6 && /^[A-Z][A-Za-z0-9\-\/&']*$/.test(ws[k]) && !STOP[ws[k]]) k++;
        if (k >= 2) {
          var title = ws.slice(0, k).join(" ");
          var after = rest.slice(title.length);
          if (title.length <= 60 && (/^\s+[A-Z]/.test(after) || after.trim() === "")) {
            out += "\n\n@@H:" + num[1] + " " + title + "@@\n\n";
            i += num[0].length + title.length;
            lastCh = "@";
            continue;
          }
        }
      }
      out += t[i];
      if (t[i].trim()) lastCh = t[i];
      i++;
    }
    return out;
  }

  // Penanda @@…@@ tidak boleh ditandai ulang: dulu "6.1 Clinical Trials Experience" jadi rusak
  // karena nomornya ditandai dua kali. Sekarang bagian bertanda dilewati.
  function markGeneric(t) {
    return String(t).split(/(@@[^@\n]*@@)/).map(function (part) {
      return /^@@/.test(part) ? part : markGenericPlain(part);
    }).join("");
  }

  // Judul baku yang berdiri sendiri di satu baris (tanpa nomor), mis. "Mechanism of Action".
  function titleLines(t) {
    return String(t).split(/\n/).map(function (ln) {
      var x = ln.trim(), m = TITLE_LINE_RE.exec(x);
      return m ? "\n\n@@H:" + m[1] + "@@\n\n" : ln;
    }).join("\n");
  }

  // ---------- 3. judul studi tanpa nomor: "Treating to New Targets Study (TNT) In TNT, …" ----------
  var STUDY_RE = /\b([A-Z][A-Za-z0-9 ,\/&\-]{2,50}?\sStudy\s*\([A-Z]{2,8}\))\s+(?=[A-Z])/g;
  function studies(t) {
    return t.replace(STUDY_RE, function (m, name) { return "\n\n@@S:" + name.trim() + "@@\n\n"; });
  }

  // ---------- 4. pemecah kalimat & klausa ----------
  function sentences(s) {
    var parts = String(s).match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [String(s)];
    return parts.map(function (x) { return x.trim(); }).filter(Boolean);
  }

  // Kalimat sangat panjang dipecah di titik koma, lalu di koma, supaya tidak jadi dinding teks.
  function splitLong(p) {
    if (p.length <= 420) return [p];
    var groups = [], cur = "";
    (p.match(/[^;]+;\s*|[^;]+$/g) || [p]).forEach(function (c) {
      if (cur && cur.length + c.length > 300) { groups.push(cur.trim()); cur = ""; }
      cur += c;
    });
    if (cur.trim()) groups.push(cur.trim());
    var out = [];
    groups.forEach(function (g) {
      if (g.length <= 420) { out.push(g); return; }
      var c2 = "", parts = g.match(/[^,]+,\s*|[^,]+$/g) || [g];
      parts.forEach(function (c) {
        if (c2 && c2.length + c.length > 320) { out.push(c2.trim()); c2 = ""; }
        c2 += c;
      });
      if (c2.trim()) out.push(c2.trim());
    });
    return out;
  }

  function paragraphs(txt) {
    var s = String(txt).trim();
    if (!s) return [];
    if (s.length <= 320) return [s];
    var out = [], cur = "";
    sentences(s).forEach(function (p) {
      if (cur && cur.length + p.length + 1 > 320) { out.push(cur.trim()); cur = ""; }
      cur += (cur ? " " : "") + p;
    });
    if (cur.trim()) out.push(cur.trim());
    var fin = [];
    out.forEach(function (x) { fin = fin.concat(splitLong(x)); });
    return fin;
  }

  // ---------- 5. tabel angka yang "gepeng" di dalam paragraf ----------
  var PCT_RE = /%\s*([A-Za-z0-9 .\/\-]{1,18}?)\s*N\s*=\s*(\d+)/g;
  var ROW_RE = /([A-Z][A-Za-z0-9 ,\-\/()]{1,58}?)\s+((?:\d{1,3}(?:\.\d{1,2})?\s+){1,11}\d{1,3}(?:\.\d{1,2})?)/g;

  function tableInText(t) {
    var cap = /Table\s*(\d+[A-Za-z]?)\s*:\s*/.exec(t);
    if (!cap) return null;
    var region = t.slice(cap.index), pct = [], m;
    PCT_RE.lastIndex = 0;
    while ((m = PCT_RE.exec(region))) pct.push({ label: m[1].trim(), n: m[2], at: m.index, len: m[0].length });
    var startAt = pct.length ? pct[pct.length - 1].at + pct[pct.length - 1].len : cap[0].length;
    var tail = region.slice(startAt), rows = [], rm, prevEnd = 0;
    ROW_RE.lastIndex = 0;
    while ((rm = ROW_RE.exec(tail))) {
      var gap = tail.slice(prevEnd, rm.index);
      if (rows.length && /[.!?:]/.test(gap)) break; // baris tabel harus berurutan
      var nums = rm[2].trim().split(/\s+/);
      if (nums.length >= 2) rows.push({ label: rm[1].trim(), nums: nums, end: rm.index + rm[0].length });
      prevEnd = rm.index + rm[0].length;
    }
    if (rows.length < 3) return null;

    var headTxt = region.slice(cap[0].length, pct.length ? pct[0].at : cap[0].length).trim();
    var cornerM = /(Adverse Reaction|Adverse Event|System Organ Class|Laboratory Test|Parameter|Reaction|Event)\s*$/i.exec(headTxt);
    var corner = cornerM ? cornerM[1] : "Parameter";
    var caption = (cornerM ? headTxt.slice(0, cornerM.index) : headTxt).trim() || "Data";
    var prefix = t.slice(0, cap.index).trim();

    var head = "<tr><th>" + inline(corner) + "</th>" + pct.map(function (p) {
      return "<th>" + inline(p.label) + " <span class='fm-n'>N=" + esc(p.n) + "</span></th>";
    }).join("") + "</tr>";
    var body = rows.map(function (r) {
      var cells = r.nums.slice(0);
      while (cells.length < pct.length) cells.push("—");
      return "<tr><th scope='row'>" + inline(r.label) + "</th>" + cells.map(function (c) {
        return "<td>" + inline(c) + "</td>";
      }).join("") + "</tr>";
    }).join("");

    var html = (prefix ? paragraphs(prefix).map(function (x) { return "<p>" + inline(x) + "</p>"; }).join("") : "") +
      "<div class='fm-cap'>" + inline("Table " + cap[1] + ": " + caption) + "</div>" +
      "<div class='fm-tw'><table class='fm-tb'>" + head + body + "</table></div>";
    return { html: html, rest: tail.slice(rows[rows.length - 1].end).trim() };
  }

  // ---------- 6. enumerasi bersistem: "Body as a whole: malaise, pyrexia …" ----------
  function sysList(t) {
    var ms = [], m, re = /([A-Z][A-Za-z][A-Za-z \/&-]{1,32}):\s/g;
    while ((m = re.exec(t))) ms.push({ i: m.index, len: m[0].length, label: m[1].trim() });
    ms = ms.filter(function (x) { return x.label.split(/\s+/).length <= 4; });
    if (ms.length < 2) return null;
    var intro = t.slice(0, ms[0].i).trim(), items = [];
    for (var k = 0; k < ms.length; k++) {
      var start = ms[k].i + ms[k].len;
      var end = k + 1 < ms.length ? ms[k + 1].i : t.length;
      items.push({ label: ms[k].label, body: t.slice(start, end).trim() });
    }
    return { intro: intro, items: items };
  }

  // ---------- 5b. tabel angka tanpa label baris & rumus ----------
  // Contoh: "DOSAGE TABLE FOR VANCOMYCIN … (Adapted from X et al. 1 ) Creatinine Clearance mL/min Vancomycin Dose mg/24 h 100 1,545 90 1,390 …"
  // Deretan angka berpasangan (kolom pertama menurun/naik teratur) dijadikan tabel; judul kapital dirapikan.
  var NUM = "(?:\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)";
  var RUN_RE = new RegExp("(?:^|\\s)((?:" + NUM + "\\s+){7,}" + NUM + ")(?=\\s|$)");
  var SMALL = { for: 1, in: 1, with: 1, of: 1, and: 1, the: 1, to: 1, on: 1, by: 1, or: 1, a: 1, an: 1, at: 1, from: 1 };
  function titleCaps(x) {
    return x.toLowerCase().split(/\s+/).map(function (w, i) {
      var orig = x.split(/\s+/)[i];
      if (orig.length <= 3 && !SMALL[w]) return orig;           // singkatan pendek (FDA, ICU, IV) dipertahankan
      if (i && SMALL[w]) return w;
      return w.replace(/^[a-z]/, function (c) { return c.toUpperCase(); });
    }).join(" ");
  }
  var UNIT_RE = /\S*?[A-Za-z\u00B5]+\/\d*\s?[A-Za-z\u00B5]+/g;
  function colLabels(head, c) {
    var us = head.match(UNIT_RE) || [];
    if (us.length !== c) return null;
    var out = [], from = 0;
    us.forEach(function (u) {
      var i = head.indexOf(u, from), lab = head.slice(from, i).trim(), unit = u.trim();
      out.push((lab || "Nilai") + " (" + unit + ")"); from = i + u.length;
    });
    return out;
  }
  function numTable(t) {
    var m = RUN_RE.exec(t); if (!m) return null;
    var toks = m[1].trim().split(/\s+/), n = toks.length, c = 0;
    for (var k = 2; k <= 5 && !c; k++) {
      if (n % k || n / k < 4) continue;
      var col = [], dir = 0, okc = true;
      for (var i = 0; i < n; i += k) col.push(parseFloat(toks[i].replace(/,/g, "")));
      for (var j = 1; j < col.length && okc; j++) { var d = col[j] - col[j - 1]; if (!d || (dir && (d > 0) !== (dir > 0))) okc = false; dir = d; }
      if (okc) c = k;
    }
    if (!c) return null;
    var start = m.index + (/^\s/.test(m[0]) ? 1 : 0), before = t.slice(0, start).trim(), rest = t.slice(start + m[1].length).trim();
    var cap = "", sub = "", mc = /^((?:[A-Z][A-Z0-9,\-\/&']*\s+){2,}[A-Z][A-Z0-9,\-\/&']*)\s*(\([^)]{0,90}\))?\s*/.exec(before);
    if (mc) { cap = titleCaps(mc[1]); sub = (mc[2] || "").replace(/\s+\)/, ")"); before = before.slice(mc[0].length).trim(); }
    var hs = before.split(/(?<=[.!?])\s+(?=[A-Z])/), head = hs.pop() || "", prefix = hs.join(" ");
    var labels = colLabels(head, c);
    if (!labels && head) { prefix = (prefix ? prefix + " " : "") + head; head = ""; }
    var rows = []; for (var r = 0; r < n; r += c) rows.push(toks.slice(r, r + c));
    var html = (prefix ? paragraphs(prefix).map(function (x) { return "<p>" + inline(x) + "</p>"; }).join("") : "") +
      (cap ? "<div class='fm-cap'>" + inline(cap) + (sub ? " <span class='fm-ref'>" + esc(sub) + "</span>" : "") + "</div>" : "") +
      "<div class='fm-tw'><table class='fm-tb fm-num'>" + (labels ? "<tr>" + labels.map(function (x) { return "<th>" + inline(x) + "</th>"; }).join("") + "</tr>" : "") +
      rows.map(function (rw) { return "<tr>" + rw.map(function (x) { return "<td>" + esc(x) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>";
    return html + (rest ? renderParagraph(rest) : "");
  }
  // "[Weight (kg) x (140 – age in years)] 72 x serum creatinine" → pecahan; "x" → ×; "0. 85" → "0.85"
  function formula(b) {
    var x = String(b).replace(/\b(0)\.\s+(\d)/g, "$1.$2").replace(/(\s)x(\s)/g, "$1\u00D7$2").trim();
    var fm = /^(\[[^\]]+\])\s+(\d[^\[\]]*?)$/.exec(x);
    if (fm) return "<span class='fm-frac'><span>" + inline(fm[1].replace(/^\[|\]$/g, "")) + "</span><span>" + inline(fm[2]) + "</span></span>";
    return inline(x);
  }
  var FORM_MARK = /[\u00D7=]|\sx\s/;
  function renderParagraph(t) {
    var s = String(t).trim();
    if (!s) return "";
    var tb = tableInText(s);
    if (tb) return tb.html + (tb.rest ? renderParagraph(tb.rest) : "");
    var nt = numTable(s);
    if (nt) return nt;
    var sl = sysList(s);
    if (sl) {
      var tail = "", last = sl.items.length - 1, lb = sl.items[last].body;
      if (FORM_MARK.test(lb)) { // butir rumus terakhir: kalimat penutup keluar dari butir
        var cut = /(?<=[a-z0-9)\]])\s+(?=[A-Z][a-z]{2,}\s+[a-z])/.exec(lb);
        if (cut) { tail = lb.slice(cut.index).trim(); sl.items[last].body = lb.slice(0, cut.index).trim(); }
      }
      return (sl.intro ? "<p>" + inline(sl.intro) + "</p>" : "") + "<ul>" + sl.items.map(function (x) {
        if (FORM_MARK.test(x.body)) return "<li class='fm-eq'><b>" + inline(x.label + ":") + "</b> " + formula(x.body) + "</li>";
        var body = paragraphs(x.body).map(inline).join("<br>");
        return "<li><b>" + inline(x.label + ":") + "</b> " + body + "</li>";
      }).join("") + "</ul>" + (tail ? renderParagraph(tail) : "");
    }
    return paragraphs(s).map(function (x) { return "<p>" + inline(x) + "</p>"; }).join("");
  }

  // ---------- 7. perakit blok ----------
  function renderSeg(seg) {
    var L = seg.split("\n").filter(function (x) { return x.trim() !== ""; });
    if (!L.length) return "";
    var one = L.length === 1 ? L[0].trim() : "";
    var mH = /^@@H:(.+?)@@$/.exec(one);
    if (mH) return "<h4 class='fm-h'>" + inline(mH[1]) + "</h4>";
    var mS = /^@@S:(.+?)@@$/.exec(one);
    if (mS) return "<h5 class='fm-h2'>" + inline(mS[1]) + "</h5>";
    if (L.every(function (l) { return /^@@L:/.test(l.trim()); })) {
      return "<ul>" + L.map(function (l) {
        return "<li>" + inline(l.trim().replace(/^@@L:/, "").replace(/@@\s*$/, "")) + "</li>";
      }).join("") + "</ul>";
    }
    if (L.every(function (l) { return /^\s*[-•]\s+/.test(l); })) {
      return "<ul>" + L.map(function (l) {
        return "<li>" + inline(l.replace(/^\s*[-•]\s+/, "")) + "</li>";
      }).join("") + "</ul>";
    }
    if (L.length >= 2 && L.every(function (l) { return l.indexOf("|") >= 0; })) {
      var rows = L.filter(function (l) { return !/^\s*\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/.test(l); })
        .map(function (l) { return l.trim().replace(/^\||\|$/g, "").split("|"); });
      return "<div class='fm-tw'><table class='fm-tb'>" + rows.map(function (r, k) {
        return "<tr>" + r.map(function (c) {
          return (k ? "<td>" : "<th>") + inline(c.trim()) + (k ? "</td>" : "</th>");
        }).join("") + "</tr>";
      }).join("") + "</table></div>";
    }
    return renderParagraph(L.join(" "));
  }

  // Kapitalisasi judul nama obat: "metformin" -> "Metformin", "atorvastatin kalsium" -> "Atorvastatin Kalsium".
  // Hanya huruf pertama tiap kata yang diubah; singkatan, angka, dan simbol ("HbA1c", "HMG-CoA", "B12") dibiarkan.
  function cap(s) {
    return String(s == null ? "" : s).replace(/(^|[\s\-\/(])([a-z\u00E0-\u00FF])/g, function (m, p, c) { return p + c.toUpperCase(); });
  }

  // Judul yang terulang dua kali di awal teks dan tanda kurung yang terputus baris ("…et al.\n\n1 )") dirapikan.
  function heal(s) {
    var L = s.split("\n"), a = (L[0] || "").trim(), b = (L[1] || "").trim();
    if (a.length > 20 && b.length >= a.length && b.indexOf(a) === 0) { L.shift(); s = L.join("\n"); }
    return s.replace(/(\([^()\n]*)\n+\s*(\d{1,2}\s*\))/g, "$1 $2").replace(/(\d)\s+\)/g, "$1)").replace(/\b(0)\.\s+(\d)/g, "$1.$2");
  }

  function md(text) {
    var s = heal(String(text == null ? "" : text).replace(/\r\n?/g, "\n"));
    s = crossLists(s);
    s = bullets(s);
    s = leads(s);
    s = titleLines(s);
    s = s.replace(MARK_RE, function (m, num, title) { return "\n\n@@H:" + num + " " + title + "@@\n\n"; });
    s = markGeneric(s);
    s = studies(s);
    return s.split(/\n{2,}/).map(renderSeg).filter(Boolean).join("");
  }

  // Teks panjang: tampilkan bagian awal, sisanya dilipat ("Tampilkan selengkapnya"). Judul tidak boleh menggantung di ujung bagian awal.
  var TOP = /(?=<(?:p|h4|h5|ul)>|<(?:h4|h5) class=|<div class='fm-(?:cap|tw)')/;
  function plain(h) { return h.replace(/<[^>]+>/g, "").length; }
  function fold(text, opt) {
    opt = opt || {};
    var html = md(text), parts = html.split(TOP).filter(Boolean);
    if (parts.length <= 4 || plain(html) <= (opt.chars || 1300)) return html;
    var n = 0, len = 0;
    while (n < parts.length && (n < 3 || len < (opt.show || 650))) { len += plain(parts[n]); n++; }
    while (n > 1 && /^<h[45]/.test(parts[n - 1])) n--;
    if (n >= parts.length) return html;
    return parts.slice(0, n).join("") + "<details class='fm-more'><summary>" + esc(opt.more || "Tampilkan selengkapnya") + " (" + (parts.length - n) + " bagian lagi)</summary>" + parts.slice(n).join("") + "</details>";
  }

  md.esc = esc;
  md.titles = TITLES;
  md.cap = cap;
  md.fold = fold;
  md.ver = 4;
  return md;
});
