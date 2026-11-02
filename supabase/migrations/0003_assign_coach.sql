-- ============================================================
-- 0003 — Al registrar un cliente, asignarlo automáticamente a la
-- entrenadora (única coach del sistema por ahora). Multi-entrenador
-- con invitaciones se hará más adelante.
-- Ejecutar en SQL Editor DESPUÉS de 0002.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid;
begin
  -- coge la coach existente más antigua (single-tenant)
  select id into v_coach
  from public.profiles
  where role = 'coach'
  order by created_at
  limit 1;

  insert into public.profiles (id, role, full_name, coach_id)
  values (
    new.id,
    'client',
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    v_coach
  );
  return new;
end;
$$;

-- El trigger on_auth_user_created ya existe (0002) y usa esta función.
