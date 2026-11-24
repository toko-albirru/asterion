import { describe, expect, it } from "vitest";
import { buildPayload, crc16, hasValidCrc, parseStaticQris, parseTlv, toDynamicQris, totalWithCode } from "@/lib/qris";

const STATIC = buildPayload([
  { tag: "00", value: "01" },
  { tag: "01", value: "11" },
  { tag: "26", value: "0016COM.EXAMPLE.WWW0118936000000000000000" },
  { tag: "51", value: "0014ID.CO.QRIS.WWW0215ID1234567890120303UMI" },
  { tag: "52", value: "5499" },
  { tag: "53", value: "360" },
  { tag: "58", value: "ID" },
  { tag: "59", value: "SEMAR TEST" },
  { tag: "60", value: "SURAKARTA" },
  { tag: "61", value: "57100" },
  { tag: "62", value: "0703A01" },
]);

describe("qris", () => {
  it("CRC16-CCITT-FALSE sesuai vektor standar", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("menerima QRIS statis yang utuh", () => {
    expect(hasValidCrc(STATIC)).toBe(true);
    const info = parseStaticQris(STATIC);
    expect(info.merchantName).toBe("SEMAR TEST");
    expect(info.merchantCity).toBe("SURAKARTA");
  });

  it("menolak CRC rusak, QRIS dinamis, dan yang sudah bernominal", () => {
    const broken = STATIC.slice(0, -1) + (STATIC.endsWith("0") ? "1" : "0");
    expect(() => parseStaticQris(broken)).toThrow(/CRC/);
    expect(() => parseStaticQris(toDynamicQris(STATIC, 42731))).toThrow(/dinamis/);
    const withAmount = buildPayload([...parseTlv(STATIC.slice(0, -8)), { tag: "54", value: "1000" }]);
    expect(() => parseStaticQris(withAmount)).toThrow();
  });

  it("mengubah ke dinamis: tag 01=12, nominal di tag 54 sebelum 58, CRC benar", () => {
    const dyn = toDynamicQris(STATIC, 42731);
    expect(hasValidCrc(dyn)).toBe(true);
    const tlv = parseTlv(dyn);
    expect(tlv.find((t) => t.tag === "01")?.value).toBe("12");
    expect(tlv.find((t) => t.tag === "54")?.value).toBe("42731");
    const order = tlv.map((t) => Number(t.tag));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(tlv.at(-1)?.tag).toBe("63");
    // data merchant tidak berubah
    expect(tlv.find((t) => t.tag === "59")?.value).toBe("SEMAR TEST");
    expect(tlv.find((t) => t.tag === "26")?.value).toBe(parseTlv(STATIC).find((t) => t.tag === "26")?.value);
  });

  it("menolak nominal tidak valid", () => {
    for (const bad of [0, -5, 1.5, NaN, 1e12]) expect(() => toDynamicQris(STATIC, bad)).toThrow();
  });

  it("total = harga + kode unik (1..999)", () => {
    expect(totalWithCode(42500, 231)).toBe(42731);
    expect(totalWithCode(42500, 999)).toBe(43499);
    expect(() => totalWithCode(42500, 0)).toThrow();
    expect(() => totalWithCode(42500, 1000)).toThrow();
  });
});
