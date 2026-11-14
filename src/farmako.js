// ASTERION — PHARMACOLOGY SESSION (backend). Dipanggil dari worker.js: /api/farmako/*
// Prinsip: tidak ada data obat/interaksi/referensi yang dikarang. Semua isi berasal dari impor/sinkronisasi/entri admin,
// selalu membawa sumber (src + sid), status (draft → pending → verified → published) dan tanggal pembaruan.
// Mahasiswa HANYA melihat data berstatus "published".

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const err = (m, s = 400, x = {}) => J({ err: m, ...x }, s);
const clip = (v, n) => String(v == null ? "" : v).replace(/\u0000/g, "").trim().slice(0, n);
const lc = (s) => clip(s, 300).toLowerCase().replace(/\s+/g, " ");
const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const likeEsc = (s) => s.replace(/[\\%_]/g, (m) => "\\" + m);
const rnd = (n) => { const x = new Uint32Array(1); crypto.getRandomValues(x); return x[0] % n; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uniq = (a) => [...new Set(a)];
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const jparse = (s, d) => { try { const v = JSON.parse(s); return v == null ? d : v; } catch { return d; } };

export const STATUS = ["draft", "pending", "verified", "published"];
export const STATUS_ID = { draft: "Draft", pending: "Menunggu Verifikasi", verified: "Terverifikasi", published: "Dipublikasikan" };
// Bidang informasi obat (kunci → label Indonesia). Dapat bertambah tanpa mengubah skema.
export const FIELDS = {
  moa: "Mekanisme Kerja", targets: "Target Molekuler", pd: "Farmakodinamik", pk: "Farmakokinetik",
  absorption: "Absorpsi", distribution: "Distribusi", metabolism: "Metabolisme", excretion: "Ekskresi",
  half_life: "Waktu Paruh", bioavailability: "Bioavailabilitas", indications: "Indikasi", contraindications: "Kontraindikasi",
  adverse: "Efek Samping", warnings: "Peringatan", interactions: "Interaksi Obat (teks label)", routes: "Rute Pemberian", dosing: "Dosis", notes: "Catatan Klinis", physchem: "Identitas Kimia",
};
export const CAT_KINDS = {
  organ_system: "Sistem organ", pharm_class: "Golongan farmakologis", ther_class: "Golongan terapeutik", indication: "Indikasi klinis",
  target: "Target molekuler", moa: "Mekanisme kerja", classification: "Klasifikasi obat", atc: "ATC", other: "Kategori lain",
};
export const ITYPES = { ddi: "Drug-Drug Interaction", food: "Drug-Food Interaction", disease: "Drug-Disease Interaction", alcohol: "Drug-Alcohol Interaction" };
const SEV = ["Contraindicated", "Major", "Moderate", "Minor", "Unknown"]; // urutan tampil saja; label asli sumber tidak dipetakan ulang
const sevRank = (s) => { const i = SEV.findIndex((x) => x.toLowerCase() === String(s || "").trim().toLowerCase()); return i < 0 ? 9 : i; };
export const SRC_CODES = ["drugbank", "ddinter", "kegg", "chembl", "openfda", "pubchem", "rxnorm", "manual"];
const GENERAL = ["Pengantar Farmakologi", "Farmakokinetik", "Absorpsi Obat", "Distribusi Obat", "Metabolisme Obat", "Ekskresi Obat", "Farmakodinamik", "Reseptor Obat", "Agonis dan Antagonis", "Hubungan Dosis dan Respons", "Bioavailabilitas", "Waktu Paruh Obat", "Indeks Terapeutik", "Toleransi Obat", "Ketergantungan Obat", "Interaksi Obat", "Variabilitas Respons Obat", "Farmakogenomik", "Dosis dan Regimen Obat", "Penggunaan Obat Rasional"];
export const SECTIONS = { intro: "Pendahuluan", definition: "Definisi", classification: "Klasifikasi", moa: "Mekanisme Kerja", pk: "Farmakokinetik", pd: "Farmakodinamik", indications: "Indikasi Klinis", contraindications: "Kontraindikasi", adverse: "Efek Samping", interactions: "Interaksi Obat", clinical: "Pertimbangan Klinis" };
const SOURCES = [
  ["drugbank", "DrugBank", "https://go.drugbank.com/", "Informasi obat, mekanisme kerja, target, farmakokinetik, indikasi, interaksi. Diimpor dari berkas yang Anda unduh sendiri (perlu akun/lisensi)."],
  ["ddinter", "DDInter 2.0", "https://ddinter2.scbdd.com/", "Interaksi antarobat + tingkat keparahan. Unduh 8 berkas CSV (kelompok ATC A,B,D,H,L,P,R,V) dari ddinter2.scbdd.com/download. Lisensi CC BY-NC-SA 4.0: non-komersial, wajib mencantumkan sumber, turunan berbagi lisensi sama."],
  ["kegg", "KEGG DRUG", "https://www.kegg.jp/kegg/drug/", "Identitas, klasifikasi, hubungan obat–target. Diimpor dari berkas; periksa ketentuan lisensi KEGG."],
  ["chembl", "ChEMBL", "https://www.ebi.ac.uk/chembl/", "Mekanisme kerja dan target molekuler obat. Dapat disinkronkan lewat API publik (ChEMBL web services)."],
  ["openfda", "openFDA (label FDA)", "https://open.fda.gov/apis/drug/label/", "Teks label obat AS: indikasi, kontraindikasi, efek samping, peringatan, interaksi, farmakokinetik. API publik; isi berbahasa Inggris."],
  ["pubchem", "PubChem", "https://pubchem.ncbi.nlm.nih.gov/", "Identitas senyawa, sinonim, sifat fisikokimia. Dapat disinkronkan lewat API publik (PUG REST)."],
  ["rxnorm", "RxNorm", "https://www.nlm.nih.gov/research/umls/rxnorm/", "Standarisasi nama, nama dagang. Dapat disinkronkan lewat API publik (RxNav)."],
  ["manual", "Entri Admin", "", "Data yang diketik atau disunting admin (wajib mencantumkan rujukan pada catatan)."],
];

export const FM_DDL = [
  `CREATE TABLE IF NOT EXISTS fm_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fm_sources (code TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', descr TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, last_sync INTEGER, note TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS fm_drugs (id INTEGER PRIMARY KEY AUTOINCREMENT, generic TEXT NOT NULL, generic_lc TEXT NOT NULL, pharm_class TEXT NOT NULL DEFAULT '', ther_class TEXT NOT NULL DEFAULT '', classification TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', active INTEGER NOT NULL DEFAULT 1, src TEXT NOT NULL DEFAULT 'manual', created INTEGER NOT NULL, updated INTEGER NOT NULL, verified_at INTEGER, updated_by TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS ix_fmd_lc ON fm_drugs (generic_lc)`,
  `CREATE INDEX IF NOT EXISTS ix_fmd_st ON fm_drugs (status, active)`,
  `CREATE TABLE IF NOT EXISTS fm_drug_names (drug_id INTEGER NOT NULL, name TEXT NOT NULL, name_lc TEXT NOT NULL, kind TEXT NOT NULL, src TEXT NOT NULL DEFAULT 'manual', PRIMARY KEY (drug_id, name_lc, kind))`,
  `CREATE INDEX IF NOT EXISTS ix_fmn_lc ON fm_drug_names (name_lc)`,
  `CREATE TABLE IF NOT EXISTS fm_drug_xref (drug_id INTEGER NOT NULL, src TEXT NOT NULL, sid TEXT NOT NULL, synced INTEGER NOT NULL, PRIMARY KEY (src, sid))`,
  `CREATE INDEX IF NOT EXISTS ix_fmx_d ON fm_drug_xref (drug_id)`,
  `CREATE TABLE IF NOT EXISTS fm_drug_facts (id INTEGER PRIMARY KEY AUTOINCREMENT, drug_id INTEGER NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL DEFAULT '', pending TEXT, src TEXT NOT NULL DEFAULT 'manual', sid TEXT NOT NULL DEFAULT '', updated INTEGER NOT NULL, UNIQUE (drug_id, field, src))`,
  `CREATE INDEX IF NOT EXISTS ix_fmf_d ON fm_drug_facts (drug_id)`,
  `CREATE INDEX IF NOT EXISTS ix_fmf_f ON fm_drug_facts (field)`,
  `CREATE TABLE IF NOT EXISTS fm_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, name TEXT NOT NULL, name_lc TEXT NOT NULL, parent_id INTEGER NOT NULL DEFAULT 0, src TEXT NOT NULL DEFAULT 'manual', sid TEXT NOT NULL DEFAULT '', descr TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, UNIQUE (kind, parent_id, name_lc, src))`,
  `CREATE TABLE IF NOT EXISTS fm_drug_cat (drug_id INTEGER NOT NULL, cat_id INTEGER NOT NULL, PRIMARY KEY (drug_id, cat_id))`,
  `CREATE INDEX IF NOT EXISTS ix_fmdc_c ON fm_drug_cat (cat_id)`,
  `CREATE TABLE IF NOT EXISTS fm_inter (id INTEGER PRIMARY KEY AUTOINCREMENT, itype TEXT NOT NULL DEFAULT 'ddi', drug_a INTEGER NOT NULL DEFAULT 0, drug_b INTEGER NOT NULL DEFAULT 0, n INTEGER NOT NULL DEFAULT 2, subject TEXT NOT NULL DEFAULT '', severity TEXT NOT NULL DEFAULT '', mechanism TEXT NOT NULL DEFAULT '', effect TEXT NOT NULL DEFAULT '', management TEXT NOT NULL DEFAULT '', evidence TEXT NOT NULL DEFAULT '', src TEXT NOT NULL DEFAULT 'manual', sid TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', pending TEXT, verified_at INTEGER, created INTEGER NOT NULL, updated INTEGER NOT NULL, UNIQUE (itype, drug_a, drug_b, subject, src))`,
  `CREATE INDEX IF NOT EXISTS ix_fmi_a ON fm_inter (drug_a, status)`,
  `CREATE INDEX IF NOT EXISTS ix_fmi_b ON fm_inter (drug_b, status)`,
  `CREATE TABLE IF NOT EXISTS fm_inter_members (inter_id INTEGER NOT NULL, drug_id INTEGER NOT NULL, PRIMARY KEY (inter_id, drug_id))`,
  `CREATE INDEX IF NOT EXISTS ix_fmim_d ON fm_inter_members (drug_id)`,
  `CREATE TABLE IF NOT EXISTS fm_materials (id INTEGER PRIMARY KEY AUTOINCREMENT, cat_id INTEGER NOT NULL DEFAULT 0, general INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '{}', refs TEXT NOT NULL DEFAULT '[]', src TEXT NOT NULL DEFAULT 'manual', sid TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', sort INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL, updated_by TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS ix_fmm_c ON fm_materials (cat_id, status)`,
  `CREATE TABLE IF NOT EXISTS fm_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, cat_id INTEGER NOT NULL DEFAULT 0, mode TEXT NOT NULL DEFAULT 'mixed', diff INTEGER NOT NULL DEFAULT 2, q TEXT NOT NULL, a TEXT NOT NULL DEFAULT '', b TEXT NOT NULL DEFAULT '', c TEXT NOT NULL DEFAULT '', d TEXT NOT NULL DEFAULT '', ans TEXT NOT NULL, expl TEXT NOT NULL DEFAULT '', src TEXT NOT NULL DEFAULT 'manual', sid TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', created INTEGER NOT NULL, updated INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ix_fmq_c ON fm_questions (cat_id, status)`,
  `CREATE TABLE IF NOT EXISTS fm_progress (u TEXT NOT NULL, mat_id INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, t INTEGER NOT NULL, PRIMARY KEY (u, mat_id))`,
  `CREATE TABLE IF NOT EXISTS fm_bookmarks (u TEXT NOT NULL, kind TEXT NOT NULL, ref INTEGER NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (u, kind, ref))`,
  `CREATE TABLE IF NOT EXISTS fm_recent (u TEXT NOT NULL, kind TEXT NOT NULL, ref INTEGER NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (u, kind, ref))`,
  `CREATE INDEX IF NOT EXISTS ix_fmr_u ON fm_recent (u, t)`,
  `CREATE TABLE IF NOT EXISTS fm_game (id TEXT PRIMARY KEY, u TEXT NOT NULL, cats TEXT NOT NULL DEFAULT '', mode TEXT NOT NULL, diff INTEGER NOT NULL, total INTEGER NOT NULL, cur INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0, snap TEXT NOT NULL, res TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active', started INTEGER NOT NULL, last_t INTEGER NOT NULL, fin INTEGER, dur INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS ix_fmg_u ON fm_game (u, status, fin)`,
  `CREATE TABLE IF NOT EXISTS fm_sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, u TEXT NOT NULL, src TEXT NOT NULL, act TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 1, n_in INTEGER NOT NULL DEFAULT 0, n_up INTEGER NOT NULL DEFAULT 0, n_skip INTEGER NOT NULL DEFAULT 0, msg TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS fm_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, u TEXT NOT NULL, act TEXT NOT NULL, ent TEXT NOT NULL DEFAULT '', ref INTEGER NOT NULL DEFAULT 0, detail TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS ix_fma_e ON fm_audit (ent, ref, t)`,
  `CREATE TABLE IF NOT EXISTS fm_tr (ent TEXT NOT NULL, ref INTEGER NOT NULL, field TEXT NOT NULL, h TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'auto', t INTEGER NOT NULL, PRIMARY KEY (ent, ref, field))`,
  `CREATE TABLE IF NOT EXISTS fm_usul (id INTEGER PRIMARY KEY AUTOINCREMENT, u TEXT NOT NULL, name TEXT NOT NULL, name_lc TEXT NOT NULL, brands TEXT NOT NULL DEFAULT '', pharm_class TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', admin_note TEXT NOT NULL DEFAULT '', drug_id INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, decided INTEGER, decided_by TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS ix_fmu_s ON fm_usul (status, created)`,
  `CREATE INDEX IF NOT EXISTS ix_fmu_u ON fm_usul (u, created)`,
  `CREATE TABLE IF NOT EXISTS fm_sync_state (drug_id INTEGER NOT NULL, src TEXT NOT NULL, t INTEGER NOT NULL, ok INTEGER NOT NULL, msg TEXT NOT NULL DEFAULT '', PRIMARY KEY (drug_id, src))`,
];

let ready = false, cache = {};
async function fmDb(env) {
  if (!env.DB) return null;
  if (!ready) {
    await env.DB.batch(FM_DDL.map((s) => env.DB.prepare(s)));
    const t = Date.now();
    await env.DB.batch(SOURCES.map((s) => env.DB.prepare("INSERT INTO fm_sources (code, name, url, descr) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, url = excluded.url, descr = excluded.descr").bind(...s)));
    const seeded = await env.DB.prepare("SELECT v FROM fm_meta WHERE k = 'seed_general'").first();
    if (!seeded) { // kerangka 20 materi umum: HANYA judul, berstatus draft (tidak tampil ke mahasiswa sampai admin mengisi & mempublikasikan)
      await env.DB.batch([...GENERAL.map((g, i) => env.DB.prepare("INSERT INTO fm_materials (cat_id, general, title, status, sort, created, updated) VALUES (0, 1, ?, 'draft', ?, ?, ?)").bind(g, i + 1, t, t)), env.DB.prepare("INSERT INTO fm_meta (k, v) VALUES ('seed_general', '1')")]);
    }
    ready = true;
  }
  return env.DB;
}
const dirty = () => { cache = {}; };
const audit = (db, u, act, ent, ref, detail) => db.prepare("INSERT INTO fm_audit (t, u, act, ent, ref, detail) VALUES (?, ?, ?, ?, ?, ?)").bind(Date.now(), u, act, ent || "", ref || 0, clip(detail, 600)).run();
async function memo(key, ttl, fn) { const c = cache[key]; if (c && Date.now() - c.t < ttl) return c.v; const v = await fn(); cache[key] = { t: Date.now(), v }; return v; }
const inList = (n) => new Array(n).fill("?").join(",");
// D1 membatasi ±100 parameter per kueri → pecah daftar ID
async function byIds(db, sqlFn, ids) { const out = []; for (const part of chunk(uniq(ids), 80)) { const r = await db.prepare(sqlFn(inList(part.length))).bind(...part).all(); out.push(...r.results); } return out; }

// ---------- kategori dinamis: berasal dari tabel, tidak ada daftar statis ----------
async function catIndex(db) {
  return memo("cats", 30000, async () => {
    const cats = (await db.prepare("SELECT * FROM fm_categories WHERE hidden = 0").all()).results;
    const links = (await db.prepare("SELECT dc.cat_id, dc.drug_id FROM fm_drug_cat dc JOIN fm_drugs d ON d.id = dc.drug_id WHERE d.status = 'published' AND d.active = 1").all()).results;
    const byId = new Map(cats.map((c) => [c.id, { ...c, kids: [], drugs: new Set() }]));
    for (const l of links) { const c = byId.get(l.cat_id); if (c) c.drugs.add(l.drug_id); }
    for (const c of byId.values()) { const p = byId.get(c.parent_id); if (p) p.kids.push(c); }
    const all = (c, acc = new Set()) => { c.drugs.forEach((d) => acc.add(d)); c.kids.forEach((k) => all(k, acc)); return acc; };
    for (const c of byId.values()) c.all = all(c);
    return byId;
  });
}
const descendants = (idx, id, acc = new Set()) => { const c = idx.get(id); if (!c) return acc; acc.add(id); c.kids.forEach((k) => descendants(idx, k.id, acc)); return acc; };
const catOut = (c) => ({ id: c.id, kind: c.kind, name: c.name, parent_id: c.parent_id, descr: c.descr, src: c.src, sid: c.sid, sort: c.sort, drugs: c.all.size, subs: c.kids.filter((k) => k.all.size > 0).length });
async function ensureCat(db, kind, name, parentId, src, sid, t) {
  kind = CAT_KINDS[kind] ? kind : "other"; name = clip(name, 160); if (!name) return 0;
  const nl = lc(name), p = parentId || 0;
  const ex = await db.prepare("SELECT id FROM fm_categories WHERE kind = ? AND parent_id = ? AND name_lc = ? ORDER BY id LIMIT 1").bind(kind, p, nl).first();
  if (ex) return ex.id;
  const r = await db.prepare("INSERT INTO fm_categories (kind, name, name_lc, parent_id, src, sid, created) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(kind, name, nl, p, src, clip(sid, 80), t).run();
  return r.meta.last_row_id;
}

// ---------- obat ----------
const pubWhere = "d.status = 'published' AND d.active = 1";
async function drugNames(db, ids) {
  const m = new Map(); if (!ids.length) return m;
  for (const r of await byIds(db, (q) => `SELECT drug_id, name, kind, src FROM fm_drug_names WHERE drug_id IN (${q}) ORDER BY kind, name`, ids)) { if (!m.has(r.drug_id)) m.set(r.drug_id, []); m.get(r.drug_id).push(r); }
  return m;
}
async function drugCats(db, id) {
  return (await db.prepare("SELECT c.id, c.kind, c.name, c.parent_id FROM fm_drug_cat dc JOIN fm_categories c ON c.id = dc.cat_id WHERE dc.drug_id = ? AND c.hidden = 0 ORDER BY c.kind, c.name").bind(id).all()).results;
}
function setNames(db, id, generic, brands, syns, src) {
  const st = [db.prepare("DELETE FROM fm_drug_names WHERE drug_id = ? AND src = ? AND kind <> 'generic'").bind(id, src)];
  const add = (n, k) => { n = clip(n, 160); if (n) st.push(db.prepare("INSERT OR IGNORE INTO fm_drug_names (drug_id, name, name_lc, kind, src) VALUES (?, ?, ?, ?, ?)").bind(id, n, lc(n), k, src)); };
  st.push(db.prepare("INSERT OR IGNORE INTO fm_drug_names (drug_id, name, name_lc, kind, src) VALUES (?, ?, ?, 'generic', ?)").bind(id, clip(generic, 160), lc(generic), src));
  (brands || []).forEach((n) => add(n, "brand")); (syns || []).forEach((n) => add(n, "synonym"));
  return st;
}
const listOf = (v) => (Array.isArray(v) ? v : String(v || "").split(/[|;\n]/)).map((x) => clip(x, 160)).filter(Boolean);

// simpan/ubah satu obat dari entri admin atau baris impor. `imp` = true → aturan sinkronisasi aman (tidak menimpa data terbit)
async function saveDrug(db, o, u, src, imp) {
  const t = Date.now(), generic = clip(o.generic, 160);
  if (!generic) return { err: "Nama generik wajib diisi." };
  const xr = o.xref && typeof o.xref === "object" ? o.xref : {};
  if (o.source_id) xr[src] = o.source_id;
  let row = null;
  if (o.id) row = await db.prepare("SELECT * FROM fm_drugs WHERE id = ?").bind(+o.id).first();
  if (!row) for (const [s, sid] of Object.entries(xr)) { const x = await db.prepare("SELECT d.* FROM fm_drug_xref x JOIN fm_drugs d ON d.id = x.drug_id WHERE x.src = ? AND x.sid = ?").bind(s, clip(sid, 80)).first(); if (x) { row = x; break; } }
  if (!row && imp) row = await db.prepare("SELECT * FROM fm_drugs WHERE generic_lc = ?").bind(lc(generic)).first();
  let id, created = false;
  const cls = [clip(o.pharm_class, 200), clip(o.ther_class, 200), clip(o.classification, 200)];
  if (!row) {
    const r = await db.prepare("INSERT INTO fm_drugs (generic, generic_lc, pharm_class, ther_class, classification, summary, status, src, created, updated, updated_by) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)").bind(generic, lc(generic), ...cls, clip(o.summary, 600), src, t, t, u).run();
    id = r.meta.last_row_id; created = true;
  } else {
    id = row.id;
    if (imp) { // impor: hanya mengisi kolom yang masih kosong; data terbit tidak ditimpa
      await db.prepare("UPDATE fm_drugs SET pharm_class = CASE WHEN pharm_class = '' THEN ? ELSE pharm_class END, ther_class = CASE WHEN ther_class = '' THEN ? ELSE ther_class END, classification = CASE WHEN classification = '' THEN ? ELSE classification END, summary = CASE WHEN summary = '' THEN ? ELSE summary END, updated = ? WHERE id = ?").bind(...cls, clip(o.summary, 600), t, id).run();
    } else {
      await db.prepare("UPDATE fm_drugs SET generic = ?, generic_lc = ?, pharm_class = ?, ther_class = ?, classification = ?, summary = ?, updated = ?, updated_by = ? WHERE id = ?").bind(generic, lc(generic), ...cls, clip(o.summary, 600), t, u, id).run();
    }
  }
  const cap = imp ? 12 : 40, st = [...setNames(db, id, generic, listOf(o.brands).slice(0, cap), listOf(o.synonyms).slice(0, cap), src)];
  for (const [s, sid] of Object.entries(xr)) if (clip(sid, 80)) st.push(db.prepare("INSERT INTO fm_drug_xref (drug_id, src, sid, synced) VALUES (?, ?, ?, ?) ON CONFLICT(src, sid) DO UPDATE SET synced = excluded.synced").bind(id, clip(s, 20), clip(sid, 80), t));
  await db.batch(st);
  // fakta per sumber (perbedaan antar-sumber dipertahankan: unik per drug+field+src)
  const cur = row ? row.status : "draft", facts = o.facts && typeof o.facts === "object" ? o.facts : {};
  let pend = 0;
  const entries = Object.entries(facts).filter(([f, v]) => FIELDS[f] && clip(v, 8000));
  if (entries.length) { // hemat query D1: satu SELECT + satu batch (batas 50 query/permintaan di paket gratis)
    const have = new Map((await db.prepare("SELECT id, field, value FROM fm_drug_facts WHERE drug_id = ? AND src = ?").bind(id, src).all()).results.map((x) => [x.field, x])), fst = [], sidv = clip(o.source_id || xr[src] || "", 80);
    for (const [f, v] of entries) {
      const val = clip(v, 8000), ex = have.get(f);
      if (!ex) fst.push(db.prepare("INSERT INTO fm_drug_facts (drug_id, field, value, src, sid, updated) VALUES (?, ?, ?, ?, ?, ?)").bind(id, f, val, src, sidv, t));
      else if (ex.value !== val) {
        if (imp && cur === "published") { fst.push(db.prepare("UPDATE fm_drug_facts SET pending = ?, updated = ? WHERE id = ?").bind(val, t, ex.id)); pend++; } // menunggu persetujuan admin
        else fst.push(db.prepare("UPDATE fm_drug_facts SET value = ?, pending = NULL, sid = ?, updated = ? WHERE id = ?").bind(val, sidv, t, ex.id));
      }
    }
    if (fst.length) await db.batch(fst);
  }
  // kategori: dari daftar eksplisit + kolom golongan (berdasarkan data, bukan tebakan)
  const cl = Array.isArray(o.categories) ? [...o.categories] : [];
  if (cls[0]) cl.push({ kind: "pharm_class", name: cls[0] }); if (cls[1]) cl.push({ kind: "ther_class", name: cls[1] }); if (cls[2]) cl.push({ kind: "classification", name: cls[2] });
  const deep = [], seen = new Set(), cst = [];
  for (const c of cl) {
    if (Array.isArray(c.path) && c.path.length > 1) { deep.push(c); continue; }
    const kind = CAT_KINDS[c.kind] ? c.kind : "other", nm = clip(Array.isArray(c.path) && c.path.length ? c.path[0] : c.name, 160), key = kind + "|" + lc(nm);
    if (!nm || seen.has(key) || seen.size >= 12) continue; seen.add(key);
    cst.push(db.prepare("INSERT INTO fm_categories (kind, name, name_lc, parent_id, src, sid, created) SELECT ?, ?, ?, 0, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM fm_categories WHERE kind = ? AND parent_id = 0 AND name_lc = ?)").bind(kind, nm, lc(nm), src, clip(c.sid || "", 80), t, kind, lc(nm)));
    cst.push(db.prepare("INSERT OR IGNORE INTO fm_drug_cat (drug_id, cat_id) SELECT ?, MIN(id) FROM fm_categories WHERE kind = ? AND parent_id = 0 AND name_lc = ?").bind(id, kind, lc(nm)));
  }
  if (cst.length) await db.batch(cst);
  for (const c of deep) { // hierarki (mis. ATC): bertahap
    let p = 0; for (const nm of c.path) p = await ensureCat(db, c.kind || "other", nm, p, src, c.sid || "", t);
    if (p) await db.prepare("INSERT OR IGNORE INTO fm_drug_cat (drug_id, cat_id) VALUES (?, ?)").bind(id, p).run();
  }
  dirty();
  return { id, created, pend };
}

// ---------- pencarian / autocomplete (semua saran berasal dari tabel) ----------
async function suggest(db, a, q, scope) {
  const s = lc(q); if (!s) return { items: [] };
  const upto = s.slice(0, -1) + String.fromCharCode(s.charCodeAt(s.length - 1) + 1), items = [], seen = new Set();
  const adm = a.admin && scope.admin, vis = adm ? "d.active IN (0,1)" : pubWhere;
  if (["all", "drug"].includes(scope.s)) {
    let rows = (await db.prepare(`SELECT n.drug_id, n.name, n.kind, d.generic, d.pharm_class, d.summary, d.status FROM fm_drug_names n JOIN fm_drugs d ON d.id = n.drug_id WHERE ${vis} AND n.name_lc >= ? AND n.name_lc < ? ORDER BY (n.kind = 'generic') DESC, length(n.name) LIMIT 40`).bind(s, upto).all()).results;
    if (rows.length < 10 && s.length >= 2) rows = rows.concat((await db.prepare(`SELECT n.drug_id, n.name, n.kind, d.generic, d.pharm_class, d.summary, d.status FROM fm_drug_names n JOIN fm_drugs d ON d.id = n.drug_id WHERE ${vis} AND instr(n.name_lc, ?) > 0 ORDER BY (n.kind = 'generic') DESC, length(n.name) LIMIT 30`).bind(s).all()).results);
    for (const r of rows) { if (seen.has("d" + r.drug_id)) continue; seen.add("d" + r.drug_id); items.push({ t: "drug", id: r.drug_id, name: r.generic, matched: r.name.toLowerCase() === r.generic.toLowerCase() ? "" : r.name, via: r.kind, sub: r.pharm_class, descr: r.summary, status: r.status }); if (items.length >= 12) break; }
  }
  if (["all", "cat", "game"].includes(scope.s)) {
    const idx = await catIndex(db), hit = [];
    for (const c of idx.values()) if (c.all.size > 0 && c.name_lc.includes(s)) hit.push(c);
    hit.sort((x, y) => (x.name_lc.startsWith(s) ? 0 : 1) - (y.name_lc.startsWith(s) ? 0 : 1) || y.all.size - x.all.size);
    for (const c of hit.slice(0, 6)) items.push({ t: "cat", id: c.id, name: c.name, sub: CAT_KINDS[c.kind] || c.kind, descr: c.all.size + " obat" });
  }
  if (["all", "material"].includes(scope.s)) {
    const rows = (await db.prepare(`SELECT id, title FROM fm_materials WHERE ${adm ? "1=1" : "status = 'published'"} AND instr(lower(title), ?) > 0 ORDER BY (instr(lower(title), ?) = 1) DESC LIMIT 5`).bind(s, s).all()).results;
    for (const r of rows) items.push({ t: "material", id: r.id, name: r.title, sub: "Materi" });
  }
  return { items };
}

// ---------- interaksi ----------
async function checkInteractions(db, ids) {
  ids = uniq(ids.map((x) => int(x)).filter((x) => x > 0)).slice(0, 12);
  if (ids.length < 1) return { err: "Pilih minimal satu obat." };
  const drugs = await byIds(db, (q) => `SELECT id, generic, pharm_class FROM fm_drugs d WHERE ${pubWhere} AND id IN (${q})`, ids);
  const dm = new Map(drugs.map((d) => [d.id, d])), ok = ids.filter((i) => dm.has(i));
  const rows = await byIds(db, (q) => `SELECT * FROM fm_inter WHERE status = 'published' AND itype = 'ddi' AND n = 2 AND drug_a IN (${q})`, ok);
  const set = new Set(ok), pairs = [];
  for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) {
    const a = Math.min(ok[i], ok[j]), b = Math.max(ok[i], ok[j]);
    const hits = rows.filter((r) => r.drug_a === a && r.drug_b === b).sort((x, y) => sevRank(x.severity) - sevRank(y.severity));
    pairs.push({ a: dm.get(a).generic, b: dm.get(b).generic, a_id: a, b_id: b, found: hits.length > 0, items: hits.map(iOut) });
  }
  // kombinasi > 2 obat: hanya jika SELURUH anggota ada pada pilihan
  const combos = [];
  if (ok.length >= 3) {
    const cand = await byIds(db, (q) => `SELECT i.* FROM fm_inter i WHERE i.status = 'published' AND i.n > 2 AND i.id IN (SELECT inter_id FROM fm_inter_members WHERE drug_id IN (${q}))`, ok);
    for (const c of cand) {
      const mem = (await db.prepare("SELECT drug_id FROM fm_inter_members WHERE inter_id = ?").bind(c.id).all()).results.map((m) => m.drug_id);
      if (mem.length > 2 && mem.every((m) => set.has(m))) combos.push({ ...iOut(c), members: mem.map((m) => dm.get(m).generic) });
    }
  }
  const other = { food: [], disease: [], alcohol: [] };
  for (const r of await byIds(db, (q) => `SELECT * FROM fm_inter WHERE status = 'published' AND itype <> 'ddi' AND drug_a IN (${q})`, ok)) if (other[r.itype]) other[r.itype].push({ ...iOut(r), drug: dm.get(r.drug_a).generic });
  return { drugs: ok.map((i) => ({ id: i, generic: dm.get(i).generic })), missing: ids.filter((i) => !dm.has(i)), pairs, combos, other, at: Date.now() };
}
const iOut = (r) => ({ id: r.id, itype: r.itype, severity: r.severity, mechanism: r.mechanism, effect: r.effect, management: r.management, evidence: r.evidence, subject: r.subject, src: r.src, sid: r.sid, verified_at: r.verified_at, updated: r.updated });

// ---------- game ----------
export const MODES = {
  class: { n: "Drug Class Match", d: "Cocokkan obat dengan golongan farmakologisnya", f: "pharm_class" },
  mechanism: { n: "Mechanism Match", d: "Cocokkan obat dengan mekanisme kerjanya", f: "moa" },
  indication: { n: "Indication Match", d: "Cocokkan obat dengan indikasinya", f: "indications" },
  adverse: { n: "Side Effect Match", d: "Cocokkan obat dengan efek sampingnya", f: "adverse" },
  mixed: { n: "Mixed Challenge", d: "Gabungan berbagai jenis pertanyaan", f: "" },
  interaction: { n: "Drug Interaction Quiz", d: "Tentukan tingkat keparahan interaksi dua obat", f: "" },
};
const DIFF = { 1: { n: "Pemula", base: 100, sec: 30 }, 2: { n: "Menengah", base: 150, sec: 25 }, 3: { n: "Lanjutan", base: 200, sec: 20 } };
const short = (v) => { const s = String(v || "").replace(/\s+/g, " ").trim(); if (!s) return ""; const m = s.match(/^(.{12,230}?[.!?])(\s|$)/); const f = m ? m[1] : s; return f.length <= 230 ? f : ""; };
const FACT_ORDER = ["drugbank", "kegg", "ddinter", "chembl", "openfda", "pubchem", "rxnorm", "manual"];

async function gameFacts(db) { // data sumber soal (obat terbit + fakta) — di-cache sebentar
  return memo("gf", 60000, async () => {
    const drugs = (await db.prepare(`SELECT id, generic, pharm_class FROM fm_drugs d WHERE ${pubWhere}`).all()).results;
    const facts = (await db.prepare(`SELECT f.drug_id, f.field, f.value, f.src, f.sid FROM fm_drug_facts f JOIN fm_drugs d ON d.id = f.drug_id WHERE ${pubWhere} AND f.field IN ('moa','indications','adverse') AND f.value <> ''`).all()).results;
    const dc = (await db.prepare(`SELECT dc.drug_id, dc.cat_id FROM fm_drug_cat dc JOIN fm_drugs d ON d.id = dc.drug_id WHERE ${pubWhere}`).all()).results;
    const F = { moa: new Map(), indications: new Map(), adverse: new Map() };
    facts.sort((x, y) => FACT_ORDER.indexOf(x.src) - FACT_ORDER.indexOf(y.src));
    for (const f of facts) { if (F[f.field].has(f.drug_id)) continue; const s = short(f.value); if (s) F[f.field].set(f.drug_id, { v: s, full: f.value, src: f.src, sid: f.sid }); }
    const cats = new Map(); for (const l of dc) { if (!cats.has(l.drug_id)) cats.set(l.drug_id, new Set()); cats.get(l.drug_id).add(l.cat_id); }
    return { drugs: new Map(drugs.map((d) => [d.id, d])), F, cats };
  });
}
function eligible(G, field, id) { // apakah obat dapat dibuat soal untuk bidang tsb (butuh ≥4 nilai berbeda di seluruh DB)
  if (field === "pharm_class") return !!(G.drugs.get(id) || {}).pharm_class;
  return G.F[field].has(id);
}
const distinctCount = (G, field) => { const s = new Set(); if (field === "pharm_class") for (const d of G.drugs.values()) { if (d.pharm_class) s.add(lc(d.pharm_class)); } else for (const x of G.F[field].values()) s.add(lc(x.v)); return s.size; };
const valOf = (G, field, id) => (field === "pharm_class" ? { v: (G.drugs.get(id) || {}).pharm_class, full: "", src: "", sid: "" } : G.F[field].get(id));
const FLBL = { pharm_class: "golongan farmakologis", moa: "mekanisme kerja", indications: "indikasi", adverse: "efek samping" };

async function gameCounts(db) {
  return memo("gc", 60000, async () => {
    const G = await gameFacts(db), idx = await catIndex(db), q = (await db.prepare("SELECT cat_id, mode, diff FROM fm_questions WHERE status = 'published'").all()).results;
    const inter = (await db.prepare("SELECT drug_a, drug_b, src, severity FROM fm_inter WHERE status = 'published' AND itype = 'ddi' AND n = 2 AND severity <> ''").all()).results;
    const labels = {}; for (const i of inter) { (labels[i.src] = labels[i.src] || new Set()).add(i.severity); }
    const interOk = inter.filter((i) => labels[i.src].size >= 2);
    const ok = {}; for (const f of Object.keys(FLBL)) ok[f] = distinctCount(G, f) >= 4;
    const out = [];
    for (const c of idx.values()) {
      if (c.all.size === 0) continue;
      const m = { class: 0, mechanism: 0, indication: 0, adverse: 0, interaction: 0, manual: 0 }, ids = [...c.all];
      if (ok.pharm_class) m.class = ids.filter((i) => eligible(G, "pharm_class", i)).length;
      if (ok.moa) m.mechanism = ids.filter((i) => eligible(G, "moa", i)).length;
      if (ok.indications) m.indication = ids.filter((i) => eligible(G, "indications", i)).length;
      if (ok.adverse) m.adverse = ids.filter((i) => eligible(G, "adverse", i)).length;
      m.interaction = interOk.filter((i) => c.all.has(i.drug_a) || c.all.has(i.drug_b)).length;
      const dsc = descendants(idx, c.id); m.manual = q.filter((x) => dsc.has(x.cat_id)).length;
      m.mixed = m.class + m.mechanism + m.indication + m.adverse + m.interaction + m.manual;
      if (m.mixed > 0) out.push({ id: c.id, kind: c.kind, name: c.name, parent_id: c.parent_id, descr: c.descr || (CAT_KINDS[c.kind] || ""), drugs: c.all.size, subs: c.kids.filter((k) => k.all.size > 0).length, avail: m });
    }
    return out;
  });
}

async function buildQuestions(db, catIds, mode, diff, n) {
  const G = await gameFacts(db), idx = await catIndex(db), pool = new Set();
  for (const c of catIds) for (const d of descendants(idx, c)) { const cc = idx.get(d); if (cc) cc.all.forEach((x) => pool.add(x)); }
  const poolIds = [...pool], qs = [];
  const kinds = mode === "mixed" ? (diff === 1 ? ["pharm_class"] : ["pharm_class", "moa", "indications", "adverse"]) : [MODES[mode].f].filter(Boolean);
  const shareCat = (x, y) => { const a = G.cats.get(x), b = G.cats.get(y); if (!a || !b) return 0; let k = 0; a.forEach((c) => { if (b.has(c)) k++; }); return k; };
  const forward = (id, field) => {
    const me = valOf(G, field, id), d = G.drugs.get(id); if (!me || !me.v) return null;
    const cands = [...G.drugs.keys()].filter((o) => o !== id && eligible(G, field, o) && lc(valOf(G, field, o).v) !== lc(me.v));
    const seenV = new Set([lc(me.v)]), near = [], far = [];
    shuffle(cands).forEach((o) => (shareCat(id, o) > 0 ? near : far).push(o));
    const order = diff === 1 ? far.concat(near) : near.concat(far), pick = [];
    for (const o of order) { const v = valOf(G, field, o).v; if (seenV.has(lc(v))) continue; seenV.add(lc(v)); pick.push(v); if (pick.length === 3) break; }
    if (pick.length < 3) return null;
    return { q: `Apa ${FLBL[field]} dari ${d.generic}?`, opts: shuffle([me.v, ...pick]), correct: me.v, expl: `${d.generic}: ${FLBL[field]} — ${me.full || me.v}`, src: me.src || "", sid: me.sid || "" };
  };
  const reverse = (id, field) => {
    const me = valOf(G, field, id), d = G.drugs.get(id); if (!me || !me.v) return null;
    const cands = [...G.drugs.keys()].filter((o) => o !== id && (field === "pharm_class" ? lc(G.drugs.get(o).pharm_class) !== lc(me.v) && G.drugs.get(o).pharm_class : eligible(G, field, o) && lc(valOf(G, field, o).v) !== lc(me.v)));
    const near = [], far = []; shuffle(cands).forEach((o) => (shareCat(id, o) > 0 ? near : far).push(o));
    const pick = near.concat(far).slice(0, 3).map((o) => G.drugs.get(o).generic); if (pick.length < 3) return null;
    return { q: `Obat manakah dengan ${FLBL[field]}: “${me.v}”?`, opts: shuffle([d.generic, ...pick]), correct: d.generic, expl: `${d.generic}: ${FLBL[field]} — ${me.full || me.v}`, src: me.src || "", sid: me.sid || "" };
  };
  const make = (field) => {
    if (distinctCount(G, field) < 4) return null;
    const ids = shuffle(poolIds.filter((i) => eligible(G, field, i)));
    for (const id of ids.slice(0, 6)) { const r = diff === 3 && rnd(2) ? reverse(id, field) : forward(id, field); if (r) return r; }
    return null;
  };
  const used = new Set();
  const interQ = async () => {
    const rows = (await db.prepare("SELECT i.*, a.generic AS ga, b.generic AS gb FROM fm_inter i JOIN fm_drugs a ON a.id = i.drug_a JOIN fm_drugs b ON b.id = i.drug_b WHERE i.status = 'published' AND i.itype = 'ddi' AND i.n = 2 AND i.severity <> '' AND a.status = 'published' AND b.status = 'published' ORDER BY RANDOM() LIMIT 120").all()).results.filter((r) => pool.has(r.drug_a) || pool.has(r.drug_b));
    const labels = {}; for (const r of rows) (labels[r.src] = labels[r.src] || new Set()).add(r.severity);
    const all = (await db.prepare("SELECT DISTINCT src, severity FROM fm_inter WHERE status = 'published' AND itype = 'ddi' AND n = 2 AND severity <> ''").all()).results;
    const L = {}; for (const r of all) (L[r.src] = L[r.src] || []).push(r.severity);
    for (const r of rows) {
      const opts = (L[r.src] || []).sort((x, y) => sevRank(x) - sevRank(y)).slice(0, 5); if (opts.length < 2 || used.has("i" + r.id)) continue; used.add("i" + r.id);
      return { q: `Menurut ${r.src}, bagaimana tingkat keparahan interaksi antara ${r.ga} dan ${r.gb}?`, opts, correct: r.severity, expl: [r.mechanism && "Mekanisme: " + r.mechanism, r.effect && "Dampak: " + r.effect, r.management && "Pengelolaan: " + r.management].filter(Boolean).join("\n") || "Klasifikasi sesuai data sumber.", src: r.src, sid: r.sid };
    }
    return null;
  };
  const manual = (await db.prepare("SELECT * FROM fm_questions WHERE status = 'published'").all()).results.filter((q) => catIds.some((c) => descendants(idx, c).has(q.cat_id))).filter((q) => (mode === "mixed" || q.mode === mode) && (diff === 3 ? q.diff >= 2 : q.diff === diff));
  let guard = 0;
  while (qs.length < n && guard++ < n * 8) {
    let r = null; const roll = rnd(10);
    if (mode === "interaction") r = await interQ();
    else if (mode === "mixed" && diff === 3 && roll < 2) r = await interQ();
    else if (manual.length && (mode === "mixed" ? roll < 3 : true) && rnd(3) === 0) { const m = manual.splice(rnd(manual.length), 1)[0], o = [m.a, m.b, m.c, m.d].filter(Boolean), correct = m[String(m.ans).toLowerCase()]; if (o.length >= 2 && correct) r = { q: m.q, opts: shuffle(o), correct, expl: m.expl, src: m.src, sid: m.sid }; }
    if (!r && mode !== "interaction") r = make(kinds[rnd(kinds.length)]);
    if (!r) { if (mode !== "interaction" && manual.length) continue; if (guard > n * 3) break; continue; }
    const key = lc(r.q); if (used.has(key)) continue; used.add(key); qs.push(r);
  }
  return qs;
}

// ---------- sinkronisasi API publik (PubChem / RxNorm) — TIDAK diuji terhadap layanan asli di lingkungan pengembangan ----------
async function xf(url) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 8000);
  try { const r = await fetch(url, { signal: ac.signal, headers: { accept: "application/json", "user-agent": "asterion-farmako/1.0" } }); if (r.status === 404) return null; if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(tm); }
}
const junkSyn = (s) => /^\d|^[A-Z]{2,}[-\d]|CHEMBL|DTXSID|^UNII|^NSC|^SCHEMBL|^AKOS|^BRN|^EINECS|\d{4,}|^[A-Z0-9-]{12,}$/.test(s) || s.length > 40;
async function syncPubchem(name) {
  const p = (await xf("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" + encodeURIComponent(name) + "/property/MolecularFormula,MolecularWeight,InChIKey,IUPACName/JSON"))?.PropertyTable?.Properties?.[0];
  if (!p) return null;
  const syn = ((await xf("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + p.CID + "/synonyms/JSON"))?.InformationList?.Information?.[0]?.Synonym || []).filter((s) => !junkSyn(s)).slice(0, 15);
  const val = [p.MolecularFormula && "Rumus molekul: " + p.MolecularFormula, p.MolecularWeight && "Massa molekul: " + p.MolecularWeight, p.IUPACName && "Nama IUPAC: " + p.IUPACName, p.InChIKey && "InChIKey: " + p.InChIKey].filter(Boolean).join("\n");
  return { sid: String(p.CID), syn, facts: { physchem: val } };
}
async function syncRxnorm(name) {
  const id = (await xf("https://rxnav.nlm.nih.gov/REST/rxcui.json?name=" + encodeURIComponent(name) + "&search=2"))?.idGroup?.rxnormId?.[0];
  if (!id) return null;
  const rel = (await xf("https://rxnav.nlm.nih.gov/REST/rxcui/" + id + "/related.json?tty=BN"))?.relatedGroup?.conceptGroup || [];
  const brands = rel.flatMap((g) => g.conceptProperties || []).map((c) => c.name).filter(Boolean).slice(0, 25);
  return { sid: String(id), brands, facts: {} };
}

const FDA_HEAD = /^\s*(\d+(\.\d+)*\s*)?(INDICATIONS( AND|\s*&)? USAGE|CONTRAINDICATIONS|ADVERSE REACTIONS|WARNINGS( AND PRECAUTIONS)?|DRUG INTERACTIONS|MECHANISM OF ACTION|PHARMACOKINETICS|DOSAGE AND ADMINISTRATION)\s*[:\-]?\s*/;
const fdaTxt = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean).map((x) => String(x).replace(FDA_HEAD, "").replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n\n"); // hanya menghapus judul bagian berhuruf kapital & merapikan spasi
const FDA_MAP = { indications_and_usage: "indications", contraindications: "contraindications", adverse_reactions: "adverse", warnings: "warnings", warnings_and_cautions: "warnings", drug_interactions: "interactions", mechanism_of_action: "moa", pharmacokinetics: "pk", dosage_and_administration: "dosing" };
const singleIngredient = (gn, n) => gn.length === 1 && (gn[0] === n || (gn[0].startsWith(n + " ") && !/(\band\b|,|\/|\bwith\b|\+)/.test(gn[0]))); // bahan tunggal (garam diperbolehkan), kombinasi ditolak
async function syncOpenfda(name, env) {
  const key = env && env.OPENFDA_API_KEY ? "&api_key=" + encodeURIComponent(env.OPENFDA_API_KEY) : "";
  const r = await xf("https://api.fda.gov/drug/label.json?search=" + encodeURIComponent('openfda.generic_name:"' + name + '"') + "&limit=5" + key);
  const n = lc(name), hits = (r && r.results || []).filter((x) => singleIngredient(((x.openfda || {}).generic_name || []).map(lc), n));
  if (!hits.length) return null;
  const exact = (x) => (((x.openfda || {}).generic_name || [])[0] || "").toLowerCase().trim() === n ? 1 : 0; // nama persis didahulukan dari bentuk garam
  hits.sort((a, b) => exact(b) - exact(a) || (b.indications_and_usage ? 1 : 0) - (a.indications_and_usage ? 1 : 0)); const L = hits[0], of = L.openfda || {}, facts = {};
  for (const [k, f] of Object.entries(FDA_MAP)) { if (facts[f]) continue; const t = fdaTxt(L[k]); if (t) facts[f] = t; }
  if ((of.route || []).length) facts.routes = of.route.join(", ");
  const strip = (x, tag) => String(x).replace(new RegExp("\\s*\\[" + tag + "\\]\\s*$"), "").trim();
  const cats = [...(of.pharm_class_epc || []).map((x) => ({ kind: "pharm_class", name: strip(x, "EPC") })), ...(of.pharm_class_moa || []).map((x) => ({ kind: "moa", name: strip(x, "MoA") }))].filter((c) => c.name);
  return { sid: String(L.set_id || L.id || ""), brands: (of.brand_name || []).slice(0, 10), facts, categories: cats, pharm_class: cats.find((c) => c.kind === "pharm_class") ? cats.find((c) => c.kind === "pharm_class").name : "" };
}
async function syncChembl(name) {
  const base = "https://www.ebi.ac.uk/chembl/api/data/", n = lc(name);
  let m = ((await xf(base + "molecule.json?pref_name__iexact=" + encodeURIComponent(name) + "&limit=1")) || {}).molecules;
  m = m && m[0];
  if (!m) { const c = ((await xf(base + "molecule/search.json?q=" + encodeURIComponent(name) + "&limit=5")) || {}).molecules || []; m = c.find((x) => lc(x.pref_name) === n || (x.molecule_synonyms || []).some((y) => lc(y.molecule_synonym) === n)); }
  if (!m) return null;
  const id = m.molecule_chembl_id, mech = ((await xf(base + "mechanism.json?molecule_chembl_id=" + encodeURIComponent(id) + "&limit=20")) || {}).mechanisms || [];
  const tids = uniq(mech.map((x) => x.target_chembl_id).filter(Boolean)).slice(0, 10), tmap = {};
  if (tids.length) for (const t of ((await xf(base + "target.json?target_chembl_id__in=" + tids.join(",") + "&limit=20")) || {}).targets || []) tmap[t.target_chembl_id] = t;
  const tnames = uniq(mech.map((x) => tmap[x.target_chembl_id]).filter(Boolean).map((t) => t.pref_name).filter(Boolean));
  const facts = { moa: uniq(mech.map((x) => clip(x.mechanism_of_action, 300)).filter(Boolean)).join("\n"), targets: uniq(mech.map((x) => tmap[x.target_chembl_id]).filter(Boolean).map((t) => t.pref_name + (t.organism ? " (" + t.organism + ")" : ""))).join("\n") };
  for (const k of Object.keys(facts)) if (!facts[k]) delete facts[k];
  const syn = uniq((m.molecule_synonyms || []).map((x) => x.molecule_synonym).filter((x) => x && !junkSyn(x) && lc(x) !== n)).slice(0, 15);
  return { sid: String(id), syn, facts, categories: tnames.map((t) => ({ kind: "target", name: t })) };
}
const SYNCERS = { pubchem: syncPubchem, rxnorm: syncRxnorm, chembl: syncChembl, openfda: syncOpenfda };
const DAY = 864e5;
const getMeta = async (db, k, d) => { const r = await db.prepare("SELECT v FROM fm_meta WHERE k = ?").bind(k).first(); return r ? r.v : d; };
const setMeta = (db, k, v) => db.prepare("INSERT INTO fm_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(k, String(v)).run();

// satu obat × satu sumber, lewat jalur impor yang aman (tidak menimpa data terbit). state: ok 1 = berhasil, 2 = tidak ditemukan, 0 = galat
async function syncOne(db, env, d, src, u) {
  const t = Date.now(); let ok = 1, msg = "";
  try {
    const r = await SYNCERS[src](d.generic, env);
    if (!r) { ok = 2; msg = "tidak ditemukan di " + src; }
    else { const x = await saveDrug(db, { id: d.id, generic: d.generic, brands: r.brands, synonyms: r.syn, pharm_class: r.pharm_class, facts: r.facts, categories: r.categories, xref: r.sid ? { [src]: r.sid } : {}, source_id: r.sid }, u, src, true); const got = Object.keys(r.facts || {}); msg = "ok " + (r.sid || "") + (got.length ? " · bidang: " + got.join(", ") : " · hanya identitas/nama, TANPA bidang isi (sumber tidak punya datanya)") + (x.pend ? " · " + x.pend + " pembaruan menunggu persetujuan" : ""); }
  } catch (e) { ok = 0; msg = "gagal: " + clip(e && e.message, 100); }
  try { await db.prepare("INSERT INTO fm_sync_state (drug_id, src, t, ok, msg) VALUES (?, ?, ?, ?, ?) ON CONFLICT(drug_id, src) DO UPDATE SET t = excluded.t, ok = excluded.ok, msg = excluded.msg").bind(d.id, src, t, ok, msg).run(); } catch (e) { msg += " (status tidak tercatat: " + clip(e && e.message, 60) + ")"; }
  return { id: d.id, generic: d.generic, ok, r: msg };
}
// Dipanggil Cloudflare Cron (scheduled) atau tombol admin. Hanya sumber yang diaktifkan admin ("otomatis"); batch kecil per sumber agar tidak melewati batas subrequest.
export async function farmakoCron(env, u = "cron") {
  const db = await fmDb(env); if (!db) return { skipped: "D1 belum terpasang" };
  const batch = Math.min(10, Math.max(1, int(await getMeta(db, "cron_batch", "1"), 1))), days = Math.max(1, int(await getMeta(db, "refresh_days", "30"), 30)), out = [], t = Date.now();
  for (const src of Object.keys(SYNCERS)) {
    if (out.length >= batch) break; // batch = total sinkron per putaran (semua sumber)
    if ((await getMeta(db, "auto:" + src, "0")) !== "1") continue;
    const en = await db.prepare("SELECT enabled FROM fm_sources WHERE code = ?").bind(src).first(); if (!en || !en.enabled) continue;
    const due = (await db.prepare("SELECT d.id, d.generic FROM fm_drugs d LEFT JOIN fm_sync_state s ON s.drug_id = d.id AND s.src = ? WHERE d.active = 1 AND (s.t IS NULL OR s.t < ? - (CASE WHEN s.ok = 0 THEN ? ELSE ? END)) ORDER BY COALESCE(s.t, 0) LIMIT ?").bind(src, t, DAY, days * DAY, batch - out.length).all()).results;
    let n = 0, bad = 0; for (const d of due) { const r = await syncOne(db, env, d, src, u); n++; if (r.ok === 0) bad++; out.push({ src, ...r }); }
    if (n) { await db.prepare("UPDATE fm_sources SET last_sync = ? WHERE code = ?").bind(Date.now(), src).run(); await db.prepare("INSERT INTO fm_sync_log (t, u, src, act, ok, n_in, n_up, n_skip, msg) VALUES (?, ?, ?, 'sinkron terjadwal', ?, 0, ?, ?, ?)").bind(Date.now(), u, src, bad ? 0 : 1, n - bad, bad, clip(due.map((d) => d.generic).join(", "), 300)).run(); }
  }
  if (out.length) dirty();
  return { ran: out.length, out };
}

// ---------- terjemahan ke Bahasa Indonesia ----------
// Penyedia: binding Workers AI (`AI`) ATAU endpoint LibreTranslate (`LIBRETRANSLATE_URL`, opsional `LIBRETRANSLATE_KEY`). Hasil mesin SELALU berlabel, teks asli tetap rujukan.
const fnv = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16) + ":" + str.length; };
// Versi aturan terjemahan (glosarium istilah baku). Naikkan angka ini bila daftar istilah berubah:
// hash cache ikut berubah, sehingga terjemahan otomatis lama tidak dipakai ulang dan dibuat ulang
// dengan glosarium terbaru. Terjemahan berstatus "verified" (hasil kurasi admin) tetap dipertahankan.
export const TR_VER = "2026-11-14c";
export const trHash = (s) => fnv(String(s == null ? "" : s) + "|" + TR_VER);
const ID_W = new Set("yang dan untuk dengan pada dari adalah atau tidak dalam ini itu dapat oleh akan sebagai juga karena telah dapat harus sebaiknya pasien obat".split(" ")), EN_W = new Set("the of and to in is with for or may not be are by as this that should patients has have been is was from".split(" "));
const looksId = (t) => { const w = String(t).toLowerCase().match(/[a-z]+/g) || []; let a = 0, b = 0; for (const x of w) { if (ID_W.has(x)) a++; if (EN_W.has(x)) b++; } return w.length >= 3 && a > b; };
const trProvider = (env) => (env && env.AI && env.AI.run ? "ai" : env && env.LIBRETRANSLATE_URL ? "libre" : "");
async function trChunk(env, text) {
  if (env.AI && env.AI.run) {
    let r; try { r = await env.AI.run("@cf/meta/m2m100-1.2b", { text, source_lang: "en", target_lang: "id" }); } catch (e1) { try { r = await env.AI.run("@cf/meta/m2m100-1.2b", { text, source_lang: "english", target_lang: "indonesian" }); } catch (e2) { throw new Error(clip(e2 && e2.message || e1 && e1.message, 120)); } }
    const o = r && (r.translated_text || r.response); if (!o) throw new Error("respons terjemahan kosong"); return String(o);
  }
  if (env.LIBRETRANSLATE_URL) {
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 15000);
    try { const r = await fetch(env.LIBRETRANSLATE_URL, { method: "POST", signal: ac.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ q: text, source: "en", target: "id", format: "text", ...(env.LIBRETRANSLATE_KEY ? { api_key: env.LIBRETRANSLATE_KEY } : {}) }) }); if (!r.ok) throw new Error("HTTP " + r.status); const j = await r.json(); if (!j.translatedText) throw new Error("respons terjemahan kosong"); return String(j.translatedText); } finally { clearTimeout(tm); }
  }
  throw new Error("Terjemahan belum dikonfigurasi (butuh binding AI atau LIBRETRANSLATE_URL).");
}
// Penerjemah utama: model bahasa (instruksi + glosarium) — jauh lebih akurat untuk teks medis daripada MT umum
// karena paham konteks dan bisa diperintah "istilah medis jangan diterjemahkan". MT (m2m100/LibreTranslate) jadi cadangan.
const TR_LLM = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const TR_SYS = [
  "You are a professional medical translator (English to Indonesian) for pharmacology students.",
  "Translate the user's text faithfully into natural, grammatical Indonesian (Bahasa Indonesia baku).",
  "STRICT RULES:",
  "1. Output ONLY the translation: no notes, no quotes, no markdown, no explanation.",
  "2. NEVER translate medical, pharmacological, biochemical, anatomical or scientific terms. Keep them exactly as written in English, e.g. lactone, hydrolyzed, in vivo, pharmacokinetics, half-life, clearance, bioavailability, plasma, metabolite, inhibitor, receptor, enzyme, agonist, antagonist, adverse reactions, contraindication, steady state, first-pass.",
  "3. Also keep unchanged: drug and brand names, enzyme/protein/gene names (CYP3A4, HMG-CoA reductase), species names (Homo sapiens), abbreviations (PK, AUC, Cmax), units, doses, numbers, percentages, comparison signs, section numbers (12.3), table numbers, cross-references such as [see Warnings and Precautions (5.1)], label section headings, URLs and phone numbers.",
  "4. Translate only the ordinary connecting language (grammar words, common verbs, nouns, adjectives) so each sentence reads fluently in Indonesian with the English medical terms embedded.",
  "5. Never add, omit, summarize, soften or reorder information. Every sentence, number and negation must be preserved. Keep modality exact: may = dapat/mungkin, should = sebaiknya, must = harus, not recommended = tidak dianjurkan, contraindicated = contraindicated.",
  "6. Keep the same line breaks as the input, and keep bullet symbols (•, ◦) and numbering exactly where they are. Write every number with digits, never with words.",
].join("\n");
const TR_SHOT_IN = "12.3 Pharmacokinetics Simvastatin is a lactone that is readily hydrolyzed in vivo to the corresponding β-hydroxyacid. Pharmacokinetics (PK) of simvastatin and its metabolites was originally characterized using inhibition of HMG-CoA reductase activity following base hydrolysis of plasma samples, as specific bioanalytical methods were not available.";
const TR_SHOT_OUT = "12.3 Pharmacokinetics Simvastatin adalah lactone yang mudah mengalami hydrolysis in vivo menjadi β-hydroxyacid yang sesuai. Pharmacokinetics (PK) simvastatin dan metabolites-nya semula dikarakterisasi melalui inhibition aktivitas HMG-CoA reductase setelah hydrolysis basa pada plasma samples, karena metode bioanalytical yang spesifik belum tersedia.";
async function trLLM(env, text) {
  const r = await env.AI.run(env.TR_MODEL || TR_LLM, { messages: [{ role: "system", content: TR_SYS }, { role: "user", content: TR_SHOT_IN }, { role: "assistant", content: TR_SHOT_OUT }, { role: "user", content: text }], temperature: 0, max_tokens: 2048 });
  const o = r && (typeof r.response === "string" ? r.response : r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content);
  if (!o || !String(o).trim()) throw new Error("respons terjemahan kosong");
  return String(o).trim().replace(/^```[a-z]*\n?|```$/g, "").replace(/^["“](.*)["”]$/s, "$1").trim();
}
// Satu potongan teks → terjemahan. 1) LLM (+ pemeriksaan ketat) 2) MT dengan istilah dilindungi (placeholder). Mengembalikan { text, via, low }.
export async function trPiece(env, t) {
  if (env.AI && env.AI.run && env.TR_MODEL !== "m2m100") {
    try { const o = await trLLM(env, t); if (!trCheck(t, o)) return { text: o, via: "llm" }; } catch (e) { /* lanjut ke cadangan */ }
  }
  const mk = maskTerms(t);
  if (!/[A-Za-z]{2}/.test(mk.text)) return { text: t.trim(), via: "keep" }; // seluruhnya istilah baku → biarkan apa adanya
  try {
    const un = unmaskTerms(await trChunk(env, mk.text), mk.terms), o = fixTr(un.text).trim();
    if (!un.missing && !trCheck(t, o)) return { text: o, via: "mt" };
  } catch (e) { /* mesin cadangan gagal */ }
  return { text: t.trim(), via: "orig" }; // hanya potongan ini yang dibiarkan Inggris; potongan lain tetap diterjemahkan
}
// "e.g. ", "i.e. ", "vs. ", dst. bukan akhir kalimat: dilindungi agar kalimat tidak terpotong di tengah
const ABBR = /\b(e\.g|i\.e|vs|approx|et al|Fig|Figs|No|Nos|Dr|St|ca|cf|incl|resp)\.\s/gi;
export function splitText(text, max = Math.min(2400, Math.max(900, Math.ceil(String(text).length / 12)))) { // paragraf → kalimat, tiap potongan ≤ max; sambungan paragraf dipertahankan
  const out = [];
  text.split(/\n{2,}/).forEach((para, pi) => {
    let cur = ""; const parts = para.replace(/[ \t]+/g, " ").trim().replace(ABBR, "$1.\u0001").split(/(?<=[.!?;])\s+/).map((x) => x.replace(/\u0001/g, " "));
    const flush = () => { if (cur.trim()) out.push({ t: cur.trim(), sep: " " }); cur = ""; };
    for (let p of parts) { while (p.length > max) { flush(); out.push({ t: p.slice(0, max), sep: " " }); p = p.slice(max); } if ((cur + " " + p).length > max) flush(); cur += (cur ? " " : "") + p; }
    flush(); if (out.length && pi >= 0) out[out.length - 1].sep = "\n\n";
  });
  return out;
}
const TR_INTER = ["mechanism", "effect", "management", "evidence"];
async function trSource(db, ent, ref, field, admin) {
  if (ent === "fact") { const r = await db.prepare(`SELECT f.value v FROM fm_drug_facts f JOIN fm_drugs d ON d.id = f.drug_id WHERE f.id = ?${admin ? "" : " AND d.status = 'published' AND d.active = 1"}`).bind(ref).first(); return r ? r.v : null; }
  if (ent === "inter" && TR_INTER.includes(field)) { const r = await db.prepare(`SELECT ${field} v FROM fm_inter WHERE id = ?${admin ? "" : " AND status = 'published'"}`).bind(ref).first(); return r ? r.v : null; }
  return null;
}
const trUp = (db, ent, ref, field, h, text, status, t) => db.prepare("INSERT INTO fm_tr (ent, ref, field, h, text, status, t) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(ent, ref, field) DO UPDATE SET h = excluded.h, text = excluded.text, status = excluded.status, t = excluded.t").bind(ent, ref, field, h, text, status, t).run();
const dayKey = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
async function trQuota(db, env, u) { const max = int(env.TR_DAILY_MAX, 150), k = "trq:" + u + ":" + dayKey(), v = int(await getMeta(db, k, "0")); if (v >= max) return false; await setMeta(db, k, v + 1); return true; }
// menerjemahkan SATU item (dibatasi agar aman dari batas subrequest); hasil disimpan sehingga tidak dihitung ulang
async function trDo(db, env, ent, ref, field, o) {
  const src = await trSource(db, ent, ref, field, o.admin); if (!src || !src.trim()) return { err: "Teks tidak ditemukan.", s: 404 };
  const h = trHash(src), ex = await db.prepare("SELECT h, text, status FROM fm_tr WHERE ent = ? AND ref = ? AND field = ?").bind(ent, ref, field).first();
  if (ex && (ex.status === "verified" || ex.h === h) && !(o.force && o.admin)) return { text: ex.text, status: ex.status, cached: true };
  if (looksId(src)) { await trUp(db, ent, ref, field, h, "", "id", Date.now()); return { status: "id", text: "" }; }
  if (!trProvider(env)) return { err: "Terjemahan belum diaktifkan oleh admin.", s: 503 };
  if (!o.admin && !(await trQuota(db, env, o.u))) return { err: "Batas terjemahan harian tercapai. Coba lagi besok.", s: 429 };
  const ch = splitText(src); if (ch.length > 14) return { err: "Teks terlalu panjang untuk diterjemahkan.", s: 413 };
  let txt = "", done = 0, kept = 0;
  for (const c of ch) {
    if (!/[A-Za-z]{2}/.test(c.t)) { txt += c.t + c.sep; continue; }
    const pc = await trPiece(env, c.t);
    if (pc.via === "mt" || pc.via === "llm") done++; else if (pc.via === "orig") kept++;
    txt += pc.text + c.sep;
  }
  txt = txt.trim();
  if (!done && !kept) { await trUp(db, ent, ref, field, h, "", "id", Date.now()); return { status: "id", text: "" }; }
  if (!done) { await trUp(db, ent, ref, field, h, "", "low", Date.now()); return { text: "", status: "low", warn: "Terjemahan mesin ditolak (hasil tidak lolos pemeriksaan istilah/angka). Teks asli tetap ditampilkan." }; }
  await trUp(db, ent, ref, field, h, txt, "auto", Date.now()); return { text: txt, status: "auto" };
}


