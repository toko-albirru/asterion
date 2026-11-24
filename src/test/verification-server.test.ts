// @ts-nocheck — penjalur test kustom; tipe longgar disengaja
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./fake-supabase";

vi.mock("@/integrations/supabase/client.server", async () => {
  const m = await import("./fake-supabase");
  return { supabaseAdmin: m.fake.client };
});

process.env["PAYMENT_MODE"] = "qris";
process.env["ADMIN_EMAILS"] = "admin@semar.id";
process.env["NIM_HASH_SECRET"] = "rahasia-tes";

const V = () => import("@/lib/verification.server");
const YEAR = new Date().getUTCFullYear();
const KTM_TEXT = `KARTU TANDA MAHASISWA
UNIVERSITAS SEBELAS MARET
Nama : BUDI SANTOSO
NIM : K3521001
Fakultas : MIPA
Program Studi : Informatika
Angkatan : 2021
Berlaku s/d ${YEAR + 2}`;
const GOOD_Q = { width: 1600, height: 1000, sharpness: 200, brightness: 120 };
const U = (n: number) => `0000000${n}-0000-4000-8000-00000000000${n}`;
const FILE = (u: string, n: number, ext = "jpg") => `${u}/1111111${n}-1111-4111-8111-11111111111${n}.${ext}`;

const sent: { to: string; text: string }[] = [];
const realFetch = globalThis.fetch;

function upload(...paths: string[]) {
  for (const p of paths) fake.files.add(p);
}
function body(u: string, over: Record<string, unknown> = {}) {
  upload(FILE(u, 1));
  return {
    ktmPath: FILE(u, 1),
    supportKind: "otp",
    fields: { nim: "K3521001", name: "Budi Santoso", university: "Universitas Sebelas Maret", faculty: "MIPA", studyProgram: "Informatika", entryYear: 2021 },
    ocrText: KTM_TEXT,
    quality: GOOD_Q,
    ...over,
  };
}
async function otpFor(u: string, email: string) {
  const v = await V();
  await v.sendOtp(u, email);
  const code = /(\d{6})/.exec(sent.at(-1)!.text)![1]!;
  await v.verifyOtp(u, code);
}

beforeEach(() => {
  fake.reset();
  sent.length = 0;
  process.env["RESEND_API_KEY"] = "re_test";
  process.env["NOTIFY_FROM_EMAIL"] = "no-reply@semar.id";
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const b = JSON.parse(init.body);
    sent.push({ to: b.to[0], text: b.text });
    return { ok: true };
  }) as never;
  fake.users.set("admin", { email: "admin@semar.id", confirmed: true });
  fake.users.set(U(1), { email: "budi@gmail.com", confirmed: true });
  fake.users.set(U(2), { email: "orang2@gmail.com", confirmed: true });
});

describe("unggah dokumen", () => {
  it("hanya JPG/PNG/PDF maksimal 5 MB; jalur berada di folder pengguna sendiri", async () => {
    const v = await V();
    const slot = await v.createUploadSlot(U(1), "image/jpeg", 1_000_000);
    expect(slot.path.startsWith(U(1) + "/")).toBe(true);
    expect(slot.path.endsWith(".jpg")).toBe(true);
    await expect(v.createUploadSlot(U(1), "image/gif", 1000)).rejects.toThrow(/JPG, PNG, atau PDF/);
    await expect(v.createUploadSlot(U(1), "image/png", 6 * 1024 * 1024)).rejects.toThrow(/5 MB/);
    await expect(v.createUploadSlot(U(1), "image/png", 0)).rejects.toThrow();
  });
  it("membatasi berkas yang belum dipakai", async () => {
    const v = await V();
    for (let i = 0; i < 8; i++) fake.files.add(`${U(1)}/x${i}.jpg`);
    await expect(v.createUploadSlot(U(1), "image/png", 1000)).rejects.toThrow(/Terlalu banyak/);
  });
});

