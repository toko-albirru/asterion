// Uji jalur sinkron/cron. Jalankan server dengan fetch palsu:
//   DATA_DIR=/tmp/ft/data ADMIN_PASSWORD=adm123 PORT=3111 node --import ./scripts/mock-fetch-farmako.mjs server.js &
//   BASE=http://127.0.0.1:3111 ADMIN_PW=adm123 node scripts/test-farmako-sync.mjs
const B = process.env.BASE || "http://127.0.0.1:3111", PW = process.env.ADMIN_PW || "adm123";
if (!/^(https?:\/\/)(127\.0\.0\.1|localhost)/.test(B)) { console.error("Hanya server lokal."); process.exit(2); }
let ok = 0, bad = 0; const t = (c, m) => { c ? ok++ : (bad++, console.log("✗", m)); };
const post = async (tok, p, b) => { const r = await fetch(B + "/api/" + p, { method: b !== undefined ? "POST" : "GET", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: b !== undefined ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json() }; };
const lg = async (u, p) => (await (await fetch(B + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ u, p }) })).json()).token;
const A = await lg("admin", PW), F = (p, b) => post(A, "farmako/" + p, b);
let S = await lg("G0025003", "G0025003"); await post(S, "changepw", { np: "rahasia123" }); S = await lg("G0025003", "rahasia123");

// daftar nama → entri draft (nama saja)
let r = await F("admin/seed-names", { names: ["ZZ-UJI Alfa", "ZZ-UJI Beta", "ZZ-UJI Gamma", "ZZ-UJI Delta", "ZZ-UJI Alfa"] }); t(r.j.nin === 4, "seed 4 nama (duplikat dalam daftar diabaikan): " + JSON.stringify(r.j));
r = await F("admin/seed-names", { names: ["zz-uji alfa"] }); t(r.j.nin === 0 && r.j.nskip === 1, "seed ulang beda huruf besar tidak menggandakan");
const d = (await F("admin/drugs?q=zz-uji")).j.rows, id = (n) => d.find((x) => x.generic.endsWith(n)).id;
t(d.length === 4 && d.every((x) => x.status === "draft"), "4 obat draft");
t((await post(S, "farmako/home")).j.counts.drugs === 0, "entri nama saja tidak tampil ke mahasiswa");

// uji koneksi (tanpa menulis apa pun)
for (const s of ["pubchem", "rxnorm", "chembl", "openfda"]) { r = await F("admin/test-source", { src: s }); t(r.j.ok === true, "uji koneksi " + s + ": " + JSON.stringify(r.j)); }
r = await F("admin/test-source", { src: "drugbank" }); t(r.j.ok === false, "drugbank: tidak ada sinkron langsung");
t((await F("admin/drugs?q=aspirin")).j.total === 0, "uji koneksi tidak membuat data");
t((await post(S, "farmako/admin/test-source", {})).s === 403, "mahasiswa tidak boleh uji koneksi");

