// ASTERION dashboard - Cloudflare Worker (login, data, jadwal)
const SHEET_ID = "1D3ZaMWmvgEmWs1eKBVPs4FYY3y3_KnYUglsJz1qdYEw";
const YT = (n, id) => ({ n, u: "https://www.youtube.com/playlist?list=" + id });
const BLOK = ["1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "3.1", "3.2", "3.3"];

const SEED = {
  materi: BLOK.map((b) => ({ n: "Blok " + b, lab: [], all: [] })),
  drive: [
    { n: "ASTERION 2025 - Google Drive 📚", u: "https://drive.google.com/drive/folders/1Q3J2dbVBXlP-XjL6b5e576w3iXMycKwK" },
    { n: "PENDPRODUKTIF - Google Drive 📚", u: "https://uns.id/PENDPRODUKTIF" },
  ],
  rekaman: [
    {
      n: "Tahun 1",
      kl: [YT("COURSE SEMESTER 2 📝", "PLUhisA1gvLGguktNZEgdCTDhySzZUcbZd"), YT("COURSE SEMESTER 1 📝", "PLKURwlbbF7goMvqYiU6x1NYIDm46sh074"), { n: "PANCASILA 🇮🇩", u: "https://docs.google.com/document/d/1vs6codo3EMhkWBTvnm5pKyOOHWLkyFTdxI2_m1fP-1w/edit?usp=sharing" }],
      blok: [
        YT("Rec. Kuliah 2.3 B 🧠", "PLKURwlbbF7grrBnrQW5dnHKrDY_78ac8g"), YT("Rec. Kuliah 2.3 A 🧠", "PLUhisA1gvLGgI5XraTgSOy51pSGf8ZjjA"),
        YT("Rec. Blok 2.2 A 🫁", "PLUhisA1gvLGgxoyQvo8BXDIoaoW71eb8v"), YT("Rec. Blok 2.2 B 🫁", "PLKURwlbbF7gqfEC8GscL8mT3g1pEJngoe"),
        YT("Rec. Blok 2.1 A 🤱", "PLUhisA1gvLGhm2-LM_TfvLWUxAzMn-MLo"), YT("Rec. Blok 2.1 B 🤱", "PLKURwlbbF7gp4SssFmpYSlVK6iAguJhAP"),
        YT("Rec. Blok 1.3 A 🍝", "PLUhisA1gvLGgPm_d6Q0j0yihsBdb7sMQz"), YT("Rec. Blok 1.3 B 🍝", "PLKURwlbbF7gpd1Xj8aWZhU2J-RP2YrAkf"),
        YT("Rec. Blok 1.2 B 💪🏻", "PLKURwlbbF7gpeNhurf2i5BHtt1XkdIuhQ"), YT("Rec. Blok 1.2 A 💪🏻", "PLUhisA1gvLGjfNXR_ADBxOTCSSrswmxY4"),
        YT("Rec. Blok 1.1 B 🧬", "PLKURwlbbF7goqz8s07-71aL3E2xLTE0aA"),
      ],
      lab: [
        YT("Rec. Lab Anatomi A 🩻", "PLUhisA1gvLGg4TKuj1dQmvNX9kkrk_y7b"), YT("Rec. Lab Anatomi B 🩻", "PLKURwlbbF7goY_FBh2hr6A2x1EvpLkUE5"),
        YT("Rec. Lab Biokimia ⚗️", "PLUhisA1gvLGgAXTLgeU5kUb_Pp66RQrkC"), YT("Rec. Lab Fisiologi 🐸", "PLUhisA1gvLGjbYvlbB6_4qU4eSUm-YZsv"),
        YT("Rec. Lab Histologi 🔬", "PLUhisA1gvLGgmLiaCYJTY2Kv9dUpaD3M1"),
      ],
    },
    {
      n: "Tahun 2",
      kl: [YT("COURSE SEMESTER 3 B 📝", "PLG0JX9tRqS4I"), YT("COURSE SEMESTER 3 A 📝", "PLAyxIT7swTxE")],
      blok: [YT("Rec. Kuliah 3.2 B 🍥", "PLT5-e8fQ1Mvg"), YT("Rec. Kuliah 3.2 A 🍥", "PLPNOYL8asFSs"), YT("Rec. Kuliah 3.1 B 💉", "PLHq78i4ZQjNg"), YT("Rec. Kuliah 3.1 A 💉", "PLTaq-NERydmE")],
      lab: [YT("Rec. Lab Parasitologi 🪳", "PLORPGFvRNJy4"), YT("Rec. Lab Patologi Anatomi 🍥", "PLWve0_ff4kLA"), YT("Rec. Lab Farmakologi 🐭", "PLTnxWbCwECZw"), YT("Rec. Lab Patologi Klinik 💉", "PLJjy1MaImONM")],
    },
    { n: "Tahun 3", kl: [], blok: [], lab: [] },
  ],
  sheet: { id: SHEET_ID, tabs: [{ n: "Jadwal", g: "0" }] },
};

const enc = new TextEncoder();
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(k, m) {
  const key = await crypto.subtle.importKey("raw", enc.encode(k), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(m)));
}
async function pbk(p, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(p), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 10000 }, key, 256));
}
const isStu = (u) => /^G0025\d{3}$/.test(u) && +u.slice(5) >= 1 && +u.slice(5) <= 240;
const K = (env) => "s|" + env.ADMIN_PASSWORD;
async function mint(u, env) {
  const m = u + "." + (Date.now() + 30 * 864e5);
  return m + "." + (await hmac(K(env), m));
}
async function auth(req, env) {
  const [u, e, sig] = (req.headers.get("authorization") || "").slice(7).split(".");
  if (!sig || +e < Date.now() || (await hmac(K(env), u + "." + e)) !== sig) return null;
  const admin = u === "admin";
  return { u, admin, mc: !admin && !(await env.LINKS.get("u:" + u)) };
}
const getSite = async (env) => (await env.LINKS.get("site", "json")) || SEED;

