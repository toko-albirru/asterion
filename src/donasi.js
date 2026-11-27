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
const CODE_RE = /AST[\s\-–—_.:]*([A-HJ-NP-Z2-9]{5})/i; // toleran: AST-286CM, ast 286cm, AST286CM, AST–286CM
const CODE_ANY = /\bAST[\s\-–—_.:]*[A-Z0-9]{5}\b/gi; // untuk dibuang dari teks yang tampil (termasuk kode yang salah ketik)
// Teks dari donatur (nama/pesan di Saweria, nama pilihan sendiri) tidak dipercaya: buang tautan, email, nomor panjang, kode donasi, tanda < >.
export const cleanText = (v, n) => clip(String(v || "").replace(/https?:\/\/\S+|www\.\S+/gi, " ").replace(/\S+@\S+\.\S+/g, " ").replace(/\d[\d\s.-]{6,}\d/g, " ").replace(CODE_ANY, " ").replace(/[<>]/g, "").replace(/\s+/g, " "), n);
const cleanName = (v) => cleanText(v, 30) || "Hamba Allah";
let WALL = null, WALL_T = 0, NAMES = null;
async function names(env) { // NIM → nama, dibaca dari public/mahasiswa.js (aset statis)
  if (NAMES) return NAMES;
  try { const r = await env.ASSETS.fetch(new Request("https://assets.local/mahasiswa.js")), t = await r.text(), m = {}; for (const x of t.matchAll(/"(G\d{7})"\s*:\s*"([^"]+)"/g)) m[x[1]] = x[2]; NAMES = m; } catch { NAMES = {}; }
  return NAMES;
}
async function displayFor(env, mode, u, free) {
  if (mode === "nim" && /^G\d{7}$/.test(u || "")) return u;
  if (mode === "nama" && /^G\d{7}$/.test(u || "")) return (await names(env))[u] || u;
  if (mode === "bebas") return cleanName(free);
  return "Hamba Allah";
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
  const cm = clip(b.message, 300).match(CODE_RE), code = cm ? "AST-" + cm[1].toUpperCase() : null;
  const pl = code ? (await sb(env, `don_items?code=eq.${code}&sa_id=is.null&status=in.(pledge,pending)&select=id`))[0] : null;
  if (pl) { await sb(env, `don_items?id=eq.${pl.id}`, { m: "PATCH", h: MIN, b: fields }); WALL = null; return J({ ok: 1, matched: 1, verified: ok }); }
  if (!ok && (await sb(env, "don_items?status=eq.pending&select=id&limit=300")).length >= 300) return J({ ok: 1, full: 1 }); // batasi sampah dari pengirim tak terverifikasi
  await sb(env, "don_items", { m: "POST", h: MIN, b: { ...fields, mode: "bebas", show_amount: false, display: cleanName(b.donator_name) } }); WALL = null;
  return J({ ok: 1, matched: 0, verified: ok });
}

export async function donApi(request, env, a, path, url, body, M) {
  try {
    if (!sbReady(env)) return err("Donasi belum dikonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_KEY).", 503);
    if (path === "saweria") return M === "POST" ? await webhook(env, request, body) : err("method", 405);
    if (!a) return err("auth", 401);
    if (path === "info" && M === "GET") return J({ url: env.SAWERIA_URL || "", auto: !!env.SAWERIA_STREAM_KEY });
    if (path === "wall" && M === "GET") { // untuk teks berjalan di beranda; cache 60 dtk
      if (!WALL || Date.now() - WALL_T > 60000) {
        const rows = await sb(env, "don_items?status=eq.paid&order=paid_at.desc&limit=40&select=display,amount,show_amount,message,paid_at");
        WALL = rows.map((r) => ({ name: r.display, amount: r.show_amount ? r.amount : null, msg: cleanText(r.message, 140), at: r.paid_at })); WALL_T = Date.now();
      }
      return J({ items: WALL });
    }
    if (path === "pledge" && M === "POST") { // donatur memilih tampilan → dapat kode untuk ditulis di pesan Saweria
      const mode = ["anon", "nim", "nama", "bebas"].includes(body.mode) ? body.mode : "anon", realMode = a.admin && (mode === "nim" || mode === "nama") ? "anon" : mode;
      await sb(env, `don_items?u=eq.${enc(a.u)}&status=eq.pledge`, { m: "DELETE", h: MIN }); // satu kode aktif per akun
      const code = newCode(), id = crypto.randomUUID(); WALL = null;
      await sb(env, "don_items", { m: "POST", h: MIN, b: { id, code, u: a.u, mode: realMode, show_amount: !!body.show_amount, display: await displayFor(env, realMode, a.u, body.name), status: "pledge" } });
      return J({ code, url: env.SAWERIA_URL || "", auto: !!env.SAWERIA_STREAM_KEY });
    }
    if (path.startsWith("admin/")) {
      if (!a.admin) return err("admin", 403);
      if (path === "admin/list" && M === "GET") return J({ items: await sb(env, "don_items?status=neq.pledge&order=created_at.desc&limit=200&select=id,display,mode,show_amount,amount,status,sig_ok,raw_name,message,u,paid_at,created_at"), auto: !!env.SAWERIA_STREAM_KEY });
      if (path === "admin/set" && M === "POST") {
        if (!UUID.test(String(body.id || ""))) return err("id");
        const p = {}; if (["paid", "pending", "hidden"].includes(body.status)) { p.status = body.status; if (body.status === "paid") p.paid_at = new Date().toISOString(); }
        if (typeof body.display === "string" && body.display.trim()) p.display = cleanText(body.display, 60) || p.display;
        if (typeof body.show_amount === "boolean") p.show_amount = body.show_amount;
        if (!Object.keys(p).length) return err("tidak ada perubahan");
        await sb(env, `don_items?id=eq.${body.id}`, { m: "PATCH", h: MIN, b: p }); WALL = null; return J({ ok: 1 });
      }
      if (path === "admin/add" && M === "POST") { // catat donasi manual (mis. QRIS/transfer)
        const display = cleanText(body.display, 60); if (!display) return err("nama kosong");
        await sb(env, "don_items", { m: "POST", h: MIN, b: { mode: "bebas", display, amount: int(body.amount, 0) || null, show_amount: !!body.show_amount && int(body.amount, 0) > 0, status: "paid", paid_at: new Date().toISOString() } }); WALL = null; return J({ ok: 1 });
      }
      if (path === "admin/del" && M === "POST") { if (!UUID.test(String(body.id || ""))) return err("id"); await sb(env, `don_items?id=eq.${body.id}`, { m: "DELETE", h: MIN }); WALL = null; return J({ ok: 1 }); }
    }
    return err("not found", 404);
  } catch (e) { console.error("[don]", e && e.message); return err("Donasi error: " + clip(e && e.message, 120), 502); }
}
