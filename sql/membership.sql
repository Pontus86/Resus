-- Kör detta i Supabase Dashboard -> SQL Editor -> New query -> Run
-- Lägger till konto-koppling (Supabase Auth) ovanpå de befintliga tabellerna:
--   1) scores            (HLR:s topplista) -> + user_id, så "Din historik" kan följa
--      med mellan enheter i stället för att bara ligga i webbläsarens localStorage.
--   2) custom_checklists (Checklistors egna checklistor) -> + owner_id, så redigera/
--      radera låses till den som SKAPADE checklistan. Läsning förblir öppen för alla.
--   3) checklist_ratings (NY tabell) -> tumme upp/ner per användare, så favoriter
--      synkas mellan enheter (localStorage används fortfarande som lokal cache/fallback
--      utloggad, se Checklistor/js/tags.js).
--   4) checklist_logbook (NY tabell) -> loggbok med valfri tid + lyckad/ej per genomförd
--      procedur, för "Mina resultat" (stats.js).
--   5) ekg_game_history (NY tabell) -> rundhistorik för EKG-matchningsspelet, för
--      "Mina resultat" (stats.js).
--   6) hlr_unlocked_profiles (NY tabell) -> upplåsta läkarprofiler (achievements) i
--      A-HLR Simulator, så upplåsningar följer med mellan enheter.
--   7) profiles (NY tabell) -> användarnamn, för att kunna tagga kollegor i loggboken.
--   8) checklist_logbook -> + logged_by/status, så en kollega kan taggas på en procedur och
--      själv behöva BEKRÄFTA den (Loggbok-modulen) i stället för att den räknas automatiskt.
-- Inloggning i sig kräver INGEN SQL — Supabase Auths e-post/magic-link-inloggning är
-- påslagen som standard. Om magic-länkarna inte kommer fram, kolla Authentication ->
-- URL Configuration i dashboarden och lägg till din sidas URL i "Redirect URLs".
--
-- OBS: Postgres stödjer INTE "create policy if not exists" (till skillnad från table/
-- index) — rätt idiom är "drop policy if exists" följt av ett vanligt "create policy",
-- vilket är vad hela filen nedan gör (gör den säker att köra flera gånger om).

-- ---------- 1) scores: koppla till konto (nullable — anonymt spel funkar fortfarande) ----------
alter table scores add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists scores_user_id_idx on scores (user_id, created_at desc);

-- En inloggad spelare får bara TAGGA sin egen insert med sitt eget user_id (kan inte
-- spoofa någon annans) — annars oförändrat: alla (inloggade eller ej) får fortfarande
-- lägga till en rad, och alla får fortfarande läsa hela topplistan (se leaderboard_setup.sql).
drop policy if exists "anon can insert scores" on scores;
drop policy if exists "insert own or anonymous score" on scores;
create policy "insert own or anonymous score"
  on scores for insert
  to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);

-- Låt en inloggad användare läsa sin EGEN historik även om den allmänna "anon can read"-
-- policyn någon gång skulle stängas ner (redundant idag eftersom select redan är öppen,
-- men gör "Din historik" robust oberoende av det).
drop policy if exists "user can read own scores" on scores;
create policy "user can read own scores"
  on scores for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------- 2) custom_checklists: äganderätt ----------
alter table custom_checklists add column if not exists owner_id uuid references auth.users(id) on delete set null;
create index if not exists custom_checklists_owner_id_idx on custom_checklists (owner_id);

alter table custom_checklists enable row level security;

-- Läsning förblir helt öppen (delade referenser är nyttiga för hela teamet).
drop policy if exists "anyone can read custom checklists" on custom_checklists;
create policy "anyone can read custom checklists"
  on custom_checklists for select
  to anon, authenticated
  using (true);

-- Skapa: fri för alla (anonymt owner_id null, eller sitt eget user_id om inloggad —
-- kan inte spoofa någon annans id).
drop policy if exists "create own or anonymous checklist" on custom_checklists;
create policy "create own or anonymous checklist"
  on custom_checklists for insert
  to anon, authenticated
  with check (owner_id is null or auth.uid() = owner_id);

