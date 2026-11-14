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

console.log((bad ? "GAGAL " : "") + "PASS teks label — " + ok + " lulus, " + bad + " gagal");
process.exit(bad ? 1 : 0);
