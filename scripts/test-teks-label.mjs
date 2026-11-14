// Uji pemformat teks label obat (public/farmako-md.js).
// Kasus utama: teks openFDA yang menumpuk dalam satu blok harus pecah jadi judul + paragraf.
import fs from "node:fs";
import vm from "node:vm";

let ok = 0, bad = 0;
const t = (name, cond) => { if (cond) { ok++; } else { bad++; console.log("GAGAL: " + name); } };

const code = fs.readFileSync(new URL("../public/farmako-md.js", import.meta.url), "utf8");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "farmako-md.js" });
const md = sandbox.FMmd;
if (typeof md !== "function") { console.log("GAGAL: FMmd tidak tersedia"); process.exit(1); }

const SIMVA = "12.3 Pharmacokinetics Simvastatin is a lactone that is readily hydrolyzed in vivo to the corresponding β-hydroxyacid. Pharmacokinetics (PK) of simvastatin and its metabolites was originally characterized using inhibition of HMG-CoA reductase activity following base hydrolysis of plasma samples, as specific bioanalytical methods were not available. Inhibition of the enzyme activity (equivalent to the level of total inhibitors) represented the combination";

const h = md(SIMVA);
t("judul bernomor dikenali", /<h4 class='fm-h'>12\.3 Pharmacokinetics<\/h4>/.test(h));
t("judul tidak menelan kalimat isi", !/<h4[^>]*>[^<]*Simvastatin[^<]*<\/h4>/.test(h));
t("isi dimulai sebagai paragraf", /<p>Simvastatin is a lactone/.test(h));
t("blok panjang dipecah jadi beberapa paragraf", (h.match(/<p>/g) || []).length >= 2);
t("tidak ada paragraf raksasa", (h.match(/<p>[^<]{420,}<\/p>/g) || []).length === 0);

// Judul tanpa nomor (baris sendiri) tetap dikenali.
const two = md("Mechanism of Action\nSimvastatin inhibits HMG-CoA reductase.\n\nPharmacokinetics\nAbsorption is high.");
t("dua judul tanpa nomor dikenali", (two.match(/<h4/g) || []).length === 2);
t("isi setelah judul tanpa nomor tetap paragraf", /<h4 class='fm-h'>Mechanism of Action<\/h4><p>Simvastatin inhibits/.test(two));

// Teks yang bukan judul baku tidak dipaksa menjadi judul.
const notTitle = md("12.9 Foo Bar is important for therapy.");
t("penanda bukan judul baku tidak dijadikan heading", (notTitle.match(/<h4/g) || []).length === 0 && notTitle.includes("Foo Bar is important"));

// Fitur lama harus tetap jalan.
t("daftar tetap jadi <ul>", /<ul><li>Satu<\/li><li>Dua<\/li><\/ul>/.test(md("- Satu\n- Dua")));
t("tabel tetap didukung", /<table class='fm-tb'>/.test(md("a | b\n1 | 2")));
t("tebal **x** jadi <b>", md("ini **penting** ya").includes("<b>penting</b>"));
t("teks pendek tetap satu paragraf", (md("Halo dunia.").match(/<p>/g) || []).length === 1);
t("HTML di-escape", (() => { const x = md("<script>alert(1)</script>"); return x.includes("&lt;script&gt;") && !x.includes("<script>"); })());
t("baris kosong berlebih diabaikan", !/<p><\/p>/.test(md("a\n\n\n\nb")));

// Teks nyata atorvastatin (openFDA): daftar rujukan silang, subjudul 6.1, tabel angka, enumerasi.
const ATORVA = "The following important adverse reactions are described below and elsewhere in the labeling: Myopathy and Rhabdomyolysis [see Warnings and Precautions (5.1) ] Immune-Mediated Necrotizing Myopathy [see Warnings and Precautions (5.2) ] Hepatic Dysfunction [see Warnings and Precautions (5.3) ] Increases in HbA1c and Fasting Serum Glucose Levels [see Warnings and Precautions (5.4) ] Most common adverse reactions (incidence ≥5%) are nasopharyngitis, arthralgia, diarrhea, pain in extremity, and urinary tract infection ( 6.1 ). To report SUSPECTED ADVERSE REACTIONS, contact Novadoz Pharmaceuticals LLC at 1-855-668-2369 or FDA at 1-800-FDA-1088 or www.fda.gov/medwatch. 6.1 Clinical Trials Experience Because clinical trials are conducted under widely varying conditions, the adverse reaction rates observed in the clinical trials of a drug cannot be directly compared to rates in the clinical trials of another drug and may not reflect the rates observed in practice. Table 1: Adverse Reactions Occurring in ≥ 2% in Patients Treated with any Dose and Greater than Placebo Adverse Reaction % Placebo N=7311 % 10 mg N=3908 % 40 mg N=604 % 80 mg N=4055 Nasopharyngitis 8.2 12.9 7.0 4.2 Arthralgia 6.5 8.9 10.6 4.3 Diarrhea 6.3 7.3 14.1 5.2 Pain in extremity 5.9 8.5 9.3 3.1 Urinary tract infection 5.6 6.9 8.0 4.1 Other adverse reactions reported in placebo-controlled trials include: Body as a whole: malaise, pyrexia Digestive system: abdominal discomfort, eructation Musculoskeletal system: muscle fatigue, neck pain Treating to New Targets Study (TNT) In TNT, [see Clinical Studies (14.1)] 10,001 patients with clinically evident CHD were treated with atorvastatin calcium 10 mg daily.";

