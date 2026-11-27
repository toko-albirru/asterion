// Uji backend AI (src/ai.js) dengan Supabase & APInex palsu (tanpa jaringan): node scripts/test-ai.mjs
import { aiApi, keywords, DEFAULT_CFG } from "../src/ai.js";

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error("  ✗", m); } else console.log("  ✓", m); };

// ───── Supabase palsu (hanya yang dipakai ai.js) ─────
const DB = { settings: null, docs: [], chunks: [], convs: [], msgs: [], usage: {}, users: [], cache: [], marks: [] };
let seq = 1;
const qp = (p, k) => { const m = p.match(new RegExp("[?&]" + k + "=eq\\.([^&]+)")); return m ? decodeURIComponent(m[1]) : null; };
function supa(method, path, body) {
  const [route] = path.split("?");
  const R = (j, s = 200) => new Response(j === undefined ? "" : JSON.stringify(j), { status: s });
  if (route === "ai_settings") { if (method === "POST") { DB.settings = body.v; return R(); } return R(DB.settings ? [{ v: DB.settings }] : []); }
  if (route === "rpc/ai_take") { const k = body.p_u, r = (DB.usage[k] ||= { req: 0, tin: 0, tout: 0 }); if (r.req >= body.p_req || r.tin + r.tout >= body.p_tok) return R({ ok: false, req: r.req, tok: r.tin + r.tout }); r.req++; return R({ ok: true, req: r.req, tok: r.tin + r.tout }); }
  if (route === "rpc/ai_refund") { const r = DB.usage[body.p_u]; if (r) r.req = Math.max(0, r.req - 1); return R(); }
  if (route === "rpc/ai_add_tok") { const r = DB.usage[body.p_u]; r.tin += body.a; r.tout += body.b; return R(); }
  if (route === "rpc/ai_model_mark") { DB.marks.push(body); return R(); }
  if (route === "rpc/ai_stats") return R({ daily: [], users: [], models: [] });
  if (route === "rpc/ai_put_doc") {
    const p = body.p; let d = DB.docs.find((x) => x.skey === p.skey);
    if (!d) { d = { id: seq++, skey: p.skey, enabled: true }; DB.docs.push(d); }
    Object.assign(d, { title: p.title, block: p.block, kind: p.kind, hash: p.hash, n_chunks: p.chunks.length });
    DB.chunks = DB.chunks.filter((c) => c.doc_id !== d.id); p.chunks.forEach((c, i) => DB.chunks.push({ id: seq++, doc_id: d.id, ord: i + 1, loc: c.loc, content: c.content }));
    return R(d.id);
  }
  if (route === "rpc/ai_search") {
    const ws = body.q.split(" | ").map((x) => x.replace(":*", "").toLowerCase());
    const rows = DB.chunks.filter((c) => (body.only_doc == null || c.doc_id === body.only_doc) && DB.docs.find((d) => d.id === c.doc_id).enabled)
      .map((c) => ({ c, s: ws.filter((w) => c.content.toLowerCase().includes(w)).length })).filter((x) => x.s).sort((a, b) => b.s - a.s).slice(0, body.n);
    return R(rows.map(({ c, s }) => { const d = DB.docs.find((x) => x.id === c.doc_id); return { id: c.id, doc_id: d.id, skey: d.skey, title: d.title, block: d.block, loc: c.loc, content: c.content, rank: s }; }));
  }
  if (route === "ai_docs") { if (method === "GET") { const sk = qp(path, "skey"); return R(DB.docs.filter((d) => (!sk || d.skey === sk) && d.enabled)); } }
  if (route === "ai_chunks") { const id = +qp(path, "doc_id"); return R(DB.chunks.filter((c) => c.doc_id === id).sort((a, b) => a.ord - b.ord)); }
  if (route === "ai_users") return R(DB.users.filter((u) => u.u === qp(path, "u")));
  if (route === "ai_cache") { if (method === "POST") { DB.cache = DB.cache.filter((c) => c.h !== body.h); DB.cache.push(body); return R(); } return R(DB.cache.filter((c) => c.h === qp(path, "h"))); }
  if (route === "ai_convs") {
    if (method === "POST") { const c = { id: "11111111-1111-4111-8111-" + String(seq++).padStart(12, "0"), ...body }; DB.convs.push(c); return R([c]); }
    if (method === "PATCH") return R();
    if (method === "DELETE") { const id = qp(path, "id"), u = qp(path, "u"); DB.convs = DB.convs.filter((c) => !(c.id === id && c.u === u)); DB.msgs = DB.msgs.filter((m) => m.conv_id !== id); return R(); }
    const id = qp(path, "id"), u = qp(path, "u"); return R(DB.convs.filter((c) => (!id || c.id === id) && (!u || c.u === u)));
  }
  if (route === "ai_msgs") {
    if (method === "POST") { DB.msgs.push(...body); return R(); }
    const id = qp(path, "conv_id"), lim = +(path.match(/limit=(\d+)/) || [])[1] || 999, desc = /order=id\.desc/.test(path);
    const l = DB.msgs.filter((m) => m.conv_id === id); return R(desc ? l.slice().reverse().slice(0, lim) : l.slice(0, lim));
  }
  return R({ message: "rute tak dikenal: " + route }, 404);
}

