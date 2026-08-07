create table if not exists public.room_locations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '',
  background_audio_track_id uuid,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms
  add column if not exists current_location_id uuid references public.room_locations(id) on delete set null;

create table if not exists public.room_shared_notes (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  content text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.room_locations enable row level security;
alter table public.room_shared_notes enable row level security;

create or replace function public.is_room_member(check_room_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = check_room_id and user_id = auth.uid()
  );
$$;

drop policy if exists "Room members can manage locations" on public.room_locations;
create policy "Room members can manage locations"
on public.room_locations for all to authenticated
using (public.is_room_member(room_id))
with check (public.is_room_member(room_id));

drop policy if exists "Room members can manage shared notes" on public.room_shared_notes;
create policy "Room members can manage shared notes"
on public.room_shared_notes for all to authenticated
using (public.is_room_member(room_id))
with check (public.is_room_member(room_id));

grant select, insert, update, delete on public.room_locations to authenticated;
grant select, insert, update on public.room_shared_notes to authenticated;

create or replace function public.set_room_current_location(target_room_id uuid, target_location_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_member(target_room_id) then
    raise exception 'not a room member';
  end if;
  if not exists (
    select 1 from public.room_locations
    where id = target_location_id and room_id = target_room_id
  ) then
    raise exception 'invalid room location';
  end if;
  update public.rooms set current_location_id = target_location_id where id = target_room_id;
end;
$$;

grant execute on function public.set_room_current_location(uuid, uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.room_locations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_shared_notes;
exception when duplicate_object then null;
end $$;