const a = md(ATORVA);
t("rujukan silang jadi item daftar", /<ul><li>Myopathy and Rhabdomyolysis <span class='fm-ref'>\[see Warnings and Precautions \(5\.1\) \]<\/span><\/li>/.test(a));
t("empat rujukan silang jadi empat item", (a.match(/\[see Warnings and Precautions \(5\.[1-4]\) \]/g) || []).length === 4 && (a.match(/<li>/g) || []).length >= 4);
t("pengantar rujukan tetap paragraf", /<p>The following important adverse reactions are described below and elsewhere in the labeling:<\/p>/.test(a));
t("subjudul 6.1 dikenali", /<h4 class='fm-h'>6\.1 Clinical Trials Experience<\/h4>/.test(a));
t("tabel angka jadi tabel", /<table class='fm-tb'>/.test(a));
t("keterangan tabel ditampilkan", /<div class='fm-cap'>Table 1: Adverse Reactions Occurring/.test(a));
t("header kolom memuat N", /<th>Placebo <span class='fm-n'>N=7311<\/span><\/th>/.test(a));
t("baris tabel berlabel", /<th scope='row'>Nasopharyngitis<\/th><td>8\.2<\/td><td>12\.9<\/td>/.test(a));
t("enumerasi bersistem jadi daftar", /<li><b>Body as a whole:<\/b> malaise, pyrexia<\/li>/.test(a));
t("judul studi dikenali", /<h5 class='fm-h2'>Treating to New Targets Study \(TNT\)<\/h5>/.test(a));
t("tidak ada paragraf raksasa di teks atorvastatin", (a.match(/<p>[^<]{420,}<\/p>/g) || []).length === 0);
t("HTML mentah di sekitar tabel di-escape", (() => {
  const x = md("Table 1: Data % Placebo N=1 % 5 mg N=2 Alpha 1 2 Beta 3 4 Gamma 5 6 <img src=x>");
  return /<table class='fm-tb'>/.test(x) && !/<img/.test(x) && x.includes("&lt;img");
})());

// Teks indikasi openFDA (butir "•" menempel dalam satu baris) harus jadi daftar rapi, bukan dinding teks.
const IND = "Atorvastatin calcium tablets are indicated: To reduce the risk of: • Myocardial infarction (MI), stroke, revascularization procedures, and angina in adults with multiple risk factors for CHD but without clinically evident CHD (1.1) • MI and stroke in adults with type 2 diabetes mellitus and multiple risk factors for CHD (1.1) As an adjunct to diet to reduce LDL-C in: • Adults with primary hyperlipidemia (1.2) • Pediatric patients aged 10 years and older with heterozygous familial hypercholesterolemia (HeFH) (1.2) Limitations of Use: Atorvastatin calcium tablets have not been studied in conditions where the major abnormality is elevation of chylomicrons (1.3)";
const i = md(IND);
t("butir • jadi item daftar", (i.match(/<li>/g) || []).length === 4);
t("pengantar daftar tetap paragraf", /<p>Atorvastatin calcium tablets are indicated: To reduce the risk of:<\/p><ul>/.test(i) && /<p>As an adjunct to diet to reduce LDL-C in:<\/p><ul>/.test(i));
t("sisa kalimat setelah rujukan (1.2) keluar dari daftar", /<\/ul><p><b>Limitations of Use:<\/b> Atorvastatin/.test(i));
t("rujukan (1.1) diredam, tidak jadi bagian kalimat", /<span class='fm-ref'>\(1\.1\)<\/span><\/li>/.test(i));
t("tidak ada simbol • tersisa", !/\u2022/.test(i));
t("tidak ada paragraf raksasa pada indikasi", (i.match(/<p>[^<]{420,}<\/p>/g) || []).length === 0);

