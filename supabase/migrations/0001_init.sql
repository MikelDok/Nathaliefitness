-- ============================================================
-- FitCoach — esquema inicial
-- Diseñado para 1 entrenadora HOY, multi-coach MAÑANA:
-- todas las tablas de negocio cuelgan de coach_id.
-- Seguridad: RLS activado en todo. Principio de mínimo acceso.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- Identidad ----------
-- profiles extiende auth.users (Supabase Auth)
create type user_role as enum ('coach', 'client');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  coach_id uuid references profiles(id), -- para clientes: su entrenadora
  full_name text not null,
  avatar_url text,
  goals text,
  dietary_prefs text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Captación ----------
create table leads (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references profiles(id),
  name text not null,
  email text not null,
  phone text,
  quiz_answers jsonb,            -- respuestas del cuestionario público
  source text,                   -- landing | instagram | referido...
  status text not null default 'new', -- new | contacted | call_booked | won | lost
  created_at timestamptz not null default now()
);

-- ---------- Entrenamiento ----------
create table exercises (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references profiles(id),
  name text not null,
  muscle_group text not null,          -- Cuádriceps, Espalda...
  video_url text,                      -- YouTube/Vimeo no listado (0 € storage)
  instructions text,
  created_at timestamptz not null default now()
);

create table programs (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references profiles(id),
  client_id uuid references profiles(id), -- null => plantilla reutilizable
  title text not null,
  weeks int not null default 4,
  days_per_week int not null default 3,
  is_template boolean not null default false,
  notes text,                          -- "Método": texto educativo del programa
  created_at timestamptz not null default now()
);

create table program_exercises (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references programs(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  week int not null,                   -- 1..weeks
  day int not null,                    -- 1..days_per_week
  position int not null,               -- orden en la sesión
  set_scheme text not null,            -- "8/8/6", "3x12"...
  set_type text default 'normal',      -- normal | superset | dropset | warmup | cardio
  rest_seconds int,
  coach_notes text
);

create table exercise_logs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references profiles(id),
  program_exercise_id uuid not null references program_exercises(id),
  performed_at date not null default current_date,
  sets jsonb not null,                 -- [{reps: 8, weight_kg: 30}, ...]
  note text,
  created_at timestamptz not null default now()
);

-- ---------- Progreso ----------
create table measurements (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references profiles(id),
  measured_at date not null default current_date,
  weight_kg numeric(5,1),
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  chest_cm numeric(5,1),
  shoulders_cm numeric(5,1),
  legs_cm numeric(5,1),
  unique (client_id, measured_at)
);

create table progress_photos (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references profiles(id),
  taken_at date not null default current_date,
  angle text not null check (angle in ('front','side','back')),
  storage_path text not null,          -- bucket privado 'progress-photos'
  shared_with_coach boolean not null default false, -- consentimiento explícito
  created_at timestamptz not null default now()
);

-- ---------- Check-ins ----------
create table check_ins (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references profiles(id),
  week_start date not null,
  energy int check (energy between 1 and 5),
  sleep int check (sleep between 1 and 5),
  hunger int check (hunger between 1 and 5),
  stress int check (stress between 1 and 5),
  training_feel int check (training_feel between 1 and 5),
  difficulties text,
  comments text,
  coach_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, week_start)
);

-- ---------- Nutrición (V1) ----------
create table meal_plans (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references profiles(id),
  client_id uuid references profiles(id), -- null => plantilla
  title text not null,
  kcal_target int, protein_g int, fat_g int, carbs_g int,
  created_at timestamptz not null default now()
);

create table meals (
  id uuid primary key default uuid_generate_v4(),
  meal_plan_id uuid not null references meal_plans(id) on delete cascade,
  day int not null,                    -- 1..7
  slot text not null,                  -- desayuno | almuerzo | snack1...
  name text not null,
  photo_url text,
  prep_minutes int,
  kcal int, protein_g int, fat_g int, carbs_g int,
  ingredients jsonb,                   -- [{name, qty, unit}]
  instructions text
);

