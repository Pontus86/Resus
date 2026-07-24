-- Kör detta i Supabase Dashboard -> SQL Editor -> New query -> Run
-- Skapar topplista-tabellen och öppnar den för anonym insert + select (ingen inloggning krävs),
-- men stänger update/delete helt (ingen, inte ens den som skrev raden, kan ändra i efterhand).

create table if not exists scores (
  id bigint generated always as identity primary key,
  name text not null,
  score int not null,
  max_score int not null,
  pct int not null,
  cause text not null,
  level text not null,             -- guided/normal/advanced/expert
  rosc boolean not null default false,
  created_at timestamptz not null default now()
);

-- enkla rimlighetsgränser så att inte helt orimliga poster kan smygas in
alter table scores add constraint name_len check (char_length(name) between 1 and 24);
alter table scores add constraint score_range check (score between -1000 and 1000);
alter table scores add constraint pct_range check (pct between 0 and 100);

alter table scores enable row level security;

-- vem som helst med anon-nyckeln får lägga till en rad
create policy "anon can insert scores"
  on scores for insert
  to anon
  with check (true);

-- vem som helst med anon-nyckeln får läsa listan
create policy "anon can read scores"
  on scores for select
  to anon
  using (true);

-- inga uppdaterings- eller borttagningspolicies skapas -> ingen kan ändra/radera via anon-nyckeln,
-- bara du själv via Supabase-dashboarden (eller service_role-nyckeln, som aldrig ska användas i spelet).

-- bra index för att snabbt hämta topplistan sorterad på poäng
create index if not exists scores_score_idx on scores (score desc, created_at desc);
