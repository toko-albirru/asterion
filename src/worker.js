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
const GRP_EXC = { G0025182: "A" }; // pengecualian: username -> kelompok
const grp = (u) => (/^G0025\d{3}$/.test(u) ? GRP_EXC[u] || (+u.slice(5) % 2 ? "A" : "B") : null);
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
// catat kapan mahasiswa membuka web: a:NIM (metadata f = pertama, l = terakhir). Tulis paling sering 1x/12 jam agar hemat kuota KV.
async function seen(env, u, force) {
  if (u === "admin") return;
  try {
    const k = "a:" + u, now = Date.now(), { metadata: m } = await env.LINKS.getWithMetadata(k);
    if (m && !force && now - m.l < 432e5) return;
    await env.LINKS.put(k, "1", { metadata: { f: (m && m.f) || now, l: now } });
  } catch {}
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
function ytDur(o, n = 0) {
  if (!o || typeof o !== "object" || n > 10) return "";
  if (typeof o.text === "string" && /^\d+(:\d\d)+$/.test(o.text)) return o.text;
  for (const k in o) { const r = ytDur(o[k], n + 1); if (r) return r; }
  return "";
}
function ytWalk(o, out) {
  if (!o || typeof o !== "object") return;
  const add = (id, t, d) => { if (typeof id === "string" && /^[\w-]{11}$/.test(id) && !out.s.has(id)) { out.s.add(id); out.v.push({ id, t: t || "", d: d || "" }); } };
  const v = o.playlistVideoRenderer;
  if (v) { if (v.isPlayable !== false) add(v.videoId, ytTitle(v.title), ytTitle(v.lengthText)); return; }
  const l = o.lockupViewModel; // format baru YouTube
  if (l && typeof l.contentId === "string" && /VIDEO/.test(l.contentType || "")) {
    const md = l.metadata && l.metadata.lockupMetadataViewModel;
    add(l.contentId, md && md.title && (md.title.content || ytTitle(md.title)), ytDur(l.contentImage));
    return;
  }
  if (out.loose) {
    const r = o.videoRenderer || o.gridVideoRenderer || o.compactVideoRenderer || o.playlistPanelVideoRenderer;
    if (r) { add(r.videoId, ytTitle(r.title), ytTitle(r.lengthText)); return; }
  }
  const c = o.continuationItemRenderer;
  if (c) {
    const e = c.continuationEndpoint, t = e && e.continuationCommand && e.continuationCommand.token;
    if (t) out.c = t;
    return;
  }
  for (const k in o) ytWalk(o[k], out);
}
function ytInfo(j) { // ringkasan isi respons untuk diagnosis
  const ks = new Set(); let al = "";
  (function f(o, n) {
    if (!o || typeof o !== "object" || n > 40) return;
    for (const k in o) {
      if (/(Renderer|ViewModel)$/.test(k) && ks.size < 10) ks.add(k);
      if (!al && (k === "alertRenderer" || k === "alertWithButtonRenderer")) al = ytTitle(o[k].text);
      f(o[k], n + 1);
    }
  })(j, 0);
  return ((al ? "alert=" + al + " " : "") + [...ks].join(",")).slice(0, 300);
}
function ytAll(j, out) { // jalankan walk; kalau kosong coba mode longgar
  ytWalk(j, out);
  if (!out.v.length) { out.loose = true; ytWalk(j, out); out.loose = false; }
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
  const out = { v: [], c: "", s: new Set() };
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
  const web = { clientName: "WEB", clientVersion: "2.20250925.01.00", hl: "id", gl: "ID" };
  const mweb = { clientName: "MWEB", clientVersion: "2.20250925.01.00", hl: "id", gl: "ID" };
  for (const cl of [web, mweb]) {
    if (out.v.length) break;
    let j = await inner({ browseId: "VL" + id }, cl, dbg);
    const first = j;
    for (let i = 0; j && i < 20; i++) {
      out.c = ""; ytAll(j, out);
      if (!out.c || out.v.length >= 500) break;
      j = await inner({ continuation: out.c }, cl, dbg);
    }
    if (!out.v.length && first) dbg.push(cl.clientName + ":kosong [" + ytInfo(first) + "]");
  }
  if (!out.v.length) {
    try {
      const r = await fetch(`https://www.youtube.com/playlist?list=${id}&hl=id`, { headers: UA });
      const t = await r.text(), m = t.match(/var ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
      dbg.push("page:" + r.status + (m ? "" : " tanpa-data"));
      if (m) { const d = JSON.parse(m[1]); ytAll(d, out); if (!out.v.length) dbg.push("page:kosong [" + ytInfo(d) + "]"); }
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
const MON3 = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, jun: 6, jul: 7, agu: 8, ags: 8, sep: 9, okt: 10, nov: 11, des: 12 };
// "Selasa, 10 November 2026" | "Selasa 10, November 2026" | "Kamis. 12 November 2026" | "Jum'at,13 Nov 2026"
function parseTgl(t) {
  t = String(t || "").trim();
  const m = t.match(/^(senin|selasa|rabu|kamis|jum['’`]?at|sabtu|minggu|ahad)\b[\s,.:;\-–]*(\d{1,2})[\s,.\-/]*([a-z]+)\.?[\s,.\-/]*(\d{4})/i);
  if (m) { const k = m[3].toLowerCase(), mo = MON[k] || MON3[k.slice(0, 3)]; return { iso: mo ? `${m[4]}-${String(mo).padStart(2, "0")}-${m[2].padStart(2, "0")}` : "" }; }
  return /^(senin|selasa|rabu|kamis|jum['’`]?at|sabtu|minggu|ahad)\b[\s,.:;\-–]*\d/i.test(t) ? { iso: "" } : null;
}
// perbaikan gelar (hanya yang terverifikasi sumber resmi/publikasi terbaru)
function fixName(s) {
  if (!s) return s;
  s = s.replace(/\bDr\s+(?=[A-Z])/g, "Dr. ");
  s = s.replace(/(^|[\n;/]\s*)(?:Dr\.?\s+)?(?:dr\.\s+)?Budiyanti Wiboworini,?\s*(?:dr\.?,?\s*)?M\.?\s?Kes\.?,?\s*Sp\.?\s?GK\.?/gi, "$1Dr. Budiyanti Wiboworini, dr., M.Kes., Sp.GK");
  return s;
}
function sched(rows) {
  const h = rows.findIndex((r) => r.some((c) => c.trim().toUpperCase() === "TANGGAL"));
  if (h < 0) return [];
  const H = rows[h].map((c) => c.trim().toUpperCase());
  const C = { t: H.indexOf("TANGGAL"), j: H.indexOf("JAM"), k: H.indexOf("KULIAH"), r: H.indexOf("RUANGAN"), s: H.indexOf("STATUS"), rs: H.indexOf("RESCHED"), d: H.indexOf("DOSEN/TUTOR"), st: H.indexOf("SL/TUTOR"), rk: H.indexOf("REKAMAN"), ke: H.indexOf("KETERANGAN") };
  const g = (r, i) => (i < 0 ? "" : (r[i] || "").replace(/\u200b/g, "").trim());
  const days = []; let cur = null;
  for (const r of rows.slice(h + 1)) {
    const t = g(r, C.t);
    const pd = parseTgl(t);
    if (pd) {
      cur = { d: t.replace(/\s+/g, " "), iso: pd.iso, items: [], notes: [] };
      days.push(cur);
    } else if (t && cur) cur.notes.push(t);
    if (!cur) continue;
    const it = { j: g(r, C.j), k: g(r, C.k), r: g(r, C.r), s: g(r, C.s), rs: g(r, C.rs), d: fixName(g(r, C.d)), st: fixName(g(r, C.st)), rk: g(r, C.rk), ke: g(r, C.ke) };
    if (it.k || it.s || it.rs || it.d || it.st || it.rk || it.ke) cur.items.push(it);
  }
  // tanggal terbaru di paling atas (yang tanpa tanggal valid di paling bawah)
  return days.map((d, i) => [d, i]).sort((a, b) => (a[0].iso < b[0].iso ? 1 : a[0].iso > b[0].iso ? -1 : a[1] - b[1])).map((x) => x[0]);
}

async function getSched(id, g) {
  return cached(`sched/${id}/${g}`, 15, async () => {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${g}`, { headers: { "cache-control": "no-cache" } });
    return r.ok ? sched(csv(await r.text())) : null;
  });
}
const jktToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
// tanggal terakhir yang punya kegiatan di sebuah tab (akhir blok, mis. Ujian Blok)
async function blockEnd(id, g) {
  try { const d = await getSched(id, g); return d ? d.filter((x) => x.iso && x.items.length).reduce((m, x) => (x.iso > m ? x.iso : m), "") : ""; } catch { return ""; }
}

function uiOk(u) {
  if (u === undefined) return true;
  if (!u || typeof u !== "object" || Array.isArray(u)) return false;
  return ["nav", "menu", "mp", "cm", "cr"].every((g) => u[g] === undefined || (Array.isArray(u[g]) && u[g].length <= 20 && u[g].every((x) => x && typeof x.id === "string" && x.id.length <= 20 && (x.n === undefined || (typeof x.n === "string" && x.n.length <= 60)) && (x.i === undefined || (typeof x.i === "string" && x.i.length <= 16)) && (x.s === undefined || (typeof x.s === "string" && x.s.length <= 200)) && (x.c === undefined || (typeof x.c === "string" && x.c.length <= 100)) && (x.h === undefined || typeof x.h === "boolean"))));
}

function valid(d) {
  const L = (a) => Array.isArray(a) && a.length <= 500 && a.every((x) => x && typeof x.n === "string" && x.n.length <= 200 && (x.u === undefined || (typeof x.u === "string" && x.u.length <= 2000)) && (x.h === undefined || (typeof x.h === "string" && x.h.length <= 100000)) && (x.hid === undefined || (typeof x.hid === "string" && /^[\w-]{6,40}$/.test(x.hid))));
  return d && uiOk(d.ui) && L(d.drive) && Array.isArray(d.materi) && d.materi.length <= 60 && d.materi.every((b) => typeof b.n === "string" && L(b.lab) && L(b.all)) &&
    Array.isArray(d.rekaman) && d.rekaman.length <= 20 && d.rekaman.every((t) => typeof t.n === "string" && L(t.kl) && L(t.blok) && L(t.lab)) &&
    d.sheet && /^[\w-]{20,80}$/.test(d.sheet.id) && Array.isArray(d.sheet.tabs) && d.sheet.tabs.length <= 30 && d.sheet.tabs.every((t) => typeof t.n === "string" && /^\d{1,12}$/.test(t.g));
}

// ===== ASTERION RUN (mulai) =====================================================
// API game edukasi 3D. Memakai Cloudflare D1 (binding: DB). Bila DB belum terpasang, hanya /api/run/* yang
// menjawab 503 — seluruh fitur lama tetap berjalan. Skema: migrations/0001_asterion_run.sql (dibuat otomatis
// bila belum ada, aman dijalankan berulang).
const RUN_DDL = [
  "CREATE TABLE IF NOT EXISTS run_cats ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, descr TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, per_session INTEGER NOT NULL DEFAULT 20, q_time INTEGER NOT NULL DEFAULT 60, show_explain INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL )",
  "CREATE TABLE IF NOT EXISTS run_questions ( id INTEGER PRIMARY KEY AUTOINCREMENT, cat_id INTEGER NOT NULL, num INTEGER, q TEXT NOT NULL, a TEXT NOT NULL DEFAULT '', b TEXT NOT NULL DEFAULT '', c TEXT NOT NULL DEFAULT '', d TEXT NOT NULL DEFAULT '', e TEXT NOT NULL DEFAULT '', ans TEXT NOT NULL, expl TEXT NOT NULL DEFAULT '', diff INTEGER NOT NULL DEFAULT 2, img TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, verified INTEGER NOT NULL DEFAULT 0, src TEXT NOT NULL DEFAULT '', hash TEXT NOT NULL, imported INTEGER NOT NULL, updated INTEGER NOT NULL, UNIQUE (cat_id, hash) )",
  "CREATE INDEX IF NOT EXISTS ix_rq_cat ON run_questions (cat_id, active, verified)",
  "CREATE TABLE IF NOT EXISTS run_sessions ( id TEXT PRIMARY KEY, u TEXT NOT NULL, cat_id INTEGER NOT NULL, cat_name TEXT NOT NULL, status TEXT NOT NULL, total INTEGER NOT NULL, requested INTEGER NOT NULL DEFAULT 0, q_time INTEGER NOT NULL, show_explain INTEGER NOT NULL DEFAULT 1, cur INTEGER NOT NULL DEFAULT 0, qstart INTEGER, paused_at INTEGER, pause_used INTEGER NOT NULL DEFAULT 0, started INTEGER NOT NULL, began INTEGER, fin INTEGER, score INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0, wrong INTEGER NOT NULL DEFAULT 0, blank INTEGER NOT NULL DEFAULT 0, acc REAL NOT NULL DEFAULT 0, dur INTEGER NOT NULL DEFAULT 0, rank INTEGER )",
  "CREATE INDEX IF NOT EXISTS ix_rs_user ON run_sessions (u, status)",
  "CREATE INDEX IF NOT EXISTS ix_rs_cat ON run_sessions (cat_id, status, fin)",
  "CREATE TABLE IF NOT EXISTS run_answers ( sid TEXT NOT NULL, idx INTEGER NOT NULL, qid INTEGER, snap TEXT NOT NULL, chosen TEXT, correct INTEGER NOT NULL DEFAULT 0, ms INTEGER, answered INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (sid, idx) )",
  "CREATE TABLE IF NOT EXISTS run_images ( id TEXT PRIMARY KEY, mime TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL )",
  "CREATE TABLE IF NOT EXISTS run_settings ( k TEXT PRIMARY KEY, v TEXT NOT NULL )",
  "CREATE TABLE IF NOT EXISTS run_audit ( id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, u TEXT NOT NULL, act TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '' )",
  // nama samaran leaderboard (satu per akun; nick_key = bentuk huruf kecil tanpa spasi untuk cek kembar)
  "CREATE TABLE IF NOT EXISTS run_players ( u TEXT PRIMARY KEY, nick TEXT NOT NULL, nick_key TEXT NOT NULL UNIQUE, updated INTEGER NOT NULL )",
  // status online: waktu ping terakhir tiap mahasiswa (ditulis klien tiap ±90 detik saat tab terlihat)
  "CREATE TABLE IF NOT EXISTS run_presence ( u TEXT PRIMARY KEY, t INTEGER NOT NULL )",
  // preferensi pribadi tiap mahasiswa: jumlah soal per sesi (0 = ikut kategori) & tema tampilan ('' = ikut perangkat)
  "CREATE TABLE IF NOT EXISTS run_prefs ( u TEXT PRIMARY KEY, per_session INTEGER NOT NULL DEFAULT 0, theme TEXT NOT NULL DEFAULT '', updated INTEGER NOT NULL )",
  // soal yang sudah pernah keluar untuk seorang mahasiswa → dipakai agar soal tidak berulang sampai bank kategori habis
  "CREATE TABLE IF NOT EXISTS run_seen ( u TEXT NOT NULL, cat_id INTEGER NOT NULL, qid INTEGER NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (u, cat_id, qid) )"
];
let runReady = false;
async function runDb(env) {
  if (!env.DB) return null;
  if (!runReady) {
    await env.DB.batch(RUN_DDL.map((s) => env.DB.prepare(s)));
    const cols = (await env.DB.prepare("PRAGMA table_info(run_sessions)").all()).results || [];
    if (!cols.some((c) => c.name === "mode")) await env.DB.prepare("ALTER TABLE run_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'game'").run(); // game | quiz | exam
    if (!cols.some((c) => c.name === "coins")) await env.DB.prepare("ALTER TABLE run_sessions ADD COLUMN coins INTEGER NOT NULL DEFAULT 0").run(); // koin terkumpul (leaderboard koin terpisah dari skor)
    const acols = (await env.DB.prepare("PRAGMA table_info(run_answers)").all()).results || [];
    if (!acols.some((c) => c.name === "flag")) await env.DB.prepare("ALTER TABLE run_answers ADD COLUMN flag INTEGER NOT NULL DEFAULT 0").run(); // tanda ragu (mode ujian)
    const qcols = (await env.DB.prepare("PRAGMA table_info(run_questions)").all()).results || [];
    if (!qcols.some((c) => c.name === "expl_opt")) await env.DB.prepare("ALTER TABLE run_questions ADD COLUMN expl_opt TEXT NOT NULL DEFAULT ''").run(); // pembahasan per pilihan (JSON A–E)
    runReady = true;
  }
  return env.DB;
}
const RUN_L = ["A", "B", "C", "D", "E"];
const RUN_GRACE = 3000;      // toleransi jaringan setelah waktu soal habis (ms)
const RUN_EARLY = 2000;      // "kosong/waktu habis" boleh dikirim paling cepat q_time - 2 dtk
const RUN_PAUSE_MAX = 300000; // satu jeda maksimal 5 menit; selebihnya waktu berjalan lagi
const RUN_SET = { sound: 1, fx: 1, gfx: "high", explain: 1, pause: 1 };
const clip = (v, n) => String(v == null ? "" : v).replace(/\u0000/g, "").trim().slice(0, n);
const b01 = (v) => (v === true || v === 1 || v === "1" || v === "true" ? 1 : 0);
const rnd = (n) => { const x = new Uint32Array(1); crypto.getRandomValues(x); return x[0] % n; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sha = async (s) => b64(await crypto.subtle.digest("SHA-256", enc.encode(s))).slice(0, 32);
const runErr = (m, s = 400, x = {}) => J({ err: m, ...x }, s);

async function runSettings(db) {
  const o = { ...RUN_SET };
  try { for (const r of (await db.prepare("SELECT k, v FROM run_settings").all()).results) if (r.k in RUN_SET) { try { o[r.k] = JSON.parse(r.v); } catch {} } } catch {}
  return o;
}
const runAudit = (db, u, act, detail) => db.prepare("INSERT INTO run_audit (t, u, act, detail) VALUES (?, ?, ?, ?)").bind(Date.now(), u, act, clip(detail, 500)).run();
function runSince(p) { // minggu (mulai Senin) / bulan berjalan, zona WIB
  if (p !== "week" && p !== "month") return 0;
  const W = 7 * 36e5, d = new Date(Date.now() + W);
  const start = p === "week" ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)) : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return start - W;
}
async function runBoard(db, cat, since) { // skor terbaik tiap mahasiswa; seri → akurasi → durasi tercepat
  const r = await db.prepare("SELECT u, score, total, acc, dur FROM (SELECT u, score, total, acc, dur, ROW_NUMBER() OVER (PARTITION BY u ORDER BY score DESC, acc DESC, dur ASC) rn FROM run_sessions WHERE cat_id = ? AND status = 'done' AND u <> 'admin' AND fin >= ?) WHERE rn = 1 ORDER BY score DESC, acc DESC, dur ASC").bind(cat, since).all();
  return r.results.map((x, i) => ({ ...x, rank: i + 1 }));
}
async function runGlobal(db, since) { // rata-rata akurasi terbaik per kategori (adil untuk jumlah soal berbeda)
  const best = (await db.prepare("SELECT u, cat_id, acc, dur FROM (SELECT u, cat_id, acc, dur, ROW_NUMBER() OVER (PARTITION BY u, cat_id ORDER BY acc DESC, dur ASC) rn FROM run_sessions WHERE status = 'done' AND u <> 'admin' AND fin >= ? AND cat_id IN (SELECT id FROM run_cats)) WHERE rn = 1").bind(since).all()).results;
  const games = (await db.prepare("SELECT u, COUNT(*) n FROM run_sessions WHERE status = 'done' AND u <> 'admin' AND fin >= ? AND cat_id IN (SELECT id FROM run_cats) GROUP BY u").bind(since).all()).results;
  const gm = new Map(games.map((x) => [x.u, x.n])), by = new Map();
  for (const x of best) { const o = by.get(x.u) || { u: x.u, sum: 0, cats: 0, dur: 0 }; o.sum += x.acc; o.cats++; o.dur += x.dur; by.set(x.u, o); }
  return [...by.values()].map((o) => ({ u: o.u, acc: o.sum / o.cats, cats: o.cats, games: gm.get(o.u) || 0, dur: o.dur }))
    .sort((a, b) => b.acc - a.acc || a.dur - b.dur || (a.u < b.u ? -1 : 1)).map((x, i) => ({ ...x, rank: i + 1 }));
}
// ---- nama samaran ----
const RUN_NICK_BAN = ["admin", "administrator", "asterion", "moderator", "panitia"];
function runNickCheck(v) {
  const nick = String(v == null ? "" : v).normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff<>]/g, "").replace(/\s+/g, " ").trim();
  const n = [...nick].length;
  if (n < 2 || n > 20) return { err: "Nama harus 2–20 karakter." };
  const key = nick.toLowerCase().replace(/[\s._-]+/g, "");
  if (!key || RUN_NICK_BAN.includes(key) || /^g0025\d{3}$/.test(key)) return { err: "Nama ini tidak dapat dipakai. Pilih nama lain." };
  return { nick, key };
}
async function runNicks(db) { const m = new Map(); for (const r of (await db.prepare("SELECT u, nick FROM run_players").all()).results) m.set(r.u, r.nick); return m; }
// pemain yang belum punya nama samaran tampil sebagai Anonim-XXXX (stabil, tidak bisa ditelusuri ke NIM)
const runAnon = async (env, u) => "Anonim-" + (await hmac(K(env), "anon|" + u)).replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
async function runSetNick(db, u, v, t) { // → { nick } | { err, s }
  const c = runNickCheck(v);
  if (c.err) return { err: c.err, s: 400 };
  const dup = await db.prepare("SELECT u FROM run_players WHERE nick_key = ? AND u <> ?").bind(c.key, u).first();
  if (dup) return { err: "Nama “" + c.nick + "” sudah dipakai pemain lain. Coba nama lain.", s: 409 };
  try { await db.prepare("INSERT INTO run_players (u, nick, nick_key, updated) VALUES (?, ?, ?, ?) ON CONFLICT(u) DO UPDATE SET nick = excluded.nick, nick_key = excluded.nick_key, updated = excluded.updated").bind(u, c.nick, c.key, t).run(); }
  catch { return { err: "Nama “" + c.nick + "” sudah dipakai pemain lain. Coba nama lain.", s: 409 }; }
  return { nick: c.nick };
}
const runGet = (db, sid) => db.prepare("SELECT * FROM run_sessions WHERE id = ?").bind(String(sid || "")).first();

async function runView(db, s, extra) { // keadaan sesi untuk klien — TANPA kunci & pembahasan
  const rows = (await db.prepare("SELECT idx, snap FROM run_answers WHERE sid = ? ORDER BY idx").bind(s.id).all()).results;
  const qs = rows.map((r) => { const q = JSON.parse(r.snap); return { idx: r.idx, q: q.q, o: { A: q.a, B: q.b, C: q.c, D: q.d, E: q.e }, img: q.img || "" }; });
  const t = Date.now();
  return { sid: s.id, status: s.status, mode: s.mode || "game", total: s.total, requested: s.requested, adjusted: s.requested > 0 && s.total < s.requested, q_time: s.q_time, cur: s.cur, score: s.score, coins: s.coins || 0,
    remaining: s.status === "active" ? Math.max(0, s.q_time * 1000 - ((s.paused_at || t) - s.qstart)) : null, paused: !!s.paused_at, qs, ...extra };
}
// preferensi pribadi mahasiswa: jumlah soal per sesi (0 = ikut kategori) & tema tampilan ('' = ikut perangkat)
async function runPref(db, u) {
  const r = await db.prepare("SELECT per_session, theme FROM run_prefs WHERE u = ?").bind(u).first();
  return { per_session: r && r.per_session > 0 ? r.per_session : 0, theme: (r && r.theme) || "" };
}
// mode simulasi ujian: tanpa kunci/pembahasan sampai dikumpulkan; jawaban & tanda ragu ikut, satu waktu untuk semua soal
async function runExamView(db, s) {
  const rows = (await db.prepare("SELECT idx, snap, chosen, flag FROM run_answers WHERE sid = ? ORDER BY idx").bind(s.id).all()).results;
  const qs = rows.map((r) => { const q = JSON.parse(r.snap); return { idx: r.idx, q: q.q, o: { A: q.a, B: q.b, C: q.c, D: q.d, E: q.e }, img: q.img || "", num: q.num || null, chosen: r.chosen || "", flag: !!r.flag }; });
  const t = Date.now(), limit = s.q_time * 1000 * s.total, started = s.began || s.qstart || t;
  return { sid: s.id, status: s.status, mode: "exam", total: s.total, requested: s.requested, adjusted: s.requested > 0 && s.total < s.requested, q_time: s.q_time, limit, cur: s.cur, score: 0,
    remaining: s.status === "active" ? Math.max(0, limit - (t - started)) : null, answered: qs.filter((x) => x.chosen).length, flagged: qs.filter((x) => x.flag).length, qs };
}
// kumpulkan ujian: nilai semua jawaban sekaligus lalu tutup sesi
async function runExamSubmit(db, s, t) {
  const rows = (await db.prepare("SELECT idx, snap, chosen FROM run_answers WHERE sid = ?").bind(s.id).all()).results;
  const upd = rows.map((r) => { const q = JSON.parse(r.snap), ok = !!r.chosen && q.ans === r.chosen; return db.prepare("UPDATE run_answers SET correct = ?, answered = 1, ms = 0 WHERE sid = ? AND idx = ?").bind(ok ? 1 : 0, s.id, r.idx); });
  for (let i = 0; i < upd.length; i += 40) await db.batch(upd.slice(i, i + 40));
  await runFinish(db, await runGet(db, s.id), t);
  return await runGet(db, s.id);
}
async function runFinish(db, s, t) {
  const rows = (await db.prepare("SELECT chosen, correct FROM run_answers WHERE sid = ?").bind(s.id).all()).results;
  const correct = rows.filter((r) => r.correct).length, blank = rows.filter((r) => r.chosen == null).length, wrong = rows.length - correct - blank;
  const acc = s.total ? (correct / s.total) * 100 : 0, dur = Math.max(0, t - (s.began || s.started));
  await db.prepare("UPDATE run_sessions SET status = 'done', fin = ?, score = ?, correct = ?, wrong = ?, blank = ?, acc = ?, dur = ?, cur = total, qstart = NULL, paused_at = NULL WHERE id = ?").bind(t, correct, correct, wrong, blank, acc, dur, s.id).run();
  if (s.u !== "admin") {
    const i = (await runBoard(db, s.cat_id, 0)).findIndex((x) => x.u === s.u);
    if (i >= 0) await db.prepare("UPDATE run_sessions SET rank = ? WHERE id = ?").bind(i + 1, s.id).run();
  }
}
// catat jawaban soal berjalan. Satu soal hanya bisa dijawab sekali (answered=0 → 1 diklaim secara atomik).
async function runRecord(db, s, ans, t, expired) {
  const row = await db.prepare("SELECT snap FROM run_answers WHERE sid = ? AND idx = ? AND answered = 0").bind(s.id, s.cur).first();
  if (!row) return null;
  const q = JSON.parse(row.snap), blank = !!expired || !ans;
  const correct = !blank && q.ans === ans && !!q[ans.toLowerCase()];
  const ms = Math.min(Math.max(0, t - s.qstart), s.q_time * 1000);
  const u = await db.prepare("UPDATE run_answers SET chosen = ?, correct = ?, ms = ?, answered = 1 WHERE sid = ? AND idx = ? AND answered = 0").bind(blank ? null : ans, correct ? 1 : 0, ms, s.id, s.cur).run();
  if (!u.meta.changes) return null;
  if (s.cur + 1 >= s.total) await runFinish(db, s, t);
  else if ((s.mode || "game") === "quiz") // mode soal: timer soal berikutnya baru jalan setelah pemain menekan "Lanjut" (resume), supaya sempat membaca kunci & pembahasan
    await db.prepare("UPDATE run_sessions SET cur = cur + 1, qstart = ?, paused_at = ?, score = score + ? WHERE id = ? AND cur = ?").bind(t, t, correct ? 1 : 0, s.id, s.cur).run();
  else await db.prepare("UPDATE run_sessions SET cur = cur + 1, qstart = ?, score = score + ? WHERE id = ? AND cur = ?").bind(t, correct ? 1 : 0, s.id, s.cur).run();
  return { correct, blank, expired: !!expired, ans: q.ans, expl: q.expl || "" };
}
// jeda yang terlalu lama berakhir sendiri (waktu soal berjalan lagi)
async function runUnpause(db, s) {
  if (s.status === "active" && s.paused_at && Date.now() - s.paused_at > RUN_PAUSE_MAX) {
    await db.prepare("UPDATE run_sessions SET qstart = qstart + ?, began = began + ?, paused_at = NULL WHERE id = ? AND paused_at = ?").bind(RUN_PAUSE_MAX, RUN_PAUSE_MAX, s.id, s.paused_at).run();
    return await runGet(db, s.id);
  }
  return s;
}
// sinkronkan sesi (saat dilanjutkan / dibuka ulang): soal yang waktunya lewat dicatat kosong, soal berikut mulai segar.
async function runSync(db, s) {
  s = await runUnpause(db, s);
  if (s.status !== "active" || s.paused_at || !s.qstart) return s;
  const t = Date.now();
  if (t - s.qstart > s.q_time * 1000 + RUN_GRACE) { await runRecord(db, s, null, t, true); return await runGet(db, s.id); }
  return s;
}
const RUN_MAXIMG = 6;
// `img` menyimpan satu atau beberapa ID gambar dipisah koma (soal lama dengan satu ID tetap valid)
function runImgs(v) {
  const a = Array.isArray(v) ? v : String(v == null ? "" : v).split(",");
  return [...new Set(a.map((x) => String(x).trim()).filter((x) => /^[\w-]{6,40}$/.test(x)))].slice(0, RUN_MAXIMG);
}
async function runImgMissing(db, ids) { // ID gambar yang belum ada di run_images
  const miss = new Set(ids);
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    for (const r of (await db.prepare("SELECT id FROM run_images WHERE id IN (" + part.map(() => "?").join(",") + ")").bind(...part).all()).results) miss.delete(r.id);
  }
  return [...miss];
}
function runQ(b, i) { // validasi satu soal (impor / edit)
  const o = { q: clip(b.q, 4000), expl: clip(b.expl, 8000), ans: String(b.ans || "").toUpperCase(), diff: Math.min(3, Math.max(1, parseInt(b.diff, 10) || 2)), num: parseInt(b.num, 10) || null, img: runImgs(b.img).join(",") };
  for (const L of RUN_L) o[L.toLowerCase()] = clip(b[L.toLowerCase()], 1000);
  if (!o.q) return { err: "Pertanyaan kosong" };
  if (!RUN_L.includes(o.ans)) return { err: "Kunci jawaban belum ditentukan" };
  if (!o[o.ans.toLowerCase()]) return { err: "Pilihan " + o.ans + " (kunci) kosong" };
  if (RUN_L.filter((L) => o[L.toLowerCase()]).length < 2) return { err: "Minimal dua pilihan jawaban" };
  // pembahasan per pilihan jawaban: objek {A,B,C,D,E} atau array; boleh hanya sebagian pilihan
  const ex = {}, src = Array.isArray(b.ex) ? b.ex : (b.ex && typeof b.ex === "object" ? RUN_L.map((L) => b.ex[L]) : RUN_L.map((L) => b["x" + L.toLowerCase()]));
  RUN_L.forEach((L, k) => { const v = clip(src[k], 2000); if (v) ex[L] = v; });
  o.ex = Object.keys(ex).length ? JSON.stringify(ex) : "";
  return { o };
}
const runHash = (o) => sha([o.q, o.a, o.b, o.c, o.d, o.e].join("␟").toLowerCase().replace(/\s+/g, " "));
const RUN_QCOLS = "id, num, q, a, b, c, d, e, ans, expl, expl_opt, diff, img, active, verified, src";

async function runApi(request, env, a, path, url, body, M) {
  const db = await runDb(env).catch(() => null);
  if (!db) return runErr(env.DB ? "Database GAME KUIS belum siap." : "D1 belum terpasang. Ikuti PANDUAN.md (buat database & pasang binding DB).", 503);
  const t = Date.now(), qp = (k) => url.searchParams.get(k) || "";

  // ---------- pengaturan & kategori ----------
  if (path === "settings" && M === "GET") return J(await runSettings(db));
  if (path === "cats" && M === "GET") {
    const set = await runSettings(db);
    const cats = (await db.prepare("SELECT c.*, (SELECT COUNT(*) FROM run_questions q WHERE q.cat_id = c.id AND q.active = 1 AND q.verified = 1) AS aq, (SELECT COUNT(DISTINCT u) FROM run_sessions s WHERE s.cat_id = c.id AND s.status = 'done' AND s.u <> 'admin') AS players FROM run_cats c " + (a.admin ? "" : "WHERE c.active = 1 ") + "ORDER BY c.sort, c.id").all()).results;
    const mine = (await db.prepare("SELECT cat_id, cur, total, mode FROM run_sessions WHERE u = ? AND status IN ('ready', 'active')").bind(a.u).all()).results;
    const best = (await db.prepare("SELECT cat_id, score, total, acc, dur FROM (SELECT cat_id, score, total, acc, dur, ROW_NUMBER() OVER (PARTITION BY cat_id ORDER BY score DESC, acc DESC, dur ASC) rn FROM run_sessions WHERE u = ? AND status = 'done') WHERE rn = 1").bind(a.u).all()).results;
    const prefPer = (await runPref(db, a.u)).per_session;
    const out = [];
    for (const c of cats) {
      const b = best.find((x) => x.cat_id === c.id), rs = mine.find((x) => x.cat_id === c.id);
      let me = null;
      if (b) { const i = a.admin ? -1 : (await runBoard(db, c.id, 0)).findIndex((x) => x.u === a.u); me = { score: b.score, total: b.total, acc: b.acc, dur: b.dur, rank: i + 1 }; }
      out.push({ id: c.id, name: c.name, descr: c.descr, active: c.active, per_session: c.per_session, q_time: c.q_time, show_explain: c.show_explain, aq: c.aq, play: (prefPer > 0 ? Math.min(prefPer, c.aq) : (c.per_session > 0 ? Math.min(c.per_session, c.aq) : c.aq)), players: c.players, me, resume: rs ? { cur: rs.cur, total: rs.total, mode: rs.mode || "game" } : null });
    }
    const myNick = a.admin ? undefined : ((await db.prepare("SELECT nick FROM run_players WHERE u = ?").bind(a.u).first()) || {}).nick || null;
    const myCoins = a.admin ? 0 : ((await db.prepare("SELECT COALESCE(SUM(coins), 0) c FROM run_sessions WHERE u = ?").bind(a.u).first()) || {}).c || 0;
    return J({ cats: out, settings: set, nick: myNick, prefs: await runPref(db, a.u), coins: myCoins });
  }

  // ---------- preferensi pribadi: jumlah soal per sesi & tema ----------
  if (path === "prefs") {
    if (M === "GET") return J(await runPref(db, a.u));
    if (M === "POST") {
      const cur = await runPref(db, a.u);
      let per = cur.per_session, theme = cur.theme;
      if (body.per_session !== undefined) { const n = parseInt(body.per_session, 10); if (!Number.isFinite(n) || n < 0 || n > 500) return runErr("Jumlah soal harus antara 0 dan 500."); per = n; }
      if (body.theme !== undefined) { const th = String(body.theme || "").toLowerCase(); if (!["", "light", "dark"].includes(th)) return runErr("Tema tidak valid."); theme = th; }
      await db.prepare("INSERT INTO run_prefs (u, per_session, theme, updated) VALUES (?, ?, ?, ?) ON CONFLICT(u) DO UPDATE SET per_session = excluded.per_session, theme = excluded.theme, updated = excluded.updated").bind(a.u, per, theme, t).run();
      return J({ per_session: per, theme });
    }
  }

  // ---------- mode simulasi ujian: jawaban boleh diubah, kunci baru dibuka setelah dikumpulkan ----------
  if (path === "exam/save" && M === "POST") {
    const s = await runGet(db, body.sid);
    if (!s || s.u !== a.u) return runErr("Sesi tidak ditemukan.", 404);
    if ((s.mode || "game") !== "exam") return runErr("Sesi ini bukan mode simulasi ujian.", 409);
    if (s.status !== "active") return runErr("Ujian sudah berakhir.", 409);
    const limit = s.q_time * 1000 * s.total;
    if (Date.now() - (s.began || s.qstart || Date.now()) > limit + RUN_GRACE) { await runExamSubmit(db, s, Date.now()); return runErr("Waktu ujian habis. Jawaban sudah dikumpulkan.", 409, { done: true }); }
    const idx = Number.isInteger(body.idx) ? body.idx : -1;
    if (idx < 0 || idx >= s.total) return runErr("Nomor soal tidak valid.");
    if (!(await db.prepare("SELECT idx FROM run_answers WHERE sid = ? AND idx = ?").bind(s.id, idx).first())) return runErr("Soal tidak ditemukan.", 404);
    const ans = body.ans === undefined ? undefined : (body.ans == null ? null : String(body.ans).toUpperCase());
    if (ans !== undefined && ans !== null && !RUN_L.includes(ans)) return runErr("Jawaban tidak valid.");
    const flag = body.flag === undefined ? undefined : b01(body.flag);
    if (ans === undefined && flag === undefined) return runErr("Tidak ada perubahan.");
    const sets = [], vals = [];
    if (ans !== undefined) { sets.push("chosen = ?"); vals.push(ans); }
    if (flag !== undefined) { sets.push("flag = ?"); vals.push(flag); }
    await db.prepare("UPDATE run_answers SET " + sets.join(", ") + " WHERE sid = ? AND idx = ?").bind(...vals, s.id, idx).run();
    const v = await runExamView(db, s), q = v.qs[idx];
    return J({ ok: 1, idx, chosen: q ? q.chosen : "", flag: q ? q.flag : false, answered: v.answered, flagged: v.flagged, remaining: v.remaining });
  }
  if (path === "exam/submit" && M === "POST") {
    let s = await runGet(db, body.sid);
    if (!s || s.u !== a.u) return runErr("Sesi tidak ditemukan.", 404);
    if ((s.mode || "game") !== "exam") return runErr("Sesi ini bukan mode simulasi ujian.", 409);
    if (s.status === "done") return J({ ok: 1, done: true, sid: s.id });
    if (s.status === "ready") { await db.prepare("UPDATE run_sessions SET status = 'active', qstart = ?, began = ? WHERE id = ?").bind(t, t, s.id).run(); s = await runGet(db, s.id); }
    const n = await runExamSubmit(db, s, t);
    return J({ ok: 1, done: true, sid: n.id, score: n.score, total: n.total, acc: n.acc });
  }

  // ---------- sesi permainan ----------
  if (path === "start" && M === "POST") {
    const cat = await db.prepare("SELECT * FROM run_cats WHERE id = ?").bind(+body.cat || 0).first();
    if (!cat) return runErr("Kategori tidak ditemukan.", 404);
    if (!cat.active && !a.admin) return runErr("Kategori ini sedang dinonaktifkan.", 403);
    const mode = body.mode === "exam" ? "exam" : body.mode === "quiz" ? "quiz" : "game"; // quiz = mode soal, exam = simulasi ujian
    // lanjutkan sesi yang belum selesai pada kategori yang sama; sesi kategori lain dihentikan
    await db.prepare("UPDATE run_sessions SET status = 'abandoned' WHERE u = ? AND status IN ('ready', 'active') AND cat_id <> ?").bind(a.u, cat.id).run();
    let old = await db.prepare("SELECT * FROM run_sessions WHERE u = ? AND cat_id = ? AND status IN ('ready', 'active') ORDER BY started DESC LIMIT 1").bind(a.u, cat.id).first();
    if (old && (old.mode || "game") !== mode) { await db.prepare("UPDATE run_sessions SET status = 'abandoned' WHERE id = ?").bind(old.id).run(); old = null; } // ganti mode = sesi baru
    if (old) { old = await runSync(db, old); if (old.status === "ready" || old.status === "active") return J({ ...(mode === "exam" ? await runExamView(db, old) : await runView(db, old)), resumed: true }); }
    const pool = (await db.prepare("SELECT id, num, q, a, b, c, d, e, ans, expl, expl_opt, img FROM run_questions WHERE cat_id = ? AND active = 1 AND verified = 1").bind(cat.id).all()).results;
    if (!pool.length) return runErr("Kategori ini belum memiliki soal aktif. Hubungi admin.", 409, { empty: true });
    // jumlah soal: preferensi pribadi mahasiswa menang atas pengaturan kategori (0 = ikut kategori)
    const pref = await runPref(db, a.u), ask = pref.per_session > 0 ? pref.per_session : cat.per_session;
    // soal yang sudah pernah keluar untuk mahasiswa ini dilewati sampai bank kategori habis, lalu mulai putaran baru
    const seen = new Set((await db.prepare("SELECT qid FROM run_seen WHERE u = ? AND cat_id = ?").bind(a.u, cat.id).all()).results.map((r) => r.qid));
    let fresh = shuffle(pool.filter((q) => !seen.has(q.id))), used = shuffle(pool.filter((q) => seen.has(q.id))), cycle = false;
    if (!fresh.length) { await db.prepare("DELETE FROM run_seen WHERE u = ? AND cat_id = ?").bind(a.u, cat.id).run(); fresh = shuffle(pool.slice()); used = []; cycle = true; } // bank habis → putaran baru
    const total = ask > 0 ? Math.min(ask, pool.length) : pool.length, pick = fresh.concat(used).slice(0, total);
    const sid = b64(crypto.getRandomValues(new Uint8Array(12)));
    await db.prepare("INSERT INTO run_sessions (id, u, cat_id, cat_name, status, total, requested, q_time, show_explain, started, mode) VALUES (?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?)").bind(sid, a.u, cat.id, cat.name, pick.length, ask, cat.q_time, cat.show_explain, t, mode).run();
    const ins = pick.map((q, i) => db.prepare("INSERT INTO run_answers (sid, idx, qid, snap) VALUES (?, ?, ?, ?)").bind(sid, i, q.id, JSON.stringify({ q: q.q, a: q.a, b: q.b, c: q.c, d: q.d, e: q.e, ans: q.ans, expl: q.expl, ex: q.expl_opt ? JSON.parse(q.expl_opt) : null, img: q.img, num: q.num })));
    for (let i = 0; i < ins.length; i += 40) await db.batch(ins.slice(i, i + 40));
    // tandai soal sudah dipakai agar tidak berulang di permainan berikutnya
    const marks = pick.map((q) => db.prepare("INSERT OR IGNORE INTO run_seen (u, cat_id, qid, t) VALUES (?, ?, ?, ?)").bind(a.u, cat.id, q.id, t));
    for (let i = 0; i < marks.length; i += 40) await db.batch(marks.slice(i, i + 40));
    const freshN = pick.filter((q) => !seen.has(q.id)).length, v = mode === "exam" ? await runExamView(db, await runGet(db, sid)) : await runView(db, await runGet(db, sid));
    return J({ ...v, cycle, fresh: freshN });
  }
  if (["begin", "answer", "pause", "resume", "abandon"].includes(path) && M === "POST" || (path === "session" && M === "GET")) {
    let s = await runGet(db, body.sid || qp("sid"));
    if (!s || s.u !== a.u) return runErr("Sesi tidak ditemukan.", 404);
    if (path === "session") {
      if ((s.mode || "game") === "exam") { // mode ujian: satu waktu untuk semua soal, jawaban boleh diubah
        const limit = s.q_time * 1000 * s.total;
        if (s.status === "active" && Date.now() - (s.began || s.qstart || Date.now()) > limit + RUN_GRACE) { s = await runExamSubmit(db, s, Date.now()); return J({ sid: s.id, status: "done" }); }
        return J(await runExamView(db, s));
      }
      s = await runSync(db, s); return J(s.status === "done" ? { sid: s.id, status: "done" } : await runView(db, s));
    }
    if (path === "abandon") { if (s.status === "ready" || s.status === "active") await db.prepare("UPDATE run_sessions SET status = 'abandoned' WHERE id = ?").bind(s.id).run(); return J({ ok: 1 }); }
    if (path === "begin") {
      if (s.status === "ready") { await db.prepare("UPDATE run_sessions SET status = 'active', qstart = ?, began = ? WHERE id = ? AND status = 'ready'").bind(t, t, s.id).run(); const lim = (s.mode || "game") === "exam" ? s.q_time * 1000 * s.total : s.q_time * 1000; return J({ status: "active", remaining: lim, limit: lim }); }
      if (s.status !== "active") return runErr("Sesi sudah berakhir.", 409);
      s = await runSync(db, s); return J({ status: s.status, remaining: s.status === "active" ? Math.max(0, s.q_time * 1000 - ((s.paused_at || t) - s.qstart)) : null });
    }
    if (s.status === "ready") return runErr("Sesi belum dimulai.", 409);
    if (path === "pause") {
      if (s.status !== "active") return runErr("Sesi tidak aktif.", 409);
      if ((s.mode || "game") === "exam") return runErr("Mode simulasi ujian tidak bisa dijeda.", 403);
      if (!(await runSettings(db)).pause) return runErr("Jeda dinonaktifkan oleh admin.", 403);
      if (!s.paused_at) await db.prepare("UPDATE run_sessions SET paused_at = ?, pause_used = pause_used + 1 WHERE id = ? AND paused_at IS NULL").bind(t, s.id).run();
      return J({ ok: 1 });
    }
    if (path === "resume") {
      if (s.status !== "active") return runErr("Sesi tidak aktif.", 409);
      if (s.paused_at) { const d = Math.min(t - s.paused_at, RUN_PAUSE_MAX); await db.prepare("UPDATE run_sessions SET qstart = qstart + ?, began = began + ?, paused_at = NULL WHERE id = ? AND paused_at = ?").bind(d, d, s.id, s.paused_at).run(); s = await runGet(db, s.id); }
      s = await runSync(db, s);
      return J({ status: s.status, cur: s.cur, score: s.score, remaining: s.status === "active" ? Math.max(0, s.q_time * 1000 - (t - s.qstart)) : null });
    }
    // path === "answer" — jawaban terlambat dicatat KOSONG pada soal yang sama (bukan benar)
    s = await runUnpause(db, s);
    if (s.status !== "active") return runErr("Sesi sudah berakhir.", 409, { done: s.status === "done" });
    const idx = Number.isInteger(body.idx) ? body.idx : -1;
    if (idx !== s.cur) return runErr("Urutan soal tidak sinkron.", 409, { cur: s.cur });
    if (s.paused_at) return runErr("Sesi sedang dijeda.", 409);
    const ans = body.ans == null ? null : String(body.ans).toUpperCase();
    if (ans !== null && !RUN_L.includes(ans)) return runErr("Jawaban tidak valid.");
    const el = t - s.qstart, lim = s.q_time * 1000;
    if (ans === null && el < lim - RUN_EARLY) return runErr("Waktu soal belum habis.", 400, { remaining: lim - el });
    const r = await runRecord(db, s, ans, t, el > lim + RUN_GRACE);
    if (!r) return runErr("Soal ini sudah dijawab.", 409);
    // koin hanya berupa catatan (tidak memengaruhi skor akademik); dibatasi wajar per soal agar tidak mudah dimanipulasi
    const cg = Math.max(0, Math.min(Math.ceil(s.q_time * 5), parseInt(body.coins, 10) || 0));
    if (cg && (s.mode || "game") === "game") await db.prepare("UPDATE run_sessions SET coins = coins + ? WHERE id = ?").bind(cg, s.id).run();
    const n = await runGet(db, s.id);
    // kunci jawaban dibuka segera setelah soal ini dijawab (soal ini sudah terkunci, tidak bisa dijawab ulang);
    // pembahasan hanya dikirim di mode soal dan bila fitur pembahasan aktif
    const quiz = (s.mode || "game") === "quiz", ex = quiz && (await runSettings(db)).explain && s.show_explain ? true : false;
    const snapRow = ex ? await db.prepare("SELECT snap FROM run_answers WHERE sid = ? AND idx = ?").bind(s.id, idx).first() : null;
    const exOpt = snapRow ? JSON.parse(snapRow.snap).ex || null : null; // pembahasan tiap pilihan jawaban
    return J({ ...r, ex: exOpt, expl: ex ? r.expl : null, explain: ex, score: n.score, coins: n.coins || 0, done: n.status === "done", cur: n.cur });
  }

  // ---------- hasil, riwayat, leaderboard ----------
  if (path === "result" && M === "GET") {
    const s = await runGet(db, qp("sid"));
    if (!s || (s.u !== a.u && !a.admin)) return runErr("Sesi tidak ditemukan.", 404);
    if (s.status !== "done") return runErr("Hasil & pembahasan baru dibuka setelah seluruh sesi selesai.", 403);
    const ex = (await runSettings(db)).explain && s.show_explain ? true : false;
    const items = (await db.prepare("SELECT snap, chosen, correct, flag FROM run_answers WHERE sid = ? ORDER BY idx").bind(s.id).all()).results.map((r) => {
      const q = JSON.parse(r.snap);
      return { num: q.num, q: q.q, o: { A: q.a, B: q.b, C: q.c, D: q.d, E: q.e }, img: q.img || "", ans: q.ans, expl: ex ? q.expl || "" : null, ex: ex ? q.ex || null : null, chosen: r.chosen, correct: !!r.correct, flag: !!r.flag };
    });
    const own = (await db.prepare("SELECT nick FROM run_players WHERE u = ?").bind(s.u).first()) || {}, mine = s.u === a.u && !a.admin;
    return J({ nick: own.nick || null, needNick: mine && !own.nick, s: { id: s.id, u: s.u, mode: s.mode || "game", cat_id: s.cat_id, cat_name: s.cat_name, total: s.total, score: s.score, correct: s.correct, wrong: s.wrong, blank: s.blank, acc: s.acc, dur: s.dur, rank: s.rank, fin: s.fin }, items, explain: ex });
  }
  if (path === "history" && M === "GET") {
    const r = await db.prepare("SELECT id, cat_id, cat_name, mode, fin, score, total, correct, wrong, blank, acc, dur, rank FROM run_sessions WHERE u = ? AND status = 'done' ORDER BY fin DESC LIMIT 100").bind(a.u).all();
    return J({ rows: r.results });
  }
  if (path === "lb" && M === "GET") {
    const cat = qp("cat"), since = runSince(qp("p")), N = 50;
    const all = cat === "global" ? await runGlobal(db, since) : await runBoard(db, +cat || 0, since), me = all.find((x) => x.u === a.u), nm = await runNicks(db);
    const rows = await Promise.all(all.slice(0, N).map(async (x) => { // nama yang tampil = nama samaran TERKINI → ikut berubah di seluruh riwayat leaderboard
      const o = { ...x, nick: nm.get(x.u) || (await runAnon(env, x.u)), me: x.u === a.u };
      if (!a.admin) delete o.u; // mahasiswa lain tidak boleh tahu akun asli; admin tetap melihat
      return o;
    }));
    return J({ rows, me: me ? { rank: me.rank } : null, count: all.length, nick: a.admin ? undefined : nm.get(a.u) || null });
  }
  // leaderboard KOIN — terpisah dari leaderboard skor (total koin dari semua sesi game tiap mahasiswa)
  if (path === "coinlb" && M === "GET") {
    const since = runSince(qp("p")), N = 50;
    const all = (await db.prepare("SELECT u, SUM(coins) coins, COUNT(*) games FROM run_sessions WHERE u <> 'admin' AND coins > 0 AND started >= ? GROUP BY u ORDER BY coins DESC, u ASC").bind(since).all()).results.map((x, i) => ({ ...x, rank: i + 1 }));
    const me = all.find((x) => x.u === a.u), nm = await runNicks(db);
    const rows = await Promise.all(all.slice(0, N).map(async (x) => {
      const o = { ...x, nick: nm.get(x.u) || (await runAnon(env, x.u)), me: x.u === a.u };
      if (!a.admin) delete o.u;
      return o;
    }));
    return J({ rows, me: me ? { rank: me.rank, coins: me.coins } : null, count: all.length, nick: a.admin ? undefined : nm.get(a.u) || null });
  }
  if (path === "nick" && M === "POST") {
    if (a.admin) return runErr("Admin tidak memakai nama samaran.");
    const r = await runSetNick(db, a.u, body.nick, t);
    if (r.err) return runErr(r.err, r.s);
    await runAudit(db, a.u, "nama.ubah", r.nick);
    return J({ nick: r.nick });
  }

  // ---------- admin ----------
  if (path.startsWith("admin/")) {
    if (!a.admin) return runErr("Khusus admin.", 403);
    const ap = path.slice(6);
    if (ap === "stats" && M === "GET") {
      const one = async (sql) => (await db.prepare(sql).first()) || {};
      const tot = await one("SELECT (SELECT COUNT(*) FROM run_cats) cats, (SELECT COUNT(*) FROM run_questions WHERE active = 1 AND verified = 1) qa, (SELECT COUNT(*) FROM run_questions) qt, (SELECT COUNT(DISTINCT u) FROM run_sessions WHERE status = 'done' AND u <> 'admin') players, (SELECT COUNT(*) FROM run_sessions WHERE status = 'done' AND u <> 'admin') games, (SELECT AVG(acc) FROM run_sessions WHERE status = 'done' AND u <> 'admin') acc");
      const byCat = (await db.prepare("SELECT c.id, c.name, c.descr, c.active, c.per_session, c.q_time, c.show_explain, (SELECT COUNT(*) FROM run_questions q WHERE q.cat_id = c.id AND q.active = 1 AND q.verified = 1) aq, (SELECT COUNT(*) FROM run_questions q WHERE q.cat_id = c.id) tq, (SELECT COUNT(*) FROM run_sessions s WHERE s.cat_id = c.id AND s.status = 'done' AND s.u <> 'admin') games, (SELECT COUNT(DISTINCT u) FROM run_sessions s WHERE s.cat_id = c.id AND s.status = 'done' AND s.u <> 'admin') players, (SELECT AVG(acc) FROM run_sessions s WHERE s.cat_id = c.id AND s.status = 'done' AND s.u <> 'admin') acc FROM run_cats c ORDER BY c.sort, c.id").all()).results;
      const nmap = await runNicks(db);
      const recent = (await db.prepare("SELECT id, u, cat_name, mode, fin, score, total FROM run_sessions WHERE status = 'done' AND u <> 'admin' ORDER BY fin DESC LIMIT 10").all()).results.map((x) => ({ ...x, nick: nmap.get(x.u) || null }));
      return J({ cats: tot.cats, qActive: tot.qa, qInactive: tot.qt - tot.qa, players: tot.players, games: tot.games, acc: tot.acc || 0, byCat, recent });
    }
    if (ap === "cat" && M === "POST") {
      const name = clip(body.name, 120);
      if (!name) return runErr("Nama kategori wajib diisi.");
      const f = [name, clip(body.descr, 500), b01(body.active), Math.min(500, Math.max(0, parseInt(body.per_session, 10) || 0)), Math.min(600, Math.max(10, parseInt(body.q_time, 10) || 60)), b01(body.show_explain)];
      if (body.id) {
        const u = await db.prepare("UPDATE run_cats SET name = ?, descr = ?, active = ?, per_session = ?, q_time = ?, show_explain = ? WHERE id = ?").bind(...f, +body.id).run();
        if (!u.meta.changes) return runErr("Kategori tidak ditemukan.", 404);
        await runAudit(db, a.u, "kategori.ubah", "#" + body.id + " " + name);
        return J({ id: +body.id });
      }
      const r = await db.prepare("INSERT INTO run_cats (name, descr, active, per_session, q_time, show_explain, created) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(...f, t).run();
      await runAudit(db, a.u, "kategori.buat", name);
      return J({ id: r.meta.last_row_id });
    }
    if (ap === "cat/move" && M === "POST") {
      const rows = (await db.prepare("SELECT id FROM run_cats ORDER BY sort, id").all()).results;
      const i = rows.findIndex((r) => r.id === +body.id), j = i + (+body.dir < 0 ? -1 : 1);
      if (i < 0) return runErr("Kategori tidak ditemukan.", 404);
      if (j >= 0 && j < rows.length) {
        [rows[i], rows[j]] = [rows[j], rows[i]];
        await db.batch(rows.map((r, n) => db.prepare("UPDATE run_cats SET sort = ? WHERE id = ?").bind(n, r.id)));
        await runAudit(db, a.u, "kategori.urut", "#" + body.id);
      }
      return J({ ok: 1 });
    }
    if (ap === "cat/del" && M === "POST") {
      const c = await db.prepare("SELECT name FROM run_cats WHERE id = ?").bind(+body.id || 0).first();
      if (!c) return runErr("Kategori tidak ditemukan.", 404);
      await db.batch([db.prepare("DELETE FROM run_questions WHERE cat_id = ?").bind(+body.id), db.prepare("DELETE FROM run_cats WHERE id = ?").bind(+body.id)]); // riwayat sesi tetap
      await runAudit(db, a.u, "kategori.hapus", "#" + body.id + " " + c.name);
      return J({ ok: 1 });
    }
    if (ap === "q" && M === "GET") {
      const s = qp("s"), act = qp("active"), pg = Math.max(0, parseInt(qp("page"), 10) || 0), w = ["cat_id = ?"], bind = [+qp("cat") || 0];
      if (s) { w.push("(q LIKE ? OR a LIKE ? OR b LIKE ? OR c LIKE ? OR d LIKE ? OR e LIKE ?)"); for (let i = 0; i < 6; i++) bind.push("%" + s.replace(/[%_]/g, "") + "%"); }
      if (act === "1" || act === "0") { w.push("active = ?"); bind.push(+act); }
      const total = (await db.prepare("SELECT COUNT(*) n FROM run_questions WHERE " + w.join(" AND ")).bind(...bind).first()).n;
      const rows = (await db.prepare("SELECT " + RUN_QCOLS + " FROM run_questions WHERE " + w.join(" AND ") + " ORDER BY num IS NULL, num, id LIMIT 50 OFFSET ?").bind(...bind, pg * 50).all()).results;
      return J({ rows, total });
    }
    if (ap === "q" && M === "POST") {
      const v = runQ(body);
      if (v.err) return runErr(v.err);
      const o = v.o, active = b01(body.active);
      if (o.img) { const miss = await runImgMissing(db, o.img.split(",")); if (miss.length) return runErr("Gambar tidak ditemukan di server (" + miss.length + "). Unggah ulang gambarnya."); }
      try {
        const u = await db.prepare("UPDATE run_questions SET num = ?, q = ?, a = ?, b = ?, c = ?, d = ?, e = ?, ans = ?, expl = ?, expl_opt = ?, diff = ?, img = ?, active = ?, verified = 1, hash = ?, updated = ? WHERE id = ?").bind(o.num, o.q, o.a, o.b, o.c, o.d, o.e, o.ans, o.expl, o.ex, o.diff, o.img, active, await runHash(o), t, +body.id || 0).run();
        if (!u.meta.changes) return runErr("Soal tidak ditemukan.", 404);
      } catch { return runErr("Soal yang sama sudah ada di kategori ini.", 409); }
      await runAudit(db, a.u, "soal.ubah", "#" + body.id);
      return J({ ok: 1 });
    }
    if (ap === "q/toggle" && M === "POST") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Boolean).slice(0, 200), on = b01(body.active);
      await db.batch(ids.map((id) => db.prepare("UPDATE run_questions SET active = ?, verified = CASE WHEN ? = 1 THEN 1 ELSE verified END, updated = ? WHERE id = ?").bind(on, on, t, id)));
      await runAudit(db, a.u, on ? "soal.aktifkan" : "soal.nonaktifkan", ids.join(","));
      return J({ ok: 1 });
    }
    if (ap === "q/del" && M === "POST") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Boolean);
      for (let i = 0; i < ids.length; i += 80) await db.batch(ids.slice(i, i + 80).map((id) => db.prepare("DELETE FROM run_questions WHERE id = ?").bind(id))); // snapshot sesi tidak terpengaruh
      await runAudit(db, a.u, "soal.hapus", ids.length + " soal");
      return J({ ok: 1 });
    }
    if (ap === "import" && M === "POST") {
      const cat = await db.prepare("SELECT name FROM run_cats WHERE id = ?").bind(+body.cat || 0).first();
      if (!cat) return runErr("Kategori tujuan tidak ditemukan.", 404);
      const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [], errors = [], rows = [];
      for (let i = 0; i < items.length; i++) {
        const v = runQ(items[i] || {});
        if (v.err) { errors.push({ i, err: v.err }); continue; }
        rows.push({ o: v.o, active: items[i].active === false ? 0 : 1 });
      }
      const allImg = [...new Set(rows.flatMap((r) => (r.o.img ? r.o.img.split(",") : [])))];
      if (allImg.length) {
        const miss = new Set(await runImgMissing(db, allImg));
        if (miss.size) for (let k = rows.length - 1; k >= 0; k--) if (rows[k].o.img.split(",").some((x) => miss.has(x))) { errors.push({ i: k, err: "Gambar tidak ditemukan di server" }); rows.splice(k, 1); }
      }
      let added = 0, dup = 0, filled = 0;
      const src = clip(body.src, 200);
      for (let i = 0; i < rows.length; i += 40) {
        const part = rows.slice(i, i + 40), st = [];
        for (const r of part) st.push(db.prepare("INSERT OR IGNORE INTO run_questions (cat_id, num, q, a, b, c, d, e, ans, expl, expl_opt, diff, img, active, verified, src, hash, imported, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)").bind(+body.cat, r.o.num, r.o.q, r.o.a, r.o.b, r.o.c, r.o.d, r.o.e, r.o.ans, r.o.expl, r.o.ex, r.o.diff, r.o.img, r.active, src, await runHash(r.o), t, t));
        const res = await db.batch(st), fill = [];
        for (let k = 0; k < res.length; k++) {
          if (res[k].meta.changes) added++; else { dup++; if (part[k].o.img) fill.push(db.prepare("UPDATE run_questions SET img = ?, updated = ? WHERE cat_id = ? AND hash = ? AND (img IS NULL OR img = '')").bind(part[k].o.img, t, +body.cat, await runHash(part[k].o))); }
        }
        if (fill.length) for (const x of await db.batch(fill)) if (x.meta.changes) filled++;
      }
      await runAudit(db, a.u, "soal.impor", cat.name + " · +" + added + (dup ? " dup " + dup : "") + (filled ? " gambar+ " + filled : "") + (errors.length ? " gagal " + errors.length : "") + " · " + src);
      return J({ added, dup, filled, errors });
    }
    if (ap === "export" && M === "GET") {
      const rows = (await db.prepare("SELECT " + RUN_QCOLS + " FROM run_questions WHERE cat_id = ? ORDER BY num IS NULL, num, id").bind(+qp("cat") || 0).all()).results;
      return J({ rows });
    }
    if (ap === "img" && M === "POST") {
      const m = String(body.data || "").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
      if (!m || m[2].length > 900000) return runErr("Gambar tidak valid atau lebih dari ±650 KB.");
      let head = ""; try { head = atob(m[2].slice(0, 16)); } catch { return runErr("Data gambar rusak."); }
      const sig = { "image/jpeg": head.startsWith("\xFF\xD8"), "image/png": head.startsWith("\x89PNG"), "image/gif": head.startsWith("GIF8"), "image/webp": head.startsWith("RIFF") && head.slice(8, 12) === "WEBP" }[m[1]];
      if (!sig) return runErr("Isi berkas tidak sesuai tipe gambar.");
      const id = (await sha("img:" + m[2])).slice(0, 24); // ID dari isi → unggah ulang gambar yang sama tidak menggandakan data
      await db.prepare("INSERT OR IGNORE INTO run_images (id, mime, data, created) VALUES (?, ?, ?, ?)").bind(id, m[1], m[2], t).run();
      return J({ id });
    }
    if (ap === "settings" && M === "POST") {
      const v = { sound: b01(body.sound), fx: b01(body.fx), explain: b01(body.explain), pause: b01(body.pause), gfx: body.gfx === "low" ? "low" : "high" };
      await db.batch(Object.entries(v).map(([k, x]) => db.prepare("INSERT INTO run_settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(k, JSON.stringify(x))));
      await runAudit(db, a.u, "pengaturan", JSON.stringify(v));
      return J({ ok: 1 });
    }
    if (ap === "nicks" && M === "GET") return J({ rows: (await db.prepare("SELECT u, nick, updated FROM run_players ORDER BY nick COLLATE NOCASE").all()).results });
    if (ap === "nick" && M === "POST") { // admin: ubah / hapus nama samaran (mis. nama tidak pantas). nick kosong = hapus
      const u = String(body.u || "").trim().toUpperCase();
      if (!isStu(u)) return runErr("NIM tidak valid.");
      if (!String(body.nick || "").trim()) { await db.prepare("DELETE FROM run_players WHERE u = ?").bind(u).run(); await runAudit(db, a.u, "nama.reset", u); return J({ ok: 1 }); }
      const r = await runSetNick(db, u, body.nick, t);
      if (r.err) return runErr(r.err, r.s);
      await runAudit(db, a.u, "nama.atur", u + " → " + r.nick);
      return J({ nick: r.nick });
    }
    if (ap === "audit" && M === "GET") return J({ rows: (await db.prepare("SELECT t, u, act, detail FROM run_audit ORDER BY id DESC LIMIT 200").all()).results });
    if (ap === "sessions" && M === "GET") {
      const rows = (await db.prepare("SELECT id, cat_id, cat_name, fin, score, total, acc, dur, rank FROM run_sessions WHERE u = ? AND status = 'done' ORDER BY fin DESC LIMIT 200").bind(qp("u").toUpperCase()).all()).results;
      return J({ rows });
    }
    if (ap === "up/pdf" && M === "POST") { // arsip PDF asli (opsional; butuh R2 binding RUN_FILES)
      if (!env.RUN_FILES) return runErr("R2 (RUN_FILES) belum dipasang — arsip PDF dilewati.", 501);
      const len = +request.headers.get("content-length") || 0;
      if (len > 30e6) return runErr("PDF lebih dari 30 MB.", 413);
      const name = clip(qp("name"), 120).replace(/[^\w.\- ]/g, "_") || "soal.pdf", key = "pdf/" + t + "-" + name;
      await env.RUN_FILES.put(key, request.body, { httpMetadata: { contentType: "application/pdf" }, customMetadata: { cat: qp("cat"), by: a.u } });
      await runAudit(db, a.u, "pdf.arsip", key);
      return J({ ok: 1, key });
    }
  }
  return runErr("not found", 404);
}
// ===== ASTERION RUN (selesai) ===================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.ADMIN_PASSWORD) return J({ err: "ADMIN_PASSWORD belum diatur" }, 500);
    const path = url.pathname.slice(5), M = request.method;
    if (path.startsWith("run/img/") && M === "GET") { // gambar soal (ID acak, tanpa kunci jawaban)
      const rdb = await runDb(env).catch(() => null), iid = path.slice(8);
      if (!rdb || !/^[\w-]{6,40}$/.test(iid)) return new Response("", { status: rdb ? 400 : 503 });
      const im = await rdb.prepare("SELECT mime, data FROM run_images WHERE id = ?").bind(iid).first();
      if (!im) return new Response("", { status: 404 });
      return new Response(Uint8Array.from(atob(im.data), (c) => c.charCodeAt(0)), { headers: { "content-type": im.mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
    }
    let body = {};
    if (M !== "GET" && path !== "run/admin/up/pdf") { try { body = await request.json(); } catch { body = {}; } }

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
      await seen(env, u, true);
      return J({ token: await mint(u, env), u, admin: false, mc: !rec });
    }

    const a = await auth(request, env);
    if (!a) return J({ err: "auth" }, 401);

    if (path === "changepw" && M === "POST") {
      const np = String(body.np || "");
      if (a.admin || np.length < 6 || np.length > 100 || np.toUpperCase() === a.u) return J({ err: "Password minimal 6 karakter dan tidak boleh sama dengan username." }, 400);
      const s = b64(crypto.getRandomValues(new Uint8Array(12)));
      await env.LINKS.put("u:" + a.u, JSON.stringify({ s, h: await pbk(np, s), t: Date.now() }), { metadata: { t: Date.now() } });
      await seen(env, a.u, true);
      return J({ ok: 1 });
    }
    if (a.mc) return J({ mc: true }, 403);
    if (path === "ping" && M === "POST") { // detak "sedang online" dari klien (admin tidak dicatat)
      if (!a.admin) { try { const pdb = await runDb(env); if (pdb) await pdb.prepare("INSERT INTO run_presence (u, t) VALUES (?, ?) ON CONFLICT(u) DO UPDATE SET t = excluded.t").bind(a.u, Date.now()).run(); } catch {} }
      return J({ ok: 1 });
    }
    if (path.startsWith("run/")) return runApi(request, env, a, path.slice(4), url, body, M);
    if (path === "dokter" || path.startsWith("dokter/")) return dokter(env, a, path, M, body);

    if (path === "data") {
      if (M === "GET") { await seen(env, a.u); return J(await getSite(env)); }
      if (M === "PUT") {
        if (!a.admin) return J({ err: "admin" }, 403);
        if (!valid(body)) return J({ err: "invalid" }, 400);
        await env.LINKS.put("site", JSON.stringify(body));
        try { // bersihkan file HTML yatim (lebih dari 1 jam & tidak dipakai lagi)
          const ref = new Set(), col = (a) => (a || []).forEach((x) => x.hid && ref.add(x.hid));
          col(body.drive); body.materi.forEach((b) => { col(b.lab); col(b.all); }); body.rekaman.forEach((t) => { col(t.kl); col(t.blok); col(t.lab); });
          for (const k of (await env.LINKS.list({ prefix: "h:" })).keys) if (!ref.has(k.name.slice(2)) && (!k.metadata || Date.now() - k.metadata.t > 36e5)) await env.LINKS.delete(k.name);
        } catch {}
        return J({ ok: 1 });
      }
    }
    if (path === "html") { // file HTML materi hasil upload
      if (M === "GET") {
        const id = url.searchParams.get("id") || "";
        if (!/^[\w-]{6,40}$/.test(id)) return J({ err: 1 }, 400);
        const t = await env.LINKS.get("h:" + id);
        return t === null ? J({ err: "tidak ada" }, 404) : J({ h: t });
      }
      if (M === "POST") {
        if (!a.admin) return J({ err: "admin" }, 403);
        const h = typeof body.h === "string" ? body.h : "";
        if (!h || h.length > 5e6) return J({ err: "File kosong atau lebih dari 5 MB." }, 400);
        const id = b64(crypto.getRandomValues(new Uint8Array(9)));
        await env.LINKS.put("h:" + id, h, { metadata: { t: Date.now() } });
        return J({ id });
      }
    }
    if (path === "users" && M === "GET") { // admin: status akun mahasiswa (buka web / ganti password)
      if (!a.admin) return J({ err: "admin" }, 403);
      const all = async (prefix) => { const out = []; let cursor; do { const r = await env.LINKS.list({ prefix, cursor }); out.push(...r.keys); cursor = r.list_complete ? undefined : r.cursor; } while (cursor); return out; };
      const [pw, op] = await Promise.all([all("u:"), all("a:")]), m = {};
      for (const k of op) { const u = k.name.slice(2); if (isStu(u)) m[u] = { f: (k.metadata && k.metadata.f) || 0, l: (k.metadata && k.metadata.l) || 0, p: 0 }; }
      for (const k of pw) { const u = k.name.slice(2); if (isStu(u)) m[u] = { f: 0, l: 0, ...(m[u] || {}), p: (k.metadata && k.metadata.t) || 1 }; } // p: 0 = belum, 1 = sudah (waktu tak tercatat), lainnya = waktu ganti
      const pt = {};
      try { const pdb = await runDb(env); if (pdb) for (const r of (await pdb.prepare("SELECT u, t FROM run_presence").all()).results) if (isStu(r.u)) pt[r.u] = r.t; } catch {}
      return J({ users: m, pt, now: Date.now() }); // pt: ping terakhir per NIM (klien menentukan "online" = now - pt < 200 dtk)
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
      const tabs = t || site.sheet.tabs, g = grp(a.u);
      let def = 0;
      if (g) { // tab terbaru (paling kiri) yang namanya diawali "A." / "B."
        const re = new RegExp("^\\s*" + g + "\\s*\\.", "i"), idx = tabs.map((x, i) => (re.test(x.n) ? i : -1)).filter((i) => i >= 0);
        if (idx.length) {
          def = idx[0];
          // blok yang belum selesai didahulukan walaupun jadwal blok berikutnya sudah dibuat
          const cand = idx.slice(0, 4), today = jktToday(), ends = await Promise.all(cand.map((i) => blockEnd(site.sheet.id, tabs[i].g)));
          for (let k = cand.length - 1; k >= 0; k--) if (ends[k] && ends[k] >= today) { def = cand[k]; break; }
        }
      }
      return J({ tabs, auto: !!t, def, grp: g });
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
    if (path === "file" && M === "GET") { // unduh file Drive (PDF/PPT) lewat server: mendukung file besar + Range untuk pdf.js
      const id = url.searchParams.get("id") || "", k = url.searchParams.get("k") || "";
      if (!/^[\w-]{10,80}$/.test(id)) return J({ err: 1 }, 400);
      const uc = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
      const fname = (cd) => { const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)/i); try { return m ? decodeURIComponent(m[1]) : ""; } catch { return m ? m[1] : ""; } };
      if (k === "probe") { // cuma cari nama/jenis file
        let n = "";
        try {
          if (env.DRIVE_API_KEY) {
            const m = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType&supportsAllDrives=true&key=${env.DRIVE_API_KEY}`);
            if (m.ok) { const j = await m.json(); if (j.mimeType === "application/vnd.google-apps.presentation") return J({ n: j.name || "", k: "slides" }); n = j.name || ""; }
          }
          if (!n) { const r = await fetch(uc, { headers: { ...UA, range: "bytes=0-0" } }); n = fname(r.headers.get("content-disposition") || ""); try { await r.body?.cancel(); } catch {} }
        } catch {}
        return J({ n });
      }
      if (k === "pack") { try { return await pptxPack(id, env, uc); } catch (err) { return J({ err: "pack gagal" }, 502); } }
      if (k === "pdfslides") { try { return await slidesPdf(id, env, url.searchParams.get("n") === "1"); } catch (err) { return J({ err: "konversi gagal: " + String(err && err.message || err).slice(0, 200) }, 502); } }
      const src = k === "slides" ? `https://docs.google.com/presentation/d/${id}/export/pptx`
        : env.DRIVE_API_KEY ? `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true&key=${env.DRIVE_API_KEY}` : uc;
      const h = { ...UA }, rg = request.headers.get("range");
      if (rg && /^bytes=\d*-\d*$/.test(rg)) h.range = rg;
      let r = await fetch(src, { headers: h });
      if (!r.ok && r.status !== 206 && env.DRIVE_API_KEY && k !== "slides") r = await fetch(uc, { headers: h });
      if (r.status !== 200 && r.status !== 206) return J({ err: "File tidak bisa diambil dari Drive. Pastikan dibagikan 'siapa saja yang memiliki link'." }, 502);
      if (/text\/html/i.test(r.headers.get("content-type") || "")) return J({ err: "Drive tidak memberi file (mungkin belum dibagikan publik)." }, 403);
      const o = new Headers({ "content-type": "application/octet-stream", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" });
      for (const n of ["content-length", "content-range", "accept-ranges", "content-disposition"]) { const v = r.headers.get(n); if (v) o.set(n, v); }
      return new Response(r.body, { status: r.status, headers: o });
    }
    if (path === "tutor" && M === "GET") {
      const b = await cached("tutor/v1", 60, () => tutorBook(env));
      return b ? J(b) : J({ err: "Spreadsheet tutorial tidak bisa dibaca. Pastikan dibagikan 'siapa saja yang memiliki link'." }, 502);
    }
    if (path === "schedule" && M === "GET") {
      const g = url.searchParams.get("g") || "0";
      if (!/^\d{1,12}$/.test(g)) return J({ err: 1 }, 400);
      const id = (await getSite(env)).sheet.id;
      const days = await getSched(id, g);
      if (!days) return J({ err: "Spreadsheet tidak bisa dibaca. Pastikan dibagikan 'siapa saja yang memiliki link'." }, 502);
      return J(days);
    }
    return J({ err: "not found" }, 404);
  },
};


// ===== TAMPILAN ASLI SLIDE: PPTX -> Google Slides (salinan sementara) -> PDF -> di-cache =====
// Butuh secret GOOGLE_SA_JSON (isi file kunci service account, JSON utuh). Tanpa itu endpoint menjawab 501 dan web memakai penggambar bawaan.
let _gTok = null;
async function gToken(env) { // utama: OAuth akun Google pribadi (punya kuota Drive); cadangan: service account (tak bisa menyalin file)
  if (env.GOOGLE_OAUTH_REFRESH_TOKEN && env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) {
    if (_gTok && _gTok.exp > Date.now() + 60000) return _gTok.t;
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN, grant_type: "refresh_token" }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error("token OAuth ditolak: " + (j.error_description || j.error || r.status));
    _gTok = { t: j.access_token, exp: Date.now() + (j.expires_in || 3300) * 1000 };
    return _gTok.t;
  }
  return saToken(env);
}
let _saTok = null;
async function saToken(env) {
  if (_saTok && _saTok.exp > Date.now() + 60000) return _saTok.t;
  let sa; try { sa = JSON.parse(env.GOOGLE_SA_JSON); } catch { throw new Error("GOOGLE_SA_JSON bukan JSON valid"); }
  if (!sa.client_email || !sa.private_key) throw new Error("GOOGLE_SA_JSON tidak lengkap");
  const b64u = (x) => btoa(typeof x === "string" ? x : String.fromCharCode(...new Uint8Array(x))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" })), claim = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3300 }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, ""), der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + head + "." + claim + "." + b64u(sig) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("token Google ditolak: " + (j.error_description || j.error || r.status));
  _saTok = { t: j.access_token, exp: Date.now() + (j.expires_in || 3300) * 1000 };
  return _saTok.t;
}
async function gasCall(env, params) {
  const u = new URL(env.GAS_URL); for (const k in params) u.searchParams.set(k, params[k]); u.searchParams.set("key", env.GAS_KEY || "");
  const r = await fetch(u.toString(), { redirect: "follow" }); const t = await r.text(); let j;
  try { j = JSON.parse(t); } catch { throw new Error("Apps Script membalas bukan JSON (cek deploy: Who has access = Anyone)"); }
  if (j.err) throw new Error(j.err);
  return j;
}
function b64buf(b) { const bin = atob(b), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a.buffer; }
async function slidesPdf(id, env, native) {
  const useGas = !!env.GAS_URL, useG = !!(env.GOOGLE_OAUTH_REFRESH_TOKEN || env.GOOGLE_SA_JSON);
  if (!useGas && !useG) return J({ err: "kredensial Google belum diatur" }, 501);
  const PH = { "content-type": "application/pdf", "cache-control": "private, max-age=86400" };
  const H = useGas ? null : { authorization: "Bearer " + await gToken(env) };
  // versi file (berubah bila dosen mengganti file di Drive) dicek paling sering tiap 12 jam
  let ver = "0", pv = "", pts = 0; const vk = "spv:" + id;
  try { if (env.LINKS) { const rec = await env.LINKS.get(vk); if (rec) { const q = rec.split("|"); pv = q[0]; pts = Number(q[1]) || 0; } } } catch {}
  if (pv && Date.now() - pts < 12 * 3600e3) ver = pv;
  else {
    let got = "";
    try {
      if (useGas) got = String((await gasCall(env, { id, meta: 1 })).ver || "");
      else { const mr = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=md5Checksum,modifiedTime&supportsAllDrives=true`, { headers: H }); if (mr.ok) { const mj = await mr.json(); got = String(mj.md5Checksum || mj.modifiedTime || ""); } }
    } catch {}
    ver = (got || pv || "0").replace(/[^\w]/g, "").slice(0, 40);
    try { if (env.LINKS) await env.LINKS.put(vk, ver + "|" + Date.now(), { expirationTtl: 60 * 86400 }); } catch {}
  }
  const key = "slidespdf/" + id + "-" + ver, kvKey = "sp:" + id + ":" + ver;
  try { if (env.RUN_FILES) { const o = await env.RUN_FILES.get(key); if (o) return new Response(o.body, { headers: PH }); } } catch {}
  try { if (env.LINKS) { const b = await env.LINKS.get(kvKey, "arrayBuffer"); if (b) return new Response(b, { headers: PH }); } } catch {}
  let buf;
  if (useGas) {
    const j = await gasCall(env, { id, n: native ? "1" : "0" });
    if (!j.b64) throw new Error("Apps Script tidak mengirim PDF");
    buf = b64buf(j.b64);
  } else {
    let nid = id, tmp = false;
    try {
      if (!native) {
        const cr = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/copy?supportsAllDrives=true&fields=id`, { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ name: "asterion-tmp-" + id.slice(0, 8), mimeType: "application/vnd.google-apps.presentation" }) });
        const cj = await cr.json().catch(() => ({}));
        if (!cr.ok || !cj.id) throw new Error("salin/konversi gagal (" + cr.status + "): " + ((cj.error && cj.error.message) || "pastikan file dibagikan 'siapa saja yang memiliki link'"));
        nid = cj.id; tmp = true;
      }
      let r = await fetch(`https://docs.google.com/presentation/d/${nid}/export/pdf`, { headers: H });
      if (!r.ok) r = await fetch(`https://www.googleapis.com/drive/v3/files/${nid}/export?mimeType=application/pdf`, { headers: H });
      if (!r.ok) throw new Error("ekspor PDF gagal (" + r.status + ")");
      buf = await r.arrayBuffer();
    } finally {
      if (tmp && nid !== id) { try { await fetch(`https://www.googleapis.com/drive/v3/files/${nid}?supportsAllDrives=true`, { method: "DELETE", headers: H }); } catch {} }
    }
  }
  if (new Uint8Array(buf.slice(0, 4)).join() !== "37,80,68,70") throw new Error("hasil ekspor bukan PDF");
  let saved = false;
  try { if (env.RUN_FILES) { await env.RUN_FILES.put(key, buf, { httpMetadata: { contentType: "application/pdf" } }); saved = true; } } catch {}
  if (!saved) { try { if (env.LINKS && buf.byteLength < 24 * 1048576) await env.LINKS.put(kvKey, buf, { expirationTtl: 60 * 86400 }); } catch {} }
  return new Response(buf, { headers: PH });
}

// ===== PPTX PACK: baca ZIP di sisi server, kirim hanya XML slide + catatan (kecil) ke browser =====
async function pptxPack(id, env, uc) {
  const key = env.DRIVE_API_KEY, api = key ? `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true&key=${key}` : null;
  const get = async (range) => {
    const h = { ...UA, ...(range ? { range } : {}) };
    let r = api ? await fetch(api, { headers: h }) : null;
    if (!r || (!r.ok && r.status !== 206)) r = await fetch(uc, { headers: h });
    return r;
  };
  const bad = (m, s = 502) => J({ err: m }, s);
  let r = await get("bytes=-262144");
  if (r.status !== 200 && r.status !== 206) return bad("File tidak bisa diambil dari Drive.");
  if (/text\/html/i.test(r.headers.get("content-type") || "")) return bad("Drive tidak memberi file.", 403);
  if (r.status === 200 && +r.headers.get("content-length") > 150 * 1048576) { try { await r.body.cancel(); } catch {} return bad("terlalu besar", 413); }
  const tb = new Uint8Array(await r.arrayBuffer());
  let total = tb.length, full = r.status === 200 ? tb : null;
  if (r.status === 206) { const m = (r.headers.get("content-range") || "").match(/\/(\d+)\s*$/); if (!m) return bad("tanpa ukuran"); total = +m[1]; }
  let nr = false; // Drive tidak mendukung Range -> browser harus unduh penuh (gambar tak bisa diambil per bagian)
  if (full) { try { const x = await get("bytes=0-1"); nr = x.status !== 206; try { await x.body.cancel(); } catch {} } catch { nr = true; } }
  const ts = total - tb.length, tv = new DataView(tb.buffer, tb.byteOffset, tb.length);
  let e = tb.length - 22; while (e >= 0 && tv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) return bad("bukan pptx", 415);
  const cnt = tv.getUint16(e + 10, true), csz = tv.getUint32(e + 12, true), cof = tv.getUint32(e + 16, true);
  if (cnt === 0xFFFF || cof === 0xFFFFFFFF) return bad("zip64", 415);
  const rng = async (a, b) => {
    if (full) return full.subarray(a, b + 1);
    const x = await get(`bytes=${a}-${b}`); if (x.status !== 206) throw new Error("range");
    return new Uint8Array(await x.arrayBuffer());
  };
  const cd = cof >= ts ? tb.subarray(cof - ts, cof - ts + csz) : await rng(cof, cof + csz - 1);
  const dv = new DataView(cd.buffer, cd.byteOffset, cd.length), td = new TextDecoder(), ent = {};
  for (let q = 0, n = 0; n < cnt && q + 46 <= cd.length; n++) {
    if (dv.getUint32(q, true) !== 0x02014b50) break;
    const nl = dv.getUint16(q + 28, true), el = dv.getUint16(q + 30, true), cl = dv.getUint16(q + 32, true);
    ent[td.decode(cd.subarray(q + 46, q + 46 + nl))] = { mt: dv.getUint16(q + 10, true), cs: dv.getUint32(q + 20, true), o: dv.getUint32(q + 42, true), nl };
    q += 46 + nl + el + cl;
  }
  if (!ent["ppt/presentation.xml"]) return bad("bukan pptx", 415);
  const isCore = (x) => ent[x].cs < 2097152 && (x === "ppt/presentation.xml" || x === "ppt/_rels/presentation.xml.rels" || /^ppt\/(slides|slideLayouts|slideMasters|theme|notesSlides)\/.*\.(xml|rels)$/.test(x));
  const core = Object.keys(ent).filter(isCore).sort((a, b) => ent[a].o - ent[b].o);
  const gs = []; let g = null;
  for (const x of core) { const en = ent[x], end = en.o + 30 + en.nl + 64 + en.cs;
    if (g && en.o - g.end <= 262144 && end - g.a <= 16777216) { g.n.push(x); g.end = Math.max(g.end, end); } else { g = { a: en.o, end: Math.min(end, total), n: [x] }; gs.push(g); } }
  const cutZ = (en, buf, base) => { const s0 = en.o - base; if (s0 < 0 || s0 + 30 > buf.length) return null; const v = new DataView(buf.buffer, buf.byteOffset, buf.length);
    if (v.getUint32(s0, true) !== 0x04034b50) return null; const ds = s0 + 30 + v.getUint16(s0 + 26, true) + v.getUint16(s0 + 28, true);
    return ds + en.cs > buf.length ? null : buf.subarray(ds, ds + en.cs); };
  const inflate = async (u) => new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  const parts = {};
  await Promise.all(gs.map(async (gr) => {
    const buf = await rng(gr.a, gr.end - 1);
    await Promise.all(gr.n.map(async (x) => {
      const en = ent[x]; let raw = cutZ(en, buf, gr.a);
      if (!raw) { const b2 = await rng(en.o, Math.min(total - 1, en.o + 30 + en.nl + 4096 + en.cs - 1)); raw = cutZ(en, b2, en.o); }
      if (!raw) return;
      parts[x] = td.decode(en.mt === 0 ? raw : await inflate(raw));
    }));
  }));
  const e2 = {};
  for (const x of Object.keys(ent)) if (!(x in parts) && x.startsWith("ppt/") && ent[x].cs) e2[x] = [ent[x].o, ent[x].cs, ent[x].nl, ent[x].mt];
  return new Response(JSON.stringify({ p: parts, e: e2, nr }), { headers: { "content-type": "application/json", "cache-control": "private, max-age=600" } });
}


// ===== JADWAL TUTORIAL (spreadsheet .xlsx di Drive) ================================
const TUTOR_ID = "1wGtzCT4qpjMb1I0RyhDhp-Wuy7CoOe59";
const DAYN = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"], MONN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const xmlDec = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
async function unzipBuf(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf), td = new TextDecoder();
  let e = u.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("zip");
  const cnt = dv.getUint16(e + 10, true); let q = dv.getUint32(e + 16, true); const ent = {};
  for (let n = 0; n < cnt; n++) {
    if (dv.getUint32(q, true) !== 0x02014b50) break;
    const nl = dv.getUint16(q + 28, true), el = dv.getUint16(q + 30, true), cl = dv.getUint16(q + 32, true);
    ent[td.decode(u.subarray(q + 46, q + 46 + nl))] = { mt: dv.getUint16(q + 10, true), cs: dv.getUint32(q + 20, true), o: dv.getUint32(q + 42, true) };
    q += 46 + nl + el + cl;
  }
  return async (name) => {
    const en = ent[name]; if (!en) return null;
    const ds = en.o + 30 + dv.getUint16(en.o + 26, true) + dv.getUint16(en.o + 28, true), raw = u.subarray(ds, ds + en.cs);
    return en.mt === 0 ? td.decode(raw) : new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  };
}
const colIdx = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const attr = (s, k) => { const m = s.match(new RegExp("(?:^|\\s)" + k + '="([^"]*)"')); return m ? xmlDec(m[1]) : ""; };
async function xlsxSheets(buf) {
  const get = await unzipBuf(buf);
  const wb = await get("xl/workbook.xml"), rels = (await get("xl/_rels/workbook.xml.rels")) || "", ss = (await get("xl/sharedStrings.xml")) || "";
  if (!wb) throw new Error("xlsx");
  const rt = {}; for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const t = attr(m[0], "Target"); rt[attr(m[0], "Id")] = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, ""); }
  const sst = []; for (const m of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) sst.push(xmlDec([...m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")));
  const out = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    if (/state="(hidden|veryHidden)"/.test(m[0])) continue;
    const path = rt[attr(m[0], "r:id")], x = path && (await get(path)); if (!x) continue;
    const rows = [];
    for (const rm of x.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const row = []; if (rm[1]) for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = cm[1], body = cm[2] || "", t = attr(at, "t"), v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let val = "";
        if (t === "s") val = sst[+v] || ""; else if (t === "inlineStr") val = xmlDec([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x2) => x2[1]).join("")); else if (v !== undefined) val = xmlDec(v);
        row[colIdx(attr(at, "r") || "A1")] = val;
      }
      const r1 = +attr(rm[0].slice(0, 80), "r") || rows.length + 1; while (rows.length < r1 - 1) rows.push([]); rows.push(row);
    }
    out.push({ n: attr(m[0], "name"), rows });
  }
  return out;
}
function tutorItems(rows) {
  const h = rows.findIndex((r) => r.some((c) => /^skenario$/i.test((c || "").trim())) && r.some((c) => /^tutor$/i.test((c || "").trim())));
  if (h < 0) return [];
  const H = rows[h].map((c) => (c || "").trim().toLowerCase()), f = (re, d) => { const i = H.findIndex((c) => re.test(c)); return i >= 0 ? i : d; };
  const C = { sk: f(/^skenario/, 0), pt: f(/^pertemuan/, 1), tg: f(/^tanggal/, 2), jm: f(/^jam/, 3), kl: f(/kelompok/, 4), tu: f(/^tutor/, 5), rg: f(/^ruang/, 6) };
  const g = (r, i) => (r[i] || "").replace(/\u200b/g, "").replace(/\s+/g, " ").trim(), cur = { sk: "", pt: "", tg: "", jm: "" }, items = [];
  for (const r of rows.slice(h + 1)) {
    let tg = g(r, C.tg); if (/^\d{5}(\.\d+)?$/.test(tg)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+tg) * 864e5); tg = `${DAYN[d.getUTCDay()]}, ${d.getUTCDate()} ${MONN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
    if (tg) { cur.tg = tg; cur.jm = ""; }
    for (const k of ["sk", "pt", "jm"]) { const v = g(r, C[k]); if (v) cur[k] = v; }
    const kel = g(r, C.kl), tutor = fixName(g(r, C.tu));
    if (!kel && !tutor) continue;
    items.push({ sk: cur.sk, pt: cur.pt, tgl: cur.tg, iso: (parseTgl(cur.tg) || {}).iso || "", jam: cur.jm, kel: /^\d+(\.0+)?$/.test(kel) ? Math.round(+kel) : kel, tutor, ruang: g(r, C.rg) });
  }
  return items;
}
async function tutorBook(env) {
  const id = env.TUTOR_SHEET_ID || TUTOR_ID;
  const urls = [`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, env.DRIVE_API_KEY && `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true&key=${env.DRIVE_API_KEY}`, `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`].filter(Boolean);
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: UA, redirect: "follow" }); if (!r.ok) continue;
      const b = await r.arrayBuffer(), h = new Uint8Array(b, 0, 2);
      if (h[0] === 0x50 && h[1] === 0x4b) { const sh = await xlsxSheets(b), tabs = sh.map((s) => ({ n: s.n, items: tutorItems(s.rows) })).filter((t) => t.items.length); if (tabs.length) return { tabs }; }
    } catch {}
  }
  return null;
}

