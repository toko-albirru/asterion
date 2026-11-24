import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const userIdInput = (d: { userId: string }) => {
  if (typeof d?.userId !== "string" || !/^[0-9a-f-]{36}$/i.test(d.userId)) throw new Error("Pengguna tidak valid.");
  return { userId: d.userId };
};

/** Status verifikasi saya + konfigurasi (apakah OTP email tersedia, batas waktu pemeriksaan). */
export const getVerificationState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("@/lib/verification.server");
    return { verification: await s.getMyVerification(context.userId), config: s.verificationConfig() };
  });

export const createUploadSlot = createServerFn({ method: "POST" })
  .inputValidator((d: { mime: string; bytes: number }) => ({ mime: d?.mime, bytes: d?.bytes }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/verification.server");
    return s.createUploadSlot(context.userId, data.mime, data.bytes);
  });

export const sendCampusOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => ({ email: String(d?.email ?? "").slice(0, 200) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/verification.server");
    return s.sendOtp(context.userId, data.email);
  });

export const verifyCampusOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => ({ code: String(d?.code ?? "") }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/verification.server");
    return s.verifyOtp(context.userId, data.code);
  });

/** Isi pengajuan divalidasi ulang sepenuhnya di server (lihat parseSubmitInput). */
export const submitStudentVerification = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/verification.server");
    return s.submitVerification(context.userId, data);
  });

// ---- Admin ----
export const adminListVerifications = createServerFn({ method: "POST" })
  .inputValidator((d: { status: "pending" | "verified" | "rejected" }) => {
    if (d?.status !== "pending" && d?.status !== "verified" && d?.status !== "rejected") throw new Error("Permintaan tidak valid.");
    return { status: d.status };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/verification.server");
    return s.listVerificationsForAdmin(context.userId, data.status);
  });

export const adminVerificationDocs = createServerFn({ method: "POST" })
  .inputValidator(userIdInput)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/verification.server");
    return s.verificationDocLinks(context.userId, data.userId);
  });

export const adminReviewVerification = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; action: "approve" | "reject"; reason?: string }) => {
    if (d?.action !== "approve" && d?.action !== "reject") throw new Error("Permintaan tidak valid.");
    return { ...userIdInput(d), action: d.action, reason: d.reason };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/verification.server");
    await s.reviewVerification(context.userId, data.userId, data.action, data.reason);
    return { ok: true as const };
  });

export const adminRevokeVerification = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; reason: string }) => ({ ...userIdInput(d), reason: String(d?.reason ?? "") }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/verification.server");
    await s.revokeVerification(context.userId, data.userId, data.reason);
    return { ok: true as const };
  });

export const adminListDomainRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("@/lib/verification.server");
    return s.listDomainRules(context.userId);
  });

export const adminSetDomainRule = createServerFn({ method: "POST" })
  .inputValidator((d: { domain: string; kind: "allow" | "block"; note?: string }) => ({ domain: d?.domain, kind: d?.kind, note: d?.note }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/verification.server");
    await s.setDomainRule(context.userId, data.domain, data.kind, data.note);
    return { ok: true as const };
  });

export const adminDeleteDomainRule = createServerFn({ method: "POST" })
  .inputValidator((d: { domain: string }) => ({ domain: d?.domain }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const s = await import("@/lib/verification.server");
    await s.deleteDomainRule(context.userId, data.domain);
    return { ok: true as const };
  });
