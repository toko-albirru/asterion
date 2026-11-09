/* Regresi komponen dialog kustom (Dlg) + kontras toast mode terang.
   Menjalankan server statis public/ lalu menguji lewat Chromium. */
const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("/opt/appjet/browser/node_modules/playwright");

const PORT = 8123;
const BASE = "http://127.0.0.1:" + PORT + "/index.html";
const root = path.resolve(__dirname, "..");

function fail(m) { console.error("FAIL: " + m); process.exitCode = 1; }
function ok(m) { console.log("OK: " + m); }

(async () => {
  const srv = spawn("python3", ["-m", "http.server", String(PORT), "--directory", "public"], { cwd: root, stdio: "ignore" });
  const stop = () => { try { srv.kill("SIGKILL"); } catch (e) {} };
  try {
    await new Promise(r => setTimeout(r, 900));
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = [];
    page.on("pageerror", e => errs.push(String(e)));
    await page.goto(BASE, { waitUntil: "load" });

    // 1. Komponen tersedia
    const has = await page.evaluate(() => typeof window.Dlg === "object" && ["alert", "confirm", "prompt"].every(k => typeof window.Dlg[k] === "function"));
    has ? ok("Dlg tersedia dengan alert/confirm/prompt") : fail("Dlg tidak tersedia");

    // 2. confirm -> OK mengembalikan true, judul & pesan tampil
    await page.evaluate(() => { window.__r = null; Dlg.confirm("Uji dialog kustom", { title: "Konfirmasi uji", icon: "🧪", okText: "Setuju" }).then(v => window.__r = v); });
    await page.waitForSelector("#dlg.on", { timeout: 4000 });
    const title = (await page.textContent("#dlgT")).trim();
    const msg = (await page.textContent("#dlgM")).trim();
    const okTxt = (await page.textContent("#dlgOk")).trim();
    await page.click("#dlgOk");
    await page.waitForFunction(() => window.__r !== null, null, { timeout: 4000 });
    const r1 = await page.evaluate(() => window.__r);
    title === "Konfirmasi uji" && msg === "Uji dialog kustom" && okTxt === "Setuju" ? ok("confirm menampilkan judul/pesan/tombol kustom") : fail("isi dialog salah: " + JSON.stringify({ title, msg, okTxt }));
    r1 === true ? ok("confirm OK -> true") : fail("confirm OK mengembalikan " + JSON.stringify(r1));

    // 3. confirm -> Batal mengembalikan false
    await page.evaluate(() => { window.__r = "x"; Dlg.confirm("Batal uji").then(v => window.__r = v); });
    await page.waitForSelector("#dlg.on", { timeout: 4000 });
    await page.click("#dlgNo");
    await page.waitForFunction(() => window.__r !== "x", null, { timeout: 4000 });
    const r2 = await page.evaluate(() => window.__r);
    r2 === false ? ok("confirm Batal -> false") : fail("confirm Batal mengembalikan " + JSON.stringify(r2));

    // 4. prompt mengembalikan teks yang diketik
    await page.evaluate(() => { window.__r = "x"; Dlg.prompt("Nama baru:", "awal").then(v => window.__r = v); });
    await page.waitForSelector("#dlg.on", { timeout: 4000 });
    const pv = await page.inputValue("#dlgIn");
    await page.fill("#dlgIn", "baru");
    await page.click("#dlgOk");
    await page.waitForFunction(() => window.__r !== "x", null, { timeout: 4000 });
    const r3 = await page.evaluate(() => window.__r);
    pv === "awal" ? ok("prompt mengisi nilai awal") : fail("nilai awal prompt = " + JSON.stringify(pv));
    r3 === "baru" ? ok("prompt -> teks yang diketik") : fail("prompt mengembalikan " + JSON.stringify(r3));

    // 5. Escape menutup dialog prompt tanpa nilai
    await page.evaluate(() => { window.__r = "x"; Dlg.prompt("Esc uji", "").then(v => window.__r = v); });
    await page.waitForSelector("#dlg.on", { timeout: 4000 });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__r !== "x", null, { timeout: 4000 });
    const r4 = await page.evaluate(() => window.__r);
    r4 === null ? ok("Escape -> null (batal)") : fail("Escape mengembalikan " + JSON.stringify(r4));

    // 6. Kontras mode terang: toast & dialog tetap bertulisan terang di latar gelap
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.evaluate(() => toast("Uji toast mode terang"));
    const toastCss = await page.evaluate(() => { const t = document.getElementById("toast"); const s = getComputedStyle(t); return { color: s.color, bg: s.backgroundColor, icon: !!t.querySelector(".ti") }; });
    toastCss.color === "rgb(255, 255, 255)" && toastCss.icon ? ok("toast mode terang: teks putih + ikon") : fail("toast mode terang: " + JSON.stringify(toastCss));

    await page.evaluate(() => { Dlg.confirm("Kontras dialog mode terang"); });
    await page.waitForSelector("#dlg.on", { timeout: 4000 });
    const dlgCss = await page.evaluate(() => { const m = document.getElementById("dlgM"); const s = getComputedStyle(m); return { color: s.color }; });
    dlgCss.color === "rgb(75, 63, 102)" ? ok("dialog mode terang: teks gelap di kartu terang") : fail("dialog mode terang: " + JSON.stringify(dlgCss));
    await page.click("#dlgOk");

    // 7. Tidak ada error JS saat halaman dimuat
    errs.length === 0 ? ok("tidak ada page error") : fail("page error: " + errs.join(" | "));

    await browser.close();
  } finally {
    stop();
  }
  console.log(process.exitCode ? "HASIL: GAGAL" : "HASIL: SEMUA LOLOS");
})().catch(e => { console.error("FAIL:", e.message); process.exitCode = 1; });
