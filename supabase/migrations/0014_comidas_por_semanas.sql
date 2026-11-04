-- ============================================================
-- 0014 — Planes de comida de varias semanas ("dieta mensual")
--   meal_plans.weeks     : nº de semanas del plan (1 a 4, por defecto 1)
--   meal_plans.starts_on : fecha de inicio opcional (para saber qué semana toca)
--   meals.week           : semana de cada comida (por defecto 1)
-- Los planes existentes quedan como planes de 1 semana, sin cambios.
-- Las policies de meal_plans y meals (0001) no cambian.
-- Re-ejecutable. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

alter table meal_plans add column if not exists weeks int not null default 1;
alter table meal_plans add column if not exists starts_on date;

do $$
begin
  alter table meal_plans add constraint meal_plans_weeks_check check (weeks between 1 and 4);
exception
  when duplicate_object then null;  -- ya existía
end $$;

alter table meals add column if not exists week int not null default 1;

do $$
begin
  alter table meals add constraint meals_week_check check (week between 1 and 4);
exception
  when duplicate_object then null;
end $$;

-- el editor, Nutrición y la lista de la compra filtran por plan + semana + día
create index if not exists meals_plan_week_day_idx on meals (meal_plan_id, week, day);
