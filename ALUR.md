# Panduan lengkap: dari nol sampai SEMAR-Dock berjualan

Ikuti urut dari Tahap 0. Tampilan menu di Supabase/Cloudflare/Midtrans bisa sedikit berbeda dari tulisan di sini karena
mereka sering memperbarui tampilan; cari menu dengan nama yang mirip.

Gambaran: **Website** (toko) + **Supabase** (buku catatan: akun, pembayaran, token) + **Aplikasi .exe** (barang yang dijual).
Pembeli: daftar → bayar QRIS → token terbit otomatis → unduh .exe → tempel token → aplikasi cek token ke website.

---
## Tahap 0 — Persiapan di komputer Windows (±20 menit)
1. Pasang **Node.js LTS** (nodejs.org). Cek di PowerShell: `node -v` (harus 20 atau lebih baru).
2. Pasang **Git** (git-scm.com). Cek: `git --version`.
3. (Disarankan) pasang **VS Code** untuk membuka/mengedit file.
4. Ekstrak `semardock-website-bersih.zip` ke mis. `C:\semardock-website`. Buka PowerShell di folder `semardock-website` di dalamnya.

## Tahap 1 — Buat akun (±15 menit)
1. **GitHub** (github.com) → New repository → nama `semardock-website` → pilih **Private** (WAJIB, supaya kode aplikasi tidak terbaca orang) → jangan centang "Add a README".
2. **Supabase** (supabase.com) → daftar/masuk (bisa dengan akun GitHub).
3. **Cloudflare** (dash.cloudflare.com) → daftar, verifikasi email.
4. Midtrans nanti di Tahap 8.

## Tahap 2 — Siapkan Supabase (±15 menit)
1. **New project**: isi nama (mis. `semardock`), buat *Database password* (simpan baik-baik), region **Southeast Asia (Singapore)** → Create. Tunggu beberapa menit.
2. **SQL Editor → New query**. Buka `supabase/schema.sql` di VS Code, salin SEMUA isinya, tempel, klik **Run**. Harus muncul "Success".
   Cek di **Table Editor**: ada tabel `licenses` dan `payments`.
3. **Authentication → Providers**: pastikan **Email** aktif.
   - Opsi "Confirm email": saat uji awal boleh dimatikan. Saat berjualan sebaiknya menyala.
   - Peringatan: pengirim email bawaan Supabase dibatasi jumlahnya (hanya beberapa email per jam). Untuk berjualan, pasang SMTP sendiri
     di **Authentication → SMTP Settings** (layanan seperti Resend atau Brevo punya paket gratis).
4. **Project Settings → API Keys**: catat 3 hal: **Project URL**, **Publishable key**, **Secret key** (service role).
   Secret key = kunci master database. Jangan dibagikan, jangan di-commit ke GitHub.

> Untuk fitur kupon institusi & beli per hari, jalankan juga `supabase/migrations/20261118000000_payments_snap.sql` dan
> `supabase/migrations/20261119000000_institution_coupons.sql` di SQL Editor (database baru maupun lama).

## Tahap 3 — Tes di komputer sendiri (±20 menit)
1. Di PowerShell (folder `semardock-website`): `Copy-Item .env.example .env -Force`
   (file `.env` lama dari zip berisi alamat backend Lovable yang lama; harus ditimpa).
