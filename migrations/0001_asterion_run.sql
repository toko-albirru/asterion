-- ASTERION RUN — skema Cloudflare D1 (binding: DB)
-- Aman dijalankan berulang (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS run_cats (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  descr         TEXT    NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  per_session   INTEGER NOT NULL DEFAULT 20,   -- jumlah soal per sesi (0 = semua soal aktif)
  q_time        INTEGER NOT NULL DEFAULT 60,   -- detik PER SOAL
  show_explain  INTEGER NOT NULL DEFAULT 1,
  sort          INTEGER NOT NULL DEFAULT 0,
  created       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS run_questions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  cat_id    INTEGER NOT NULL,
  num       INTEGER,                 -- nomor soal asli di PDF
  q         TEXT    NOT NULL,
  a TEXT NOT NULL DEFAULT '', b TEXT NOT NULL DEFAULT '', c TEXT NOT NULL DEFAULT '',
  d TEXT NOT NULL DEFAULT '', e TEXT NOT NULL DEFAULT '',
  ans       TEXT    NOT NULL,        -- kunci: A..E (TIDAK PERNAH dikirim ke browser saat bermain)
  expl      TEXT    NOT NULL DEFAULT '',
  diff      INTEGER NOT NULL DEFAULT 2,
  img       TEXT    NOT NULL DEFAULT '',
  active    INTEGER NOT NULL DEFAULT 1,
  verified  INTEGER NOT NULL DEFAULT 0,  -- 1 = sudah diperiksa/disetujui admin
  src       TEXT    NOT NULL DEFAULT '',
  hash      TEXT    NOT NULL,
  imported  INTEGER NOT NULL,
  updated   INTEGER NOT NULL,
  UNIQUE (cat_id, hash)
);
CREATE INDEX IF NOT EXISTS ix_rq_cat ON run_questions (cat_id, active, verified);

CREATE TABLE IF NOT EXISTS run_sessions (
  id           TEXT PRIMARY KEY,
  u            TEXT    NOT NULL,
  cat_id       INTEGER NOT NULL,
  cat_name     TEXT    NOT NULL,
  status       TEXT    NOT NULL,         -- ready | active | done | abandoned
  total        INTEGER NOT NULL,
  requested    INTEGER NOT NULL DEFAULT 0,
  q_time       INTEGER NOT NULL,
  show_explain INTEGER NOT NULL DEFAULT 1,
  cur          INTEGER NOT NULL DEFAULT 0,
  qstart       INTEGER,                  -- awal waktu soal berjalan (ms)
  paused_at    INTEGER,
  pause_used   INTEGER NOT NULL DEFAULT 0,
  started      INTEGER NOT NULL,
  began        INTEGER,
  fin          INTEGER,
  score        INTEGER NOT NULL DEFAULT 0,
  correct      INTEGER NOT NULL DEFAULT 0,
  wrong        INTEGER NOT NULL DEFAULT 0,
  blank        INTEGER NOT NULL DEFAULT 0,
  acc          REAL    NOT NULL DEFAULT 0,
  dur          INTEGER NOT NULL DEFAULT 0,
  rank         INTEGER
);
CREATE INDEX IF NOT EXISTS ix_rs_user ON run_sessions (u, status);
CREATE INDEX IF NOT EXISTS ix_rs_cat  ON run_sessions (cat_id, status, fin);

-- Snapshot setiap soal pada sesi: riwayat tidak berubah walau bank soal diedit/dihapus.
CREATE TABLE IF NOT EXISTS run_answers (
  sid      TEXT    NOT NULL,
  idx      INTEGER NOT NULL,
  qid      INTEGER,
  snap     TEXT    NOT NULL,             -- JSON {q,a..e,ans,expl,img,num}
  chosen   TEXT,                         -- A..E atau NULL (kosong/waktu habis)
  correct  INTEGER NOT NULL DEFAULT 0,
  ms       INTEGER,
  answered INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sid, idx)
);

CREATE TABLE IF NOT EXISTS run_images (
  id      TEXT PRIMARY KEY,
  mime    TEXT NOT NULL,
  data    TEXT NOT NULL,                 -- base64
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS run_settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_audit (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  t      INTEGER NOT NULL,
  u      TEXT    NOT NULL,
  act    TEXT    NOT NULL,
  detail TEXT    NOT NULL DEFAULT ''
);
