alter table public.communication_sessions
  add column if not exists record_message_id uuid references public.messages(id) on delete set null;

create index if not exists communication_sessions_record_message_idx
  on public.communication_sessions(record_message_id);
