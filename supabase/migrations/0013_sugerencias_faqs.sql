-- ============================================================
-- 0013 — Buzón de sugerencias (clienta → coach) y FAQs (coach → clientas)
-- Re-ejecutable. Ejecutar en el SQL Editor de Supabase.
-- No inserta contenido: las FAQs las escribe la entrenadora.
-- ============================================================

-- ---------- 1. Sugerencias ----------
create table if not exists suggestions (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in ('fallo', 'idea', 'otro')),
  body        text not null check (length(btrim(body)) between 1 and 1000),
  screen      text check (screen is null or length(screen) <= 100),
  status      text not null default 'recibida' check (status in ('recibida', 'leida', 'hecha')),
  coach_reply text check (coach_reply is null or length(coach_reply) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists suggestions_client_idx on suggestions (client_id, created_at desc);
create index if not exists suggestions_new_idx on suggestions (client_id) where status = 'recibida';

alter table suggestions enable row level security;

-- La clienta crea y lee las suyas; no hay policy de update ni de delete para ella.
drop policy if exists "client inserts own suggestions" on suggestions;
create policy "client inserts own suggestions" on suggestions
  for insert with check (client_id = auth.uid());

drop policy if exists "client reads own suggestions" on suggestions;
create policy "client reads own suggestions" on suggestions
  for select using (client_id = auth.uid());

-- La coach lee y actualiza las de sus clientas (no las borra: es el histórico del piloto).
drop policy if exists "coach reads client suggestions" on suggestions;
create policy "coach reads client suggestions" on suggestions
  for select using (is_coach_of(client_id));

drop policy if exists "coach updates client suggestions" on suggestions;
create policy "coach updates client suggestions" on suggestions
  for update using (is_coach_of(client_id)) with check (is_coach_of(client_id));

-- Permisos de columna (RLS filtra filas, no columnas):
--  - al crear, solo se rellenan tipo, texto y pantalla; status y coach_reply
--    toman su valor por defecto y la clienta no puede fijarlos;
--  - al actualizar, solo cambian status y coach_reply (y solo la coach,
--    porque es la única con policy de update).
revoke insert, update on public.suggestions from authenticated;
grant  insert (client_id, kind, body, screen) on public.suggestions to authenticated;
grant  update (status, coach_reply)           on public.suggestions to authenticated;

-- updated_at automático (el trigger no depende de los permisos de columna)
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists suggestions_touch on suggestions;
create trigger suggestions_touch before update on suggestions
  for each row execute function touch_updated_at();

-- ---------- 2. FAQs ----------
create table if not exists faqs (
  id         uuid primary key default uuid_generate_v4(),
  coach_id   uuid not null references profiles(id) on delete cascade,
  question   text not null check (length(btrim(question)) between 1 and 300),
  answer     text not null check (length(btrim(answer)) between 1 and 3000),
  position   int  not null default 0,
  published  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists faqs_coach_idx on faqs (coach_id, position);

alter table faqs enable row level security;

drop policy if exists "coach manages faqs" on faqs;
create policy "coach manages faqs" on faqs
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- Mismo patrón que exercises: la clienta lee las de su coach, solo publicadas.
drop policy if exists "clients read published faqs" on faqs;
create policy "clients read published faqs" on faqs
  for select using (
    published and coach_id = (select coach_id from profiles where id = auth.uid())
  );
