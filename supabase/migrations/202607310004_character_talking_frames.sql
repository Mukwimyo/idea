alter table public.room_members
  add column if not exists typing_character_id uuid references public.characters(id) on delete set null;

create table if not exists public.character_talking_frames (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists character_talking_frames_character_order_idx
  on public.character_talking_frames(character_id, sort_order, created_at);

alter table public.character_talking_frames enable row level security;

drop policy if exists "Authenticated users can view talking frames" on public.character_talking_frames;
create policy "Authenticated users can view talking frames"
on public.character_talking_frames for select to authenticated
using (true);

drop policy if exists "Users can add their character talking frames" on public.character_talking_frames;
create policy "Users can add their character talking frames"
on public.character_talking_frames for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.characters
    where characters.id = character_talking_frames.character_id
      and characters.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their character talking frames" on public.character_talking_frames;
create policy "Users can update their character talking frames"
on public.character_talking_frames for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their character talking frames" on public.character_talking_frames;
create policy "Users can delete their character talking frames"
on public.character_talking_frames for delete to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.character_talking_frames to authenticated;

update public.room_members
set typing_character_id = null
where is_typing = false;
