// @ts-nocheck — penjalur test kustom; tipe longgar disengaja
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addMonthsUtc } from "@/lib/plans";
import { buildPayload, hasValidCrc, parseTlv } from "@/lib/qris";
import { fake } from "./fake-supabase";

vi.mock("@/integrations/supabase/client.server", async () => {
  const m = await import("./fake-supabase");
  return { supabaseAdmin: m.fake.client };
});

const STATIC = buildPayload([
  { tag: "00", value: "01" },
  { tag: "01", value: "11" },
  { tag: "26", value: "0016COM.EXAMPLE.WWW0118936000000000000000" },
  { tag: "52", value: "5499" },
  { tag: "53", value: "360" },
  { tag: "58", value: "ID" },
  { tag: "59", value: "SEMAR TEST" },
  { tag: "60", value: "SURAKARTA" },
]);

process.env["PAYMENT_MODE"] = "qris";
process.env["QRIS_STATIC"] = STATIC;
process.env["ADMIN_EMAILS"] = "admin@semar.id, palsu@semar.id";

const S = () => import("@/lib/premium.server");
const near = (iso: string, d: Date) => Math.abs(new Date(iso).getTime() - d.getTime()) < 10_000;
const sub = (plan: "individual" | "student", months: number) => ({ kind: "subscription" as const, plan, months });
const inst = (name: string, users: number, emailDomains: string[] = []) => ({ kind: "institution" as const, institutionName: name, users, emailDomains });
const pay = (orderId: string) => fake.tables["payments"]!.find((p) => p.order_id === orderId)!;
const licenses = (uid: string) => fake.tables["licenses"]!.filter((l) => l.user_id === uid);

beforeEach(() => {
  fake.reset();
  fake.users.set("admin", { email: "admin@semar.id", confirmed: true });
  fake.users.set("palsu", { email: "palsu@semar.id", confirmed: false }); // email admin tapi belum terkonfirmasi
  for (const u of ["u1", "u2", "u3"]) fake.users.set(u, { email: `${u}@gmail.com`, confirmed: true });
  fake.users.set("mhs", { email: "mhs@student.uns.ac.id", confirmed: true });
  fake.users.set("dsn", { email: "dsn@staff.uns.ac.id", confirmed: true });
});

