-- Reconstructed baseline for the legacy IDEA project.
-- All objects use IF NOT EXISTS so this file is a no-op for the existing
-- production database while making a fresh migration run reproducible.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default timezone('utc', now()),
  theme_id text default 'dark-purple',
  font_id text default 'sans',
  last_char_id uuid,
  show_avatar boolean default true,
  show_entering boolean default true
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text default '#AFA9EC',
  text_color text default '#26215C',
  avatar_letter text,
  created_at timestamptz default timezone('utc', now()),
  image_url text,
  is_archived boolean default false
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chapter text default '1화',
  created_by uuid references auth.users(id) on delete set null,
  invite_code text unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz default timezone('utc', now()),
  read_receipt_style text default 'text',
  shared_theme_id text default 'dark-purple',
  theme_follow boolean default true,
  action_style text default 'dim',
  show_entering boolean default true,
  show_edited_label boolean default true,
  cover_image text
);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default timezone('utc', now()),
  last_char_id uuid,
  is_typing boolean default false,
  typing_char_name text
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  type text default 'chat',
  content text,
  children jsonb,
  edited boolean default false,
  created_at timestamptz default timezone('utc', now()),
  read_by text[] default '{}'::text[],
  is_deleted boolean default false
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('character', 'room')),
  room_id uuid references public.rooms(id) on delete cascade
);

create table if not exists public.character_groups (
  character_id uuid not null references public.characters(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (character_id, group_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);

create index if not exists messages_room_created_idx
  on public.messages(room_id, created_at);
create index if not exists room_members_user_room_idx
  on public.room_members(user_id, room_id);
create index if not exists characters_user_created_idx
  on public.characters(user_id, created_at);
create index if not exists bookmarks_user_created_idx
  on public.bookmarks(user_id, created_at desc);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.characters to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.room_members to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.bookmarks to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, delete on public.character_groups to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

insert into storage.buckets (id, name, public)
values ('idea-uploads', 'idea-uploads', true)
on conflict (id) do nothing;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null;
end $$;
