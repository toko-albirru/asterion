# FORMAT PDF BARU — ASTERION RUN

Format ini dipakai untuk impor soal di **Admin → 📥 Impor PDF**. Bedanya dengan format lama:
setiap pilihan jawaban (A–E) punya **pembahasan sendiri**, sehingga di Mode Soal, Simulasi Ujian,
dan halaman Pembahasan, penjelasan muncul tepat di bawah tiap pilihan.

---

## 1. Kerangka satu soal

```
<nomor>. <pertanyaan, boleh beberapa baris>
A. <pilihan A>
B. <pilihan B>
C. <pilihan C>
D. <pilihan D>
E. <pilihan E>              (opsional — boleh hanya A–D)
KUNCI: <A|B|C|D|E>
PEMBAHASAN:
<pembahasan umum soal — boleh beberapa baris>
A. <kenapa A benar/salah>
B. <kenapa B benar/salah>
C. <kenapa C benar/salah>
D. <kenapa D benar/salah>
E. <kenapa E benar/salah>
```

Aturan penting:

1. Nomor soal wajib di awal baris: `1.`, `2)`, `3 -`, dst. Nomor harus naik.
2. Pilihan wajib berurutan mulai `A.` (atau `A)`), lalu `B.`, `C.`, `D.`, `E.`.
   Satu baris boleh memuat beberapa pilihan: `A. 12  B. 24  C. 36`.
3. `KUNCI:` boleh juga ditulis `JAWABAN:` / `ANSWER:`, isinya satu huruf.
4. `PEMBAHASAN:` boleh juga `PENJELASAN:` / `EXPLANATION:`.
5. **Pembahasan per pilihan** dikenali dari baris yang diawali `A.` … `E.`
   **di dalam blok pembahasan** (setelah baris `PEMBAHASAN:`).
   Baris lanjutan tanpa huruf pilihan otomatis disambung ke pilihan terakhir.
6. Kalau blok pembahasan tidak punya baris per pilihan, semua teks dianggap
   pembahasan umum — format lama tetap didukung.

---

## 2. Contoh lengkap (2 soal)

```
1. Seorang laki-laki 45 tahun datang dengan nyeri dada tipikal sejak 2 jam.
   Pemeriksaan menunjukkan ST elevasi di sadapan V1–V4. Diagnosis paling tepat?
A. Angina pektoris stabil
B. Infark miokard akut anterior
C. Perikarditis akut
D. Diseksi aorta
E. Emboli paru

KUNCI: B
PEMBAHASAN:
Keluhan nyeri dada tipikal dengan ST elevasi pada V1–V4 mengarah ke infark
miokard akut dinding anterior yang butuh reperfusi segera.
A. Angina stabil tidak memberi elevasi ST menetap dan nyeri khas dipicu aktivitas.
B. Benar. ST elevasi V1–V4 = dinding anterior (LAD), tatalaksana reperfusi segera.
C. Perikarditis memberi elevasi difus dan nyeri yang memburuk saat inspirasi.
D. Diseksi aorta memberi nyeri robek menjalar ke punggung dengan selisih TD.
E. Emboli paru lebih sering dengan takikardia dan hipoksemia tanpa elevasi fokal.

2. Obat lini pertama untuk hipertensi pada pasien gagal jantung dengan EF menurun?
A. Hidralazin
B. Verapamil
C. Bisoprolol
D. Klonidin
E. Minoksidil

KUNCI: C
PEMBAHASAN:
Beta-blocker yang terbukti menurunkan mortalitas pada HFrEF adalah pilihan awal.
A. Hidralazin bukan lini pertama; dipakai kombinasi pada kasus tertentu.
B. Verapamil menurunkan kontraktilitas sehingga dihindari pada HFrEF.
C. Benar. Bisoprolol (beta-blocker) terbukti menurunkan mortalitas HFrEF.
D. Klonidin hanya menurunkan tekanan darah tanpa bukti manfaat mortalitas.
E. Minoksidil tidak dipakai rutin dan bisa memperberat retensi cairan.
```

---

## 3. Gambar

- Gambar yang menempel di dekat soal ikut diekstrak otomatis.
- Urutan: soal → gambar soal, lalu pilihan → gambar pilihan.
- Logo/watermark yang berulang di banyak halaman otomatis dibuang.

---

## 4. Kunci jawaban di akhir dokumen (opsional)

Kalau kunci dikumpulkan di halaman terakhir, boleh ditulis seperti ini:

```
KUNCI JAWABAN
1. B   2. C   3. A   4. E
```

atau tabel `1. B` per baris. Parser mencocokkan nomor soal secara otomatis.

---

## 5. Setelah impor

1. Pratinjau menampilkan setiap soal; periksa kunci, pembahasan umum, dan pembahasan per pilihan.
2. Bisa pindah gambar antar soal, edit teks, atau ubah kunci sebelum disimpan.
3. Simpan → soal aktif dan langsung dipakai di tiga mode:
   - 🎮 Game 3D
   - 📝 Mode Soal (pembahasan per pilihan muncul langsung setelah menjawab)
   - 🎓 Simulasi Ujian (pembahasan baru muncul setelah dikumpulkan)

---

## 6. Padanan data (untuk impor JSON/CSV)

| Di PDF | Field impor |
|---|---|
| nomor | `num` |
| pertanyaan | `q` |
| pilihan A–E | `a`, `b`, `c`, `d`, `e` |
| `KUNCI:` | `ans` |
| pembahasan umum | `expl` |
| pembahasan per pilihan | `ex` = `{ "A": "…", "B": "…", "C": "…" }` |
| kesulitan | `diff` (1–3) |
| aktif | `active` |

Contoh JSON satu soal:

```json
{
  "num": 1,
  "q": "Seorang laki-laki 45 tahun … diagnosis paling tepat?",
  "a": "Angina pektoris stabil",
  "b": "Infark miokard akut anterior",
  "c": "Perikarditis akut",
  "d": "Diseksi aorta",
  "e": "Emboli paru",
  "ans": "B",
  "expl": "Nyeri dada tipikal + ST elevasi V1–V4 → infark anterior.",
  "ex": {
    "A": "Angina stabil tidak memberi elevasi ST menetap.",
    "B": "Benar. ST elevasi V1–V4 = dinding anterior (LAD).",
    "C": "Perikarditis: elevasi difus, nyeri memburuk saat inspirasi.",
    "D": "Diseksi aorta: nyeri robek menjalar ke punggung.",
    "E": "Emboli paru: takikardia + hipoksemia tanpa elevasi fokal."
  },
  "diff": 2,
  "active": true
}
```

CSV/Excel: kolom `pertanyaan, A, B, C, D, E, kunci, pembahasan, pembahasan A, pembahasan B, pembahasan C, pembahasan D, pembahasan E`.
