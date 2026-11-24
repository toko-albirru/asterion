// Premium (QRIS statis): tagihan, konfirmasi admin, penerbitan/perpanjangan token, klaim kupon institusi.
// Hanya untuk server. Dipanggil dari premium.functions.ts lewat dynamic import.
// Semua angka (harga, kode unik, masa berlaku, status) ditentukan di sini; browser hanya mengirim pilihan.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { getUserIdentity } from "@/lib/coupon.server";
import { COUPON_PATTERN, generateCouponCode, normalizeCouponCode } from "@/lib/coupons";
import { daysLeft, generateToken } from "@/lib/license";
import {
  normalizeEmailDomains,
  normalizeRejectReason,
  parseAdminEmails,
  quoteOrder,
  renewalReminderDue,
  sameOrder,
  type OrderQuote,
  type OrderRequest,
} from "@/lib/orders";
import { isValidOrderId, makeOrderId, parsePaymentMode } from "@/lib/payments";
import {
  CONFIRMATION_SLA_HOURS,
  INSTITUTION_TERM_MONTHS,
  UNPAID_EXPIRY_HOURS,
  addMonthsUtc,
  formatRupiah,
  nextPeriod as nextMonthsPeriod,
  planConflict,
  type PlanKind,
} from "@/lib/plans";
import { parseStaticQris, toDynamicQris, totalWithCode, type StaticQrisInfo } from "@/lib/qris";
import { effectiveStatus } from "@/lib/student";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type LicenseRow = Database["public"]["Tables"]["licenses"]["Row"];

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Konfigurasi
// ---------------------------------------------------------------------------
export function premiumEnabled(): boolean {
  return parsePaymentMode(process.env["PAYMENT_MODE"]) === "qris";
}

let qrisCache: { raw: string; info: StaticQrisInfo } | null = null;
/** QRIS statis dari secret QRIS_STATIC. Diperiksa (CRC, bukan dinamis) sebelum dipakai. */
export function qrisConfig(): { payload: string; merchantName: string } {
  const raw = (process.env["QRIS_STATIC"] ?? "").trim();
  if (!raw) throw new Error("Pembayaran QRIS belum dikonfigurasi (QRIS_STATIC kosong).");
  if (!qrisCache || qrisCache.raw !== raw) qrisCache = { raw, info: parseStaticQris(raw) };
  return { payload: raw, merchantName: qrisCache.info.merchantName };
}

export function publicConfig() {
  const enabled = premiumEnabled();
  let merchantName = "";
  if (enabled) {
    try {
      merchantName = qrisConfig().merchantName;
    } catch {
      /* QRIS belum benar: tampil sebagai tidak aktif */
    }
  }
  return { enabled: enabled && merchantName !== "", merchantName, confirmationHours: CONFIRMATION_SLA_HOURS };
}

function requireEnabled() {
  if (!premiumEnabled()) throw new Error("Pembayaran belum diaktifkan.");
  qrisConfig();
}

// ---------------------------------------------------------------------------
// Admin & notifikasi
// ---------------------------------------------------------------------------
/** Admin = akun dengan email TERKONFIRMASI yang ada di ADMIN_EMAILS. */
export async function isAdmin(userId: string): Promise<boolean> {
  const list = parseAdminEmails(process.env["ADMIN_EMAILS"]);
  if (list.length === 0) return false;
  const who = await getUserIdentity(userId).catch(() => null);
  return Boolean(who?.email && who.emailConfirmed && list.includes(who.email.toLowerCase()));
}

export async function requireAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) throw new Error("Akses ditolak.");
}

const NOTIFICATION_KEEP_DAYS = 60;

export async function notify(userId: string, kind: string, title: string, body: string): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").insert({ user_id: userId, kind, title, body });
  if (error) console.error("notify gagal", error.code);
  // Pembersihan sambil lewat (hemat: tanpa cron).
  void supabaseAdmin
    .from("notifications")
    .delete()
    .eq("user_id", userId)
    .lt("created_at", new Date(Date.now() - NOTIFICATION_KEEP_DAYS * DAY_MS).toISOString())
    .then(() => undefined);
}

const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(d));

