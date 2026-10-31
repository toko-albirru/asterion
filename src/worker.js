// ASTERION dashboard - Cloudflare Worker (login, data, jadwal)
const SHEET_ID = "1D3ZaMWmvgEmWs1eKBVPs4FYY3y3_KnYUglsJz1qdYEw";
const YT = (n, id) => ({ n, u: "https://www.youtube.com/playlist?list=" + id });
const BLOK = ["1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "3.1", "3.2", "3.3"];

const SEED = {
  v: 2,
  materi: BLOK.slice().reverse().map((b) => ({ n: "Blok " + b, lab: [], all: [] })),
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

SEED.rekaman.reverse(); // Tahun tertinggi dulu

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
const getSite = async (env) => {
  const s = await env.LINKS.get("site", "json");
  if (!s) return SEED;
  if (!s.v) { // migrasi sekali: urutkan blok & tahun dari yang terbaru
    const cmp = (x, y) => y.n.localeCompare(x.n, "en", { numeric: true });
    s.materi.sort(cmp); s.rekaman.sort(cmp); s.v = 2;
    await env.LINKS.put("site", JSON.stringify(s));
  }
  return s;
};

async function cached(key, ttl, fn) {
  const c = typeof caches !== "undefined" ? caches.default : null, ck = new Request("https://cache.local/" + key);
  const hit = c && (await c.match(ck));
  if (hit) return hit.json();
  const v = await fn();
  if (v && c) await c.put(ck, new Response(JSON.stringify(v), { headers: { "cache-control": "max-age=" + ttl } }));
  return v;
}
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "accept-language": "id,en;q=0.8", cookie: "CONSENT=YES+1; SOCS=CAI" };

// ---- daftar tab spreadsheet (urut dari paling kiri) ----
async function sheetTabs(env, id) {
  let tabs = [];
  try {
    if (env.GOOGLE_API_KEY) {
      const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties(sheetId,title,index,hidden)&key=${env.GOOGLE_API_KEY}`);
      if (r.ok) {
        const j = await r.json();
        tabs = (j.sheets || []).map((x) => x.properties).filter((p) => !p.hidden).sort((a, b) => a.index - b.index).map((p) => ({ n: p.title, g: String(p.sheetId) }));
      }
    }
    for (const page of ["htmlview", "pubhtml"]) {
      if (tabs.length) break;
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/${page}`, { headers: UA });
      if (!r.ok) continue;
      const t = await r.text();
      const add = (n, g) => { if (g && !tabs.some((x) => x.g === g)) tabs.push({ n: n.trim(), g }); };
      let m;
      const re1 = /items\.push\(\{([^}]*)\}\)/g; // urutan = urutan tab dari kiri
      while ((m = re1.exec(t))) {
        const nm = m[1].match(/name:\s*"((?:[^"\\]|\\.)*)"/), gd = m[1].match(/gid:\s*"(\d+)"/);
        if (nm && gd) { let n = nm[1]; try { n = JSON.parse('"' + n + '"'); } catch {} add(n, gd[1]); }
      }
      if (!tabs.length) {
        const re2 = /id="sheet-button-(\d+)"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g;
        while ((m = re2.exec(t))) add(m[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'), m[1]);
      }
    }
  } catch {}
  return tabs.length ? tabs : null;
}

