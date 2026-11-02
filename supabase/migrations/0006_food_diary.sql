-- ============================================================
-- 0006 — Diario de alimentos (para el lector de código de barras
-- y el registro de comidas). Ejecutar en SQL Editor.
-- ============================================================

create table if not exists food_diary (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references profiles(id),
  eaten_on date not null default current_date,
  name text not null,
  grams numeric(7,1),
  kcal int not null default 0,
  protein_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  barcode text,                -- si vino de un escaneo
  created_at timestamptz not null default now()
);

alter table food_diary enable row level security;

create policy "client own food diary" on food_diary
  for all using (client_id = auth.uid());

create policy "coach reads food diary" on food_diary
  for select using (is_coach_of(client_id));
