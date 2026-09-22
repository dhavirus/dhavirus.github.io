-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to run any number of times, on a fresh project or an existing one —
-- every statement is idempotent (create-if-missing, add-column-if-missing,
-- drop-then-recreate for policies since Postgres has no "create policy if
-- not exists").

create table if not exists profile (
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

create table if not exists diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  entry_date date not null,
  title text not null,
  content text, -- HTML from the entry editor (bold/italic/images/code blocks)
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists diary_entries_user_id_entry_date_idx on diary_entries (user_id, entry_date);

-- Editor support: thumbnail + curated per-entry font.
alter table diary_entries add column if not exists thumbnail_path text;
alter table diary_entries add column if not exists font text not null default 'sans';
alter table diary_entries drop constraint if exists diary_entries_font_check;
alter table diary_entries add constraint diary_entries_font_check
  check (font in ('sans','serif','handwritten','typewriter'));

create table if not exists custom_foods (
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

-- Quantity-in-natural-units support (e.g. "2 eggs" instead of "100g").
alter table custom_foods add column if not exists unit text not null default 'g';
alter table custom_foods add column if not exists grams_per_unit numeric not null default 1;

create table if not exists food_logs (
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
create index if not exists food_logs_user_id_log_date_idx on food_logs (user_id, log_date);

-- Row Level Security: identical select/insert/update/delete-own-row pattern
-- on every table. user_id defaults to auth.uid() so clients never send it
-- explicitly; the `with check` still blocks it from being spoofed.

alter table profile enable row level security;
drop policy if exists "select_own" on profile;
drop policy if exists "insert_own" on profile;
drop policy if exists "update_own" on profile;
drop policy if exists "delete_own" on profile;
create policy "select_own" on profile for select using (auth.uid() = user_id);
create policy "insert_own" on profile for insert with check (auth.uid() = user_id);
create policy "update_own" on profile for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on profile for delete using (auth.uid() = user_id);

alter table diary_entries enable row level security;
drop policy if exists "select_own" on diary_entries;
drop policy if exists "insert_own" on diary_entries;
drop policy if exists "update_own" on diary_entries;
drop policy if exists "delete_own" on diary_entries;
create policy "select_own" on diary_entries for select using (auth.uid() = user_id);
create policy "insert_own" on diary_entries for insert with check (auth.uid() = user_id);
create policy "update_own" on diary_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on diary_entries for delete using (auth.uid() = user_id);

alter table custom_foods enable row level security;
drop policy if exists "select_own" on custom_foods;
drop policy if exists "insert_own" on custom_foods;
drop policy if exists "update_own" on custom_foods;
drop policy if exists "delete_own" on custom_foods;
create policy "select_own" on custom_foods for select using (auth.uid() = user_id);
create policy "insert_own" on custom_foods for insert with check (auth.uid() = user_id);
create policy "update_own" on custom_foods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on custom_foods for delete using (auth.uid() = user_id);

alter table food_logs enable row level security;
drop policy if exists "select_own" on food_logs;
drop policy if exists "insert_own" on food_logs;
drop policy if exists "update_own" on food_logs;
drop policy if exists "delete_own" on food_logs;
create policy "select_own" on food_logs for select using (auth.uid() = user_id);
create policy "insert_own" on food_logs for insert with check (auth.uid() = user_id);
create policy "update_own" on food_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own" on food_logs for delete using (auth.uid() = user_id);

-- Storage bucket for entry thumbnails + inline content images. Private (not
-- public) — every image is served through a short-lived signed URL, scoped
-- to the owner by folder: objects are stored at "<user_id>/<filename>", and
-- the policies below check that the first path segment matches auth.uid().

insert into storage.buckets (id, name, public)
values ('diary-images', 'diary-images', false)
on conflict (id) do nothing;

drop policy if exists "select_own_diary_images" on storage.objects;
drop policy if exists "insert_own_diary_images" on storage.objects;
drop policy if exists "delete_own_diary_images" on storage.objects;
create policy "select_own_diary_images" on storage.objects for select
  using (bucket_id = 'diary-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "insert_own_diary_images" on storage.objects for insert
  with check (bucket_id = 'diary-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "delete_own_diary_images" on storage.objects for delete
  using (bucket_id = 'diary-images' and auth.uid()::text = (storage.foldername(name))[1]);
