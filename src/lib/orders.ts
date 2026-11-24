// Pesanan Premium (murni, tanpa jaringan/database): validasi permintaan, rincian harga, aturan pengingat.
import {
  INSTITUTION_BASE_PRICE_IDR,
  INSTITUTION_MAX_USERS,
  MONTHLY_PRICE_IDR,
  RENEWAL_REMINDER_DAYS,
  STUDENT_MONTHLY_PRICE_IDR,
  institutionAmount,
  institutionDiscountPct,
  isSubscriptionPlan,
  isValidInstitutionUsers,
  isValidMonths,
  subscriptionAmount,
  type PlanKind,
} from "@/lib/plans";

export type OrderRequest =
  | { kind: "subscription"; plan: "individual" | "student"; months: number }
  | { kind: "institution"; institutionName: string; users: number; emailDomains: string[] };

export const INSTITUTION_NAME_MIN = 2;
export const INSTITUTION_NAME_MAX = 80;
export const MAX_EMAIL_DOMAINS = 10;
export const REJECT_REASON_MIN = 3;
export const REJECT_REASON_MAX = 300;

export function normalizeInstitutionName(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("Nama institusi wajib diisi.");
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
  if (name.length < INSTITUTION_NAME_MIN || name.length > INSTITUTION_NAME_MAX) {
    throw new Error(`Nama institusi ${INSTITUTION_NAME_MIN}-${INSTITUTION_NAME_MAX} karakter (contoh: UNS).`);
  }
  return name;
}

const DOMAIN_RE = /^(?=.{3,100}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

/** Terima array atau teks dipisah koma/spasi/baris: "@staff.uns.ac.id, @student.uns.ac.id". Kosong = tanpa batasan domain. */
export function normalizeEmailDomains(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === "") return [];
  const parts = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,;]+/) : null;
  if (!parts) throw new Error("Daftar domain email tidak valid.");
  const out: string[] = [];
  for (const p of parts) {
    if (typeof p !== "string") throw new Error("Daftar domain email tidak valid.");
    const d = p.trim().toLowerCase().replace(/^@+/, "");
    if (!d) continue;
    if (!DOMAIN_RE.test(d)) throw new Error(`Domain email tidak valid: ${d.slice(0, 40)}`);
    if (!out.includes(d)) out.push(d);
  }
  if (out.length > MAX_EMAIL_DOMAINS) throw new Error(`Maksimal ${MAX_EMAIL_DOMAINS} domain email.`);
  return out.sort();
}

export function parseOrderRequest(raw: unknown): OrderRequest {
  if (typeof raw !== "object" || raw === null) throw new Error("Permintaan tidak valid.");
  const r = raw as Record<string, unknown>;
  if (r["kind"] === "subscription") {
    if (!isSubscriptionPlan(r["plan"])) throw new Error("Jenis paket tidak valid.");
    if (!isValidMonths(r["months"])) throw new Error("Lama berlangganan tidak valid.");
    return { kind: "subscription", plan: r["plan"], months: r["months"] };
  }
  if (r["kind"] === "institution") {
    if (!isValidInstitutionUsers(r["users"])) throw new Error(`Jumlah pengguna harus bilangan bulat 1-${INSTITUTION_MAX_USERS}.`);
    return {
      kind: "institution",
      institutionName: normalizeInstitutionName(r["institutionName"]),
      users: r["users"],
      emailDomains: normalizeEmailDomains(r["emailDomains"]),
    };
  }
  throw new Error("Permintaan tidak valid.");
}

export type OrderQuote = {
  plan: PlanKind;
  months: number | null;
  users: number | null;
  baseAmount: number;
  discountIdr: number;
  discountPct: number;
  label: string;
  institutionName: string | null;
  emailDomains: string[];
};

/** Semua angka dihitung di sini (server dan UI memakai yang sama); browser hanya mengirim pilihan. */
export function quoteOrder(req: OrderRequest): OrderQuote {
  if (req.kind === "subscription") {
    const base = subscriptionAmount(req.plan, req.months);
    const normal = MONTHLY_PRICE_IDR * req.months;
    return {
      plan: req.plan,
      months: req.months,
      users: null,
      baseAmount: base,
      discountIdr: normal - base,
      discountPct: req.plan === "student" ? Math.round(((MONTHLY_PRICE_IDR - STUDENT_MONTHLY_PRICE_IDR) / MONTHLY_PRICE_IDR) * 100) : 0,
      label: `Premium ${req.plan === "student" ? "Mahasiswa" : "Individu"} ${req.months} bulan`,
      institutionName: null,
      emailDomains: [],
    };
  }
  return {
    plan: "institution",
    months: null,
    users: req.users,
    baseAmount: institutionAmount(req.users),
    discountIdr: INSTITUTION_BASE_PRICE_IDR - institutionAmount(req.users),
    discountPct: institutionDiscountPct(req.users),
    label: `Lisensi Institusi ${req.institutionName} (${req.users} pengguna, 1 tahun)`,
    institutionName: req.institutionName,
    emailDomains: req.emailDomains,
  };
}

/** Sama persis dengan tagihan yang sudah ada? Dipakai agar klik ganda tidak membuat tagihan/kode unik baru. */
export function sameOrder(
  existing: { plan: string | null; months: number | null; label: string | null; base_amount_idr: number | null },
  q: OrderQuote,
): boolean {
  return existing.plan === q.plan && existing.months === q.months && existing.label === q.label && existing.base_amount_idr === q.baseAmount;
}

/** Pengingat perpanjangan: dalam RENEWAL_REMINDER_DAYS hari sebelum berakhir, belum berakhir, dan tidak dibatalkan. */
export function renewalReminderDue(expiresAt: Date, now: Date, cancelledAt: string | null): boolean {
  if (cancelledAt) return false;
  const left = expiresAt.getTime() - now.getTime();
  return left > 0 && left <= RENEWAL_REMINDER_DAYS * 86_400_000;
}

export function parseAdminEmails(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

export function normalizeRejectReason(raw: unknown): string {
  const s = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (s.length < REJECT_REASON_MIN || s.length > REJECT_REASON_MAX) throw new Error(`Alasan penolakan ${REJECT_REASON_MIN}-${REJECT_REASON_MAX} karakter.`);
  return s;
}
