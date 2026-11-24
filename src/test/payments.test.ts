import { describe, expect, it } from "vitest";
import { grossAmountMatches, makeOrderId, mapMidtransStatus, parsePaymentMode, verifyMidtransSignature } from "@/lib/payments";

describe("payment rules", () => {
  it("defaults to promo and only accepts known modes", () => {
    expect(parsePaymentMode(undefined)).toBe("promo");
    expect(parsePaymentMode("")).toBe("promo");
    expect(parsePaymentMode("whatever")).toBe("promo");
    expect(parsePaymentMode(" Midtrans ")).toBe("midtrans");
    expect(parsePaymentMode("mock")).toBe("mock");
    expect(parsePaymentMode(" QRIS ")).toBe("qris");
  });

  it("order ids are unique, safe and short enough for Midtrans", () => {
    const a = makeOrderId();
    const b = makeOrderId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^SMD-[A-Z0-9]+-[A-F0-9]{20}$/);
    expect(a.length).toBeLessThanOrEqual(50);
  });

  it("maps Midtrans statuses", () => {
    expect(mapMidtransStatus("settlement")).toBe("paid");
    expect(mapMidtransStatus("capture", "accept")).toBe("paid");
    expect(mapMidtransStatus("capture", "challenge")).toBe("pending");
    expect(mapMidtransStatus("pending")).toBe("pending");
    expect(mapMidtransStatus("expire")).toBe("expired");
    expect(mapMidtransStatus("deny")).toBe("failed");
    expect(mapMidtransStatus("cancel")).toBe("failed");
    expect(mapMidtransStatus(undefined)).toBe("pending");
  });

  it("compares Midtrans gross amounts numerically", () => {
    expect(grossAmountMatches("50000.00", 50000)).toBe(true);
    expect(grossAmountMatches("19999.00", 50000)).toBe(false);
    expect(grossAmountMatches(undefined, 50000)).toBe(false);
  });

  it("verifies the Midtrans signature (SHA512 of order+status+gross+key)", async () => {
    const { createHash } = await import("node:crypto");
    const n = { order_id: "SMD-1", status_code: "200", gross_amount: "50000.00" };
    const sig = createHash("sha512").update(`${n.order_id}${n.status_code}${n.gross_amount}SERVERKEY`).digest("hex");
    expect(await verifyMidtransSignature({ ...n, signature_key: sig }, "SERVERKEY")).toBe(true);
    expect(await verifyMidtransSignature({ ...n, signature_key: sig }, "OTHERKEY")).toBe(false);
    expect(await verifyMidtransSignature({ ...n, signature_key: "abc" }, "SERVERKEY")).toBe(false);
    expect(await verifyMidtransSignature({ ...n }, "SERVERKEY")).toBe(false);
  });
});
