-- ASTERION AI — skema Supabase (jalankan SEKALI di Supabase → SQL Editor → New query → Run)
-- Aman dijalankan berulang. Semua tabel dikunci (RLS) — hanya Worker (service key) yang bisa mengakses.

-- ───────── Materi untuk RAG (pencarian kata kunci full-text; tanpa embedding eksternal) ─────────
create table if not exists ai_docs (
  id         bigserial primary key,
  skey       text not null unique,            -- kunci sumber: h:<id html> | g:<id file Drive> | u:<url> | n:<judul>
  title      text not null,
  block      text not null default '',        -- blok/kategori asal
  kind       text not null default 'html',    -- html | pptx
  url        text not null default '',
  hash       text not null default '',
  n_chunks   int  not null default 0,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists ai_chunks (
  id      bigserial primary key,
  doc_id  bigint not null references ai_docs(id) on delete cascade,
  ord     int not null,
  loc     text not null default '',           -- "Slide 3–4" / nama bagian
  content text not null,
  tsv     tsvector generated always as (to_tsvector('simple', content)) stored
);
create index if not exists ai_chunks_tsv on ai_chunks using gin (tsv);
create index if not exists ai_chunks_doc on ai_chunks (doc_id, ord);

-- ───────── Percakapan & riwayat ─────────
create table if not exists ai_convs (
  id         uuid primary key default gen_random_uuid(),
  u          text not null,
  title      text not null default 'Percakapan baru',
  doc_id     bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_convs_u on ai_convs (u, updated_at desc);
create table if not exists ai_msgs (
  id         bigserial primary key,
  conv_id    uuid not null references ai_convs(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  cites      jsonb,
  model      text,
  tok_in     int not null default 0,
  tok_out    int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_msgs_conv on ai_msgs (conv_id, id);

-- ───────── Kuota, pengguna, pengaturan, kesehatan model, cache ─────────
create table if not exists ai_usage (
  day date not null, u text not null,
  req int not null default 0, tok_in bigint not null default 0, tok_out bigint not null default 0,
  primary key (day, u)
);
create table if not exists ai_users (
  u text primary key, blocked boolean not null default false,
  req_limit int, tok_limit int, note text not null default ''
);
create table if not exists ai_settings (
  k text primary key, v jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists ai_model_stats (
  model text primary key, ok int not null default 0, fail int not null default 0,
  last_ms int, last_err text not null default '', updated_at timestamptz not null default now()
);
create table if not exists ai_cache (
  h text primary key, answer text not null, cites jsonb, model text,
  created_at timestamptz not null default now()
);

-- ───────── Fungsi (dipanggil Worker lewat RPC) ─────────
create or replace function ai_search(q text, n int default 6, only_doc bigint default null)
returns table (id bigint, doc_id bigint, skey text, title text, block text, loc text, content text, rank real)
language sql stable as $$
  select c.id, c.doc_id, d.skey, d.title, d.block, c.loc, c.content,
         (ts_rank_cd(c.tsv, to_tsquery('simple', q))
          + case when to_tsvector('simple', d.title) @@ to_tsquery('simple', q) then 0.2 else 0 end)::real as rank
  from ai_chunks c join ai_docs d on d.id = c.doc_id
  where d.enabled
    and (only_doc is null or c.doc_id = only_doc)
    and c.tsv @@ to_tsquery('simple', q)
  order by rank desc, c.id
  limit least(greatest(n, 1), 12);
$$;

create or replace function ai_put_doc(p jsonb) returns bigint language plpgsql as $$
declare did bigint;
begin
  insert into ai_docs (skey, title, block, kind, url, hash, updated_at)
  values (p->>'skey', p->>'title', coalesce(p->>'block',''), coalesce(p->>'kind','html'), coalesce(p->>'url',''), coalesce(p->>'hash',''), now())
  on conflict (skey) do update
    set title = excluded.title, block = excluded.block, kind = excluded.kind,
        url = excluded.url, hash = excluded.hash, updated_at = now()
  returning id into did;
  delete from ai_chunks where doc_id = did;
  insert into ai_chunks (doc_id, ord, loc, content)
  select did, t.ord::int, coalesce(t.c->>'loc',''), t.c->>'content'
  from jsonb_array_elements(p->'chunks') with ordinality as t(c, ord)
  where length(coalesce(t.c->>'content','')) > 0;
  update ai_docs set n_chunks = (select count(*) from ai_chunks where doc_id = did) where id = did;
  return did;
end $$;

-- kuota harian (hari = tanggal WIB). Mengembalikan {ok, req, tok}
create or replace function ai_take(p_u text, p_req int, p_tok bigint) returns jsonb language plpgsql as $$
declare d date := (now() at time zone 'Asia/Jakarta')::date; r ai_usage;
begin
  insert into ai_usage (day, u) values (d, p_u) on conflict do nothing;
  select * into r from ai_usage where day = d and u = p_u for update;
  if r.req >= p_req or (r.tok_in + r.tok_out) >= p_tok then
    return jsonb_build_object('ok', false, 'req', r.req, 'tok', r.tok_in + r.tok_out);
  end if;
  update ai_usage set req = req + 1 where day = d and u = p_u;
  return jsonb_build_object('ok', true, 'req', r.req + 1, 'tok', r.tok_in + r.tok_out);
end $$;

create or replace function ai_refund(p_u text) returns void language sql as $$
  update ai_usage set req = greatest(req - 1, 0)
  where day = (now() at time zone 'Asia/Jakarta')::date and u = p_u;
$$;

create or replace function ai_add_tok(p_u text, a int, b int) returns void language sql as $$
  update ai_usage set tok_in = tok_in + a, tok_out = tok_out + b
  where day = (now() at time zone 'Asia/Jakarta')::date and u = p_u;
$$;

create or replace function ai_model_mark(p_model text, p_ok boolean, p_ms int, p_err text) returns void language sql as $$
  insert into ai_model_stats (model, ok, fail, last_ms, last_err, updated_at)
  values (p_model, case when p_ok then 1 else 0 end, case when p_ok then 0 else 1 end, p_ms, case when p_ok then '' else coalesce(p_err,'') end, now())
  on conflict (model) do update set
    ok = ai_model_stats.ok + case when p_ok then 1 else 0 end,
    fail = ai_model_stats.fail + case when p_ok then 0 else 1 end,
    last_ms = p_ms,
    last_err = case when p_ok then ai_model_stats.last_err else coalesce(p_err,'') end,
    updated_at = now();
$$;

create or replace function ai_stats(p_days int default 7) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'daily', coalesce((select jsonb_agg(x order by x.day) from (
        select day, count(*) as users, sum(req) as req, sum(tok_in) as tin, sum(tok_out) as tout
        from ai_usage where day >= (now() at time zone 'Asia/Jakarta')::date - (greatest(p_days,1) - 1)
        group by day) x), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(x) from (
        select u, sum(req) as req, sum(tok_in + tok_out) as tok
        from ai_usage where day >= (now() at time zone 'Asia/Jakarta')::date - (greatest(p_days,1) - 1)
        group by u order by sum(tok_in + tok_out) desc limit 20) x), '[]'::jsonb),
    'models', coalesce((select jsonb_agg(x) from (
        select coalesce(model,'-') as model, count(*) as n, sum(tok_in) as tin, sum(tok_out) as tout
        from ai_msgs where role = 'assistant' and created_at >= now() - make_interval(days => greatest(p_days,1))
        group by model order by count(*) desc) x), '[]'::jsonb)
  );
$$;

-- ───────── Keamanan: kunci semua tabel & fungsi dari akses publik (anon key) ─────────
alter table ai_docs enable row level security;
alter table ai_chunks enable row level security;
alter table ai_convs enable row level security;
alter table ai_msgs enable row level security;
alter table ai_usage enable row level security;
alter table ai_users enable row level security;
alter table ai_settings enable row level security;
alter table ai_model_stats enable row level security;
alter table ai_cache enable row level security;

revoke all on function ai_search(text, int, bigint) from public, anon, authenticated;
revoke all on function ai_put_doc(jsonb) from public, anon, authenticated;
revoke all on function ai_take(text, int, bigint) from public, anon, authenticated;
revoke all on function ai_refund(text) from public, anon, authenticated;
revoke all on function ai_add_tok(text, int, int) from public, anon, authenticated;
revoke all on function ai_model_mark(text, boolean, int, text) from public, anon, authenticated;
revoke all on function ai_stats(int) from public, anon, authenticated;
grant execute on function ai_search(text, int, bigint) to service_role;
grant execute on function ai_put_doc(jsonb) to service_role;
grant execute on function ai_take(text, int, bigint) to service_role;
grant execute on function ai_refund(text) to service_role;
grant execute on function ai_add_tok(text, int, int) to service_role;
grant execute on function ai_model_mark(text, boolean, int, text) to service_role;
grant execute on function ai_stats(int) to service_role;