// ---------------------------------------------------------------------------
// Langganan aktif & kelayakan
// ---------------------------------------------------------------------------
async function latestLicense(userId: string): Promise<LicenseRow | null> {
  const { data } = await supabaseAdmin.from("licenses").select("*").eq("user_id", userId).order("expires_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

function activeOf(l: LicenseRow | null, now: Date): { plan: PlanKind; expiresAt: Date } | null {
  if (!l || new Date(l.expires_at) <= now) return null;
  return { plan: l.plan as PlanKind, expiresAt: new Date(l.expires_at) };
}

async function assertSubscriptionAllowed(userId: string, plan: "individual" | "student", now: Date) {
  if (plan === "student") {
    await supabaseAdmin.rpc("expire_student_verifications");
    const { data } = await supabaseAdmin.from("student_verifications").select("status, expires_at").eq("user_id", userId).maybeSingle();
    if (effectiveStatus(data ?? null, now) !== "verified") {
      throw new Error("Premium Mahasiswa memerlukan verifikasi mahasiswa yang masih berlaku. Selesaikan verifikasi dulu.");
    }
  }
  const msg = planConflict(activeOf(await latestLicense(userId), now), plan);
  if (msg) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Membuat tagihan
// ---------------------------------------------------------------------------
type OpenOrder = Pick<PaymentRow, "order_id" | "plan" | "months" | "label" | "base_amount_idr" | "claimed_at" | "coupon_id" | "kind">;
const OPEN_COLS = "order_id, plan, months, label, base_amount_idr, claimed_at, coupon_id, kind";

async function openOrders(userId: string): Promise<OpenOrder[]> {
  const { data } = await supabaseAdmin.from("payments").select(OPEN_COLS).eq("user_id", userId).eq("status", "pending");
  return (data ?? []) as OpenOrder[];
}

/** Tutup tagihan yang belum dibayar. Kupon institusi yang baru "pending" ikut dihapus. */
async function closeUnpaid(o: Pick<OpenOrder, "order_id" | "coupon_id" | "kind">) {
  await supabaseAdmin.from("payments").update({ status: "expired" }).eq("order_id", o.order_id).eq("status", "pending").is("claimed_at", null);
  if (o.kind === "institution" && o.coupon_id) await supabaseAdmin.from("institution_coupons").delete().eq("id", o.coupon_id).eq("status", "pending");
}

async function institutionOrderMatches(o: OpenOrder, q: OrderQuote): Promise<boolean> {
  if (!o.coupon_id) return false;
  const { data } = await supabaseAdmin.from("institution_coupons").select("email_domains").eq("id", o.coupon_id).maybeSingle();
  const a = [...(data?.email_domains ?? [])].sort().join(",");
  return a === [...q.emailDomains].sort().join(",");
}

async function createPendingCoupon(userId: string, q: OrderQuote, now: Date): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const { data, error } = await supabaseAdmin
      .from("institution_coupons")
      .insert({
        code: generateCouponCode(),
        owner_id: userId,
        institution_name: q.institutionName!,
        seats: q.users!,
        days: 365,
        valid_until: addMonthsUtc(now, INSTITUTION_TERM_MONTHS).toISOString(), // diperbarui saat lunas
        email_domain: null,
        email_domains: q.emailDomains,
        discount_pct: q.discountPct,
        amount_idr: q.baseAmount,
        status: "pending",
      })
      .select("id")
      .single();
    if (data) return data.id;
    if (error?.code !== "23505") throw new Error("Gagal membuat lisensi institusi. Coba lagi.");
  }
  throw new Error("Gagal membuat kode kupon. Coba lagi.");
}

export async function createOrderForUser(userId: string, req: OrderRequest, now = new Date()): Promise<{ orderId: string }> {
  requireEnabled();
  const q = quoteOrder(req);
  if (req.kind === "subscription") await assertSubscriptionAllowed(userId, req.plan, now);
  await supabaseAdmin.rpc("expire_stale_qris");

  for (const o of await openOrders(userId)) {
    if (o.claimed_at) throw new Error(`Pembayaran Anda sebelumnya sedang diperiksa admin (maksimal ${CONFIRMATION_SLA_HOURS} jam). Tunggu sampai selesai.`);
    const same = sameOrder(o, q) && (q.plan !== "institution" || (await institutionOrderMatches(o, q)));
    if (same) return { orderId: o.order_id };
    await closeUnpaid(o);
  }

  const couponId = req.kind === "institution" ? await createPendingCoupon(userId, q, now) : null;
  const discardCoupon = async () => {
    if (couponId) await supabaseAdmin.from("institution_coupons").delete().eq("id", couponId).eq("status", "pending");
  };

  const { payload } = qrisConfig();
  const orderId = makeOrderId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: code, error: codeErr } = await supabaseAdmin.rpc("next_qris_code", { p_base: q.baseAmount });
    if (codeErr || typeof code !== "number") {
      await discardCoupon();
      throw new Error("Gagal membuat kode pembayaran. Coba lagi sebentar.");
    }
    const total = totalWithCode(q.baseAmount, code);
    const { error } = await supabaseAdmin.from("payments").insert({
      order_id: orderId,
      user_id: userId,
      provider: "qris",
      kind: q.plan === "institution" ? "institution" : "individual",
      plan: q.plan,
      months: q.months,
      base_amount_idr: q.baseAmount,
      unique_code: code,
      amount_idr: total,
      discount_idr: q.discountIdr,
      label: q.label,
      coupon_id: couponId,
      status: "pending",
      qr_string: toDynamicQris(payload, total),
      expires_at: new Date(now.getTime() + UNPAID_EXPIRY_HOURS * 3_600_000).toISOString(),
    });
    if (!error) return { orderId };
    if (error.code === "23505") {
      // Permintaan ganda dari pengguna yang sama? Pakai tagihan yang menang. Jika bukan, total bentrok: coba kode berikutnya.
      const winner = (await openOrders(userId))[0];
      if (winner) {
        await discardCoupon();
        return { orderId: winner.order_id };
      }
      continue;
    }
    await discardCoupon();
    throw new Error("Gagal membuat tagihan. Coba lagi.");
  }
  await discardCoupon();
  throw new Error("Terlalu banyak tagihan berjalan. Coba lagi beberapa saat.");
}

