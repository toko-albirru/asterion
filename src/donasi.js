// ASTERION — DONASI (Saweria webhook + dinding donatur). Dipanggil dari worker.js: /api/don/* dan /api/don/saweria (publik, tanpa login).
// Data di Supabase (tabel don_items). Nama yang tampil dihitung SERVER dari pilihan donatur & akun login — bukan dari yang diketik di Saweria.
import { sb, sbReady } from "./ai.js";

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const err = (m, s = 400) => J({ err: m }, s);
const clip = (v, n) => String(v == null ? "" : v).replace(/\u0000/g, "").trim().slice(0, n);
const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const enc = encodeURIComponent;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REP = { prefer: "return=representation" }, MIN = { prefer: "return=minimal" };
const CODE_RE = /AST-[A-HJ-NP-Z2-9]{5}/;
const ADJ = ["Ceria", "Bijak", "Tangguh", "Teliti", "Sabar", "Cekatan", "Dermawan", "Gigih", "Tulus", "Ramah", "Cerdas", "Jujur"];
const NOUN = ["Cemara", "Elang", "Bintang", "Kancil", "Mentari", "Pelangi", "Rajawali", "Anggrek", "Merpati", "Samudra", "Embun", "Kenari"];

export function randName(seed) {
  let h = 2166136261; for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h >>>= 0; return "Sahabat " + NOUN[h % NOUN.length] + " " + ADJ[(h >>> 8) % ADJ.length];
}
let NAMES = null;
async function names(env) { // NIM → nama, dibaca dari public/mahasiswa.js (aset statis)
  if (NAMES) return NAMES;
  try { const r = await env.ASSETS.fetch(new Request("https://assets.local/mahasiswa.js")), t = await r.text(), m = {}; for (const x of t.matchAll(/"(G\d{7})"\s*:\s*"([^"]+)"/g)) m[x[1]] = x[2]; NAMES = m; } catch { NAMES = {}; }
  return NAMES;
}
async function displayFor(env, mode, u, seed) {
  if (mode === "anon") return "Hamba Allah";
  if (mode === "nim" && /^G\d{7}$/.test(u || "")) return u;
  if (mode === "nama" && /^G\d{7}$/.test(u || "")) return (await names(env))[u] || u;
  return randName(seed);
}
const newCode = () => { const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", b = crypto.getRandomValues(new Uint8Array(5)); return "AST-" + [...b].map((x) => A[x % A.length]).join(""); };
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function hmac(key, msg) { const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg))); }
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

// Tanda tangan webhook Saweria: HMAC-SHA256(stream key, version+id+amount_raw+donator_name+donator_email) heksadesimal.
// CATATAN: rumus ini dari ingatan, belum diverifikasi dengan dokumentasi resmi. Jika tidak cocok, donasi tidak hilang:
// tersimpan berstatus "pending" dan admin bisa menyetujuinya manual di dasbor.
export async function sawSigOk(env, request, b) {
  const key = env.SAWERIA_STREAM_KEY, sig = request.headers.get("saweria-callback-signature") || "";
  if (!key || !sig) return false;
  const exp = await hmac(key, `${b.version ?? ""}${b.id ?? ""}${b.amount_raw ?? ""}${b.donator_name ?? ""}${b.donator_email ?? ""}`);
  return same(exp, sig.trim().toLowerCase());
}

async function webhook(env, request, b) {
  if (!b || typeof b !== "object" || (b.type && b.type !== "donation")) return J({ ok: 1, ignored: 1 });
  const saId = clip(b.id, 80); if (!saId) return J({ ok: 1, ignored: 1 });
  if ((await sb(env, `don_items?sa_id=eq.${enc(saId)}&select=id`))[0]) return J({ ok: 1, dup: 1 }); // Saweria mengirim ulang → abaikan
  const ok = await sawSigOk(env, request, b), amount = int(b.amount_raw, 0), now = new Date().toISOString();
  const fields = { amount, sa_id: saId, raw_name: clip(b.donator_name, 80), message: clip(b.message, 300), sig_ok: ok, status: ok ? "paid" : "pending", paid_at: now };
  const code = (clip(b.message, 300).toUpperCase().match(CODE_RE) || [])[0];
  const pl = code ? (await sb(env, `don_items?code=eq.${code}&sa_id=is.null&status=in.(pledge,pending)&select=id`))[0] : null;
  if (pl) { await sb(env, `don_items?id=eq.${pl.id}`, { m: "PATCH", h: MIN, b: fields }); return J({ ok: 1, matched: 1, verified: ok }); }
  if (!ok && (await sb(env, "don_items?status=eq.pending&select=id&limit=300")).length >= 300) return J({ ok: 1, full: 1 }); // batasi sampah dari pengirim tak terverifikasi
  await sb(env, "don_items", { m: "POST", h: MIN, b: { ...fields, mode: "acak", show_amount: false, display: randName(saId) } });
  return J({ ok: 1, matched: 0, verified: ok });
}

