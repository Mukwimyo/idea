create table if not exists public.room_audio_playlists (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  shuffle_enabled boolean not null default false,
  repeat_mode text not null default 'all' check (repeat_mode in ('none', 'all', 'one')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.room_audio_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.room_audio_playlists(id) on delete cascade,
  track_id uuid not null references public.background_audio_tracks(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (playlist_id, track_id)
);

alter table public.room_background_audio
  add column if not exists playlist_id uuid references public.room_audio_playlists(id) on delete set null,
  add column if not exists playlist_item_id uuid references public.room_audio_playlist_items(id) on delete set null;

alter table public.room_locations
  add column if not exists background_audio_playlist_id uuid references public.room_audio_playlists(id) on delete set null;

alter table public.room_audio_playlists enable row level security;
alter table public.room_audio_playlist_items enable row level security;

drop policy if exists "Authenticated users can view audio catalog" on public.background_audio_tracks;
create policy "Authenticated users can view audio catalog"
on public.background_audio_tracks for select to authenticated
using (true);

drop policy if exists "Room members can manage audio playlists" on public.room_audio_playlists;
create policy "Room members can manage audio playlists"
on public.room_audio_playlists for all to authenticated
using (public.is_room_member(room_id))
with check (public.is_room_member(room_id));

drop policy if exists "Room members can manage audio playlist items" on public.room_audio_playlist_items;
create policy "Room members can manage audio playlist items"
on public.room_audio_playlist_items for all to authenticated
using (
  exists (
    select 1 from public.room_audio_playlists playlists
    where playlists.id = room_audio_playlist_items.playlist_id and public.is_room_member(playlists.room_id)
  )
)
with check (
  exists (
    select 1 from public.room_audio_playlists playlists
    where playlists.id = room_audio_playlist_items.playlist_id and public.is_room_member(playlists.room_id)
  )
);

grant select on public.background_audio_tracks to authenticated;
grant select, insert, update, delete on public.room_audio_playlists to authenticated;
grant select, insert, update, delete on public.room_audio_playlist_items to authenticated;

create or replace function public.play_room_playlist_item(target_room_id uuid, target_playlist_item_id uuid, start_playing boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_item record;
begin
  if not public.is_room_member(target_room_id) then raise exception 'not a room member'; end if;
  select items.id item_id, items.playlist_id, tracks.id track_id, tracks.title, tracks.audio_url
  into selected_item
  from public.room_audio_playlist_items items
  join public.room_audio_playlists playlists on playlists.id = items.playlist_id
  join public.background_audio_tracks tracks on tracks.id = items.track_id
  where items.id = target_playlist_item_id and playlists.room_id = target_room_id;
  if not found then raise exception 'playlist item not found'; end if;

  insert into public.room_background_audio (
    room_id, track_id, audio_url, title, playlist_id, playlist_item_id,
    is_playing, position_seconds, started_at, updated_by
  ) values (
    target_room_id, selected_item.track_id, selected_item.audio_url, selected_item.title,
    selected_item.playlist_id, selected_item.item_id, start_playing, 0,
    case when start_playing then now() else null end, auth.uid()
  )
  on conflict (room_id) do update set
    track_id = excluded.track_id, audio_url = excluded.audio_url, title = excluded.title,
    playlist_id = excluded.playlist_id, playlist_item_id = excluded.playlist_item_id,
    is_playing = excluded.is_playing, position_seconds = 0,
    started_at = excluded.started_at, updated_by = auth.uid();
end;
$$;

create or replace function public.advance_room_playlist(target_room_id uuid, expected_item_id uuid, direction integer default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  audio_state public.room_background_audio%rowtype;
  playlist_state public.room_audio_playlists%rowtype;
  selected_item_id uuid;
begin
  if not public.is_room_member(target_room_id) then raise exception 'not a room member'; end if;
  perform pg_advisory_xact_lock(hashtext(target_room_id::text));
  select * into audio_state from public.room_background_audio where room_id = target_room_id for update;
  if audio_state.playlist_item_id is distinct from expected_item_id then return; end if;
  select * into playlist_state from public.room_audio_playlists where id = audio_state.playlist_id;
  if not found or playlist_state.repeat_mode = 'one' then
    update public.room_background_audio set position_seconds = 0, started_at = now(), is_playing = true, updated_by = auth.uid() where room_id = target_room_id;
    return;
  end if;

  if playlist_state.shuffle_enabled then
    select id into selected_item_id from public.room_audio_playlist_items
    where playlist_id = playlist_state.id and id <> expected_item_id order by random() limit 1;
  elsif direction < 0 then
    select id into selected_item_id from public.room_audio_playlist_items
    where playlist_id = playlist_state.id and sort_order < (select sort_order from public.room_audio_playlist_items where id = expected_item_id)
    order by sort_order desc limit 1;
  else
    select id into selected_item_id from public.room_audio_playlist_items
    where playlist_id = playlist_state.id and sort_order > (select sort_order from public.room_audio_playlist_items where id = expected_item_id)
    order by sort_order limit 1;
  end if;

  if selected_item_id is null and playlist_state.repeat_mode = 'all' then
    select id into selected_item_id from public.room_audio_playlist_items
    where playlist_id = playlist_state.id
    order by case when direction < 0 then sort_order end desc, sort_order asc limit 1;
  end if;
  if selected_item_id is null then
    update public.room_background_audio set is_playing = false, started_at = null, position_seconds = 0, updated_by = auth.uid() where room_id = target_room_id;
  else
    perform public.play_room_playlist_item(target_room_id, selected_item_id, true);
  end if;
end;
$$;

grant execute on function public.play_room_playlist_item(uuid, uuid, boolean) to authenticated;
grant execute on function public.advance_room_playlist(uuid, uuid, integer) to authenticated;

create or replace function public.set_room_current_location(target_room_id uuid, target_location_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  location_playlist uuid;
  first_item uuid;
begin
  if not public.is_room_member(target_room_id) then raise exception 'not a room member'; end if;
  select background_audio_playlist_id into location_playlist
  from public.room_locations where id = target_location_id and room_id = target_room_id;
  if not found then raise exception 'invalid room location'; end if;
  update public.rooms set current_location_id = target_location_id where id = target_room_id;
  if location_playlist is not null then
    select id into first_item from public.room_audio_playlist_items
    where playlist_id = location_playlist order by sort_order, created_at limit 1;
    if first_item is not null then perform public.play_room_playlist_item(target_room_id, first_item, true); end if;
  end if;
end;
$$;

do $$ begin
  alter publication supabase_realtime add table public.room_audio_playlists;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.room_audio_playlist_items;
exception when duplicate_object then null; end $$;
