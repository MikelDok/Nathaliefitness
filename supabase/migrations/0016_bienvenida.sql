-- 0016 · Bienvenida de la clienta: se recuerda en la base de datos que ya la
-- vio (o la saltó), para que no reaparezca en otro móvil. Re-ejecutable.
-- Las clientas que ya usaban la app la ven una vez: la columna empieza vacía.
alter table public.profiles add column if not exists onboarded_at timestamptz;

-- La clienta puede marcarla. Los permisos de columna de 0012 se amplían, no se
-- sustituyen: sigue sin poder tocar role ni coach_id.
grant update (onboarded_at) on public.profiles to authenticated;
