-- ============================================================
-- 0011 — Agenda: citas entre clienta y entrenadora, y planificación
-- de los entrenos del programa en días reales del calendario.
-- Mismo patrón de hilo que el chat: client_id identifica la relación.
-- Ejecutar en SQL Editor DESPUÉS de 0010.
-- ============================================================

-- ---------- (A) Citas ----------
create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references profiles(id) on delete cascade, -- el hilo
  created_by uuid not null references profiles(id),
  title text not null,
  kind text not null default 'presencial'
    check (kind in ('presencial','videollamada','otro')),
  starts_at timestamptz not null,          -- en UTC; el navegador la pinta en local
  duration_min int not null default 60 check (duration_min between 5 and 480),
  location text,                           -- sitio, o enlace de la videollamada
  note text,
  status text not null default 'confirmada'
    check (status in ('confirmada','cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Aviso de "nueva o cambiada". Aquí ambas partes crean y editan, así que
  -- cada una necesita su propio visto: quien toca la cita marca el suyo y
  -- deja el de la otra en null, que es lo que enciende el aviso.
  seen_by_client_at timestamptz,
  seen_by_coach_at timestamptz
);

create index if not exists appointments_client_idx on appointments (client_id, starts_at);

alter table appointments enable row level security;

-- Participantes: la clienta del hilo y su entrenadora.
drop policy if exists "appointments select" on appointments;
create policy "appointments select" on appointments for select
  using (client_id = auth.uid() or is_coach_of(client_id));

drop policy if exists "appointments insert" on appointments;
create policy "appointments insert" on appointments for insert
  with check (
    created_by = auth.uid()
    and (client_id = auth.uid() or is_coach_of(client_id))
  );

-- Las dos partes pueden editar y cancelar; por eso aquí no hacen falta
-- permisos de columna como en messages.
drop policy if exists "appointments update" on appointments;
create policy "appointments update" on appointments for update
  using (client_id = auth.uid() or is_coach_of(client_id))
  with check (client_id = auth.uid() or is_coach_of(client_id));

-- Sin policy de delete a propósito: cancelar es status = 'cancelada',
-- para que quede constancia.

-- ---------- (B) Planificación de entrenos ----------
-- La posición en weekdays ES el número de día del programa:
-- {1,3,5} => Día 1 lunes, Día 2 miércoles, Día 3 viernes (ISO: 1=lunes).
-- Con starts_on basta para calcular qué sesión cae en cada fecha, sin
-- guardar una fila por sesión. Si están a null, la app se comporta
-- exactamente como antes de esta migración.
alter table programs add column if not exists starts_on date;
alter table programs add column if not exists weekdays smallint[];

alter table programs drop constraint if exists programs_weekdays_check;
alter table programs add constraint programs_weekdays_check check (
  weekdays is null
  or (cardinality(weekdays) between 1 and 7
      and weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
);
