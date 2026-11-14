-- Foto yang dipisah dari materi HTML saat upload (binding: DB).
-- Dibuat juga otomatis oleh worker; aman dijalankan berulang.
CREATE TABLE IF NOT EXISTS html_imgs (
  id      TEXT PRIMARY KEY,          -- dari hash isi gambar
  mime    TEXT NOT NULL,
  data    TEXT NOT NULL,             -- base64
  created INTEGER NOT NULL           -- diperbarui saat diunggah ulang; foto tak terpakai > 1 jam dihapus
);
