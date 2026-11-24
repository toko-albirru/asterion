import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "./fake-db";
import { ORDER, TEST_KEY, jsonRes, settlementBody } from "./midtrans-fixtures";

const h = vi.hoisted(() => ({
  db: null as unknown as { client: { from: (n: string) => unknown } },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (n: string) => h.db.client.from(n) },
}));
const db = createFakeDb();
h.db = db;
const { syncMidtransPayment, settlePaid } = await import("@/lib/payment.server");

const fetchMock = vi.fn();
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  db.reset();
  process.env["MIDTRANS_SERVER_KEY"] = TEST_KEY;
  process.env["PAYMENT_MODE"] = "midtrans";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  errorSpy.mockRestore();
});

const addPayment = (extra: Record<string, unknown> = {}) =>
  db.tables["payments"]!.push({
    id: "p1",
    order_id: ORDER,
    user_id: "u1",
    provider: "midtrans",
    amount_idr: 50000,
    status: "pending",
    license_id: null,
    ...extra,
  });
const pay = () => db.tables["payments"]![0]!;
const licenses = () => db.tables["licenses"]!;

describe("syncMidtransPayment: pembayaran valid", () => {
  it("settlement yang cocok -> paid, tepat satu token Pro 30 hari, tertaut ke pembayaran", async () => {
    addPayment();
    fetchMock.mockResolvedValue(jsonRes(settlementBody()));
    expect(await syncMidtransPayment(ORDER)).toBe("paid");
    expect(licenses()).toHaveLength(1);
    expect(licenses()[0]).toMatchObject({
      user_id: "u1",
      plan: "individual",
      payment_status: "paid",
      price_idr: 50000,
    });
    expect(pay()).toMatchObject({ status: "paid", license_id: licenses()[0]!["id"] });
    const span =
      new Date(licenses()[0]!["expires_at"] as string).getTime() -
      new Date(licenses()[0]!["starts_at"] as string).getTime();
    expect(span).toBe(30 * 86400000);
  });

  it("dipanggil berulang/bersamaan (webhook ganda + polling) tetap satu token", async () => {
    addPayment();
    fetchMock.mockImplementation(async () => jsonRes(settlementBody()));
    await Promise.all([
      syncMidtransPayment(ORDER),
      syncMidtransPayment(ORDER),
      syncMidtransPayment(ORDER),
    ]);
    await syncMidtransPayment(ORDER);
    expect(licenses()).toHaveLength(1);
  });

  it("pembayaran masuk terlambat setelah ditandai expired lokal tetap diselesaikan", async () => {
    addPayment({ status: "expired" });
    fetchMock.mockResolvedValue(jsonRes(settlementBody()));
    expect(await syncMidtransPayment(ORDER)).toBe("paid");
    expect(licenses()).toHaveLength(1);
  });

  it("pembayaran sudah paid di DB tapi token belum terbit -> dilengkapi tanpa memanggil Midtrans", async () => {
    addPayment({ status: "paid" });
    expect(await syncMidtransPayment(ORDER)).toBe("paid");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(licenses()).toHaveLength(1);
  });
});

describe("syncMidtransPayment: bukti tidak valid TIDAK boleh menerbitkan token", () => {
  it.each([
    ["gross_amount hilang", { gross_amount: undefined }],
    ["gross_amount lebih kecil", { gross_amount: "1000.00" }],
    ["gross_amount dibulatkan (50000.40)", { gross_amount: "50000.40" }],
    ["order_id lain", { order_id: "SMD-OTHER-ORDER" }],
    ["order_id hilang", { order_id: undefined }],
    ["status_code bukan 200", { status_code: "201" }],
    ["status_code hilang", { status_code: undefined }],
    ["payment_type bukan qris", { payment_type: "bank_transfer" }],
    ["payment_type hilang", { payment_type: undefined }],
    ["mata uang bukan IDR", { currency: "USD" }],
  ])("settlement dengan %s -> failed, tanpa token", async (_n, over) => {
    addPayment();
    fetchMock.mockResolvedValue(jsonRes(settlementBody(over)));
    expect(await syncMidtransPayment(ORDER)).toBe("failed");
    expect(licenses()).toHaveLength(0);
    expect(pay()).toMatchObject({ status: "failed", license_id: null });
    expect(errorSpy).toHaveBeenCalled(); // kejadian ini harus terlihat di log
  });

  it("nominal dibandingkan dengan nominal di database, bukan konstanta harga", async () => {
    addPayment({ amount_idr: 35000 });
    fetchMock.mockResolvedValue(jsonRes(settlementBody({ gross_amount: "50000.00" })));
    expect(await syncMidtransPayment(ORDER)).toBe("failed");
    expect(licenses()).toHaveLength(0);
  });

  it("pembayaran gagal karena bukti tidak valid masih bisa lunas bila Midtrans kemudian menyatakan valid", async () => {
    addPayment();
    fetchMock.mockResolvedValueOnce(jsonRes(settlementBody({ gross_amount: undefined })));
    expect(await syncMidtransPayment(ORDER)).toBe("failed");
    fetchMock.mockResolvedValueOnce(jsonRes(settlementBody()));
    expect(await syncMidtransPayment(ORDER)).toBe("paid");
    expect(licenses()).toHaveLength(1);
  });

  it("pembayaran milik provider mock tidak tersentuh Midtrans (tanpa panggilan jaringan, tanpa token)", async () => {
    addPayment({ provider: "mock" });
    expect(await syncMidtransPayment(ORDER)).toBe("pending");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(licenses()).toHaveLength(0);
  });

  it("order yang tidak ada di database -> failed tanpa memanggil Midtrans", async () => {
    expect(await syncMidtransPayment("SMD-UNKNOWN-0001")).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(licenses()).toHaveLength(0);
  });

  it("Midtrans error server/jaringan -> melempar error, tidak ada perubahan", async () => {
    addPayment();
    fetchMock.mockResolvedValue(jsonRes({}, 503));
    await expect(syncMidtransPayment(ORDER)).rejects.toThrow();
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(syncMidtransPayment(ORDER)).rejects.toThrow();
    expect(pay()["status"]).toBe("pending");
    expect(licenses()).toHaveLength(0);
  });
});

