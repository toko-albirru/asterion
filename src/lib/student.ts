// Aturan verifikasi mahasiswa. Murni (tanpa jaringan/database) supaya mudah dites.
// PENTING: OCR dan pemeriksaan gambar hanya memberi sinyal. Keduanya BUKAN bukti keaslian KTM
// maupun status mahasiswa aktif. Persetujuan otomatis hanya bila semua sinyal selaras; selain itu ke admin.

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected" | "expired";
export const VERIFICATION_VALID_MONTHS = 12;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_HOUR = 5;
/** Dokumen KTM/KRS dihapus sekian hari setelah pengajuan diputuskan. */
export const DOC_RETENTION_DAYS = 10;
/** Pengajuan yang masuk antrean admin diperiksa paling lama sekian jam. */
export const REVIEW_SLA_HOURS = 24;
/** Verifikasi yang tinggal sekian hari lagi berakhir boleh diperbarui lebih awal. */
export const RENEW_WINDOW_DAYS = 30;
export const OTP_VERIFIED_WINDOW_MINUTES = 30;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;

// ---------------------------------------------------------------------------
// Email kampus
// ---------------------------------------------------------------------------
const STAFF_LABELS = new Set(["staff", "staf", "dosen", "pegawai", "karyawan", "lecturer", "lecturers", "faculty", "employee", "employees", "tendik", "pengajar", "admin", "alumni"]);
const STUDENT_LABELS = new Set(["student", "students", "mahasiswa", "mhs", "mhsw", "stu", "siswa"]);
const STAFF_LOCAL = /(^|[._-])(dosen|staff|staf|pegawai|karyawan|tendik|alumni)([._-]|$)/;

export type DomainRules = { allow: readonly string[]; block: readonly string[] };
export type EmailCheck =
  | { ok: true; signal: "strong" | "weak"; campusDomain: string; email: string }
  | { ok: false; reason: string };

function suffixMatch(domain: string, rule: string): boolean {
  return domain === rule || domain.endsWith("." + rule);
}

