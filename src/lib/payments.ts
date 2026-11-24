// Aturan pembayaran murni (tanpa akses jaringan/database) supaya mudah dites.

export type PaymentMode = "promo" | "mock" | "midtrans" | "qris";
export type PaymentStatus = "pending" | "paid" | "expired" | "failed";

/** Waktu halaman Snap berlaku sebelum dianggap kedaluwarsa. */
export const PAYMENT_EXPIRY_MINUTES = 60;

export function parsePaymentMode(raw: string | undefined | null): PaymentMode {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "mock" || v === "midtrans" || v === "qris" ? v : "promo";
}

/** ID pesanan unik, aman dipakai di Midtrans (maks 50 karakter, huruf/angka/-). */
export function makeOrderId(random: (n: number) => Uint8Array = defaultRandom): string {
  const hex = Array.from(random(10), (b) => b.toString(16).padStart(2, "0")).join("");
  return `SMD-${Date.now().toString(36).toUpperCase()}-${hex.toUpperCase()}`;
}

function defaultRandom(n: number) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** Terjemahkan status transaksi Midtrans ke status internal. */
export function mapMidtransStatus(transactionStatus: string | undefined, fraudStatus?: string): PaymentStatus {
  switch (transactionStatus) {
    case "settlement":
      return "paid";
    case "capture":
      return fraudStatus && fraudStatus !== "accept" ? "pending" : "paid";
    case "expire":
      return "expired";
    case "cancel":
    case "deny":
    case "failure":
      return "failed";
    default:
      return "pending";
  }
}

async function sha512Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** signature_key Midtrans = SHA512(order_id + status_code + gross_amount + server_key). */
export async function verifyMidtransSignature(n: unknown, serverKey: string): Promise<boolean> {
  if (!isRecord(n) || !serverKey) return false;
  if (![n["order_id"], n["status_code"], n["gross_amount"], n["signature_key"]].every((v) => typeof v === "string")) return false;
  const expected = await sha512Hex(`${n["order_id"]}${n["status_code"]}${n["gross_amount"]}${serverKey}`);
  return safeEqual(expected, (n["signature_key"] as string).toLowerCase());
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Format order id yang kita buat sendiri (lihat makeOrderId). Dipakai di semua pintu masuk. */
export function isValidOrderId(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9-]{8,60}$/.test(v);
}

/**
 * Midtrans mengirim "50000.00". Wajib sama persis dengan nominal yang kita simpan:
 * tanpa pembulatan, tanpa notasi lain ("2e4", "0x4E20", " 50000 "), dan nilai kosong/hilang = tidak cocok.
 */
export function grossAmountMatches(gross: unknown, expectedIdr: number): boolean {
  if (!Number.isInteger(expectedIdr) || expectedIdr <= 0) return false;
  if (typeof gross === "number") return gross === expectedIdr;
  if (typeof gross !== "string" || !/^\d+(\.0+)?$/.test(gross)) return false;
  return Number(gross) === expectedIdr;
}

export type MidtransProblem = "malformed" | "order_id" | "status_code" | "gross_amount" | "payment_type" | "currency" | "token";
export type StatusEvaluation = { status: PaymentStatus; problem?: MidtransProblem };

/**
 * Nilai respons Midtrans (status API) menjadi status internal. Semua isi respons dianggap tidak tepercaya:
 * - "lunas" hanya bila order_id, status_code 200, payment_type (metode apa pun yang ditawarkan Snap) terisi, mata uang dan gross_amount semuanya cocok.
 *   Satu saja tidak cocok/hilang = "failed" (dengan `problem`), bukan lunas.
 * - Status lain (expire/cancel/deny) dari respons yang order_id-nya tidak cocok diabaikan (tetap "pending").
 */
export function evaluateMidtransStatus(remote: unknown, expected: { orderId: string; amountIdr: number }): StatusEvaluation {
  if (!isRecord(remote)) return { status: "pending", problem: "malformed" };
  const tx = typeof remote["transaction_status"] === "string" ? remote["transaction_status"] : undefined;
  const fraud = typeof remote["fraud_status"] === "string" ? remote["fraud_status"] : undefined;
  const mapped = mapMidtransStatus(tx, fraud);

  if (mapped !== "paid") {
    if (mapped !== "pending" && remote["order_id"] !== expected.orderId) return { status: "pending", problem: "order_id" };
    return { status: mapped };
  }

  if (remote["order_id"] !== expected.orderId) return { status: "failed", problem: "order_id" };
  if (remote["status_code"] !== "200") return { status: "failed", problem: "status_code" };
  if (typeof remote["payment_type"] !== "string" || remote["payment_type"] === "") return { status: "failed", problem: "payment_type" };
  if (remote["currency"] !== undefined && remote["currency"] !== "IDR") return { status: "failed", problem: "currency" };
  if (!grossAmountMatches(remote["gross_amount"], expected.amountIdr)) return { status: "failed", problem: "gross_amount" };
  return { status: "paid" };
}

/** Periksa respons Snap (/snap/v1/transactions). Mengembalikan masalah pertama, atau null bila sah. */
export function validateSnapResponse(body: unknown): MidtransProblem | null {
  if (!isRecord(body)) return "malformed";
  if (typeof body["token"] !== "string" || !/^[A-Za-z0-9-]{8,100}$/.test(body["token"])) return "token";
  const url = body["redirect_url"];
  if (typeof url !== "string" || !/^https:\/\/app(\.sandbox)?\.midtrans\.com\//.test(url)) return "malformed";
  return null;
}

/** Alasan membatalkan pembayaran. `value` disimpan di database (lihat constraint payments_cancel_reason_check). */
export const CANCEL_REASONS = [
  { value: "ganti_metode", label: "Ingin mengganti metode pembayaran" },
  { value: "metode_tidak_ada", label: "Metode pembayaran yang saya mau tidak tersedia" },
  { value: "tidak_jadi", label: "Tidak jadi membeli" },
  { value: "harga", label: "Harga terlalu mahal" },
  { value: "kendala", label: "Terkendala saat pembayaran" },
  { value: "lainnya", label: "Lainnya" },
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number]["value"];

export function isCancelReason(v: unknown): v is CancelReason {
  return typeof v === "string" && CANCEL_REASONS.some((r) => r.value === v);
}

export const CANCEL_NOTE_MAX = 300;

/** Jenis pembelian. individual = token untuk satu pengguna (boleh pakai kupon); institution = pembelian kupon oleh institusi. */
export type PaymentKind = "individual" | "institution";

export type PurchaseRequest =
  | { kind: "individual"; days: number; couponCode?: string | undefined }
  | { kind: "institution"; couponId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validasi bentuk permintaan dari browser. Nominal tidak pernah datang dari browser; server menghitungnya. */
export function parsePurchaseRequest(raw: unknown): PurchaseRequest {
  if (!isRecord(raw)) throw new Error("Permintaan tidak valid.");
  if (raw["kind"] === "institution") {
    if (typeof raw["couponId"] !== "string" || !UUID.test(raw["couponId"])) throw new Error("Kupon tidak valid.");
    return { kind: "institution", couponId: raw["couponId"] };
  }
  const days = raw["days"];
  if (!isValidDaysInput(days)) throw new Error("Jumlah hari tidak valid.");
  const code = raw["couponCode"];
  if (code !== undefined && code !== null && code !== "") {
    if (typeof code !== "string" || code.length > 40) throw new Error("Kode kupon tidak valid.");
    return { kind: "individual", days, couponCode: code };
  }
  return { kind: "individual", days };
}

function isValidDaysInput(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 365;
}
