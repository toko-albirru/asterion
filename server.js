// ASTERION — adapter Node untuk Worker (src/worker.js).
// Worker aslinya berjalan di Cloudflare (workerd + D1 + KV + R2).
// Adapter ini menyediakan binding yang sama di atas Node + SQLite sehingga
// aplikasi bisa dijalankan di image Node biasa (tanpa workerd/glibc).
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "asterion.sqlite");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

fs.mkdirSync(DATA_DIR, { recursive: true });

const sql = new DatabaseSync(DB_FILE);
sql.exec("PRAGMA journal_mode = WAL");
sql.exec("PRAGMA busy_timeout = 5000");
sql.exec("PRAGMA foreign_keys = ON");

const num = (v) => (typeof v === "bigint" ? Number(v) : v);

// ---------- shim D1 (Cloudflare D1 API di atas node:sqlite) ----------
class D1Statement {
  constructor(sqlText, args = []) {
    this.sql = sqlText;
    this.args = args;
  }
  bind(...args) {
    return new D1Statement(this.sql, args);
  }
  _all() {
    const st = sql.prepare(this.sql);
    const rows = st.all(...this.args);
    return rows.map((r) => {
      const o = {};
      for (const k of Object.keys(r)) o[k] = num(r[k]);
      return o;
    });
  }
  async all() {
    return { results: this._all(), success: true, meta: {} };
  }
  async first(col) {
    const r = this._all()[0];
    if (!r) return null;
    return col ? (r[col] ?? null) : r;
  }
  async run() {
    const r = sql.prepare(this.sql).run(...this.args);
    return {
      success: true,
      results: [],
      meta: { changes: num(r.changes) || 0, last_row_id: num(r.lastInsertRowid) || 0, duration: 0 },
    };
  }
  async raw() {
    const st = sql.prepare(this.sql);
    return st.all(...this.args).map((r) => Object.values(r));
  }
}

class D1 {
  prepare(sqlText) {
    return new D1Statement(String(sqlText));
  }
  async batch(statements) {
    const list = Array.isArray(statements) ? statements : [];
    sql.exec("BEGIN");
    try {
      const out = [];
      for (const st of list) out.push(await st.run());
      sql.exec("COMMIT");
      return out;
    } catch (e) {
      try { sql.exec("ROLLBACK"); } catch {}
      throw e;
    }
  }
  async exec(q) {
    sql.exec(String(q));
    return { count: 0, duration: 0 };
  }
  async dump() {
    throw new Error("dump tidak didukung");
  }
}

// ---------- shim KV (LINKS) ----------
const KV_DDL = `CREATE TABLE IF NOT EXISTS kv_store (
  name TEXT PRIMARY KEY,
  val TEXT NOT NULL,
  bin INTEGER NOT NULL DEFAULT 0,
  meta TEXT,
  exp INTEGER
)`;

class KV {
  constructor() {
    sql.exec(KV_DDL);
  }
  _row(key) {
    const r = sql.prepare("SELECT name, val, bin, meta, exp FROM kv_store WHERE name = ?").get(String(key));
    if (!r) return null;
    if (r.exp && Number(r.exp) < Date.now()) {
      sql.prepare("DELETE FROM kv_store WHERE name = ?").run(String(key));
      return null;
    }
    return r;
  }
  _out(r, type) {
    if (!r) return null;
    if (type === "json") {
      try { return JSON.parse(r.val); } catch { return null; }
    }
    if (type === "arrayBuffer") {
      const buf = r.bin ? Buffer.from(r.val, "base64") : Buffer.from(r.val, "utf8");
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    if (type === "stream") {
      const buf = r.bin ? Buffer.from(r.val, "base64") : Buffer.from(r.val, "utf8");
      return new Response(buf).body;
    }
    return r.val;
  }
  async get(key, type) {
    return this._out(this._row(key), type);
  }
  async getWithMetadata(key, type) {
    const r = this._row(key);
    let metadata = null;
    if (r && r.meta) { try { metadata = JSON.parse(r.meta); } catch { metadata = null; } }
    return { value: this._out(r, type), metadata, cacheStatus: null };
  }
  async put(key, value, opts = {}) {
    let val = "";
    let bin = 0;
    if (typeof value === "string") val = value;
    else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      val = Buffer.from(value instanceof ArrayBuffer ? new Uint8Array(value) : value).toString("base64");
      bin = 1;
    } else if (value && typeof value === "object" && typeof value.getReader === "function") {
      val = Buffer.from(await new Response(value).arrayBuffer()).toString("base64");
      bin = 1;
    } else val = String(value ?? "");
    let exp = null;
    if (opts.expiration) exp = Number(opts.expiration) * 1000;
    else if (opts.expirationTtl) exp = Date.now() + Number(opts.expirationTtl) * 1000;
    const meta = opts.metadata ? JSON.stringify(opts.metadata) : null;
    sql.prepare(
      "INSERT INTO kv_store (name, val, bin, meta, exp) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(name) DO UPDATE SET val = excluded.val, bin = excluded.bin, meta = excluded.meta, exp = excluded.exp"
    ).run(String(key), val, bin, meta, exp);
  }
  async delete(key) {
    sql.prepare("DELETE FROM kv_store WHERE name = ?").run(String(key));
  }
  async list(opts = {}) {
    const prefix = String(opts.prefix || "");
    const limit = Math.min(Number(opts.limit) || 1000, 1000);
    const offset = Math.max(Number(opts.cursor) || 0, 0);
    const now = Date.now();
    const rows = sql
      .prepare("SELECT name, meta, exp FROM kv_store WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT ? OFFSET ?")
      .all(prefix.replace(/[%_\\]/g, (c) => "\\" + c) + "%", limit + 1, offset);
    const live = rows.filter((r) => !r.exp || Number(r.exp) > now);
    const page = live.slice(0, limit);
    const keys = page.map((r) => {
      let metadata = null;
      if (r.meta) { try { metadata = JSON.parse(r.meta); } catch {} }
      return { name: r.name, metadata, expiration: r.exp ? Number(r.exp) / 1000 : undefined };
    });
    const more = live.length > limit || rows.length > limit;
    return { keys, list_complete: !more, cursor: more ? String(offset + limit) : undefined };
  }
}

