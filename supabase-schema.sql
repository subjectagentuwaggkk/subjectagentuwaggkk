create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  age integer not null check (age between 6 and 120),
  height numeric(5, 1) not null check (height between 80 and 250),
  weight numeric(5, 1) not null check (weight between 10 and 300),
  baseline_daily_mg integer not null default 0 check (baseline_daily_mg between 0 and 3000),
  detox_start_date date not null default current_date,
  recovery_phrase_hash text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists recovery_phrase_hash text;

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select on public.forum_posts, public.forum_comments to anon, authenticated;
grant insert, delete on public.forum_posts to authenticated;
grant insert on public.forum_comments to authenticated;

create policy "Members can read profiles" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Members can create own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "Members can update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Anyone can read forum posts" on public.forum_posts
  for select to anon, authenticated using (true);
create policy "Members can create their own posts" on public.forum_posts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Members can delete their own posts" on public.forum_posts
  for delete to authenticated using (auth.uid() = user_id);

create policy "Anyone can read forum comments" on public.forum_comments
  for select to anon, authenticated using (true);
create policy "Members can create their own comments" on public.forum_comments
  for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.find_account_emails_by_recovery(p_display_name text, p_recovery_phrase_hash text)
returns table(email text)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select users.email::text
  from auth.users as users
  join public.profiles as member_profiles on member_profiles.id = users.id
  where lower(btrim(member_profiles.display_name)) = lower(btrim(p_display_name))
    and member_profiles.recovery_phrase_hash = p_recovery_phrase_hash;
$$;

revoke all on function public.find_account_emails_by_recovery(text, text) from public;
grant execute on function public.find_account_emails_by_recovery(text, text) to anon, authenticated;

alter publication supabase_realtime add table public.forum_posts;
alter publication supabase_realtime add table public.forum_comments;