// ───── APInex palsu ─────
const CALLS = [];
let BEHAVE = {};
const sseResp = (parts, usage) => new Response(new ReadableStream({ start(c) { const e = new TextEncoder(); for (const p of parts) c.enqueue(e.encode("data: " + JSON.stringify({ choices: [{ delta: { content: p } }] }) + "\n\n")); if (usage) c.enqueue(e.encode("data: " + JSON.stringify({ choices: [], usage }) + "\n\n")); c.enqueue(e.encode("data: [DONE]\n\n")); c.close(); } }), { headers: { "content-type": "text/event-stream" } });
function apinex(body) {
  CALLS.push(body.model); const b = BEHAVE[body.model] || BEHAVE["*"];
  if (b === "429") return new Response('{"error":{"message":"rate limited"}}', { status: 429 });
  if (b === "empty") return sseResp([]);
  if (b === "think") return sseResp(["<thi", "nk>pikir dulu</thi", "nk>Askariasis disebabkan ", "Ascaris lumbricoides [1].", " Wallahu a'lam"], { prompt_tokens: 120, completion_tokens: 30 });
  return sseResp(["Jawaban dari " + body.model + " [1]"]);
}
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.startsWith("https://sb.test/rest/v1/")) return supa(init.method || "GET", url.slice("https://sb.test/rest/v1/".length), init.body ? JSON.parse(init.body) : undefined);
  if (url === "https://api.apinex.bond/v1/chat/completions") return apinex(JSON.parse(init.body));
  throw new Error("fetch tak terduga: " + url);
};

const env = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_KEY: "sb_secret_x", APINEX_API_KEY: "k" };
const call = (path, { u = "G0025001", admin = false, m = "GET", body = {} } = {}) => aiApi(null, env, { u, admin }, path.split("?")[0], new URL("https://x/api/ai/" + path), body, m);
async function events(r) { const t = await r.text(); return t.split("\n\n").filter(Boolean).map((l) => JSON.parse(l.slice(5))); }
const text = (ev) => ev.filter((e) => e.t).map((e) => e.t).join("");