// ---------- shim ASSETS (file statis ./public) ----------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function resolveAsset(pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { rel = pathname; }
  if (rel.endsWith("/")) rel += "index.html";
  const full = path.resolve(PUBLIC_DIR, "." + rel);
  if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR + path.sep)) return null;
  return full;
}

const ASSETS = {
  async fetch(request) {
    const url = new URL(request.url);
    let file = resolveAsset(url.pathname);
    if (!file) return new Response("Not found", { status: 404 });
    let stat = await fsp.stat(file).catch(() => null);
    if (stat && stat.isDirectory()) {
      file = path.join(file, "index.html");
      stat = await fsp.stat(file).catch(() => null);
    }
    if (!stat && !path.extname(file)) {
      file = path.join(PUBLIC_DIR, "index.html");
      stat = await fsp.stat(file).catch(() => null);
    }
    if (!stat) return new Response("Not found", { status: 404 });
    const body = request.method === "HEAD" ? null : await fsp.readFile(file);
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    const headers = { "content-type": type, "x-content-type-options": "nosniff" };
    if (path.basename(file) === "index.html") headers["cache-control"] = "no-cache";
    else if (file.endsWith(".js") || file.endsWith(".css")) headers["cache-control"] = "public, max-age=60";
    return new Response(body, { status: 200, headers });
  },
};

// ---------- shim Cache API (caches.default) ----------
const cacheStore = new Map();
globalThis.caches = {
  default: {
    async match(req) {
      const key = typeof req === "string" ? req : req.url;
      const e = cacheStore.get(key);
      if (!e) return undefined;
      if (e.exp && e.exp < Date.now()) { cacheStore.delete(key); return undefined; }
      return new Response(e.body, { status: 200, headers: e.headers });
    },
    async put(req, res) {
      const key = typeof req === "string" ? req : req.url;
      const cc = res.headers.get("cache-control") || "";
      const m = /max-age=(\d+)/.exec(cc);
      const body = await res.clone().text();
      const headers = {};
      res.headers.forEach((v, k) => { if (k !== "cache-control") headers[k] = v; });
      cacheStore.set(key, { body, headers, exp: m ? Date.now() + Number(m[1]) * 1000 : 0 });
    },
    async delete(req) {
      const key = typeof req === "string" ? req : req.url;
      return cacheStore.delete(key);
    },
  },
};

// ---------- migrasi SQL (idempoten; DDL utama juga dibuat worker) ----------
async function migrate() {
  const dir = path.join(ROOT, "migrations");
  const files = await fsp.readdir(dir).catch(() => []);
  for (const f of files.filter((n) => n.endsWith(".sql")).sort()) {
    const text = await fsp.readFile(path.join(dir, f), "utf8");
    try {
      sql.exec(text);
    } catch (e) {
      // migrasi wrangler bisa mengandung pernyataan yang sudah ada; worker
      // membuat ulang tabel yang dibutuhkannya dengan IF NOT EXISTS.
      console.warn("[migrate]", f, String(e.message || e));
    }
  }
}

const { default: worker } = await import("./src/worker.js");
await migrate();

const env = { ...process.env, DB: new D1(), LINKS: new KV(), ASSETS };
// Pengganti Cron Trigger untuk Docker/Node: aktifkan dengan FARMAKO_CRON_MIN=30 (menit). Tanpa variabel ini tidak ada yang berjalan.
if (Number(process.env.FARMAKO_CRON_MIN) > 0 && worker.scheduled) setInterval(() => worker.scheduled({}, env, { waitUntil: (p) => p }), Number(process.env.FARMAKO_CRON_MIN) * 60000);

async function handle(req, res) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || `localhost:${PORT}`;
  const url = new URL(req.url, `${proto}://${host}`);
  const method = req.method || "GET";
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else headers.set(k, v);
  }
  let request;
  if (method === "GET" || method === "HEAD") {
    request = new Request(url, { method, headers });
  } else {
    request = new Request(url, { method, headers, body: Readable.toWeb(req), duplex: "half" });
  }
  let response;
  try {
    response = await worker.fetch(request, env);
  } catch (e) {
    console.error("[worker]", e && e.stack ? e.stack : e);
    response = new Response(JSON.stringify({ err: "server error" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  if (!response) response = new Response("", { status: 204 });
  const out = {};
  response.headers.forEach((v, k) => { out[k] = v; });
  const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : null;
  if (setCookie && setCookie.length) out["set-cookie"] = setCookie;
  const buf = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, out);
  res.end(method === "HEAD" ? undefined : buf);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error("[server]", e && e.stack ? e.stack : e);
    try {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("server error");
    } catch {}
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ASTERION siap di http://${HOST}:${PORT} (db: ${DB_FILE})`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    server.close(() => {
      try { sql.close(); } catch {}
      process.exit(0);
    });
  });
}