describe("syncMidtransPayment: status bukan lunas", () => {
  it("masih pending (belum dibayar)", async () => {
    addPayment();
    fetchMock.mockResolvedValue(
      jsonRes(settlementBody({ status_code: "201", transaction_status: "pending" })),
    );
    expect(await syncMidtransPayment(ORDER)).toBe("pending");
    expect(pay()["status"]).toBe("pending");
    expect(licenses()).toHaveLength(0);
  });

  it("order belum dikenal Midtrans (404) tetap pending", async () => {
    addPayment();
    fetchMock.mockResolvedValue(jsonRes({ status_code: "404" }, 404));
    expect(await syncMidtransPayment(ORDER)).toBe("pending");
    expect(pay()["status"]).toBe("pending");
  });

  it("expire -> expired dan tersimpan; deny/cancel -> failed", async () => {
    addPayment();
    fetchMock.mockResolvedValue(
      jsonRes(settlementBody({ status_code: "407", transaction_status: "expire" })),
    );
    expect(await syncMidtransPayment(ORDER)).toBe("expired");
    expect(pay()["status"]).toBe("expired");

    db.reset();
    addPayment();
    fetchMock.mockResolvedValue(
      jsonRes(settlementBody({ status_code: "202", transaction_status: "deny" })),
    );
    expect(await syncMidtransPayment(ORDER)).toBe("failed");
    expect(pay()["status"]).toBe("failed");
    expect(licenses()).toHaveLength(0);
  });

  it("expire dari respons yang order_id-nya salah diabaikan", async () => {
    addPayment();
    fetchMock.mockResolvedValue(
      jsonRes(settlementBody({ order_id: "SMD-OTHER-ORDER", transaction_status: "expire" })),
    );
    expect(await syncMidtransPayment(ORDER)).toBe("pending");
    expect(pay()["status"]).toBe("pending");
  });

  it("capture dengan fraud challenge belum dianggap lunas", async () => {
    addPayment();
    fetchMock.mockResolvedValue(
      jsonRes(settlementBody({ transaction_status: "capture", fraud_status: "challenge" })),
    );
    expect(await syncMidtransPayment(ORDER)).toBe("pending");
    expect(licenses()).toHaveLength(0);
  });

  it("memakai order id dari database ke Midtrans, bukan dari respons", async () => {
    addPayment();
    fetchMock.mockResolvedValue(jsonRes(settlementBody()));
    await syncMidtransPayment(ORDER);
    expect(String(fetchMock.mock.calls[0]![0])).toContain(`/v2/${ORDER}/status`);
  });
});

describe("settlePaid: pembayaran mock tidak boleh menerbitkan token di luar mode mock", () => {
  it("mode midtrans/promo: provider mock diabaikan walau dipanggil langsung", async () => {
    for (const mode of ["midtrans", "promo"]) {
      db.reset();
      process.env["PAYMENT_MODE"] = mode;
      addPayment({ provider: "mock" });
      await settlePaid(ORDER);
      expect(licenses()).toHaveLength(0);
      expect(pay()["status"]).toBe("pending");
    }
  });

  it("mode mock: provider mock tetap bisa diselesaikan (alur uji)", async () => {
    process.env["PAYMENT_MODE"] = "mock";
    addPayment({ provider: "mock" });
    await settlePaid(ORDER);
    expect(licenses()).toHaveLength(1);
    expect(pay()["status"]).toBe("paid");
  });
});