// ---------------------------------------------------------------------------
// Tagihan milik pengguna
// ---------------------------------------------------------------------------
export type OrderView = {
  orderId: string;
  status: "pending" | "paid" | "expired" | "failed";
  waitingAdmin: boolean;
  label: string;
  plan: string | null;
  months: number | null;
  baseAmount: number;
  uniqueCode: number;
  amount: number;
  discountIdr: number;
  qrString: string | null;
  expiresAt: string | null;
  claimedAt: string | null;
  paidAt: string | null;
  rejectReason: string | null;
  couponCode: string | null;
  merchantName: string;
  confirmationHours: number;
};

export async function getOrderForUser(userId: string, orderId: string): Promise<OrderView> {
  if (!isValidOrderId(orderId)) throw new Error("Tagihan tidak ditemukan.");
  await supabaseAdmin.rpc("expire_stale_qris");
  const { data: p } = await supabaseAdmin.from("payments").select("*").eq("order_id", orderId).eq("user_id", userId).eq("provider", "qris").maybeSingle();
  if (!p) throw new Error("Tagihan tidak ditemukan.");
  let couponCode: string | null = null;
  if (p.kind === "institution" && p.coupon_id && p.status === "paid") {
    const { data: c } = await supabaseAdmin.from("institution_coupons").select("code").eq("id", p.coupon_id).maybeSingle();
    couponCode = c?.code ?? null;
  }
  let merchantName = "";
  try {
    merchantName = qrisConfig().merchantName;
  } catch {
    /* tidak kritis untuk tampilan */
  }
  return {
    orderId: p.order_id,
    status: p.status as OrderView["status"],
    waitingAdmin: p.status === "pending" && Boolean(p.claimed_at),
    label: p.label ?? "Premium SEMAR-Dock",
    plan: p.plan,
    months: p.months,
    baseAmount: p.base_amount_idr ?? p.amount_idr,
    uniqueCode: p.unique_code ?? 0,
    amount: p.amount_idr,
    discountIdr: p.discount_idr,
    qrString: p.status === "pending" ? p.qr_string : null,
    expiresAt: p.expires_at,
    claimedAt: p.claimed_at,
    paidAt: p.paid_at,
    rejectReason: p.reject_reason,
    couponCode,
    merchantName,
    confirmationHours: CONFIRMATION_SLA_HOURS,
  };
}

/** Pembeli menekan "Saya sudah bayar": tagihan masuk antrean admin. Idempotent. */
export async function claimPaid(userId: string, orderId: string, now = new Date()): Promise<void> {
  if (!isValidOrderId(orderId)) throw new Error("Tagihan tidak ditemukan.");
  const { data } = await supabaseAdmin
    .from("payments")
    .update({ claimed_at: now.toISOString() })
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .eq("provider", "qris")
    .eq("status", "pending")
    .is("claimed_at", null)
    .select("order_id");
  if (data?.length) return;
  const { data: p } = await supabaseAdmin.from("payments").select("status, claimed_at").eq("order_id", orderId).eq("user_id", userId).maybeSingle();
  if (!p) throw new Error("Tagihan tidak ditemukan.");
  if (p.status === "pending" && p.claimed_at) return; // sudah diajukan
  if (p.status === "paid") return;
  if (p.status === "expired") throw new Error("Tagihan sudah kedaluwarsa. Jika Anda sudah terlanjur membayar, hubungi admin dengan bukti pembayaran.");
  throw new Error("Tagihan ini tidak dapat diproses.");
}

