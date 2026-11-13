// Menghasilkan migrations/0003_farmakologi.sql dari FM_DDL (satu sumber kebenaran di src/farmako.js).
import { FM_DDL } from "../src/farmako.js";
import fs from "node:fs";
const head = "-- ASTERION — PHARMACOLOGY SESSION (D1, binding: DB). Dibuat otomatis dari src/farmako.js (FM_DDL).\n-- Aman dijalankan berulang (IF NOT EXISTS). Tidak menyentuh tabel lama. Worker juga menjalankan DDL yang sama saat API pertama dipanggil.\n";
fs.writeFileSync(new URL("../migrations/0003_farmakologi.sql", import.meta.url), head + FM_DDL.join(";\n") + ";\n");
console.log("ok", FM_DDL.length, "pernyataan");
