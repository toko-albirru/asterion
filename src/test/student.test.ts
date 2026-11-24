import { describe, expect, it } from "vitest";
import {
  assessImageQuality,
  campusDomain,
  classifyStudentEmail,
  decideVerification,
  effectiveStatus,
  generateOtp,
  hmacHex,
  identityKey,
  nameSimilarity,
  parseKtmText,
  verificationExpiry,
  type DecisionInput,
} from "@/lib/student";

describe("email kampus", () => {
  it("menerima email mahasiswa .ac.id", () => {
    const r = classifyStudentEmail("Budi@student.uns.ac.id");
    expect(r.ok && r.signal).toBe("strong");
    expect(r.ok && r.campusDomain).toBe("uns.ac.id");
    const weak = classifyStudentEmail("k3521001@uns.ac.id");
    expect(weak.ok && weak.signal).toBe("weak");
  });
  it("menolak staf/dosen/alumni dan non-kampus", () => {
    for (const e of ["a@staff.uns.ac.id", "a@dosen.ugm.ac.id", "dosen.budi@uns.ac.id", "a@alumni.itb.ac.id", "a@gmail.com", "salah"]) {
      expect(classifyStudentEmail(e).ok).toBe(false);
    }
  });
  it("aturan admin: allow menambah pengecualian, block menang", () => {
    expect(classifyStudentEmail("a@mhs.kampus-x.edu", { allow: ["kampus-x.edu"], block: [] }).ok).toBe(true);
    expect(classifyStudentEmail("a@student.uns.ac.id", { allow: [], block: ["student.uns.ac.id"] }).ok).toBe(false);
  });
  it("campusDomain", () => {
    expect(campusDomain("mhs.fk.ugm.ac.id")).toBe("ugm.ac.id");
    expect(campusDomain("uns.ac.id")).toBe("uns.ac.id");
  });
});

const KTM = `KARTU TANDA MAHASISWA
UNIVERSITAS SEBELAS MARET
Nama : BUDI SANTOSO
NIM : K3521001
Fakultas : Matematika dan Ilmu Pengetahuan Alam
Program Studi : Informatika
Angkatan : 2021
Berlaku s/d 31/08/2027`;

describe("pembacaan teks KTM", () => {
  it("mengambil bidang utama", () => {
    expect(parseKtmText(KTM)).toEqual({
      nim: "K3521001",
      name: "BUDI SANTOSO",
      university: "UNIVERSITAS SEBELAS MARET",
      faculty: "Matematika dan Ilmu Pengetahuan Alam",
      studyProgram: "Informatika",
      entryYear: 2021,
      validUntilYear: 2027,
    });
  });
  it("teks tidak relevan menghasilkan objek kosong, bukan error", () => {
    expect(parseKtmText("lorem ipsum\n123")).toEqual({});
  });
  it("label dan nilai di baris terpisah", () => {
    const r = parseKtmText("Nama\nSITI AMINAH\nNIM\n2110511045");
    expect(r.name).toBe("SITI AMINAH");
    expect(r.nim).toBe("2110511045");
  });
});

describe("kemiripan nama & identitas", () => {
  it("toleran salah baca kecil, menolak nama berbeda", () => {
    expect(nameSimilarity("BUDI SANTOSO", "Budi Santoso")).toBe(1);
    expect(nameSimilarity("BUDI SANT0SO", "Budi Santoso")).toBeGreaterThan(0.85);
    expect(nameSimilarity("Budi Santoso", "Andi Wijaya")).toBeLessThan(0.5);
  });
  it("hash identitas stabil dan bergantung pada rahasia", async () => {
    const a = await hmacHex("rahasia", identityKey("UNS.ac.id", "k-3521.001"));
    expect(a).toBe(await hmacHex("rahasia", identityKey("uns.ac.id", "K3521001")));
    expect(a).not.toBe(await hmacHex("lain", identityKey("uns.ac.id", "K3521001")));
    expect(a).not.toBe(await hmacHex("rahasia", identityKey("ugm.ac.id", "K3521001")));
  });
});

describe("OTP", () => {
  it("6 digit dan seragam dari byte acak", () => {
    expect(generateOtp(() => new Uint8Array([0, 0, 0, 7]))).toBe("000007");
    expect(generateOtp(() => new Uint8Array([0x00, 0x0f, 0x42, 0x40]))).toBe("000000"); // 1_000_000
    // ekor terbuang: byte > 4e9 diulang
    let calls = 0;
    const r = generateOtp(() => (++calls === 1 ? new Uint8Array([255, 255, 255, 255]) : new Uint8Array([0, 0, 0, 5])));
    expect(r).toBe("000005");
    expect(calls).toBe(2);
  });
});

