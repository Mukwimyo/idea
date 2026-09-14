create table if not exists public.idea_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.idea_admin_users enable row level security;

create or replace function public.is_idea_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.idea_admin_users
    where user_id = check_user_id
  );
$$;

revoke all on public.idea_admin_users from anon, authenticated;
grant execute on function public.is_idea_admin(uuid) to authenticated;

create table if not exists public.background_audio_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  storage_path text not null unique,
  audio_url text not null,
  file_size bigint not null default 0 check (file_size >= 0),
  mime_type text,
  duration_seconds double precision check (duration_seconds is null or duration_seconds >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.background_audio_tracks enable row level security;

drop policy if exists "Admins can manage background audio tracks" on public.background_audio_tracks;
create policy "Admins can manage background audio tracks"
on public.background_audio_tracks for all to authenticated
using (public.is_idea_admin())
with check (public.is_idea_admin() and created_by = auth.uid());

grant select, insert, update, delete on public.background_audio_tracks to authenticated;

alter table public.room_background_audio
  add column if not exists track_id uuid references public.background_audio_tracks(id) on delete set null;

drop policy if exists "Admins can upload IDEA background audio" on storage.objects;
create policy "Admins can upload IDEA background audio"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'idea-uploads'
  and (storage.foldername(name))[1] = 'bgm'
  and public.is_idea_admin()
);

drop policy if exists "Admins can update IDEA background audio" on storage.objects;
create policy "Admins can update IDEA background audio"
on storage.objects for update to authenticated
using (
  bucket_id = 'idea-uploads'
  and (storage.foldername(name))[1] = 'bgm'
  and public.is_idea_admin()
)
with check (
  bucket_id = 'idea-uploads'
  and (storage.foldername(name))[1] = 'bgm'
  and public.is_idea_admin()
);

drop policy if exists "Admins can delete IDEA background audio" on storage.objects;
create policy "Admins can delete IDEA background audio"
on storage.objects for delete to authenticated
using (
  bucket_id = 'idea-uploads'
  and (storage.foldername(name))[1] = 'bgm'
  and public.is_idea_admin()
);

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, storage, auth, pg_catalog
as $$
declare
  result jsonb;
begin
  if not public.is_idea_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'rooms', (select count(*) from public.rooms),
    'messages', (select count(*) from public.messages where is_deleted = false),
    'tracks', (select count(*) from public.background_audio_tracks),
    'database_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((
      select sum(coalesce((metadata ->> 'size')::bigint, 0))
      from storage.objects
      where bucket_id = 'idea-uploads'
    ), 0)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to authenticated;

create or replace function public.admin_list_rooms()
returns table (
  room_id uuid,
  room_name text,
  owner_id uuid,
  created_at timestamptz,
  member_count bigint,
  message_count bigint,
  track_id uuid,
  track_title text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_idea_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.name::text,
    r.created_by,
    r.created_at,
    (select count(*) from public.room_members rm where rm.room_id = r.id),
    (select count(*) from public.messages m where m.room_id = r.id and m.is_deleted = false),
    rba.track_id,
    coalesce(bat.title, rba.title)::text
  from public.rooms r
  left join public.room_background_audio rba on rba.room_id = r.id
  left join public.background_audio_tracks bat on bat.id = rba.track_id
  order by r.created_at desc;
end;
$$;

revoke all on function public.admin_list_rooms() from public;
grant execute on function public.admin_list_rooms() to authenticated;

create or replace function public.admin_assign_room_background_audio(target_room_id uuid, target_track_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  selected_track public.background_audio_tracks%rowtype;
begin
  if not public.is_idea_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if target_track_id is null then
    delete from public.room_background_audio where room_id = target_room_id;
    return;
  end if;

  select * into selected_track
  from public.background_audio_tracks
  where id = target_track_id;

  if not found then
    raise exception 'track not found';
  end if;

  insert into public.room_background_audio (
    room_id, track_id, audio_url, title, is_playing,
    position_seconds, started_at, updated_by
  ) values (
    target_room_id, selected_track.id, selected_track.audio_url, selected_track.title,
    false, 0, null, auth.uid()
  )
  on conflict (room_id) do update set
    track_id = excluded.track_id,
    audio_url = excluded.audio_url,
    title = excluded.title,
    is_playing = false,
    position_seconds = 0,
    started_at = null,
    updated_by = auth.uid();
end;
$$;

revoke all on function public.admin_assign_room_background_audio(uuid, uuid) from public;
grant execute on function public.admin_assign_room_background_audio(uuid, uuid) to authenticated;

create or replace function public.admin_delete_background_audio_track(target_track_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  selected_path text;
begin
  if not public.is_idea_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if exists (select 1 from public.room_background_audio where track_id = target_track_id) then
    raise exception 'track is assigned to a room';
  end if;

  select storage_path into selected_path
  from public.background_audio_tracks
  where id = target_track_id;

  delete from public.background_audio_tracks where id = target_track_id;
  return selected_path;
end;
$$;

revoke all on function public.admin_delete_background_audio_track(uuid) from public;
grant execute on function public.admin_delete_background_audio_track(uuid) to authenticated;
