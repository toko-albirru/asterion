// Unduh OpenCV.js sekali, lalu simpan di public/vendor supaya dilayani dari server sendiri.
// Jalankan: node scripts/fetch-opencv.mjs   (commit berkas hasilnya). Tanpa berkas ini, pemeriksaan kualitas
// gambar tetap jalan memakai perhitungan canvas.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const URL_ = "https://docs.opencv.org/4.10.0/opencv.js";
const OUT = "public/vendor/opencv-4.10.0.js";

const res = await fetch(URL_);
if (!res.ok) throw new Error(`Gagal mengunduh (${res.status}).`);
const buf = Buffer.from(await res.arrayBuffer());
if (buf.length < 1_000_000 || buf.subarray(0, 1).toString() === "<") throw new Error("Berkas yang diunduh bukan opencv.js yang valid.");
await mkdir("public/vendor", { recursive: true });
await writeFile(OUT, buf);
console.log(`Tersimpan: ${OUT} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
console.log(`sha256: ${createHash("sha256").update(buf).digest("hex")}`);
