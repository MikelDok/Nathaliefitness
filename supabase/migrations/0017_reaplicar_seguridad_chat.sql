-- ============================================================
-- 0017 — Reaplica la parte de `messages` de la 0010.
-- En producción la 0010 quedó a medias: la tabla existía con la RLS
-- activada pero SIN ninguna policy (nadie podía enviar: 42501) y con
-- todos los permisos para authenticated (sin el revoke de update).
-- Re-ejecutable: si algo ya está, no hace nada.
-- La parte de Storage de la 0010 (bucket chat-media, in_chat_thread y sus
-- policies) no se toca: el diagnóstico la dio por buena.
-- ============================================================

-- ---------- Restricciones e índices de la 0010 (por si faltan) ----------
-- Se añaden NOT VALID: se exigen a los mensajes nuevos sin revisar las
-- filas que ya hubiera, para que la migración no falle por datos viejos.
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.messages'::regclass and conname = 'messages_content_check') then
    alter table public.messages add constraint messages_content_check check (
      (kind = 'text' and body is not null and length(btrim(body)) > 0)
      or (kind in ('image','video') and storage_path is not null)
    ) not valid;
  end if;

  if not exists (select 1 from pg_constraint c
                 join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
                 where c.conrelid = 'public.messages'::regclass and c.contype = 'f' and a.attname = 'client_id') then
    alter table public.messages add constraint messages_client_id_fkey
      foreign key (client_id) references public.profiles(id) on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint c
                 join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
                 where c.conrelid = 'public.messages'::regclass and c.contype = 'f' and a.attname = 'sender_id') then
    alter table public.messages add constraint messages_sender_id_fkey
      foreign key (sender_id) references public.profiles(id) not valid;
  end if;
end $$;

create index if not exists messages_thread_idx on public.messages (client_id, created_at);
create index if not exists messages_unread_idx on public.messages (client_id, sender_id)
  where read_at is null;

alter table public.messages enable row level security;

-- ---------- RLS (idéntica a la 0010) ----------
-- Participantes del hilo: la clienta y su entrenadora (is_coach_of, de 0001).
drop policy if exists "chat select" on public.messages;
create policy "chat select" on public.messages for select
  using (client_id = auth.uid() or is_coach_of(client_id));

drop policy if exists "chat insert" on public.messages;
create policy "chat insert" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (client_id = auth.uid() or is_coach_of(client_id))
  );

-- Marcar como leído: solo el destinatario, nunca quien lo envió.
drop policy if exists "chat mark read" on public.messages;
create policy "chat mark read" on public.messages for update
  using (sender_id <> auth.uid() and (client_id = auth.uid() or is_coach_of(client_id)))
  with check (sender_id <> auth.uid() and (client_id = auth.uid() or is_coach_of(client_id)));

-- Sin policy de delete: los mensajes no se borran (la RLS lo deniega).

-- ---------- Permisos de columna ----------
-- RLS es por fila: sin esto, el destinatario podría reescribir el texto del
-- mensaje recibido. Lo único actualizable es read_at.
revoke update on public.messages from authenticated;
grant  update (read_at) on public.messages to authenticated;

-- ---------- Realtime ----------
-- Solo se añade si no está ya en la publicación.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------- Comprobación (lo que debe salir: 3 policies, update solo en read_at, realtime sí) ----------
select
  (select string_agg(policyname || ' [' || cmd || ']', ', ' order by policyname)
     from pg_policies where schemaname = 'public' and tablename = 'messages')                 as policies,
  (select string_agg(column_name, ', ')
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'messages'
      and grantee = 'authenticated' and privilege_type = 'UPDATE')                          as update_columnas,
  exists (select 1 from information_schema.role_table_grants
           where table_schema = 'public' and table_name = 'messages'
             and grantee = 'authenticated' and privilege_type = 'UPDATE')                   as update_tabla_completa,
  exists (select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') as en_realtime;