/** Batalkan tagihan yang belum ditandai dibayar. Yang sedang diperiksa admin tidak bisa dibatalkan. */
export async function cancelOrder(userId: string, orderId: string): Promise<void> {
  if (!isValidOrderId(orderId)) throw new Error("Tagihan tidak ditemukan.");
  const { data: row } = await supabaseAdmin.from("payments").select("*").eq("order_id", orderId).eq("user_id", userId).eq("provider", "qris").maybeSingle();
  if (!row) throw new Error("Tagihan tidak ditemukan.");
  if (row.status !== "pending") return;
  if (row.claimed_at) throw new Error("Tagihan sedang diperiksa admin dan tidak bisa dibatalkan. Hubungi admin bila ada kesalahan.");
  await closeUnpaid(row);
}

// ---------------------------------------------------------------------------
// Konfirmasi / penolakan admin
// ---------------------------------------------------------------------------
async function getQrisPayment(orderId: string): Promise<PaymentRow> {
  if (!isValidOrderId(orderId)) throw new Error("Tagihan tidak ditemukan.");
  const { data } = await supabaseAdmin.from("payments").select("*").eq("order_id", orderId).eq("provider", "qris").maybeSingle();
  if (!data) throw new Error("Tagihan tidak ditemukan.");
  return data;
}

export async function confirmPayment(adminId: string, orderId: string, now = new Date()): Promise<{ alreadyPaid: boolean }> {
  await requireAdmin(adminId);
  const pay = await getQrisPayment(orderId);
  if (pay.status === "failed") throw new Error("Tagihan ini sudah ditolak. Minta pembeli membuat tagihan baru.");

  const alreadyPaid = pay.status === "paid";
  if (!alreadyPaid) {
    if (pay.plan === "individual" || pay.plan === "student") {
      // Periksa lagi saat konfirmasi: keadaan pembeli bisa berubah sejak tagihan dibuat.
      await assertSubscriptionAllowed(pay.user_id, pay.plan, now).catch((e: unknown) => {
        throw new Error(`Tidak bisa dikonfirmasi: ${(e as Error).message} Tolak tagihan ini dengan alasan yang jelas.`);
      });
    }
    const { data: won } = await supabaseAdmin
      .from("payments")
      .update({ status: "paid", paid_at: now.toISOString(), confirmed_by: adminId, confirmed_at: now.toISOString() })
      .eq("id", pay.id)
      .in("status", ["pending", "expired"])
      .select("id");
    if (!won?.length) throw new Error("Status tagihan baru saja berubah. Muat ulang daftar.");
  }
  await settle(pay.id, now);
  return { alreadyPaid };
}

/** Terbitkan/perpanjang lisensi untuk pembayaran lunas. Aman diulang: settled_at memastikan hanya sekali. */
async function settle(paymentId: string, now: Date): Promise<void> {
  const { data: slot } = await supabaseAdmin.from("payments").update({ settled_at: now.toISOString() }).eq("id", paymentId).eq("status", "paid").is("settled_at", null).select("*");
  const pay = slot?.[0];
  if (!pay) return; // sudah diproses
  try {
    if (pay.plan === "institution") await activateInstitution(pay, now);
    else await extendSubscription(pay, now);
  } catch (e) {
    await supabaseAdmin.from("payments").update({ settled_at: null }).eq("id", paymentId); // boleh dicoba lagi
    throw e;
  }
}