// ---------- istilah baku yang DIPERTAHANKAN saat terjemahan ----------
// Mesin terjemahan umum sering mengubah istilah farmakologi baku sehingga maknanya bergeser
// (mis. "clearance", "agonist", "CYP3A4"). Istilah di daftar ini tidak diterjemahkan.
export const KEEP_TERMS = ["CYP1A2", "CYP2C9", "CYP2C19", "CYP2D6", "CYP2E1", "CYP3A4", "CYP3A5", "UGT1A1", "UGT2B7", "OATP1B1", "OATP1B3", "P-gp", "P-glycoprotein", "BCRP", "MDR1", "MRP2", "5-HT", "QTc", "INR", "aPTT", "AUC", "Cmax", "Tmax", "t1/2", "IC50", "EC50", "Ki", "Km", "pKa", "InChIKey", "SMILES", "NSAID", "NSAIDs", "SSRI", "SNRI", "TCA", "MAOI", "ARB", "PPI", "COX-1", "COX-2", "HMG-CoA", "in vitro", "in vivo", "ex vivo", "first-pass", "placebo", "randomized controlled trial", "systematic review", "meta-analysis", "PubMed", "Cochrane", "FDA", "EMA", "WHO", "BPOM", "DDInter", "DrugBank", "PubChem", "RxNorm", "ChEMBL", "openFDA", "KEGG", "mg", "mcg", "mL", "kg", "mmol", "IU", "IV", "IM", "SC", "PO", "qd", "bid", "tid", "qid", "prn", "stat"];
const escRe = (x) => x.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
// Istilah medis/farmakologi baku yang DIPERTAHANKAN apa adanya: menerjemahkannya menggeser makna.
const KEEP_EXTRA = ["Homo sapiens", "Homo sapiens sapiens", "Mus musculus", "Rattus norvegicus", "Escherichia coli", "Saccharomyces cerevisiae", "Candida albicans", "Drosophila melanogaster", "Danio rerio", "Sus scrofa", "Bos taurus", "Macaca mulatta", "Oryctolagus cuniculus", "Xenopus laevis", "clearance", "half-life", "steady state", "steady-state", "bioavailability", "volume of distribution", "therapeutic index", "first-pass metabolism", "prodrug", "metabolite", "glucuronidation", "hydrolysis", "efflux", "affinity", "agonist", "antagonist", "partial agonist", "inverse agonist", "ligand", "substrate", "inducer", "isoform", "polymorphism", "genotype", "phenotype", "allele", "nocebo", "loading dose", "maintenance dose", "therapeutic drug monitoring", "serum concentration", "adverse drug reaction", "contraindication", "receptor", "enzyme", "transporter", "cyclooxygenase", "prostaglandin", "thromboxane", "leukotriene", "angiotensin", "bradykinin", "renin", "aldosterone", "cortisol", "insulin", "glucagon", "serotonin", "dopamine", "norepinephrine", "epinephrine", "acetylcholine", "histamine", "GABA", "glutamate", "opioid", "cannabinoid", "cytokine", "interleukin", "tumor necrosis factor", "monoamine oxidase", "acetylcholinesterase", "carbonic anhydrase", "HMG-CoA reductase", "DNA gyrase", "dihydrofolate reductase", "topoisomerase", "beta-lactam", "penicillin-binding protein", "Pharmacokinetics", "pharmacokinetic", "pharmacodynamics", "pharmacodynamic", "Mechanism of Action", "Clinical Pharmacology", "lactone", "lactones", "hydrolyzed", "hydrolyze", "hydrolysis", "hydroxyacid", "hydroxy acid", "bioanalytical", "plasma", "plasma samples", "plasma concentration", "serum", "whole blood", "enzyme activity", "inhibitor", "inhibitors", "metabolites", "active metabolite", "glucuronide", "conjugation", "chromatography", "mass spectrometry", "HPLC", "LC-MS/MS", "placebo-controlled", "double-blind", "adverse event", "serious adverse event", "agonism", "antagonism", "inhibition", "coadministration", "co-administration", "therapeutic range", "renal clearance", "hepatic clearance", "biliary excretion", "enterohepatic circulation", "dose proportionality", "single dose", "multiple dose", "food effect", "bioequivalence", "bioequivalent", "protein binding", "plasma protein binding", "Absorption", "Distribution", "Metabolism", "Excretion", "Elimination", "Indications and Usage", "Dosage and Administration", "Dosage Forms and Strengths", "Contraindications", "Warnings and Precautions", "Adverse Reactions", "Drug Interactions", "Use in Specific Populations", "Overdosage", "Description", "Clinical Studies", "Nonclinical Toxicology", "How Supplied", "Clinical Trials Experience", "Postmarketing Experience", "Pharmacogenomics", "Pediatric Use", "Geriatric Use", "Renal Impairment", "Hepatic Impairment", "half life", "elimination half-life", "terminal half-life", "dose-dependent", "dose-proportional", "time to peak", "peak concentration", "peak plasma concentration", "trough concentration", "area under the curve", "mean residence time", "volume of distribution", "tissue distribution", "blood-brain barrier", "placental transfer", "protein-bound", "lipophilic", "hydrophilic", "hepatotoxicity", "nephrotoxicity", "cardiotoxicity", "rhabdomyolysis", "myopathy", "hypoglycemia", "hyperglycemia", "hypotension", "hypertension", "bradycardia", "tachycardia", "QT prolongation", "anaphylaxis", "angioedema", "extrapyramidal", "serotonin syndrome", "neuroleptic malignant syndrome", "Stevens-Johnson syndrome", "agranulocytosis", "thrombocytopenia", "neutropenia", "hyperkalemia", "hypokalemia", "hyponatremia", "teratogenic", "embryo-fetal toxicity", "lactation", "oral", "intravenous", "intramuscular", "subcutaneous", "topical", "sublingual", "transdermal", "inhalation", "extended-release", "immediate-release", "delayed-release"];
const ALL_KEEP = KEEP_TERMS.concat(KEEP_EXTRA);
// Singkatan/simbol (huruf besar, angka, ≤3 huruf) dicocokkan persis; kata biasa tanpa membedakan huruf besar-kecil
// ("Plasma" di awal kalimat juga dilindungi). Yang tertangkap disimpan apa adanya, jadi kapitalisasi asli terjaga.
const isStrict = (x) => x.length <= 3 || /\d/.test(x) || (!/\s/.test(x) && /[A-Z]/.test(x.slice(1)));
const keepAlt = (arr) => arr.slice().sort((a, b) => b.length - a.length).map(escRe).join("|");
const KEEP_STRICT_RE = new RegExp("\\b(?:" + keepAlt(ALL_KEEP.filter(isStrict)) + ")\\b", "g");
const KEEP_WORD_RE = new RegExp("\\b(?:" + keepAlt(ALL_KEEP.filter((x) => !isStrict(x))) + ")\\b", "gi");
// Pola nama ilmiah: enzim/protein/gen, genus–spesies, akronim, simbol gen, senyawa berkode.
const ENZ = "(?:ATPase|kinase|reductase|oxidase|synthase|transferase|hydrolase|ligase|isomerase|phosphatase|dehydrogenase|hydroxylase|esterase|peptidase|polymerase|topoisomerase|lipoxygenase|oxygenase|protease|transporter|receptor|channel|subunit)";
const SCI_PATTERNS = [
  new RegExp("\\([A-Z][a-z]{3,}\\s+[a-z]{4,}\\)", "g"),                                  // (Homo sapiens) — nama spesies dalam kurung
  new RegExp("\\b[A-Z][a-z]+(?:-[a-z0-9]+)+(?=\\s+[A-Za-z-]*" + ENZ + "\\b)", "g"),       // Potassium-transporting ATPase
  new RegExp("\\b[A-Za-z-]*" + ENZ + "\\b", "g"),                                          // nama enzim/protein/reseptor
  /\b[A-Z]{2,6}[a-z0-9]*\b/g,                                                                // akronim: CHD, LDL, FDA, CYP3A4 (bukan kata kapital biasa)
  /\b[A-Za-z]{1,6}\d+[A-Za-z0-9]*\b/g,                                                        // simbol gen/senyawa berkode
  /\b[A-Z]-[A-Za-z0-9]+\b/g,
];
export function sciTokens(text) { const out = new Set(), s = String(text == null ? "" : text); for (const re of SCI_PATTERNS) { re.lastIndex = 0; for (const m of s.match(re) || []) out.add(m.trim()); } return out; }
export function maskTerms(text) {
  const terms = [], put = (m) => { terms.push(m); return "⟦" + (terms.length - 1) + "⟧"; };
  let out = String(text).replace(KEEP_STRICT_RE, put).replace(KEEP_WORD_RE, put);
  for (const re of SCI_PATTERNS) { re.lastIndex = 0; out = out.replace(re, put); }
  return { text: out, terms };
}
export function unmaskTerms(text, terms) {
  let missing = false;
  const out = String(text).replace(/[⟦\[«]\s*(\d+)\s*[⟧\]»]/g, (m, i) => { const v = terms[+i]; if (v == null) { missing = true; return m; } return v; });
  if (/[⟦\[«]\s*\d+\s*[⟧\]»]/.test(out)) missing = true;
  return { text: out, missing };
}
// koreksi istilah yang sudah baku di Indonesia (mesin sering memilih padanan yang mengubah makna)
const TR_FIX = [
  [/\bmekanisme tindakan\b/gi, "mekanisme kerja"],
  [/\bwaktu paruh eliminasi\b/gi, "elimination half-life"],
  [/\b(?:waktu setengah hidup|waktu paruh|paruh waktu|setengah hidup)\b/gi, "half-life"],
  [/\bketersediaan hayati\b/gi, "bioavailability"],
  [/\b(?:klirens|pembersihan ginjal)\b/gi, "clearance"],
  [/\bvolume distribusi\b/gi, "volume of distribution"],
  [/\binteraksi obat-obatan\b/gi, "interaksi obat"],
  [/\bobat-obatan\b/gi, "obat"],
  [/\btindakan obat\b/gi, "kerja obat"],
  [/\btingkat keparahan\b/gi, "keparahan"],
  [/\bjalur pemberian\b/gi, "rute pemberian"],
  [/\bpengangkutan kalium atpase\b/gi, "Potassium-transporting ATPase"],
  [/\batpase pengangkutan kalium\b/gi, "Potassium-transporting ATPase"],
  [/\bsiklooksigenase\b/gi, "Cyclooxygenase"],
  [/\bmanusia \(homo sapiens\)\b/gi, "(Homo sapiens)"],
];
export function fixTr(t) { let o = String(t); for (const p of TR_FIX) o = o.replace(p[0], p[1]); return o; }
// Bentuk longgar untuk membandingkan istilah baku: "reseptor"≈"receptor", "enzim"≈"enzyme", "hipotensi"≈"hypotension".
// Yang dicari hanya istilah yang HILANG sama sekali atau berubah jadi kata lain (mis. lactone → laktosa).
const nz = (x) => String(x).toLowerCase().replace(/ph/g, "f").replace(/th/g, "t").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/[yz]/g, (m) => (m === "y" ? "i" : "s")).replace(/(.)\1+/g, "$1");
const stemOf = (w) => { const n = nz(w).replace(/[^a-z0-9]/g, ""); return n.slice(0, Math.max(3, Math.min(6, n.length - 1))); };
export function keepTokens(text) { const out = new Map(), s = String(text == null ? "" : text); for (const re of [KEEP_STRICT_RE, KEEP_WORD_RE]) { re.lastIndex = 0; for (const m of s.match(re) || []) out.set(m.toLowerCase(), m); } return [...out.values()]; }
const nums = (x) => (String(x).replace(/\b(\d)\.\s+(\d)/g, "$1.$2").match(/\d[\d.,]*/g) || []).map((n) => n.replace(/[.,]+$/, "").replace(/[.,]/g, "")).filter(Boolean);
// tolak hasil mesin yang tidak layak dipakai: lebih baik teks asli daripada terjemahan yang salah
export function trCheck(src, out) {
  const a = String(src).trim(), b = String(out).trim();
  if (!b) return "hasil kosong";
  if (b.length < a.length * 0.25) return "hasil terlalu pendek";
  if (b.length > a.length * 4) return "hasil terlalu panjang";
  // istilah medis/ilmiah wajib utuh: lebih baik teks asli daripada istilah yang berubah makna
  for (const tk of sciTokens(a)) if (!b.includes(tk)) return "istilah medis berubah: " + clip(tk, 60);
  // istilah farmakologi baku (glosarium) tidak boleh hilang/berubah
  const bl = b.toLowerCase(), bn = nz(b);
  for (const tk of keepTokens(a)) { const ok = /\s/.test(tk) || isStrict(tk) ? bl.includes(tk.toLowerCase()) : bn.includes(stemOf(tk)); if (!ok) return "istilah baku berubah: " + clip(tk, 60); }
  // setiap angka/dosis/persentase di sumber harus ada di hasil (angka salah = informasi klinis salah)
  const have = new Map(); for (const n of nums(b)) have.set(n, (have.get(n) || 0) + 1);
  for (const n of nums(a)) { const c = have.get(n) || 0; if (!c) return "angka berubah: " + n; have.set(n, c - 1); }
  for (const u of a.match(/(?:https?:\/\/|www\.)[^\s)]+/g) || []) if (!b.includes(u)) return "tautan berubah";
  if (lc(a) === lc(b) && !looksId(a)) return "teks tidak berubah (bukan terjemahan)";
  return "";
}

