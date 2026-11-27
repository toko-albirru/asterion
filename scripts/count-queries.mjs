// Mengukur jumlah panggilan D1 untuk satu sinkron obat realistis (memakai SQLite lokal sebagai pengganti D1).
// Batas Cloudflare per permintaan Worker: 50 query (Free) / 1000 (Paid).
import { DatabaseSync } from "node:sqlite";
import { farmakoApi } from "../src/farmako.js";
const sq = new DatabaseSync(":memory:"); let calls = 0, stmts = 0;
const wrap = (sql) => ({ sql, args: [], bind(...a) { this.args = a; return this; }, async run() { calls++; stmts++; const r = sq.prepare(sql).run(...this.args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; }, async first() { calls++; stmts++; return sq.prepare(sql).get(...this.args) || null; }, async all() { calls++; stmts++; return { results: sq.prepare(sql).all(...this.args) }; } });
const DB = { prepare: wrap, async batch(list) { calls++; const o = []; for (const s of list) { stmts++; const r = sq.prepare(s.sql).run(...s.args); o.push({ meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }); } return o; } };
const real = globalThis.fetch, J = (x) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });
const n = (k) => Array.from({ length: k }, (_, i) => k + "-" + i);
globalThis.fetch = async (url) => { const u = decodeURIComponent(String(url));
  if (u.includes("api.fda.gov")) return J({ results: [{ set_id: "S1", openfda: { generic_name: ["VANCO"], brand_name: n(10), route: ["IV"], pharm_class_epc: ["A [EPC]"], pharm_class_moa: ["B [MoA]", "C [MoA]", "D [MoA]"] }, indications_and_usage: ["x"], contraindications: ["x"], adverse_reactions: ["x"], warnings: ["x"], drug_interactions: ["x"], mechanism_of_action: ["x"], pharmacokinetics: ["x"], dosage_and_administration: ["x"] }] });
  if (u.includes("molecule.json")) return J({ molecules: [{ molecule_chembl_id: "C1", molecule_synonyms: n(20).map((x) => ({ molecule_synonym: "Sin" + x })) }] });
  if (u.includes("mechanism.json")) return J({ mechanisms: n(6).map((x, i) => ({ mechanism_of_action: "M" + i, target_chembl_id: "T" + i })) });
  if (u.includes("target.json")) return J({ targets: n(6).map((x, i) => ({ target_chembl_id: "T" + i, pref_name: "Target " + i, organism: "H" })) });
  return real(url); };
const env = { DB }, A = { u: "admin", admin: true };
const call = async (p, b) => { const r = await farmakoApi({}, env, A, p.split("?")[0], new URL("http://x/api/farmako/" + p), b || {}, b ? "POST" : "GET"); return { s: r.status, j: await r.json() }; };
const s0 = await call("admin/seed-names", { names: ["vanco"] }); console.log("seed", JSON.stringify(s0)); const l0 = await call("admin/drugs?q=vanco"); console.log("list", JSON.stringify(l0)); const id = l0.j.rows[0].id;
for (const src of ["openfda", "chembl"]) { calls = 0; stmts = 0; const r = await call("admin/sync", { src, ids: [id] }); console.log(src.padEnd(8), "HTTP", r.s, "| panggilan D1:", calls, "| pernyataan SQL:", stmts, "|", JSON.stringify(r.j.out || r.j)); }