async function extendSubscription(pay: PaymentRow, now: Date): Promise<void> {
  const plan = pay.plan as "individual" | "student";
  const months = pay.months ?? 0;
  if (months < 1) throw new Error("Data tagihan tidak lengkap.");
  const latest = await latestLicense(pay.user_id);
  const price = pay.base_amount_idr ?? pay.amount_idr;

  let expiresAt: Date;
  if (latest && latest.source === "payment") {
    const active = new Date(latest.expires_at) > now;
    if (active && latest.plan !== plan) throw new Error("Pengguna masih memiliki langganan jenis lain yang aktif.");
    const period = nextMonthsPeriod(new Date(latest.expires_at), now, months);
    expiresAt = period.expiresAt;
    // Token yang sama diperpanjang: aplikasi desktop tidak perlu diberi token baru.
    const { error } = await supabaseAdmin
      .from("licenses")
      .update({ plan, price_idr: price, payment_status: "paid", expires_at: expiresAt.toISOString(), cancelled_at: null, ...(active ? {} : { starts_at: now.toISOString() }) })
      .eq("id", latest.id);
    if (error) throw new Error("Gagal memperpanjang lisensi.");
  } else {
    if (latest && new Date(latest.expires_at) > now) throw new Error("Pengguna masih memiliki lisensi aktif lain.");
    expiresAt = nextMonthsPeriod(null, now, months).expiresAt;
    let ok = false;
    for (let i = 0; i < 5 && !ok; i++) {
      const { error } = await supabaseAdmin.from("licenses").insert({
        user_id: pay.user_id,
        token: generateToken(),
        plan,
        price_idr: price,
        payment_status: "paid",
        starts_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        source: "payment",
      });
      if (!error) ok = true;
      else if (error.code !== "23505") throw new Error(error.message.includes("plan_conflict") ? "Pengguna masih memiliki langganan jenis lain yang aktif." : "Gagal menerbitkan token.");
    }
    if (!ok) throw new Error("Gagal menerbitkan token. Coba konfirmasi lagi.");
  }
  await notify(pay.user_id, "payment_paid", "Pembayaran dikonfirmasi", `${pay.label ?? "Premium"} aktif sampai ${fmtDate(expiresAt)}. Token Anda ada di halaman Akun.`);
}

async function activateInstitution(pay: PaymentRow, now: Date): Promise<void> {
  if (!pay.coupon_id) throw new Error("Data lisensi institusi tidak ditemukan.");
  const validUntil = addMonthsUtc(now, INSTITUTION_TERM_MONTHS);
  const { data, error } = await supabaseAdmin
    .from("institution_coupons")
    .update({ status: "active", paid_at: now.toISOString(), valid_until: validUntil.toISOString() })
    .eq("id", pay.coupon_id)
    .neq("status", "active")
    .select("code, institution_name, seats");
  if (error) throw new Error("Gagal mengaktifkan lisensi institusi.");
  const c = data?.[0];
  if (!c) return; // sudah aktif
  await notify(
    pay.user_id,
    "institution_active",
    "Lisensi institusi aktif",
    `Lisensi ${c.institution_name} (${c.seats} pengguna) aktif sampai ${fmtDate(validUntil)}. Kode kupon: ${c.code}. Bagikan ke mahasiswa/dosen/staf.`,
  );
}

export async function rejectPayment(adminId: string, orderId: string, reason: unknown): Promise<void> {
  await requireAdmin(adminId);
  const why = normalizeRejectReason(reason);
  const pay = await getQrisPayment(orderId);
  if (pay.status !== "pending" && pay.status !== "expired") throw new Error("Hanya tagihan yang belum lunas yang bisa ditolak.");
  const { data } = await supabaseAdmin
    .from("payments")
    .update({ status: "failed", reject_reason: why, confirmed_by: adminId, confirmed_at: new Date().toISOString() })
    .eq("id", pay.id)
    .in("status", ["pending", "expired"])
    .select("id");
  if (!data?.length) throw new Error("Status tagihan baru saja berubah. Muat ulang daftar.");
  if (pay.kind === "institution" && pay.coupon_id) await supabaseAdmin.from("institution_coupons").delete().eq("id", pay.coupon_id).eq("status", "pending");
  await notify(pay.user_id, "payment_rejected", "Pembayaran ditolak", `${pay.label ?? "Pembayaran"} (${formatRupiah(pay.amount_idr)}) ditolak. Alasan: ${why}`);
}

export type AdminPaymentRow = {
  orderId: string;
  email: string | null;
  label: string;
  plan: string | null;
  amount: number;
  uniqueCode: number | null;
  status: string;
  claimedAt: string | null;
  createdAt: string;
  paidAt: string | null;
  rejectReason: string | null;
};

