// Hanya untuk server. Dipanggil dari *.functions.ts lewat dynamic import dan dari route webhook.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { generateToken, nextPeriod } from "@/lib/license";
import {
  attachLicenseToRedemption,
  getUserIdentity,
  redeemSeat,
  releaseSeat,
  releaseLapsedSeats,
  reserveSeat,
  resolveCouponForUser,
  SeatConflict,
  type CouponRow,
} from "@/lib/coupon.server";
import { purchaseQuote, type PurchaseQuote } from "@/lib/coupons";
import {
  CANCEL_NOTE_MAX,
  PAYMENT_EXPIRY_MINUTES,
  evaluateMidtransStatus,
  isRecord,
  isValidOrderId,
  makeOrderId,
  parsePaymentMode,
  validateSnapResponse,
  verifyMidtransSignature,
  type CancelReason,
  type PaymentMode,
  type PaymentStatus,
  type PurchaseRequest,
} from "@/lib/payments";

/** Batas waktu panggilan ke Midtrans, supaya request pengguna/webhook tidak menggantung. */
const MIDTRANS_TIMEOUT_MS = 10_000;
/** Notifikasi Midtrans hanya beberapa KB; lebih dari ini pasti bukan dari Midtrans. */
const MAX_NOTIFICATION_BYTES = 16 * 1024;

export function getPaymentMode(): PaymentMode {
  return parsePaymentMode(process.env["PAYMENT_MODE"]);
}

function midtrans() {
  const key = process.env["MIDTRANS_SERVER_KEY"];
  if (!key) throw new Error("MIDTRANS_SERVER_KEY belum diisi di server.");
  const prod = (process.env["MIDTRANS_IS_PRODUCTION"] ?? "").toLowerCase() === "true";
  return {
    key,
    base: prod ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com",
    snapBase: prod ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com",
    prod,
    auth: "Basic " + btoa(`${key}:`),
  };
}

export function midtransServerKey(): string {
  return midtrans().key;
}

function timeoutSignal(): AbortSignal | null {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(MIDTRANS_TIMEOUT_MS)
    : null;
}

/** Konfigurasi publik untuk memuat snap.js di browser. Client key memang dirancang untuk publik. */
export function getSnapConfig(): { clientKey: string | null; scriptUrl: string } {
  const prod = (process.env["MIDTRANS_IS_PRODUCTION"] ?? "").toLowerCase() === "true";
  return {
    clientKey: process.env["MIDTRANS_CLIENT_KEY"] || null,
    scriptUrl: `${prod ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com"}/snap/snap.js`,
  };
}

/**
 * Buat transaksi Snap di Midtrans (Snap Checkout: VA, kartu, e-wallet, QRIS, dll. sesuai pengaturan dashboard).
 * Mengembalikan token Snap (dipakai snap.pay di browser) dan redirect_url sebagai cadangan.
 */
export async function createSnapTransaction(
  orderId: string,
  amount: number,
  item: { id: string; name: string },
  email?: string | null,
) {
  const m = midtrans();
  const failure = new Error("Gagal membuat tagihan. Coba lagi sebentar lagi.");

  let res: Response;
  try {
    res = await fetch(`${m.snapBase}/snap/v1/transactions`, {
      method: "POST",
      headers: { Authorization: m.auth, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: item.id, name: item.name.slice(0, 50), price: amount, quantity: 1 }],
        ...(email ? { customer_details: { email } } : {}),
        expiry: { unit: "minutes", duration: PAYMENT_EXPIRY_MINUTES },
      }),
      signal: timeoutSignal(),
    });
  } catch {
    console.error("[midtrans] snap tidak terjangkau", orderId);
    throw failure;
  }

  const body: unknown = await res.json().catch(() => null);
  const problem = res.ok ? validateSnapResponse(body) : "status_code";
  if (problem) {
    console.error("[midtrans] snap ditolak", orderId, res.status, problem, isRecord(body) ? body["error_messages"] : undefined);
    throw failure;
  }
  const b = body as Record<string, unknown>;
  return { snapToken: b["token"] as string, redirectUrl: b["redirect_url"] as string };
}