2. Buka `.env`, isi:
   - `VITE_SUPABASE_URL` dan `SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` dan `SUPABASE_PUBLISHABLE_KEY` = Publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` = Secret key
   - biarkan `PAYMENT_MODE=promo`
3. `npm install` lalu `npm run dev`. Buka alamat yang tertulis di terminal (biasanya http://localhost:5173).
4. Uji: **Masuk → Daftar** (email + sandi) → masuk → halaman **Akun** → **Ambil token Pro** → muncul token `SMD-XXXX-...`.
   Di Supabase Table Editor, tabel `licenses` harus berisi 1 baris.
5. Kalau error "Missing Supabase environment variable" → isi `.env` belum benar. "Invalid API key" → salah salin kunci.

## Tahap 4 — Taruh kode di GitHub (±10 menit)
```
git init
git add .
git commit -m "SEMAR-Dock website"
git branch -M main
git remote add origin https://github.com/USERNAME/semardock-website.git
git push -u origin main
```
(Ganti USERNAME. Git akan membuka browser untuk login GitHub. Bila diminta `user.name`/`user.email`, ikuti petunjuk di layar.)
Cek di GitHub: file `.env` TIDAK boleh ada di sana (sudah diabaikan lewat `.gitignore`).

## Tahap 5 — Website hidup di internet lewat Cloudflare (±30 menit)
1. Cloudflare → **Workers & Pages → Create → Import a repository** (hubungkan GitHub, izinkan akses ke repo privatmu) → pilih `semardock-website`.
2. Isi: Build command `npm run build`; Deploy command `npx wrangler deploy`.
3. Isi variabel. Ada DUA kelompok:
   - **Build variables** (dipakai saat build): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PAYMENT_ENABLED=false`,
     `SITE_URL` (dikosongkan dulu), `VITE_DOWNLOAD_URL` (nanti Tahap 10). Bila build gagal karena versi Node, tambah `NODE_VERSION=22`.
   - **Variables and secrets** (dipakai saat jalan): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY` (jenis *Secret*), `PAYMENT_MODE=promo`.
4. **Save and Deploy**. Setelah selesai kamu dapat alamat seperti `https://semardock-website.AKUNMU.workers.dev`.
5. Isi `SITE_URL` (Build variable) dengan alamat itu, tanpa garis miring di akhir → **redeploy** (Deployments → Retry).
   `SITE_URL` ditanam ke .exe saat build, jadi isi dengan alamat FINAL. Kalau mau pakai domain sendiri: Settings → Domains & Routes →
   Add custom domain (domain harus memakai DNS Cloudflare), lalu pakai domain itu sebagai `SITE_URL`.
6. Catatan jujur: deploy ke Cloudflare belum bisa saya uji dari sini. Kalau build gagal, kirim teks log-nya ke saya.

## Tahap 6 — Beri tahu Supabase alamat websitemu (±5 menit)
Supabase → **Authentication → URL Configuration**: **Site URL** = alamat websitemu; **Redirect URLs** → tambah `https://alamatmu/**`.
Tanpa ini, link konfirmasi email dan reset kata sandi mengarah ke alamat yang salah.

## Tahap 7 — Tes website yang sudah live (±10 menit)
Buka alamatnya → Daftar → (konfirmasi email bila menyala) → Masuk → Akun → Ambil token Pro. Coba juga "Lupa kata sandi".
Tombol Unduh masih "Segera hadir" — itu normal sampai Tahap 10.

## Tahap 8 — Pembayaran QRIS
Mode di server (`PAYMENT_MODE`): `promo` = token gratis · `mock` = QR palsu untuk tes · `midtrans` = QRIS sungguhan.

**8a. Tes alur dengan mock (tanpa akun apa pun)**
1. Build variable `VITE_PAYMENT_ENABLED=true`; runtime `PAYMENT_MODE=mock` → redeploy.
2. Akun → **Bayar dengan QRIS** → muncul QR + hitung mundur → klik **Simulasikan bayar** → token muncul otomatis.
3. **JANGAN biarkan mock menyala saat berjualan**: siapa pun bisa menekan "Simulasikan bayar" dan mendapat token gratis.

**8b. Daftar Midtrans (perorangan) — mulai sekarang karena verifikasinya makan waktu**
1. midtrans.com → daftar → pilih jenis bisnis **Perorangan**. Siapkan KTP, rekening bank atas namamu, dan NPWP bila diminta.
2. Kamu langsung mendapat akun **Sandbox** (uji coba). Ambil **Server Key** sandbox di Settings → Access Keys.
3. Settings → Configuration → **Payment Notification URL** = `https://alamatmu/api/public/payment/midtrans`.
4. Isi runtime: `PAYMENT_MODE=midtrans`, `MIDTRANS_SERVER_KEY=<server key sandbox>` (Secret), `MIDTRANS_IS_PRODUCTION=false`.
   Build: `VITE_PAYMENT_ENABLED=true`. Redeploy.
5. Coba beli. QR sandbox dibayar lewat simulator QRIS milik Midtrans (ada di dokumentasi/dashboard sandbox); setelah "dibayar", token harus muncul.