/** Antrean admin. "claimed" = sudah ditekan "Saya sudah bayar"; "open" = semua pending; "recent" = 50 terakhir. */
export async function listPaymentsForAdmin(adminId: string, scope: "claimed" | "open" | "recent"): Promise<AdminPaymentRow[]> {
  await requireAdmin(adminId);
  await supabaseAdmin.rpc("expire_stale_qris");
  let query = supabaseAdmin.from("payments").select("*").eq("provider", "qris");
  if (scope === "claimed") query = query.eq("status", "pending").not("claimed_at", "is", null).order("claimed_at", { ascending: true });
  else if (scope === "open") query = query.eq("status", "pending").order("created_at", { ascending: true });
  else query = query.order("created_at", { ascending: false });
  const { data } = await query.limit(50);
  const emails = new Map<string, string | null>();
  for (const p of data ?? []) {
    if (!emails.has(p.user_id)) emails.set(p.user_id, (await getUserIdentity(p.user_id).catch(() => null))?.email ?? null);
  }
  return (data ?? []).map((p) => ({
    orderId: p.order_id,
    email: emails.get(p.user_id) ?? null,
    label: p.label ?? "-",
    plan: p.plan,
    amount: p.amount_idr,
    uniqueCode: p.unique_code,
    status: p.status,
    claimedAt: p.claimed_at,
    createdAt: p.created_at,
    paidAt: p.paid_at,
    rejectReason: p.reject_reason,
  }));
}

// ---------------------------------------------------------------------------
// Klaim kupon institusi
// ---------------------------------------------------------------------------
const CLAIM_ERRORS: Record<string, string> = {
  coupon_invalid: "Kode kupon tidak ditemukan atau belum aktif.",
  coupon_expired: "Kupon ini sudah kedaluwarsa.",
  domain_not_allowed: "Email akun Anda tidak termasuk domain yang diizinkan institusi ini.",
  already_institution: "Anda sudah memiliki lisensi institusi yang aktif.",
  quota_full: "Kuota kupon ini sudah penuh. Hubungi admin institusi Anda.",
  plan_conflict: "Anda masih punya langganan berbayar yang aktif. Kupon bisa diklaim setelah langganan itu berakhir.",
};

export async function claimCoupon(userId: string, rawCode: unknown, now = new Date()): Promise<{ institution: string; expiresAt: string }> {
  if (typeof rawCode !== "string") throw new Error("Masukkan kode kupon.");
  const code = normalizeCouponCode(rawCode);
  if (!COUPON_PATTERN.test(code)) throw new Error("Format kode kupon tidak valid.");
  const who = await getUserIdentity(userId);
  if (!who.email || !who.emailConfirmed) throw new Error("Konfirmasi email akun Anda dulu sebelum memakai kupon.");

  const msg = planConflict(activeOf(await latestLicense(userId), now), "institution-claim");
  if (msg) throw new Error(msg);

  for (let i = 0; i < 4; i++) {
    const { data, error } = await supabaseAdmin.rpc("claim_institution_coupon", { p_user: userId, p_email: who.email, p_code: code, p_token: generateToken() });
    if (!error && data?.[0]) {
      const r = data[0];
      await notify(userId, "coupon_claimed", "Lisensi institusi aktif", `Akses Premium dari ${r.out_institution} aktif sampai ${fmtDate(r.out_expires_at)}.`);
      return { institution: r.out_institution, expiresAt: r.out_expires_at };
    }
    if (error?.code === "23505") {
      if (error.message.includes("coupon_redemptions")) throw new Error("Anda sudah memakai kupon ini.");
      continue; // token bentrok
    }
    const key = Object.keys(CLAIM_ERRORS).find((k) => error?.message?.includes(k));
    throw new Error(key ? CLAIM_ERRORS[key]! : "Gagal memakai kupon. Coba lagi.");
  }
  throw new Error("Gagal menerbitkan token. Coba lagi.");
}