/** Periksa email kampus untuk OTP: harus .ac.id (atau domain yang diizinkan admin) dan bukan akun staf/dosen/alumni. */
export function classifyStudentEmail(raw: string, rules: DomainRules = { allow: [], block: [] }): EmailCheck {
  const email = raw.trim().toLowerCase();
  const m = /^([a-z0-9._%+-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/.exec(email);
  if (!m) return { ok: false, reason: "Format email tidak valid." };
  const local = m[1]!;
  const domain = m[2]!;
  const labels = domain.split(".");
  const staffMsg = "Email staf/dosen/alumni tidak dapat dipakai untuk verifikasi mahasiswa. Gunakan email mahasiswa.";

  if (rules.block.some((b) => suffixMatch(domain, b.toLowerCase()))) return { ok: false, reason: staffMsg };
  if (labels.some((l) => STAFF_LABELS.has(l)) || STAFF_LOCAL.test(local)) return { ok: false, reason: staffMsg };

  const allowed = rules.allow.some((a) => suffixMatch(domain, a.toLowerCase()));
  const acId = domain === "ac.id" || domain.endsWith(".ac.id");
  if (!allowed && !acId) return { ok: false, reason: "Gunakan email kampus (berakhiran .ac.id)." };

  const strong = allowed || labels.some((l) => STUDENT_LABELS.has(l));
  return { ok: true, signal: strong ? "strong" : "weak", campusDomain: campusDomain(domain), email };
}

/** Domain induk kampus: mhs.uns.ac.id -> uns.ac.id. Dipakai sebagai lingkup identitas NIM. */
export function campusDomain(domain: string): string {
  const labels = domain.toLowerCase().split(".");
  const ac = labels.lastIndexOf("ac");
  if (ac >= 1 && labels[ac + 1] === "id") return labels.slice(ac - 1).join(".");
  return STUDENT_LABELS.has(labels[0] ?? "") ? labels.slice(1).join(".") : labels.join(".");
}

// ---------------------------------------------------------------------------
// NIM, nama, identitas
// ---------------------------------------------------------------------------
export function normalizeNim(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isPlausibleNim(nim: string): boolean {
  return /^[A-Z0-9]{5,20}$/.test(nim) && (nim.match(/\d/g)?.length ?? 0) >= 5;
}

export function normalizeName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Kemiripan nama 0..1 (1 = sama). Toleran terhadap salah baca OCR kecil. */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Identitas = NIM di lingkup kampus yang sama (NIM bisa kembar antarkampus). Disimpan hanya sebagai HMAC. */
export function identityKey(campus: string, nim: string): string {
  return `${campus.toLowerCase()}:${normalizeNim(nim)}`;
}

// ---------------------------------------------------------------------------
// OTP email kampus
// ---------------------------------------------------------------------------
export function generateOtp(random: (n: number) => Uint8Array = defaultRandom): string {
  let n = 0;
  for (;;) {
    const b = random(4);
    n = ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
    if (n < 4_000_000_000) break; // buang ekor distribusi agar seragam (4e9 = 4000 x 1e6)
  }
  return String(n % 1_000_000).padStart(6, "0");
}

function defaultRandom(n: number) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export const isOtpFormat = (v: unknown): v is string => typeof v === "string" && /^\d{6}$/.test(v);

// ---------------------------------------------------------------------------
// Pembacaan teks KTM (hasil Tesseract.js). Heuristik; hasilnya SELALU dikonfirmasi pengguna.
// ---------------------------------------------------------------------------
export type ParsedKtm = {
  nim?: string;
  name?: string;
  university?: string;
  faculty?: string;
  studyProgram?: string;
  entryYear?: number;
  validUntilYear?: number;
};

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s:;.\-|_]+|[\s:;|_]+$/g, "").trim();

export function parseKtmText(text: string): ParsedKtm {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedKtm = {};

  const labelValue = (label: RegExp): string | undefined => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const same = new RegExp(`^${label.source}\\s*[:\\-=]\\s*(.+)$`, "i").exec(line);
      if (same?.[1]) return clean(same[1]);
      if (new RegExp(`^${label.source}\\s*[:\\-=]?$`, "i").test(line) && lines[i + 1]) return clean(lines[i + 1]!);
    }
    return undefined;
  };

  let nim = labelValue(/(?:NIM|N\.?I\.?M\.?|NPM|No\.?\s*Mahasiswa|Nomor\s*Induk\s*Mahasiswa)/);
  if (nim) nim = normalizeNim(nim.split(/\s/)[0]!);
  if (!nim || !isPlausibleNim(nim)) nim = normalizeNim(lines.find((l) => /^\d{8,15}$/.test(l)) ?? "");
  if (nim && isPlausibleNim(nim)) out.nim = nim;

  const name = labelValue(/(?:Nama(?:\s*Mahasiswa)?|Name)/);
  if (name && /[a-z]{2}/i.test(name)) out.name = name;

  const uni = lines.find((l) => /(universitas|university|institut|politeknik|sekolah\s*tinggi|akademi)/i.test(l) && !/^(nama|nim|npm)\b/i.test(l));
  if (uni) out.university = clean(uni).slice(0, 100);

  const fac = labelValue(/Fakultas/);
  if (fac) out.faculty = fac.slice(0, 100);
  else {
    const l = lines.find((x) => /^fakultas\s+\S+/i.test(x));
    if (l) out.faculty = clean(l.replace(/^fakultas\s+/i, "")).slice(0, 100);
  }

  const prodi = labelValue(/(?:Program\s*Studi|Prodi|Jurusan)/);
  if (prodi) out.studyProgram = prodi.slice(0, 100);

  const entry = /(?:tahun\s*masuk|angkatan|th\.?\s*masuk)\s*[:\-=]?\s*((?:19|20)\d{2})(?!\d)/i.exec(text);
  if (entry?.[1]) out.entryYear = Number(entry[1]);

  const valid = /(?:berlaku|valid)[^\n]*?((?:19|20)\d{2})(?!\d)/i.exec(text);
  if (valid?.[1]) out.validUntilYear = Number(valid[1]);

  return out;
}

// ---------------------------------------------------------------------------
// Kualitas gambar (nilai dari OpenCV.js di browser; diperiksa ulang ambangnya di server)
// ---------------------------------------------------------------------------
export type ImageMetrics = { width: number; height: number; sharpness: number; brightness: number };
export const QUALITY = { minShortSide: 480, minLongSide: 800, minSharpness: 60, minBrightness: 50, maxBrightness: 215 } as const;

