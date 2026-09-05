-- Family Tracker schema (Supabase / Postgres)
-- Run in SQL editor. App also works without Supabase (localStorage fallback).

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null check (role in ('parent','child')),
  color text default '#22d3ee',
  created_at timestamptz default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text default '',
  points int default 1,
  recurrence text not null check (recurrence in ('once','daily','weekly','interval')),
  days int[] default '{}',
  interval_days int default 2,
  start_date date not null,
  time text default '',
  assigned_to uuid[] default '{}',
  rotation boolean default false,
  active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists completions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references activities(id) on delete cascade,
  member_id uuid references profiles(id) on delete cascade,
  date date not null,
  done_at timestamptz default now(),
  unique(activity_id, member_id, date)
);

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  cost int not null,
  created_at timestamptz default now()
);

create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  done boolean default false,
  added_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id) on delete cascade,
  reward_title text not null,
  cost int not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table activities enable row level security;
alter table completions enable row level security;
alter table rewards enable row level security;
alter table shopping_items enable row level security;
alter table redemptions enable row level security;

-- Permissive for family MVP (single household, authenticated users). Tighten per-household later.
create policy "auth all profiles" on profiles for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all activities" on activities for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all completions" on completions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all rewards" on rewards for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all shopping" on shopping_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all redemptions" on redemptions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