-- ---------- Hábitos (V1) ----------
create table habits (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references profiles(id),
  title text not null,                 -- "10k pasos", "2L agua"
  active boolean not null default true
);

create table habit_logs (
  habit_id uuid not null references habits(id) on delete cascade,
  logged_on date not null default current_date,
  done boolean not null default true,
  primary key (habit_id, logged_on)
);

-- ============================================================
-- RLS — mínimo acceso
-- ============================================================
alter table profiles enable row level security;
alter table leads enable row level security;
alter table exercises enable row level security;
alter table programs enable row level security;
alter table program_exercises enable row level security;
alter table exercise_logs enable row level security;
alter table measurements enable row level security;
alter table progress_photos enable row level security;
alter table check_ins enable row level security;
alter table meal_plans enable row level security;
alter table meals enable row level security;
alter table habits enable row level security;
alter table habit_logs enable row level security;

create or replace function is_coach_of(target uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from profiles p
    where p.id = target and p.coach_id = auth.uid()
  );
$$;

-- Perfiles: yo mismo; la coach ve a sus clientes
create policy "own profile" on profiles for select using (id = auth.uid());
create policy "coach reads clients" on profiles for select using (coach_id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid());

-- Leads: solo la coach dueña
create policy "coach leads" on leads for all using (coach_id = auth.uid());

-- Catálogo de la coach: dueña gestiona; clientes leen lo de SU coach
create policy "coach manages exercises" on exercises for all using (coach_id = auth.uid());
create policy "clients read coach exercises" on exercises for select
  using (coach_id = (select coach_id from profiles where id = auth.uid()));

create policy "coach manages programs" on programs for all using (coach_id = auth.uid());
create policy "client reads own program" on programs for select using (client_id = auth.uid());

create policy "coach manages program_exercises" on program_exercises for all
  using (exists (select 1 from programs pr where pr.id = program_id and pr.coach_id = auth.uid()));
create policy "client reads own program_exercises" on program_exercises for select
  using (exists (select 1 from programs pr where pr.id = program_id and pr.client_id = auth.uid()));

-- Datos del cliente: el cliente escribe lo suyo; la coach lo lee
create policy "client own logs" on exercise_logs for all using (client_id = auth.uid());
create policy "coach reads logs" on exercise_logs for select using (is_coach_of(client_id));

create policy "client own measurements" on measurements for all using (client_id = auth.uid());
create policy "coach reads measurements" on measurements for select using (is_coach_of(client_id));

-- Fotos: la coach SOLO si el cliente marcó shared_with_coach (consentimiento)
create policy "client own photos" on progress_photos for all using (client_id = auth.uid());
create policy "coach reads shared photos" on progress_photos for select
  using (is_coach_of(client_id) and shared_with_coach);

create policy "client own checkins" on check_ins for all using (client_id = auth.uid());
create policy "coach reads checkins" on check_ins for select using (is_coach_of(client_id));
create policy "coach replies checkins" on check_ins for update using (is_coach_of(client_id));

create policy "coach manages meal_plans" on meal_plans for all using (coach_id = auth.uid());
create policy "client reads own meal_plan" on meal_plans for select using (client_id = auth.uid());
create policy "coach manages meals" on meals for all
  using (exists (select 1 from meal_plans mp where mp.id = meal_plan_id and mp.coach_id = auth.uid()));
create policy "client reads own meals" on meals for select
  using (exists (select 1 from meal_plans mp where mp.id = meal_plan_id and mp.client_id = auth.uid()));

create policy "client own habits" on habits for all using (client_id = auth.uid());
create policy "coach reads habits" on habits for select using (is_coach_of(client_id));
create policy "client own habit_logs" on habit_logs for all
  using (exists (select 1 from habits h where h.id = habit_id and h.client_id = auth.uid()));
create policy "coach reads habit_logs" on habit_logs for select
  using (exists (select 1 from habits h where h.id = habit_id and is_coach_of(h.client_id)));

-- Storage: crear bucket privado 'progress-photos' desde el dashboard.
-- Política: cada cliente sube/lee solo en carpeta {auth.uid()}/...
