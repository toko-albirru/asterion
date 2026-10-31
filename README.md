# ASTERION Linktree - Cloudflare Workers + KV (gratis)

## Struktur (harus persis seperti ini)
```
asterion-linktree/
  wrangler.jsonc
  README.md
  public/
    index.html
    logo.webp
  src/
    worker.js
```

## ALUR LENGKAP

### A. Buat database KV
1. Login https://dash.cloudflare.com
2. Menu kiri: Storage & Databases -> KV -> Create instance/namespace.
3. Nama bebas (mis. asterion-links) -> Create.
4. Salin ID namespace (deretan huruf+angka panjang, 32 karakter).

### B. Isi ID di wrangler.jsonc
Buka wrangler.jsonc, ganti GANTI_DENGAN_ID_KV_KAMU dengan ID tadi (tetap di dalam tanda kutip).
Jangan ubah nama "LINKS".

### C. Upload ke GitHub
1. Buat repo baru di github.com (mis. asterion-linktree). Repo BARU lebih aman daripada memakai repo lama.
2. Klik "uploading an existing file".
3. Di laptop (Chrome/Edge/Firefox): ekstrak zip, lalu SERET isi foldernya
   (wrangler.jsonc, README.md, folder public, folder src) ke kotak upload. Folder ikut terupload.
4. Commit changes.
5. Cek di halaman repo: ada public/index.html, public/logo.webp, src/worker.js, wrangler.jsonc.

Kalau tidak bisa upload folder (mis. lewat HP):
- Upload wrangler.jsonc dan README.md lewat Upload files.
- Add file -> Create new file, ketik nama src/worker.js, tempel isi worker.js, Commit.
- Add file -> Create new file, ketik nama public/index.html, tempel isi index.html, Commit.
- Buka folder public di GitHub -> Add file -> Upload files -> upload logo.webp.

### D. Hubungkan ke Cloudflare
1. Dashboard -> Workers & Pages -> Create application -> pilih import repository (Git).
2. Hubungkan GitHub, beri akses ke repo tadi (Only select repositories).
3. Pilih repo -> Next.
4. Project name: asterion (HARUS sama dengan "name" di wrangler.jsonc; kalau beda, ubah salah satunya).
5. Build command: kosong. Deploy command: npx wrangler deploy (bawaan). Root directory: /.
6. Deploy.

### E. Pasang password admin
1. Buka proyek -> Settings -> Variables and Secrets -> Add.
2. Type: Secret. Name: ADMIN_PASSWORD. Value: password admin kamu.
3. Deploy/Save. Jika perlu: tab Deployments / Builds -> retry.

### F. Tes
1. Buka alamat asterion.<akunmu>.workers.dev
2. Klik Admin -> login -> tambah 1 link -> refresh halaman.
3. Link masih ada = database bekerja.

## Masalah umum
- "functions directory ... Pages Functions": ada folder functions sisa. Hapus.
- Error KV / id tidak valid: ID di wrangler.jsonc belum diganti atau salah salin.
- Login selalu "Password salah": ADMIN_PASSWORD belum dibuat, atau belum redeploy.
- Gambar logo tidak muncul: logo.webp tidak berada di folder public.
- Nama proyek tidak cocok: samakan "name" di wrangler.jsonc dengan nama proyek di Cloudflare.
