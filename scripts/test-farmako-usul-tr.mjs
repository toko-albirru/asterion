// Uji usulan obat dari pengguna + terjemahan Indonesia. Server dengan fetch palsu dan penyedia LibreTranslate palsu:
//   LIBRETRANSLATE_URL=http://libre.test/translate TR_DAILY_MAX=6 DATA_DIR=/tmp/ft/data ADMIN_PASSWORD=adm123 PORT=3111 node --import ./scripts/mock-fetch-farmako.mjs server.js
const B = process.env.BASE || "http://127.0.0.1:3111", PW = process.env.ADMIN_PW || "adm123";
if (!/^(https?:\/\/)(127\.0\.0\.1|localhost)/.test(B)) { console.error("Hanya server lokal."); process.exit(2); }
let ok = 0, bad = 0; const t = (c, m) => { c ? ok++ : (bad++, console.log("âœ—", m)); };
const post = async (tok, p, b) => { const r = await fetch(B + "/api/" + p, { method: b !== undefined ? "POST" : "GET", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: b !== undefined ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json() }; };
const lg = async (u, p) => (await (await fetch(B + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ u, p }) })).json()).token;
const A = await lg("admin", PW), F = (p, b) => post(A, "farmako/" + p, b);
const mk = async (id) => { let k = await lg(id, id); await post(k, "changepw", { np: "rahasia123" }); return lg(id, "rahasia123"); };
const S1 = await mk("G0025011"), S2 = await mk("G0025012"), s1 = (p, b) => post(S1, "farmako/" + p, b), s2 = (p, b) => post(S2, "farmako/" + p, b);

// ===== usulan obat =====
let r = await s1("usul", { name: "" }); t(r.s === 400, "nama kosong ditolak");
r = await s1("usul", { name: "<script>alert(1)</script>" }); t(r.s === 400, "nama berisi tag ditolak");
r = await s1("usul", { name: "x".repeat(101) }); t(r.s === 400 || (r.j.ok === undefined), "nama terlalu panjang ditolak");
r = await s1("usul", { name: "ZZ-UJI Usul Satu", brands: "MerkU", note: "dari PBL" }); t(r.j.ok === 1, "usulan terkirim: " + JSON.stringify(r.j));
r = await s1("usul", { name: "zz-uji usul satu" }); t(r.j.dup === true && r.j.mine === true, "usulan ganda (beda huruf) ditolak: milik sendiri");
r = await s2("usul", { name: "ZZ-UJI Usul Satu" }); t(r.j.dup === true && r.j.mine === false, "usulan ganda oleh user lain dikenali");
t((await F("admin/drugs?q=zz-uji usul")).j.total === 0, "usulan TIDAK langsung membuat obat");
t((await s1("home")).j.counts.drugs === 0, "usulan tidak tampil di Pustaka");
for (const n of ["B", "C", "D", "E"]) await s1("usul", { name: "ZZ-UJI Usul " + n });
r = await s1("usul", { name: "ZZ-UJI Usul F" }); t(r.s === 429, "batas 5 usulan belum diproses per user");
t((await s1("usul/saya")).j.rows.length === 5 && (await s2("usul/saya")).j.rows.length === 0, "daftar usulan saya hanya milik sendiri");
t((await s1("admin/usul")).s === 403 && (await s1("admin/usul/decide", { ids: [1], act: "approve" })).s === 403, "murid tidak boleh melihat/memutuskan usulan");
let q = (await F("admin/usul?st=pending")).j; t(q.rows.length === 5 && q.counts.pending === 5, "admin melihat 5 usulan menunggu");
t((await F("admin/stats")).j.other.usul === 5, "ringkasan menghitung usulan");
const u1 = q.rows.find((x) => x.name === "ZZ-UJI Usul Satu"), u2 = q.rows.find((x) => x.name.endsWith("Usul B"));
r = await F("admin/usul/decide", { ids: [u1.id], act: "approve", note: "ok" }); t(r.j.n === 1, "setujui 1 usulan");
const dr = (await F("admin/drugs?q=zz-uji usul satu")).j; t(dr.total === 1 && dr.rows[0].status === "draft", "disetujui â†’ obat Draft berisi nama saja");
const ds = (await F("admin/drug/" + dr.rows[0].id)).j; t(ds.names.some((n) => n.name === "MerkU" && n.kind === "brand") && ds.facts.length === 0, "nama dagang ikut; tak ada fakta karangan");
t((await s1("home")).j.counts.drugs === 0, "obat Draft belum tampil ke pengguna");
r = await F("admin/usul/decide", { ids: [u2.id], act: "reject", note: "bukan nama generik" }); t(r.j.n === 1, "tolak 1 usulan");
const mine = (await s1("usul/saya")).j.rows; t(mine.find((x) => x.id === u1.id).status === "approved" && mine.find((x) => x.id === u2.id).admin_note === "bukan nama generik", "pengusul melihat status & catatan admin");
r = await F("admin/usul/decide", { ids: [u1.id], act: "reject" }); t((await F("admin/usul?st=approved")).j.rows.length === 1, "usulan yang sudah diputuskan tidak bisa diubah ulang");
r = await s1("usul", { name: "ZZ-UJI Usul Satu" }); t(r.j.exists === true && r.j.published === false, "nama yang sudah jadi obat Draft: 'sedang diproses'");
await F("admin/status", { ent: "drug", ids: [dr.rows[0].id], to: "published" });
r = await s2("usul", { name: "MerkU" }); t(r.j.exists === true && r.j.published === true && r.j.id === dr.rows[0].id, "nama dagang yang sudah ada dikenali & tertaut");
r = await F("admin/usul/decide", { ids: q.rows.map((x) => x.id), act: "approve" }); t(r.j.n === 3, "setujui sisa (yang pending) sekaligus: " + r.j.n);
r = await F("admin/usul/decide", { ids: [u2.id], act: "delete" }); t(r.j.n === 1, "hapus usulan");

