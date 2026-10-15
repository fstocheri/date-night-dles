-- Date Night Dles: synced progress, links, and settings for a signed-in account.
-- Every table is private to its owner via row-level security (RLS).

-- One row per game per day: the guesses so far and how it ended.
-- Stats and streaks are computed in the browser from these rows.
create table if not exists public.game_records (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  game_id text not null,
  date date not null,
  guesses jsonb not null default '[]',        -- guessed entry ids; null = skipped turn
  hard boolean not null default false,
  bonus_guesses jsonb not null default '[]',  -- bonus round option indexes
  outcome text check (outcome in ('won', 'lost')),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, date)
);

-- "Our other dles": links to outside games.
create table if not exists public.links (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  url text not null check (url ~ '^https?://'),
  icon text not null default 'favicon',      -- an emoji, or 'favicon'
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists links_user_position on public.links (user_id, position);

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  hard boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.game_records enable row level security;
alter table public.links enable row level security;
alter table public.settings enable row level security;

drop policy if exists "own game records" on public.game_records;
create policy "own game records" on public.game_records for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own links" on public.links;
create policy "own links" on public.links for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Explicit, in case the project doesn't expose new tables to the API automatically.
grant select, insert, update, delete on public.game_records, public.links, public.settings to authenticated;