/**
 * Status terbaru dari Midtrans (sumber kebenaran; body webhook tidak dipercaya mentah-mentah).
 * Melempar error bila Midtrans tidak terjangkau/error server/kunci ditolak, supaya webhook dijawab 500
 * (Midtrans mengirim ulang) dan polling pengguna mencoba lagi. Order yang belum dikenal = status_code "404".
 */
export async function fetchMidtransStatus(orderId: string): Promise<Record<string, unknown>> {
  const m = midtrans();
  const res = await fetch(`${m.base}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Authorization: m.auth, Accept: "application/json" },
    signal: timeoutSignal(),
  });
  if (res.status === 401 || res.status === 403) {
    console.error("[midtrans] kunci ditolak saat CEK STATUS; periksa MIDTRANS_SERVER_KEY dan MIDTRANS_IS_PRODUCTION");
    throw new Error("Penyedia pembayaran menolak kredensial server (saat cek status).");
  }
  if (res.status === 404) return { status_code: "404" };
  const body: unknown = await res.json().catch(() => null);
  if (res.status >= 500 || !isRecord(body)) throw new Error("Status pembayaran belum bisa dibaca dari penyedia.");
  return body;
}

/**
 * Tandai pembayaran lunas dan terbitkan token Pro. Aman dipanggil berulang
 * (webhook bisa terkirim lebih dari sekali): satu pembayaran = satu token.
 *
 * PENTING: fungsi ini TIDAK memeriksa pembayaran ke Midtrans. Ia hanya boleh dipanggil setelah bukti
 * pembayaran divalidasi (syncMidtransPayment), untuk pembayaran yang sudah berstatus paid di database,
 * atau dari mockPay yang hanya hidup di PAYMENT_MODE=mock.
 */
export async function settlePaid(orderId: string): Promise<void> {
  const { data: pay } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, amount_idr, status, license_id, provider, kind, days, coupon_id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!pay) return;
  // Lapis kedua: pembayaran palsu (mock) tidak boleh menerbitkan token di luar mode mock.
  if (pay.provider === "mock" && getPaymentMode() !== "mock") return;

  const now = new Date();
  if (pay.status !== "paid") {
    await supabaseAdmin
      .from("payments")
      .update({ status: "paid", paid_at: now.toISOString() })
      .eq("id", pay.id)
      .neq("status", "paid");
  }

  // Pembelian institusi: tidak ada token; kuponnya diaktifkan (idempoten).
  if (pay.kind === "institution") {
    if (pay.coupon_id) {
      await supabaseAdmin
        .from("institution_coupons")
        .update({ status: "active", paid_at: now.toISOString() })
        .eq("id", pay.coupon_id)
        .neq("status", "active");
    }
    return;
  }

  if (pay.license_id) return;

  // Pembelian dengan kupon: kursi menjadi terpakai SEBELUM token terbit. Bila langkah berikutnya terputus,
  // pemanggilan ulang (webhook/polling) tidak kehilangan kursi dan tidak menerbitkan token dua kali.
  if (pay.coupon_id) await redeemSeat(orderId, now);

  const days = pay.days ?? undefined;
  const { data: latest } = await supabaseAdmin
    .from("licenses")
    .select("expires_at")
    .eq("user_id", pay.user_id)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { startsAt, expiresAt } = nextPeriod(latest ? new Date(latest.expires_at) : null, now, days);

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: lic, error } = await supabaseAdmin
      .from("licenses")
      .insert({
        user_id: pay.user_id,
        token: generateToken(),
        plan: "individual",
        price_idr: pay.amount_idr,
        payment_status: "paid",
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") continue; // token bentrok, coba lagi
      throw new Error("Gagal membuat token setelah pembayaran.");
    }
    // Hanya satu pemroses yang boleh menautkan token; yang kalah balapan menghapus token duplikatnya.
    const { data: linked } = await supabaseAdmin
      .from("payments")
      .update({ license_id: lic.id })
      .eq("id", pay.id)
      .is("license_id", null)
      .select("id");
    if (!linked || linked.length === 0) await supabaseAdmin.from("licenses").delete().eq("id", lic.id);
    else if (pay.coupon_id) await attachLicenseToRedemption(orderId, lic.id);
    return;
  }
  throw new Error("Gagal membuat token setelah pembayaran.");
}

export async function setUnpaidStatus(orderId: string, status: Exclude<PaymentStatus, "paid" | "pending">) {
  const { data: closed } = await supabaseAdmin
    .from("payments")
    .update({ status })
    .eq("order_id", orderId)
    .eq("status", "pending")
    .select("coupon_id, kind");
  // Pembayaran batal/gagal/kedaluwarsa: kursi kupon kembali (kupon dianggap tidak terpakai).
  if (closed?.some((p) => p.kind === "individual" && p.coupon_id)) await releaseSeat(orderId);
}

/**
 * Sinkronkan satu pembayaran dengan Midtrans. Mengembalikan status terbaru.
 * Token hanya terbit bila Midtrans sendiri menyatakan lunas DAN order_id, status_code, payment_type,
 * mata uang, dan gross_amount cocok dengan tagihan kita. Bukti yang tidak lengkap/tidak cocok = failed.
 */
export async function syncMidtransPayment(orderId: string): Promise<PaymentStatus> {
  const { data: pay } = await supabaseAdmin
    .from("payments")
    .select("status, amount_idr, provider")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!pay) return "failed";
  // Notifikasi Midtrans tidak boleh menyentuh pembayaran milik provider lain (mis. mock).
  if (pay.provider !== "midtrans") return pay.status as PaymentStatus;
  if (pay.status === "paid") {
    await settlePaid(orderId); // jaga-jaga bila penerbitan token sebelumnya terputus
    return "paid";
  }

  const remote = await fetchMidtransStatus(orderId);
  const verdict = evaluateMidtransStatus(remote, { orderId, amountIdr: pay.amount_idr });
  if (verdict.problem) console.error("[midtrans] respons status tidak lolos validasi", orderId, verdict.problem);

  if (verdict.status === "paid") {
    await settlePaid(orderId);
    return "paid";
  }
  if (verdict.status === "expired" || verdict.status === "failed") await setUnpaidStatus(orderId, verdict.status);
  return verdict.status;
}

type PaymentsClient = SupabaseClient<Database>;

/** Pembayaran lunas milik pengguna yang tokennya belum terbit (penerbitan sebelumnya terputus). */
async function findUnsettledPaid(userId: string, mode: PaymentMode): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("payments")
    .select("order_id")
    .eq("user_id", userId)
    .eq("status", "paid")
    .eq("provider", mode)
    .eq("kind", "individual")
    .is("license_id", null);
  return (data ?? []).map((p) => p.order_id);
}

type Plan = {
  kind: "individual" | "institution";
  amount: number;
  days: number;
  discount: number;
  /** individual: kupon yang dipakai; institution: kupon yang dibeli. */
  coupon: CouponRow | null;
  item: { id: string; name: string };
  email: string | null;
};

/** Hitung apa yang ditagih. Semua angka dari server; browser hanya mengirim jumlah hari/kode kupon. */
export async function planPurchase(_supabase: PaymentsClient, userId: string, request: PurchaseRequest, now: Date): Promise<Plan> {
  if (request.kind === "institution") {
    const { data: coupon } = await supabaseAdmin
      .from("institution_coupons")
      .select("*")
      .eq("id", request.couponId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!coupon) throw new Error("Kupon tidak ditemukan.");
    if (coupon.status === "active") throw new Error("Kupon ini sudah dibayar.");
    return {
      kind: "institution",
      amount: coupon.amount_idr,
      days: coupon.days,
      discount: 0,
      coupon,
      item: { id: "semardock-kupon-institusi", name: `Kupon SEMAR-Dock ${coupon.seats} pengguna x ${coupon.days} hari` },
      email: null,
    };
  }

  let coupon: CouponRow | null = null;
  let email: string | null = null;
  if (request.couponCode) {
    const who = await getUserIdentity(userId);
    email = who.email;
    coupon = await resolveCouponForUser(request.couponCode, userId, now, who);
  }
  const quote = purchaseQuote(request.days, coupon ? { days: coupon.days, discountPct: coupon.discount_pct } : null);
  return {
    kind: "individual",
    amount: quote.amountIdr,
    days: quote.totalDays,
    discount: quote.discountIdr,
    coupon,
    item: { id: `semardock-pro-${quote.totalDays}d`, name: `SEMAR-Dock Pro ${quote.totalDays} hari${coupon ? " (kupon institusi)" : ""}` },
    email,
  };
}

/** Rincian harga untuk ditampilkan sebelum membayar (tanpa menahan kursi/menulis apa pun). */
export async function quoteForUser(
  supabase: PaymentsClient,
  userId: string,
  req: { days: number; couponCode?: string | undefined },
  now = new Date(),
): Promise<PurchaseQuote & { coupon: { institutionName: string; validUntil: string; emailDomain: string | null } | null }> {
  let coupon: CouponRow | null = null;
  if (req.couponCode) coupon = await resolveCouponForUser(req.couponCode, userId, now, await getUserIdentity(userId));
  const quote = purchaseQuote(req.days, coupon ? { days: coupon.days, discountPct: coupon.discount_pct } : null);
  return {
    ...quote,
    coupon: coupon ? { institutionName: coupon.institution_name, validUntil: coupon.valid_until, emailDomain: coupon.email_domain } : null,
  };
}

/**
 * Buat transaksi Snap baru atau lanjutkan yang masih berlaku. Tahan klik ganda/permintaan bersamaan:
 * di database hanya boleh ada satu pembayaran pending per pengguna (indeks unik parsial), dan yang
 * kalah balapan mengembalikan tagihan pemenang. `supabase` = klien milik pengguna (RLS).
 * Tagihan pending dengan isi berbeda (hari/kupon lain) ditutup dulu di Midtrans, lalu dibuat yang baru.
 */
export async function createPaymentForUser(
  supabase: PaymentsClient,
  userId: string,
  request: PurchaseRequest,
  now = new Date(),
): Promise<{ orderId: string }> {
  const mode = getPaymentMode();
  if (mode === "promo") throw new Error("Pembayaran belum diaktifkan.");
  // Mode qris memakai alur baru (premium.server.ts), bukan Snap/mock lama.
  if (mode === "qris") throw new Error("Gunakan halaman Langganan untuk membeli Premium.");

  // Sudah bayar tapi token belum terbit: selesaikan dulu, jangan suruh bayar dua kali.
  if (request.kind === "individual") {
    const unsettled = await findUnsettledPaid(userId, mode);
    if (unsettled.length > 0) {
      for (const orderId of unsettled) await settlePaid(orderId);
      const stillOpen = await findUnsettledPaid(userId, mode);
      throw new Error(
        stillOpen.length === 0
          ? "Pembayaran Anda sebelumnya sudah diterima dan token sudah diterbitkan. Muat ulang halaman."
          : "Pembayaran Anda sebelumnya sudah diterima dan sedang diproses. Coba lagi sebentar lagi.",
      );
    }
  }

  const plan = await planPurchase(supabase, userId, request, now);
  const nowIso = now.toISOString();

  // Tagihan pending yang ada: sama persis = lanjutkan; basi/milik provider lain = tutup di database;
  // masih berlaku tapi isinya beda = batalkan lewat Midtrans (supaya VA/QR lamanya tidak bisa dibayar lagi).
  const { data: openRows } = await supabaseAdmin
    .from("payments")
    .select("order_id, provider, kind, days, coupon_id, amount_idr, expires_at")
    .eq("user_id", userId)
    .eq("status", "pending");
  for (const o of openRows ?? []) {
    const live = o.provider === mode && o.expires_at !== null && new Date(o.expires_at).getTime() > now.getTime();
    if (live && o.kind === plan.kind && o.coupon_id === (plan.coupon?.id ?? null) && o.days === plan.days && o.amount_idr === plan.amount) {
      return { orderId: o.order_id };
    }
    if (live) await cancelPendingPaymentForUser(userId);
    else await setUnpaidStatus(o.order_id, "expired");
  }
  if (plan.kind === "individual" && plan.coupon) await releaseLapsedSeats(userId, now);

  const findOpen = async () => {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("order_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("provider", mode)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };

  const orderId = makeOrderId();
  const expiresAt = new Date(now.getTime() + PAYMENT_EXPIRY_MINUTES * 60000);

  // Kupon individu: tahan kursi SEBELUM tagihan dibuat. Kursi baru terpakai bila pembayaran lunas.
  let seatHeld = false;
  if (plan.kind === "individual" && plan.coupon) {
    try {
      await reserveSeat(plan.coupon, userId, plan.email ?? "", orderId, expiresAt, now);
      seatHeld = true;
    } catch (e) {
      if (e instanceof SeatConflict) {
        // Klik ganda: permintaan lain dari pengguna ini sedang membuat tagihannya (kursi ditahan lebih dulu).
        // Tunggu sebentar sampai tagihannya tersimpan, lalu pakai tagihan itu.
        for (let i = 0; i < 40; i++) {
          const winner = await findOpen();
          if (winner) return { orderId: winner.order_id };
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      throw e;
    }
  }

  try {
    let snapToken: string | null = null;
    let snapRedirectUrl: string | null = null;
    if (mode === "midtrans") {
      const snap = await createSnapTransaction(orderId, plan.amount, plan.item);
      snapToken = snap.snapToken;
      snapRedirectUrl = snap.redirectUrl;
    }
    // mode mock: tanpa token Snap, hanya tombol "Simulasikan bayar" di halaman Akun (tidak bisa dibayar sungguhan)

    const { error } = await supabaseAdmin.from("payments").insert({
      order_id: orderId,
      user_id: userId,
      provider: mode,
      kind: plan.kind,
      days: plan.days,
      coupon_id: plan.coupon?.id ?? null,
      discount_idr: plan.discount,
      amount_idr: plan.amount,
      status: "pending",
      snap_token: snapToken,
      snap_redirect_url: snapRedirectUrl,
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      if (seatHeld) await releaseSeat(orderId);
      seatHeld = false;
      if (error.code === "23505") {
        // Permintaan lain menang balapan: pakai tagihannya. Tagihan Midtrans kita yang tak terpakai kedaluwarsa sendiri.
        const winner = await findOpen();
        if (winner) return { orderId: winner.order_id };
      }
      throw new Error("Gagal menyimpan tagihan.");
    }
    return { orderId };
  } catch (e) {
    if (seatHeld) await releaseSeat(orderId);
    throw e;
  }
}

async function postMidtransAction(orderId: string, action: "expire" | "cancel"): Promise<{ http: number; body: unknown; raw: string }> {
  const m = midtrans();
  const res = await fetch(`${m.base}/v2/${encodeURIComponent(orderId)}/${action}`, {
    method: "POST",
    // Sama seperti contoh resmi Midtrans: Content-Type JSON + body kosong "{}". Tanpa ini, sebagian permintaan POST ditolak (403).
    headers: { Authorization: m.auth, Accept: "application/json", "Content-Type": "application/json" },
    body: "{}",
    signal: timeoutSignal(),
  });
  const raw = await res.text().catch(() => "");
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    /* jawaban bukan JSON (mis. halaman penolakan) */
  }
  return { http: res.status, body, raw };
}

/**
 * Minta Midtrans menutup transaksi yang masih pending, mis. VA/GoPay/QRIS yang sudah terlanjur dipilih.
 * Dicoba lewat expire; bila ditolak (401/403) dicoba lewat cancel.
 * "expired" = berhasil ditutup; "not_found" = belum pernah ada charge (pembeli belum memilih metode);
 * "refused" = Midtrans menolak karena status sudah berubah (biasanya baru saja lunas).
 */
export async function expireMidtransTransaction(orderId: string): Promise<"expired" | "not_found" | "refused"> {
  let r = await postMidtransAction(orderId, "expire");
  if (r.http === 401 || r.http === 403) r = await postMidtransAction(orderId, "cancel");

  if (r.http === 401 || r.http === 403) {
    const snippet = r.raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    const detail = isRecord(r.body) && typeof r.body["status_message"] === "string" ? r.body["status_message"] : snippet || "(tanpa pesan)";
    console.error(`[midtrans] ditolak saat MENUTUP tagihan (expire dan cancel), HTTP ${r.http}: ${detail}`);
    throw new Error(`Midtrans menolak permintaan menutup tagihan lama (HTTP ${r.http}: ${detail}).`);
  }
  if (r.http === 404) return "not_found";
  if (r.http >= 500 || !isRecord(r.body)) throw new Error("Tagihan lama belum bisa ditutup. Coba lagi sebentar lagi.");
  const b = r.body;
  // Midtrans menaruh hasil di body: sukses = transaction_status "expire" (expire) atau "cancel" (cancel) untuk order ini.
  if (b["order_id"] === orderId && (b["transaction_status"] === "expire" || b["transaction_status"] === "cancel")) return "expired";
  if (b["status_code"] === "404") return "not_found";
  return "refused";
}

/**
 * Batalkan pembayaran yang masih pending: tagihan ditutup di Midtrans (VA/GoPay/QRIS lama tidak bisa dibayar lagi)
 * dan di database, sehingga pembeli bisa klik "Bayar" lagi untuk membuat tagihan baru dan memilih metode lain.
 * Aman terhadap balapan dengan pembayaran: bila tagihan ternyata sudah lunas, tidak dibatalkan
 * (token diterbitkan untuk pembayaran itu) dan pengguna diberi tahu.
 * Alasan pembatalan (opsional) disimpan setelah tagihan berhasil ditutup; gagal menyimpan alasan tidak menggagalkan pembatalan.
 */
export async function cancelPendingPaymentForUser(
  userId: string,
  why?: { reason: CancelReason; note?: string | null },
): Promise<{ cancelled: boolean; request?: PurchaseRequest | undefined }> {
  const mode = getPaymentMode();
  if (mode === "promo") throw new Error("Pembayaran belum diaktifkan.");

  const { data: open } = await supabaseAdmin
    .from("payments")
    .select("order_id, provider, kind, days, coupon_id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (!open) return { cancelled: false }; // tidak ada tagihan pending: tidak ada yang perlu dibatalkan

  if (open.provider === "midtrans" && mode === "midtrans") {
    // Cek dulu: kalau sudah lunas, jangan dibatalkan.
    const before = await syncMidtransPayment(open.order_id);
    if (before === "paid") throw new Error("Pembayaran Anda sudah diterima dan token Pro sudah terbit. Muat ulang halaman.");
    if (before === "pending") {
      const result = await expireMidtransTransaction(open.order_id);
      if (result === "refused") {
        // Status berubah di antara dua panggilan: baca ulang, jangan menebak.
        const after = await syncMidtransPayment(open.order_id);
        if (after === "paid") throw new Error("Pembayaran Anda sudah diterima dan token Pro sudah terbit. Muat ulang halaman.");
        if (after === "pending") throw new Error("Pembayaran ini belum bisa dibatalkan. Selesaikan pembayarannya atau tunggu sampai kedaluwarsa.");
      }
      await setUnpaidStatus(open.order_id, "expired");
    }
    // before = expired/failed: syncMidtransPayment sudah menutupnya di database.
  } else {
    await setUnpaidStatus(open.order_id, "expired"); // tagihan mock / sisa mode lain: cukup ditutup di database
  }
  if (why) {
    const note = why.reason === "lainnya" ? (why.note ?? "").trim().slice(0, CANCEL_NOTE_MAX) : "";
    const { error } = await supabaseAdmin
      .from("payments")
      .update({ cancel_reason: why.reason, cancel_note: note || null, cancelled_at: new Date().toISOString() })
      .eq("order_id", open.order_id)
      .eq("user_id", userId);
    if (error) console.error("[payment] alasan pembatalan tidak tersimpan (sudah jalankan migrasi payments_cancel_reason.sql?):", error.message);
  }
  return { cancelled: true, request: await requestFromPayment(open) };
}

/** Susun ulang permintaan beli dari tagihan yang baru dibatalkan, supaya "ganti metode" membuat tagihan yang sama persis. */
async function requestFromPayment(p: { kind: string; days: number | null; coupon_id: string | null }): Promise<PurchaseRequest | undefined> {
  if (p.kind === "institution") return p.coupon_id ? { kind: "institution", couponId: p.coupon_id } : undefined;
  if (!p.days) return undefined;
  if (!p.coupon_id) return { kind: "individual", days: p.days };
  const { data: c } = await supabaseAdmin.from("institution_coupons").select("code").eq("id", p.coupon_id).maybeSingle();
  return { kind: "individual", days: p.days, ...(c ? { couponCode: c.code } : {}) };
}

export type NotificationResult = { status: number; body: { ok: boolean } };

/**
 * Proses notifikasi Midtrans yang sudah di-parse. Urutan pemeriksaan sengaja ketat:
 * bentuk body -> mode -> tanda tangan -> format order_id -> baca ulang status dari Midtrans (syncMidtransPayment).
 * Isi notifikasi sendiri tidak pernah menjadi dasar penerbitan token; hanya tanda tangan yang sah yang
 * membuka pintu ke pengecekan langsung ke Midtrans.
 */
export async function processMidtransNotification(body: unknown): Promise<NotificationResult> {
  const reply = (status: number, ok = false): NotificationResult => ({ status, body: { ok } });
  if (!isRecord(body)) return reply(400);
  if (getPaymentMode() !== "midtrans") return reply(404);

  let key: string;
  try {
    key = midtransServerKey();
  } catch (e) {
    console.error("[midtrans] webhook tidak bisa diverifikasi", e instanceof Error ? e.message : e);
    return reply(500);
  }
  if (!(await verifyMidtransSignature(body, key))) return reply(403);

  const orderId = body["order_id"];
  if (!isValidOrderId(orderId)) return reply(400);

  try {
    await syncMidtransPayment(orderId);
  } catch (e) {
    console.error("[midtrans] webhook gagal diproses", orderId, e instanceof Error ? e.message : e);
    return reply(500); // Midtrans akan mengirim ulang
  }
  return reply(200, true);
}

/** Baca & parse body notifikasi dengan batas ukuran. Mengembalikan undefined bila terlalu besar/bukan JSON. */
export async function readNotificationBody(request: Request): Promise<{ tooLarge: boolean; body?: unknown }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_NOTIFICATION_BYTES) return { tooLarge: true };
  const raw = await request.text();
  if (raw.length > MAX_NOTIFICATION_BYTES) return { tooLarge: true };
  try {
    return { tooLarge: false, body: JSON.parse(raw) };
  } catch {
    return { tooLarge: false };
  }
}