describe("kualitas gambar", () => {
  it("lolos bila resolusi, ketajaman, dan cahaya cukup", () => {
    expect(assessImageQuality({ width: 1600, height: 1000, sharpness: 150, brightness: 120 }).ok).toBe(true);
  });
  it("memberi alasan bila buruk atau datanya palsu", () => {
    const bad = assessImageQuality({ width: 300, height: 200, sharpness: 10, brightness: 20 });
    expect(bad.ok).toBe(false);
    expect(bad.issues.length).toBe(3);
    expect(assessImageQuality({ width: NaN, height: 1, sharpness: 1, brightness: 1 }).ok).toBe(false);
  });
});

describe("keputusan verifikasi", () => {
  const now = new Date("2026-11-23T00:00:00Z");
  const good = (): DecisionInput => ({
    otpVerified: true,
    email: classifyStudentEmail("budi@student.uns.ac.id"),
    confirmed: { nim: "K3521001", name: "Budi Santoso", university: "Universitas Sebelas Maret" },
    ocr: parseKtmText(KTM),
    quality: { ok: true },
    nimUsedByOtherAccount: false,
    now,
  });

  it("semua sinyal selaras -> setujui otomatis", () => {
    const d = decideVerification(good());
    expect(d.decision).toBe("auto_approve");
    expect(d.flags).toEqual([]);
    expect(d.score).toBeGreaterThanOrEqual(95);
  });
  it("tanpa OTP, NIM kembar, PDF, KTM kedaluwarsa, atau OCR tak cocok -> ke admin", () => {
    expect(decideVerification({ ...good(), otpVerified: false }).flags).toContain("otp_belum_terverifikasi");
    expect(decideVerification({ ...good(), nimUsedByOtherAccount: true }).flags).toContain("nim_dipakai_akun_lain");
    expect(decideVerification({ ...good(), quality: "pdf" }).decision).toBe("manual_review");
    expect(decideVerification({ ...good(), quality: { ok: false } }).flags).toContain("kualitas_gambar_rendah");
    expect(decideVerification({ ...good(), ocr: { ...good().ocr, validUntilYear: 2024 } }).flags).toContain("ktm_kedaluwarsa");
    expect(decideVerification({ ...good(), confirmed: { ...good().confirmed, nim: "K9999999" } }).flags).toContain("nim_tidak_cocok_dengan_ocr");
    expect(decideVerification({ ...good(), confirmed: { ...good().confirmed, name: "Orang Lain" } }).flags).toContain("nama_tidak_cocok_dengan_ocr");
    expect(decideVerification({ ...good(), ocr: {} }).flags).toContain("ocr_tidak_lengkap");
  });
  it("email domain lemah hanya lolos bila NIM ada di nama email", () => {
    const weakNoNim = { ...good(), email: classifyStudentEmail("budi@uns.ac.id") };
    expect(decideVerification(weakNoNim).flags).toContain("email_tidak_menunjukkan_mahasiswa");
    const weakNim = { ...good(), email: classifyStudentEmail("k3521001@uns.ac.id") };
    expect(decideVerification(weakNim).decision).toBe("auto_approve");
  });
  it("email staf tidak pernah otomatis", () => {
    const d = decideVerification({ ...good(), email: classifyStudentEmail("budi@staff.uns.ac.id") });
    expect(d.flags).toContain("email_bukan_mahasiswa");
  });
});

describe("masa berlaku verifikasi", () => {
  const t = new Date("2026-11-23T00:00:00Z");
  it("1 tahun, atau sampai akhir tahun berlaku KTM bila lebih pendek", () => {
    expect(verificationExpiry(t).toISOString()).toBe("2027-11-23T00:00:00.000Z");
    expect(verificationExpiry(t, 2027).toISOString()).toBe("2027-11-23T00:00:00.000Z");
    expect(verificationExpiry(t, 2026).toISOString()).toBe("2026-12-31T23:59:59.000Z");
    expect(verificationExpiry(t, 2020).toISOString()).toBe("2027-11-23T00:00:00.000Z");
  });
  it("status efektif", () => {
    expect(effectiveStatus(null, t)).toBe("unverified");
    expect(effectiveStatus({ status: "verified", expires_at: "2026-01-01T00:00:00Z" }, t)).toBe("expired");
    expect(effectiveStatus({ status: "verified", expires_at: "2027-01-01T00:00:00Z" }, t)).toBe("verified");
    expect(effectiveStatus({ status: "pending", expires_at: null }, t)).toBe("pending");
  });
});
