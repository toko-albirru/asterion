/* Regresi jadwal: kategori (Remedi/UB/UC), warna, jarak garis, urutan tanggal, tata letak teks. */
const fs = require("fs"), path = require("path"), vm = require("vm"), { execFileSync } = require("child_process");
let fail = 0;
const ok = (c, m) => { if (c) console.log("OK:", m); else { console.error("FAIL:", m); fail = 1; } };
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const run = fs.readFileSync(path.join(root, "public/run.js"), "utf8");

/* 1. sintaks */
execFileSync(process.execPath, ["--check", path.join(root, "public/run.js")]);
console.log("OK: sintaks public/run.js");
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
inline.forEach((s, i) => new vm.Script(s, { filename: `index-inline-${i}.js` }));
console.log(`OK: sintaks ${inline.length} skrip inline index.html`);

/* 2. fungsi kategori asli dieksekusi */
const a = html.indexOf("function jcls(k){");
const b = html.indexOf("function jlabel(c){");
const e = html.indexOf("\n", b);
const src = html.slice(a, e);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + "\nthis.jcls=jcls;this.jhex=jhex;this.jlabel=jlabel;", ctx);
const { jcls, jhex, jlabel } = ctx;

[["Remedi", "j-prat"], ["Remidi", "j-prat"], ["Remedi Ujian Blok", "j-prat"], ["Praktikum", "j-prat"],
 ["Pre-test", "j-prat"], ["Asistensi", "j-prat"], ["Responsi", "j-prat"],
 ["UB", "j-ub"], ["UC", "j-uc"], ["Ujian Blok", "j-blok"], ["Skill Lab", "j-skill"],
 ["Tutor", "j-tutor"], ["Kuliah", "j-kuliah"]
].forEach(([k, want]) => ok(jcls(k) === want, `jcls("${k}") -> ${want} (dapat ${jcls(k)})`));

ok(jhex("j-ub") === "#94A3B8", "warna UB abu sama seperti Ujian Blok");
ok(jhex("j-uc") === "#EAB308", "warna UC kuning");
ok(jlabel("j-ub") === "UB" && jlabel("j-uc") === "UC", "label UB dan UC");

/* 3. CSS warna, jarak garis, urutan, tata letak teks */
ok(/\.j-ub\{--jc:#94a3b8\}/.test(html) && /\.j-uc\{--jc:#eab308\}/.test(html), "CSS kelas UB/UC tersedia");
ok(/\.sl\[class\*="j-"\]\{[^}]*margin:0 0 10px/.test(html), "garis warna daftar jadwal diberi jarak");
ok(/\.cali\[class\*="j-"\]\{[^}]*margin:0 0 7px/.test(html), "garis warna kalender diberi jarak");
ok(/String\(a\.iso\|\|""\)\.localeCompare\(String\(b\.iso\|\|""\)\)/.test(html), "daftar jadwal urut tanggal paling awal dulu");
ok(/String\(a\.iso\)\.localeCompare\(String\(b\.iso\)\)/.test(html), "daftar bulan ini urut tanggal paling awal dulu");
ok(/class='rn-hist'/.test(run) && /\.rn-hist \.card \.t small\{[^}]*line-height:1\.4/.test(run), "riwayat ditata rapi");
ok(/\.rn-lb \.n small\{[^}]*text-overflow:ellipsis/.test(run), "teks leaderboard dipangkas rapi");
ok(/#tl \.sl \.bd b\{[^}]*overflow-wrap:anywhere/.test(run), "teks tutorial ditata rapi");

/* 4. mode terang: pita ungu sudah dihapus, logo & judul tetap terbaca */
ok(!/#bb9bef/.test(html), "gradasi ungu full-page dihapus");
const has = (s, t) => s.indexOf(t) > -1;
ok(has(html, ".hband::before{display:none}"), "pita ungu di belakang logo tidak lagi digambar");
ok(has(html, ".gate .hband{margin:0 -18px;padding:calc(10px + env(safe-area-inset-top,0px)) 18px 0;--hb-t:-18px}"), "logo login memberi ruang untuk notch/safe-area");
ok(has(html, '<div class="hband">') && /class='hband'><div class='hero'>[\s\S]{0,140}ASTERION/.test(html), "logo login & home dibungkus .hband");
ok(has(html, "document.body.dataset.r=tab;") && has(html, 'document.body.dataset.r=w==="gate"?"login"'), "halaman aktif ditandai (home/login)");
ok(has(html, ".hband .ttl h1{background:linear-gradient(180deg,#3a2a66,#9a6a12)"), "tulisan ASTERION gelap-emas agar terbaca di latar terang");

/* 5. label Besok/Lusa berwarna cerah */
ok(/\.badge\.nx\{background:linear-gradient\(135deg,#fde68a,#fbbf24 55%,#f59e0b\)/.test(html), "warna cerah untuk Besok/Lusa");
ok(has(html, "class='badge nx'>\"+lb+\"") && has(html, "class='badge nx'>BESOK"), "label Besok/Lusa dan BESOK memakai warna cerah");

/* 6. label & caption GAME KUIS: tiga mode (game, mode soal, simulasi ujian) */
ok(!/GAME RUN/i.test(html + run), "tidak ada lagi tulisan GAME RUN");
ok(/<h1>GAME KUIS<\/h1>/.test(run) && /n:"GAME KUIS"/.test(html) && /run:"GAME KUIS"/.test(html), "label GAME KUIS di judul, menu, dan judul halaman");
ok(has(run, "Pilih salah satu dari empat mode belajar") && /<b>🎮 Game<\/b>[\s\S]{0,200}gerbang A–E/.test(run), "caption menyebut mode game & gerbang A–E");
ok(/<b>📝 Mode Soal<\/b>[\s\S]{0,200}Kunci dan pembahasan tiap pilihan/.test(run), "caption menyebut Mode Soal + pembahasan per pilihan");
ok(/<b>🌿 Mode Santai<\/b>[\s\S]{0,200}tanpa timer/.test(run), "caption menyebut Mode Santai (tanpa timer)");
ok(/<b>🎓 Simulasi Ujian<\/b>[\s\S]{0,120}Jawaban baru terbuka di akhir/.test(run), "caption menyebut Simulasi Ujian (jawaban di akhir)");
ok(has(run, "kembali ke nomor sebelumnya, melompat ke nomor mana pun, dan menandai soal (flag)"), "caption menyebut pindah nomor & flag soal");
ok(has(run, "Skor: benar +1, salah/kosong 0 · Waktu dihitung per soal · Setelah selesai, kamu mendapat pembahasan semua soal."), "caption tetap memuat skor, waktu per soal, dan pembahasan akhir");
ok(["#/run/play/", "#/run/quiz/", "#/run/exam/"].every(function (x) { return run.indexOf(x) > -1; }), "tiga tombol mode tersedia di kartu kategori");
ok(/s:"3 mode: game 3D, mode soal & simulasi ujian"/.test(html), "subjudul menu home menyebut tiga mode");

console.log(fail ? "HASIL: GAGAL" : "HASIL: SEMUA LOLOS");
process.exit(fail);