// ---------- impor massal: SETIAP baris langsung tersimpan, hemat kuota D1 ----------
// Paket gratis D1 membatasi jumlah kueri per permintaan (±50) dan 100 parameter per pernyataan.
// Karena itu baris dikirim bertahap oleh klien dan ditulis dengan satu pernyataan multi-baris.
function multiIns(db, table, cols, rows, opt) {
  const out = [], per = Math.max(1, Math.floor(100 / cols.length));
  for (const part of chunk(rows, per)) {
    const ph = part.map(() => "(" + cols.map(() => "?").join(",") + ")").join(",");
    out.push(db.prepare((opt || "INSERT OR IGNORE") + " INTO " + table + " (" + cols.join(",") + ") VALUES " + ph).bind(...part.flat()));
  }
  return out;
}
const catList = (v) => Array.isArray(v) ? v : (typeof v === "string" ? v.split("|").map((x) => { const i = x.indexOf(":"); return i > 0 ? { kind: x.slice(0, i).trim(), name: x.slice(i + 1).trim() } : null; }).filter(Boolean) : []);
const targetOf = (v) => v === "published" || v === "publish" ? "published" : v === true || v === "pending" ? "pending" : "draft";

// Kategori dibuat berjenjang (akar → anak) dan dipakai ulang lintas sumber, agar taksonomi
// dari berkas (mis. path ["Sistem Saraf", "Antikonvulsan"]) tidak kehilangan induknya.
async function ensureCats(db, cats, src, t) {
  const ids = new Map();
  if (!cats.size) return ids;
  const depthOf = (key) => { let d = 0, k = key, g = 0; while (k && g++ < 12) { d++; const c = cats.get(k); k = c ? c.parentKey : ""; } return d; };
  const levels = new Map();
  for (const key of cats.keys()) { const d = depthOf(key); if (!levels.has(d)) levels.set(d, []); levels.get(d).push(key); }
  const idx = new Map();
  const load = async (keys) => {
    const names = uniq(keys.map((k) => lc(cats.get(k).name)));
    for (const part of chunk(names, 90)) for (const x of (await db.prepare("SELECT id, kind, name_lc, parent_id FROM fm_categories WHERE name_lc IN (" + inList(part.length) + ")").bind(...part).all()).results) { const ik = x.kind + "|" + x.name_lc + "|" + (x.parent_id || 0); if (!idx.has(ik)) idx.set(ik, x.id); }
  };
  await load([...cats.keys()]);
  for (const d of [...levels.keys()].sort((a, b) => a - b)) {
    const pend = [];
    for (const k of levels.get(d)) {
      const c = cats.get(k), pid = c.parentKey ? ids.get(c.parentKey) || 0 : 0;
      const hit = idx.get(c.kind + "|" + lc(c.name) + "|" + pid);
      if (hit) ids.set(k, hit); else pend.push([k, c, pid]);
    }
    if (!pend.length) continue;
    await db.batch(multiIns(db, "fm_categories", ["kind", "name", "name_lc", "parent_id", "src", "sid", "created"], pend.map((x) => [x[1].kind, x[1].name, lc(x[1].name), x[2], src, "", t])));
    await load(pend.map((x) => x[0]));
    for (const x of pend) { const hit = idx.get(x[1].kind + "|" + lc(x[1].name) + "|" + x[2]); if (hit) ids.set(x[0], hit); }
  }
  return ids;
}

