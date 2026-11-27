/* Uji parser format soal baru (pembahasan per pilihan A–E).
   Menjalankan public/run-pdf.js di sandbox minimal lalu memeriksa hasil _parse. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "public", "run-pdf.js");
const code = fs.readFileSync(file, "utf8");

const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = { createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), head: { appendChild() {} }, body: { appendChild() {} } };
sandbox.navigator = { userAgent: "node" };
sandbox.setTimeout = setTimeout;
sandbox.clearTimeout = clearTimeout;
sandbox.Promise = Promise;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const Pdf = sandbox.AsterionPdf;
if (!Pdf || typeof Pdf._parse !== "function") {
  console.error("FAIL: AsterionPdf._parse tidak tersedia");
  process.exit(1);
}

const text = `1. Seorang laki-laki 45 tahun dengan nyeri dada tipikal. Diagnosis paling tepat?
A. Angina pektoris stabil
B. Infark miokard akut anterior
C. Perikarditis akut
D. Diseksi aorta
E. Emboli paru
KUNCI: B
PEMBAHASAN:
Keluhan nyeri dada tipikal dengan ST elevasi V1-V4 mengarah ke infark anterior.
A. Angina stabil tidak memberi elevasi ST menetap.
B. Benar. ST elevasi V1-V4 = dinding anterior (LAD).
C. Perikarditis memberi elevasi difus.
D. Diseksi aorta nyeri robek ke punggung.
E. Emboli paru tanpa elevasi fokal.

2. Obat lini pertama hipertensi pada gagal jantung EF menurun?
A. Hidralazin
B. Verapamil
C. Bisoprolol
D. Klonidin
E. Minoksidil
KUNCI: C
PEMBAHASAN:
Beta-blocker terbukti menurunkan mortalitas pada HFrEF.
A. Hidralazin bukan lini pertama.
B. Verapamil menurunkan kontraktilitas.
C. Benar. Bisoprolol menurunkan mortalitas HFrEF.
D. Klonidin tanpa bukti manfaat mortalitas.
E. Minoksidil memperberat retensi cairan.`;

const L = text.split("\n").map((t) => ({ t, ocr: false }));
const Q = Pdf._parse(L);

const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };

ok(Q.length === 2, `jumlah soal harus 2, dapat ${Q.length}`);
const q1 = Q[0] || {}, q2 = Q[1] || {};

ok(q1.o && q1.o.B === "Infark miokard akut anterior", `q1 pilihan B salah: ${JSON.stringify(q1.o && q1.o.B)}`);
ok(q1.textKey === "B", `q1 kunci harus B, dapat ${q1.textKey}`);
ok(q1.ex && q1.ex.B && /ST elevasi V1-V4/.test(q1.ex.B), `q1 pembahasan per opsi B tidak terbaca: ${JSON.stringify(q1.ex)}`);
ok(q1.ex && q1.ex.A && /Angina stabil/.test(q1.ex.A), "q1 pembahasan per opsi A tidak terbaca");
ok(q1.ex && q1.ex.E && /Emboli paru/.test(q1.ex.E), "q1 pembahasan per opsi E tidak terbaca");
ok(q1.expl && /mengarah ke infark anterior/.test(q1.expl), `q1 pembahasan umum salah: ${JSON.stringify(q1.expl)}`);
ok(!/Benar\. ST elevasi/.test(q1.expl), "q1 pembahasan per opsi bocor ke pembahasan umum");

ok(q2.textKey === "C", `q2 kunci harus C, dapat ${q2.textKey}`);
ok(q2.ex && q2.ex.C && /Bisoprolol/.test(q2.ex.C), "q2 pembahasan per opsi C tidak terbaca");
ok(Object.keys(q2.ex || {}).length === 5, `q2 harus punya 5 pembahasan opsi, dapat ${Object.keys(q2.ex || {}).length}`);
ok(q2.expl && /Beta-blocker/.test(q2.expl), "q2 pembahasan umum tidak terbaca");

/* format lama (tanpa pembahasan per opsi) tetap harus jalan */
const old = Pdf._parse(`1. Soal lama tanpa per opsi?
A. Satu
B. Dua
KUNCI: A
PEMBAHASAN:
Ini pembahasan umum saja, tanpa rincian per pilihan.`.split("\n").map((t) => ({ t, ocr: false })));
ok(old.length === 1, `format lama: soal harus 1, dapat ${old.length}`);
ok(old[0] && old[0].explpl !== undefined ? true : true, "");
ok(old[0] && /pembahasan umum saja/.test(old[0].expl || ""), "format lama: pembahasan umum hilang");
ok(old[0] && Object.keys(old[0].ex || {}).length === 0, "format lama: tidak boleh mengarang pembahasan per opsi");

/* payload impor di run.js harus meneruskan ex */
const runJs = fs.readFileSync(path.join(__dirname, "..", "public", "run.js"), "utf8");
ok(/ex:\s*x\.ex\s*\|\|\s*null/.test(runJs), "run.js: payload impor tidak mengirim field ex");

if (fail.length) {
  console.error("FAIL\n - " + fail.join("\n - "));
  process.exit(1);
}
console.log("PASS: parser format baru — 2 soal, kunci, pembahasan umum & pembahasan per opsi A–E; format lama tetap didukung; payload impor mengirim ex.");
