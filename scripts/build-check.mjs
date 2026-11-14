#!/usr/bin/env node
/**
 * Build check untuk Cloudflare Workers Builds (`npm run build`).
 *
 * Cloudflare menjalankan `npm run build` sebelum `wrangler deploy`. Script ini
 * memastikan bundel worker memang bisa dibentuk: konfigurasi wrangler valid,
 * entry point ada, sintaks semua modul src/ benar, dan direktori aset siap.
 * Tidak memerlukan wrangler maupun Node >= 22, jadi build tidak gagal hanya
 * karena versi Node di build image.
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const ok = [];

function fail(msg) {
  problems.push(msg);
}

/** Buang komentar // dan /* *\/ di luar string agar JSONC bisa di-parse. */
function stripJsonc(src) {
  let out = "";
  let inStr = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === "*" && n === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += n ?? "";
        i++;
      } else if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      continue;
    }
    if (c === "/" && n === "/") {
      inLine = true;
      i++;
      continue;
    }
    if (c === "/" && n === "*") {
      inBlock = true;
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

// 1. Konfigurasi wrangler
const configPath = join(root, "wrangler.jsonc");
let config = null;
if (!existsSync(configPath)) {
  fail("wrangler.jsonc tidak ditemukan");
} else {
  try {
    config = JSON.parse(stripJsonc(readFileSync(configPath, "utf8")));
    ok.push("wrangler.jsonc valid");
  } catch (err) {
    fail(`wrangler.jsonc bukan JSON yang valid: ${err.message}`);
  }
}

// 2. Entry point worker
const main = config?.main ?? "src/worker.js";
const mainPath = join(root, main);
if (!existsSync(mainPath)) {
  fail(`entry point worker tidak ditemukan: ${main}`);
} else {
  ok.push(`entry point ${main} ada`);
}

// 3. Sintaks semua modul worker (ESM, tanpa menjalankan kode)
const srcDir = join(root, "src");
if (!existsSync(srcDir)) {
  fail("direktori src/ tidak ditemukan");
} else {
  for (const name of readdirSync(srcDir).filter((f) => f.endsWith(".js") || f.endsWith(".mjs"))) {
    const file = join(srcDir, name);
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch (err) {
      const detail = (err.stderr?.toString() || err.message || "").trim().split("\n")[0];
      fail(`sintaks ${name} tidak valid: ${detail}`);
    }
  }
  ok.push(`sintaks ${readdirSync(srcDir).filter((f) => /\.(m?js)$/.test(f)).length} modul src/ diperiksa`);
}

// 4. Aset statis
const assetsDir = join(root, config?.assets?.directory ?? "public");
if (!existsSync(assetsDir) || !statSync(assetsDir).isDirectory()) {
  fail(`direktori aset tidak ditemukan: ${config?.assets?.directory ?? "public"}`);
} else if (!existsSync(join(assetsDir, "index.html"))) {
  fail("index.html tidak ada di direktori aset");
} else {
  ok.push("direktori aset siap");
}

// 5. Binding yang dipakai kode harus terdaftar di konfigurasi
if (config) {
  const declared = new Set([
    ...(config.kv_namespaces ?? []).map((b) => b.binding),
    ...(config.d1_databases ?? []).map((b) => b.binding),
    ...(config.r2_buckets ?? []).map((b) => b.binding),
    ...(config.ai ? [config.ai.binding ?? "AI"] : []),
    ...(config.assets?.binding ? [config.assets.binding] : []),
  ]);
  if (existsSync(mainPath)) {
    const code = readFileSync(mainPath, "utf8");
    for (const used of ["DB", "LINKS", "AI", "ASSETS"]) {
      if (new RegExp(`env\\.${used}\\b`).test(code) && !declared.has(used)) {
        fail(`binding env.${used} dipakai kode tapi tidak dideklarasikan di wrangler.jsonc`);
      }
    }
    ok.push(`binding terdeklarasi: ${[...declared].join(", ") || "(tidak ada)"}`);
  }
}

if (problems.length) {
  console.error("\nBUILD GAGAL:");
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}

console.log("Build check lulus:");
for (const line of ok) console.log(` - ${line}`);