async function bulkDrugs(db, rows, src, u, target, t) {
  const list = rows.map((r) => ({ r, generic: clip(r.generic, 160) })).filter((x) => x.generic);
  const skipped = [], nskip0 = rows.length - list.length;
  if (nskip0) skipped.push(nskip0 + " baris tanpa kolom generic dilewati.");
  const seen = new Map();
  for (const x of list) if (!seen.has(lc(x.generic))) seen.set(lc(x.generic), x);
  const names = [...seen.keys()], idOf = new Map();
  for (const part of chunk(names, 90)) for (const x of (await db.prepare("SELECT id, generic_lc FROM fm_drugs WHERE generic_lc IN (" + inList(part.length) + ")").bind(...part).all()).results) if (!idOf.has(x.generic_lc)) idOf.set(x.generic_lc, x.id);
  const neu = [...seen.values()].filter((x) => !idOf.has(lc(x.generic)));
  if (neu.length) {
    const vals = neu.map((x) => [x.generic, lc(x.generic), clip(x.r.pharm_class, 160), clip(x.r.ther_class, 160), clip(x.r.classification, 160), clip(x.r.summary, 4000), target, 1, src, t, t]);
    await db.batch(multiIns(db, "fm_drugs", ["generic", "generic_lc", "pharm_class", "ther_class", "classification", "summary", "status", "active", "src", "created", "updated"], vals));
    for (const part of chunk(neu.map((x) => lc(x.generic)), 90)) for (const x of (await db.prepare("SELECT id, generic_lc FROM fm_drugs WHERE generic_lc IN (" + inList(part.length) + ")").bind(...part).all()).results) if (!idOf.has(x.generic_lc)) idOf.set(x.generic_lc, x.id);
  }
  const ids = [...seen.values()].map((x) => ({ id: idOf.get(lc(x.generic)) || 0, r: x.r })).filter((x) => x.id);
  const nm = [], fx = [], cats = new Map(), links = [];
  for (const it of ids) {
    const id = it.id, r = it.r;
    nm.push([id, clip(r.generic, 160), lc(r.generic), "generic", src]);
    const addN = (v, kind) => { for (const b of (Array.isArray(v) ? v : String(v == null ? "" : v).split("|"))) { const n = clip(b, 160); if (n) nm.push([id, n, lc(n), kind, src]); } };
    addN(r.brands, "brand"); addN(r.synonyms, "synonym");
    const f = {};
    for (const k of Object.keys(FIELDS)) if (r[k] != null && String(r[k]).trim()) f[k] = r[k];
    if (r.facts && typeof r.facts === "object") for (const k of Object.keys(r.facts)) if (FIELDS[k] && r.facts[k] != null && String(r.facts[k]).trim()) f[k] = r.facts[k];
    for (const k of Object.keys(f)) fx.push([id, k, clip(f[k], 8000), src, clip(r.source_id || "", 80), t]);
    const addC = (kind, name, parentKey) => { const n = clip(name, 160); if (!n) return ""; const kd = CAT_KINDS[kind] ? kind : "other"; const key = kd + "|" + lc(n) + "|" + (parentKey || ""); if (!cats.has(key)) cats.set(key, { kind: kd, name: n, parentKey: parentKey || "" }); return key; };
    for (const c of catList(r.categories)) {
      const chain = Array.isArray(c.path) && c.path.length ? c.path : [c.name];
      let pk = "";
      for (const nm of chain) pk = addC(c.kind || "other", nm, pk) || pk;
      if (pk) links.push([id, pk]);
    }
    for (const f of [["pharm_class", r.pharm_class], ["ther_class", r.ther_class], ["classification", r.classification]]) { const k = addC(f[0], f[1]); if (k) links.push([id, k]); }
  }
  // fakta: simpan baru; perbarui bila obat belum terbit; catat sebagai TERTUNDA bila obat sudah terbit
  const fxNew = [], fxUpd = [];
  if (fx.length) {
    const dIds = uniq(fx.map((x) => x[0])), ex = new Map(), pub = new Set();
    for (const part of chunk(dIds, 90)) for (const x of (await db.prepare("SELECT id, drug_id, field, src, value FROM fm_drug_facts WHERE drug_id IN (" + inList(part.length) + ")").bind(...part).all()).results) ex.set(x.drug_id + "|" + x.field + "|" + x.src, x);
    for (const part of chunk(dIds, 90)) for (const x of (await db.prepare("SELECT id FROM fm_drugs WHERE status = 'published' AND id IN (" + inList(part.length) + ")").bind(...part).all()).results) pub.add(x.id);
    const seenK = new Set();
    for (const f of fx) {
      const k = f[0] + "|" + f[1] + "|" + f[3];
      if (seenK.has(k)) continue;
      seenK.add(k);
      const cur = ex.get(k);
      if (!cur) { fxNew.push(f); continue; }
      if (cur.value === f[2]) continue;
      fxUpd.push({ id: cur.id, val: f[2], sid: f[4], pend: pub.has(f[0]) });
    }
  }
  const st = [...multiIns(db, "fm_drug_names", ["drug_id", "name", "name_lc", "kind", "src"], nm), ...multiIns(db, "fm_drug_facts", ["drug_id", "field", "value", "src", "sid", "updated"], fxNew)];
  if (st.length) await db.batch(st);
  if (fxUpd.length) await db.batch(fxUpd.map((u) => u.pend
    ? db.prepare("UPDATE fm_drug_facts SET pending = ?, updated = ? WHERE id = ?").bind(u.val, t, u.id)
    : db.prepare("UPDATE fm_drug_facts SET value = ?, pending = NULL, sid = ?, updated = ? WHERE id = ?").bind(u.val, u.sid, t, u.id)));
  if (links.length) {
    const cmap = await ensureCats(db, cats, src, t);
    const lk = links.map((x) => [x[0], cmap.get(x[1])]).filter((x) => x[1]);
    if (lk.length) await db.batch(multiIns(db, "fm_drug_cat", ["drug_id", "cat_id"], lk));
  }
  return { nin: neu.length, nup: ids.length - neu.length, nskip: nskip0, skipped };
}

