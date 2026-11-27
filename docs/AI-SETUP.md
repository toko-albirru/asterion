# ASTERION AI (APInex + Supabase) — panduan pasang

## 1. Supabase
1. Buat project baru di supabase.com (khusus AI).
2. SQL Editor → New query → tempel isi `supabase/0001_ai.sql` → Run (aman diulang).
3. Settings → API: catat **Project URL** dan **service_role / secret key** (JANGAN dibagikan; hanya untuk Worker).

## 2. Secret di Cloudflare
Workers → asterion → Settings → Variables and Secrets → tambah **Secret**:

| Nama | Isi |
|---|---|
| `APINEX_API_KEY` | kunci APInex |
| `SUPABASE_URL` | Project URL Supabase |
| `SUPABASE_SERVICE_KEY` | service_role / secret key |
| `DRIVE_API_KEY` | (opsional) hanya untuk mengindeks isi folder Drive |
| `APINEX_BASE_URL` | (opsional) default `https://api.apinex.bond/v1` |

Lalu deploy (push ke GitHub seperti biasa).

## 3. Pakai
- Login → tombol ✨ di pojok kanan bawah → panel **Tanya AI**.
- Admin: ikon ⚙ di panel → **Model & Prompt** (tes model, routing, kuota, prompt), **Penggunaan**, **Materi (RAG)**, **Pengguna**.
- Pertama kali: tab **Materi (RAG)** → *Indeks semua materi*. Biarkan tab terbuka sampai selesai. Ulangi setelah ada materi baru (yang tidak berubah dilewati).

## Cara kerja singkat
- Satu modul `src/ai.js`; route `/api/ai/*`. Kunci API tidak pernah ke browser.
- Routing: pertanyaan ringan → tier *fast*, kompleks → *smart*; tiap tier punya urutan cadangan. Model yang gagal 3x beruntun dilewati 5 menit. Jika semua model APInex gagal: pesan "limit penuh" + kutipan materi (Workers AI mati secara default; bisa dinyalakan di dasbor).
- RAG: pencarian kata kunci full-text Postgres (tanpa embedding eksternal), jawaban menyertakan sitasi [n] ke materi/slide.
- Hemat token: riwayat dipangkas, konteks dibatasi, cache jawaban pertanyaan pembuka yang sama, `<think>` dibuang.
- Tes: `node scripts/test-ai.mjs`
