"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Salad, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { EmptyState, PageHeader, chip } from "@/components/ui";

/** Resumen de macros del día: cifras planas, sin tarjeta. */
function Macros({ items }: { items: [string, string][] }) {
  return (
    <section className="grid grid-cols-4 border-y border-line py-3 text-center" aria-label="Macros del día">
      {items.map(([k, v]) => (
        <div key={k}><p className="figure text-2xl">{v}</p><p className="eyebrow mt-1 text-[10px]">{k}</p></div>
      ))}
    </section>
  );
}

const compraLink = (
  <Link href="/compra" className="chip shrink-0 gap-1.5 bg-surface text-ink">
    <ShoppingCart size={16} strokeWidth={1.75} aria-hidden /> Compra
  </Link>
);
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";
import { sortBySlot, currentWeek } from "@/lib/meals";

type Plan = {
  id: string; title: string; kcal_target: number | null; protein_g: number | null; fat_g: number | null; carbs_g: number | null;
  weeks: number; starts_on: string | null;
};
type Meal = {
  id: string; week: number; day: number; slot: string; name: string;
  kcal: number | null; protein_g: number | null; fat_g: number | null; carbs_g: number | null;
  ingredients: string[] | null; instructions: string | null;
};

export default function Nutricion() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(requireAuth);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setLoading(false); return; }
      const { data: p } = await sb
        .from("meal_plans")
        .select("id,title,kcal_target,protein_g,fat_g,carbs_g,weeks,starts_on")
        .eq("client_id", uid)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      if (!p) { setLoading(false); return; }
      setPlan(p);
      // con fecha de inicio, la semana que toca hoy; si no, la 1
      const w = currentWeek(p.starts_on, p.weeks || 1);
      setWeek(w);
      const { data: ms } = await sb.from("meals").select("*").eq("meal_plan_id", p.id).order("day");
      const list = (ms as Meal[]) || [];
      setMeals(list);
      const first = list.filter((m) => (m.week || 1) === w).map((m) => m.day).sort((a, b) => a - b)[0];
      if (first && (p.weeks || 1) > 1) setDay(first);
      setLoading(false);
    })();
  }, []);

  // ---------- Demo ----------
  if (!requireAuth) {
    const d = demo.mealDay;
    return (
      <main className="space-y-7">
        <PageHeader eyebrow="Nutrición" title="Plan de comidas" right={compraLink} />
        <Macros items={[["Proteínas", `${d.macros.protein} g`], ["Grasas", `${d.macros.fat} g`], ["Carbs", `${d.macros.carbs} g`], ["Kcal", `${d.macros.kcal}`]]} />
        <ul className="divide-y divide-line">
          {d.meals.map((m) => (
            <li key={m.slot} className="py-3.5">
              <p className="eyebrow">{m.slot}</p>
              <p className="mt-1 font-medium leading-snug">{m.name}</p>
              <p className="mt-1 text-xs text-muted">{m.kcal} kcal · {m.protein} g proteína</p>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  // ---------- Real ----------
  if (loading) return <main><p className="text-sm text-muted">Cargando tu plan…</p></main>;

  const weekMeals = meals.filter((m) => (m.week || 1) === week);
  const dayMeals = sortBySlot(weekMeals.filter((m) => m.day === day));
  const tot = (k: "kcal" | "protein_g" | "fat_g" | "carbs_g") =>
    dayMeals.reduce((s, m) => s + (Number(m[k]) || 0), 0);
  const days = [...new Set(weekMeals.map((m) => m.day))].sort((a, b) => a - b);
  const weeks = plan?.weeks || 1;
  /** Al cambiar de semana, se abre su primer día con comidas. */
  const pickWeek = (w: number) => {
    setWeek(w);
    const first = meals.filter((m) => (m.week || 1) === w).map((m) => m.day).sort((a, b) => a - b)[0];
    setDay(first ?? 1);
  };

  return (
    <main className="space-y-7">
      <PageHeader eyebrow="Nutrición" title={plan ? plan.title : "Plan de comidas"} right={compraLink} />

      {!plan ? (
        <EmptyState icon={Salad}>Tu entrenadora aún no te ha asignado un plan de comidas.</EmptyState>
      ) : (
        <>
          <div className="space-y-2">
          {weeks > 1 && (
            <div className="-mx-5 flex gap-1 overflow-x-auto px-5" role="tablist" aria-label="Semanas">
              {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
                <button key={w} onClick={() => pickWeek(w)} role="tab" aria-selected={w === week}
                  className={chip(w === week)}>
                  Semana {w}
                  {plan.starts_on && w === currentWeek(plan.starts_on, weeks) && (
                    <span className={`ml-1 ${w === week ? "" : "text-accent"}`}>· hoy</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {days.length > 0 && (
            <div className="-mx-5 flex gap-1 overflow-x-auto px-5" role="tablist" aria-label="Días">
              {days.map((d) => (
                <button key={d} onClick={() => setDay(d)} role="tab" aria-selected={d === day} className={chip(d === day)}>
                  Día {d}
                </button>
              ))}
            </div>
          )}
          </div>

          <Macros items={[["Proteínas", `${tot("protein_g")} g`], ["Grasas", `${tot("fat_g")} g`], ["Carbs", `${tot("carbs_g")} g`], ["Kcal", `${tot("kcal")}`]]} />

          {dayMeals.length === 0 ? (
            <EmptyState icon={UtensilsCrossed}>Este día aún no tiene comidas.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {dayMeals.map((m) => {
                const more = !!(m.ingredients?.length || m.instructions);
                return (
                <li key={m.id} className="py-3.5">
                  <button onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={more ? open === m.id : undefined}
                    className="flex w-full items-start gap-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="eyebrow block">{m.slot}</span>
                      <span className="mt-1 block font-medium leading-snug">{m.name}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {m.kcal} kcal · P {m.protein_g} · G {m.fat_g} · C {m.carbs_g}
                      </span>
                    </span>
                    {more && (
                      <ChevronDown size={20} strokeWidth={1.75} aria-hidden
                        className={`mt-5 shrink-0 text-muted transition-transform ${open === m.id ? "rotate-180" : ""}`} />
                    )}
                  </button>
                  {open === m.id && more && (
                    <div className="mt-3 space-y-3 rounded-xl bg-surface p-4">
                      {m.ingredients?.length ? (
                        <div>
                          <p className="eyebrow">Ingredientes</p>
                          <ul className="mt-1 list-inside list-disc text-xs text-muted">
                            {m.ingredients.map((i, idx) => <li key={idx}>{i}</li>)}
                          </ul>
                        </div>
                      ) : null}
                      {m.instructions && (
                        <div>
                          <p className="eyebrow">Instrucciones</p>
                          <p className="mt-1 text-xs text-muted">{m.instructions}</p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <p className="text-[11px] text-muted">
        Pautas de fitness y bienestar; no sustituyen consejo médico o dietético clínico.
      </p>
    </main>
  );
}
