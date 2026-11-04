-- ============================================================
-- 0012 — Ajustes del piloto:
--   1. Notas privadas de la coach por clienta (tabla client_notes)
--   2. Objetivos y objetivo de agua editables por la clienta
--      (+ cierre de permisos de columna en profiles)
--   3. Registro de agua diario (water_logs)
--   4. Ejercicios ocultos en un programa (program_exercises.hidden)
-- Re-ejecutable. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ---------- 1. Notas de la coach ----------
-- Tabla aparte y no columna en profiles: los permisos de columna son por
-- rol de Postgres y la clienta y la coach comparten rol (authenticated);
-- la clienta lee su propia fila de profiles, así que vería la nota.
create table if not exists client_notes (
  client_id  uuid primary key references profiles(id) on delete cascade,
  body       text not null default '',
  updated_at timestamptz not null default now()
);

alter table client_notes enable row level security;

-- Solo la coach de la clienta. La clienta no tiene ninguna policy:
-- no puede leer ni escribir sus notas.
drop policy if exists "coach manages client notes" on client_notes;
create policy "coach manages client notes" on client_notes
  for all using (is_coach_of(client_id))
  with check (is_coach_of(client_id));

-- ---------- 2. Perfil: objetivo de agua + permisos de columna ----------
alter table profiles add column if not exists water_goal_ml int not null default 2000;

do $$
begin
  alter table profiles add constraint profiles_water_goal_check
    check (water_goal_ml between 500 and 6000);
exception
  when duplicate_object then null;  -- ya existía
end $$;

-- La policy de 0001 permitía a la clienta cambiar CUALQUIER columna de su
-- fila (también role y coach_id). RLS filtra filas, no columnas: con
-- permisos de columna, solo son editables los datos personales.
revoke update on public.profiles from authenticated;
grant  update (full_name, avatar_url, goals, dietary_prefs, water_goal_ml)
  on public.profiles to authenticated;

drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- 3. Registro de agua ----------
create table if not exists water_logs (
  client_id uuid not null references profiles(id) on delete cascade,
  logged_on date not null default current_date,
  ml        int  not null default 0 check (ml between 0 and 20000),
  primary key (client_id, logged_on)
);

alter table water_logs enable row level security;

-- Igual que habit_logs: la clienta gestiona lo suyo, la coach lo lee.
drop policy if exists "client own water_logs" on water_logs;
create policy "client own water_logs" on water_logs
  for all using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "coach reads water_logs" on water_logs;
create policy "coach reads water_logs" on water_logs
  for select using (is_coach_of(client_id));

-- ---------- 4. Ejercicios ocultos ----------
-- Ocultar es una decisión de presentación: la fila sigue siendo legible
-- para la clienta (así los registros antiguos conservan el nombre en
-- Progreso); la app filtra hidden = false en Entreno.
alter table program_exercises add column if not exists hidden boolean not null default false;