async function bulkInters(db, rows, src, u, target, t, autoDrugs) {
  const norm = rows.map((r) => {
    const itype = ITYPES[r.type || r.itype] ? (r.type || r.itype) : "ddi";
    return {
      itype,
      a: clip(r.a || r.drug_a || r.Drug_A || r.DrugA, 160),
      b: clip(r.b || r.drug_b || r.Drug_B || r.DrugB, 160),
      severity: clip(r.severity || r.Severity || r.Level || r.level, 40),
      mechanism: clip(r.mechanism, 3000), effect: clip(r.effect, 3000), management: clip(r.management, 3000), evidence: clip(r.evidence, 3000),
      sid: clip(r.source_id || (r.DDInterID_A && r.DDInterID_B ? r.DDInterID_A + "~" + r.DDInterID_B : ""), 80),
    };
  }).filter((r) => r.a);
  const skipped = [];
  const names = uniq(norm.map((r) => (r.itype === "ddi" ? [lc(r.a), lc(r.b)] : [lc(r.a)])).flat().filter(Boolean));
  const map = new Map();
  for (const part of chunk(names, 90)) for (const x of (await db.prepare("SELECT n.name_lc, n.drug_id FROM fm_drug_names n JOIN fm_drugs d ON d.id = n.drug_id WHERE d.active = 1 AND n.name_lc IN (" + inList(part.length) + ")").bind(...part).all()).results) if (!map.has(x.name_lc)) map.set(x.name_lc, x.drug_id);
  // Obat yang belum ada di Pustaka dibuat otomatis dari berkas interaksi, agar TIDAK ADA data yang hilang.
  const missing = autoDrugs ? names.filter((n) => !map.has(n)) : [];
  if (missing.length) {
    await db.batch(multiIns(db, "fm_drugs", ["generic", "generic_lc", "status", "active", "src", "created", "updated"], missing.map((n) => [n, n, target, 1, src, t, t])));
    for (const part of chunk(missing, 90)) for (const x of (await db.prepare("SELECT id, generic_lc FROM fm_drugs WHERE generic_lc IN (" + inList(part.length) + ")").bind(...part).all()).results) if (!map.has(x.generic_lc)) map.set(x.generic_lc, x.id);
    const nm = [];
    for (const r of norm) for (const raw of [r.a, r.itype === "ddi" ? r.b : ""]) { const k = lc(raw), id = k ? map.get(k) : 0; if (id) nm.push([id, clip(raw, 160), k, "generic", src]); }
    if (nm.length) await db.batch(multiIns(db, "fm_drug_names", ["drug_id", "name", "name_lc", "kind", "src"], nm));
  }
  const vals = [];
  let nskip = 0;
  for (const r of norm) {
    let da = map.get(lc(r.a)) || 0, db2 = r.itype === "ddi" ? map.get(lc(r.b)) || 0 : 0;
    const subject = r.itype === "ddi" ? "" : clip(r.b, 300);
    if (!da || (r.itype === "ddi" && (!db2 || da === db2))) { nskip++; if (skipped.length < 8) skipped.push("Obat tidak ditemukan: " + clip(r.a + " × " + r.b, 90)); continue; }
    if (r.itype === "ddi" && da > db2) { const x = da; da = db2; db2 = x; }
    vals.push([r.itype, da, db2, subject, r.severity, r.mechanism, r.effect, r.management, r.evidence, src, r.sid, target, t, t]);
  }
  const res = vals.length ? await db.batch(multiIns(db, "fm_inter", ["itype", "drug_a", "drug_b", "subject", "severity", "mechanism", "effect", "management", "evidence", "src", "sid", "status", "created", "updated"], vals)) : [];
  const nin = res.reduce((n, r) => n + ((r && r.meta && r.meta.changes) || 0), 0);
  return { nin, nup: vals.length - nin, nskip, skipped, created: missing.length };
}

async function bulkImport(db, body, u, t) {
  const src = SRC_CODES.includes(body.src) ? body.src : "";
  if (!src) return err("Pilih sumber data.");
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 40) : [];
  if (!rows.length) return err("Tidak ada baris.");
  const kind = body.kind === "interactions" ? "interactions" : "drugs", target = targetOf(body.publish);
  let r;
  if (kind === "drugs") r = await bulkDrugs(db, rows, src, u, target, t);
  else r = await bulkInters(db, rows, src, u, target, t, body.auto_drugs === true);
  try { await db.prepare("UPDATE fm_sources SET last_sync = ? WHERE code = ?").bind(t, src).run(); } catch (e) { /* sumber tidak terdaftar */ }
  dirty();
  if (body.last) await db.prepare("INSERT INTO fm_sync_log (t, u, src, act, ok, n_in, n_up, n_skip, msg) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)").bind(t, u, src, "impor " + kind, int(body.tot_in) + r.nin, int(body.tot_up) + r.nup, int(body.tot_skip) + r.nskip, "berkas: " + clip(body.file, 80)).run();
  await audit(db, u, "impor." + kind, "import", 0, src + ": +" + r.nin + " ~" + r.nup + " x" + r.nskip + (r.created ? " obat-baru:" + r.created : ""));
  return J({ nin: r.nin, nup: r.nup, nskip: r.nskip, created: r.created || 0, target, skipped: (r.skipped || []).slice(0, 10) });
}

// ---------- semua teknologi/layanan yang dipakai: tanpa biaya ----------
export const FREE_TECH = [
  ["Cloudflare Workers + D1", "Paket gratis; data obat & interaksi tersimpan permanen di D1 (tanpa impor ulang)."],
  ["Cloudflare Workers AI (m2m100)", "Termasuk kuota gratis; hanya untuk menerjemahkan, hasil selalu berlabel mesin dan teks asli tetap ditampilkan."],
  ["DDInter 2.0", "CSV gratis untuk penggunaan non-komersial (CC BY-NC-SA 4.0); wajib mencantumkan sumber."],
  ["PubChem PUG REST / RxNorm (NLM) / openFDA / ChEMBL", "API gratis, tanpa biaya dan tanpa kunci wajib."],
  ["KEGG", "Gratis untuk penggunaan akademik/non-komersial."],
  ["DrugBank", "Hanya halaman publik yang gratis; unduhan data lengkap berlisensi berbayar — impor hanya dari berkas yang Anda miliki izinnya."],
  ["LibreTranslate (opsional)", "Perangkat lunak bebas, dapat dijalankan sendiri tanpa biaya."],
];

// ---------- ekspor ke handler ----------
const drugRow = (d, names) => ({ id: d.id, generic: d.generic, pharm_class: d.pharm_class, ther_class: d.ther_class, classification: d.classification, summary: d.summary, status: d.status, brands: (names || []).filter((n) => n.kind === "brand").map((n) => n.name).slice(0, 4) });
const norm = (s) => String(s || "").trim();

