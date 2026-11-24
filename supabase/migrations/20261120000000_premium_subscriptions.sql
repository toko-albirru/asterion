-- SEMAR-Dock Premium: QRIS statis, verifikasi mahasiswa, lisensi institusi.
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor SETELAH migrasi 20261119000000.

-- ============================================================
-- 1) Pembayaran QRIS statis (dikonfirmasi admin)
-- ============================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS months integer,
  ADD COLUMN IF NOT EXISTS base_amount_idr integer,
  ADD COLUMN IF NOT EXISTS unique_code integer,
  ADD COLUMN IF NOT EXISTS label text,                 -- mis. nama institusi, tampil di antrean admin
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,     -- pembeli menekan "Saya sudah bayar"
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reject_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_plan_check' AND conrelid = 'public.payments'::regclass) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_plan_check
      CHECK (plan IS NULL OR plan IN ('individual', 'student', 'institution')) NOT VALID;
  END IF;
END $$;

-- Dua tagihan QRIS yang masih pending tidak boleh punya total yang sama (itulah cara admin membedakannya).
CREATE UNIQUE INDEX IF NOT EXISTS payments_qris_pending_amount
ON public.payments (amount_idr) WHERE status = 'pending' AND provider = 'qris';

CREATE INDEX IF NOT EXISTS payments_qris_queue_idx
ON public.payments (claimed_at) WHERE status = 'pending' AND provider = 'qris' AND claimed_at IS NOT NULL;

-- Kode unik urut 1..999, setelah 999 kembali ke 1.
CREATE SEQUENCE IF NOT EXISTS public.qris_code_seq MINVALUE 1 MAXVALUE 999 START 1 CYCLE;

-- Tutup tagihan QRIS yang tidak pernah ditandai "sudah bayar" dan sudah lewat batas waktunya (kode uniknya bebas lagi).
CREATE OR REPLACE FUNCTION public.expire_stale_qris() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE public.payments SET status = 'expired'
    WHERE provider = 'qris' AND status = 'pending' AND claimed_at IS NULL
      AND expires_at IS NOT NULL AND expires_at < now()
    RETURNING 1
  ) SELECT count(*)::integer FROM u;
$$;

-- Ambil kode unik berikutnya yang belum dipakai tagihan pending lain untuk harga dasar ini.
CREATE OR REPLACE FUNCTION public.next_qris_code(p_base integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v integer;
BEGIN
  IF p_base IS NULL OR p_base <= 0 THEN RAISE EXCEPTION 'invalid_base' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.expire_stale_qris();
  FOR i IN 1..999 LOOP
    v := nextval('public.qris_code_seq');
    IF NOT EXISTS (SELECT 1 FROM public.payments WHERE provider = 'qris' AND status = 'pending' AND amount_idr = p_base + v) THEN
      RETURN v;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'qris_codes_exhausted' USING ERRCODE = 'P0001';
END $$;

-- ============================================================
-- 2) Lisensi (token): satu jenis langganan aktif per akun
-- ============================================================
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'payment',   -- payment | institution | admin
  ADD COLUMN IF NOT EXISTS coupon_id uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;                 -- berhenti diperpanjang; akses tetap sampai expires_at