-- Redigera/radera: ENDAST ägaren. Checklistor skapade FÖRE inlogget fanns (owner_id null)
-- har ingen ägare att låsa till, så de förblir öppna för alla (matchar tidigare beteende,
-- inget befintligt innehåll låses ute retroaktivt).
drop policy if exists "owner or anonymous can update checklist" on custom_checklists;
create policy "owner or anonymous can update checklist"
  on custom_checklists for update
  to anon, authenticated
  using (owner_id is null or auth.uid() = owner_id)
  with check (owner_id is null or auth.uid() = owner_id);
drop policy if exists "owner or anonymous can delete checklist" on custom_checklists;
create policy "owner or anonymous can delete checklist"
  on custom_checklists for delete
  to anon, authenticated
  using (owner_id is null or auth.uid() = owner_id);

-- ---------- 3) checklist_ratings (ny tabell): favoriter/tumme upp-ner per konto ----------
create table if not exists checklist_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  checklist_id text not null,        -- matchar procedurens/checklistans id (både inbyggda och egna)
  value smallint not null check (value in (-1, 0, 1)),
  updated_at timestamptz not null default now(),
  primary key (user_id, checklist_id)
);
alter table checklist_ratings enable row level security;

-- Striktast möjliga policy: en användare får bara läsa/skriva SINA EGNA betyg.
drop policy if exists "user can manage own ratings" on checklist_ratings;
create policy "user can manage own ratings"
  on checklist_ratings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Läsvänligt namn sparat VID SIDAN OM checklist_id, så "Mina resultat" (stats.js) kan visa
-- t.ex. "Sedering" utan att behöva ladda in hela Checklistors PROCEDURES-register. Nullable
-- (gamla rader saknar den) — stats.js faller tillbaka till att visa checklist_id rått.
alter table checklist_ratings add column if not exists checklist_name text;

-- ---------- 4) checklist_logbook (ny tabell): loggbok med tid + lyckad/ej, per konto ----------
-- Checklistors LOKALA loggbok (LogStore, localStorage) fanns redan innan inlogg — den här
-- tabellen är bara en valfri, inloggad SPEGEL av samma poster (se Checklistor/js/log-store.js)
-- så "Mina resultat" kan visa loggboken/CUSUM-grafen oavsett vilken enhet man loggar in från.
-- Utloggat: allt funkar precis som förut, bara lokalt.
create table if not exists checklist_logbook (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  checklist_id text not null,
  checklist_name text,
  detail text,
  duration_s integer,     -- valfritt ("optional info"), sekunder
  success boolean,        -- valfritt, null = ej angivet
  created_at timestamptz not null default now()
);
create index if not exists checklist_logbook_user_id_idx on checklist_logbook (user_id, created_at desc);
alter table checklist_logbook enable row level security;
-- Policyerna för checklist_logbook sätts i sektion 8 nedan (efter profiles finns) — dit
-- flyttades även deltagartaggning/bekräftelseflödet. Om du körde en TIDIGARE version av det
-- här scriptet finns en bred "user can manage own logbook"-policy sedan innan; sektion 8
-- droppar den och ersätter med fyra snävare (view/update/delete/insert).

-- ---------- 5) ekg_game_history (ny tabell): rundhistorik för EKG-matchningsspelet ----------
create table if not exists ekg_game_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  level integer not null,
  condition_count integer not null,
  match_pct numeric not null,
  round_score integer not null,
  perfect boolean not null default false,
  gave_up boolean not null default false,
  hints_used integer not null default 0,
  target_labels text,
  created_at timestamptz not null default now()
);
create index if not exists ekg_game_history_user_id_idx on ekg_game_history (user_id, created_at desc);
alter table ekg_game_history enable row level security;
drop policy if exists "user can manage own game history" on ekg_game_history;
create policy "user can manage own game history"
  on ekg_game_history for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- 6) hlr_unlocked_profiles (ny tabell): upplåsta läkarprofiler i A-HLR Simulator ----------