export async function farmakoApi(request, env, a, path, url, body, M) {
  const db = await fmDb(env).catch((e) => { console.error(e); return null; });
  if (!db) return err(env.DB ? "Database Farmakologi belum siap." : "D1 belum terpasang.", 503);
  const qp = (k) => url.searchParams.get(k) || "", t = Date.now(), u = a.u;
  try {
    if (path.startsWith("admin/")) { if (!a.admin) return err("Khusus admin.", 403); return await admin(db, a, path.slice(6), qp, body, M, t, env); }

    if (path === "meta") return J({ fields: FIELDS, kinds: CAT_KINDS, itypes: ITYPES, modes: Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, { n: v.n, d: v.d }])), diffs: DIFF, status: STATUS_ID, sections: SECTIONS, free: FREE_TECH });

    if (path === "home") {
      const one = async (s, ...p) => (await db.prepare(s).bind(...p).first()) || {};
      const c = await one(`SELECT (SELECT COUNT(*) FROM fm_drugs d WHERE ${pubWhere}) drugs, (SELECT COUNT(*) FROM fm_materials WHERE status = 'published') mats, (SELECT COUNT(*) FROM fm_inter WHERE status = 'published') inters`);
      const idx = await catIndex(db), cats = [...idx.values()].filter((x) => x.all.size > 0).length;
      const rc = (await db.prepare("SELECT kind, ref FROM fm_recent WHERE u = ? ORDER BY t DESC LIMIT 8").bind(u).all()).results, recent = [];
      for (const r of rc) {
        if (r.kind === "drug") { const d = await db.prepare(`SELECT id, generic, pharm_class FROM fm_drugs d WHERE ${pubWhere} AND id = ?`).bind(r.ref).first(); if (d) recent.push({ t: "drug", id: d.id, name: d.generic, sub: d.pharm_class }); }
        else { const m = await db.prepare("SELECT id, title FROM fm_materials WHERE status = 'published' AND id = ?").bind(r.ref).first(); if (m) recent.push({ t: "material", id: m.id, name: m.title, sub: "Materi" }); }
      }
      const bm = (await db.prepare("SELECT ref FROM fm_bookmarks WHERE u = ? AND kind = 'drug' ORDER BY t DESC LIMIT 6").bind(u).all()).results, saved = [];
      if (bm.length) for (const d of await byIds(db, (q) => `SELECT id, generic, pharm_class FROM fm_drugs d WHERE ${pubWhere} AND id IN (${q})`, bm.map((x) => x.ref))) saved.push({ id: d.id, name: d.generic, sub: d.pharm_class });
      const pr = await one("SELECT COUNT(*) done FROM fm_progress p JOIN fm_materials m ON m.id = p.mat_id WHERE p.u = ? AND p.done = 1 AND m.status = 'published'", u);
      const topCats = [...idx.values()].filter((x) => x.parent_id === 0 && x.all.size > 0).sort((x, y) => y.all.size - x.all.size).slice(0, 8).map(catOut);
      return J({ counts: { drugs: c.drugs, materials: c.mats, interactions: c.inters, categories: cats }, recent, saved, progress: { done: pr.done, total: c.mats }, topCats });
    }
    if (path === "suggest") return J(await suggest(db, a, qp("q"), { s: ["drug", "cat", "material", "game"].includes(qp("scope")) ? qp("scope") : "all", admin: qp("adm") === "1" }));

    if (path === "cats") {
      const idx = await catIndex(db), kind = qp("kind"), parent = qp("parent"), q = lc(qp("q"));
      let l = [...idx.values()].filter((c) => c.all.size > 0);
      if (kind) l = l.filter((c) => c.kind === kind); if (parent !== "") l = l.filter((c) => c.parent_id === int(parent)); if (q) l = l.filter((c) => c.name_lc.includes(q));
      const kinds = {}; for (const c of idx.values()) if (c.all.size > 0) kinds[c.kind] = (kinds[c.kind] || 0) + 1;
      return J({ cats: l.sort((x, y) => x.sort - y.sort || x.name.localeCompare(y.name)).slice(0, 400).map(catOut), kinds });
    }
    if (path.startsWith("cat/")) {
      const idx = await catIndex(db), c = idx.get(int(path.slice(4))); if (!c) return err("Kategori tidak ditemukan.", 404);
      const ids = [...c.all].slice(0, 300), drugs = await byIds(db, (q) => `SELECT id, generic, pharm_class, ther_class, summary, status FROM fm_drugs d WHERE ${pubWhere} AND id IN (${q}) ORDER BY generic`, ids);
      const names = await drugNames(db, drugs.map((d) => d.id));
      const G = await gameFacts(db);
      const rows = drugs.sort((x, y) => x.generic.localeCompare(y.generic)).map((d) => ({ ...drugRow(d, names.get(d.id)), moa: (G.F.moa.get(d.id) || {}).v || "", ind: (G.F.indications.get(d.id) || {}).v || "" }));
      const mats = (await db.prepare("SELECT id, title FROM fm_materials WHERE status = 'published' AND cat_id = ? ORDER BY sort, title").bind(c.id).all()).results;
      const crumbs = []; for (let p = idx.get(c.parent_id); p; p = idx.get(p.parent_id)) crumbs.unshift({ id: p.id, name: p.name });
      return J({ cat: catOut(c), crumbs, kids: c.kids.filter((k) => k.all.size > 0).sort((x, y) => x.sort - y.sort || x.name.localeCompare(y.name)).map(catOut), drugs: rows, total: c.all.size, materials: mats });
    }
    if (path === "drugs") {
      const q = lc(qp("q")), cat = int(qp("cat")), cls = lc(qp("cls")), pg = Math.max(0, int(qp("pg"))), idx = await catIndex(db);
      let ids = null;
      if (cat) { const c = idx.get(cat); ids = c ? [...c.all] : []; }
      let where = pubWhere, bind = [];
      if (q) { where += " AND d.id IN (SELECT drug_id FROM fm_drug_names WHERE instr(name_lc, ?) > 0)"; bind.push(q); }
      if (cls) { where += " AND lower(d.pharm_class) = ?"; bind.push(cls); }
      let rows = (await db.prepare(`SELECT d.id, d.generic, d.pharm_class, d.ther_class, d.summary, d.status FROM fm_drugs d WHERE ${where} ORDER BY d.generic LIMIT 2000`).bind(...bind).all()).results;
      if (ids) { const s = new Set(ids); rows = rows.filter((r) => s.has(r.id)); }
      const total = rows.length, page = rows.slice(pg * 40, pg * 40 + 40), names = await drugNames(db, page.map((r) => r.id));
      const classes = uniq((await db.prepare(`SELECT DISTINCT d.pharm_class FROM fm_drugs d WHERE ${pubWhere} AND d.pharm_class <> '' ORDER BY 1 LIMIT 300`).all()).results.map((r) => r.pharm_class));
      return J({ total, pg, rows: page.map((r) => drugRow(r, names.get(r.id))), classes });
    }
    if (path.startsWith("drug/") && M === "GET") {
      const id = int(path.slice(5)), d = await db.prepare(`SELECT * FROM fm_drugs d WHERE ${pubWhere} AND id = ?`).bind(id).first(); if (!d) return err("Obat tidak ditemukan atau belum dipublikasikan.", 404);
      const names = (await drugNames(db, [id])).get(id) || [], cats = await drugCats(db, id);
      const facts = (await db.prepare("SELECT id, field, value, src, sid, updated FROM fm_drug_facts WHERE drug_id = ? AND value <> '' ORDER BY field, src").bind(id).all()).results;
      const xref = (await db.prepare("SELECT src, sid, synced FROM fm_drug_xref WHERE drug_id = ? ORDER BY src").bind(id).all()).results;
      const same = d.pharm_class ? (await db.prepare(`SELECT id, generic FROM fm_drugs d WHERE ${pubWhere} AND id <> ? AND lower(pharm_class) = ? ORDER BY generic LIMIT 12`).bind(id, lc(d.pharm_class)).all()).results : [];
      const moa = facts.find((f) => f.field === "moa"); let similar = [];
      if (moa) { const s = short(moa.value); if (s) similar = (await db.prepare(`SELECT DISTINCT d.id, d.generic FROM fm_drug_facts f JOIN fm_drugs d ON d.id = f.drug_id WHERE ${pubWhere} AND f.field = 'moa' AND d.id <> ? AND instr(f.value, ?) = 1 LIMIT 8`).bind(id, s.slice(0, 60)).all()).results.filter((x) => !same.some((y) => y.id === x.id)); }
      const rel = new Set(); for (const c of cats.filter((c) => c.kind !== "classification").slice(0, 3)) { const x = (await catIndex(db)).get(c.id); if (x) x.all.forEach((i) => { if (i !== id && !same.some((y) => y.id === i)) rel.add(i); }); }
      const related = rel.size ? await byIds(db, (q) => `SELECT id, generic FROM fm_drugs d WHERE ${pubWhere} AND id IN (${q}) ORDER BY generic`, [...rel].slice(0, 40)) : [];
      const bm = await db.prepare("SELECT 1 x FROM fm_bookmarks WHERE u = ? AND kind = 'drug' AND ref = ?").bind(u, id).first();
      await db.prepare("INSERT INTO fm_recent (u, kind, ref, t) VALUES (?, 'drug', ?, ?) ON CONFLICT(u, kind, ref) DO UPDATE SET t = excluded.t").bind(u, id, t).run();
      const irows = (await db.prepare("SELECT * FROM fm_inter WHERE status = 'published' AND (drug_a = ? OR drug_b = ?) ORDER BY updated DESC LIMIT 400").bind(id, id).all()).results;
      const oid = uniq(irows.map((r) => (r.drug_a === id ? r.drug_b : r.drug_a)).filter((x) => x > 0)), om = new Map();
      for (const part of chunk(oid, 90)) for (const x of (await db.prepare("SELECT id, generic FROM fm_drugs WHERE id IN (" + inList(part.length) + ")").bind(...part).all()).results) om.set(x.id, x.generic);
      const inter = { total: irows.length, ddi: [], food: [], disease: [], alcohol: [], by_sev: {} };
      for (const r of irows) {
        const other = r.drug_a === id ? r.drug_b : r.drug_a;
        (inter[r.itype] || inter.ddi).push({ ...iOut(r), other: r.itype === "ddi" && other ? { id: other, name: om.get(other) || "" } : null, subject: r.subject });
        if (r.severity) inter.by_sev[r.severity] = (inter.by_sev[r.severity] || 0) + 1;
      }
      inter.ddi.sort((x, y) => sevRank(x.severity) - sevRank(y.severity));
      const ni = irows.length;
      return J({ drug: { id: d.id, generic: d.generic, pharm_class: d.pharm_class, ther_class: d.ther_class, classification: d.classification, summary: d.summary, status: d.status, updated: d.updated, verified_at: d.verified_at }, names, cats, facts, xref, same, similar, related: related.slice(0, 12), bookmarked: !!bm, interactions: ni, inter });
    }
    if (path === "compare") {
      const ids = [int(qp("a")), int(qp("b"))], out = [];
      for (const id of ids) {
        const d = await db.prepare(`SELECT * FROM fm_drugs d WHERE ${pubWhere} AND id = ?`).bind(id).first(); if (!d) return err("Salah satu obat tidak ditemukan.", 404);
        const facts = (await db.prepare("SELECT field, value, src, sid FROM fm_drug_facts WHERE drug_id = ? AND value <> ''").bind(id).all()).results;
        const ni = (await db.prepare("SELECT COUNT(*) n FROM fm_inter WHERE status = 'published' AND (drug_a = ? OR drug_b = ?)").bind(id, id).first()).n;
        out.push({ id, generic: d.generic, pharm_class: d.pharm_class, ther_class: d.ther_class, facts, interactions: ni });
      }
      return J({ drugs: out });
    }
    if (path === "interact" && M === "POST") { const r = await checkInteractions(db, Array.isArray(body.ids) ? body.ids : []); return r.err ? err(r.err) : J(r); }

    if (path === "materials") {
      const rows = (await db.prepare("SELECT m.id, m.title, m.cat_id, m.general, m.sort, COALESCE(p.done, 0) done FROM fm_materials m LEFT JOIN fm_progress p ON p.mat_id = m.id AND p.u = ? WHERE m.status = 'published' ORDER BY m.general DESC, m.sort, m.title").bind(u).all()).results;
      return J({ rows });
    }
    if (path.startsWith("material/")) {
      const id = int(path.slice(9)), m = await db.prepare("SELECT * FROM fm_materials WHERE id = ? AND status = 'published'").bind(id).first(); if (!m) return err("Materi tidak ditemukan atau belum dipublikasikan.", 404);
      const p = await db.prepare("SELECT done FROM fm_progress WHERE u = ? AND mat_id = ?").bind(u, id).first(), b = await db.prepare("SELECT 1 x FROM fm_bookmarks WHERE u = ? AND kind = 'material' AND ref = ?").bind(u, id).first();
      await db.prepare("INSERT INTO fm_recent (u, kind, ref, t) VALUES (?, 'material', ?, ?) ON CONFLICT(u, kind, ref) DO UPDATE SET t = excluded.t").bind(u, id, t).run();
      const rel = (await db.prepare("SELECT id, title FROM fm_materials WHERE status = 'published' AND id <> ? AND (cat_id = ? OR (general = 1 AND ? = 1)) ORDER BY sort LIMIT 6").bind(id, m.cat_id, m.general).all()).results;
      return J({ id: m.id, title: m.title, cat_id: m.cat_id, general: m.general, body: jparse(m.body, {}), refs: jparse(m.refs, []), src: m.src, sid: m.sid, updated: m.updated, done: !!(p && p.done), bookmarked: !!b, related: rel });
    }
    if (path === "progress" && M === "POST") { const id = int(body.id); if (!(await db.prepare("SELECT 1 x FROM fm_materials WHERE id = ? AND status = 'published'").bind(id).first())) return err("Materi tidak ditemukan.", 404); await db.prepare("INSERT INTO fm_progress (u, mat_id, done, t) VALUES (?, ?, ?, ?) ON CONFLICT(u, mat_id) DO UPDATE SET done = excluded.done, t = excluded.t").bind(u, id, body.done ? 1 : 0, t).run(); return J({ ok: 1 }); }
    if (path === "bookmark" && M === "POST") {
      const kind = body.kind === "material" ? "material" : "drug", id = int(body.id);
      if (body.on) { const ok = kind === "drug" ? await db.prepare(`SELECT 1 x FROM fm_drugs d WHERE ${pubWhere} AND id = ?`).bind(id).first() : await db.prepare("SELECT 1 x FROM fm_materials WHERE status = 'published' AND id = ?").bind(id).first(); if (!ok) return err("Data tidak ditemukan.", 404); await db.prepare("INSERT OR REPLACE INTO fm_bookmarks (u, kind, ref, t) VALUES (?, ?, ?, ?)").bind(u, kind, id, t).run(); }
      else await db.prepare("DELETE FROM fm_bookmarks WHERE u = ? AND kind = ? AND ref = ?").bind(u, kind, id).run();
      return J({ ok: 1, on: !!body.on });
    }
    if (path === "bookmarks") {
      const bm = (await db.prepare("SELECT kind, ref FROM fm_bookmarks WHERE u = ? ORDER BY t DESC LIMIT 200").bind(u).all()).results;
      const dr = await byIds(db, (q) => `SELECT id, generic, pharm_class FROM fm_drugs d WHERE ${pubWhere} AND id IN (${q})`, bm.filter((b) => b.kind === "drug").map((b) => b.ref));
      const ma = await byIds(db, (q) => `SELECT id, title FROM fm_materials WHERE status = 'published' AND id IN (${q})`, bm.filter((b) => b.kind === "material").map((b) => b.ref));
      return J({ drugs: dr.map((d) => ({ id: d.id, name: d.generic, sub: d.pharm_class })), materials: ma.map((m) => ({ id: m.id, name: m.title })) });
    }

    if (path === "usul" && M === "POST") { // usulan obat dari pengguna → antrean persetujuan admin (TIDAK langsung masuk Pustaka)
      const name = clip(body.name, 100).replace(/\s+/g, " "); if (String(body.name || "").trim().length > 100) return err("Nama obat terlalu panjang (maks. 100 karakter)."); if (name.length < 2 || !/^[\p{L}\p{N}][\p{L}\p{N} .,'()\/+\-]*$/u.test(name)) return err("Nama obat tidak valid. Gunakan huruf/angka (2–100 karakter).");
      const nl = lc(name), ex = await db.prepare("SELECT d.id, d.status, d.active FROM fm_drug_names n JOIN fm_drugs d ON d.id = n.drug_id WHERE n.name_lc = ? ORDER BY (d.status = 'published') DESC LIMIT 1").bind(nl).first();
      if (ex) { const pub = ex.status === "published" && !!ex.active; return J({ exists: true, published: pub, id: pub ? ex.id : 0, msg: pub ? "Obat ini sudah ada di Pustaka." : "Obat ini sudah ada dan sedang diproses admin." }); }
      const dup = await db.prepare("SELECT u FROM fm_usul WHERE name_lc = ? AND status = 'pending' LIMIT 1").bind(nl).first(); if (dup) return J({ dup: true, mine: dup.u === u, msg: dup.u === u ? "Anda sudah mengusulkan obat ini; menunggu admin." : "Obat ini sudah diusulkan pengguna lain; menunggu admin." });
      const my = (await db.prepare("SELECT SUM(status = 'pending') p, SUM(created > ?) d FROM fm_usul WHERE u = ?").bind(t - DAY, u).first()) || {};
      if ((my.p || 0) >= 5) return err("Anda masih punya 5 usulan yang belum diproses. Tunggu admin dulu.", 429); if ((my.d || 0) >= 20) return err("Batas 20 usulan per hari tercapai.", 429);
      const r = await db.prepare("INSERT INTO fm_usul (u, name, name_lc, brands, pharm_class, note, created) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(u, name, nl, clip(body.brands, 200), clip(body.pharm_class, 100), clip(body.note, 500), t).run();
      return J({ ok: 1, id: r.meta.last_row_id });
    }
    if (path === "usul/saya") { const rows = (await db.prepare("SELECT s.id, s.name, s.brands, s.status, s.admin_note, s.created, s.decided, s.drug_id, (d.status = 'published' AND d.active = 1) pub FROM fm_usul s LEFT JOIN fm_drugs d ON d.id = s.drug_id WHERE s.u = ? ORDER BY s.created DESC LIMIT 50").bind(u).all()).results; return J({ rows }); }
    if (path === "tr/get" && M === "POST") { // terjemahan tersimpan (hanya yang masih cocok dengan teks asli saat ini)
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 60).map((x) => ({ ent: x.ent === "inter" ? "inter" : "fact", ref: int(x.ref), field: x.ent === "inter" ? clip(x.field, 20) : "value" })).filter((x) => x.ref > 0 && (x.ent === "fact" || TR_INTER.includes(x.field)));
      const fid = items.filter((x) => x.ent === "fact").map((x) => x.ref), iid = items.filter((x) => x.ent === "inter").map((x) => x.ref), src = {}, rows = {};
      for (const r of await byIds(db, (q) => `SELECT f.id, f.value v FROM fm_drug_facts f JOIN fm_drugs d ON d.id = f.drug_id WHERE ${pubWhere} AND f.id IN (${q})`, fid)) src["fact:" + r.id + ":value"] = r.v;
      for (const r of await byIds(db, (q) => `SELECT id, mechanism, effect, management, evidence FROM fm_inter WHERE status = 'published' AND id IN (${q})`, iid)) for (const f of TR_INTER) src["inter:" + r.id + ":" + f] = r[f];
      for (const [ent, ids] of [["fact", fid], ["inter", iid]]) for (const r of await byIds(db, (q) => `SELECT ref, field, h, text, status FROM fm_tr WHERE ent = '${ent}' AND ref IN (${q})`, ids)) rows[ent + ":" + r.ref + ":" + r.field] = r;
      const map = {}, need = [];
      for (const x of items) { const k = x.ent + ":" + x.ref + ":" + x.field, st = src[k]; if (!st || !st.trim()) continue; const r = rows[k]; if (r && (r.status === "verified" || r.h === trHash(st))) map[k] = { text: r.text, status: r.status }; else if (looksId(st)) map[k] = { text: "", status: "id" }; else need.push(k); }
      return J({ map, need, provider: !!trProvider(env) });
    }
    if (path === "tr/do" && M === "POST") { const ent = body.ent === "inter" ? "inter" : "fact", field = ent === "inter" ? clip(body.field, 20) : "value"; if (ent === "inter" && !TR_INTER.includes(field)) return err("Bidang tidak valid."); const r = await trDo(db, env, ent, int(body.ref), field, { u, admin: false }); return r.err ? err(r.err, r.s || 400) : J(r); }
    // ----- game -----
    if (path === "game/cats") return J({ cats: await gameCounts(db), modes: Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, { n: v.n, d: v.d }])), diffs: DIFF });
    if (path === "game/start" && M === "POST") {
      const mode = MODES[body.mode] ? body.mode : "", diff = DIFF[int(body.diff)] ? int(body.diff) : 0, n = [5, 10, 15, 20].includes(int(body.n)) ? int(body.n) : 0;
      const cats = uniq((Array.isArray(body.cats) ? body.cats : []).map((x) => int(x)).filter((x) => x > 0)).slice(0, 20);
      if (!cats.length) return err("Pilih kategori terlebih dahulu."); if (!mode || !diff || !n) return err("Lengkapi mode, tingkat kesulitan, dan jumlah soal.");
      const qs = await buildQuestions(db, cats, mode, diff, n);
      if (qs.length < Math.min(n, 3)) return err("Soal terverifikasi untuk pilihan ini belum cukup. Pilih kategori/mode lain, atau minta admin menambah & mempublikasikan data.", 409, { got: qs.length });
      const sid = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
      await db.prepare("INSERT INTO fm_game (id, u, cats, mode, diff, total, snap, started, last_t) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(sid, u, cats.join(","), mode, diff, qs.length, JSON.stringify(qs), t, t).run();
      return J({ sid, total: qs.length, sec: DIFF[diff].sec, short: qs.length < n, questions: qs.map((q) => ({ q: q.q, opts: q.opts })) });
    }
    if (path === "game/answer" && M === "POST") {
      const g = await db.prepare("SELECT * FROM fm_game WHERE id = ? AND u = ?").bind(clip(body.sid, 40), u).first(); if (!g || g.status !== "active") return err("Sesi tidak aktif.", 404);
      const snap = jparse(g.snap, []), res = jparse(g.res, []), i = int(body.idx, -1);
      if (i < 0 || i >= snap.length) return err("Soal tidak valid."); if (res[i]) return err("Soal ini sudah dijawab.", 409);
      const q = snap[i], ch = body.choice == null ? null : int(body.choice, -1), limit = DIFF[g.diff].sec * 1000;
      const ms = Math.max(0, Math.min(int(body.ms, limit), t - g.last_t + 500, limit));
      const right = ch != null && ch >= 0 && ch < q.opts.length && q.opts[ch] === q.correct;
      let streak = right ? g.streak + 1 : 0, gain = 0;
      if (right) gain = DIFF[g.diff].base + Math.round(DIFF[g.diff].base * 0.5 * (1 - ms / limit)) + Math.min(streak - 1, 5) * 10;
      res[i] = { ch, ok: right ? 1 : 0, ms, gain };
      const done = res.filter(Boolean).length >= snap.length;
      await db.prepare("UPDATE fm_game SET res = ?, cur = ?, score = score + ?, correct = correct + ?, streak = ?, best_streak = MAX(best_streak, ?), last_t = ?, status = ?, fin = ?, dur = ? WHERE id = ?").bind(JSON.stringify(res), res.filter(Boolean).length, gain, right ? 1 : 0, streak, streak, t, done ? "done" : "active", done ? t : null, done ? t - g.started : 0, g.id).run();
      return J({ ok: right, correct: q.correct, expl: q.expl, src: q.src, sid: q.sid, gain, score: g.score + gain, streak, done });
    }
    if (path === "game/result") {
      const g = await db.prepare("SELECT * FROM fm_game WHERE id = ? AND u = ?").bind(clip(qp("sid"), 40), u).first(); if (!g) return err("Hasil tidak ditemukan.", 404);
      const snap = jparse(g.snap, []), res = jparse(g.res, []);
      return J({ sid: g.id, mode: g.mode, diff: g.diff, status: g.status, total: g.total, score: g.score, correct: g.correct, best_streak: g.best_streak, dur: g.dur, fin: g.fin, review: snap.map((q, i) => ({ q: q.q, correct: q.correct, expl: q.expl, src: q.src, sid: q.sid, chosen: res[i] && res[i].ch != null ? q.opts[res[i].ch] : null, ok: !!(res[i] && res[i].ok), answered: !!res[i] })) });
    }
    if (path === "game/history") {
      const rows = (await db.prepare("SELECT id, mode, diff, total, score, correct, best_streak, fin FROM fm_game WHERE u = ? AND status = 'done' ORDER BY fin DESC LIMIT 30").bind(u).all()).results;
      const best = await db.prepare("SELECT MAX(score) s FROM fm_game WHERE u = ? AND status = 'done'").bind(u).first();
      return J({ rows, best: best ? best.s : 0 });
    }
    return err("Tidak ditemukan.", 404);
  } catch (e) { console.error("farmako", path, e); return err("Terjadi kesalahan pada server Farmakologi." + (a.admin ? " Detail: " + clip(e && e.message, 220) : ""), 500); }
}