UPDATE public.licenses SET plan = 'individual' WHERE plan NOT IN ('individual', 'student', 'institution');
ALTER TABLE public.licenses ALTER COLUMN plan SET DEFAULT 'individual';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'licenses_plan_check' AND conrelid = 'public.licenses'::regclass) THEN
    ALTER TABLE public.licenses ADD CONSTRAINT licenses_plan_check CHECK (plan IN ('individual', 'student', 'institution'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.licenses_one_plan_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.licenses l
    WHERE l.user_id = NEW.user_id AND l.expires_at > now() AND l.plan <> NEW.plan
  ) THEN
    RAISE EXCEPTION 'plan_conflict' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS licenses_one_plan_guard ON public.licenses;
CREATE TRIGGER licenses_one_plan_guard BEFORE INSERT ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.licenses_one_plan_guard();

-- ============================================================
-- 3) Verifikasi mahasiswa (satu baris per pengguna; pengajuan ulang menimpa)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_verifications (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  full_name text,
  nim text,                    -- dihapus saat dokumen dibersihkan; yang tersisa hanya nim_hash + nim_last4
  nim_hash text,               -- HMAC(NIM + domain kampus); cek duplikasi tanpa menyimpan NIM
  nim_last4 text,
  university text,
  faculty text,
  study_program text,
  entry_year integer,
  campus_email text,
  email_verified_at timestamptz,
  ktm_path text,
  support_kind text CHECK (support_kind IN ('otp', 'krs', 'surat')),
  support_path text,
  ocr_text text,
  ocr_fields jsonb,
  quality jsonb,
  score integer,
  flags text[] NOT NULL DEFAULT '{}',
  decision_source text CHECK (decision_source IN ('auto', 'admin')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  expires_at timestamptz,
  docs_purge_after timestamptz,   -- setelah ini dokumen & data mentah dihapus
  docs_purged_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Satu identitas (NIM di satu kampus) hanya boleh dipakai satu akun yang berstatus verified.
CREATE UNIQUE INDEX IF NOT EXISTS student_verifications_nim_verified
ON public.student_verifications (nim_hash) WHERE status = 'verified' AND nim_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS student_verifications_queue_idx ON public.student_verifications (status, submitted_at);
CREATE INDEX IF NOT EXISTS student_verifications_purge_idx ON public.student_verifications (docs_purge_after) WHERE docs_purged_at IS NULL;

GRANT SELECT ON public.student_verifications TO authenticated;
GRANT ALL ON public.student_verifications TO service_role;
ALTER TABLE public.student_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own verification" ON public.student_verifications;
CREATE POLICY "Users can view their own verification" ON public.student_verifications
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.expire_student_verifications() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE public.student_verifications SET status = 'expired', updated_at = now()
    WHERE status = 'verified' AND expires_at IS NOT NULL AND expires_at <= now()
    RETURNING 1
  ) SELECT count(*)::integer FROM u;
$$;

-- OTP email kampus: satu baris per pengguna (hemat), hanya server yang boleh menyentuhnya.
CREATE TABLE IF NOT EXISTS public.email_otps (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  send_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);
GRANT ALL ON public.email_otps TO service_role;
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- Pengecualian domain kampus yang dikelola admin: allow = diterima walau bukan .ac.id; block = ditolak (mis. domain staf).
CREATE TABLE IF NOT EXISTS public.student_domain_rules (
  domain text PRIMARY KEY CHECK (domain = lower(domain)),
  kind text NOT NULL CHECK (kind IN ('allow', 'block')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.student_domain_rules TO service_role;
ALTER TABLE public.student_domain_rules ENABLE ROW LEVEL SECURITY;

-- Notifikasi dalam web (gratis, tanpa batas email). Dibersihkan otomatis setelah 60 hari oleh server.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can mark their notifications read" ON public.notifications;
CREATE POLICY "Users can mark their notifications read" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4) Lisensi institusi: beberapa domain email, kuota, klaim atomik
-- ============================================================
ALTER TABLE public.institution_coupons
  ADD COLUMN IF NOT EXISTS email_domains text[] NOT NULL DEFAULT '{}';
UPDATE public.institution_coupons
SET email_domains = ARRAY[lower(email_domain)]
WHERE email_domain IS NOT NULL AND email_domains = '{}';

-- Status baru "revoked" (dicabut admin) dan batas kuota 1000.
ALTER TABLE public.institution_coupons DROP CONSTRAINT IF EXISTS institution_coupons_status_check;
ALTER TABLE public.institution_coupons ADD CONSTRAINT institution_coupons_status_check
  CHECK (status IN ('pending', 'active', 'revoked'));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'institution_coupons_seats_max' AND conrelid = 'public.institution_coupons'::regclass) THEN
    ALTER TABLE public.institution_coupons ADD CONSTRAINT institution_coupons_seats_max CHECK (seats <= 1000) NOT VALID;
  END IF;
END $$;

-- Klaim kupon: semua pemeriksaan + penerbitan lisensi dalam SATU transaksi, dengan kunci baris pada kupon,
-- sehingga dua pengguna yang mengklaim bersamaan tidak bisa melewati kuota. Lisensi berakhir pada valid_until kupon.
CREATE OR REPLACE FUNCTION public.claim_institution_coupon(p_user uuid, p_email text, p_code text, p_token text)
RETURNS TABLE (out_license_id uuid, out_expires_at timestamptz, out_institution text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.institution_coupons%ROWTYPE;
  used integer;
  dom text;
  lid uuid;
  t timestamptz := now();
BEGIN
  SELECT * INTO c FROM public.institution_coupons WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND OR c.status <> 'active' THEN RAISE EXCEPTION 'coupon_invalid' USING ERRCODE = 'P0001'; END IF;
  IF c.valid_until <= t THEN RAISE EXCEPTION 'coupon_expired' USING ERRCODE = 'P0001'; END IF;

  dom := lower(split_part(p_email, '@', 2));
  IF cardinality(c.email_domains) > 0 AND NOT (dom = ANY (c.email_domains)) THEN
    RAISE EXCEPTION 'domain_not_allowed' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.licenses l WHERE l.user_id = p_user AND l.plan = 'institution' AND l.expires_at > t) THEN
    RAISE EXCEPTION 'already_institution' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO used FROM public.coupon_redemptions r WHERE r.coupon_id = c.id AND r.status = 'redeemed';
  IF used >= c.seats THEN RAISE EXCEPTION 'quota_full' USING ERRCODE = 'P0001'; END IF;

  -- Bila pengguna masih punya langganan berbayar jenis lain, trigger licenses_one_plan_guard menolak (plan_conflict).
  INSERT INTO public.licenses (user_id, token, plan, price_idr, payment_status, starts_at, expires_at, source, coupon_id)
  VALUES (p_user, p_token, 'institution', 0, 'institution', t, c.valid_until, 'institution', c.id)
  RETURNING id INTO lid;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id, email, order_id, status, expires_at, license_id, redeemed_at)
  VALUES (c.id, p_user, lower(p_email), 'CLAIM-' || gen_random_uuid(), 'redeemed', c.valid_until, lid, t);

  IF used + 1 >= c.seats THEN
    UPDATE public.institution_coupons SET exhausted_at = t WHERE id = c.id AND exhausted_at IS NULL;
  END IF;

  RETURN QUERY SELECT lid, c.valid_until, c.institution_name;
END $$;

-- ============================================================
-- 5) Hak akses fungsi: hanya server (service role)
-- ============================================================
REVOKE ALL ON FUNCTION public.expire_stale_qris() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_qris_code(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_student_verifications() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_institution_coupon(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_qris() TO service_role;
GRANT EXECUTE ON FUNCTION public.next_qris_code(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_student_verifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_institution_coupon(uuid, text, text, text) TO service_role;
REVOKE ALL ON SEQUENCE public.qris_code_seq FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 6) Penyimpanan dokumen KTM/KRS: bucket PRIVAT, tanpa policy untuk pengguna.
--    Hanya server (service role) yang mengunggah/membaca; admin membuka lewat tautan sementara.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('student-docs', 'student-docs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
