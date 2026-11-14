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

  function inline(x) { return esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }

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
  function markGeneric(t) {
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
    var ms = [], m, re = /([A-Z][A-Za-z][A-Za-z \/&-]{2,32}):\s/g;
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

  function renderParagraph(t) {
    var s = String(t).trim();
    if (!s) return "";
    var tb = tableInText(s);
    if (tb) return tb.html + (tb.rest ? renderParagraph(tb.rest) : "");
    var sl = sysList(s);
    if (sl) {
      return (sl.intro ? "<p>" + inline(sl.intro) + "</p>" : "") + "<ul>" + sl.items.map(function (x) {
        var body = paragraphs(x.body).map(inline).join("<br>");
        return "<li><b>" + inline(x.label + ":") + "</b> " + body + "</li>";
      }).join("") + "</ul>";
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

  function md(text) {
    var s = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
    s = crossLists(s);
    s = s.replace(MARK_RE, function (m, num, title) { return "\n\n@@H:" + num + " " + title + "@@\n\n"; });
    s = markGeneric(s);
    s = studies(s);
    return s.split(/\n{2,}/).map(renderSeg).filter(Boolean).join("");
  }

  md.esc = esc;
  md.titles = TITLES;
  md.cap = cap;
  md.ver = 3;
  return md;
});
