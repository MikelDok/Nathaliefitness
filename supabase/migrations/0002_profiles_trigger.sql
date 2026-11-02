-- ============================================================
-- 0002 — Crear la ficha (profiles) automáticamente al registrar
-- un usuario. Sin esto, un usuario nuevo podría entrar sin perfil.
-- Ejecutar en SQL Editor DESPUÉS de 0001 y ANTES de crear usuarios.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'client',                                   -- por defecto cliente
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)             -- si no hay nombre, usa el del correo
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nota: para convertir a alguien en entrenadora, tras crear su usuario
-- cambia su fila en la tabla profiles: role = 'coach'.
