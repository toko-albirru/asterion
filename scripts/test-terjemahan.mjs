// Uji pelindungan istilah medis/ilmiah pada pipeline terjemahan Farmakologi.
// Memakai penerjemah PALSU yang meniru mesin MT: semua kata Inggris diterjemahkan,
// sehingga terlihat jelas istilah mana yang tidak terlindungi.
import { maskTerms, unmaskTerms, trCheck, fixTr, sciTokens } from "../src/farmako.js";

let ok = 0, bad = 0;
const t = (name, cond) => { if (cond) { ok++; } else { bad++; console.log("GAGAL: " + name); } };

const fakeMT = (s) => String(s)
  .replace(/\bPotassium\b/g, "Kalium")
  .replace(/\bCyclooxygenase\b/g, "Siklooksigenase")
  .replace(/\bHomo sapiens\b/g, "Manusia")
  .replace(/\btransporting\b/g, "pengangkutan")
  .replace(/\binhibits\b/g, "menghambat")
  .replace(/\bthe\b/g, "itu")
  .replace(/\bof\b/g, "dari");

const round = (src) => { const mk = maskTerms(src); return unmaskTerms(fakeMT(mk.text), mk.terms); };

// 1) Nama ilmiah harus utuh setelah melewati mesin terjemahan.
const SCI_CASES = [
  "Potassium-transporting ATPase (Homo sapiens)",
  "Homo sapiens (Homo sapiens sapiens)",
  "Cyclooxygenase (Homo sapiens)",
  "Digoxin inhibits the Potassium-transporting ATPase (Homo sapiens).",
  "Inhibition of cyclooxygenase reduces prostaglandin synthesis.",
  "CYP3A4 and SLC12A1 are involved in the metabolism of the drug.",
  "S-warfarin is metabolised by CYP2C9.",
];
for (const src of SCI_CASES) {
  const r = round(src);
  for (const tk of sciTokens(src)) t("terjaga [" + tk + "] pada: " + src, r.text.includes(tk));
  t("penanda tidak hilang: " + src, !r.missing);
  t("tidak ada istilah ilmiah yang diterjemahkan: " + src, !/Kalium|Siklooksigenase|Manusia|pengangkutan/.test(r.text));
}

// 2) Guard menolak terjemahan yang mengubah istilah medis (kasus yang dilaporkan pengguna).
t("tolak 'Pengangkutan kalium ATPase (Homo sapiens)'",
  trCheck("Potassium-transporting ATPase (Homo sapiens)", "Pengangkutan kalium ATPase (Homo sapiens)") !== "");
t("tolak 'Siklooksigenase (Manusia)'",
  trCheck("Cyclooxygenase (Homo sapiens)", "Siklooksigenase (Manusia)") !== "");
t("tolak 'Homo sapiens' yang diterjemahkan",
  trCheck("Homo sapiens (Homo sapiens sapiens)", "Manusia (Manusia cerdas)") !== "");
t("terima terjemahan yang mempertahankan istilah",
  trCheck("Digoxin inhibits the Potassium-transporting ATPase (Homo sapiens).", "Digoksin menghambat Potassium-transporting ATPase (Homo sapiens).") === "");
t("terima kalimat biasa yang benar",
  trCheck("Take one tablet by mouth once daily with food.", "Minum satu tablet per oral sekali sehari bersama makanan.") === "");

// 3) Kalimat campuran: bagian medis tetap, bagian umum boleh diterjemahkan.
const mixed = maskTerms("Digoxin inhibits the Potassium-transporting ATPase (Homo sapiens).");
t("kata umum tetap bisa diterjemahkan", /inhibits/.test(mixed.text));
t("nama enzim tidak ikut diterjemahkan", !/Potassium/.test(mixed.text) && !/ATPase/.test(mixed.text));
t("nama organisme tidak ikut diterjemahkan", !/sapiens/.test(mixed.text));

// 4) Istilah farmakologi baku tidak diterjemahkan.
for (const term of ["clearance", "half-life", "bioavailability", "agonist", "antagonist", "steady state", "contraindication", "first-pass metabolism"]) {
  const mk = maskTerms("The " + term + " of the drug is important.");
  t("istilah baku terjaga: " + term, !new RegExp(term.replace(/[-]/g, "\\-"), "i").test(mk.text));
}

// 5) Teks yang seluruhnya istilah baku tidak perlu diterjemahkan sama sekali.
const pure = maskTerms("Cyclooxygenase (Homo sapiens)");
t("teks istilah murni tidak menyisakan kata Inggris", !/[A-Za-z]{2}/.test(pure.text));

// 6) Koreksi padanan baku.
t("fixTr: waktu setengah hidup → waktu paruh", fixTr("waktu setengah hidup").includes("waktu paruh"));
t("fixTr: siklooksigenase → Cyclooxygenase", fixTr("siklooksigenase").includes("Cyclooxygenase"));

// 7) Teks farmakokinetik (kasus yang dilaporkan pengguna): istilah baku tidak ikut diterjemahkan.
const PK_SRC = "Simvastatin is a lactone that is readily hydrolyzed in vivo to the corresponding β-hydroxyacid. Pharmacokinetics (PK) of simvastatin and its metabolites was originally characterized using inhibition of HMG-CoA reductase activity following base hydrolysis of plasma samples, as specific bioanalytical methods were not available. Inhibition of the enzyme activity (equivalent to the level of total inhibitors) represented the combination";
const PK_KEEP = ["lactone", "hydrolyzed", "in vivo", "hydroxyacid", "Pharmacokinetics", "metabolites", "HMG-CoA reductase", "hydrolysis", "plasma", "bioanalytical", "inhibitors"];
const pkMask = maskTerms(PK_SRC);
for (const term of PK_KEEP) t("istilah PK dilindungi: " + term, pkMask.text.toLowerCase().indexOf(term.toLowerCase()) < 0);
t("istilah PK kembali utuh setelah unmask", PK_KEEP.every((x) => unmaskTerms(fakeMT(pkMask.text), pkMask.terms).text.includes(x)));
t("tolak terjemahan yang menghilangkan istilah PK", trCheck(PK_SRC, "Simvastatin adalah laktosa yang mudah terhidrolisis di dalam tubuh menjadi asam hidroksi.") !== "");

console.log((bad ? "GAGAL " : "") + ok + " lulus, " + bad + " gagal");
process.exit(bad ? 1 : 0);
