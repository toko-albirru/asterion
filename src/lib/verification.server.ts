// Verifikasi mahasiswa: OTP email kampus, unggah dokumen, keputusan otomatis/admin, pembersihan dokumen.
// Hanya untuk server. OCR dan pemeriksaan gambar hanya sinyal; BUKAN bukti keaslian KTM atau status aktif.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notify, requireAdmin } from "@/lib/premium.server";
import { getUserIdentity } from "@/lib/coupon.server";
import { normalizeEmailDomains, normalizeRejectReason } from "@/lib/orders";
import { parseSubmitInput } from "@/lib/verification";
import {
  ALLOWED_MIME,
  DOC_RETENTION_DAYS,
  MAX_UPLOAD_BYTES,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_HOUR,
  OTP_TTL_MINUTES,
  OTP_VERIFIED_WINDOW_MINUTES,
  RENEW_WINDOW_DAYS,
  REVIEW_SLA_HOURS,
  assessImageQuality,
  campusDomain,
  classifyStudentEmail,
  decideVerification,
  effectiveStatus,
  generateOtp,
  hmacHex,
  identityKey,
  isOtpFormat,
  normalizeName,
  parseKtmText,
  verificationExpiry,
  type DomainRules,
  type EmailCheck,
} from "@/lib/student";

const BUCKET = "student-docs";
const MIN_MS = 60_000;
const DAY_MS = 86_400_000;
const fmtDate = (d: Date | string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(d));

export function verificationConfig() {
  return { otpAvailable: Boolean(process.env["RESEND_API_KEY"] && process.env["NOTIFY_FROM_EMAIL"]), reviewHours: REVIEW_SLA_HOURS, maxUploadMb: MAX_UPLOAD_BYTES / 1024 / 1024, retentionDays: DOC_RETENTION_DAYS };
}

/** Rahasia untuk HMAC NIM/OTP. Disarankan NIM_HASH_SECRET sendiri; bila kosong memakai service role key. */
function secret(): string {
  const s = process.env["NIM_HASH_SECRET"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!s) throw new Error("Rahasia server belum dikonfigurasi.");
  return s;
}

