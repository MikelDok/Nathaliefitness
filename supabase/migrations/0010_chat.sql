-- ============================================================
-- 0010 — Chat 1 a 1 entre cada clienta y su entrenadora.
-- El hilo ES la clienta: client_id identifica la conversación (no hay
-- chats entre clientas), así que no hace falta tabla de conversaciones.
-- La coach del hilo se deriva de profiles.coach_id.
-- Ejecutar en SQL Editor DESPUÉS de 0009.
-- ============================================================

-- ---------- Tabla ----------
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references profiles(id) on delete cascade, -- el hilo
  sender_id uuid not null references profiles(id),                   -- quién escribe
  kind text not null default 'text' check (kind in ('text','image','video')),
  body text,                    -- texto del mensaje (o pie de la foto)
  storage_path text,            -- ruta en el bucket privado chat-media
  created_at timestamptz not null default now(),
  read_at timestamptz,          -- null = sin leer por el destinatario
  -- texto => body con contenido; foto/vídeo => fichero en el bucket
  constraint messages_content_check check (
    (kind = 'text' and body is not null and length(btrim(body)) > 0)
    or (kind in ('image','video') and storage_path is not null)
  )
);

create index if not exists messages_thread_idx on messages (client_id, created_at);
create index if not exists messages_unread_idx on messages (client_id, sender_id)
  where read_at is null;

alter table messages enable row level security;

-- ---------- RLS ----------
-- Participantes del hilo: la clienta y su entrenadora (is_coach_of, de 0001).
drop policy if exists "chat select" on messages;
create policy "chat select" on messages for select
  using (client_id = auth.uid() or is_coach_of(client_id));

drop policy if exists "chat insert" on messages;
create policy "chat insert" on messages for insert
  with check (
    sender_id = auth.uid()
    and (client_id = auth.uid() or is_coach_of(client_id))
  );

-- Marcar como leído: solo el destinatario, nunca quien lo envió.
drop policy if exists "chat mark read" on messages;
create policy "chat mark read" on messages for update
  using (sender_id <> auth.uid() and (client_id = auth.uid() or is_coach_of(client_id)))
  with check (sender_id <> auth.uid() and (client_id = auth.uid() or is_coach_of(client_id)));

-- RLS es por FILA, no por columna: sin esto, el destinatario podría reescribir
-- el texto del mensaje que ha recibido. Con permisos de columna, lo único
-- actualizable es read_at y el resto del mensaje queda inmutable.
revoke update on public.messages from authenticated;
grant  update (read_at) on public.messages to authenticated;

-- ---------- Realtime ----------
-- Los mensajes nuevos llegan sin recargar. Respeta la RLS de arriba.
do $$
begin
  alter publication supabase_realtime add table messages;
exception
  when duplicate_object then null;  -- ya estaba publicada
end $$;

-- ---------- Storage: bucket privado chat-media ----------
-- Ruta de los ficheros: {client_id}/{timestamp}-{aleatorio}.{ext}
-- La carpeta es el hilo, así que ambas partes leen y escriben en la misma.
-- El límite de 30 MB y los MIME types se aplican en el SERVIDOR: la
-- validación del navegador es para dar buen mensaje, no para hacerla cumplir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media', 'chat-media', false, 31457280,
  array['image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ¿Puede el usuario actual entrar en la carpeta de este fichero?
-- Compara en texto (sin castear a uuid) para que una ruta rara deniegue
-- en vez de reventar con un error de casteo.
create or replace function public.in_chat_thread(object_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id::text = (storage.foldername(object_name))[1]
      and (p.id = auth.uid() or p.coach_id = auth.uid())
  );
$$;

drop policy if exists "chat media read" on storage.objects;
create policy "chat media read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.in_chat_thread(name));

drop policy if exists "chat media upload" on storage.objects;
create policy "chat media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and public.in_chat_thread(name));

-- Borrado: para limpiar el fichero si falla el insert del mensaje.
drop policy if exists "chat media delete" on storage.objects;
create policy "chat media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and public.in_chat_thread(name));