// Lipat teks panjang: bagian awal terlihat, sisanya di <details>; judul tidak menggantung.
const longT = "12.1 Mechanism of Action " + "Statins inhibit HMG-CoA reductase in the liver. ".repeat(10) + "12.3 Pharmacokinetics " + "The drug is absorbed rapidly after oral administration in healthy volunteers. ".repeat(14);
const fd = md.fold(longT);
t("teks panjang dilipat", /<details class='fm-more'>/.test(fd) && /Tampilkan selengkapnya/.test(fd));
t("judul tidak jadi bagian terakhir yang terlihat", !/<h4[^>]*>[^<]*<\/h4><details/.test(fd));
t("teks pendek tidak dilipat", !/<details/.test(md.fold("Teks pendek saja.")));
t("isi tidak hilang saat dilipat", fd.replace(/<[^>]+>/g, "").includes("healthy volunteers"));

// Tabel dosis & rumus (vancomycin): deretan angka berpasangan jadi tabel, rumus jadi pecahan, judul kapital dirapikan.
const VANCO = "DOSAGE TABLE FOR VANCOMYCIN IN PATIENTS WITH IMPAIRED RENAL FUNCTION (Adapted from Moellering et al.\nDOSAGE TABLE FOR VANCOMYCIN IN PATIENTS WITH IMPAIRED RENAL FUNCTION (Adapted from Moellering et al.\n\n1 ) Creatinine Clearance mL/min Vancomycin Dose mg/24 h 100 1,545 90 1,390 80 1,235 70 1,080 60 925 50 770 40 620 30 465 20 310 10 155 The initial dose should be no less than 15 mg/kg, even in patients with mild to moderate renal insufficiency. The table is not valid for functionally anephric patients.     Men: [Weight (kg) x (140 – age in years)] 72 x serum creatinine concentration (mg/dL) Women: 0. 85 x above value The serum creatinine must represent a steady state of renal function. Otherwise, the estimated value for creatinine clearance is not valid.";
const v = md(VANCO);
t("judul tabel dirapikan & tidak terulang", (v.match(/Dosage Table for Vancomycin/g) || []).length === 1 && !/DOSAGE TABLE/.test(v));
t("sumber kutipan diredam di judul", /<span class='fm-ref'>\(Adapted from Moellering et al\. 1\)<\/span>/.test(v));
t("tabel dosis punya header berunit", /<th>Creatinine Clearance \(mL\/min\)<\/th><th>Vancomycin Dose \(mg\/24 h\)<\/th>/.test(v));
t("10 baris tabel dosis", (v.match(/<td>/g) || []).length === 20 && /<td>100<\/td><td>1,545<\/td>/.test(v) && /<td>10<\/td><td>155<\/td>/.test(v));
t("kalimat setelah tabel jadi paragraf", /<\/table><\/div><p>The initial dose should be no less than 15 mg\/kg/.test(v));
t("rumus Men jadi pecahan", /<b>Men:<\/b> <span class='fm-frac'><span>Weight \(kg\) \u00D7 \(140 – age in years\)<\/span><span>72 \u00D7 serum creatinine concentration \(mg\/dL\)<\/span>/.test(v));
t("angka 0. 85 diperbaiki jadi 0.85", /0\.85 \u00D7 above value/.test(v) && !/0\.<\/p>/.test(v));
t("kalimat penutup keluar dari butir rumus", /<\/ul><p>The serum creatinine must represent/.test(v));
// Versi terjemahan (label bahasa Indonesia) tetap rapi
const VANCO_ID = VANCO.replace("Men:", "Pria:").replace("Women:", "Wanita:").replace("The serum creatinine must", "Kreatinin serum harus").replace("above value", "nilai di atas");
const vi = md(VANCO_ID);
t("terjemahan: rumus tetap pecahan & penutup terpisah", /<b>Pria:<\/b> <span class='fm-frac'>/.test(vi) && /<\/ul><p>Kreatinin serum harus/.test(vi));

// Kapitalisasi judul nama obat.
t("nama obat dikapitalisasi", md.cap("metformin") === "Metformin" && md.cap("atorvastatin kalsium") === "Atorvastatin Kalsium");
t("singkatan & angka tidak dirusak", md.cap("HbA1c") === "HbA1c" && md.cap("HMG-CoA reduktase") === "HMG-CoA Reduktase" && md.cap("vitamin B12") === "Vitamin B12");
t("tanda hubung ikut dikapitalisasi", md.cap("co-amoxiclav") === "Co-Amoxiclav");
t("nilai kosong aman", md.cap(null) === "" && md.cap(undefined) === "");

console.log((bad ? "GAGAL " : "") + "PASS teks label — " + ok + " lulus, " + bad + " gagal");
process.exit(bad ? 1 : 0);