// openFDA
r = await F("admin/sync", { src: "openfda", ids: [id("Alfa"), id("Beta"), id("Gamma"), id("Delta")] }); t(r.j.ok === 1 && r.j.miss === 2 && r.j.fail === 1, "openfda: 1 ok, 2 tidak ditemukan (kombinasi & 404), 1 gagal: " + JSON.stringify(r.j));
let e = (await F("admin/drug/" + id("Alfa"))).j; const fv = (f, s) => (e.facts.find((x) => x.field === f && x.src === s) || {}).value;
t(fv("indications", "openfda") === "Obat ini diindikasikan untuk uji.", "judul 'INDICATIONS AND USAGE' dibuang, isi utuh: " + fv("indications", "openfda"));
t(fv("contraindications", "openfda") === "Kontra uji." && fv("interactions", "openfda") === "Interaksi uji." && fv("routes", "openfda") === "ORAL", "bidang label terpetakan");
t(e.xref.some((x) => x.src === "openfda" && x.sid === "SET-ZZUJIALFA"), "label bahan tunggal terpilih (bukan garam/kombinasi)");
t(e.drug.pharm_class === "Kelas Uji", "golongan farmakologis dari label (tanpa [EPC])");
t(e.cats.some((c) => c.kind === "pharm_class" && c.name === "Kelas Uji") && e.cats.some((c) => c.kind === "moa" && c.name === "Penghambat Uji"), "kategori dibentuk dari data label");
t(e.names.some((n) => n.name === "MerkOF" && n.kind === "brand"), "nama dagang dari label");
// ChEMBL
r = await F("admin/sync", { src: "chembl", ids: [id("Alfa"), id("Gamma")] }); t(r.j.ok === 1 && r.j.miss === 1, "chembl: 1 ok, 1 tidak ditemukan: " + JSON.stringify(r.j));
e = (await F("admin/drug/" + id("Alfa"))).j;
t(fv("moa", "chembl") === "Inhibitor uji" && fv("targets", "chembl") === "Enzim Uji (Homo sapiens)", "moa & target ChEMBL");
t(e.names.some((n) => n.name === "SinChembl") && !e.names.some((n) => n.name === "CHEMBL999"), "sinonim bersih");
t(e.cats.some((c) => c.kind === "target" && c.name === "Enzim Uji"), "kategori target dari data");
t(e.facts.filter((x) => x.field === "moa").length === 1, "fakta per sumber terpisah (moa hanya dari chembl; openFDA tak punya)");
// terbit → pembaruan tertunda, bukan menimpa
await F("admin/status", { ent: "drug", ids: [id("Alfa")], to: "published" });
let pr = (await post(S, "farmako/drug/" + id("Alfa"))).j; t(pr.facts.some((f) => f.field === "indications" && f.src === "openfda"), "mahasiswa melihat fakta bersumber openfda & chembl");
t(pr.facts.some((f) => f.src === "chembl") && pr.xref.length >= 2, "xref per sumber tampil");

// cron
r = await F("admin/cron-run", {}); t(r.j.ran === 0, "cron tanpa sumber otomatis = tidak melakukan apa pun");
await F("admin/auto", { src: "chembl", on: true }); await F("admin/auto", { batch: 1, days: 30 });
r = await F("admin/cron-run", {}); t(r.j.ran === 1 && r.j.out[0].src === "chembl", "cron: batch 1 per sumber: " + JSON.stringify(r.j));
const first = r.j.out[0].id; r = await F("admin/cron-run", {}); t(r.j.ran === 1 && r.j.out[0].id !== first, "putaran berikut memilih obat lain (yang belum disinkron)");
await F("admin/cron-run", {}); await F("admin/cron-run", {}); r = await F("admin/cron-run", {}); t(r.j.ran === 0, "semua segar → cron tidak mengulang");
const st = (await F("admin/stats")).j; const cs = st.sources.find((s) => s.code === "chembl"); t(cs.auto === true && cs.can_sync && cs.synced === 4, "statistik sumber: otomatis & 4 tersinkron: " + JSON.stringify(cs));
t(st.cron.batch === 1 && st.cron.days === 30, "pengaturan cron tersimpan");
t(!st.sources.find((s) => s.code === "drugbank").can_sync, "drugbank tidak punya sinkron langsung");
r = await F("admin/auto", { src: "drugbank", on: true }); t(r.s === 400, "tidak bisa mengaktifkan otomatis untuk sumber berkas");
await F("admin/sources", { code: "chembl", enabled: false, note: "" }); await F("admin/auto", { src: "openfda", on: true });
r = await F("admin/cron-run", {}); t(r.j.out.every((o) => o.src !== "chembl"), "sumber yang dinonaktifkan dilewati cron");
const log = (await F("admin/log")).j; t(log.sync.some((x) => x.act === "sinkron terjadwal"), "log 'sinkron terjadwal' tercatat");
console.log(`${ok} lulus, ${bad} gagal`); process.exit(bad ? 1 : 0);