// ===== terjemahan =====
const did = dr.rows[0].id;
await F("admin/drug", { id: did, generic: "ZZ-UJI Usul Satu", src: "manual", facts: { indications: "This drug is indicated for the treatment of fever. It may cause nausea in some patients.", adverse: "Obat ini dapat menyebabkan mual dan pusing pada pasien yang sensitif.", moa: "Inhibits enzyme X.\n\nIt is metabolized by the liver and excreted in urine." } });
let dd = (await s1("drug/" + did)).j; const fid = (f) => dd.facts.find((x) => x.field === f).id;
let g = (await s1("tr/get", { items: [{ ent: "fact", ref: fid("indications") }, { ent: "fact", ref: fid("adverse") }] })).j;
t(g.provider === true && g.need.length === 1 && g.need[0] === "fact:" + fid("indications") + ":value", "teks Inggris butuh terjemahan");
t(g.map["fact:" + fid("adverse") + ":value"].status === "id", "teks yang sudah berbahasa Indonesia ditandai 'id' (tidak diterjemahkan)");
r = await s1("tr/do", { ent: "fact", ref: fid("indications") }); t(r.s === 200 && r.j.status === "auto" && r.j.text.startsWith("[ID#"), "terjemahkan: " + JSON.stringify(r.j).slice(0, 120));
const first = r.j.text; r = await s1("tr/do", { ent: "fact", ref: fid("indications") }); t(r.j.cached === true && r.j.text === first, "hasil di-cache (tidak memanggil mesin lagi)");
g = (await s1("tr/get", { items: [{ ent: "fact", ref: fid("indications") }] })).j; t(g.map["fact:" + fid("indications") + ":value"].text === first && g.need.length === 0, "tr/get mengembalikan terjemahan tersimpan");
r = await s1("tr/do", { ent: "fact", ref: fid("moa") }); t((r.j.text.match(/\[ID#/g) || []).length >= 2 && r.j.text.includes("\n\n"), "teks multi-paragraf dipotong & disambung (paragraf dipertahankan)");
r = await s1("tr/do", { ent: "fact", ref: fid("adverse") }); t(r.j.status === "id", "do pada teks Indonesia â†’ 'id'");
t((await s1("tr/do", { ent: "fact", ref: 999999 })).s === 404, "teks tak ada â†’ 404");
t((await s1("tr/do", { ent: "inter", ref: 1, field: "bukan" })).s === 400, "bidang interaksi tak valid â†’ 400");
// teks asli berubah â†’ terjemahan lama tidak dipakai
await F("admin/drug", { id: did, generic: "ZZ-UJI Usul Satu", src: "manual", facts: { indications: "Changed text: used for headache." } });
g = (await s1("tr/get", { items: [{ ent: "fact", ref: fid("indications") }] })).j; t(g.need.length === 1 && !g.map["fact:" + fid("indications") + ":value"], "terjemahan usang tidak ditampilkan; minta ulang");
// draft tidak bisa diterjemahkan oleh murid
await F("admin/drug", { generic: "ZZ-UJI Draft Tr", src: "manual", facts: { moa: "Draft only text here for testing." } });
const dd2 = (await F("admin/drugs?q=zz-uji draft tr")).j.rows[0], fa = (await F("admin/drug/" + dd2.id)).j.facts[0];
t((await s1("tr/do", { ent: "fact", ref: fa.id })).s === 404, "fakta obat Draft tidak bisa diterjemahkan murid");
r = await F("admin/tr/do", { ent: "fact", ref: fa.id }); t(r.s === 200 && r.j.status === "auto", "admin boleh menerjemahkan Draft");
// verifikasi admin
r = await F("admin/tr/save", { ent: "fact", ref: fid("moa"), text: "Menghambat enzim X." }); t(r.j.ok === 1, "admin simpan terjemahan");
g = (await s1("tr/get", { items: [{ ent: "fact", ref: fid("moa") }] })).j.map["fact:" + fid("moa") + ":value"]; t(g.status === "verified" && g.text === "Menghambat enzim X.", "status 'terverifikasi' & teks hasil edit admin");
r = await s1("tr/do", { ent: "fact", ref: fid("moa") }); t(r.j.status === "verified" && r.j.text === "Menghambat enzim X.", "murid tidak menimpa yang terverifikasi");
t((await s1("admin/tr/save", { ent: "fact", ref: 1, text: "x" })).s === 403, "murid tidak boleh menyimpan terjemahan");
const ad = (await F("admin/drug/" + did)).j; t(ad.facts.find((x) => x.field === "moa").tr.status === "verified" && ad.facts.find((x) => x.field === "adverse").looks_id === true, "panel admin memuat status terjemahan & deteksi Indonesia");
// kuota harian (TR_DAILY_MAX=6)
let blocked = 0; for (let i = 0; i < 8; i++) { await F("admin/drug", { generic: "ZZ-UJI Q" + i, src: "manual", facts: { moa: "Quota test number " + i + " for translation of this text." } }); const d = (await F("admin/drugs?q=zz-uji q" + i)).j.rows[0]; await F("admin/status", { ent: "drug", ids: [d.id], to: "published" }); const f = (await F("admin/drug/" + d.id)).j.facts[0]; const x = await s2("tr/do", { ent: "fact", ref: f.id }); if (x.s === 429) blocked++; }
t(blocked >= 2, "kuota harian per pengguna berlaku (diblok " + blocked + "x)");
// gagal penyedia
await F("admin/drug", { generic: "ZZ-UJI Gagal", src: "manual", facts: { moa: "The libre-fail marker in this text makes the provider fail." } }); const dg = (await F("admin/drugs?q=zz-uji gagal")).j.rows[0]; await F("admin/status", { ent: "drug", ids: [dg.id], to: "published" });
const fg = (await F("admin/drug/" + dg.id)).j.facts[0]; r = await F("admin/tr/do", { ent: "fact", ref: fg.id }); t(r.s === 500 && /Detail/.test(r.j.err), "galat penyedia â†’ pesan jelas untuk admin: " + (r.j.err || "").slice(0, 90));
// status & batch
let stt = (await F("admin/tr/status")).j; t(stt.provider === "libre" && stt.remaining >= 1, "status: penyedia libre, ada sisa: " + JSON.stringify(stt));
let loops = 0, last; do { last = await F("admin/tr/batch", {}); loops++; } while (last.s === 200 && last.j.remaining > 0 && loops < 60); t(last.s === 500 || last.j.remaining === 0, "batch terjemahan berjalan sampai habis/ketemu galat (" + loops + "x)");
r = await F("admin/tr/test", {}); t(r.j.ok === true && r.j.text.startsWith("[ID#"), "uji terjemahan admin");
t((await s1("admin/tr/test", {})).s === 403, "murid tidak boleh uji terjemahan");
console.log(`${ok} lulus, ${bad} gagal`); process.exit(bad ? 1 : 0);
