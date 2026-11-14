// Verifikasi UI: Detail Obat harus MENAMPILKAN daftar interaksi, bukan hanya jumlah.
import { chromium } from "/opt/appjet/browser/node_modules/playwright/index.js";

const BASE = process.env.BASE || "http://127.0.0.1:3120";
const DRUG = process.env.DRUG || "1";

const r = await fetch(BASE + "/api/login", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ u: "admin", p: process.env.ADMIN_PW || "adm123" }),
});
const tok = (await r.json()).token;
if (!tok) { console.log("FAIL: login admin gagal"); process.exit(1); }

const b = await chromium.launch({ args: ["--no-sandbox"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.addInitScript((t) => localStorage.setItem("tk", t), tok);
await p.goto(BASE + "/#/farmako/obat/" + DRUG, { waitUntil: "domcontentloaded" });
await p.waitForFunction(() => document.body.innerText.includes("Interaksi Obat"), null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(1500);

const txt = await p.evaluate(() => document.body.innerText);
const sec = (() => { const i = txt.indexOf("Interaksi Obat"); return i < 0 ? "" : txt.slice(i, i + 700); })();

const hasList = /seluruhnya ditampilkan/i.test(txt);
const hasPartner = /ZZ-UJI Beta|ZZ-UJI Gamma/i.test(txt);
const oldCard = /data interaksi terpublikasi/i.test(txt);
console.log("---- bagian Interaksi Obat ----");
console.log(sec.replace(/\n{2,}/g, "\n").slice(0, 700));
console.log("---- hasil ----");
console.log("penanda daftar inline (seluruhnya ditampilkan):", hasList);
console.log("nama obat pasangan tercetak:", hasPartner);
console.log("kartu lama ('data interaksi terpublikasi'):", oldCard);
await b.close();
if (!hasList || !hasPartner) { console.log("FAIL: daftar interaksi tidak dirender"); process.exit(1); }
console.log("PASS: Detail Obat menampilkan seluruh interaksi secara inline");
