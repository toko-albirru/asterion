// Validasi masukan pengajuan verifikasi mahasiswa (murni). Semua nilai dari browser dianggap tidak tepercaya.
import { isPlausibleNim, normalizeNim, type ImageMetrics } from "@/lib/student";

export type SupportKind = "otp" | "krs" | "surat";
export type SubmitInput = {
  ktmPath: string;
  isPdf: boolean;
  supportKind: SupportKind;
  supportPath: string | null;
  fields: { nim: string; name: string; university: string; faculty: string | null; studyProgram: string | null; entryYear: number | null };
  ocrText: string;
  quality: ImageMetrics | null;
};

export const OCR_TEXT_MAX = 8000;
const FILE_RE = (userId: string) => new RegExp(`^${userId.replace(/[^a-zA-Z0-9-]/g, "")}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|pdf)$`);

const text = (v: unknown, min: number, max: number, label: string): string => {
  const s = typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (s.length < min || s.length > max) throw new Error(`${label} wajib diisi (${min}-${max} karakter).`);
  return s;
};
const optText = (v: unknown, max: number): string | null => {
  if (v === undefined || v === null || v === "") return null;
  return text(v, 1, max, "Data");
};

export function parseSubmitInput(raw: unknown, userId: string, now = new Date()): SubmitInput {
  if (typeof raw !== "object" || raw === null) throw new Error("Permintaan tidak valid.");
  const r = raw as Record<string, unknown>;
  const ok = FILE_RE(userId);

  const ktmPath = typeof r["ktmPath"] === "string" ? r["ktmPath"] : "";
  if (!ok.test(ktmPath)) throw new Error("Berkas KTM tidak valid. Unggah ulang.");

  const supportKind = r["supportKind"];
  if (supportKind !== "otp" && supportKind !== "krs" && supportKind !== "surat") throw new Error("Pilih cara memastikan status mahasiswa aktif.");
  let supportPath: string | null = null;
  if (supportKind !== "otp") {
    supportPath = typeof r["supportPath"] === "string" ? r["supportPath"] : "";
    if (!ok.test(supportPath)) throw new Error(supportKind === "krs" ? "Unggah KRS semester berjalan." : "Unggah surat keterangan mahasiswa aktif.");
    if (supportPath === ktmPath) throw new Error("Berkas pendukung harus berbeda dari KTM.");
  }

  const f = (typeof r["fields"] === "object" && r["fields"] !== null ? r["fields"] : {}) as Record<string, unknown>;
  const nim = normalizeNim(typeof f["nim"] === "string" ? f["nim"] : "");
  if (!isPlausibleNim(nim)) throw new Error("NIM tidak valid (5-20 huruf/angka, minimal 5 angka).");
  let entryYear: number | null = null;
  if (f["entryYear"] !== undefined && f["entryYear"] !== null && f["entryYear"] !== "") {
    const y = Number(f["entryYear"]);
    if (!Number.isInteger(y) || y < 1990 || y > now.getUTCFullYear() + 1) throw new Error("Tahun masuk tidak valid.");
    entryYear = y;
  }

  let quality: ImageMetrics | null = null;
  const q = r["quality"];
  if (typeof q === "object" && q !== null) {
    const m = q as Record<string, unknown>;
    const vals = [m["width"], m["height"], m["sharpness"], m["brightness"]];
    if (vals.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e6)) {
      quality = { width: m["width"] as number, height: m["height"] as number, sharpness: m["sharpness"] as number, brightness: m["brightness"] as number };
    }
  }

  const ocr = typeof r["ocrText"] === "string" ? r["ocrText"].slice(0, OCR_TEXT_MAX) : "";
  return {
    ktmPath,
    isPdf: ktmPath.endsWith(".pdf"), // ditentukan dari berkas, bukan dari klaim browser
    supportKind,
    supportPath,
    fields: {
      nim,
      name: text(f["name"], 3, 100, "Nama"),
      university: text(f["university"], 3, 100, "Universitas"),
      faculty: optText(f["faculty"], 100),
      studyProgram: optText(f["studyProgram"], 100),
      entryYear,
    },
    ocrText: ocr,
    quality,
  };
}