export function assessImageQuality(m: ImageMetrics): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const nums = [m.width, m.height, m.sharpness, m.brightness];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) return { ok: false, issues: ["Data kualitas gambar tidak valid."] };
  if (Math.min(m.width, m.height) < QUALITY.minShortSide || Math.max(m.width, m.height) < QUALITY.minLongSide) issues.push("Resolusi terlalu kecil. Foto lebih dekat atau gunakan kamera yang lebih baik.");
  if (m.sharpness < QUALITY.minSharpness) issues.push("Gambar buram. Foto ulang dengan fokus yang jelas.");
  if (m.brightness < QUALITY.minBrightness) issues.push("Gambar terlalu gelap.");
  if (m.brightness > QUALITY.maxBrightness) issues.push("Gambar terlalu terang/silau.");
  return { ok: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Keputusan: setujui otomatis atau teruskan ke admin
// ---------------------------------------------------------------------------
export type DecisionInput = {
  otpVerified: boolean;
  email: EmailCheck | null;
  confirmed: { nim: string; name: string; university: string };
  ocr: ParsedKtm;
  quality: { ok: boolean } | "pdf" | null;
  nimUsedByOtherAccount: boolean;
  now: Date;
};
export type Decision = { decision: "auto_approve" | "manual_review"; score: number; flags: string[] };

export function decideVerification(i: DecisionInput): Decision {
  const flags: string[] = [];
  let score = 0;
  const nim = normalizeNim(i.confirmed.nim);

  if (i.otpVerified) score += 30;
  else flags.push("otp_belum_terverifikasi");

  const emailOk = i.email?.ok === true;
  const nimInLocal = emailOk && i.email && i.email.ok ? i.email.email.split("@")[0]!.replace(/[^a-z0-9]/g, "").includes(nim.toLowerCase()) : false;
  if (!emailOk) flags.push("email_bukan_mahasiswa");
  else if (i.email && i.email.ok && i.email.signal === "strong") score += 15;
  else if (nimInLocal) score += 10;
  else flags.push("email_tidak_menunjukkan_mahasiswa");

  if (!i.ocr.nim || !i.ocr.name || !i.ocr.university) flags.push("ocr_tidak_lengkap");
  if (i.ocr.nim && normalizeNim(i.ocr.nim) === nim) score += 20;
  else flags.push("nim_tidak_cocok_dengan_ocr");

  const sim = i.ocr.name ? nameSimilarity(i.ocr.name, i.confirmed.name) : 0;
  if (sim >= 0.8) score += Math.round(15 * sim);
  else flags.push("nama_tidak_cocok_dengan_ocr");

  if (i.ocr.university && i.confirmed.university && nameSimilarity(i.ocr.university, i.confirmed.university) >= 0.7) score += 5;
  else flags.push("universitas_tidak_cocok");

  if (i.quality === "pdf") flags.push("pdf_tidak_dianalisis");
  else if (i.quality && i.quality.ok) score += 10;
  else flags.push("kualitas_gambar_rendah");

  const yr = i.ocr.validUntilYear;
  if (yr !== undefined && Date.UTC(yr, 11, 31, 23, 59, 59) < i.now.getTime()) flags.push("ktm_kedaluwarsa");
  else score += 5;

  if (i.nimUsedByOtherAccount) flags.push("nim_dipakai_akun_lain");

  return { decision: flags.length === 0 ? "auto_approve" : "manual_review", score: Math.min(100, score), flags };
}

/** Masa berlaku verifikasi: 1 tahun, tapi tidak melewati akhir tahun berlaku KTM bila tercantum. */
export function verificationExpiry(approvedAt: Date, ktmValidUntilYear?: number): Date {
  const d = new Date(approvedAt.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + VERIFICATION_VALID_MONTHS / 12);
  if (ktmValidUntilYear !== undefined) {
    const cap = new Date(Date.UTC(ktmValidUntilYear, 11, 31, 23, 59, 59));
    if (cap > approvedAt && cap < d) return cap;
  }
  return d;
}

/** Status efektif: baris "verified" yang sudah lewat masa berlaku dianggap expired. */
export function effectiveStatus(row: { status: string; expires_at: string | null } | null, now: Date): VerificationStatus {
  if (!row) return "unverified";
  if (row.status === "verified" && row.expires_at && new Date(row.expires_at) <= now) return "expired";
  return row.status as VerificationStatus;
}
