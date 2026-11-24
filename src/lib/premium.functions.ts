import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseOrderRequest, quoteOrder, type OrderRequest } from "@/lib/orders";
import { isValidOrderId } from "@/lib/payments";

const orderIdInput = (d: { orderId: string }) => {
  if (!isValidOrderId(d?.orderId)) throw new Error("Tagihan tidak ditemukan.");
  return { orderId: d.orderId };
};

/** Publik: apakah pembayaran QRIS aktif (QRIS_STATIC benar) + nama merchant + batas waktu konfirmasi. */
export const getPremiumConfig = createServerFn({ method: "GET" }).handler(async () => {
  const s = await import("@/lib/premium.server");
  return s.publicConfig();
});

/** Rincian harga murni (tanpa login/database): dipakai UI untuk menampilkan angka yang sama dengan yang ditagih. */
export const quoteOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: OrderRequest) => parseOrderRequest(d))
  .handler(async ({ data }) => quoteOrder(data));

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: OrderRequest) => parseOrderRequest(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    return s.createOrderForUser(context.userId, data);
  });

export const getOrder = createServerFn({ method: "POST" })
  .inputValidator(orderIdInput)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    return s.getOrderForUser(context.userId, data.orderId);
  });

export const markPaid = createServerFn({ method: "POST" })
  .inputValidator(orderIdInput)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    await s.claimPaid(context.userId, data.orderId);
    return { ok: true as const };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .inputValidator(orderIdInput)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    await s.cancelOrder(context.userId, data.orderId);
    return { ok: true as const };
  });

export const getBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("@/lib/premium.server");
    return s.billingOverview(context.userId);
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("@/lib/premium.server");
    return s.cancelSubscription(context.userId);
  });

export const claimCoupon = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => ({ code: typeof d?.code === "string" ? d.code.slice(0, 60) : "" }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    return s.claimCoupon(context.userId, data.code);
  });

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("@/lib/premium.server");
    return s.listNotifications(context.userId);
  });

export const readNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("@/lib/premium.server");
    await s.markNotificationsRead(context.userId);
    return { ok: true as const };
  });

// ---- Admin (dicek ulang di server lewat ADMIN_EMAILS + email terkonfirmasi) ----
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("@/lib/premium.server");
    return { admin: await s.isAdmin(context.userId) };
  });

export const adminListPayments = createServerFn({ method: "POST" })
  .inputValidator((d: { scope: "claimed" | "open" | "recent" }) => {
    if (d?.scope !== "claimed" && d?.scope !== "open" && d?.scope !== "recent") throw new Error("Permintaan tidak valid.");
    return { scope: d.scope };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    return s.listPaymentsForAdmin(context.userId, data.scope);
  });

export const adminConfirmPayment = createServerFn({ method: "POST" })
  .inputValidator(orderIdInput)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    return s.confirmPayment(context.userId, data.orderId);
  });

export const adminRejectPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { orderId: string; reason: string }) => ({ ...orderIdInput(d), reason: String(d?.reason ?? "") }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    await s.rejectPayment(context.userId, data.orderId, data.reason);
    return { ok: true as const };
  });

// ---- Dashboard institusi (pembeli lisensi = admin institusinya; kepemilikan dicek di server) ----
export const getMyInstitutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("@/lib/premium.server");
    return s.listOwnedInstitutions(context.userId);
  });

export const saveInstitutionDomains = createServerFn({ method: "POST" })
  .inputValidator((d: { couponId: string; domains: string }) => ({ couponId: String(d?.couponId ?? ""), domains: String(d?.domains ?? "").slice(0, 2000) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    return { domains: await s.setInstitutionDomains(context.userId, data.couponId, data.domains) };
  });

export const removeInstitutionMember = createServerFn({ method: "POST" })
  .inputValidator((d: { couponId: string; userId: string }) => ({ couponId: String(d?.couponId ?? ""), userId: String(d?.userId ?? "") }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    await s.removeInstitutionUser(context.userId, data.couponId, data.userId);
    return { ok: true as const };
  });

// ---- Admin: lisensi institusi ----
export const adminListInstitutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("@/lib/premium.server");
    return s.listInstitutionsForAdmin(context.userId);
  });

export const adminRevokeInstitution = createServerFn({ method: "POST" })
  .inputValidator((d: { couponId: string; reason: string }) => ({ couponId: String(d?.couponId ?? ""), reason: String(d?.reason ?? "") }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/premium.server");
    return s.revokeInstitutionForAdmin(context.userId, data.couponId, data.reason);
  });
