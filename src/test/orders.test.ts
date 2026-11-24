import { describe, expect, it } from "vitest";
import {
  normalizeEmailDomains,
  normalizeInstitutionName,
  normalizeRejectReason,
  parseAdminEmails,
  parseOrderRequest,
  quoteOrder,
  renewalReminderDue,
  sameOrder,
} from "@/lib/orders";

describe("permintaan pesanan", () => {
  it("langganan sah", () => {
    expect(parseOrderRequest({ kind: "subscription", plan: "student", months: 3 })).toEqual({ kind: "subscription", plan: "student", months: 3 });
  });
  it("menolak plan/bulan/jenis yang tidak dikenal (termasuk upaya mengirim harga sendiri)", () => {
    for (const bad of [
      null,
      "x",
      { kind: "subscription", plan: "institution", months: 1 },
      { kind: "subscription", plan: "individual", months: 2 },
      { kind: "subscription", plan: "individual", months: "1" },
      { kind: "weird" },
    ]) expect(() => parseOrderRequest(bad)).toThrow();
    const r = parseOrderRequest({ kind: "subscription", plan: "individual", months: 1, amount: 1 });
    expect(r).toEqual({ kind: "subscription", plan: "individual", months: 1 });
  });
  it("institusi: nama, jumlah pengguna, domain dinormalkan", () => {
    const r = parseOrderRequest({ kind: "institution", institutionName: "  UNS ", users: 250, emailDomains: "@Staff.uns.ac.id, @student.uns.ac.id\n@staff.uns.ac.id" });
    expect(r).toEqual({ kind: "institution", institutionName: "UNS", users: 250, emailDomains: ["staff.uns.ac.id", "student.uns.ac.id"] });
    expect(() => parseOrderRequest({ kind: "institution", institutionName: "UNS", users: 1001 })).toThrow();
    expect(() => parseOrderRequest({ kind: "institution", institutionName: "UNS", users: 0 })).toThrow();
    expect(() => parseOrderRequest({ kind: "institution", institutionName: "", users: 5 })).toThrow();
  });
});

describe("nama dan domain", () => {
  it("membuang karakter berbahaya dan merapikan spasi", () => {
    expect(normalizeInstitutionName("Univ\n<b>ersitas</b>   X")).toBe("Univ b ersitas /b  X".replace(/\s+/g, " "));
    expect(() => normalizeInstitutionName("A")).toThrow();
    expect(() => normalizeInstitutionName("x".repeat(81))).toThrow();
  });
  it("domain tidak valid ditolak; kosong = tanpa batasan; maksimal 10", () => {
    expect(normalizeEmailDomains("")).toEqual([]);
    expect(normalizeEmailDomains(undefined)).toEqual([]);
    expect(() => normalizeEmailDomains("bukan domain")).toThrow();
    expect(() => normalizeEmailDomains(["a@b.com"])).toThrow();
    expect(() => normalizeEmailDomains(Array.from({ length: 11 }, (_, i) => `d${i}.ac.id`))).toThrow();
  });
});

describe("rincian harga", () => {
  it("mahasiswa 3 bulan: Rp127.500, hemat Rp22.500 (15%)", () => {
    const q = quoteOrder({ kind: "subscription", plan: "student", months: 3 });
    expect(q.baseAmount).toBe(127_500);
    expect(q.discountIdr).toBe(22_500);
    expect(q.discountPct).toBe(15);
    expect(q.label).toBe("Premium Mahasiswa 3 bulan");
  });
  it("individu tanpa diskon", () => {
    const q = quoteOrder({ kind: "subscription", plan: "individual", months: 12 });
    expect([q.baseAmount, q.discountIdr, q.discountPct]).toEqual([600_000, 0, 0]);
  });
  it("institusi 150 pengguna: Rp4.500.000, label memuat nama institusi", () => {
    const q = quoteOrder({ kind: "institution", institutionName: "UNS", users: 150, emailDomains: [] });
    expect([q.baseAmount, q.discountIdr, q.discountPct]).toEqual([4_500_000, 500_000, 10]);
    expect(q.label).toContain("UNS");
    expect(q.label).toContain("150 pengguna");
  });
  it("sameOrder membandingkan isi tagihan", () => {
    const q = quoteOrder({ kind: "subscription", plan: "student", months: 1 });
    const row = { plan: "student", months: 1, label: q.label, base_amount_idr: 42_500 };
    expect(sameOrder(row, q)).toBe(true);
    expect(sameOrder({ ...row, months: 3 }, q)).toBe(false);
    expect(sameOrder({ ...row, plan: "individual" }, q)).toBe(false);
  });
});

describe("pengingat perpanjangan", () => {
  const now = new Date("2026-11-23T00:00:00Z");
  it("hanya dalam 7 hari terakhir dan bila tidak dibatalkan", () => {
    expect(renewalReminderDue(new Date("2026-11-29T00:00:00Z"), now, null)).toBe(true);
    expect(renewalReminderDue(new Date("2026-12-10T00:00:00Z"), now, null)).toBe(false);
    expect(renewalReminderDue(new Date("2026-11-22T00:00:00Z"), now, null)).toBe(false);
    expect(renewalReminderDue(new Date("2026-11-29T00:00:00Z"), now, "2026-11-01T00:00:00Z")).toBe(false);
  });
});

describe("admin", () => {
  it("daftar email admin dari env", () => {
    expect(parseAdminEmails(" A@x.com, b@y.id;bukan-email  ")).toEqual(["a@x.com", "b@y.id"]);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
  it("alasan penolakan wajib", () => {
    expect(normalizeRejectReason("  Nominal  tidak cocok ")).toBe("Nominal tidak cocok");
    expect(() => normalizeRejectReason("")).toThrow();
    expect(() => normalizeRejectReason("x".repeat(301))).toThrow();
  });
});
