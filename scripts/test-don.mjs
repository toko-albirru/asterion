// Uji donasi (src/donasi.js) dengan Supabase palsu: node scripts/test-don.mjs
import { donApi, cleanText } from "../src/donasi.js";
import crypto from "node:crypto";
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("  ✗", m); } else console.log("  ✓", m); };
const T = []; let seq = 1;
const qp = (p, k) => { const m = p.match(new RegExp("[?&]" + k + "=(?:eq\\.)?([^&]+)")); return m ? decodeURIComponent(m[1]) : null; };
globalThis.fetch = async (url, init = {}) => {
  const p = String(url).replace("https://sb.test/rest/v1/", ""), [route] = p.split("?"), m = init.method || "GET", b = init.body ? JSON.parse(init.body) : null, R = (j) => new Response(JSON.stringify(j ?? ""), { status: 200 });
  if (route !== "don_items") return new Response("{}", { status: 404 });
  if (m === "POST") { if (b.sa_id && T.some((x) => x.sa_id === b.sa_id)) return new Response('{"message":"dup"}', { status: 409 }); T.push({ id: b.id || "00000000-0000-4000-8000-" + String(seq++).padStart(12, "0"), created_at: new Date().toISOString(), ...b }); return R(); }
  if (m === "DELETE") { const u = qp(p, "u"), st = qp(p, "status"), id = qp(p, "id"); for (let i = T.length - 1; i >= 0; i--) if ((u && T[i].u === u && T[i].status === st) || (id && T[i].id === id)) T.splice(i, 1); return R(); }
  if (m === "PATCH") { const id = qp(p, "id"); Object.assign(T.find((x) => x.id === id), b); return R(); }
  let r = T.slice();
  const sa = qp(p, "sa_id"); if (sa && !/is\.null/.test(p)) r = r.filter((x) => x.sa_id === sa);
  const code = qp(p, "code"); if (code) r = r.filter((x) => x.code === code && !x.sa_id && ["pledge", "pending"].includes(x.status));
  if (/status=eq\.paid/.test(p)) r = r.filter((x) => x.status === "paid"); if (/status=eq\.pending/.test(p)) r = r.filter((x) => x.status === "pending");
  if (/status=neq\.pledge/.test(p)) r = r.filter((x) => x.status !== "pledge");
  return R(r);
};
const KEY = "kunci-stream", env = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_KEY: "x", SAWERIA_STREAM_KEY: KEY, SAWERIA_URL: "https://saweria.co/asterion", ASSETS: { fetch: async () => new Response('window.MHS={\n"G0025001": "Aditya Ikhsan Wicaksono",\n"G0025002": "Agung Haryo"\n};') } };
const sig = (b, key = KEY) => crypto.createHmac("sha256", key).update(`${b.version}${b.id}${b.amount_raw}${b.donator_name}${b.donator_email}`).digest("hex");
const call = (path, { a = { u: "G0025001", admin: false }, m = "GET", body = {}, headers = {} } = {}) => donApi({ headers: new Headers(headers) }, env, a, path, new URL("https://x/"), body, m);
const hook = (b, s) => call("saweria", { a: null, m: "POST", body: b, headers: s === undefined ? { "saweria-callback-signature": sig(b) } : s ? { "saweria-callback-signature": s } : {} });

console.log("pledge");
let r = await (await call("pledge", { m: "POST", body: { mode: "nama", show_amount: true } })).json();
ok(/^AST-[A-HJ-NP-Z2-9]{5}$/.test(r.code) && r.url === "https://saweria.co/asterion", "kode dibuat: " + r.code);
ok(T[0].display === "Aditya Ikhsan Wicaksono", "mode nama → nama dari daftar mahasiswa (server-side)");
const code1 = r.code;
await call("pledge", { m: "POST", body: { mode: "nim" } }); ok(T.filter((x) => x.u === "G0025001" && x.status === "pledge").length === 1, "satu kode aktif per akun");
r = await (await call("pledge", { a: { u: "G0025002", admin: false }, m: "POST", body: { mode: "anon" } })).json(); ok(T.at(-1).display === "Hamba Allah", "mode anonim");
r = await (await call("pledge", { a: { u: "G0025003", admin: false }, m: "POST", body: { mode: "bebas", name: "Dr. Budi <b>Santoso</b> https://x.co 08123456789" } })).json(); ok(T.at(-1).display === "Dr. Budi bSantoso/b", "nama pilihan sendiri dibersihkan (tag, tautan, nomor telepon dibuang): " + T.at(-1).display);
const code3 = r.code;
await call("pledge", { a: { u: "G0025004", admin: false }, m: "POST", body: { mode: "bebas", name: "  " } }); ok(T.at(-1).display === "Hamba Allah", "nama kosong → Hamba Allah");
ok(cleanText("halo AST-7K2QX semangat wa 081234567890", 100) === "halo semangat wa", "pesan: kode donasi, nomor, tautan dibuang");
for (const v of ["AST-286CM", "ast-286cm", "AST 286CM", "AST286CM", "AST–286CM", "ast_286cm"]) ok(cleanText("Semangat " + v + " kuliahnya", 100) === "Semangat kuliahnya", "kode '" + v + "' tidak ikut tampil di pesan");
ok(cleanText("AST-286CM", 100) === "", "pesan yang hanya berisi kode → kosong (tidak tampil)");
await call("pledge", { m: "POST", body: { mode: "nim", show_amount: false } }); const codeNim = T.find((x) => x.u === "G0025001" && x.status === "pledge");
ok(codeNim.display === "G0025001", "mode NIM");

