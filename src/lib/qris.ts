// QRIS statis -> dinamis. Murni (tanpa jaringan/database) supaya mudah dites.
// Standar: EMVCo Merchant-Presented QR (dipakai QRIS). Kolom CRC = tag 63, CRC16-CCITT-FALSE.

export type Tlv = { tag: string; value: string };

/** Kode unik dialokasikan database (urut 1..999 lalu kembali ke 1). Lihat fungsi SQL next_qris_code. */
export const QRIS_CODE_MIN = 1;
export const QRIS_CODE_MAX = 999;
const MAX_AMOUNT_IDR = 99_999_999;

export function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseTlv(payload: string): Tlv[] {
  const out: Tlv[] = [];
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const lenText = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenText)) throw new Error("Format QRIS tidak valid.");
    const len = Number(lenText);
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length !== len) throw new Error("Format QRIS tidak valid (panjang data).");
    out.push({ tag, value });
    i += 4 + len;
  }
  return out;
}

function serialize(tlv: readonly Tlv[]): string {
  return tlv.map((t) => t.tag + String(t.value.length).padStart(2, "0") + t.value).join("");
}

/** Susun payload dari daftar TLV (tanpa tag 63) dan tambahkan CRC yang benar. */
export function buildPayload(tlv: readonly Tlv[]): string {
  const body = serialize(tlv.filter((t) => t.tag !== "63")) + "6304";
  return body + crc16(body);
}

export function hasValidCrc(payload: string): boolean {
  if (payload.length < 8 || payload.slice(-8, -4) !== "6304") return false;
  return crc16(payload.slice(0, -4)) === payload.slice(-4).toUpperCase();
}

export type StaticQrisInfo = { tlv: Tlv[]; merchantName: string; merchantCity: string };

/** Periksa bahwa string adalah QRIS STATIS yang utuh (CRC cocok, tanpa nominal). Melempar Error bila tidak. */
export function parseStaticQris(raw: string): StaticQrisInfo {
  const payload = raw.trim();
  if (!hasValidCrc(payload)) throw new Error("QRIS tidak valid: CRC tidak cocok. Pastikan string disalin utuh dari hasil scan.");
  const tlv = parseTlv(payload);
  const get = (tag: string) => tlv.find((t) => t.tag === tag)?.value;
  if (tlv[0]?.tag !== "00" || tlv[0].value !== "01") throw new Error("QRIS tidak valid: bukan format EMV QR.");
  const method = get("01");
  if (method === "12") throw new Error("Ini sudah QRIS dinamis. Pakai QRIS statis dari aplikasi merchant.");
  if (method !== "11") throw new Error("QRIS tidak valid: jenis QR tidak dikenali.");
  if (get("54") !== undefined) throw new Error("QRIS statis ini sudah memuat nominal.");
  if (get("58") !== "ID") throw new Error("QRIS tidak valid: bukan QRIS Indonesia.");
  if (!tlv.some((t) => Number(t.tag) >= 26 && Number(t.tag) <= 51)) throw new Error("QRIS tidak valid: data merchant tidak ada.");
  return { tlv, merchantName: get("59") ?? "", merchantCity: get("60") ?? "" };
}

/** Ubah QRIS statis menjadi dinamis dengan nominal tetap (rupiah, bilangan bulat). */
export function toDynamicQris(staticPayload: string, amountIdr: number): string {
  if (!Number.isInteger(amountIdr) || amountIdr < 1 || amountIdr > MAX_AMOUNT_IDR) throw new Error("Nominal tidak valid.");
  const { tlv } = parseStaticQris(staticPayload);
  const next: Tlv[] = tlv
    .filter((t) => t.tag !== "63" && t.tag !== "54")
    .map((t) => (t.tag === "01" ? { tag: "01", value: "12" } : t));
  // Tag 54 harus berada sebelum tag bernomor lebih besar (umumnya 58), mengikuti urutan standar.
  let at = next.findIndex((t) => Number(t.tag) > 54);
  if (at < 0) at = next.length;
  next.splice(at, 0, { tag: "54", value: String(amountIdr) });
  return buildPayload(next);
}

/** Total yang ditagih = harga + kode unik. Kode unik harus 1..999. */
export function totalWithCode(baseIdr: number, code: number): number {
  if (!Number.isInteger(baseIdr) || baseIdr <= 0) throw new Error("Harga dasar tidak valid.");
  if (!Number.isInteger(code) || code < QRIS_CODE_MIN || code > QRIS_CODE_MAX) throw new Error("Kode unik tidak valid.");
  return baseIdr + code;
}