// ---- isi playlist YouTube ----
const ytTitle = (x) => (x ? x.simpleText || (x.runs || []).map((r) => r.text).join("") : "");
function ytWalk(o, out) {
  if (!o || typeof o !== "object") return;
  const v = o.playlistVideoRenderer;
  if (v) { if (v.videoId && v.isPlayable !== false) out.v.push({ id: v.videoId, t: ytTitle(v.title), d: ytTitle(v.lengthText) }); return; }
  const c = o.continuationItemRenderer;
  if (c) {
    const e = c.continuationEndpoint, t = e && e.continuationCommand && e.continuationCommand.token;
    if (t) out.c = t;
    return;
  }
  for (const k in o) ytWalk(o[k], out);
}
const INNER_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
async function inner(body, client, dbg) {
  try {
    const r = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&key=" + INNER_KEY, { method: "POST", headers: { ...UA, "content-type": "application/json", origin: "https://www.youtube.com" }, body: JSON.stringify({ context: { client }, ...body }) });
    if (!r.ok) { dbg.push("browse " + client.clientName + ":" + r.status); return null; }
    return await r.json();
  } catch { dbg.push("browse " + client.clientName + ":err"); return null; }
}
async function ytList(id, env, dbg) {
  const out = { v: [], c: "" };
  let partial = false;
  if (env.YT_API_KEY) { // jalur resmi (paling stabil)
    let pt = "";
    for (let i = 0; i < 10; i++) {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${id}&key=${env.YT_API_KEY}` + (pt ? "&pageToken=" + pt : ""));
      if (!r.ok) { dbg.push("ytapi:" + r.status); break; }
      const j = await r.json();
      for (const it of j.items || []) {
        const s = it.snippet;
        if (s && s.resourceId && s.title !== "Private video" && s.title !== "Deleted video") out.v.push({ id: s.resourceId.videoId, t: s.title, d: "" });
      }
      pt = j.nextPageToken;
      if (!pt) break;
    }
    if (out.v.length) return { v: out.v.slice(0, 500) };
  }
  const web = { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: "id", gl: "ID" };
  const and = { clientName: "ANDROID", clientVersion: "19.09.37", androidSdkVersion: 30, hl: "id", gl: "ID" };
  for (const cl of [web, and]) {
    if (out.v.length) break;
    let j = await inner({ browseId: "VL" + id }, cl, dbg);
    for (let i = 0; j && i < 20; i++) {
      out.c = ""; ytWalk(j, out);
      if (!out.c || out.v.length >= 500) break;
      j = await inner({ continuation: out.c }, cl, dbg);
    }
    if (!out.v.length) dbg.push(cl.clientName + ":kosong");
  }
  if (!out.v.length) {
    try {
      const r = await fetch(`https://www.youtube.com/playlist?list=${id}&hl=id`, { headers: UA });
      const t = await r.text(), m = t.match(/var ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
      dbg.push("page:" + r.status + (m ? "" : " tanpa-data"));
      if (m) ytWalk(JSON.parse(m[1]), out);
    } catch { dbg.push("page:err"); }
  }
  if (!out.v.length) { // cadangan: RSS (hanya ~15 video terbaru)
    try {
      const r = await fetch("https://www.youtube.com/feeds/videos.xml?playlist_id=" + id, { headers: UA });
      dbg.push("rss:" + r.status);
      if (r.ok) {
        for (const e of (await r.text()).split("<entry>").slice(1)) {
          const i = e.match(/<yt:videoId>([^<]+)/), t = e.match(/<title>([^<]*)/);
          if (i) out.v.push({ id: i[1], t: (t ? t[1] : "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"), d: "" });
        }
        partial = true;
      }
    } catch { dbg.push("rss:err"); }
  }
  return out.v.length ? { v: out.v.slice(0, 500), partial } : null;
}

// ---- isi folder Google Drive ----
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
async function driveList(id, env, dbg) {
  if (env.DRIVE_API_KEY) { // jalur resmi (opsional)
    try {
      const v = []; let pt = "", name = "";
      const nr = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&supportsAllDrives=true&key=${env.DRIVE_API_KEY}`);
      if (nr.ok) name = (await nr.json()).name || "";
      for (let i = 0; i < 10; i++) {
        const q = encodeURIComponent(`'${id}' in parents and trashed=false`);
        const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,webViewLink)&orderBy=folder,name&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${env.DRIVE_API_KEY}` + (pt ? "&pageToken=" + pt : ""));
        if (!r.ok) { dbg.push("driveapi:" + r.status); break; }
        const j = await r.json();
        for (const f of j.files || []) {
          const fo = f.mimeType === "application/vnd.google-apps.folder";
          v.push({ n: f.name, f: fo, id: f.id, u: fo ? "https://drive.google.com/drive/folders/" + f.id : f.webViewLink || "https://drive.google.com/file/d/" + f.id + "/view" });
        }
        pt = j.nextPageToken;
        if (!pt) break;
      }
      if (v.length || name) return { t: name, v };
    } catch { dbg.push("driveapi:err"); }
  }
  try {
    const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, { headers: UA });
    if (!r.ok) { dbg.push("embed:" + r.status); return null; }
    const t = await r.text(), tt = (t.match(/<title>([^<]*)<\/title>/) || [])[1] || "", v = [];
    for (const p of t.split('<div class="flip-entry"').slice(1)) {
      const h = p.match(/<a href="([^"]+)"/), n = p.match(/class="flip-entry-title">([^<]*)</) || p.match(/aria-label="([^"]*)"/);
      if (!h || !n) continue;
      const u = dec(h[1]);
      if (!/^https:\/\/(drive|docs)\.google\.com\//.test(u)) continue;
      const fm = u.match(/\/folders\/([\w-]+)/);
      v.push({ n: dec(n[1]).trim(), f: !!fm, id: fm ? fm[1] : "", u });
    }
    if (!v.length && !/flip-/.test(t)) { dbg.push("embed:tanpa-daftar"); return null; }
    v.sort((a, b) => (b.f ? 1 : 0) - (a.f ? 1 : 0));
    return { t: /^google drive$/i.test(tt.trim()) ? "" : dec(tt).trim(), v };
  } catch { dbg.push("embed:err"); return null; }
}
async function shortFolder(u) {
  let cur = u;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(cur, { redirect: "manual", headers: UA }), l = r.headers.get("location");
    if (!l) break;
    cur = new URL(l, cur).href;
    const m = cur.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)/);
    if (m) return { id: m[1] };
  }
  return null;
}

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
  // tanggal terbaru di paling atas (yang tanpa tanggal valid di paling bawah)
  return days.map((d, i) => [d, i]).sort((a, b) => (a[0].iso < b[0].iso ? 1 : a[0].iso > b[0].iso ? -1 : a[1] - b[1])).map((x) => x[0]);
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
    if (path === "tabs" && M === "GET") {
      const site = await getSite(env);
      const t = await cached("tabs/" + site.sheet.id, 30, () => sheetTabs(env, site.sheet.id));
      return J({ tabs: t || site.sheet.tabs, auto: !!t });
    }
    if (path === "playlist" && M === "GET") {
      const id = url.searchParams.get("id") || "", dbg = [];
      if (!/^[\w-]{10,80}$/.test(id)) return J({ err: 1 }, 400);
      const r = await cached("yt/" + id, 600, () => ytList(id, env, dbg));
      return r ? J(r) : J({ err: "Daftar video tidak bisa dimuat.", dbg: a.admin ? dbg.join("; ") : undefined }, 502);
    }
    if (path === "folder" && M === "GET") {
      let id = url.searchParams.get("id") || "";
      const u = url.searchParams.get("u") || "", dbg = [];
      if (!id && /^https:\/\/uns\.id\/[\w-]+$/.test(u)) {
        const s = await cached("short/" + encodeURIComponent(u), 3600, () => shortFolder(u));
        id = s ? s.id : "";
      }
      if (!/^[\w-]{10,80}$/.test(id)) return J({ err: "Bukan folder Google Drive.", dbg: a.admin ? "tautan tidak dikenali" : undefined }, 400);
      const r = await cached("fd/" + id, 20, () => driveList(id, env, dbg));
      return r ? J(r) : J({ err: "Isi folder tidak bisa dimuat.", dbg: a.admin ? dbg.join("; ") : undefined }, 502);
    }
    if (path === "schedule" && M === "GET") {
      const g = url.searchParams.get("g") || "0";
      if (!/^\d{1,12}$/.test(g)) return J({ err: 1 }, 400);
      const id = (await getSite(env)).sheet.id;
      const days = await cached(`sched/${id}/${g}`, 15, async () => {
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${g}`, { headers: { "cache-control": "no-cache" } });
        return r.ok ? sched(csv(await r.text())) : null;
      });
      if (!days) return J({ err: "Spreadsheet tidak bisa dibaca. Pastikan dibagikan 'siapa saja yang memiliki link'." }, 502);
      return J(days);
    }
    return J({ err: "not found" }, 404);
  },
};
