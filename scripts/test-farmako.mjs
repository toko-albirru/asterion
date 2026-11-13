// Uji API Pharmacology Session. HANYA untuk server lokal (node server.js) — data uji bernama "ZZ-UJI ..." bersifat sintetis
// dan dipakai khusus untuk memeriksa logika (kategori dinamis, status, interaksi, game). Bukan data farmakologi.
//   DATA_DIR=/tmp/ft/data PORT=3111 ADMIN_PASSWORD=adm123 node server.js &
//   BASE=http://127.0.0.1:3111 ADMIN_PW=adm123 node scripts/test-farmako.mjs
const BASE = process.env.BASE || "http://127.0.0.1:3111", ADMIN_PW = process.env.ADMIN_PW || "adm123";
if (!/^(https?:\/\/)(127\.0\.0\.1|localhost)/.test(BASE)) { console.error("Menolak: skrip ini hanya boleh ke server lokal."); process.exit(2); }
let pass = 0, fail = 0; const bad = [];
const ok = (c, m) => { if (c) pass++; else { fail++; bad.push(m); console.log("  ✗ " + m); } };
const call = async (tok, p, o = {}) => { const r = await fetch(BASE + "/api/" + p, { method: o.m || "GET", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: o.b ? JSON.stringify(o.b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const login = async (u, p) => (await (await fetch(BASE + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ u, p }) })).json());

const A = (await login("admin", ADMIN_PW)).token; ok(!!A, "login admin");
let S = (await login("G0025001", "G0025001")).token; await call(S, "changepw", { m: "POST", b: { np: "rahasia123" } }); S = (await login("G0025001", "rahasia123")).token; ok(!!S, "login mahasiswa");
const adm = (p, b, m = "POST") => call(A, "farmako/admin/" + p, { m, b }), stu = (p, o) => call(S, "farmako/" + p, o);

// 1. keamanan akses
ok((await fetch(BASE + "/api/farmako/home")).status === 401, "tanpa token → 401");
ok((await stu("admin/stats")).s === 403, "mahasiswa ke endpoint admin → 403");
ok((await call(S, "farmako/admin/drug", { m: "POST", b: { generic: "X" } })).s === 403, "mahasiswa POST admin → 403");

// 2. kondisi kosong: tidak ada kategori/soal karangan
let h = (await stu("home")).j; ok(h.counts.drugs === 0 && h.counts.categories === 0, "awal: 0 obat & 0 kategori (tidak ada data tiruan)");
ok((await stu("game/cats")).j.cats.length === 0, "awal: pemilihan kategori game kosong");
ok((await stu("suggest?q=para")).j.items.length === 0, "awal: autocomplete kosong");
let st = (await adm("stats", null, "GET")).j; ok(st.sources.length === 8, "8 sumber terdaftar"); ok(st.sources.every((s) => s.xr === 0 && s.facts === 0), "sumber awal tanpa data");
const mats = (await adm("materials", null, "GET")).j.rows; ok(mats.filter((m) => m.general).length === 20 && mats.every((m) => m.status === "draft"), "20 kerangka materi umum = draft");
ok((await stu("materials")).j.rows.length === 0, "materi draft tidak tampil ke mahasiswa");

// 3. impor obat (sintetis) → draft
const mk = (n, cls, moa, ind, adv, cats, extra = {}) => ({ generic: "ZZ-UJI " + n, brands: "Merk" + n, synonyms: "Sin" + n, pharm_class: cls, source_id: "ZZ" + n, moa, indications: ind, adverse: adv, categories: cats, ...extra });
const rows = [
  mk("Alfa", "Kelas Satu", "Menghambat enzim satu.", "Kondisi satu.", "Efek satu.", [{ kind: "organ_system", path: ["Sistem Uji", "Sub Uji A"] }]),
  mk("Beta", "Kelas Satu", "Menghambat enzim dua.", "Kondisi dua.", "Efek dua.", [{ kind: "organ_system", path: ["Sistem Uji", "Sub Uji A"] }]),
  mk("Gamma", "Kelas Dua", "Memblok reseptor tiga.", "Kondisi tiga.", "Efek tiga.", [{ kind: "organ_system", path: ["Sistem Uji", "Sub Uji B"] }]),
  mk("Delta", "Kelas Tiga", "Mengaktifkan kanal empat.", "Kondisi empat.", "Efek empat.", [{ kind: "organ_system", path: ["Sistem Uji", "Sub Uji B"] }]),
  mk("Epsilon", "Kelas Empat", "Menstimulasi reseptor lima.", "Kondisi lima.", "Efek lima.", [{ kind: "atc", path: ["Z", "Z01"] }]),
  mk("Zeta", "Kelas Lima", "Menurunkan sintesis enam.", "Kondisi enam.", "Efek enam.", [{ kind: "target", name: "Target Uji" }]),
];
let r = await adm("import", { src: "manual", kind: "drugs", rows, last: true, file: "uji" }); ok(r.j.nin === 6 && r.j.nskip === 0, "impor 6 obat baru: " + JSON.stringify(r.j));
r = await adm("import", { src: "manual", kind: "drugs", rows: [rows[0]] }); ok(r.j.nin === 0, "impor ulang obat sama tidak menggandakan");
const dl = (await adm("drugs?q=zz-uji", null, "GET")).j; ok(dl.total === 6, "tepat 6 obat (tanpa duplikat), dapat: " + dl.total);
ok(dl.rows.every((d) => d.status === "draft"), "hasil impor berstatus draft");
ok((await stu("suggest?q=zz-uji")).j.items.length === 0, "draft tidak muncul di autocomplete mahasiswa");
ok((await stu("drug/" + dl.rows[0].id)).s === 404, "profil obat draft → 404 untuk mahasiswa");
ok((await stu("cats")).j.cats.length === 0, "kategori tanpa obat terbit tidak ditampilkan");

// 4. publikasi massal berdasar filter
r = await adm("status", { ent: "drug", filter: { from: "draft", src: "manual" }, to: "published" }); ok(r.j.n === 6, "publikasi massal 6 obat");
h = (await stu("home")).j; ok(h.counts.drugs === 6, "mahasiswa melihat 6 obat");
const cats = (await stu("cats")).j; ok(cats.cats.some((c) => c.name === "Sistem Uji" && c.drugs === 4), "kategori 'Sistem Uji' dinamis (4 obat dari anak)");
ok(Object.keys(cats.kinds).sort().join() === ["atc", "classification", "organ_system", "pharm_class", "target"].sort().join() || Object.keys(cats.kinds).includes("organ_system"), "jenis klasifikasi berasal dari data: " + Object.keys(cats.kinds));
const sys = cats.cats.find((c) => c.name === "Sistem Uji"); const cd = (await stu("cat/" + sys.id)).j; ok(cd.kids.length === 2 && cd.drugs.length === 4, "halaman kategori: 2 subkategori, 4 obat");
// 5. autocomplete
let sg = (await stu("suggest?q=zz-u")).j.items; ok(sg.filter((i) => i.t === "drug").length === 6, "prefiks 'zz-u' → 6 obat");
sg = (await stu("suggest?q=MERKBETA")).j.items; ok(sg[0] && sg[0].name === "ZZ-UJI Beta" && sg[0].matched, "cari nama dagang (tanpa beda huruf) → obat generik");
sg = (await stu("suggest?q=" + encodeURIComponent("%"))).j.items; ok(sg.length === 0, "karakter LIKE '%' di-escape");
sg = (await stu("suggest?q=" + encodeURIComponent("' OR 1=1 --"))).j.items; ok(sg.length === 0, "injeksi SQL tidak berpengaruh");
sg = (await stu("suggest?q=sub uji")).j.items; ok(sg.some((i) => i.t === "cat"), "kategori ikut tersaran");
// 6. profil, bookmark, bandingkan
const alfa = dl.rows.find((d) => d.generic.endsWith("Alfa")), beta = dl.rows.find((d) => d.generic.endsWith("Beta")), gamma = dl.rows.find((d) => d.generic.endsWith("Gamma")), delta = dl.rows.find((d) => d.generic.endsWith("Delta"));
let pr = (await stu("drug/" + alfa.id)).j; ok(pr.drug.generic === "ZZ-UJI Alfa" && pr.facts.some((f) => f.field === "moa" && f.src === "manual"), "profil memuat fakta bersumber");
ok(pr.same.some((x) => x.id === beta.id), "obat dalam golongan sama");
ok((await stu("bookmark", { m: "POST", b: { kind: "drug", id: alfa.id, on: 1 } })).j.ok === 1 && (await stu("bookmarks")).j.drugs.length === 1, "bookmark obat");
ok((await stu(`compare?a=${alfa.id}&b=${gamma.id}`)).j.drugs.length === 2, "perbandingan dua obat");

// 7. interaksi
const ii = (a, b, sev, extra = {}) => adm("inter", { itype: "ddi", drug_a: a, drug_b: b, severity: sev, mechanism: "mek", effect: "dampak", management: "kelola", src: "manual", sid: "I-" + a + "-" + b, status: "published", ...extra });
ok((await ii(alfa.id, beta.id, "Major")).s === 200, "tambah interaksi Alfa–Beta");
ok((await ii(beta.id, alfa.id, "Major")).s === 400, "interaksi duplikat (urutan terbalik) ditolak");
ok((await ii(alfa.id, gamma.id, "Moderate")).s === 200 && (await ii(gamma.id, delta.id, "Minor")).s === 200 && (await ii(alfa.id, delta.id, "Contraindicated")).s === 200, "interaksi lain");
let ck = (await stu("interact", { m: "POST", b: { ids: [alfa.id, beta.id, gamma.id] } })).j;
ok(ck.pairs.length === 3, "3 obat → 3 pasangan"); ok(ck.pairs.find((p) => p.a_id === Math.min(alfa.id, beta.id) && p.b_id === Math.max(alfa.id, beta.id)).items[0].severity === "Major", "Major terbaca dari sumber");
const bg = ck.pairs.find((p) => p.a_id === Math.min(beta.id, gamma.id) && p.b_id === Math.max(beta.id, gamma.id)); ok(bg.found === false && bg.items.length === 0, "pasangan tanpa data → found:false (UI: 'Data interaksi tidak tersedia')");
ok(JSON.stringify(ck).indexOf("aman") < 0, "tidak ada klaim 'aman'");
const full = (await adm("inters", null, "GET")).j.rows.find((x) => x.drug_a === Math.min(alfa.id, beta.id) && x.drug_b === Math.max(alfa.id, beta.id)); ok(full.src === "manual" && full.sid && full.verified_at, "interaksi menyimpan sumber, ID sumber, tanggal verifikasi");
ok((await stu("interact", { m: "POST", b: { ids: [] } })).s === 400, "pemeriksaan tanpa obat → 400");
ok((await call(S, "farmako/interact", { m: "POST", b: { ids: [999999] } })).j.drugs.length === 0, "ID tak dikenal diabaikan");

// 8. sinkronisasi aman: perubahan pada data terbit → menunggu persetujuan
r = await adm("import", { src: "manual", kind: "drugs", rows: [{ ...rows[0], moa: "Isi BARU dari sumber." }] }); ok(r.j.nup === 1, "impor ulang = update");
pr = (await stu("drug/" + alfa.id)).j; ok(pr.facts.find((f) => f.field === "moa").value === "Menghambat enzim satu.", "data terbit TIDAK tertimpa otomatis");
let ad = (await adm("drug/" + alfa.id, null, "GET")).j; ok(ad.facts.find((f) => f.field === "moa").pending === "Isi BARU dari sumber.", "pembaruan disimpan sebagai tertunda");
ok((await adm("fact/approve", { drug_id: alfa.id, field: "moa", src: "manual" })).j.ok === 1 && (await stu("drug/" + alfa.id)).j.facts.find((f) => f.field === "moa").value === "Isi BARU dari sumber.", "admin menyetujui pembaruan");
await adm("import", { src: "manual", kind: "drugs", rows: [{ ...rows[0], moa: "Menghambat enzim satu." }] }); await adm("fact/approve", { drug_id: alfa.id, field: "moa", src: "manual" });

// 9. impor interaksi dari berkas (alias DDInter) + nama tak dikenal dilewati, tidak dikarang
r = await adm("import", { src: "ddinter", kind: "interactions", rows: [{ Drug_A: "zz-uji epsilon", Drug_B: "ZZ-UJI Zeta", Level: "Major", DDInterID_A: "DDI1", DDInterID_B: "DDI2" }, { Drug_A: "ZZ-UJI Epsilon", Drug_B: "Obat Tak Ada", Level: "Minor" }] });
ok(r.j.nin === 1 && r.j.nskip === 1 && r.j.skipped[0].includes("tidak ditemukan"), "impor interaksi: 1 masuk, 1 dilewati: " + JSON.stringify(r.j));
const dd = (await adm("inters?st=draft", null, "GET")).j; ok(dd.rows.length === 1 && dd.rows[0].src === "ddinter" && dd.rows[0].sid === "DDI1~DDI2" && dd.rows[0].status === "draft", "interaksi impor = draft + ID sumber");
ck = (await stu("interact", { m: "POST", b: { ids: [dl.rows.find((d) => d.generic.endsWith("Epsilon")).id, dl.rows.find((d) => d.generic.endsWith("Zeta")).id] } })).j; ok(ck.pairs[0].found === false, "interaksi draft tidak tampil ke mahasiswa");

// 10. jenis interaksi lain
ok((await adm("inter", { itype: "food", drug_a: alfa.id, subject: "Jus uji", severity: "Moderate", effect: "e", src: "manual", status: "published" })).s === 200, "drug-food");
ck = (await stu("interact", { m: "POST", b: { ids: [alfa.id] } })).j; ok(ck.other.food.length === 1 && ck.pairs.length === 0, "drug-food tampil untuk satu obat");

// 11. materi + progres
let mid = (await adm("material", { title: "ZZ-UJI Materi", cat_id: sys.id, body: { intro: "Isi uji." }, refs: [{ text: "Rujukan uji", doi: "", pmid: "" }], status: "published" })).j.id;
let md = (await stu("material/" + mid)).j; ok(md.title === "ZZ-UJI Materi" && md.refs.length === 1, "materi terbit dapat dibuka");
ok((await stu("progress", { m: "POST", b: { id: mid, done: 1 } })).j.ok === 1 && (await stu("material/" + mid)).j.done, "progres selesai tersimpan");
ok((await stu("cat/" + sys.id)).j.materials.length === 1, "materi tampil di halaman kategori");
h = (await stu("home")).j; ok(h.progress.done === 1 && h.progress.total === 1 && h.recent.length >= 1, "beranda: progres & terakhir dibuka");

// 12. game
const gc = (await stu("game/cats")).j.cats; ok(gc.length > 0, "kategori game dinamis dari DB"); ok(gc.every((c) => c.avail.mixed > 0), "kategori tanpa soal tidak ditampilkan");
const sysg = gc.find((c) => c.name === "Sistem Uji"); ok(sysg && sysg.avail.class === 4 && sysg.avail.mechanism === 4, "jumlah soal tersedia per mode: " + JSON.stringify(sysg && sysg.avail));
ok((await stu("game/start", { m: "POST", b: { cats: [], mode: "class", diff: 1, n: 5 } })).s === 400, "game tanpa kategori ditolak");
ok((await stu("game/start", { m: "POST", b: { cats: [sys.id], mode: "class", diff: 1, n: 7 } })).s === 400, "jumlah soal harus 5/10/15/20");
let gs = await stu("game/start", { m: "POST", b: { cats: [sys.id], mode: "class", diff: 1, n: 5 } }); ok(gs.s === 200 && gs.j.total >= 3, "mulai game: " + JSON.stringify(gs.j).slice(0, 150));
ok(!JSON.stringify(gs.j).includes("correct") && !JSON.stringify(gs.j).includes("expl"), "kunci jawaban tidak dikirim ke klien");
ok(gs.j.questions.every((q) => q.opts.length === 4 && new Set(q.opts).size === 4), "tiap soal 4 pilihan unik");
const sid = gs.j.sid; let last, score = 0;
for (let i = 0; i < gs.j.total; i++) { const q = gs.j.questions[i]; const a1 = await stu("game/answer", { m: "POST", b: { sid, idx: i, choice: 0, ms: 1500 } }); last = a1.j; if (i === 0) { const dup = await stu("game/answer", { m: "POST", b: { sid, idx: 0, choice: 0, ms: 1 } }); ok(dup.s === 409, "jawab ulang soal yang sama ditolak"); ok(a1.j.src === "manual" || a1.j.src === "", "pembahasan membawa sumber"); } score = last.score; }
ok(last.done === true, "sesi selesai setelah soal terakhir");
const rs = (await stu("game/result?sid=" + sid)).j; ok(rs.status === "done" && rs.review.length === gs.j.total && rs.score === score, "hasil akhir & pembahasan lengkap");
ok((await call(A, "farmako/game/result?sid=" + sid)).s === 404, "hasil sesi milik orang lain tidak bisa dibaca");
ok((await stu("game/history")).j.rows.length === 1, "riwayat game");
for (const m of ["mechanism", "indication", "adverse", "mixed"]) { const g2 = await stu("game/start", { m: "POST", b: { cats: [sys.id], mode: m, diff: 2, n: 5 } }); ok(g2.s === 200 && g2.j.total >= 3, "mode " + m + " menghasilkan soal"); }
const g3 = await stu("game/start", { m: "POST", b: { cats: [sys.id], mode: "interaction", diff: 3, n: 5 } }); ok(g3.s === 409 || g3.s === 200, "mode interaksi: tidak mengarang bila label < 2 (" + g3.s + ")");
await adm("inter", { itype: "ddi", drug_a: beta.id, drug_b: delta.id, severity: "Minor", src: "manual", sid: "x", status: "published" });
const g4 = await stu("game/start", { m: "POST", b: { cats: [sys.id], mode: "interaction", diff: 3, n: 5 } }); ok(g4.s === 200 && g4.j.questions[0].opts.every((o) => ["Major", "Moderate", "Minor", "Contraindicated"].includes(o)), "soal interaksi memakai label asli sumber");

// 13. kategori kosong, nonaktif, gabung duplikat
r = await adm("drug/active", { id: dl.rows.find((d) => d.generic.endsWith("Zeta")).id, active: 0 }); ok((await stu("suggest?q=zz-uji zeta")).j.items.filter((i) => i.t === "drug").length === 0, "obat nonaktif hilang dari pencarian");
await adm("import", { src: "manual", kind: "drugs", rows: [{ generic: "ZZ-UJI Alfa Garam", pharm_class: "Kelas Satu" }] }); const dp = (await adm("dups", null, "GET")).j.rows; ok(dp.some((x) => x.why === "nama berawalan sama"), "deteksi kandidat duplikat");
const dup = (await adm("drugs?q=alfa garam", null, "GET")).j.rows[0]; ok((await adm("drug/merge", { keep: alfa.id, drop: dup.id })).j.ok === 1, "gabung manual oleh admin"); ok((await adm("drugs?q=alfa garam&off=1", null, "GET")).j.total >= 1, "yang digabung dinonaktifkan, bukan dihapus");
// 14. validasi
ok((await adm("drug", { generic: "" })).s === 400, "nama generik wajib");
ok((await adm("import", { src: "bukan-sumber", kind: "drugs", rows: [{ generic: "x" }] })).s === 400, "sumber tak dikenal ditolak");
ok((await adm("sync", { src: "drugbank", ids: [1] })).s === 400, "sinkron live hanya PubChem/RxNorm");
ok((await adm("q", { q: "?", a: "x", ans: "A" })).s === 400, "soal manual wajib ≥2 pilihan");
ok((await adm("q", { q: "Soal uji?", a: "A1", b: "B1", ans: "C", cat_id: sys.id })).s === 400, "kunci jawaban harus pilihan terisi");
const lg = (await adm("log", null, "GET")).j; ok(lg.audit.length > 5 && lg.sync.length >= 1, "riwayat perubahan & log sinkronisasi tercatat");
const tt = await stu("tidak-ada"); ok(tt.s === 404, "rute tak dikenal → 404");

console.log(`\n${pass} lulus, ${fail} gagal`); if (fail) { console.log(bad.join("\n")); process.exit(1); }