// ===== KONTAK DOKTER (terhubung ke Google Sheets via Apps Script) ================
const DOKTER_URL = "https://script.google.com/macros/s/AKfycbyTdyhwjAF40-GUb8G1gnVaHGYJXbnj2kOvyllDDnOeUDbj5MomF57CHSpYpjXoi7p7/exec";
const dkCall = async (env, b) => {
  const r = await fetch(env.DOKTER_URL || DOKTER_URL, { method: "POST", redirect: "follow", headers: { "content-type": "text/plain" }, body: JSON.stringify({ secret: env.DOKTER_SECRET, ...b }) });
  return r.json();
};
const dkDigits = (s) => String(s || "").replace(/\D/g, "").slice(0, 16);
async function dokter(env, a, path, M, body) {
  if (!env.DOKTER_SECRET) return J({ err: "DOKTER_SECRET belum diatur di Cloudflare." }, 500);
  try {
    if (path === "dokter" && M === "GET") {
      const l = await cached("dokter/list", 30, async () => { const r = await dkCall(env, { act: "list" }); return Array.isArray(r) ? r : null; });
      return l ? J(l) : J({ err: "Daftar dokter tidak bisa dimuat." }, 502);
    }
    if (path === "dokter/ajukan" && M === "POST") {
      const tipe = body.tipe === "edit" ? "edit" : body.tipe === "hapus" ? "hapus" : "baru", n = String(body.n || "").trim().slice(0, 200), h1 = dkDigits(body.h1);
      if (tipe === "hapus") { if (!body.id) return J({ err: "Dokter tidak dikenali." }, 400); }
      else if (!n || !h1) return J({ err: "Nama dan Nomor HP 1 wajib diisi." }, 400);
      const r = await dkCall(env, { act: "submit", tipe, id: String(body.id || "").slice(0, 20), n, h1, h2: dkDigits(body.h2), cat: String(body.cat || "").slice(0, 300), oleh: a.u });
      return r.ok ? J({ ok: 1 }) : J({ err: "Gagal mengirim." }, 502);
    }
    if (!a.admin) return J({ err: "Khusus admin." }, 403);
    if (path === "dokter/kelola" && M === "POST") { // admin: tambah / ubah / hapus langsung, tanpa pengajuan
      const aksi = String(body.aksi || ""), id = String(body.id || "").slice(0, 20), n = String(body.n || "").trim().slice(0, 200), h1 = dkDigits(body.h1), h2 = dkDigits(body.h2);
      let r;
      if (aksi === "hapus") { if (!id) return J({ err: "Dokter tidak dikenali." }, 400); r = await dkCall(env, { act: "delete", id }); }
      else if (aksi === "tambah" || aksi === "ubah") {
        if (!n || !h1) return J({ err: "Nama dan Nomor HP 1 wajib diisi." }, 400);
        if (aksi === "ubah" && !id) return J({ err: "Dokter tidak dikenali." }, 400);
        r = await dkCall(env, aksi === "tambah" ? { act: "add", n, h1, h2 } : { act: "update", id, n, h1, h2 });
      } else return J({ err: "Aksi tidak dikenal." }, 400);
      try { await caches.default.delete(new Request("https://cache.local/dokter/list")); } catch {}
      return J(r, r.err ? 400 : 200);
    }
    if (path === "dokter/pengajuan" && M === "GET") { const r = await dkCall(env, { act: "pending" }); return Array.isArray(r) ? J(r) : J({ err: "Gagal memuat." }, 502); }
    if (path === "dokter/review" && M === "POST") {
      const r = await dkCall(env, { act: "review", id: String(body.id || ""), aksi: body.aksi === "acc" ? "acc" : "tolak", n: String(body.n || "").slice(0, 200), h1: dkDigits(body.h1), h2: dkDigits(body.h2) });
      try { await caches.default.delete(new Request("https://cache.local/dokter/list")); } catch {}
      return J(r, r.err ? 400 : 200);
    }
  } catch { return J({ err: "Gagal terhubung ke spreadsheet." }, 502); }
  return J({ err: "not found" }, 404);
}