describe("OTP email kampus", () => {
  it("tanpa konfigurasi email, OTP tidak tersedia", async () => {
    const v = await V();
    delete process.env["RESEND_API_KEY"];
    expect(v.verificationConfig().otpAvailable).toBe(false);
    await expect(v.sendOtp(U(1), "budi@student.uns.ac.id")).rejects.toThrow(/belum tersedia/);
  });
  it("menolak email non-kampus dan email staf/dosen", async () => {
    const v = await V();
    await expect(v.sendOtp(U(1), "budi@gmail.com")).rejects.toThrow(/\.ac\.id/);
    await expect(v.sendOtp(U(1), "budi@staff.uns.ac.id")).rejects.toThrow(/staf\/dosen/);
    expect(sent).toHaveLength(0);
  });
  it("kode benar memverifikasi; salah mengurangi sisa percobaan; 5 salah mengunci", async () => {
    const v = await V();
    await v.sendOtp(U(1), "Budi@student.uns.ac.id");
    expect(sent[0]!.to).toBe("budi@student.uns.ac.id");
    const code = /(\d{6})/.exec(sent[0]!.text)![1]!;
    const wrong = code === "000000" ? "000001" : "000000";
    await expect(v.verifyOtp(U(1), wrong)).rejects.toThrow(/Sisa percobaan 4/);
    await expect(v.verifyOtp(U(1), "12")).rejects.toThrow(/6 angka/);
    expect((await v.verifyOtp(U(1), code)).email).toBe("budi@student.uns.ac.id");
    await v.sendOtp(U(1), "budi@student.uns.ac.id");
    for (let i = 0; i < 5; i++) await expect(v.verifyOtp(U(1), wrong)).rejects.toThrow();
    const real = /(\d{6})/.exec(sent.at(-1)!.text)![1]!;
    await expect(v.verifyOtp(U(1), real)).rejects.toThrow(/Terlalu banyak percobaan/);
  });
  it("kode kedaluwarsa ditolak; permintaan kode dibatasi 5 per jam", async () => {
    const v = await V();
    await v.sendOtp(U(1), "budi@student.uns.ac.id");
    fake.tables["email_otps"]![0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    await expect(v.verifyOtp(U(1), "123456")).rejects.toThrow(/kedaluwarsa/);
    for (let i = 0; i < 4; i++) await v.sendOtp(U(1), "budi@student.uns.ac.id");
    await expect(v.sendOtp(U(1), "budi@student.uns.ac.id")).rejects.toThrow(/Terlalu sering/);
  });
});

describe("pengajuan verifikasi", () => {
  it("semua sinyal selaras (OTP kampus, domain mahasiswa, KTM konsisten, gambar baik) -> Verified otomatis", async () => {
    const v = await V();
    await otpFor(U(1), "budi@student.uns.ac.id");
    const r = await v.submitVerification(U(1), body(U(1)));
    expect(r.status).toBe("verified");
    const row = fake.tables["student_verifications"]![0]!;
    expect(row.decision_source).toBe("auto");
    expect(row.nim_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.nim_last4).toBe("1001");
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now() + 300 * 86_400_000);
    expect(new Date(row.docs_purge_after).getTime()).toBeGreaterThan(Date.now() + 9 * 86_400_000);
    expect(fake.tables["notifications"]!.some((n) => n.title.includes("berhasil"))).toBe(true);
    expect((await v.getMyVerification(U(1))).status).toBe("verified");
  });

  it("tanpa OTP (KRS) selalu ke admin, tidak pernah otomatis", async () => {
    const v = await V();
    upload(FILE(U(1), 2));
    const r = await v.submitVerification(U(1), body(U(1), { supportKind: "krs", supportPath: FILE(U(1), 2) }));
    expect(r.status).toBe("pending");
    const row = fake.tables["student_verifications"]![0]!;
    expect(row.flags).toContain("otp_belum_terverifikasi");
    expect(row.expires_at).toBeNull();
    expect((await v.getMyVerification(U(1))).status).toBe("pending");
  });

  it("PDF, gambar buram, atau data OCR tak cocok -> ke admin", async () => {
    const v = await V();
    await otpFor(U(1), "budi@student.uns.ac.id");
    const blurry = await v.submitVerification(U(1), body(U(1), { quality: { ...GOOD_Q, sharpness: 5 } }));
    expect(blurry.status).toBe("pending");
    expect(fake.tables["student_verifications"]![0]!.flags).toContain("kualitas_gambar_rendah");
    fake.tables["student_verifications"]![0]!.status = "rejected";
    const wrongName = await v.submitVerification(U(1), body(U(1), { fields: { nim: "K3521001", name: "Orang Lain Sekali", university: "Universitas Sebelas Maret" } }));
    expect(wrongName.status).toBe("pending");
    expect(fake.tables["student_verifications"]![0]!.flags).toContain("nama_tidak_cocok_dengan_ocr");
    fake.tables["student_verifications"]![0]!.status = "rejected";
    upload(FILE(U(1), 3, "pdf"));
    const pdf = await v.submitVerification(U(1), body(U(1), { ktmPath: FILE(U(1), 3, "pdf"), quality: GOOD_Q }));
    expect(pdf.status).toBe("pending");
    expect(fake.tables["student_verifications"]![0]!.flags).toContain("pdf_tidak_dianalisis");
  });

  it("NIM yang sama di akun lain: ditandai dan tidak pernah otomatis; admin tidak bisa menyetujui bila sudah ada yang Verified", async () => {
    const v = await V();
    await otpFor(U(1), "budi@student.uns.ac.id");
    await v.submitVerification(U(1), body(U(1)));
    fake.users.set(U(2), { email: "x@student.uns.ac.id", confirmed: true });
    await otpFor(U(2), "x@student.uns.ac.id");
    const r2 = await v.submitVerification(U(2), body(U(2)));
    expect(r2.status).toBe("pending");
    const row2 = fake.tables["student_verifications"]!.find((r) => r.user_id === U(2))!;
    expect(row2.flags).toContain("nim_dipakai_akun_lain");
    await expect(v.reviewVerification("admin", U(2), "approve")).rejects.toThrow(/sudah dipakai akun lain/);
    // NIM yang sama di kampus lain adalah orang lain
    fake.users.set(U(3), { email: "y@mhs.ugm.ac.id", confirmed: true });
    await otpFor(U(3), "y@mhs.ugm.ac.id");
    const r3 = await v.submitVerification(U(3), body(U(3), { fields: { nim: "K3521001", name: "Budi Santoso", university: "Universitas Sebelas Maret" } }));
    expect(fake.tables["student_verifications"]!.find((r) => r.user_id === U(3))!.flags).not.toContain("nim_dipakai_akun_lain");
    expect(r3.status).toBe("verified");
  });

  it("berkas orang lain, berkas belum diunggah, atau OTP belum diverifikasi ditolak", async () => {
    const v = await V();
    await expect(v.submitVerification(U(1), { ...body(U(1)), ktmPath: FILE(U(2), 1) })).rejects.toThrow(/tidak valid/);
    await expect(v.submitVerification(U(1), { ...body(U(1)), ktmPath: FILE(U(1), 7) })).rejects.toThrow(/belum selesai diunggah/);
    await expect(v.submitVerification(U(1), body(U(1)))).rejects.toThrow(/OTP/);
    await expect(v.submitVerification(U(1), body(U(1), { supportKind: "krs", supportPath: null }))).rejects.toThrow(/KRS/);
    await expect(v.submitVerification(U(1), body(U(1), { fields: { nim: "12", name: "Budi", university: "UNS" } }))).rejects.toThrow(/NIM/);
  });

  it("pengajuan pending tidak bisa diajukan ulang; Verified baru bisa diperbarui 30 hari sebelum berakhir", async () => {
    const v = await V();
    upload(FILE(U(1), 2));
    await v.submitVerification(U(1), body(U(1), { supportKind: "krs", supportPath: FILE(U(1), 2) }));
    await expect(v.submitVerification(U(1), body(U(1), { supportKind: "krs", supportPath: FILE(U(1), 2) }))).rejects.toThrow(/sedang diperiksa/);
    const row = fake.tables["student_verifications"]![0]!;
    row.status = "verified";
    row.expires_at = new Date(Date.now() + 200 * 86_400_000).toISOString();
    await expect(v.submitVerification(U(1), body(U(1), { supportKind: "krs", supportPath: FILE(U(1), 2) }))).rejects.toThrow(/Pembaruan bisa diajukan/);
    row.expires_at = new Date(Date.now() + 10 * 86_400_000).toISOString();
    expect((await v.getMyVerification(U(1))).canRenew).toBe(true);
  });
});