-- Bara SJÄLVA upplåsningen synkas mellan enheter — flerspels-räknarna som leder fram till en
-- upplåsning (t.ex. "säkra luftvägen i 10 spel") hålls medvetet bara lokalt (se
-- HLR/js/achievements.js), en upplåst profil är upplåst för gott oavsett enhet.
create table if not exists hlr_unlocked_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);
alter table hlr_unlocked_profiles enable row level security;
drop policy if exists "user can manage own unlocks" on hlr_unlocked_profiles;
create policy "user can manage own unlocks"
  on hlr_unlocked_profiles for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- 7) profiles (ny tabell): användarnamn ----------
-- Krävs för deltagartaggning i loggboken (Loggbok-modulen) — man taggar kollegor på ett
-- procedurtillfälle med deras ANVÄNDARNAMN, inte deras mailadress (mailadresser ska inte
-- behöva delas ut/synas för att tagga någon). Läsning öppen för alla inloggade (annars går
-- det inte att SÖKA fram någon att tagga) — skrivning bara till sin EGEN rad.
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);
-- Postgres stödjer inte "add constraint if not exists" (samma sak som policies, se filens
-- topp-kommentar) — drop-if-exists följt av ett vanligt add constraint i stället.
alter table profiles drop constraint if exists username_format;
alter table profiles add constraint username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$');
alter table profiles enable row level security;
drop policy if exists "anyone can read usernames" on profiles;
create policy "anyone can read usernames"
  on profiles for select
  to authenticated
  using (true);
drop policy if exists "user can insert own username" on profiles;
create policy "user can insert own username"
  on profiles for insert
  to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "user can update own username" on profiles;
create policy "user can update own username"
  on profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- 8) checklist_logbook: deltagartaggning + bekräftelseflöde ----------
-- user_id = vem raden TILLHÖR (den som ska bekräfta/räkna in den i sin egen historik).
-- logged_by = vem som SKAPADE raden (samma som user_id vid självloggning). status='pending'
-- när någon annan taggat dig — syns i Loggbok-modulens "Väntar bekräftelse"-lista tills du
-- accepterar (status->'confirmed') eller avvisar (status->'declined') den. Självloggade rader
-- (user_id=logged_by) är 'confirmed' direkt, som innan den här funktionen fanns.
alter table checklist_logbook add column if not exists logged_by uuid references auth.users(id) on delete set null;
alter table checklist_logbook add column if not exists status text not null default 'confirmed';
alter table checklist_logbook drop constraint if exists checklist_logbook_status_check;
alter table checklist_logbook add constraint checklist_logbook_status_check check (status in ('confirmed','pending','declined'));
update checklist_logbook set logged_by = user_id where logged_by is null;

drop policy if exists "user can manage own logbook" on checklist_logbook;
drop policy if exists "user can view own logbook" on checklist_logbook;
create policy "user can view own logbook"
  on checklist_logbook for select
  to authenticated
  using (auth.uid() = user_id);
drop policy if exists "user can update own logbook" on checklist_logbook;
create policy "user can update own logbook"
  on checklist_logbook for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "user can delete own logbook" on checklist_logbook;
create policy "user can delete own logbook"
  on checklist_logbook for delete
  to authenticated
  using (auth.uid() = user_id);
-- Skapa: antingen loggar jag min EGEN rad (user_id=jag), ELLER taggar jag NÅGON ANNAN — då
-- MÅSTE logged_by vara jag (kan inte spoofa vem som taggade) och status MÅSTE vara 'pending'
-- (kan inte tvinga in en färdigbekräftad rad i någon annans loggbok).
drop policy if exists "user can create own or tag others pending" on checklist_logbook;
create policy "user can create own or tag others pending"
  on checklist_logbook for insert
  to authenticated
  with check (
    logged_by = auth.uid()
    and (user_id = auth.uid() or status = 'pending')
  );
