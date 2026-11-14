/* ASTERION — pemformat teks label obat untuk halaman Farmakologi.
   Teks label (openFDA/FDA) sering datang sebagai satu blok tanpa baris baru, sehingga tampil
   "menumpuk". Fungsi ini memecahnya menjadi: judul bagian ("12.3 Pharmacokinetics"), paragraf,
   daftar "- ", tabel "a | b | c", dan **tebal**. Semua isi di-escape lebih dulu.
   Diuji terpisah: scripts/test-teks-label.mjs */
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
    "Immunogenicity", "Clinical Trial Experience", "Postmarketing Experience", "Pharmacogenomics",
    "Carcinogenesis, Mutagenesis, Impairment of Fertility", "Animal Pharmacology and/or Toxicology"
  ];
  var TITLE_ALT = TITLES.slice().sort(function (a, b) { return b.length - a.length; })
    .map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
  // "12.3 Pharmacokinetics" di tengah blok → jadikan penanda judul
  var MARK_RE = new RegExp("\\s*(\\d{1,2}(?:\\.\\d{1,2}){0,3})\\s+(" + TITLE_ALT + ")(?=[\\s:.,)]|$)", "gi");
  var TITLE_LINE_RE = new RegExp("^(" + TITLE_ALT + ")\\s*:?$", "i");

  function unblob(t) {
    return String(t).replace(MARK_RE, function (m, num, title) {
      return "\n\n@@H:" + num + " " + title + "@@\n\n";
    });
  }

  function inline(x) { return esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }

  // Blok panjang dipecah pada batas kalimat supaya tidak menjadi satu paragraf raksasa.
  function paragraphs(txt) {
    var s = String(txt).trim();
    if (s.length <= 460) return [s];
    var parts = s.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [s], out = [], cur = "";
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (cur && (cur.length + p.length) > 380) { out.push(cur.trim()); cur = ""; }
      cur += p;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function md(text) {
    var L = unblob(String(text == null ? "" : text).replace(/\r\n?/g, "\n")).split("\n"), out = [], i = 0;
    var isLi = function (l) { return /^\s*[-•]\s+/.test(l); };
    var isRow = function (l) { return l != null && l.indexOf("|") >= 0; };
    var isSep = function (l) { return /^\s*\|?[\s:-]+(\|[\s:-]+)+\|?\s*$/.test(l); };
    var headingOf = function (l) {
      var h = /^@@H:(.+?)@@$/.exec(String(l).trim());
      if (h) return h[1];
      var s = String(l).trim();
      return (s.length <= 60 && TITLE_LINE_RE.test(s)) ? s.replace(/\s*:$/, "") : "";
    };
    while (i < L.length) {
      var l = L[i];
      if (!l.trim()) { i++; continue; }
      var hd = headingOf(l);
      if (hd) { out.push("<h4 class='fm-h'>" + inline(hd) + "</h4>"); i++; continue; }
      if (isLi(l)) {
        var li = [];
        while (i < L.length && isLi(L[i])) { li.push("<li>" + inline(L[i].replace(/^\s*[-•]\s+/, "")) + "</li>"); i++; }
        out.push("<ul>" + li.join("") + "</ul>");
        continue;
      }
      if (isRow(l) && isRow(L[i + 1])) {
        var rows = [];
        while (i < L.length && isRow(L[i])) {
          if (!isSep(L[i])) rows.push(L[i].trim().replace(/^\||\|$/g, "").split("|"));
          i++;
        }
        out.push("<div class='fm-tw'><table class='fm-tb'>" + rows.map(function (r, k) {
          return "<tr>" + r.map(function (c) { return (k ? "<td>" : "<th>") + inline(c.trim()) + (k ? "</td>" : "</th>"); }).join("") + "</tr>";
        }).join("") + "</table></div>");
        continue;
      }
      var p = [l]; i++;
      while (i < L.length && L[i].trim() && !isLi(L[i]) && !headingOf(L[i]) && !(isRow(L[i]) && isRow(L[i + 1]))) { p.push(L[i]); i++; }
      paragraphs(p.join(" ")).forEach(function (x) { out.push("<p>" + inline(x) + "</p>"); });
    }
    return out.join("");
  }

  md.esc = esc;
  md.titles = TITLES;
  return md;
});
