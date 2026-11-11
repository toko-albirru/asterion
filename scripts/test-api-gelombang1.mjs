// Uji end-to-end API fitur gelombang 1 (mode santai, ulangi yang salah, bookmark, filter kesulitan, streak, fokus, badge).
// Cara pakai (database SEMENTARA, jangan arahkan ke data asli):
//   DATA_DIR=/tmp/ast_test ADMIN_PASSWORD=adminpw PORT=3111 node --no-warnings server.js &
//   node --no-warnings scripts/test-api-gelombang1.mjs
import { DatabaseSync } from "node:sqlite";
const B = "http://127.0.0.1:3111/api/";
let tok = "";
const call = async (p, m = "GET", b) => { const r = await fetch(B + p, { method: m, headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: b ? JSON.stringify(b) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
let fails = 0; const ok = (c, msg, extra) => { console.log((c ? "PASS " : "FAIL ") + msg + (!c && extra !== undefined ? " -> " + JSON.stringify(extra).slice(0, 300) : "")); if (!c) fails++; };
const login = async (u, p) => (await (await fetch(B + "login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ u, p }) })).json());
// student
let L = await login("G0025001", "G0025001"); tok = L.token;
await call("changepw", "POST", { np: "secret123" }); L = await login("G0025001", "secret123"); tok = L.token;
let r = await call("run/cats"); ok(r.s === 200, "cats ok", r);
// seed
const db = new DatabaseSync((process.env.DATA_DIR || "/tmp/ast_test") + "/asterion.sqlite");
db.exec("INSERT INTO run_cats (name, descr, active, per_session, q_time, show_explain, sort, created) VALUES ('K1 Imunisasi','',1,0,60,1,1,1)");
const cid = db.prepare("SELECT id FROM run_cats").get().id;
for (let i = 1; i <= 12; i++) db.prepare("INSERT INTO run_questions (cat_id, num, q, a, b, c, d, e, ans, expl, diff, active, verified, hash, imported, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,1,?,1,1)").run(cid, i, "Soal " + i, "a", "b", "c", "d", "e", "A", "Pembahasan " + i, (i % 3) + 1, "h" + i);
r = await call("run/cats"); const c0 = r.j.cats[0];
ok(c0.aq === 12 && c0.dc[1] === 4 && c0.dc[2] === 4 && c0.dc[3] === 4, "diff counts per category", c0);
ok(c0.wrong === 0 && c0.marks === 0, "no wrong/marks yet");
// relax session: no timer
r = await call("run/start", "POST", { cat: cid, mode: "relax" });
ok(r.s === 200 && r.j.mode === "relax" && r.j.q_time === 0 && r.j.total === 12, "start relax", r);
const sid = r.j.sid;
r = await call("run/begin", "POST", { sid }); ok(r.j.status === "active" && r.j.remaining === null, "begin relax has no remaining", r);
// answer: first wrong (B), second skip(null), third correct, others correct
let wrongIdx = [];
for (let i = 0; i < 12; i++) {
  let ans = i === 0 ? "B" : i === 1 ? null : "A";
  if (i > 0) { const rr = await call("run/resume", "POST", { sid }); if (!rr.j.status) ok(false, "resume", rr); ok(rr.j.remaining === null || i === 0, "resume remaining null (relax)" + i); }
  r = await call("run/answer", "POST", { sid, idx: i, ans });
  if (r.s !== 200) { ok(false, "answer " + i, r); break; }
  if (i === 0) ok(r.j.correct === false && r.j.ans === "A" && r.j.explain === true, "relax shows key+explain right after answer", r.j);
  if (i === 1) ok(r.j.blank === true, "relax skip (null) allowed instantly", r.j);
}
r = await call("run/result?sid=" + sid); ok(r.s === 200 && r.j.s.mode === "relax" && r.j.s.correct === 10, "relax result", r.j.s);
ok(r.j.items[0].qid > 0 && r.j.items[0].bm === false, "items have qid & bm");
// leaderboard excludes relax
r = await call("run/lb?cat=" + cid); ok(r.j.rows.length === 0, "relax excluded from leaderboard", r.j);
r = await call("run/lb?cat=global"); ok(r.j.rows.length === 0, "relax excluded from global", r.j);
// wrong pool
r = await call("run/cats"); ok(r.j.cats[0].wrong === 2, "wrong count = 2 (1 wrong + 1 blank)", r.j.cats[0]);
r = await call("run/start", "POST", { cat: cid, mode: "relax", src: "wrong" });
ok(r.s === 200 && r.j.total === 2 && r.j.kind === "wrong" && !r.j.adjusted, "start wrong drill", r.j);
const sid2 = r.j.sid; await call("run/begin", "POST", { sid: sid2 });
r = await call("run/answer", "POST", { sid: sid2, idx: 0, ans: "A" }); ok(r.j.correct === true, "drill answer 1");
await call("run/resume", "POST", { sid: sid2 });
r = await call("run/answer", "POST", { sid: sid2, idx: 1, ans: "B" }); ok(r.j.done === true, "drill finished");
r = await call("run/cats"); ok(r.j.cats[0].wrong === 1, "wrong shrinks after correct retry (1 left)", r.j.cats[0]);
r = await call("run/lb?cat=" + cid); ok(r.j.rows.length === 0, "drill excluded from leaderboard");
// resume mismatch kind -> new session
r = await call("run/start", "POST", { cat: cid, mode: "relax", src: "wrong" }); ok(r.s === 200 && r.j.total === 1, "new wrong drill has 1 question", r.j);
const sid3 = r.j.sid;
// bookmark: unanswered rejected, answered ok
r = await call("run/bookmark", "POST", { sid: sid3, idx: 0, on: 1 }); ok(r.s === 409, "bookmark before answer rejected", r);
await call("run/begin", "POST", { sid: sid3 }); r = await call("run/answer", "POST", { sid: sid3, idx: 0, ans: "A" });
r = await call("run/bookmark", "POST", { sid: sid3, idx: 0, on: 1 }); ok(r.s === 200 && r.j.on === 1, "bookmark after answer", r); const qid = r.j.qid;
r = await call("run/bookmark", "POST", { sid, idx: 3, on: 1 }); ok(r.j.on === 1, "bookmark from finished session");
r = await call("run/bookmarks"); ok(r.j.items.length === 2 && r.j.items[0].ans === "A" && r.j.cats[0].n === 2, "bookmarks list", r.j.cats);
r = await call("run/cats"); ok(r.j.cats[0].marks === 2, "marks count 2");
r = await call("run/start", "POST", { cat: cid, mode: "relax", src: "mark" }); ok(r.j.total === 2 && r.j.kind === "mark", "start mark drill", r.j);
r = await call("run/bookmark", "POST", { qid, on: 0 }); ok(r.j.on === 0, "unbookmark");
// diff filter
r = await call("run/start", "POST", { cat: cid, mode: "quiz", diff: "3" }); ok(r.s === 200 && r.j.total === 4, "diff filter 3 => 4 q", r.j);
r = await call("run/abandon", "POST", { sid: r.j.sid });
r = await call("run/start", "POST", { cat: cid, mode: "quiz", diff: "1,2" }); ok(r.j.total === 8, "diff filter 1,2 => 8 q", r.j.total);
await call("run/abandon", "POST", { sid: r.j.sid });
// exam: bookmark rejected before submit
r = await call("run/start", "POST", { cat: cid, mode: "exam" }); const sidE = r.j.sid; await call("run/begin", "POST", { sid: sidE });
await call("run/exam/save", "POST", { sid: sidE, idx: 0, ans: "A" });
r = await call("run/bookmark", "POST", { sid: sidE, idx: 0, on: 1 }); ok(r.s === 409, "exam bookmark blocked before submit (no key peeking)", r);
r = await call("run/exam/submit", "POST", { sid: sidE }); ok(r.j.done, "exam submit");
r = await call("run/bookmark", "POST", { sid: sidE, idx: 0, on: 1 }); ok(r.j.on === 1, "exam bookmark after submit");
// timed quiz still leaderboard-eligible
r = await call("run/start", "POST", { cat: cid, mode: "quiz" }); const sidQ = r.j.sid; ok(r.j.q_time === 60, "quiz keeps q_time"); await call("run/begin", "POST", { sid: sidQ });
for (let i = 0; i < 12; i++) { if (i) await call("run/resume", "POST", { sid: sidQ }); r = await call("run/answer", "POST", { sid: sidQ, idx: i, ans: "A" }); }
r = await call("run/lb?cat=" + cid); ok(r.j.rows.length === 1, "timed quiz counts on leaderboard", r.j);
// prefs goal + focus + me
r = await call("run/prefs", "POST", { daily_goal: 15 }); ok(r.j.daily_goal === 15, "set daily goal");
r = await call("run/prefs", "POST", { daily_goal: 9999 }); ok(r.s === 400, "goal validation");
r = await call("run/focus", "POST", { min: 25, kind: "pomodoro" }); ok(r.j.ok === 1, "focus log");
r = await call("run/focus", "POST", { min: 0 }); ok(r.s === 400, "focus validation");
r = await call("run/me"); const me = r.j;
ok(me.streak === 1 && me.today > 20 && me.goal === 15, "me streak/today/goal", { streak: me.streak, today: me.today, goal: me.goal });
ok(me.focus.weeks[3].min === 25 && me.focus.all === 25, "focus weeks", me.focus);
ok(me.cats.length === 1 && me.cats[0].n === me.total.n, "per-cat stats", me.cats);
const got = me.badges.filter((b) => b.got).map((b) => b.id);
ok(got.includes("first") && got.includes("q100") === false && got.includes("perfect"), "badges earned", got);
ok(me.fresh.length === 0, "first /me call: badges backfilled silently", me.fresh);
// second visit after earning a new one: save10 not reachable; add via direct DB to simulate q100
db.exec("UPDATE run_badges SET id = id"); const r2 = await call("run/me"); ok(r2.j.fresh.length === 0, "no repeated fresh");
// admin
const A = await login("admin", "adminpw"); tok = A.token; r = await call("run/cats"); ok(r.s === 200 && r.j.cats[0].wrong === 0, "admin cats", r.s);
r = await call("run/me"); ok(r.j.admin === true, "admin me");
console.log(fails ? "\n" + fails + " FAILED" : "\nALL PASSED"); process.exit(fails ? 1 : 0);
