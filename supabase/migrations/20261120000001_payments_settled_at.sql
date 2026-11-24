-- SEMAR-Dock Premium (fase 2): penanda "sudah diproses" pada pembayaran QRIS.
-- Perpanjangan memakai token yang sama, jadi payments.license_id (unik) tidak dipakai untuk pembayaran QRIS;
-- settled_at menjadi penjaga agar satu pembayaran hanya memperpanjang langganan sekali.
-- Aman dijalankan berulang.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS settled_at timestamptz;