describe("pemeriksaan admin dan pembersihan dokumen", () => {
  async function pendingKrs() {
    const v = await V();
    upload(FILE(U(1), 2));
    await v.submitVerification(U(1), body(U(1), { supportKind: "krs", supportPath: FILE(U(1), 2) }));
    return v;
  }

  it("hanya admin yang dapat melihat daftar dan dokumen", async () => {
    const v = await pendingKrs();
    await expect(v.listVerificationsForAdmin(U(2), "pending")).rejects.toThrow(/Akses ditolak/);
    await expect(v.verificationDocLinks(U(2), U(1))).rejects.toThrow(/Akses ditolak/);
    await expect(v.reviewVerification(U(2), U(1), "approve")).rejects.toThrow(/Akses ditolak/);
    const list = await v.listVerificationsForAdmin("admin", "pending");
    expect(list[0]).toMatchObject({ accountEmail: "budi@gmail.com", nim: "K3521001", hasDocs: true, supportKind: "krs" });
    const links = await v.verificationDocLinks("admin", U(1));
    expect(links.ktm).toContain("signed");
    expect(links.support).toContain("signed");
  });

  it("setuju: Verified 1 tahun + jadwal hapus dokumen 10 hari + notifikasi", async () => {
    const v = await pendingKrs();
    await v.reviewVerification("admin", U(1), "approve");
    const row = fake.tables["student_verifications"]![0]!;
    expect([row.status, row.decision_source, row.reviewed_by]).toEqual(["verified", "admin", "admin"]);
    expect(new Date(row.docs_purge_after).getTime()).toBeGreaterThan(Date.now() + 9 * 86_400_000);
    expect(fake.tables["notifications"]!.some((n) => n.title.includes("disetujui"))).toBe(true);
    await expect(v.reviewVerification("admin", U(1), "approve")).rejects.toThrow(/tidak lagi menunggu/);
  });

  it("tolak: alasan wajib, pengguna diberi tahu dan boleh mengajukan ulang", async () => {
    const v = await pendingKrs();
    await expect(v.reviewVerification("admin", U(1), "reject", "")).rejects.toThrow(/Alasan/);
    await v.reviewVerification("admin", U(1), "reject", "Foto KTM tidak terbaca");
    expect(fake.tables["student_verifications"]![0]!.status).toBe("rejected");
    expect((await v.getMyVerification(U(1))).rejectReason).toBe("Foto KTM tidak terbaca");
    upload(FILE(U(1), 2));
    await expect(v.submitVerification(U(1), body(U(1), { supportKind: "krs", supportPath: FILE(U(1), 2) }))).resolves.toBeTruthy();
  });

  it("dokumen dan data mentah dihapus setelah masa simpan; status dan NIM ter-hash tetap", async () => {
    const v = await pendingKrs();
    await v.reviewVerification("admin", U(1), "approve");
    expect(await v.purgeDocuments(10)).toBe(0); // belum waktunya
    fake.tables["student_verifications"]![0]!.docs_purge_after = new Date(Date.now() - 1000).toISOString();
    expect(await v.purgeDocuments(10)).toBe(1);
    const row = fake.tables["student_verifications"]![0]!;
    expect([row.ktm_path, row.support_path, row.ocr_text, row.nim, row.full_name]).toEqual([null, null, null, null, null]);
    expect(row.nim_hash).toMatch(/^[0-9a-f]{64}$/);
    expect([row.status, row.nim_last4]).toEqual(["verified", "1001"]);
    expect([...fake.files].filter((f) => f.startsWith(U(1)))).toHaveLength(0);
    expect(await v.purgeDocuments(10)).toBe(0); // tidak diulang
  });

  it("cabut verifikasi: wajib beralasan dan hanya untuk yang Verified", async () => {
    const v = await pendingKrs();
    await expect(v.revokeVerification("admin", U(1), "Penyalahgunaan")).rejects.toThrow(/tidak ditemukan/);
    await v.reviewVerification("admin", U(1), "approve");
    await v.revokeVerification("admin", U(1), "Penyalahgunaan");
    expect((await v.getMyVerification(U(1))).status).toBe("rejected");
  });

  it("aturan domain: block menolak, allow menerima domain di luar .ac.id; hanya admin", async () => {
    const v = await V();
    await expect(v.setDomainRule(U(2), "kampus.edu", "allow", "")).rejects.toThrow(/Akses ditolak/);
    await v.setDomainRule("admin", "@Mhs.Kampus-X.edu", "allow", "kampus swasta");
    await v.setDomainRule("admin", "student.uns.ac.id", "block", "uji coba");
    await expect(v.sendOtp(U(1), "budi@student.uns.ac.id")).rejects.toThrow(/staf\/dosen/);
    await expect(v.sendOtp(U(1), "budi@mhs.kampus-x.edu")).resolves.toBeTruthy();
    expect((await v.listDomainRules("admin")).map((r) => r.domain)).toEqual(["mhs.kampus-x.edu", "student.uns.ac.id"]);
    await v.deleteDomainRule("admin", "student.uns.ac.id");
    expect(await v.listDomainRules("admin")).toHaveLength(1);
    await expect(v.setDomainRule("admin", "bukan domain", "allow", "")).rejects.toThrow();
    await expect(v.setDomainRule("admin", "a.ac.id", "lain", "")).rejects.toThrow();
  });
});

globalThis.fetch ??= realFetch;
