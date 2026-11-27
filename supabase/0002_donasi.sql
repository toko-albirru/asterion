-- ASTERION — donasi & dinding donatur (jalankan di Supabase → SQL Editor, setelah 0001_ai.sql atau terpisah; aman diulang)
create table if not exists don_items (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,                         -- kode di pesan Saweria, mis. AST-7K2QX
  u           text,                                -- NIM donatur (bila login saat membuat kode)
  mode        text not null default 'acak' check (mode in ('anon','nim','nama','acak')),
  show_amount boolean not null default false,      -- nominal tampil hanya bila donatur setuju
  display     text not null default '',            -- nama yang tampil (dihitung server dari pilihan donatur)
  amount      bigint,
  status      text not null default 'pledge' check (status in ('pledge','paid','pending','hidden')),
  sa_id       text unique,                         -- id donasi Saweria (anti-ganda)
  raw_name    text,                                -- nama yang diketik di Saweria (tidak pernah ditampilkan)
  message     text,
  sig_ok      boolean not null default false,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
create index if not exists don_items_wall on don_items (status, paid_at desc);
alter table don_items enable row level security;   -- tanpa policy: hanya Worker (service key) yang bisa akses
