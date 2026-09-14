-- 기존에 room_background_audio에 직접 등록한 음원을 관리자 카탈로그로 이관합니다.
with existing_audio as (
  select distinct on (rba.audio_url)
    rba.audio_url,
    coalesce(nullif(trim(rba.title), ''), '배경음') as title,
    case
      when position('/idea-uploads/' in rba.audio_url) > 0
        then split_part(rba.audio_url, '/idea-uploads/', 2)
      else 'bgm/imported-' || md5(rba.audio_url) || '.mp3'
    end as storage_path,
    coalesce(rba.updated_by, rooms.created_by) as created_by
  from public.room_background_audio rba
  join public.rooms on rooms.id = rba.room_id
  where rba.audio_url is not null
    and trim(rba.audio_url) <> ''
  order by rba.audio_url, rba.updated_at desc
)
insert into public.background_audio_tracks (
  title,
  storage_path,
  audio_url,
  file_size,
  mime_type,
  duration_seconds,
  created_by
)
select
  existing_audio.title,
  existing_audio.storage_path,
  existing_audio.audio_url,
  coalesce((storage_objects.metadata ->> 'size')::bigint, 0),
  storage_objects.metadata ->> 'mimetype',
  null,
  existing_audio.created_by
from existing_audio
left join storage.objects storage_objects
  on storage_objects.bucket_id = 'idea-uploads'
  and storage_objects.name = existing_audio.storage_path
where not exists (
  select 1
  from public.background_audio_tracks tracks
  where tracks.audio_url = existing_audio.audio_url
     or tracks.storage_path = existing_audio.storage_path
)
on conflict (storage_path) do nothing;

-- 과거에 같은 URL이 여러 번 등록됐다면 가장 먼저 등록된 음원으로 방 연결을 합칩니다.
with ranked_tracks as (
  select
    id,
    first_value(id) over (partition by audio_url order by created_at, id) as canonical_id,
    row_number() over (partition by audio_url order by created_at, id) as duplicate_order
  from public.background_audio_tracks
)
update public.room_background_audio room_audio
set track_id = ranked_tracks.canonical_id
from ranked_tracks
where ranked_tracks.duplicate_order > 1
  and room_audio.track_id = ranked_tracks.id;

with ranked_tracks as (
  select
    id,
    row_number() over (partition by audio_url order by created_at, id) as duplicate_order
  from public.background_audio_tracks
)
delete from public.background_audio_tracks tracks
using ranked_tracks
where tracks.id = ranked_tracks.id
  and ranked_tracks.duplicate_order > 1;

-- 같은 음원 URL을 중복 등록하지 못하게 합니다.
create unique index if not exists background_audio_tracks_audio_url_idx
  on public.background_audio_tracks(audio_url);

-- 기존 방의 재생 상태는 유지하면서 카탈로그 음원과 연결합니다.
update public.room_background_audio room_audio
set track_id = tracks.id
from public.background_audio_tracks tracks
where room_audio.track_id is null
  and room_audio.audio_url = tracks.audio_url;