export async function donApi(request, env, a, path, url, body, M) {
  try {
    if (!sbReady(env)) return err("Donasi belum dikonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_KEY).", 503);
    if (path === "saweria") return M === "POST" ? await webhook(env, request, body) : err("method", 405);
    if (!a) return err("auth", 401);
    if (path === "info" && M === "GET") return J({ url: env.SAWERIA_URL || "", auto: !!env.SAWERIA_STREAM_KEY });
    if (path === "wall" && M === "GET") {
      const rows = await sb(env, "don_items?status=eq.paid&order=paid_at.desc&limit=80&select=display,amount,show_amount,paid_at");
      return J({ items: rows.map((r) => ({ name: r.display, amount: r.show_amount ? r.amount : null, at: r.paid_at })) });
    }
    if (path === "pledge" && M === "POST") { // donatur memilih tampilan → dapat kode untuk ditulis di pesan Saweria
      const mode = ["anon", "nim", "nama", "acak"].includes(body.mode) ? body.mode : "acak", realMode = a.admin && (mode === "nim" || mode === "nama") ? "acak" : mode;
      await sb(env, `don_items?u=eq.${enc(a.u)}&status=eq.pledge`, { m: "DELETE", h: MIN }); // satu kode aktif per akun
      const code = newCode(), id = crypto.randomUUID();
      await sb(env, "don_items", { m: "POST", h: MIN, b: { id, code, u: a.u, mode: realMode, show_amount: !!body.show_amount, display: await displayFor(env, realMode, a.u, id), status: "pledge" } });
      return J({ code, url: env.SAWERIA_URL || "", auto: !!env.SAWERIA_STREAM_KEY });
    }
    if (path.startsWith("admin/")) {
      if (!a.admin) return err("admin", 403);
      if (path === "admin/list" && M === "GET") return J({ items: await sb(env, "don_items?status=neq.pledge&order=created_at.desc&limit=200&select=id,display,mode,show_amount,amount,status,sig_ok,raw_name,message,u,paid_at,created_at"), auto: !!env.SAWERIA_STREAM_KEY });
      if (path === "admin/set" && M === "POST") {
        if (!UUID.test(String(body.id || ""))) return err("id");
        const p = {}; if (["paid", "pending", "hidden"].includes(body.status)) { p.status = body.status; if (body.status === "paid") p.paid_at = new Date().toISOString(); }
        if (typeof body.display === "string" && body.display.trim()) p.display = clip(body.display, 60);
        if (typeof body.show_amount === "boolean") p.show_amount = body.show_amount;
        if (!Object.keys(p).length) return err("tidak ada perubahan");
        await sb(env, `don_items?id=eq.${body.id}`, { m: "PATCH", h: MIN, b: p }); return J({ ok: 1 });
      }
      if (path === "admin/add" && M === "POST") { // catat donasi manual (mis. QRIS/transfer)
        const display = clip(body.display, 60); if (!display) return err("nama kosong");
        await sb(env, "don_items", { m: "POST", h: MIN, b: { mode: "acak", display, amount: int(body.amount, 0) || null, show_amount: !!body.show_amount && int(body.amount, 0) > 0, status: "paid", paid_at: new Date().toISOString() } }); return J({ ok: 1 });
      }
      if (path === "admin/del" && M === "POST") { if (!UUID.test(String(body.id || ""))) return err("id"); await sb(env, `don_items?id=eq.${body.id}`, { m: "DELETE", h: MIN }); return J({ ok: 1 }); }
    }
    return err("not found", 404);
  } catch (e) { console.error("[don]", e && e.message); return err("Donasi error: " + clip(e && e.message, 120), 502); }
}
