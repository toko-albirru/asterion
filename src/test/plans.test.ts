import { describe, expect, it } from "vitest";
import {
  STUDENT_MONTHLY_PRICE_IDR,
  addMonthsUtc,
  institutionAmount,
  institutionDiscountPct,
  nextPeriod,
  planConflict,
  subscriptionAmount,
} from "@/lib/plans";

describe("harga paket", () => {
  it("individu Rp50.000 dan mahasiswa Rp42.500 per bulan", () => {
    expect(subscriptionAmount("individual", 1)).toBe(50000);
    expect(STUDENT_MONTHLY_PRICE_IDR).toBe(42500);
    expect(subscriptionAmount("student", 1)).toBe(42500);
    expect(subscriptionAmount("student", 12)).toBe(510000);
  });
  it("menolak lama langganan di luar pilihan", () => {
    expect(() => subscriptionAmount("individual", 2)).toThrow();
    expect(() => subscriptionAmount("individual", 0)).toThrow();
  });
});

describe("lisensi institusi", () => {
  it("harga per tingkat sesuai ketentuan", () => {
    expect(institutionAmount(1)).toBe(4_750_000);
    expect(institutionAmount(100)).toBe(4_750_000);
    expect(institutionAmount(101)).toBe(4_500_000);
    expect(institutionAmount(200)).toBe(4_500_000);
    expect(institutionAmount(201)).toBe(4_250_000);
    expect(institutionAmount(300)).toBe(4_250_000);
    expect(institutionAmount(301)).toBe(4_000_000);
    expect(institutionAmount(1000)).toBe(4_000_000);
  });
  it("menolak jumlah pengguna di luar 1-1000", () => {
    for (const n of [0, 1001, -1, 1.5]) expect(() => institutionDiscountPct(n)).toThrow();
  });
});

describe("masa berlaku", () => {
  it("tambah bulan kalender tanpa meluber", () => {
    expect(addMonthsUtc(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonthsUtc(new Date("2028-01-31T00:00:00Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(addMonthsUtc(new Date("2026-11-23T00:00:00Z"), 12).toISOString()).toBe("2027-11-23T00:00:00.000Z");
  });
  it("perpanjangan disambung dari masa berlaku yang masih aktif", () => {
    const now = new Date("2026-11-23T00:00:00Z");
    const active = new Date("2026-12-10T00:00:00Z");
    expect(nextPeriod(active, now, 1).expiresAt.toISOString()).toBe("2027-01-10T00:00:00.000Z");
    expect(nextPeriod(new Date("2026-01-01T00:00:00Z"), now, 1).startsAt).toEqual(now);
    expect(nextPeriod(null, now, 3).expiresAt.toISOString()).toBe("2027-02-23T00:00:00.000Z");
  });
});

describe("satu jenis langganan aktif", () => {
  const inst = { plan: "institution" as const, expiresAt: new Date("2027-05-01T00:00:00Z") };
  const stud = { plan: "student" as const, expiresAt: new Date("2027-05-01T00:00:00Z") };
  it("lisensi institusi aktif: tidak perlu beli individu/mahasiswa", () => {
    expect(planConflict(inst, "individual")).toMatch(/institusi aktif/);
    expect(planConflict(inst, "student")).toMatch(/institusi aktif/);
    expect(planConflict(inst, "institution-claim")).toMatch(/sudah memiliki/);
  });
  it("jenis berbeda ditolak, jenis sama boleh (perpanjangan)", () => {
    expect(planConflict(stud, "individual")).toMatch(/Mahasiswa/);
    expect(planConflict(stud, "institution-claim")).toMatch(/setelah itu/);
    expect(planConflict(stud, "student")).toBeNull();
    expect(planConflict(null, "individual")).toBeNull();
  });
});
