-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: drops nothing, just creates if missing would need IF NOT EXISTS
-- guards if you ever re-run — for a first-time setup, paste and run as-is.

create table profile (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  weight_kg numeric not null,
  height_cm numeric not null,
  age int not null,
  sex text not null check (sex in ('male','female')),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text not null default 'maintain' check (goal in ('lose','maintain','gain')),
  rate_kg_per_week numeric not null default 0,
  protein_g_per_kg numeric not null default 1.8 check (protein_g_per_kg between 1.6 and 2.2),
  updated_at timestamptz not null default now()
);

create table diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  entry_date date not null,
  title text not null,
  content text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index on diary_entries (user_id, entry_date);

create table custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  kcal_per_100g numeric not null,
  protein_g_per_100g numeric not null,
  fat_g_per_100g numeric not null,
  carbs_g_per_100g numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  log_date date not null,
  meal text not null check (meal in ('breakfast','lunch','dinner')),
  food_name text not null,
  grams numeric not null,
  kcal numeric not null,
  protein_g numeric not null,
  fat_g numeric not null,
  carbs_g numeric not null,
  created_at timestamptz not null default now()
);
create index on food_logs (user_id, log_date);

-- Row Level Security: identical select/insert/update/delete-own-row pattern
-- on every table. user_id defaults to auth.uid() so clients never send it
-- explicitly; the `with check` still blocks it from being spoofed.

alter table profile enable row level security;
create policy "select_own" on profile for select using (auth.uid() = user_id);
create policy "insert_own" on profile for insert with check (auth.uid() = user_id);
create policy "update_own" on profile for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on profile for delete using (auth.uid() = user_id);

alter table diary_entries enable row level security;
create policy "select_own" on diary_entries for select using (auth.uid() = user_id);
create policy "insert_own" on diary_entries for insert with check (auth.uid() = user_id);
create policy "update_own" on diary_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on diary_entries for delete using (auth.uid() = user_id);

alter table custom_foods enable row level security;
create policy "select_own" on custom_foods for select using (auth.uid() = user_id);
create policy "insert_own" on custom_foods for insert with check (auth.uid() = user_id);
create policy "update_own" on custom_foods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on custom_foods for delete using (auth.uid() = user_id);

alter table food_logs enable row level security;
create policy "select_own" on food_logs for select using (auth.uid() = user_id);
create policy "insert_own" on food_logs for insert with check (auth.uid() = user_id);
create policy "update_own" on food_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on food_logs for delete using (auth.uid() = user_id);
