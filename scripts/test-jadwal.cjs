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

/* 4. mode terang: pita ungu hanya di atas (logo + navbar home/login) */
ok(!/#bb9bef/.test(html), "gradasi ungu full-page dihapus");
ok(/:root\[data-theme="light"\] html\{background-color:#fdfcff[^}]*overflow-x:hidden/.test(html), "latar halaman putih terang");
ok(/\.hband::before\{[^}]*width:100vw[^}]*#8b5cf6[^}]*#6d28d9/.test(html), "pita ungu melebar full width");
ok(/\.hband::before\{[^}]*border-radius:0 0 26px 26px/.test(html), "pita ungu berhenti dengan sudut membulat di bawah logo");
ok(/\.gate \.hband\{margin:0 -18px;padding:0 18px;--hb-t:-18px\}/.test(html), "pita ungu login mulai dari paling atas");
ok(/<div class="hband">\s*<div class="gthm">/.test(html) && /class="ttl" style="margin-top:-46px"><h1>ASTERION<\/h1>[\s\S]{0,80}<\/div>\s*<\/div>/.test(html), "logo login dibungkus pita ungu");
ok(/class='hband'><div class='hero'>[\s\S]{0,140}ASTERION/.test(html), "logo home dibungkus pita ungu");
ok(/body\[data-r="home"\] \.top::before\{background:linear-gradient\(180deg,#7c3aed,#6d28d9\)/.test(html), "navbar atas ungu di home");
ok(/body\[data-r="home"\] \.top h2\{color:#fff\}/.test(html), "judul navbar putih di atas ungu");
ok(/document\.body\.dataset\.r=tab;/.test(html) && /document\.body\.dataset\.r=w==="gate"\?"login"/.test(html), "halaman aktif ditandai (home/login)");
ok(/\.hband \.ttl h1\{[^}]*#ffffff,#ffe9a8/.test(html), "tulisan ASTERION terang di atas ungu");

/* 5. label Besok/Lusa berwarna cerah */
ok(/\.badge\.nx\{background:linear-gradient\(135deg,#fde68a,#fbbf24 55%,#f59e0b\)/.test(html), "warna cerah untuk Besok/Lusa");
ok((html.match(/class='badge nx'/g) || []).length === 2, "label Besok/Lusa dan BESOK memakai warna cerah");

/* 6. label & caption GAME KUIS: tiga mode (game, mode soal, simulasi ujian) */
ok(!/GAME RUN/i.test(html + run), "tidak ada lagi tulisan GAME RUN");
ok(/<h1>GAME KUIS<\/h1>/.test(run) && /n:"GAME KUIS"/.test(html) && /run:"GAME KUIS"/.test(html), "label GAME KUIS di judul, menu, dan judul halaman");
ok(/Tiga mode: 🎮 <b>Game<\/b>/.test(run) && /gerbang <b>A–E<\/b>/.test(run), "caption menyebut mode game & gerbang A–E");
ok(/📝 <b>Mode Soal<\/b> — tanpa game, kunci &amp; pembahasan tiap pilihan/.test(run), "caption menyebut Mode Soal + pembahasan per pilihan");
ok(/🎓 <b>Simulasi Ujian<\/b> — jawaban baru terbuka di akhir/.test(run), "caption menyebut Simulasi Ujian (jawaban di akhir)");
ok(/kembali ke nomor sebelumnya, lompat ke nomor mana pun, dan menandai soal \(flag\)/.test(run), "caption menyebut pindah nomor & flag soal");
ok(/Skor: benar \+1, salah\/kosong 0\. Waktu <b>per soal<\/b>\. Setelah selesai, kamu mendapat pembahasan semua soal\./.test(run), "caption tetap memuat skor, waktu per soal, dan pembahasan akhir");
ok(["#/run/play/", "#/run/quiz/", "#/run/exam/"].every(function (x) { return run.indexOf(x) > -1; }), "tiga tombol mode tersedia di kartu kategori");
ok(/s:"3 mode: game 3D, mode soal & simulasi ujian"/.test(html), "subjudul menu home menyebut tiga mode");

console.log(fail ? "HASIL: GAGAL" : "HASIL: SEMUA LOLOS");
process.exit(fail);
