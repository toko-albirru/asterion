-- ASTERION RUN — fitur gelombang 1: soal tersimpan, catatan fokus/pomodoro, badge.
-- Aman dijalankan berulang. Kolom baru di tabel lama (run_sessions.kind, run_answers.t, run_prefs.daily_goal)
-- DITAMBAHKAN OTOMATIS oleh worker (runDb) saat API pertama dipanggil, jadi tidak ada ALTER di sini.
CREATE TABLE IF NOT EXISTS run_bookmarks ( u TEXT NOT NULL, qid INTEGER NOT NULL, cat_id INTEGER NOT NULL, snap TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (u, qid) );
CREATE INDEX IF NOT EXISTS ix_rb_user ON run_bookmarks (u, cat_id);
CREATE TABLE IF NOT EXISTS run_focus ( id INTEGER PRIMARY KEY AUTOINCREMENT, u TEXT NOT NULL, t INTEGER NOT NULL, min INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'fokus' );
CREATE INDEX IF NOT EXISTS ix_rf_user ON run_focus (u, t);
CREATE TABLE IF NOT EXISTS run_badges ( u TEXT NOT NULL, id TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (u, id) );