function csv(t) {
  const R = []; let r = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { r.push(f); f = ""; }
    else if (c === "\n") { r.push(f); R.push(r); r = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  r.push(f); R.push(r);
  return R;
}
const MON = { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12 };
const DAY = /^(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)\s*,/i;
function sched(rows) {
  const h = rows.findIndex((r) => r.some((c) => c.trim().toUpperCase() === "TANGGAL"));
  if (h < 0) return [];
  const H = rows[h].map((c) => c.trim().toUpperCase());
  const C = { t: H.indexOf("TANGGAL"), j: H.indexOf("JAM"), k: H.indexOf("KULIAH"), r: H.indexOf("RUANGAN"), s: H.indexOf("STATUS"), rs: H.indexOf("RESCHED"), d: H.indexOf("DOSEN/TUTOR"), st: H.indexOf("SL/TUTOR"), rk: H.indexOf("REKAMAN"), ke: H.indexOf("KETERANGAN") };
  const g = (r, i) => (i < 0 ? "" : (r[i] || "").replace(/\u200b/g, "").trim());
  const days = []; let cur = null;
  for (const r of rows.slice(h + 1)) {
    const t = g(r, C.t);
    if (DAY.test(t)) {
      const m = t.match(/(\d+)\s+(\w+)\s+(\d{4})/), mo = m && MON[m[2].toLowerCase()];
      cur = { d: t, iso: m && mo ? `${m[3]}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}` : "", items: [], notes: [] };
      days.push(cur);
    } else if (t && cur) cur.notes.push(t);
    if (!cur) continue;
    const it = { j: g(r, C.j), k: g(r, C.k), r: g(r, C.r), s: g(r, C.s), rs: g(r, C.rs), d: g(r, C.d), st: g(r, C.st), rk: g(r, C.rk), ke: g(r, C.ke) };
    if (it.k || it.s || it.rs || it.d || it.st || it.rk || it.ke) cur.items.push(it);
  }
  return days;
}

function valid(d) {
  const L = (a) => Array.isArray(a) && a.length <= 500 && a.every((x) => x && typeof x.n === "string" && x.n.length <= 200 && (x.u === undefined || (typeof x.u === "string" && x.u.length <= 2000)) && (x.h === undefined || (typeof x.h === "string" && x.h.length <= 100000)));
  return d && L(d.drive) && Array.isArray(d.materi) && d.materi.length <= 60 && d.materi.every((b) => typeof b.n === "string" && L(b.lab) && L(b.all)) &&
    Array.isArray(d.rekaman) && d.rekaman.length <= 20 && d.rekaman.every((t) => typeof t.n === "string" && L(t.kl) && L(t.blok) && L(t.lab)) &&
    d.sheet && /^[\w-]{20,80}$/.test(d.sheet.id) && Array.isArray(d.sheet.tabs) && d.sheet.tabs.length <= 30 && d.sheet.tabs.every((t) => typeof t.n === "string" && /^\d{1,12}$/.test(t.g));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.ADMIN_PASSWORD) return J({ err: "ADMIN_PASSWORD belum diatur" }, 500);
    const path = url.pathname.slice(5), M = request.method;
    let body = {};
    if (M !== "GET") { try { body = await request.json(); } catch { body = {}; } }

    if (path === "login" && M === "POST") {
      const raw = String(body.u || "").trim(), p = String(body.p || "");
      if (raw.toLowerCase() === "admin") {
        if (p !== env.ADMIN_PASSWORD) return J({ err: 1 }, 401);
        return J({ token: await mint("admin", env), u: "admin", admin: true, mc: false });
      }
      const u = raw.toUpperCase();
      if (!isStu(u)) return J({ err: 1 }, 401);
      const rec = await env.LINKS.get("u:" + u, "json");
      const ok = rec ? (await pbk(p, rec.s)) === rec.h : p.trim().toUpperCase() === u;
      if (!ok) return J({ err: 1 }, 401);
      return J({ token: await mint(u, env), u, admin: false, mc: !rec });
    }

    const a = await auth(request, env);
    if (!a) return J({ err: "auth" }, 401);

    if (path === "changepw" && M === "POST") {
      const np = String(body.np || "");
      if (a.admin || np.length < 6 || np.length > 100 || np.toUpperCase() === a.u) return J({ err: "Password minimal 6 karakter dan tidak boleh sama dengan username." }, 400);
      const s = b64(crypto.getRandomValues(new Uint8Array(12)));
      await env.LINKS.put("u:" + a.u, JSON.stringify({ s, h: await pbk(np, s) }));
      return J({ ok: 1 });
    }
    if (a.mc) return J({ mc: true }, 403);

    if (path === "data") {
      if (M === "GET") return J(await getSite(env));
      if (M === "PUT") {
        if (!a.admin) return J({ err: "admin" }, 403);
        if (!valid(body)) return J({ err: "invalid" }, 400);
        await env.LINKS.put("site", JSON.stringify(body));
        return J({ ok: 1 });
      }
    }
    if (path === "reset" && M === "POST") {
      const u = String(body.u || "").trim().toUpperCase();
      if (!a.admin || !isStu(u)) return J({ err: 1 }, 400);
      await env.LINKS.delete("u:" + u);
      return J({ ok: 1 });
    }
    if (path === "schedule" && M === "GET") {
      const g = url.searchParams.get("g") || "0";
      if (!/^\d{1,12}$/.test(g)) return J({ err: 1 }, 400);
      const id = (await getSite(env)).sheet.id;
      const ck = new Request(`https://sched.local/${id}/${g}`), c = typeof caches !== "undefined" ? caches.default : null;
      const hit = c && (await c.match(ck));
      if (hit) return J(await hit.json());
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${g}`);
      if (!r.ok) return J({ err: "Spreadsheet tidak bisa dibaca. Pastikan dibagikan 'siapa saja yang memiliki link'." }, 502);
      const days = sched(csv(await r.text()));
      if (c) await c.put(ck, new Response(JSON.stringify(days), { headers: { "cache-control": "max-age=180" } }));
      return J(days);
    }
    return J({ err: "not found" }, 404);
  },
};
