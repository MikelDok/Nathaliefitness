-- ============================================================
-- 0008 — Programa activo por clienta.
-- Cada clienta tiene como mucho UN programa activo: es el que ve en
-- su pestaña Entreno. La entrenadora lo marca desde /coach/programas.
-- Ejecutar en SQL Editor DESPUÉS de 0007.
-- ============================================================

-- ---------- Columna ----------
alter table programs
  add column if not exists is_active boolean not null default false;

-- Una plantilla (client_id null) nunca puede estar activa.
alter table programs drop constraint if exists programs_active_needs_client;
alter table programs add constraint programs_active_needs_client
  check (client_id is not null or not is_active);

-- Como mucho un activo por clienta. Lo garantiza la base de datos, no
-- la app: índice único parcial, solo indexa las filas activas.
create unique index if not exists programs_one_active_per_client
  on programs (client_id) where is_active;

-- ---------- Backfill ----------
-- El programa más reciente de cada clienta pasa a ser el activo, para
-- que el comportamiento de hoy (mostrar el último) no cambie al migrar.
update programs p
   set is_active = true
 where p.client_id is not null
   and not p.is_template
   and p.id = (
     select p2.id from programs p2
      where p2.client_id = p.client_id and not p2.is_template
      order by p2.created_at desc, p2.id desc
      limit 1
   );

-- ---------- Activar un programa (atómico) ----------
-- Desactiva los demás de esa clienta y activa este dentro de una sola
-- transacción: nunca queda la clienta sin programa activo a medias.
-- SECURITY INVOKER (el modo por defecto, no definer): se ejecuta con
-- las policies de quien llama, así que la entrenadora solo puede
-- activar programas suyos (coach_id = auth.uid()).
create or replace function public.set_active_program(p_program_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_client uuid;
begin
  select client_id into v_client
    from programs
   where id = p_program_id and not is_template;

  if v_client is null then
    raise exception 'Programa no encontrado o sin clienta asignada.';
  end if;

  update programs
     set is_active = false
   where client_id = v_client and is_active and id <> p_program_id;

  update programs
     set is_active = true
   where id = p_program_id;

  -- Si la RLS no deja escribir (p. ej. lo llama una clienta), el update
  -- afecta a 0 filas: mejor un error claro que un fallo silencioso.
  if not found then
    raise exception 'No tienes permiso para activar este programa.';
  end if;
end;
$$;

grant execute on function public.set_active_program(uuid) to authenticated;