console.log("webhook Saweria");
const b1 = { version: "2021.07", id: "sa-1", type: "donation", amount_raw: 50000, donator_name: "Orang Iseng", donator_email: "a@b.c", message: "semangat " + codeNim.code.toLowerCase() };
r = await (await hook(b1)).json(); ok(r.matched === 1 && r.verified === true, "tanda tangan valid + kode cocok");
let wall = await (await call("wall")).json();
ok(wall.items.length === 1 && wall.items[0].name === "G0025001" && wall.items[0].amount === null, "dinding menampilkan pilihan donatur (bukan nama ketikan Saweria), nominal disembunyikan");
r = await (await hook(b1)).json(); ok(r.dup === 1 && T.filter((x) => x.sa_id === "sa-1").length === 1, "kirim ulang tidak menggandakan");

const b2 = { version: "2021.07", id: "sa-2", type: "donation", amount_raw: 20000, donator_name: "X", donator_email: "", message: "tanpa kode" };
await hook(b2); await call("admin/set", { a: { u: "admin", admin: true }, m: "POST", body: { id: T.find((x) => x.sa_id === "sa-2").id, status: "paid" } }); // cache dinding dibersihkan
wall = await (await call("wall")).json(); ok(wall.items.length === 2 && wall.items.some((x) => x.name === "X" && x.msg === "tanpa kode" && x.amount === null), "tanpa kode → nama dari yang diketik di Saweria, pesan ikut, nominal tidak tampil");
ok(wall.items.find((x) => x.name === "G0025001").msg === "semangat", "pesan di dinding tidak memuat kode donasi");

const bv = { version: "2021.07", id: "sa-v", type: "donation", amount_raw: 10000, donator_name: "Rina", donator_email: "", message: "semangat " + codeNim.code.slice(0, 3) + " " + codeNim.code.slice(4).toLowerCase() };
await call("pledge", { a: { u: "G0025020", admin: false }, m: "POST", body: { mode: "nim" } }); const cv = T.find((x) => x.u === "G0025020").code;
r = await (await hook({ ...bv, message: "yuk " + cv.replace("-", " ").toLowerCase() })).json(); ok(r.matched === 1, "kode dengan spasi/huruf kecil tetap dikenali");
const b3 = { version: "2021.07", id: "sa-3", type: "donation", amount_raw: 99999, donator_name: "Palsu", donator_email: "", message: code3 };
r = await (await hook(b3, "deadbeef")).json(); ok(r.verified === false, "tanda tangan salah → tidak terverifikasi");
wall = await (await call("wall")).json(); ok(wall.items.length === 3 && !wall.items.some((x) => x.name === "Palsu"), "donasi tak terverifikasi TIDAK tampil di dinding");
r = await (await hook({ ...b3, id: "sa-4" }, "")).json(); ok(r.verified === false, "tanpa header tanda tangan → pending");

console.log("admin");
let L = await (await call("admin/list", { a: { u: "admin", admin: true } })).json(); const pend = L.items.find((x) => x.status === "pending" && x.sa_id !== undefined);
ok(L.items.some((x) => x.status === "pending"), "pending tampil di daftar admin");
r = await call("admin/list", {}); ok(r.status === 403, "mahasiswa ditolak di admin");
const pid = T.find((x) => x.status === "pending").id; await call("admin/set", { a: { u: "admin", admin: true }, m: "POST", body: { id: pid, status: "paid", display: "Pak Budi", show_amount: true } });
wall = await (await call("wall")).json(); ok(wall.items.some((x) => x.name === "Pak Budi" && x.amount > 0), "admin menyetujui + nominal tampil karena show_amount diaktifkan");
await call("admin/add", { a: { u: "admin", admin: true }, m: "POST", body: { display: "Hamba Allah", amount: 10000, show_amount: false } }); wall = await (await call("wall")).json(); ok(wall.items.some((x) => x.name === "Hamba Allah" && x.amount === null), "donasi manual (QRIS) tercatat");

console.log("tanpa stream key (mode manual)");
delete env.SAWERIA_STREAM_KEY; T.length = 0;
r = await (await hook({ ...b1, id: "sa-9", message: "" })).json(); ok(r.verified === false && T[0].status === "pending", "tanpa kunci → semua menunggu persetujuan admin");
console.log(fails ? `\n${fails} GAGAL` : "\nSemua lulus"); process.exit(fails ? 1 : 0);