async function domainRules(): Promise<DomainRules> {
  const { data } = await supabaseAdmin.from("student_domain_rules").select("domain, kind");
  return { allow: (data ?? []).filter((r) => r.kind === "allow").map((r) => r.domain), block: (data ?? []).filter((r) => r.kind === "block").map((r) => r.domain) };
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["NOTIFY_FROM_EMAIL"];
  if (!key || !from) throw new Error("Pengiriman email belum dikonfigurasi.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text: body }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || !res.ok) throw new Error("Gagal mengirim email. Coba lagi sebentar.");
}

// ---------------------------------------------------------------------------
// Unggah dokumen (bucket privat; browser mengunggah langsung lewat tautan bertanda tangan sekali pakai)
// ---------------------------------------------------------------------------
export async function createUploadSlot(userId: string, mime: unknown, bytes: unknown): Promise<{ path: string; token: string }> {
  if (typeof mime !== "string" || !(ALLOWED_MIME as readonly string[]).includes(mime)) throw new Error("Format berkas harus JPG, PNG, atau PDF.");
  if (typeof bytes !== "number" || !Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_UPLOAD_BYTES) throw new Error(`Ukuran berkas maksimal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const { data: existing } = await supabaseAdmin.storage.from(BUCKET).list(userId, { limit: 20 });
  if ((existing?.length ?? 0) >= 8) throw new Error("Terlalu banyak berkas yang belum dipakai. Selesaikan pengajuan Anda, atau coba lagi nanti.");
  const ext = mime === "image/png" ? "png" : mime === "application/pdf" ? "pdf" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("Gagal menyiapkan unggahan. Coba lagi.");
  return { path, token: data.token };
}

async function assertFilesExist(userId: string, paths: (string | null)[]) {
  const { data } = await supabaseAdmin.storage.from(BUCKET).list(userId, { limit: 50 });
  const names = new Set((data ?? []).map((f) => f.name));
  for (const p of paths) if (p && !names.has(p.slice(userId.length + 1))) throw new Error("Berkas belum selesai diunggah. Unggah ulang.");
}

// ---------------------------------------------------------------------------
// OTP email kampus
// ---------------------------------------------------------------------------
export async function sendOtp(userId: string, rawEmail: string, now = new Date()): Promise<{ email: string }> {
  if (!verificationConfig().otpAvailable) throw new Error("OTP email kampus belum tersedia. Gunakan unggah KRS atau surat keterangan mahasiswa aktif.");
  const check = classifyStudentEmail(rawEmail, await domainRules());
  if (!check.ok) throw new Error(check.reason);

  const { data: row } = await supabaseAdmin.from("email_otps").select("*").eq("user_id", userId).maybeSingle();
  let sendCount = 1;
  let windowStart = now;
  if (row && new Date(row.window_start).getTime() > now.getTime() - 60 * MIN_MS) {
    if (row.send_count >= OTP_MAX_SENDS_PER_HOUR) throw new Error("Terlalu sering meminta kode. Coba lagi dalam 1 jam.");
    sendCount = row.send_count + 1;
    windowStart = new Date(row.window_start);
  }
  const code = generateOtp();
  const { error } = await supabaseAdmin.from("email_otps").upsert(
    {
      user_id: userId,
      email: check.email,
      code_hash: await hmacHex(secret(), `${userId}:${check.email}:${code}`),
      expires_at: new Date(now.getTime() + OTP_TTL_MINUTES * MIN_MS).toISOString(),
      attempts: 0,
      send_count: sendCount,
      window_start: windowStart.toISOString(),
      verified_at: null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("Gagal membuat kode. Coba lagi.");
  await sendEmail(check.email, "Kode verifikasi mahasiswa SEMAR-Dock", `Kode verifikasi Anda: ${code}\n\nBerlaku ${OTP_TTL_MINUTES} menit. Jangan bagikan kode ini kepada siapa pun.\nAbaikan email ini bila Anda tidak memintanya.\n\nSEMAR-Dock`);
  return { email: check.email };
}

export async function verifyOtp(userId: string, code: unknown, now = new Date()): Promise<{ email: string }> {
  if (!isOtpFormat(code)) throw new Error("Kode harus 6 angka.");
  const { data: row } = await supabaseAdmin.from("email_otps").select("*").eq("user_id", userId).maybeSingle();
  if (!row || new Date(row.expires_at) <= now) throw new Error("Kode tidak ada atau sudah kedaluwarsa. Minta kode baru.");
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw new Error("Terlalu banyak percobaan salah. Minta kode baru.");
  await supabaseAdmin.from("email_otps").update({ attempts: row.attempts + 1 }).eq("user_id", userId);
  const expected = await hmacHex(secret(), `${userId}:${row.email}:${code}`);
  let diff = expected.length ^ row.code_hash.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (row.code_hash.charCodeAt(i) || 0);
  if (diff !== 0) throw new Error(`Kode salah. Sisa percobaan ${OTP_MAX_ATTEMPTS - row.attempts - 1}.`);
  await supabaseAdmin.from("email_otps").update({ verified_at: now.toISOString() }).eq("user_id", userId);
  return { email: row.email };
}

// ---------------------------------------------------------------------------
// Pengajuan
// ---------------------------------------------------------------------------
export async function submitVerification(userId: string, raw: unknown, now = new Date()): Promise<{ status: "verified" | "pending" }> {
  const input = parseSubmitInput(raw, userId, now);
  await supabaseAdmin.rpc("expire_student_verifications");

  const { data: cur } = await supabaseAdmin.from("student_verifications").select("status, expires_at").eq("user_id", userId).maybeSingle();
  const eff = effectiveStatus(cur ?? null, now);
  if (eff === "pending") throw new Error("Pengajuan Anda sedang diperiksa. Tunggu hasilnya.");
  if (eff === "verified" && cur?.expires_at && new Date(cur.expires_at).getTime() - now.getTime() > RENEW_WINDOW_DAYS * DAY_MS) {
    throw new Error(`Anda sudah terverifikasi sampai ${fmtDate(cur.expires_at)}. Pembaruan bisa diajukan ${RENEW_WINDOW_DAYS} hari sebelum berakhir.`);
  }
  await assertFilesExist(userId, [input.ktmPath, input.supportPath]);

  // Status aktif: OTP email kampus harus benar-benar terverifikasi di server (bukan klaim browser).
  let email: EmailCheck | null = null;
  let otpVerified = false;
  if (input.supportKind === "otp") {
    const { data: o } = await supabaseAdmin.from("email_otps").select("email, verified_at").eq("user_id", userId).maybeSingle();
    if (!o?.verified_at || now.getTime() - new Date(o.verified_at).getTime() > OTP_VERIFIED_WINDOW_MINUTES * MIN_MS) {
      throw new Error("Verifikasi OTP email kampus dulu (berlaku 30 menit).");
    }
    email = classifyStudentEmail(o.email, await domainRules());
    otpVerified = email.ok;
  }
  const scope = email && email.ok ? email.campusDomain : `univ:${normalizeName(input.fields.university)}`;
  const nimHash = await hmacHex(secret(), identityKey(scope, input.fields.nim));

  const { data: dup } = await supabaseAdmin.from("student_verifications").select("user_id").eq("nim_hash", nimHash).neq("user_id", userId).in("status", ["pending", "verified"]).limit(1);
  const ocr = parseKtmText(input.ocrText);
  const decision = decideVerification({
    otpVerified,
    email,
    confirmed: { nim: input.fields.nim, name: input.fields.name, university: input.fields.university },
    ocr,
    quality: input.isPdf ? "pdf" : input.quality ? assessImageQuality(input.quality) : null,
    nimUsedByOtherAccount: Boolean(dup?.length),
    now,
  });

  const base = {
    user_id: userId,
    full_name: input.fields.name,
    nim: input.fields.nim,
    nim_hash: nimHash,
    nim_last4: input.fields.nim.slice(-4),
    university: input.fields.university,
    faculty: input.fields.faculty,
    study_program: input.fields.studyProgram,
    entry_year: input.fields.entryYear,
    campus_email: email && email.ok ? email.email : null,
    email_verified_at: otpVerified ? now.toISOString() : null,
    ktm_path: input.ktmPath,
    support_kind: input.supportKind,
    support_path: input.supportPath,
    ocr_text: input.ocrText || null,
    ocr_fields: ocr as never,
    quality: (input.quality ?? null) as never,
    score: decision.score,
    flags: decision.flags,
    submitted_at: now.toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    reject_reason: null,
    docs_purged_at: null,
    updated_at: now.toISOString(),
  };
  const approved = {
    status: "verified",
    decision_source: "auto",
    verified_at: now.toISOString(),
    expires_at: verificationExpiry(now, ocr.validUntilYear).toISOString(),
    docs_purge_after: new Date(now.getTime() + DOC_RETENTION_DAYS * DAY_MS).toISOString(),
  };
  const queued = { status: "pending", decision_source: null, verified_at: null, expires_at: null, docs_purge_after: null };

  let status: "verified" | "pending" = decision.decision === "auto_approve" ? "verified" : "pending";
  let { error } = await supabaseAdmin.from("student_verifications").upsert({ ...base, ...(status === "verified" ? approved : queued) }, { onConflict: "user_id" });
  if (error?.code === "23505" && status === "verified") {
    // Ada akun lain yang baru saja terverifikasi dengan NIM yang sama: serahkan ke admin.
    status = "pending";
    ({ error } = await supabaseAdmin.from("student_verifications").upsert({ ...base, flags: [...decision.flags, "nim_dipakai_akun_lain"], ...queued }, { onConflict: "user_id" }));
  }
  if (error) throw new Error("Gagal menyimpan pengajuan. Coba lagi.");

  // Hapus unggahan lama/yatim milik pengguna ini selain yang dipakai sekarang.
  const { data: files } = await supabaseAdmin.storage.from(BUCKET).list(userId, { limit: 50 });
  const keep = new Set([input.ktmPath, input.supportPath].filter(Boolean).map((p) => (p as string).slice(userId.length + 1)));
  const stale = (files ?? []).filter((f) => !keep.has(f.name)).map((f) => `${userId}/${f.name}`);
  if (stale.length) await supabaseAdmin.storage.from(BUCKET).remove(stale);
  await purgeDocuments(10, now);

  await notify(
    userId,
    "verification",
    status === "verified" ? "Verifikasi mahasiswa berhasil" : "Pengajuan verifikasi diterima",
    status === "verified"
      ? `Anda terverifikasi sebagai mahasiswa sampai ${fmtDate(approved.expires_at)}. Harga Premium Mahasiswa kini berlaku.`
      : `Pengajuan Anda masuk antrean pemeriksaan admin (maksimal ${REVIEW_SLA_HOURS} jam). Anda akan diberi tahu hasilnya di sini.`,
  );
  return { status };
}

export async function getMyVerification(userId: string, now = new Date()) {
  await supabaseAdmin.rpc("expire_student_verifications");
  const { data } = await supabaseAdmin.from("student_verifications").select("status, expires_at, reject_reason, submitted_at, university, nim_last4, support_kind").eq("user_id", userId).maybeSingle();
  return {
    status: effectiveStatus(data ?? null, now),
    expiresAt: data?.expires_at ?? null,
    rejectReason: data?.status === "rejected" ? data.reject_reason : null,
    submittedAt: data?.submitted_at ?? null,
    university: data?.university ?? null,
    nimLast4: data?.nim_last4 ?? null,
    canRenew: Boolean(data?.status === "verified" && data.expires_at && new Date(data.expires_at).getTime() - now.getTime() <= RENEW_WINDOW_DAYS * DAY_MS),
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export async function listVerificationsForAdmin(adminId: string, status: "pending" | "verified" | "rejected") {
  await requireAdmin(adminId);
  await supabaseAdmin.rpc("expire_student_verifications");
  await purgeDocuments(20);
  const { data } = await supabaseAdmin.from("student_verifications").select("*").eq("status", status).order("submitted_at", { ascending: status === "pending" }).limit(50);
  const out = [];
  for (const v of data ?? []) {
    out.push({
      userId: v.user_id,
      accountEmail: (await getUserIdentity(v.user_id).catch(() => null))?.email ?? null,
      status: v.status,
      fullName: v.full_name,
      nim: v.nim,
      nimLast4: v.nim_last4,
      university: v.university,
      faculty: v.faculty,
      studyProgram: v.study_program,
      entryYear: v.entry_year,
      campusEmail: v.campus_email,
      emailVerified: Boolean(v.email_verified_at),
      supportKind: v.support_kind,
      hasDocs: Boolean(v.ktm_path),
      ocrFields: v.ocr_fields,
      ocrText: v.ocr_text,
      quality: v.quality,
      score: v.score,
      flags: v.flags,
      submittedAt: v.submitted_at,
      expiresAt: v.expires_at,
      decisionSource: v.decision_source,
      rejectReason: v.reject_reason,
    });
  }
  return out;
}

/** Tautan sementara (2 menit) untuk membuka dokumen. Hanya admin. */
export async function verificationDocLinks(adminId: string, userId: string): Promise<{ ktm: string | null; support: string | null }> {
  await requireAdmin(adminId);
  const { data } = await supabaseAdmin.from("student_verifications").select("ktm_path, support_path").eq("user_id", userId).maybeSingle();
  const sign = async (p: string | null | undefined) => (p ? (await supabaseAdmin.storage.from(BUCKET).createSignedUrl(p, 120)).data?.signedUrl ?? null : null);
  return { ktm: await sign(data?.ktm_path), support: await sign(data?.support_path) };
}

export async function reviewVerification(adminId: string, userId: string, action: "approve" | "reject", reason?: unknown, now = new Date()): Promise<void> {
  await requireAdmin(adminId);
  const { data: v } = await supabaseAdmin.from("student_verifications").select("*").eq("user_id", userId).maybeSingle();
  if (!v || v.status !== "pending") throw new Error("Pengajuan ini tidak lagi menunggu pemeriksaan. Muat ulang daftar.");
  const purge = new Date(now.getTime() + DOC_RETENTION_DAYS * DAY_MS).toISOString();
  if (action === "approve") {
    const yr = (v.ocr_fields as { validUntilYear?: number } | null)?.validUntilYear;
    const expires = verificationExpiry(now, yr);
    const { data, error } = await supabaseAdmin
      .from("student_verifications")
      .update({ status: "verified", decision_source: "admin", reviewed_by: adminId, reviewed_at: now.toISOString(), verified_at: now.toISOString(), expires_at: expires.toISOString(), reject_reason: null, docs_purge_after: purge, updated_at: now.toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("user_id");
    if (error?.code === "23505") throw new Error("NIM ini sudah dipakai akun lain yang terverifikasi. Tolak pengajuan ini, atau cabut verifikasi akun lain lebih dulu.");
    if (error || !data?.length) throw new Error("Gagal menyetujui. Muat ulang daftar.");
    await notify(userId, "verification", "Verifikasi mahasiswa disetujui", `Anda terverifikasi sebagai mahasiswa sampai ${fmtDate(expires)}. Harga Premium Mahasiswa kini berlaku.`);
    return;
  }
  const why = normalizeRejectReason(reason);
  const { data } = await supabaseAdmin
    .from("student_verifications")
    .update({ status: "rejected", decision_source: "admin", reviewed_by: adminId, reviewed_at: now.toISOString(), reject_reason: why, docs_purge_after: purge, updated_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("user_id");
  if (!data?.length) throw new Error("Gagal menolak. Muat ulang daftar.");
  await notify(userId, "verification", "Verifikasi mahasiswa ditolak", `Alasan: ${why}. Anda bisa mengajukan ulang dengan data yang benar.`);
}

/** Cabut verifikasi yang sudah disetujui (mis. ditemukan penyalahgunaan). */
export async function revokeVerification(adminId: string, userId: string, reason: unknown, now = new Date()): Promise<void> {
  await requireAdmin(adminId);
  const why = normalizeRejectReason(reason);
  const { data } = await supabaseAdmin
    .from("student_verifications")
    .update({ status: "rejected", reject_reason: why, reviewed_by: adminId, reviewed_at: now.toISOString(), expires_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("status", "verified")
    .select("user_id");
  if (!data?.length) throw new Error("Verifikasi tidak ditemukan atau sudah tidak aktif.");
  await notify(userId, "verification", "Verifikasi mahasiswa dicabut", `Alasan: ${why}.`);
}

/** Hapus dokumen & data mentah yang sudah lewat masa simpan. Yang tersisa: status, NIM ter-hash, 4 digit akhir. */
export async function purgeDocuments(limit = 20, now = new Date()): Promise<number> {
  const { data } = await supabaseAdmin.from("student_verifications").select("user_id, ktm_path, support_path").lt("docs_purge_after", now.toISOString()).is("docs_purged_at", null).limit(limit);
  let n = 0;
  for (const v of data ?? []) {
    const paths = [v.ktm_path, v.support_path].filter((p): p is string => Boolean(p));
    if (paths.length) {
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths);
      if (error) continue; // coba lagi nanti
    }
    await supabaseAdmin
      .from("student_verifications")
      .update({ ktm_path: null, support_path: null, ocr_text: null, ocr_fields: null, quality: null, full_name: null, nim: null, campus_email: null, docs_purged_at: now.toISOString() })
      .eq("user_id", v.user_id);
    n++;
  }
  return n;
}

// ---- Aturan domain kampus (admin) ----
export async function listDomainRules(adminId: string) {
  await requireAdmin(adminId);
  const { data } = await supabaseAdmin.from("student_domain_rules").select("domain, kind, note").order("domain");
  return data ?? [];
}

export async function setDomainRule(adminId: string, rawDomain: unknown, kind: unknown, note: unknown): Promise<void> {
  await requireAdmin(adminId);
  const [domain] = normalizeEmailDomains(rawDomain);
  if (!domain || (kind !== "allow" && kind !== "block")) throw new Error("Domain atau jenis aturan tidak valid.");
  const { error } = await supabaseAdmin.from("student_domain_rules").upsert({ domain, kind, note: typeof note === "string" ? note.slice(0, 120) : null }, { onConflict: "domain" });
  if (error) throw new Error("Gagal menyimpan aturan.");
}

export async function deleteDomainRule(adminId: string, rawDomain: unknown): Promise<void> {
  await requireAdmin(adminId);
  const [domain] = normalizeEmailDomains(rawDomain);
  if (!domain) throw new Error("Domain tidak valid.");
  await supabaseAdmin.from("student_domain_rules").delete().eq("domain", domain);
}

// campusDomain dipakai UI admin untuk menjelaskan lingkup NIM
export { campusDomain };
