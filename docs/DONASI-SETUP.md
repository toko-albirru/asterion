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
- Nama donatur tampil sebagai **teks berjalan di beranda** (setelah login), bersama pesan dari Saweria. Mengetuk teks itu membuka formulir donasi.
- Donatur memilih: **Anonim**, **NIM**, **Nama** (dari daftar mahasiswa), atau **Nama pilihan sendiri** (diketik bebas, maks. 30 karakter). Pilihan NIM/Nama dihitung server dari akun yang login, bukan dari yang diketik di Saweria.
- **Tanpa kode** (mis. orang luar): nama yang tampil = nama yang diketik di Saweria.
- Nominal hanya tampil bila donatur mencentang.
- Nama dan pesan dibersihkan otomatis (tautan, email, nomor telepon, tanda < > dibuang), tetapi isinya tidak disaring kata kasar. Admin bisa **menyembunyikan** atau **mengubah nama** kapan saja di *Kelola donatur*.
- Jika tabel `don_items` sudah dibuat dari versi sebelumnya, jalankan ulang `supabase/0002_donasi.sql` (aman diulang) agar mode "nama pilihan sendiri" diizinkan.
- Tes: `node scripts/test-don.mjs`