// ───── uji ─────
console.log("keywords");
ok(keywords("Jelaskan siklus hidup Ascaris lumbricoides!").join(",") === "lumbricoides,ascaris,siklus,hidup", "kata kunci diurutkan panjang→pendek, stopword dibuang: " + keywords("Jelaskan siklus hidup Ascaris lumbricoides!"));
ok(!keywords("apa itu 'x; drop table'").some((w) => /[;']/.test(w)), "karakter berbahaya tidak lolos ke tsquery");

console.log("admin: indeks materi");
let r = await call("admin/doc", { admin: true, u: "admin", m: "POST", body: { skey: "h:abc123", title: "Parasit Tinja", block: "Blok 3.4", kind: "html", chunks: [{ loc: "Ascaris", content: "Ascaris lumbricoides menyebabkan askariasis. Telur dimakan lalu larva bermigrasi ke paru." }, { loc: "Trichuris", content: "Trichuris trichiura cacing cambuk hidup di sekum." }] } });
ok(r.status === 200 && (await r.json()).n === 2, "dokumen terindeks");
r = await call("admin/doc", { u: "G0025001", m: "POST", body: {} }); // jalur admin dari mahasiswa
r = await call("admin/cfg", { u: "G0025001" });
ok(r.status === 403, "mahasiswa ditolak di /admin/*");

console.log("chat: fallback antar model + <think> + sitasi");
BEHAVE = { "free/deepseek-v4.1-flash": "429", "free/glm-5.3-flash": "think", "*": "ok" };
r = await call("chat", { m: "POST", body: { q: "Bagaimana siklus hidup Ascaris lumbricoides?", skey: "h:abc123" } });
let ev = await events(r);
ok(r.headers.get("content-type").includes("event-stream"), "respons SSE");
ok(ev[0].conv && ev[0].tier === "fast", "event pertama: conv + tier fast (pertanyaan ringan)");
ok(CALLS.join() === "free/deepseek-v4.1-flash,free/glm-5.3-flash", "model 1 gagal (429) → pindah ke model 2: " + CALLS);
ok(text(ev) === "Askariasis disebabkan Ascaris lumbricoides [1]. Wallahu a'lam", "blok <think> terbuang & potongan tag terpisah ditangani: " + JSON.stringify(text(ev)));
const done = ev.find((e) => e.done);
ok(done && done.cited && done.cites[0].title === "Parasit Tinja" && done.cites[0].skey === "h:abc123", "sitasi menunjuk materi sumber");
ok(done.quota.req === 1 && DB.usage.G0025001.tin === 120 && DB.usage.G0025001.tout === 30, "kuota & token tercatat dari usage API");
ok(DB.msgs.length === 2 && DB.msgs[1].model === "free/glm-5.3-flash", "riwayat user+asisten tersimpan");
const conv1 = ev[0].conv;

console.log("chat: pertanyaan lanjutan memakai riwayat");
BEHAVE = { "*": "ok" }; CALLS.length = 0;
r = await call("chat", { m: "POST", body: { q: "Kalau Trichuris?", conv: conv1 } }); ev = await events(r);
ok(DB.msgs.length === 4, "riwayat bertambah");
ok(DB.usage.G0025001.req === 2, "kuota bertambah");

console.log("cache");
r = await call("chat", { u: "G0025002", m: "POST", body: { q: "Bagaimana siklus hidup Ascaris lumbricoides?", skey: "h:abc123" } }); ev = await events(r);
ok(ev.find((e) => e.done).cached === true && !DB.usage.G0025002, "pertanyaan sama → dari cache, tidak memakai kuota");

console.log("semua model gagal → kutipan materi + kuota dikembalikan");
BEHAVE = { "*": "429" }; CALLS.length = 0;
r = await call("chat", { u: "G0025003", m: "POST", body: { q: "Ceritakan tentang cacing cambuk Trichuris trichiura" } }); ev = await events(r);
ok(/limit AI sedang penuh/.test(text(ev)) && /kutipan materi/.test(text(ev)) && /Trichuris/.test(text(ev)), "fallback menampilkan kutipan materi");
ok(CALLS.length === 3, "semua model di tier dicoba: " + CALLS);
ok(DB.usage.G0025003.req === 0, "kuota dikembalikan karena AI tidak menjawab");

console.log("pemutus (circuit breaker)");
CALLS.length = 0;
for (let i = 0; i < 2; i++) await (await call("chat", { u: "G0025003", m: "POST", body: { q: "tes pemutus nomor " + i } })).text();
CALLS.length = 0; await (await call("chat", { u: "G0025003", m: "POST", body: { q: "tes pemutus lagi" } })).text();
ok(CALLS.length === 3, "model yang sering gagal tetap dicoba sebagai opsi terakhir");

console.log("kuota & blokir");
BEHAVE = { "*": "ok" };
await call("admin/cfg", { admin: true, u: "admin", m: "PUT", body: { quota: { req: 2, tok: 1000000 }, force_tier: "smart", cache: false } });
let c = 0; for (let i = 0; i < 3; i++) { const x = await call("chat", { u: "G0025010", m: "POST", body: { q: "pertanyaan nomor " + i } }); if (x.status === 200) { await x.text(); c++; } else r = x; }
ok(c === 2 && r.status === 429, "pesan ke-3 ditolak 429");
DB.users.push({ u: "G0025011", blocked: true });
r = await call("chat", { u: "G0025011", m: "POST", body: { q: "boleh?" } });
ok(r.status === 403, "akun diblokir ditolak");
CALLS.length = 0; BEHAVE = { "*": "ok" };
await (await call("chat", { u: "admin", admin: true, m: "POST", body: { q: "admin tanpa batas" } })).text();
ok(CALLS[0] === "free/deepseek-v4-pro-0813", "force_tier=smart dari dashboard dipakai: " + CALLS[0]);

console.log("riwayat & isolasi akun");
r = await call("convs", { u: "G0025001" }); ok((await r.json()).convs.length >= 1, "daftar percakapan");
r = await call("conv?id=" + conv1, { u: "G0025099" }); ok(r.status === 404, "akun lain tidak bisa membaca percakapan orang");
r = await call("conv?id=" + conv1, { u: "G0025001" }); ok((await r.json()).msgs.length === 4, "pemilik bisa membaca");
r = await call("conv/del", { u: "G0025099", m: "POST", body: { id: conv1 } }); r = await call("conv?id=" + conv1, { u: "G0025001" }); ok(r.status === 200, "akun lain tidak bisa menghapus");

console.log("tanpa konfigurasi Supabase");
r = await aiApi(null, {}, { u: "G0025001", admin: false }, "chat", new URL("https://x/api/ai/chat"), { q: "halo" }, "POST");
ok(r.status === 503 && /SUPABASE_URL/.test((await r.json()).err), "pesan jelas, tidak crash");

console.log(fails ? `\n${fails} GAGAL` : "\nSemua lulus");
process.exit(fails ? 1 : 0);