// ---------- ADMIN ----------
async function admin(db, a, p, qp, body, M, t, env) {
  const u = a.u, pg = Math.max(0, int(qp("pg"))), PS = 30;
  const stOf = (v, d = "draft") => (STATUS.includes(v) ? v : d);
  if (p === "stats") {
    const one = async (s) => (await db.prepare(s).first()) || {};
    const d = await one("SELECT COUNT(*) n, SUM(status='published') pub, SUM(status='pending') pen, SUM(status='draft') dr, SUM(status='verified') ver FROM fm_drugs");
    const src = (await db.prepare("SELECT s.code, s.name, s.url, s.descr, s.enabled, s.last_sync, s.note, (SELECT COUNT(*) FROM fm_drug_xref x WHERE x.src = s.code) xr, (SELECT COUNT(*) FROM fm_drug_facts f WHERE f.src = s.code) facts, (SELECT COUNT(*) FROM fm_inter i WHERE i.src = s.code) inters FROM fm_sources s ORDER BY s.name").all()).results;
    const q = await one("SELECT (SELECT COUNT(*) FROM fm_inter) i, (SELECT COUNT(*) FROM fm_inter WHERE status='published') ip, (SELECT COUNT(*) FROM fm_materials) m, (SELECT COUNT(*) FROM fm_materials WHERE status='published') mp, (SELECT COUNT(*) FROM fm_questions) q, (SELECT COUNT(*) FROM fm_categories) c, (SELECT COUNT(*) FROM fm_drug_facts WHERE pending IS NOT NULL) pend, (SELECT COUNT(*) FROM fm_usul WHERE status = 'pending') usul, (SELECT COUNT(*) FROM fm_game WHERE status='done') games");
    const st = (await db.prepare("SELECT src, COUNT(*) n, SUM(ok = 1) good, SUM(ok = 2) nf, SUM(ok = 0) bad FROM fm_sync_state GROUP BY src").all()).results, act = (await db.prepare("SELECT COUNT(*) n FROM fm_drugs WHERE active = 1").first()).n;
    const metas = Object.fromEntries((await db.prepare("SELECT k, v FROM fm_meta WHERE k LIKE 'auto:%' OR k IN ('cron_batch','refresh_days')").all()).results.map((x) => [x.k, x.v]));
    for (const s2 of src) { const z = st.find((x) => x.src === s2.code); s2.can_sync = !!SYNCERS[s2.code]; s2.auto = metas["auto:" + s2.code] === "1"; s2.synced = z ? z.n : 0; s2.good = z ? z.good : 0; s2.notfound = z ? z.nf : 0; s2.bad = z ? z.bad : 0; }
    return J({ drugs: d, other: q, sources: src, active: act, cron: { batch: int(metas.cron_batch, 1), days: int(metas.refresh_days, 30) } });
  }
  if (p === "sources" && M === "POST") { await db.prepare("UPDATE fm_sources SET enabled = ?, note = ? WHERE code = ?").bind(body.enabled ? 1 : 0, clip(body.note, 300), clip(body.code, 20)).run(); await audit(db, u, "sumber.ubah", "source", 0, body.code); return J({ ok: 1 }); }
  if (p === "log") return J({ sync: (await db.prepare("SELECT * FROM fm_sync_log ORDER BY id DESC LIMIT 40").all()).results, audit: (await db.prepare("SELECT * FROM fm_audit ORDER BY id DESC LIMIT 80").all()).results });
  if (p === "history") return J({ rows: (await db.prepare("SELECT * FROM fm_audit WHERE ent = ? AND ref = ? ORDER BY id DESC LIMIT 50").bind(clip(qp("ent"), 20), int(qp("ref"))).all()).results });

  // obat
  if (p === "drugs" && M === "GET") {
    const q = lc(qp("q")), st = qp("st"), src = qp("src"), cat = int(qp("cat")); let w = "1=1"; const b = [];
    if (q) { w += " AND d.id IN (SELECT drug_id FROM fm_drug_names WHERE instr(name_lc, ?) > 0)"; b.push(q); }
    if (STATUS.includes(st)) { w += " AND d.status = ?"; b.push(st); } if (qp("off") === "1") w += " AND d.active = 0";
    if (src) { w += " AND (d.src = ? OR d.id IN (SELECT drug_id FROM fm_drug_xref WHERE src = ?))"; b.push(src, src); }
    if (cat) { w += " AND d.id IN (SELECT drug_id FROM fm_drug_cat WHERE cat_id = ?)"; b.push(cat); }
    const total = (await db.prepare(`SELECT COUNT(*) n FROM fm_drugs d WHERE ${w}`).bind(...b).first()).n;
    const rows = (await db.prepare(`SELECT d.id, d.generic, d.pharm_class, d.status, d.active, d.src, d.updated FROM fm_drugs d WHERE ${w} ORDER BY d.generic LIMIT ${PS} OFFSET ${pg * PS}`).bind(...b).all()).results;
    return J({ total, rows, ps: PS });
  }
  if (p.startsWith("drug/") && M === "GET") {
    const id = int(p.slice(5)), d = await db.prepare("SELECT * FROM fm_drugs WHERE id = ?").bind(id).first(); if (!d) return err("Tidak ditemukan.", 404);
    return J({ drug: d, names: (await drugNames(db, [id])).get(id) || [], facts: await (async () => { const f = (await db.prepare("SELECT id, field, value, pending, src, sid, updated FROM fm_drug_facts WHERE drug_id = ? ORDER BY field, src").bind(id).all()).results, tr = f.length ? await byIds(db, (q) => `SELECT ref, h, text, status FROM fm_tr WHERE ent = 'fact' AND field = 'value' AND ref IN (${q})`, f.map((x) => x.id)) : []; return f.map((x) => { const r = tr.find((y) => y.ref === x.id); return { ...x, tr: r && (r.status === "verified" || r.h === trHash(x.value)) ? { text: r.text, status: r.status } : null, looks_id: looksId(x.value) }; }); })(), xref: (await db.prepare("SELECT src, sid, synced FROM fm_drug_xref WHERE drug_id = ?").bind(id).all()).results, cats: await drugCats(db, id) });
  }
  if (p === "drug" && M === "POST") {
    const src = SRC_CODES.includes(body.src) ? body.src : "manual";
    const o = { id: body.id, generic: body.generic, brands: body.brands, synonyms: body.synonyms, pharm_class: body.pharm_class, ther_class: body.ther_class, classification: body.classification, summary: body.summary, facts: body.facts, xref: body.xref, source_id: body.source_id, categories: body.categories };
    const r = await saveDrug(db, o, u, src, false); if (r.err) return err(r.err);
    if (body.id && body.fact_clear && typeof body.fact_clear === "object") for (const f of Object.keys(body.fact_clear)) await db.prepare("DELETE FROM fm_drug_facts WHERE drug_id = ? AND field = ? AND src = ?").bind(r.id, f, src).run();
    await audit(db, u, r.created ? "obat.buat" : "obat.ubah", "drug", r.id, clip(body.generic, 100)); return J({ id: r.id });
  }
  if (p === "drug/active" && M === "POST") { await db.prepare("UPDATE fm_drugs SET active = ?, updated = ?, updated_by = ? WHERE id = ?").bind(body.active ? 1 : 0, t, u, int(body.id)).run(); dirty(); await audit(db, u, body.active ? "obat.aktif" : "obat.nonaktif", "drug", int(body.id), ""); return J({ ok: 1 }); }
  if (p === "fact/approve" && M === "POST") {
    const f = await db.prepare("SELECT * FROM fm_drug_facts WHERE drug_id = ? AND field = ? AND src = ?").bind(int(body.drug_id), clip(body.field, 30), clip(body.src, 20)).first(); if (!f || f.pending == null) return err("Tidak ada pembaruan tertunda.", 404);
    if (body.reject) await db.prepare("UPDATE fm_drug_facts SET pending = NULL WHERE id = ?").bind(f.id).run(); else await db.prepare("UPDATE fm_drug_facts SET value = pending, pending = NULL, updated = ? WHERE id = ?").bind(t, f.id).run();
    dirty(); await audit(db, u, body.reject ? "fakta.tolak" : "fakta.setujui", "drug", f.drug_id, f.field + "/" + f.src); return J({ ok: 1 });
  }
  if (p === "drug/del" && M === "POST") { // hapus PERMANEN obat beserta turunannya (nama, ID sumber, fakta, kategori-tautan, interaksi yang melibatkannya, bookmark, status sinkron)
    const ids = uniq((Array.isArray(body.ids) ? body.ids : []).map((x) => int(x)).filter(Boolean)).slice(0, 20); if (!ids.length) return err("Pilih obat terlebih dahulu.");
    const names = (await byIds(db, (q) => `SELECT generic FROM fm_drugs WHERE id IN (${q})`, ids)).map((x) => x.generic);
    for (const id of ids) await db.batch(["DELETE FROM fm_inter_members WHERE inter_id IN (SELECT id FROM fm_inter WHERE drug_a = ?1 OR drug_b = ?1) OR drug_id = ?1", "DELETE FROM fm_inter WHERE drug_a = ?1 OR drug_b = ?1", "DELETE FROM fm_drug_names WHERE drug_id = ?1", "DELETE FROM fm_drug_xref WHERE drug_id = ?1", "DELETE FROM fm_drug_facts WHERE drug_id = ?1", "DELETE FROM fm_drug_cat WHERE drug_id = ?1", "DELETE FROM fm_sync_state WHERE drug_id = ?1", "DELETE FROM fm_bookmarks WHERE kind = 'drug' AND ref = ?1", "DELETE FROM fm_recent WHERE kind = 'drug' AND ref = ?1", "DELETE FROM fm_drugs WHERE id = ?1"].map((q) => db.prepare(q).bind(id)));
    dirty(); await audit(db, u, "obat.hapus", "drug", ids.length === 1 ? ids[0] : 0, clip(names.join(", "), 400)); return J({ n: ids.length });
  }
  if (p === "usul" && M === "GET") {
    const st = ["pending", "approved", "rejected"].includes(qp("st")) ? qp("st") : "pending";
    const rows = (await db.prepare("SELECT s.*, d.status dstatus FROM fm_usul s LEFT JOIN fm_drugs d ON d.id = s.drug_id WHERE s.status = ? ORDER BY s.created DESC LIMIT 100").bind(st).all()).results;
    const c = (await db.prepare("SELECT SUM(status = 'pending') p, SUM(status = 'approved') a, SUM(status = 'rejected') r FROM fm_usul").first()) || {};
    return J({ rows, counts: { pending: c.p || 0, approved: c.a || 0, rejected: c.r || 0 } });
  }
  if (p === "usul/decide" && M === "POST") {
    const ids = uniq((Array.isArray(body.ids) ? body.ids : []).map((x) => int(x)).filter(Boolean)).slice(0, 20), act = body.act; if (!ids.length || !["approve", "reject", "delete"].includes(act)) return err("Pilih usulan dan tindakan.");
    let n = 0; for (const id of ids) {
      const r = await db.prepare("SELECT * FROM fm_usul WHERE id = ?").bind(id).first(); if (!r) continue;
      if (act === "delete") { await db.prepare("DELETE FROM fm_usul WHERE id = ?").bind(id).run(); n++; continue; }
      if (r.status !== "pending") continue;
      if (act === "reject") { await db.prepare("UPDATE fm_usul SET status = 'rejected', admin_note = ?, decided = ?, decided_by = ? WHERE id = ?").bind(clip(body.note, 300), t, u, id).run(); n++; continue; }
      const sv = await saveDrug(db, { generic: r.name, brands: r.brands }, u, "manual", true); if (sv.err) continue; // hanya nama (+nama dagang); isi lain berasal dari sumber, bukan dari pengusul
      await db.prepare("UPDATE fm_usul SET status = 'approved', drug_id = ?, admin_note = ?, decided = ?, decided_by = ? WHERE id = ?").bind(sv.id, clip(body.note, 300), t, u, id).run(); n++;
    }
    dirty(); await audit(db, u, "usulan." + act, "usul", 0, n + " usulan"); return J({ n });
  }
  if (p === "tr/status") {
    const q = (await db.prepare("SELECT (SELECT COUNT(*) FROM fm_drug_facts WHERE value <> '') total, (SELECT COUNT(*) FROM fm_tr WHERE ent = 'fact' AND status = 'auto') auto, (SELECT COUNT(*) FROM fm_tr WHERE ent = 'fact' AND status = 'verified') ver, (SELECT COUNT(*) FROM fm_tr WHERE ent = 'fact' AND status = 'id') idn").first()) || {};
    const rem = (await db.prepare("SELECT COUNT(*) n FROM fm_drug_facts f JOIN fm_drugs d ON d.id = f.drug_id LEFT JOIN fm_tr t ON t.ent = 'fact' AND t.ref = f.id AND t.field = 'value' WHERE f.value <> '' AND d.active = 1 AND (t.ref IS NULL OR t.t < f.updated)").first()).n;
    return J({ provider: trProvider(env) || "", ...q, remaining: rem });
  }
  if (p === "tr/test" && M === "POST") { const t0 = Date.now(); try { const pc = await trPiece(env, "Pharmacokinetics (PK) of simvastatin was characterized using inhibition of HMG-CoA reductase activity in plasma samples."); return J({ ok: true, provider: trProvider(env), via: pc.via, ms: Date.now() - t0, text: pc.text }); } catch (e) { return J({ ok: false, provider: trProvider(env), ms: Date.now() - t0, msg: clip(e && e.message, 200) }); } }
  if (p === "tr/do" && M === "POST") { const ent = body.ent === "inter" ? "inter" : "fact", field = ent === "inter" ? clip(body.field, 20) : "value"; const r = await trDo(db, env, ent, int(body.ref), field, { u, admin: true, force: !!body.force }); return r.err ? err(r.err, r.s || 400) : J(r); }
  if (p === "tr/save" && M === "POST") { const ent = body.ent === "inter" ? "inter" : "fact", field = ent === "inter" ? clip(body.field, 20) : "value", ref = int(body.ref), src = await trSource(db, ent, ref, field, true), text = clip(body.text, 12000); if (!src) return err("Teks asli tidak ditemukan.", 404); if (!text) return err("Terjemahan kosong."); await trUp(db, ent, ref, field, trHash(src), text, "verified", t); await audit(db, u, "terjemahan.simpan", ent, ref, field); return J({ ok: 1 }); }
  if (p === "tr/batch" && M === "POST") { // terjemahkan 1 fakta berikutnya yang belum/ketinggalan; browser mengulang sampai remaining = 0
    const nx = await db.prepare("SELECT f.id FROM fm_drug_facts f JOIN fm_drugs d ON d.id = f.drug_id LEFT JOIN fm_tr t ON t.ent = 'fact' AND t.ref = f.id AND t.field = 'value' WHERE f.value <> '' AND d.active = 1 AND (t.ref IS NULL OR t.t < f.updated) ORDER BY f.id LIMIT 1").first();
    if (!nx) return J({ done: 0, remaining: 0 });
    const r = await trDo(db, env, "fact", nx.id, "value", { u, admin: true }); if (r.err) return err(r.err, r.s || 400);
    const rem = (await db.prepare("SELECT COUNT(*) n FROM fm_drug_facts f JOIN fm_drugs d ON d.id = f.drug_id LEFT JOIN fm_tr t ON t.ent = 'fact' AND t.ref = f.id AND t.field = 'value' WHERE f.value <> '' AND d.active = 1 AND (t.ref IS NULL OR t.t < f.updated)").first()).n;
    return J({ done: 1, id: nx.id, status: r.status, remaining: rem });
  }
  if (p === "dups") {
    const d1 = (await db.prepare("SELECT a.id aid, a.generic ag, b.id bid, b.generic bg FROM fm_drugs a JOIN fm_drugs b ON a.id < b.id AND (instr(b.generic_lc, a.generic_lc || ' ') = 1 OR instr(a.generic_lc, b.generic_lc || ' ') = 1) LIMIT 100").all()).results.map((r) => ({ ...r, why: "nama berawalan sama" }));
    const d2 = (await db.prepare("SELECT x.id aid, x.generic ag, y.id bid, y.generic bg FROM fm_drug_names n1 JOIN fm_drug_names n2 ON n1.name_lc = n2.name_lc AND n1.drug_id < n2.drug_id AND n1.kind = 'generic' JOIN fm_drugs x ON x.id = n1.drug_id JOIN fm_drugs y ON y.id = n2.drug_id LIMIT 100").all()).results.map((r) => ({ ...r, why: "nama generik sama" }));
    return J({ rows: d2.concat(d1) });
  }
  if (p === "drug/merge" && M === "POST") { // gabung SECARA EKSPLISIT oleh admin: data `drop` dipindah ke `keep`, `drop` dinonaktifkan (tidak dihapus)
    const keep = int(body.keep), drop = int(body.drop); if (!keep || !drop || keep === drop) return err("Pilih dua obat berbeda.");
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO fm_drug_names (drug_id, name, name_lc, kind, src) SELECT ?, name, name_lc, CASE WHEN kind = 'generic' THEN 'synonym' ELSE kind END, src FROM fm_drug_names WHERE drug_id = ?").bind(keep, drop),
      db.prepare("UPDATE OR IGNORE fm_drug_xref SET drug_id = ? WHERE drug_id = ?").bind(keep, drop),
      db.prepare("UPDATE OR IGNORE fm_drug_facts SET drug_id = ? WHERE drug_id = ?").bind(keep, drop),
      db.prepare("INSERT OR IGNORE INTO fm_drug_cat (drug_id, cat_id) SELECT ?, cat_id FROM fm_drug_cat WHERE drug_id = ?").bind(keep, drop),
      db.prepare("UPDATE fm_drugs SET active = 0, status = 'draft', updated = ? WHERE id = ?").bind(t, drop),
    ]);
    dirty(); await audit(db, u, "obat.gabung", "drug", keep, "dari #" + drop); return J({ ok: 1 });
  }

  // kategori
  if (p === "cats" && M === "GET") { const rows = (await db.prepare("SELECT c.*, (SELECT COUNT(*) FROM fm_drug_cat dc WHERE dc.cat_id = c.id) n FROM fm_categories c ORDER BY c.kind, c.parent_id, c.sort, c.name LIMIT 1500").all()).results; return J({ rows }); }
  if (p === "cat" && M === "POST") {
    const name = clip(body.name, 160); if (!name) return err("Nama wajib diisi."); const kind = CAT_KINDS[body.kind] ? body.kind : "other";
    try {
      if (body.id) await db.prepare("UPDATE fm_categories SET name = ?, name_lc = ?, kind = ?, parent_id = ?, descr = ?, sort = ?, hidden = ? WHERE id = ?").bind(name, lc(name), kind, int(body.parent_id) === int(body.id) ? 0 : int(body.parent_id), clip(body.descr, 500), int(body.sort), body.hidden ? 1 : 0, int(body.id)).run();
      else await db.prepare("INSERT INTO fm_categories (kind, name, name_lc, parent_id, src, descr, sort, created) VALUES (?, ?, ?, ?, 'manual', ?, ?, ?)").bind(kind, name, lc(name), int(body.parent_id), clip(body.descr, 500), int(body.sort), t).run();
    } catch (e) { return err("Kategori dengan nama, jenis, dan induk yang sama sudah ada."); }
    dirty(); await audit(db, u, body.id ? "kategori.ubah" : "kategori.buat", "cat", int(body.id), name); return J({ ok: 1 });
  }
  if (p === "cat/del" && M === "POST") { const id = int(body.id); await db.batch([db.prepare("DELETE FROM fm_drug_cat WHERE cat_id = ?").bind(id), db.prepare("UPDATE fm_categories SET parent_id = 0 WHERE parent_id = ?").bind(id), db.prepare("DELETE FROM fm_categories WHERE id = ?").bind(id)]); dirty(); await audit(db, u, "kategori.hapus", "cat", id, ""); return J({ ok: 1 }); }
  if (p === "drug/cat" && M === "POST") { if (body.on) await db.prepare("INSERT OR IGNORE INTO fm_drug_cat (drug_id, cat_id) VALUES (?, ?)").bind(int(body.drug_id), int(body.cat_id)).run(); else await db.prepare("DELETE FROM fm_drug_cat WHERE drug_id = ? AND cat_id = ?").bind(int(body.drug_id), int(body.cat_id)).run(); dirty(); return J({ ok: 1 }); }

  // materi
  if (p === "materials" && M === "GET") { const rows = (await db.prepare("SELECT id, title, cat_id, general, status, src, updated FROM fm_materials ORDER BY general DESC, sort, title LIMIT 500").all()).results; return J({ rows }); }
  if (p.startsWith("material/") && M === "GET") { const m = await db.prepare("SELECT * FROM fm_materials WHERE id = ?").bind(int(p.slice(9))).first(); if (!m) return err("Tidak ditemukan.", 404); return J({ ...m, body: jparse(m.body, {}), refs: jparse(m.refs, []) }); }
  if (p === "material" && M === "POST") {
    const title = clip(body.title, 200); if (!title) return err("Judul wajib diisi.");
    const sec = {}; for (const k of Object.keys(SECTIONS)) { const v = clip(body.body && body.body[k], 20000); if (v) sec[k] = v; }
    const refs = (Array.isArray(body.refs) ? body.refs : []).map((r) => ({ text: clip(r.text, 400), url: /^https?:\/\//i.test(r.url || "") ? clip(r.url, 400) : "", doi: clip(r.doi, 80), pmid: clip(r.pmid, 20) })).filter((r) => r.text).slice(0, 40);
    const f = [int(body.cat_id), body.general ? 1 : 0, title, JSON.stringify(sec), JSON.stringify(refs), clip(body.src, 20) || "manual", clip(body.sid, 80), stOf(body.status), int(body.sort)];
    let id = int(body.id);
    if (id) await db.prepare("UPDATE fm_materials SET cat_id = ?, general = ?, title = ?, body = ?, refs = ?, src = ?, sid = ?, status = ?, sort = ?, updated = ?, updated_by = ? WHERE id = ?").bind(...f, t, u, id).run();
    else id = (await db.prepare("INSERT INTO fm_materials (cat_id, general, title, body, refs, src, sid, status, sort, created, updated, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(...f, t, t, u).run()).meta.last_row_id;
    await audit(db, u, "materi.simpan", "material", id, title + " [" + stOf(body.status) + "]"); return J({ id });
  }
  if (p === "material/del" && M === "POST") { await db.prepare("DELETE FROM fm_materials WHERE id = ?").bind(int(body.id)).run(); await db.prepare("DELETE FROM fm_progress WHERE mat_id = ?").bind(int(body.id)).run(); await audit(db, u, "materi.hapus", "material", int(body.id), ""); return J({ ok: 1 }); }

  // interaksi
  if (p === "inters" && M === "GET") {
    const st = qp("st"), q = lc(qp("q")); let w = "1=1"; const b = [];
    if (STATUS.includes(st)) { w += " AND i.status = ?"; b.push(st); } if (q) { w += " AND (instr(lower(a.generic), ?) > 0 OR instr(lower(c.generic), ?) > 0)"; b.push(q, q); }
    const total = (await db.prepare(`SELECT COUNT(*) n FROM fm_inter i LEFT JOIN fm_drugs a ON a.id = i.drug_a LEFT JOIN fm_drugs c ON c.id = i.drug_b WHERE ${w}`).bind(...b).first()).n;
    const rows = (await db.prepare(`SELECT i.*, a.generic AS ga, c.generic AS gb FROM fm_inter i LEFT JOIN fm_drugs a ON a.id = i.drug_a LEFT JOIN fm_drugs c ON c.id = i.drug_b WHERE ${w} ORDER BY i.updated DESC LIMIT ${PS} OFFSET ${pg * PS}`).bind(...b).all()).results;
    return J({ total, rows, ps: PS });
  }
  if (p === "inter" && M === "POST") {
    const itype = ITYPES[body.itype] ? body.itype : "ddi", sev = clip(body.severity, 40), src = clip(body.src, 20) || "manual";
    let da = int(body.drug_a), db_ = int(body.drug_b); const subject = clip(body.subject, 300);
    if (!da) return err("Obat A wajib dipilih."); if (itype === "ddi" && (!db_ || db_ === da)) return err("Pilih dua obat yang berbeda."); if (itype !== "ddi" && !subject) return err("Isi keterangan makanan/penyakit/alkohol.");
    if (itype !== "ddi") db_ = 0; else if (da > db_) [da, db_] = [db_, da];
    const f = [clip(body.mechanism, 3000), clip(body.effect, 3000), clip(body.management, 3000), clip(body.evidence, 3000), sev, src, clip(body.sid, 80), stOf(body.status)];
    try {
      if (body.id) await db.prepare("UPDATE fm_inter SET itype = ?, drug_a = ?, drug_b = ?, subject = ?, mechanism = ?, effect = ?, management = ?, evidence = ?, severity = ?, src = ?, sid = ?, status = ?, pending = NULL, verified_at = CASE WHEN ? IN ('verified','published') THEN ? ELSE verified_at END, updated = ? WHERE id = ?").bind(itype, da, db_, subject, ...f, f[7], t, t, int(body.id)).run();
      else await db.prepare("INSERT INTO fm_inter (itype, drug_a, drug_b, subject, mechanism, effect, management, evidence, severity, src, sid, status, verified_at, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(itype, da, db_, subject, ...f, ["verified", "published"].includes(f[7]) ? t : null, t, t).run();
    } catch (e) { return err("Interaksi dengan pasangan obat, jenis, dan sumber yang sama sudah ada."); }
    await audit(db, u, "interaksi.simpan", "inter", int(body.id), da + "×" + db_); return J({ ok: 1 });
  }
  if (p === "inter/del" && M === "POST") { const id = int(body.id); await db.batch([db.prepare("DELETE FROM fm_inter_members WHERE inter_id = ?").bind(id), db.prepare("DELETE FROM fm_inter WHERE id = ?").bind(id)]); await audit(db, u, "interaksi.hapus", "inter", id, ""); return J({ ok: 1 }); }
  if (p === "inter/approve" && M === "POST") { const r = await db.prepare("SELECT * FROM fm_inter WHERE id = ?").bind(int(body.id)).first(); if (!r || !r.pending) return err("Tidak ada pembaruan tertunda.", 404); if (!body.reject) { const n = jparse(r.pending, {}); await db.prepare("UPDATE fm_inter SET severity = ?, mechanism = ?, effect = ?, management = ?, evidence = ?, sid = ?, updated = ? WHERE id = ?").bind(clip(n.severity, 40), clip(n.mechanism, 3000), clip(n.effect, 3000), clip(n.management, 3000), clip(n.evidence, 3000), clip(n.sid, 80), t, r.id).run(); } await db.prepare("UPDATE fm_inter SET pending = NULL WHERE id = ?").bind(r.id).run(); await audit(db, u, body.reject ? "interaksi.tolak" : "interaksi.setujui", "inter", r.id, ""); return J({ ok: 1 }); }

  // soal manual
  if (p === "qs" && M === "GET") { const rows = (await db.prepare("SELECT * FROM fm_questions ORDER BY updated DESC LIMIT 300").all()).results; return J({ rows }); }
  if (p === "q" && M === "POST") {
    const q = clip(body.q, 1000), opts = ["a", "b", "c", "d"].map((k) => clip(body[k], 300)), ans = clip(body.ans, 1).toUpperCase();
    if (!q || opts.filter(Boolean).length < 2) return err("Isi soal dan minimal dua pilihan."); if (!"ABCD".includes(ans) || !opts["ABCD".indexOf(ans)]) return err("Kunci jawaban harus salah satu pilihan yang terisi.");
    const f = [int(body.cat_id), MODES[body.mode] ? body.mode : "mixed", [1, 2, 3].includes(int(body.diff)) ? int(body.diff) : 2, q, ...opts, ans, clip(body.expl, 3000), clip(body.src, 20) || "manual", clip(body.sid, 80), stOf(body.status)];
    if (body.id) await db.prepare("UPDATE fm_questions SET cat_id = ?, mode = ?, diff = ?, q = ?, a = ?, b = ?, c = ?, d = ?, ans = ?, expl = ?, src = ?, sid = ?, status = ?, updated = ? WHERE id = ?").bind(...f, t, int(body.id)).run();
    else await db.prepare("INSERT INTO fm_questions (cat_id, mode, diff, q, a, b, c, d, ans, expl, src, sid, status, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(...f, t, t).run();
    dirty(); await audit(db, u, "soal.simpan", "q", int(body.id), q.slice(0, 80)); return J({ ok: 1 });
  }
  if (p === "q/del" && M === "POST") { await db.prepare("DELETE FROM fm_questions WHERE id = ?").bind(int(body.id)).run(); dirty(); return J({ ok: 1 }); }

  // status massal: berdasarkan daftar ID ATAU filter (sumber + status sekarang)
  if (p === "status" && M === "POST") {
    const to = stOf(body.to, ""); if (!to) return err("Status tujuan tidak valid.");
    const tb = { drug: "fm_drugs", inter: "fm_inter", material: "fm_materials", q: "fm_questions" }[body.ent]; if (!tb) return err("Jenis data tidak valid.");
    const ver = tb === "fm_drugs" || tb === "fm_inter" ? ", verified_at = CASE WHEN ? IN ('verified','published') THEN ? ELSE verified_at END" : ""; const vb = ver ? [to, t] : [];
    let n = 0;
    if (Array.isArray(body.ids) && body.ids.length) { for (const part of chunk(body.ids.map((x) => int(x)).filter(Boolean).slice(0, 500), 60)) { const r = await db.prepare(`UPDATE ${tb} SET status = ?, updated = ?${ver} WHERE id IN (${inList(part.length)})`).bind(to, t, ...vb, ...part).run(); n += r.meta.changes; } }
    else if (body.filter && STATUS.includes(body.filter.from)) { let w = "status = ?"; const b = [body.filter.from]; if (body.filter.src) { w += tb === "fm_drugs" ? " AND (src = ? OR id IN (SELECT drug_id FROM fm_drug_xref WHERE src = ?))" : " AND src = ?"; b.push(body.filter.src); if (tb === "fm_drugs") b.push(body.filter.src); } const r = await db.prepare(`UPDATE ${tb} SET status = ?, updated = ?${ver} WHERE ${w}`).bind(to, t, ...vb, ...b).run(); n = r.meta.changes; }
    else return err("Pilih data atau filter terlebih dahulu.");
    dirty(); await audit(db, u, "status.massal", body.ent, 0, `${n} data → ${to}`); return J({ n });
  }

  // impor: klien mengirim berkas dalam potongan kecil; SETIAP baris langsung tersimpan (obat & interaksi).
  if (p === "import" && M === "POST") return await bulkImport(db, body, u, t);

  // publikasi massal: satu tindakan untuk SELURUH obat & interaksi (bukan satu per satu)
  if (p === "publish-all" && M === "POST") {
    const ent = (Array.isArray(body.ent) && body.ent.length ? body.ent : ["drug", "inter"]).map((x) => clip(x, 12));
    const out = {};
    for (const e of ent) {
      const tb = { drug: "fm_drugs", inter: "fm_inter", material: "fm_materials", q: "fm_questions" }[e];
      if (!tb) continue;
      const ver = tb === "fm_drugs" || tb === "fm_inter" ? ", verified_at = COALESCE(verified_at, ?)" : "";
      const r = await db.prepare("UPDATE " + tb + " SET status = 'published', updated = ?" + ver + " WHERE status <> 'published'").bind(...(ver ? [t, t] : [t])).run();
      out[e] = r.meta.changes;
    }
    dirty(); await audit(db, u, "publikasi.massal", "all", 0, JSON.stringify(out));
    return J({ ok: 1, n: out, at: t });
  }

  // sinkronisasi lewat API publik untuk obat yang sudah ada (maks 8 per permintaan)
  if (p === "sync" && M === "POST") {
    const src = body.src; if (!SYNCERS[src]) return err("Sinkronisasi langsung tersedia untuk: " + Object.keys(SYNCERS).join(", ") + ". DrugBank, DDInter, dan KEGG diimpor dari berkas.");
    const row = await db.prepare("SELECT enabled FROM fm_sources WHERE code = ?").bind(src).first(); if (!row || !row.enabled) return err("Sumber ini dinonaktifkan.");
    const ids = uniq((Array.isArray(body.ids) ? body.ids : []).map((x) => int(x)).filter(Boolean)).slice(0, 1); if (!ids.length) return err("Pilih obat terlebih dahulu."); // 1 per permintaan: aman dari batas query D1 per invokasi (50 di paket gratis); browser mengulang
    let ok = 0, miss = 0, fail = 0; const out = [];
    for (const id of ids) { const d = await db.prepare("SELECT id, generic FROM fm_drugs WHERE id = ?").bind(id).first(); if (!d) continue; const r = await syncOne(db, env, d, src, u); if (r.ok === 1) ok++; else if (r.ok === 2) miss++; else fail++; out.push({ id, generic: d.generic, r: r.r }); }
    try { await db.batch([db.prepare("UPDATE fm_sources SET last_sync = ? WHERE code = ?").bind(t, src), db.prepare("INSERT INTO fm_sync_log (t, u, src, act, ok, n_in, n_up, n_skip, msg) VALUES (?, ?, ?, 'sinkron api', ?, 0, ?, ?, ?)").bind(t, u, src, fail ? 0 : 1, ok, miss + fail, clip(out.map((o) => o.generic + ": " + o.r).join("; "), 500))]); } catch (e) { /* pencatatan log tidak boleh menggagalkan sinkron */ }
    dirty(); return J({ ok, miss, fail, out });
  }
  // uji koneksi: satu kueri contoh ke layanan, TANPA menyimpan apa pun. "aspirin" hanya nama uji koneksi.
  if (p === "test-source" && M === "POST") {
    const src = body.src; if (!SYNCERS[src]) return J({ ok: false, msg: "Sumber ini tidak punya sinkron langsung; impor dari berkas." });
    const t0 = Date.now();
    try {
      const r = await SYNCERS[src]("aspirin", env), ms = Date.now() - t0;
      if (!r) return J({ ok: false, reached: true, ms, msg: "Layanan terjangkau tetapi nama uji tidak ditemukan/tidak cocok. Bentuk respons mungkin berubah — periksa manual sebelum mengaktifkan otomatis." });
      return J({ ok: true, ms, msg: "Terhubung. Sid " + (r.sid || "—") + "; bidang terbaca: " + (Object.keys(r.facts || {}).join(", ") || "—") + "; sinonim/nama dagang: " + ((r.syn || []).length + (r.brands || []).length) + "; kategori: " + (r.categories || []).length + "." });
    } catch (e) { return J({ ok: false, ms: Date.now() - t0, msg: "Gagal: " + clip(e && e.message, 160) + ". Periksa akses jaringan Worker/server." }); }
  }
  if (p === "sync-all" && M === "POST") { // dipanggil berulang oleh browser sampai remaining = 0; tiap panggilan kecil agar aman dari batas Worker
    const srcs = (Array.isArray(body.srcs) ? body.srcs : []).filter((x) => SYNCERS[x]); if (!srcs.length) return err("Pilih sumber.");
    const cap = Math.min(6, Math.max(1, int(body.n, 1))), days = Math.max(1, int(await getMeta(db, "refresh_days", "30"), 30)), out = []; // cap = jumlah (obat×sumber) per permintaan; 1 aman untuk paket gratis
    const dueSql = (lim) => "SELECT d.id, d.generic FROM fm_drugs d LEFT JOIN fm_sync_state s ON s.drug_id = d.id AND s.src = ? WHERE d.active = 1 AND (s.t IS NULL OR s.t < ? - (CASE WHEN s.ok = 0 THEN ? ELSE ? END)) ORDER BY COALESCE(s.t, 0)" + (lim ? " LIMIT ?" : "");
    for (const src of srcs) {
      if (out.length >= cap) break;
      const en = await db.prepare("SELECT enabled FROM fm_sources WHERE code = ?").bind(src).first(); if (!en || !en.enabled) continue;
      for (const d of (await db.prepare(dueSql(1)).bind(src, Date.now(), DAY, days * DAY, cap - out.length).all()).results) out.push({ src, ...(await syncOne(db, env, d, src, u)) });
    }
    let remaining = 0; for (const src of srcs) remaining += (await db.prepare("SELECT COUNT(*) n FROM (" + dueSql(0) + ")").bind(src, Date.now(), DAY, days * DAY).first()).n;
    if (out.length) { dirty(); try { await db.batch([...srcs.map((x) => db.prepare("UPDATE fm_sources SET last_sync = ? WHERE code = ?").bind(Date.now(), x)), db.prepare("INSERT INTO fm_sync_log (t, u, src, act, ok, n_in, n_up, n_skip, msg) VALUES (?, ?, ?, 'sinkron semua', ?, 0, ?, ?, ?)").bind(Date.now(), u, srcs.join("+"), out.some((o) => o.ok === 0) ? 0 : 1, out.filter((o) => o.ok === 1).length, out.filter((o) => o.ok !== 1).length, clip(out.map((o) => o.generic + "@" + o.src + ": " + o.r).join("; "), 400))]); } catch (e) { /* log tidak fatal */ } }
    return J({ done: out.length, ok: out.filter((o) => o.ok === 1).length, notfound: out.filter((o) => o.ok === 2).length, fail: out.filter((o) => o.ok === 0).length, remaining, out });
  }
  if (p === "auto" && M === "POST") {
    if (body.src) { if (!SYNCERS[body.src]) return err("Sumber tidak valid."); await setMeta(db, "auto:" + body.src, body.on ? "1" : "0"); }
    if (body.batch) await setMeta(db, "cron_batch", Math.min(10, Math.max(1, int(body.batch, 3))));
    if (body.days) await setMeta(db, "refresh_days", Math.min(365, Math.max(1, int(body.days, 30))));
    await audit(db, u, "sinkron.atur", "source", 0, clip(JSON.stringify({ src: body.src, on: !!body.on, batch: body.batch, days: body.days }), 200)); return J({ ok: 1 });
  }
  if (p === "cron-run" && M === "POST") { const r = await farmakoCron(env, u); await audit(db, u, "sinkron.jalan", "source", 0, "manual: " + (r.ran || 0) + " obat"); return J(r); }
  if (p === "seed-names" && M === "POST") { // daftar nama generik dari admin → obat draft (hanya nama), lalu diisi lewat sinkron. Tidak ada nama yang berasal dari sistem.
    const names = uniq((Array.isArray(body.names) ? body.names : []).map((x) => clip(x, 160)).filter(Boolean)).slice(0, 30); if (!names.length) return err("Tidak ada nama.");
    let nin = 0, nskip = 0; for (const n of names) { const r = await saveDrug(db, { generic: n }, u, "manual", true); if (r.err) nskip++; else if (r.created) nin++; else nskip++; }
    await audit(db, u, "obat.daftar-nama", "drug", 0, `+${nin} lewat ${nskip}`); return J({ nin, nskip });
  }
  return err("Tidak ditemukan.", 404);
}