describe("tagihan QRIS", () => {
  it("individu 1 bulan: total = harga + kode unik, QR dinamis valid, klik ganda tidak membuat tagihan baru", async () => {
    const s = await S();
    const { orderId } = await s.createOrderForUser("u1", sub("individual", 1));
    const p = pay(orderId);
    expect(p.unique_code).toBe(1);
    expect(p.amount_idr).toBe(50_001);
    expect(hasValidCrc(p.qr_string)).toBe(true);
    const tlv = parseTlv(p.qr_string);
    expect(tlv.find((t) => t.tag === "54")?.value).toBe("50001");
    expect(tlv.find((t) => t.tag === "01")?.value).toBe("12");
    expect((await s.createOrderForUser("u1", sub("individual", 1))).orderId).toBe(orderId);
    expect(fake.tables["payments"]).toHaveLength(1);
  });

  it("kode unik berurut antarpesanan; setelah 999 kembali ke 1", async () => {
    const s = await S();
    const a = await s.createOrderForUser("u1", sub("individual", 1));
    const b = await s.createOrderForUser("u2", sub("individual", 1));
    expect([pay(a.orderId).unique_code, pay(b.orderId).unique_code]).toEqual([1, 2]);
    fake.state.seq = 998;
    const c = await s.createOrderForUser("u3", sub("individual", 1));
    expect(pay(c.orderId).unique_code).toBe(999);
    fake.tables["payments"]!.forEach((p) => (p.status = "expired"));
    const d = await s.createOrderForUser("u1", sub("individual", 1));
    expect(pay(d.orderId).unique_code).toBe(1);
  });

  it("mengganti pilihan menutup tagihan lama yang belum dibayar", async () => {
    const s = await S();
    const a = await s.createOrderForUser("u1", sub("individual", 1));
    const b = await s.createOrderForUser("u1", sub("individual", 3));
    expect(b.orderId).not.toBe(a.orderId);
    expect(pay(a.orderId).status).toBe("expired");
    expect(pay(b.orderId).base_amount_idr).toBe(150_000);
  });

  it("mahasiswa wajib Verified; harga Rp42.500/bulan", async () => {
    const s = await S();
    await expect(s.createOrderForUser("mhs", sub("student", 1))).rejects.toThrow(/verifikasi/i);
    fake.tables["student_verifications"]!.push({ user_id: "mhs", status: "pending", expires_at: null });
    await expect(s.createOrderForUser("mhs", sub("student", 1))).rejects.toThrow(/verifikasi/i);
    fake.tables["student_verifications"]![0]!.status = "verified";
    fake.tables["student_verifications"]![0]!.expires_at = new Date(Date.now() + 86_400_000 * 300).toISOString();
    const { orderId } = await s.createOrderForUser("mhs", sub("student", 1));
    expect(pay(orderId).base_amount_idr).toBe(42_500);
    expect(pay(orderId).amount_idr).toBe(42_501);
    // verifikasi kedaluwarsa -> tidak boleh lagi
    fake.tables["student_verifications"]![0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    await expect(s.createOrderForUser("mhs", sub("student", 3))).rejects.toThrow(/verifikasi/i);
  });

  it("satu jenis langganan: individu aktif tidak bisa beli mahasiswa; institusi aktif tidak perlu beli", async () => {
    const s = await S();
    const future = new Date(Date.now() + 86_400_000 * 20).toISOString();
    fake.tables["licenses"]!.push({ id: "L1", user_id: "u1", token: "T1", plan: "individual", source: "payment", expires_at: future });
    fake.tables["student_verifications"]!.push({ user_id: "u1", status: "verified", expires_at: new Date(Date.now() + 86_400_000 * 300).toISOString() });
    await expect(s.createOrderForUser("u1", sub("student", 1))).rejects.toThrow(/Individu aktif/);
    await expect(s.createOrderForUser("u1", sub("individual", 1))).resolves.toBeTruthy(); // perpanjangan boleh
    fake.tables["licenses"]!.push({ id: "L2", user_id: "u2", token: "T2", plan: "institution", source: "institution", expires_at: future });
    await expect(s.createOrderForUser("u2", sub("individual", 1))).rejects.toThrow(/institusi aktif/);
  });

  it("pembayaran mati bila PAYMENT_MODE bukan qris", async () => {
    const s = await S();
    process.env["PAYMENT_MODE"] = "promo";
    try {
      await expect(s.createOrderForUser("u1", sub("individual", 1))).rejects.toThrow(/belum diaktifkan/);
      expect(s.publicConfig().enabled).toBe(false);
    } finally {
      process.env["PAYMENT_MODE"] = "qris";
    }
    expect(s.publicConfig().enabled).toBe(true);
    expect(s.publicConfig().merchantName).toBe("SEMAR TEST");
  });
});

describe('"Saya sudah bayar" dan batas waktu', () => {
  it("masuk antrean admin; tidak bisa dibatalkan atau diganti sesudahnya", async () => {
    const s = await S();
    const { orderId } = await s.createOrderForUser("u1", sub("individual", 1));
    await s.claimPaid("u1", orderId);
    await s.claimPaid("u1", orderId); // idempotent
    expect(pay(orderId).claimed_at).toBeTruthy();
    expect((await s.getOrderForUser("u1", orderId)).waitingAdmin).toBe(true);
    await expect(s.cancelOrder("u1", orderId)).rejects.toThrow(/diperiksa admin/);
    await expect(s.createOrderForUser("u1", sub("individual", 3))).rejects.toThrow(/diperiksa admin/);
    await expect(s.claimPaid("u2", orderId)).rejects.toThrow(/tidak ditemukan/); // bukan milik u2
  });

  it("tagihan yang tidak ditandai dibayar kedaluwarsa dan kodenya bebas lagi", async () => {
    const s = await S();
    const { orderId } = await s.createOrderForUser("u1", sub("individual", 1));
    pay(orderId).expires_at = new Date(Date.now() - 1000).toISOString();
    expect((await s.getOrderForUser("u1", orderId)).status).toBe("expired");
    await expect(s.claimPaid("u1", orderId)).rejects.toThrow(/kedaluwarsa/);
  });
});

describe("konfirmasi admin dan token", () => {
  it("hanya admin dengan email terkonfirmasi yang bisa konfirmasi", async () => {
    const s = await S();
    const { orderId } = await s.createOrderForUser("u1", sub("individual", 1));
    await expect(s.confirmPayment("u2", orderId)).rejects.toThrow(/Akses ditolak/);
    await expect(s.confirmPayment("palsu", orderId)).rejects.toThrow(/Akses ditolak/);
    expect(await s.isAdmin("admin")).toBe(true);
    expect(pay(orderId).status).toBe("pending");
  });

  it("konfirmasi menerbitkan token; konfirmasi ulang tidak menggandakan masa berlaku", async () => {
    const s = await S();
    const { orderId } = await s.createOrderForUser("u1", sub("individual", 1));
    await s.claimPaid("u1", orderId);
    await s.confirmPayment("admin", orderId);
    const l = licenses("u1");
    expect(l).toHaveLength(1);
    expect(l[0]!.plan).toBe("individual");
    expect(l[0]!.token).toMatch(/^SMD-/);
    expect(near(l[0]!.expires_at, addMonthsUtc(new Date(), 1))).toBe(true);
    expect(pay(orderId).status).toBe("paid");
    const before = l[0]!.expires_at;
    expect((await s.confirmPayment("admin", orderId)).alreadyPaid).toBe(true);
    expect(licenses("u1")[0]!.expires_at).toBe(before);
    expect(fake.tables["notifications"]!.some((n) => n.user_id === "u1" && n.kind === "payment_paid")).toBe(true);
  });

  it("perpanjangan memakai token yang sama dan menyambung dari masa berlaku saat ini", async () => {
    const s = await S();
    const a = await s.createOrderForUser("u1", sub("individual", 1));
    await s.confirmPayment("admin", a.orderId);
    const first = licenses("u1")[0]!;
    const token = first.token;
    const firstExp = first.expires_at;
    first.cancelled_at = new Date().toISOString();
    const b = await s.createOrderForUser("u1", sub("individual", 3));
    await s.confirmPayment("admin", b.orderId);
    expect(licenses("u1")).toHaveLength(1);
    expect(licenses("u1")[0]!.token).toBe(token);
    expect(near(licenses("u1")[0]!.expires_at, addMonthsUtc(new Date(firstExp), 3))).toBe(true);
    expect(licenses("u1")[0]!.cancelled_at).toBeNull();
  });

  it("langganan yang sudah habis dihidupkan lagi dengan token lama", async () => {
    const s = await S();
    fake.tables["licenses"]!.push({ id: "L1", user_id: "u1", token: "SMD-OLD", plan: "individual", source: "payment", starts_at: "2020-01-01T00:00:00.000Z", expires_at: "2020-02-01T00:00:00.000Z" });
    const { orderId } = await s.createOrderForUser("u1", sub("individual", 1));
    await s.confirmPayment("admin", orderId);
    expect(licenses("u1")).toHaveLength(1);
    expect(licenses("u1")[0]!.token).toBe("SMD-OLD");
    expect(near(licenses("u1")[0]!.expires_at, addMonthsUtc(new Date(), 1))).toBe(true);
  });

  it("konfirmasi ditolak bila pembeli kini punya lisensi institusi aktif (tidak ada status berubah)", async () => {
    const s = await S();
    const { orderId } = await s.createOrderForUser("u1", sub("individual", 1));
    fake.tables["licenses"]!.push({ id: "L9", user_id: "u1", token: "TI", plan: "institution", source: "institution", expires_at: new Date(Date.now() + 86_400_000 * 30).toISOString() });
    await expect(s.confirmPayment("admin", orderId)).rejects.toThrow(/Tidak bisa dikonfirmasi/);
    expect(pay(orderId).status).toBe("pending");
  });

  it("penolakan wajib beralasan, memberi tahu pembeli, dan tidak bisa dikonfirmasi lagi", async () => {
    const s = await S();
    const { orderId } = await s.createOrderForUser("u1", sub("individual", 1));
    await expect(s.rejectPayment("admin", orderId, " ")).rejects.toThrow(/Alasan/);
    await expect(s.rejectPayment("u2", orderId, "nominal salah")).rejects.toThrow(/Akses ditolak/);
    await s.rejectPayment("admin", orderId, "Nominal tidak ditemukan di mutasi");
    expect(pay(orderId).status).toBe("failed");
    expect(pay(orderId).reject_reason).toMatch(/mutasi/);
    expect(fake.tables["notifications"]!.find((n) => n.kind === "payment_rejected")!.body).toMatch(/Nominal tidak ditemukan/);
    await expect(s.confirmPayment("admin", orderId)).rejects.toThrow(/sudah ditolak/);
    expect(licenses("u1")).toHaveLength(0);
  });

  it("pembatalan menghentikan perpanjangan; akses tetap sampai habis", async () => {
    const s = await S();
    await expect(s.cancelSubscription("u1")).rejects.toThrow(/Tidak ada/);
    const { orderId } = await s.createOrderForUser("u1", sub("individual", 1));
    await s.confirmPayment("admin", orderId);
    const r = await s.cancelSubscription("u1");
    expect(new Date(r.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(licenses("u1")[0]!.cancelled_at).toBeTruthy();
    const o = await s.billingOverview("u1");
    expect(o.license?.active).toBe(true);
    expect(o.license?.cancelled).toBe(true);
  });
});

describe("lisensi institusi", () => {
  it("beli: tagihan memuat nama institusi; lunas -> kupon aktif 1 tahun", async () => {
    const s = await S();
    const { orderId } = await s.createOrderForUser("u1", inst("UNS", 250, ["staff.uns.ac.id", "student.uns.ac.id"]));
    const p = pay(orderId);
    expect(p.label).toContain("UNS");
    expect(p.base_amount_idr).toBe(4_250_000);
    expect(p.kind).toBe("institution");
    const c = fake.tables["institution_coupons"]![0]!;
    expect([c.status, c.seats, c.days, c.email_domains]).toEqual(["pending", 250, 365, ["staff.uns.ac.id", "student.uns.ac.id"]]);
    expect((await s.createOrderForUser("u1", inst("UNS", 250, ["student.uns.ac.id", "staff.uns.ac.id"]))).orderId).toBe(orderId);
    await s.confirmPayment("admin", orderId);
    expect(c.status).toBe("active");
    expect(near(c.valid_until, addMonthsUtc(new Date(), 12))).toBe(true);
    expect(fake.tables["notifications"]!.find((n) => n.kind === "institution_active")!.body).toContain(c.code);
    expect((await s.getOrderForUser("u1", orderId)).couponCode).toBe(c.code);
  });

  it("tagihan institusi yang ditolak atau diganti menghapus kupon pending-nya", async () => {
    const s = await S();
    const a = await s.createOrderForUser("u1", inst("UNS", 50));
    expect(fake.tables["institution_coupons"]).toHaveLength(1);
    const b = await s.createOrderForUser("u1", inst("UNS", 150));
    expect(fake.tables["institution_coupons"]).toHaveLength(1);
    expect(pay(a.orderId).status).toBe("expired");
    await s.rejectPayment("admin", b.orderId, "Tidak ada pembayaran");
    expect(fake.tables["institution_coupons"]).toHaveLength(0);
  });

  async function activeCoupon(seats: number, domains: string[]) {
    const s = await S();
    const { orderId } = await s.createOrderForUser("u3", inst("UNS", seats, domains));
    await s.confirmPayment("admin", orderId);
    return fake.tables["institution_coupons"]![0]!;
  }

  it("klaim: domain diizinkan -> lisensi berakhir bersama lisensi institusi", async () => {
    const s = await S();
    const c = await activeCoupon(100, ["student.uns.ac.id", "staff.uns.ac.id"]);
    const r = await s.claimCoupon("mhs", c.code.toLowerCase());
    expect(r.institution).toBe("UNS");
    expect(licenses("mhs")[0]!.plan).toBe("institution");
    expect(licenses("mhs")[0]!.expires_at).toBe(c.valid_until);
    await expect(s.claimCoupon("mhs", c.code)).rejects.toThrow(/sudah memiliki lisensi institusi/);
    await s.claimCoupon("dsn", c.code); // domain kedua juga boleh
    expect(licenses("dsn")).toHaveLength(1);
  });

  it("klaim ditolak: domain lain, kuota penuh, kode salah, email belum terkonfirmasi, langganan berbayar aktif", async () => {
    const s = await S();
    const c = await activeCoupon(1, ["student.uns.ac.id", "staff.uns.ac.id"]);
    await expect(s.claimCoupon("u1", c.code)).rejects.toThrow(/domain/);
    await s.claimCoupon("mhs", c.code);
    await expect(s.claimCoupon("dsn", c.code)).rejects.toThrow(/Kuota/);
    await expect(s.claimCoupon("dsn", "SMD-ZZZZ")).rejects.toThrow(/tidak ditemukan/);
    await expect(s.claimCoupon("dsn", "bukan kode")).rejects.toThrow(/Format/);
    fake.users.set("baru", { email: "baru@student.uns.ac.id", confirmed: false });
    await expect(s.claimCoupon("baru", c.code)).rejects.toThrow(/Konfirmasi email/);
    fake.users.set("bayar", { email: "bayar@student.uns.ac.id", confirmed: true });
    fake.tables["licenses"]!.push({ id: "LP", user_id: "bayar", token: "TP", plan: "individual", source: "payment", expires_at: new Date(Date.now() + 86_400_000 * 10).toISOString() });
    await expect(s.claimCoupon("bayar", c.code)).rejects.toThrow(/Individu aktif/);
  });

  it("kupon belum dibayar (pending) tidak bisa diklaim", async () => {
    const s = await S();
    await s.createOrderForUser("u3", inst("UNS", 10));
    await expect(s.claimCoupon("mhs", fake.tables["institution_coupons"]![0]!.code)).rejects.toThrow(/belum aktif/);
  });
});

describe("antrean admin", () => {
  it("menampilkan yang sudah ditandai dibayar, lengkap dengan email dan kode unik", async () => {
    const s = await S();
    const a = await s.createOrderForUser("u1", sub("individual", 1));
    await s.createOrderForUser("u2", sub("individual", 1));
    await s.claimPaid("u1", a.orderId);
    const q = await s.listPaymentsForAdmin("admin", "claimed");
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ email: "u1@gmail.com", amount: 50_001, uniqueCode: 1 });
    expect(await s.listPaymentsForAdmin("admin", "open")).toHaveLength(2);
    await expect(s.listPaymentsForAdmin("u1", "claimed")).rejects.toThrow(/Akses ditolak/);
  });
});

describe("dashboard institusi", () => {
  it("pemilik melihat pengguna yang sudah klaim; mengubah domain; mencabut satu pengguna", async () => {
    const s = await S();
    const { orderId } = await s.createOrderForUser("u3", inst("UNS", 2, ["student.uns.ac.id"]));
    expect((await s.listOwnedInstitutions("u3"))[0]).toMatchObject({ status: "pending", code: null, used: 0 });
    await s.confirmPayment("admin", orderId);
    const c = fake.tables["institution_coupons"]![0]!;
    await s.claimCoupon("mhs", c.code);
    const [owned] = await s.listOwnedInstitutions("u3");
    expect(owned).toMatchObject({ status: "active", code: c.code, seats: 2, used: 1 });
    expect(owned!.users[0]).toMatchObject({ email: "mhs@student.uns.ac.id" });
    expect(await s.listOwnedInstitutions("u1")).toHaveLength(0);

    await expect(s.setInstitutionDomains("u1", c.id, "x.ac.id")).rejects.toThrow(/tidak ditemukan/);
    expect(await s.setInstitutionDomains("u3", c.id, "@student.uns.ac.id, @staff.uns.ac.id")).toEqual(["staff.uns.ac.id", "student.uns.ac.id"]);
    await s.claimCoupon("dsn", c.code); // domain staf kini diizinkan
    expect((await s.listOwnedInstitutions("u3"))[0]!.used).toBe(2);
    await expect(s.removeInstitutionUser("u1", c.id, "dsn")).rejects.toThrow(/tidak ditemukan/);
    await s.removeInstitutionUser("u3", c.id, "dsn");
    expect(new Date(licenses("dsn")[0]!.expires_at).getTime()).toBeLessThan(Date.now() + 1000);
    expect((await s.listOwnedInstitutions("u3"))[0]!.used).toBe(1);
    await expect(s.claimCoupon("dsn", c.code)).resolves.toBeTruthy(); // kursi kembali; dapat klaim lagi
  });
});
