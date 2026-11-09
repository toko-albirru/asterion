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

console.log(fail ? "HASIL: GAGAL" : "HASIL: SEMUA LOLOS");
process.exit(fail);
