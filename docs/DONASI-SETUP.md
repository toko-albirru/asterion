# Donasi (Saweria) — panduan pasang

## 1. Saweria (kamu yang mengerjakan di akunmu)
1. Buat akun dan halaman di saweria.co → catat tautan halamanmu (mis. `https://saweria.co/namamu`).
2. Di dashboard Saweria cari pengaturan **webhook** dan **stream key** (nama menu bisa berbeda; biasanya di bagian integrasi/overlay).
3. Isi alamat webhook: `https://<domain-asterion-kamu>/api/don/saweria`

## 2. Supabase
Jalankan `supabase/0002_donasi.sql` di SQL Editor (project yang sama dengan AI boleh).

## 3. Secret / variabel di Cloudflare
| Nama | Isi |
|---|---|
| `SAWERIA_URL` | tautan halaman Saweria-mu |
| `SAWERIA_STREAM_KEY` | stream key Saweria (Secret) |

(`SUPABASE_URL` dan `SUPABASE_SERVICE_KEY` sudah dipasang untuk AI.) Lalu deploy.

## 4. Tes
- Beranda → kartu **Dukung ASTERION** → pilih tampilan → buat kode → donasi kecil dengan kode di pesan.
- Jika namamu tidak muncul otomatis, buka **Kelola donatur**: donasi itu ada di status *pending* (tanda tangan webhook belum cocok). Setujui manual dan kabari pembuat aplikasi agar rumus tanda tangan disesuaikan.

## Aturan tampilan
- Donatur memilih: Anonim / NIM / Nama / Nama acak. Nama dihitung server dari akun yang login, bukan dari yang diketik di Saweria.
- Nominal hanya tampil bila donatur mencentang. Pesan Saweria tidak pernah ditampilkan.
- Donasi tanpa kode (orang luar) tampil dengan nama acak dan tanpa nominal.
- Tes: `node scripts/test-don.mjs`
