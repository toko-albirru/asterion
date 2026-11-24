// Paket & harga SEMAR-Dock Premium. Murni (tanpa jaringan/database); dipakai server dan UI
// sehingga angka yang dilihat pembeli = angka yang ditagih. UBAH HARGA DI SINI.

export type PlanKind = "individual" | "student" | "institution";

/** Premium Individu: dosen, peneliti, profesional, umum. */
export const MONTHLY_PRICE_IDR = 50_000;
/** Diskon tetap untuk mahasiswa terverifikasi. */
export const STUDENT_DISCOUNT_PCT = 15;
export const STUDENT_MONTHLY_PRICE_IDR = (MONTHLY_PRICE_IDR * (100 - STUDENT_DISCOUNT_PCT)) / 100; // 42.500

/** Lama berlangganan yang boleh dibeli sekaligus (bulan). */
export const MONTH_CHOICES = [1, 3, 6, 12] as const;
export type MonthChoice = (typeof MONTH_CHOICES)[number];

export function isValidMonths(n: unknown): n is MonthChoice {
  return typeof n === "number" && (MONTH_CHOICES as readonly number[]).includes(n);
}

export function isSubscriptionPlan(p: unknown): p is "individual" | "student" {
  return p === "individual" || p === "student";
}

export function monthlyPrice(plan: "individual" | "student"): number {
  return plan === "student" ? STUDENT_MONTHLY_PRICE_IDR : MONTHLY_PRICE_IDR;
}

/** Harga dasar (tanpa kode unik) untuk `months` bulan. Tidak ada diskon durasi. */
export function subscriptionAmount(plan: "individual" | "student", months: number): number {
  if (!isValidMonths(months)) throw new Error("Lama berlangganan tidak valid.");
  return monthlyPrice(plan) * months;
}

// ---------------------------------------------------------------------------
// Lisensi institusi: harga per tahun menurut tingkat jumlah pengguna.
// ---------------------------------------------------------------------------
export const INSTITUTION_BASE_PRICE_IDR = 5_000_000;
export const INSTITUTION_MIN_USERS = 1;
export const INSTITUTION_MAX_USERS = 1000;
export const INSTITUTION_TERM_MONTHS = 12;
/** Batas atas tiap tingkat (pengguna) dan diskonnya. 0-100: 5%, 101-200: 10%, 201-300: 15%, >300: 20%. */
export const INSTITUTION_TIERS: readonly { maxUsers: number; pct: number }[] = [
  { maxUsers: 100, pct: 5 },
  { maxUsers: 200, pct: 10 },
  { maxUsers: 300, pct: 15 },
  { maxUsers: INSTITUTION_MAX_USERS, pct: 20 },
];

export function isValidInstitutionUsers(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= INSTITUTION_MIN_USERS && n <= INSTITUTION_MAX_USERS;
}

export function institutionDiscountPct(users: number): number {
  if (!isValidInstitutionUsers(users)) throw new Error(`Jumlah pengguna harus ${INSTITUTION_MIN_USERS}-${INSTITUTION_MAX_USERS}.`);
  return INSTITUTION_TIERS.find((t) => users <= t.maxUsers)!.pct;
}

export function institutionAmount(users: number): number {
  const pct = institutionDiscountPct(users);
  return (INSTITUTION_BASE_PRICE_IDR * (100 - pct)) / 100;
}

// ---------------------------------------------------------------------------
// Waktu
// ---------------------------------------------------------------------------
/** Pembeli diberi tahu: konfirmasi pembayaran diproses admin paling lama sekian jam. */
export const CONFIRMATION_SLA_HOURS = 12;
/** Tagihan yang belum ditandai "sudah bayar" kedaluwarsa setelah sekian jam (kode uniknya bebas lagi). */
export const UNPAID_EXPIRY_HOURS = 24;
/** Pengingat perpanjangan dikirim bila langganan berakhir dalam sekian hari. */
export const RENEWAL_REMINDER_DAYS = 7;

/** Tambah bulan kalender (UTC). 31 Jan + 1 bulan = 28/29 Feb (tanggal dipangkas, tidak meluber). */
export function addMonthsUtc(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** Perpanjangan disambung dari masa berlaku saat ini, jadi tidak ada hari berbayar yang hilang. */
export function nextPeriod(latestExpiry: Date | null, now: Date, months: number): { startsAt: Date; expiresAt: Date } {
  const startsAt = latestExpiry && latestExpiry > now ? latestExpiry : now;
  return { startsAt, expiresAt: addMonthsUtc(startsAt, months) };
}

/**
 * Satu akun hanya boleh punya satu jenis langganan aktif. Mengembalikan pesan penolakan, atau null bila boleh.
 * `active` = jenis langganan yang sedang aktif milik pengguna (null bila tidak ada).
 */
export function planConflict(active: { plan: PlanKind; expiresAt: Date } | null, wanted: "individual" | "student" | "institution-claim"): string | null {
  if (!active) return null;
  const want: PlanKind = wanted === "institution-claim" ? "institution" : wanted;
  const until = active.expiresAt.toISOString().slice(0, 10);
  if (active.plan === "institution") {
    return wanted === "institution-claim"
      ? "Anda sudah memiliki lisensi institusi yang aktif."
      : `Anda memiliki lisensi institusi aktif sampai ${until}, jadi tidak perlu berlangganan sendiri.`;
  }
  if (active.plan === want) return null; // perpanjangan jenis yang sama
  return wanted === "institution-claim"
    ? `Anda masih punya langganan ${active.plan === "student" ? "Mahasiswa" : "Individu"} aktif sampai ${until}. Kupon institusi bisa diklaim setelah itu.`
    : `Anda masih punya langganan ${active.plan === "student" ? "Mahasiswa" : "Individu"} aktif sampai ${until}. Jenis langganan baru bisa dipilih setelah itu.`;
}

export function formatRupiah(n: number): string {
  return "Rp " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
