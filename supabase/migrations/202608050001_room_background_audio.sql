create table if not exists public.room_background_audio (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  audio_url text not null,
  title text not null default '배경음',
  is_playing boolean not null default false,
  position_seconds double precision not null default 0 check (position_seconds >= 0),
  started_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_room_background_audio_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists room_background_audio_updated_at on public.room_background_audio;
create trigger room_background_audio_updated_at
before update on public.room_background_audio
for each row execute function public.touch_room_background_audio_updated_at();

alter table public.room_background_audio enable row level security;

drop policy if exists "Room members can view shared background audio" on public.room_background_audio;
create policy "Room members can view shared background audio"
on public.room_background_audio for select to authenticated
using (
  exists (
    select 1 from public.room_members
    where room_members.room_id = room_background_audio.room_id
      and room_members.user_id = auth.uid()
  )
);

drop policy if exists "Room members can control shared background audio" on public.room_background_audio;
create policy "Room members can control shared background audio"
on public.room_background_audio for update to authenticated
using (
  exists (
    select 1 from public.room_members
    where room_members.room_id = room_background_audio.room_id
      and room_members.user_id = auth.uid()
  )
)
with check (
  updated_by = auth.uid()
  and exists (
    select 1 from public.room_members
    where room_members.room_id = room_background_audio.room_id
      and room_members.user_id = auth.uid()
  )
);

revoke insert, update on public.room_background_audio from authenticated;
grant select on public.room_background_audio to authenticated;
grant update (is_playing, position_seconds, started_at, updated_by) on public.room_background_audio to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.room_background_audio;
exception
  when duplicate_object then null;
end $$;
