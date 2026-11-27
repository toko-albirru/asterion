// Penghitung pemakaian D1 per hari (UTC, sama dengan reset kuota Cloudflare = 07.00 WIB).
// Setiap kueri lewat env.DB dihitung dari meta hasilnya (rows_read / rows_written; adaptor Node hanya punya
// "changes"), lalu disimpan SEKALI per permintaan ke tabel d1_usage. Sinkron/impor farmakologi direm saat
// pemakaian sudah melewati D1_WARN (bawaan 50%) dari batas harian, jauh sebelum Cloudflare memblokir.
const LIM = (env) => ({
  r: num(env.D1_DAY_READS, 5_000_000), // paket gratis: 5 juta baris dibaca / hari
  w: num(env.D1_DAY_WRITES, 100_000),  // paket gratis: 100 ribu baris ditulis / hari
  mb: num(env.D1_MAX_MB, 500),         // paket gratis: 500 MB per database
  warn: Math.min(0.95, Math.max(0.1, num(env.D1_WARN, 0.5))),
});
function num(v, d) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; }
const day = () => new Date().toISOString().slice(0, 10);
let pend = { day: day(), r: 0, w: 0 }, sizeB = 0, ready = false;

let TRACE = false;
function rec(res, isFirst, sql) {
  const d = day(); if (pend.day !== d) pend = { day: d, r: 0, w: 0 };
  const m = (res && res.meta) || {};
  if (m.rows_read != null) pend.r += Number(m.rows_read) || 0;
  else pend.r += isFirst ? 1 : Array.isArray(res && res.results) ? res.results.length : 0;
  if (m.rows_written != null) pend.w += Number(m.rows_written) || 0;
  else pend.w += Number(m.changes) || 0;
  if (m.size_after) sizeB = Number(m.size_after) || sizeB;
  if (TRACE) console.log("[d1]", m.rows_read ?? (isFirst ? 1 : (res && res.results || []).length), m.rows_written ?? m.changes ?? 0, String(sql || "").slice(0, 110));
}
function wrapStmt(st, sql) {
  return {
    bind: (...a) => wrapStmt(st.bind(...a), sql),
    all: async () => { const r = await st.all(); rec(r, false, sql); return r; },
    run: async () => { const r = await st.run(); rec(r, false, sql); return r; },
    first: async (c) => { const r = await st.first(c); rec(null, true, sql); return r; },
    raw: async (o) => { const r = await st.raw(o); pend.r += Array.isArray(r) ? r.length : 0; return r; },
    _raw: st, _sql: sql,
  };
}
export function meter(db, trace) {
  if (!db || db._metered) return db; if (trace) TRACE = true;
  return {
    _metered: true, _db: db,
    prepare: (s) => wrapStmt(db.prepare(s), s),
    batch: async (list) => { const r = await db.batch(list.map((x) => (x && x._raw) || x)); (r || []).forEach((x, i) => rec(x, false, list[i] && list[i]._sql)); return r; },
    exec: (s) => db.exec(s),
    dump: db.dump && (() => db.dump()),
  };
}
const base = (db) => (db && db._db) || db;
async function ensure(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS d1_usage (day TEXT PRIMARY KEY, r INTEGER NOT NULL DEFAULT 0, w INTEGER NOT NULL DEFAULT 0, size INTEGER NOT NULL DEFAULT 0)").run();
  ready = true;
}
// disimpan di akhir permintaan; satu baris tulis saja
export async function flushUsage(db) {
  db = base(db); if (!db || (!pend.w && pend.r < 300)) return; // baca kecil ditumpuk dulu di memori: tidak menulis 1 baris per kunjungan
  const p = pend; pend = { day: day(), r: 0, w: 0 };
  try {
    await ensure(db);
    await db.prepare("INSERT INTO d1_usage (day, r, w, size) VALUES (?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET r = r + excluded.r, w = w + excluded.w, size = MAX(size, excluded.size)").bind(p.day, p.r, p.w + 1, sizeB).run();
    if (Math.random() < 0.02) await db.prepare("DELETE FROM d1_usage WHERE day < ?").bind(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)).run();
  } catch (e) { console.error("d1 usage", e); }
}
export async function usage(db, env) {
  db = base(db); const L = LIM(env), d = day();
  let row = null; try { await ensure(db); row = await db.prepare("SELECT r, w, size FROM d1_usage WHERE day = ?").bind(d).first(); } catch (e) { /* tabel belum ada */ }
  const r = ((row && row.r) || 0) + (pend.day === d ? pend.r : 0), w = ((row && row.w) || 0) + (pend.day === d ? pend.w : 0);
  const size = Math.max(sizeB, (row && row.size) || 0), mb = size / 1048576;
  const pr = r / L.r, pw = w / L.w, ps = size ? mb / L.mb : 0, top = Math.max(pr, pw, ps);
  return { day: d, reads: r, writes: w, mb: Math.round(mb * 10) / 10, lim: L, pct: { r: Math.round(pr * 1000) / 10, w: Math.round(pw * 1000) / 10, s: Math.round(ps * 1000) / 10 }, top: Math.round(top * 1000) / 10, warn: Math.round(L.warn * 100), blocked: top >= L.warn };
}
// pesan untuk penolakan sinkron/impor
export const blockMsg = (u) => "⛔ Pemakaian database hari ini sudah " + u.top + "% (batas aman " + u.warn + "%). Sinkron & impor dihentikan dulu agar kuis dan fitur lain tetap jalan. Dibuka lagi otomatis jam 07.00 WIB.";