// ---------------------------------------------------------------------------
// Ringkasan akun: langganan, verifikasi, riwayat
// ---------------------------------------------------------------------------
export async function billingOverview(userId: string, now = new Date()) {
  await supabaseAdmin.rpc("expire_stale_qris");
  await supabaseAdmin.rpc("expire_student_verifications");
  const [license, ver, pays, open] = await Promise.all([
    latestLicense(userId),
    supabaseAdmin.from("student_verifications").select("status, expires_at, reject_reason, submitted_at, flags").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("payments").select("order_id, plan, months, label, amount_idr, status, created_at, paid_at, claimed_at, reject_reason, provider").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    openOrders(userId),
  ]);

  let institution: string | null = null;
  if (license?.source === "institution" && license.coupon_id) {
    const { data } = await supabaseAdmin.from("institution_coupons").select("institution_name").eq("id", license.coupon_id).maybeSingle();
    institution = data?.institution_name ?? null;
  }

  let expiringSoon = false;
  if (license && license.source === "payment") {
    const exp = new Date(license.expires_at);
    expiringSoon = renewalReminderDue(exp, now, license.cancelled_at);
    if (expiringSoon) {
      // Satu pengingat per masa berlaku (dicek lewat notifikasi 8 hari terakhir).
      const since = new Date(exp.getTime() - 8 * DAY_MS).toISOString();
      const { data: seen } = await supabaseAdmin.from("notifications").select("id").eq("user_id", userId).eq("kind", "renewal").gte("created_at", since).limit(1);
      if (!seen?.length) await notify(userId, "renewal", "Premium segera berakhir", `Langganan Anda berakhir ${fmtDate(exp)} (${daysLeft(exp, now)} hari lagi). Perpanjang dari halaman Langganan.`);
    }
  }

  const active = license && new Date(license.expires_at) > now;
  return {
    license: license
      ? {
          plan: license.plan as PlanKind,
          token: active ? license.token : null,
          expiresAt: license.expires_at,
          active: Boolean(active),
          daysLeft: active ? daysLeft(new Date(license.expires_at), now) : 0,
          source: license.source,
          cancelled: Boolean(license.cancelled_at),
          institution,
          expiringSoon,
        }
      : null,
    verification: {
      status: effectiveStatus(ver.data ?? null, now),
      expiresAt: ver.data?.expires_at ?? null,
      rejectReason: ver.data?.status === "rejected" ? ver.data.reject_reason : null,
    },
    openOrderId: open[0]?.order_id ?? null,
    payments: (pays.data ?? [])
      .filter((p) => p.provider === "qris")
      .map((p) => ({ orderId: p.order_id, label: p.label ?? "-", amount: p.amount_idr, status: p.status, createdAt: p.created_at, paidAt: p.paid_at, waitingAdmin: p.status === "pending" && Boolean(p.claimed_at), rejectReason: p.reject_reason })),
  };
}

