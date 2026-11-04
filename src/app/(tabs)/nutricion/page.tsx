"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      <main className="space-y-5">
        <header><p className="eyebrow">Nutrición</p><h1 className="mt-1 text-2xl font-bold">Plan de comidas</h1></header>
        <section className="card grid grid-cols-4 divide-x divide-line p-4 text-center">
          {[["Proteínas", `${d.macros.protein} g`], ["Grasas", `${d.macros.fat} g`], ["Carbs", `${d.macros.carbs} g`], ["Calorías", `${d.macros.kcal}`]].map(([k, v]) => (
            <div key={k}><p className="figure text-lg">{v}</p><p className="mt-0.5 text-[11px] text-muted">{k}</p></div>
          ))}
        </section>
        <ul className="space-y-3">
          {d.meals.map((m) => (
            <li key={m.slot} className="card p-4">
              <p className="eyebrow">{m.slot}</p>
              <p className="mt-1 font-semibold leading-snug">{m.name}</p>
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
    <main className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Nutrición</p>
          <h1 className="mt-1 text-2xl font-bold">{plan ? plan.title : "Plan de comidas"}</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/compra"
            className="rounded-full border border-line px-3 py-2 text-xs font-medium">
            Compra 🛒
          </Link>
        </div>
      </header>

      {!plan ? (
        <div className="card p-6 text-center">
          <p className="text-3xl" aria-hidden>🥗</p>
          <p className="mt-2 text-sm">Tu entrenadora aún no te ha asignado un plan de comidas.</p>
        </div>
      ) : (
        <>
          {weeks > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Semanas">
              {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
                <button key={w} onClick={() => pickWeek(w)} role="tab" aria-selected={w === week}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${w === week ? "bg-raised ring-1 ring-accent/60" : "border border-line text-muted"}`}>
                  Semana {w}
                  {plan.starts_on && w === currentWeek(plan.starts_on, weeks) && <span className="ml-1 text-[10px] text-accent">· hoy</span>}
                </button>
              ))}
            </div>
          )}
          {days.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Días">
              {days.map((d) => (
                <button key={d} onClick={() => setDay(d)} role="tab" aria-selected={d === day}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${d === day ? "bg-accent text-accent-ink" : "border border-line text-muted"}`}>
                  Día {d}
                </button>
              ))}
            </div>
          )}

          <section className="card grid grid-cols-4 divide-x divide-line p-4 text-center">
            {[["Proteínas", `${tot("protein_g")} g`], ["Grasas", `${tot("fat_g")} g`], ["Carbs", `${tot("carbs_g")} g`], ["Calorías", `${tot("kcal")}`]].map(([k, v]) => (
              <div key={k}><p className="figure text-lg">{v}</p><p className="mt-0.5 text-[11px] text-muted">{k}</p></div>
            ))}
          </section>

          {dayMeals.length === 0 ? (
            <div className="card p-6 text-center text-sm text-muted">Este día aún no tiene comidas.</div>
          ) : (
            <ul className="space-y-3">
              {dayMeals.map((m) => (
                <li key={m.id} className="card p-4">
                  <button onClick={() => setOpen(open === m.id ? null : m.id)} className="w-full text-left">
                    <p className="eyebrow">{m.slot}</p>
                    <p className="mt-1 font-semibold leading-snug">{m.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {m.kcal} kcal · P {m.protein_g} · G {m.fat_g} · C {m.carbs_g}
                      {(m.ingredients?.length || m.instructions) ? (open === m.id ? "  ▲" : "  ▼") : ""}
                    </p>
                  </button>
                  {open === m.id && (m.ingredients?.length || m.instructions) && (
                    <div className="mt-3 space-y-2 rounded-xl bg-raised p-3">
                      {m.ingredients?.length ? (
                        <div>
                          <p className="text-xs font-semibold">Ingredientes</p>
                          <ul className="mt-1 list-inside list-disc text-xs text-muted">
                            {m.ingredients.map((i, idx) => <li key={idx}>{i}</li>)}
                          </ul>
                        </div>
                      ) : null}
                      {m.instructions && (
                        <div>
                          <p className="text-xs font-semibold">Instrucciones</p>
                          <p className="mt-1 text-xs text-muted">{m.instructions}</p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="rounded-xl bg-raised p-3 text-xs text-muted">
        Pautas de fitness y bienestar; no sustituyen consejo médico o dietético clínico.
      </p>
    </main>
  );
}