**8c. Produksi**
1. Setelah akunmu disetujui dan QRIS diaktifkan untuk produksi (waktunya ditentukan Midtrans), ambil Server Key **produksi**.
2. Ganti `MIDTRANS_SERVER_KEY` ke key produksi, `MIDTRANS_IS_PRODUCTION=true`, dan Notification URL di dashboard **produksi** juga diisi. Redeploy.
3. Tes terakhir: bayar sungguhan Rp 50.000 dari e-walletmu sendiri.
Biaya per transaksi: lihat halaman harga Midtrans. Kalau Midtrans menolak perorangan, kabari saya (bisa diganti Duitku/Tripay/Xendit di `src/lib/payment.server.ts`).

## Tahap 9 — Membuat .exe (di komputer Windows) (±1 jam)
1. Pasang **Python 3.9+** (python.org, centang **Add python.exe to PATH**).
2. Siapkan isi folder `desktop-app\SEMAR-Dock\bin\`:
   - `vina.exe`: unduh rilis Windows AutoDock Vina (github.com/ccsb-scripps/AutoDock-Vina/releases), ganti namanya jadi `vina.exe`.
   - `openbabel\`: pasang Open Babel Windows (github.com/openbabel/openbabel/releases, file installer), lalu SALIN SELURUH isi folder
     instalasinya (obabel.exe, semua .dll, folder `data`) ke `bin\openbabel\`.
   - Salin berkas lisensi keduanya ke `bin\` (Vina: Apache 2.0, Open Babel: GPL-2.0). Open Babel mewajibkan tautan ke source-nya dicantumkan.
3. Di Command Prompt:
   ```
   cd desktop-app\SEMAR-Dock
   set SITE_URL=https://alamat-final-websitemu
   build_exe.bat
   ```
4. Hasil: `dist\SEMAR-Dock-windows.zip`.
5. **Tes di komputer Windows lain yang tidak punya Python/Vina**: ekstrak, buka `SEMAR-Dock.exe`, jalankan docking 1 protein kecil, lalu coba Aktifkan Pro.
   Windows akan menampilkan peringatan SmartScreen (karena .exe belum ditandatangani); klik "More info → Run anyway".

## Tahap 10 — Pasang .exe di tombol Unduh (±20 menit)
Berkas .exe-mu pasti lebih dari 25 MB, sedangkan hosting website membatasi 25 MB per file. Jadi simpan di tempat lain, lalu tombol Unduh menunjuk ke sana:

**Opsi A (gratis, tanpa kartu): GitHub Releases di repo publik terpisah**
1. Buat repo BARU, publik, mis. `semardock-releases`. Isinya hanya halaman rilis; JANGAN taruh kode aplikasi di situ.
2. Releases → Draft a new release → tag `v2.0` → unggah `SEMAR-Dock-windows.zip` → Publish.
3. Klik kanan berkas di daftar Assets → salin alamat tautan. Bentuknya
   `https://github.com/USERNAME/semardock-releases/releases/download/v2.0/SEMAR-Dock-windows.zip`.
   Pengunjung yang menekan Unduh di websitemu langsung mengunduh file, tidak melihat halaman GitHub.

**Opsi B: Cloudflare R2** (ada kuota gratis, tapi biasanya meminta kartu pembayaran): buat bucket, aktifkan akses publik, unggah zip, salin alamat publiknya.

Lalu: Cloudflare → Build variables → `VITE_DOWNLOAD_URL` = alamat file → redeploy. Tombol Unduh berubah dari "Segera hadir" menjadi aktif. Tes klik.

## Tahap 11 — Tes akhir seperti pembeli
1. Di HP/komputer lain: buka website → daftar → bayar sungguhan → token muncul otomatis.
2. Klik Unduh → ekstrak → buka .exe → **Aktifkan Pro** → tempel token → berhasil.
3. Coba token yang sama di komputer kedua → harus ditolak ("sudah dipakai di perangkat lain").
4. Token berlaku sesuai hari yang dibeli; perpanjangan bisa dibayar kapan saja (sisa hari tetap ikut terhitung).

## Tahap 12 — Rilis versi baru & perawatan
- Versi baru: ubah kode di `desktop-app/SEMAR-Dock/`, naikkan `APP_VERSION` di `semardock.py`, jalankan `build_exe.bat` lagi, unggah rilis baru
  (Tahap 10), perbarui `VITE_DOWNLOAD_URL`.
- Cek pembayaran masuk di Supabase → Table Editor → `payments` (status `paid`) dan `licenses`.
- Harga/masa aktif ada di `src/lib/license.ts`.