/** Pembatalan: berhenti diperpanjang/diingatkan. Akses tetap sampai masa berlaku habis. Tidak ada refund. */
export async function cancelSubscription(userId: string, now = new Date()): Promise<{ expiresAt: string }> {
  const { data } = await supabaseAdmin
    .from("licenses")
    .update({ cancelled_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("source", "payment")
    .gt("expires_at", now.toISOString())
    .is("cancelled_at", null)
    .select("expires_at");
  if (data?.[0]) return { expiresAt: data[0].expires_at };
  const l = await latestLicense(userId);
  if (l?.source === "payment" && l.cancelled_at && new Date(l.expires_at) > now) return { expiresAt: l.expires_at };
  throw new Error("Tidak ada langganan berbayar yang aktif.");
}

export async function listNotifications(userId: string) {
  const { data } = await supabaseAdmin.from("notifications").select("id, kind, title, body, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
  return data ?? [];
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await supabaseAdmin.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
}

// ---------------------------------------------------------------------------
// Dashboard institusi (pembeli lisensi = admin institusinya)
// ---------------------------------------------------------------------------
export async function listOwnedInstitutions(userId: string) {
  const { data: cs } = await supabaseAdmin.from("institution_coupons").select("*").eq("owner_id", userId).order("created_at", { ascending: false });
  const out = [];
  for (const c of cs ?? []) {
    const { data: reds } = await supabaseAdmin.from("coupon_redemptions").select("user_id, email, redeemed_at").eq("coupon_id", c.id).eq("status", "redeemed").order("redeemed_at", { ascending: true });
    out.push({
      id: c.id,
      institution: c.institution_name,
      status: c.status as "pending" | "active" | "revoked",
      code: c.status === "active" ? c.code : null,
      seats: c.seats,
      used: reds?.length ?? 0,
      emailDomains: c.email_domains,
      validUntil: c.status === "active" ? c.valid_until : null,
      paidAt: c.paid_at,
      amount: c.amount_idr,
      expired: c.status === "active" && new Date(c.valid_until) <= new Date(),
      users: (reds ?? []).map((r) => ({ userId: r.user_id, email: r.email, claimedAt: r.redeemed_at })),
    });
  }
  return out;
}

export async function setInstitutionDomains(userId: string, couponId: unknown, rawDomains: unknown): Promise<string[]> {
  if (typeof couponId !== "string") throw new Error("Lisensi tidak ditemukan.");
  const domains = normalizeEmailDomains(rawDomains);
  const { data } = await supabaseAdmin.from("institution_coupons").update({ email_domains: domains }).eq("id", couponId).eq("owner_id", userId).select("id");
  if (!data?.length) throw new Error("Lisensi tidak ditemukan.");
  return domains;
}

/** Cabut akses satu pengguna: kursinya kembali ke kuota dan lisensi institusinya berakhir sekarang. */
export async function removeInstitutionUser(ownerId: string, couponId: unknown, targetUserId: unknown, now = new Date()): Promise<void> {
  if (typeof couponId !== "string" || typeof targetUserId !== "string") throw new Error("Permintaan tidak valid.");
  const { data: c } = await supabaseAdmin.from("institution_coupons").select("id, institution_name").eq("id", couponId).eq("owner_id", ownerId).maybeSingle();
  if (!c) throw new Error("Lisensi tidak ditemukan.");
  const { data: red } = await supabaseAdmin.from("coupon_redemptions").update({ status: "released" }).eq("coupon_id", c.id).eq("user_id", targetUserId).eq("status", "redeemed").select("license_id");
  if (!red?.length) throw new Error("Pengguna tidak ditemukan pada lisensi ini.");
  if (red[0]!.license_id) await supabaseAdmin.from("licenses").update({ expires_at: now.toISOString() }).eq("id", red[0]!.license_id);
  await supabaseAdmin.from("institution_coupons").update({ exhausted_at: null }).eq("id", c.id);
  await notify(targetUserId, "institution_removed", "Akses institusi dicabut", `Akses Premium dari ${c.institution_name} telah dihentikan oleh admin institusi.`);
}

// ---------------------------------------------------------------------------
// Admin: lisensi institusi (semua pembeli) dan pencabutan
// ---------------------------------------------------------------------------
export type AdminInstitutionRow = {
  id: string;
  institution: string;
  ownerEmail: string | null;
  status: "pending" | "active" | "revoked";
  code: string | null;
  seats: number;
  used: number;
  emailDomains: string[];
  validUntil: string | null;
  paidAt: string | null;
  expired: boolean;
};

export async function listInstitutionsForAdmin(adminId: string): Promise<AdminInstitutionRow[]> {
  await requireAdmin(adminId);
  const { data: cs } = await supabaseAdmin.from("institution_coupons").select("*").order("created_at", { ascending: false }).limit(100);
  const out: AdminInstitutionRow[] = [];
  for (const c of cs ?? []) {
    const { count } = await supabaseAdmin.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", c.id).eq("status", "redeemed");
    out.push({
      id: c.id,
      institution: c.institution_name,
      ownerEmail: (await getUserIdentity(c.owner_id).catch(() => null))?.email ?? null,
      status: c.status as "pending" | "active" | "revoked",
      code: c.status === "active" ? c.code : null,
      seats: c.seats,
      used: count ?? 0,
      emailDomains: c.email_domains ?? [],
      validUntil: c.status === "active" ? c.valid_until : null,
      paidAt: c.paid_at,
      expired: c.status === "active" && new Date(c.valid_until) <= new Date(),
    });
  }
  return out;
}

/** Cabut satu lisensi institusi: kupon tidak bisa diklaim lagi dan semua lisensi pengguna berakhir sekarang. */
export async function revokeInstitutionForAdmin(adminId: string, couponId: unknown, reason: unknown, now = new Date()): Promise<{ released: number }> {
  await requireAdmin(adminId);
  if (typeof couponId !== "string") throw new Error("Lisensi tidak ditemukan.");
  const why = String(reason ?? "").trim().slice(0, 300);
  if (why.length < 3) throw new Error("Tulis alasan pencabutan (minimal 3 karakter).");
  const { data: c } = await supabaseAdmin.from("institution_coupons").update({ status: "revoked" }).eq("id", couponId).neq("status", "revoked").select("id, owner_id, institution_name");
  if (!c?.length) throw new Error("Lisensi tidak ditemukan atau sudah dicabut.");
  const { data: reds } = await supabaseAdmin.from("coupon_redemptions").update({ status: "released" }).eq("coupon_id", couponId).eq("status", "redeemed").select("user_id, license_id");
  for (const r of reds ?? []) {
    if (r.license_id) await supabaseAdmin.from("licenses").update({ expires_at: now.toISOString() }).eq("id", r.license_id);
    await notify(r.user_id, "institution_removed", "Akses institusi dicabut", `Lisensi ${c[0]!.institution_name} dihentikan oleh admin SEMAR-Dock.`);
  }
  await notify(c[0]!.owner_id, "institution_removed", "Lisensi institusi dicabut", `Lisensi ${c[0]!.institution_name} dicabut. Alasan: ${why}`);
  return { released: reds?.length ?? 0 };
}