## Daftar cek keamanan sebelum berjualan
- [ ] Repo kode di GitHub **Private**
- [ ] `PAYMENT_MODE` bukan `mock`
- [ ] `MIDTRANS_SERVER_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` hanya di pengaturan hosting (Secret), tidak di GitHub
- [ ] SMTP email sendiri sudah terpasang di Supabase
- [ ] Notification URL Midtrans produksi terisi
- [ ] Tes bayar sungguhan Rp 50.000 berhasil

## Keputusan yang sudah diambil
- Teks "Open-source", "Lisensi MIT", dan tombol GitHub sudah dihapus dari website. Footer kini berbunyi "Hak cipta dilindungi" dan mencantumkan kredit AutoDock Vina (Apache 2.0) serta Open Babel (GPL-2.0) beserta tautan source-nya.
- Tombol login Google dihapus; login hanya dengan email + kata sandi.
- Gambar hero lama dihapus. Ganti dengan screenshot aplikasi: taruh di `src/assets/screenshots/` (`01-...png`, `02-...png`).
- Catatan: .exe tetap bisa dibongkar orang yang ahli; pemeriksaan token berada di aplikasi.

- Nama "AutoVinaEasy" sudah diganti "SEMAR-Dock" di judul halaman, deskripsi, footer, dan mockup Cara pakai.
- Kartu pembanding di bagian Tentang kini berjudul "Otomatis, tapi tidak transparan" (bukan "tertutup"), supaya tidak dibaca sebagai soal kode sumber.

## Masih perlu dicek
- Repo GitHub lama AutoVinaEasy (publik, berlisensi MIT): putuskan dibiarkan publik atau dijadikan private. Versi yang sudah terlanjur diunduh orang tetap MIT.

---
## Premium (fase 1): migrasi baru
Jalankan `supabase/migrations/20261120000000_premium_subscriptions.sql` di SQL Editor (setelah migrasi 20261119). Isinya: kolom QRIS di `payments`,
kode unik urut (sequence 1..999 lalu kembali ke 1), penjaga satu jenis langganan aktif per akun, tabel `student_verifications`, `email_otps`,
`student_domain_rules`, `notifications`, fungsi klaim kupon atomik, dan bucket privat `student-docs`.
Penting: aktifkan **Confirm email** di Supabase Auth (admin dikenali dari email di `ADMIN_EMAILS`; tanpa konfirmasi email, orang bisa mendaftar memakai email admin).

---
## Premium (fase 2): pembayaran QRIS statis
Isi di hosting: `PAYMENT_MODE=qris`, `QRIS_STATIC=<string QRIS statis>`, `ADMIN_EMAILS=<email admin>`. Jalankan juga `20261120000001_payments_settled_at.sql`.
Alur: pembeli membuat tagihan (harga + kode unik urut 1..999) -> membayar lewat QR dinamis -> menekan "Saya sudah bayar" -> admin mencocokkan nominal
dengan mutasi GoPay Merchant lalu konfirmasi -> token terbit/diperpanjang (token yang sama). Tagihan yang tidak ditandai dibayar kedaluwarsa 24 jam.
Kode: `src/lib/premium.server.ts` (logika), `premium.functions.ts` (endpoint), `orders.ts` + `plans.ts` + `qris.ts` (murni).
Alur Midtrans lama tetap ada tetapi tidak aktif pada mode qris.

---
## Premium (fase 3): verifikasi mahasiswa, institusi, halaman pembeli
Halaman: `/langganan` (paket, klaim kupon, riwayat), `/bayar/$orderId` (QR + "Saya sudah bayar"), `/verifikasi-mahasiswa`, `/institusi` (beli + dashboard pembeli).
Tambahan env: `NIM_HASH_SECRET` (acak, jangan diubah lagi), `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` (OTP email kampus; gratis 100 email/hari di resend.com).
Tanpa Resend, verifikasi tetap bisa lewat KRS/surat keterangan, tetapi selalu diperiksa admin.
OpenCV.js dilayani dari server sendiri: jalankan sekali `node scripts/fetch-opencv.mjs` lalu commit `public/vendor/opencv-4.10.0.js`.
Tanpa berkas itu, kualitas gambar dihitung dengan canvas (hasilnya setara). Jalankan juga migrasi 20261120000000 dan 20261120000001.
Catatan: jalur lama (Midtrans/promo) kini menulis `plan='individual'` (bukan `'pro'`) agar lolos batas `licenses_plan_check`.
