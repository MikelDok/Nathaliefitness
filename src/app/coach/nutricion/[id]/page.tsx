"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { MEAL_SLOTS as slots, MAX_MEAL_WEEKS, sortBySlot, currentWeek } from "@/lib/meals";

type Plan = {
  id: string; title: string; kcal_target: number | null; protein_g: number | null; fat_g: number | null; carbs_g: number | null;
  weeks: number; starts_on: string | null;
};
type Meal = {
  id: string; week: number; day: number; slot: string; name: string; prep_minutes: number | null;
  kcal: number | null; protein_g: number | null; fat_g: number | null; carbs_g: number | null;
  ingredients: string[] | null; instructions: string | null;
};

export default function EditorPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  // planificación: nº de semanas y fecha de inicio (para saber qué semana toca)
  const [planWeeks, setPlanWeeks] = useState(1);
  const [startsOn, setStartsOn] = useState("");
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [slot, setSlot] = useState(slots[0]);
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState(""); const [prot, setProt] = useState("");
  const [fat, setFat] = useState(""); const [carbs, setCarbs] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [instructions, setInstructions] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const [{ data: p }, { data: ms }] = await Promise.all([
      sb.from("meal_plans").select("id,title,kcal_target,protein_g,fat_g,carbs_g,weeks,starts_on").eq("id", id).maybeSingle(),
      sb.from("meals").select("*").eq("meal_plan_id", id).order("week").order("day").order("slot"),
    ]);
    setPlan(p); setMeals((ms as Meal[]) || []);
    setPlanWeeks(p?.weeks || 1);
    setStartsOn(p?.starts_on || "");
    setWeek((w) => Math.min(w, p?.weeks || 1));
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const weekMeals = meals.filter((m) => (m.week || 1) === week);
  const dayMeals = sortBySlot(weekMeals.filter((m) => m.day === day));
  const weeks = plan?.weeks || 1;
  const tot = (k: "kcal" | "protein_g" | "fat_g" | "carbs_g") =>
    dayMeals.reduce((s, m) => s + (Number(m[k]) || 0), 0);

  async function add() {
    setMsg(null);
    if (!name.trim()) { setMsg("Ponle nombre a la comida."); return; }
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("meals").insert({
      meal_plan_id: id, week, day, slot, name: name.trim(),
      kcal: +kcal || 0, protein_g: +prot || 0, fat_g: +fat || 0, carbs_g: +carbs || 0,
      ingredients: ingredients.trim() ? ingredients.split("\n").map((s) => s.trim()).filter(Boolean) : null,
      instructions: instructions.trim() || null,
    });
    if (error) { setMsg("No se pudo añadir la comida."); return; }
    setName(""); setKcal(""); setProt(""); setFat(""); setCarbs("");
    setIngredients(""); setInstructions("");
    load();
  }

  async function remove(mealId: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("meals").delete().eq("id", mealId);
    load();
  }

  async function copyDayToNext() {
    setMsg(null);
    const sb = getSupabase();
    if (!sb || day >= 7) return;
    if (dayMeals.length === 0) { setMsg("Este día está vacío."); return; }
    if (weekMeals.some((m) => m.day === day + 1)) { setMsg(`El día ${day + 1} ya tiene comidas.`); return; }
    const { error } = await sb.from("meals").insert(dayMeals.map((m) => ({
      meal_plan_id: id, week, day: day + 1, slot: m.slot, name: m.name,
      kcal: m.kcal, protein_g: m.protein_g, fat_g: m.fat_g, carbs_g: m.carbs_g,
      ingredients: m.ingredients, instructions: m.instructions,
    })));
    if (error) setMsg("No se pudo copiar el día.");
    else { setMsg(`Día ${day} copiado al ${day + 1}.`); load(); }
  }

  /** Copia todas las comidas de la semana actual a la siguiente (vacía), como en programas. */
  async function copyWeekToNext() {
    setMsg(null);
    const sb = getSupabase();
    if (!sb || week >= weeks) return;
    if (weekMeals.length === 0) { setMsg("Esta semana está vacía, nada que copiar."); return; }
    if (meals.some((m) => (m.week || 1) === week + 1)) { setMsg(`La semana ${week + 1} ya tiene comidas.`); return; }
    const { error } = await sb.from("meals").insert(weekMeals.map((m) => ({
      meal_plan_id: id, week: week + 1, day: m.day, slot: m.slot, name: m.name,
      prep_minutes: m.prep_minutes,
      kcal: m.kcal, protein_g: m.protein_g, fat_g: m.fat_g, carbs_g: m.carbs_g,
      ingredients: m.ingredients, instructions: m.instructions,
    })));
    if (error) setMsg("No se pudo copiar la semana.");
    else { setMsg(`Semana ${week} copiada a la ${week + 1}.`); load(); }
  }

  /** Guarda nº de semanas y fecha de inicio. No deja quitar semanas con comidas. */
  async function savePlan() {
    setPlanMsg(null);
    const sb = getSupabase();
    if (!sb || !plan) return;
    const withMeals = [...new Set(meals.map((m) => m.week || 1))].filter((w) => w > planWeeks).sort((a, b) => a - b);
    if (withMeals.length) {
      setPlanMsg(`${withMeals.length > 1 ? "Las semanas" : "La semana"} ${withMeals.join(", ")} ${withMeals.length > 1 ? "tienen" : "tiene"} comidas: vacíala${withMeals.length > 1 ? "s" : ""} antes de quitarla${withMeals.length > 1 ? "s" : ""}.`);
      return;
    }
    const { error } = await sb.from("meal_plans")
      .update({ weeks: planWeeks, starts_on: startsOn || null }).eq("id", id);
    if (error) { setPlanMsg("No se pudo guardar la planificación (¿falta la migración 0014?)."); return; }
    setPlanMsg(startsOn
      ? `Guardado ✓ Hoy toca la semana ${currentWeek(startsOn, planWeeks)}; la clienta la verá por defecto.`
      : "Guardado ✓ Sin fecha de inicio, la clienta ve por defecto la semana 1.");
    load();
  }

  if (loading) return <p className="text-sm text-muted">Cargando…</p>;
  if (!plan) return <p className="text-sm text-muted">Plan no encontrado.</p>;

  return (
    <main className="space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/coach/nutricion" aria-label="Volver" className="rounded-full border border-line p-2 text-muted">←</Link>
        <div>
          <h1 className="text-xl font-bold">{plan.title}</h1>
          {plan.kcal_target && (
            <p className="text-xs text-muted">
              Objetivo: {plan.kcal_target} kcal · P {plan.protein_g ?? "—"} · G {plan.fat_g ?? "—"} · C {plan.carbs_g ?? "—"}
            </p>
          )}
        </div>
        <Link href={`/coach/nutricion/${id}/compra`}
          className="ml-auto shrink-0 rounded-full border border-line px-3 py-2 text-xs font-medium">
          🛒 Lista de la compra
        </Link>
      </header>

      <section className="card p-4">
        <p className="eyebrow">Planificación</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            Semanas
            <select value={planWeeks} onChange={(e) => setPlanWeeks(+e.target.value)}
              className="rounded-lg border border-line bg-bg px-2 py-2 text-sm text-ink">
              {Array.from({ length: MAX_MEAL_WEEKS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            Empieza el
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)}
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink" />
          </label>
          <button onClick={savePlan}
            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-ink">
            Guardar
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Con fecha de inicio, la clienta ve por defecto la semana que le toca (el plan rota al acabar).
        </p>
        {planMsg && <p className="mt-2 text-xs text-accent">{planMsg}</p>}
      </section>

      {weeks > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Semanas">
          {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
            <button key={w} onClick={() => setWeek(w)} role="tab" aria-selected={w === week}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${w === week ? "bg-accent text-accent-ink" : "border border-line text-muted"}`}>
              Semana {w}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Días">
        {[1,2,3,4,5,6,7].map((d) => (
          <button key={d} onClick={() => setDay(d)} role="tab" aria-selected={d === day}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${d === day ? (weeks > 1 ? "bg-raised" : "bg-accent text-accent-ink") : "border border-line text-muted"}`}>
            Día {d}
          </button>
        ))}
      </div>

      <section className="card p-4">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">{weeks > 1 ? `Semana ${week} · ` : ""}Día {day} · {dayMeals.length} comidas</p>
          <p className="text-xs text-muted">
            {tot("kcal")} kcal · P {tot("protein_g")} · G {tot("fat_g")} · C {tot("carbs_g")}
          </p>
        </div>
        {dayMeals.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">Día vacío. Añade la primera comida abajo.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {dayMeals.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-xs text-accent">{m.slot}</p>
                  <p className="truncate text-sm">{m.name}</p>
                  <p className="text-xs text-muted">{m.kcal} kcal · P {m.protein_g} · G {m.fat_g} · C {m.carbs_g}</p>
                </div>
                <button onClick={() => remove(m.id)}
                  className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-muted">Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <p className="eyebrow">Añadir comida {weeks > 1 ? `a la semana ${week}, día ${day}` : `al día ${day}`}</p>
        <div className="flex gap-2">
          <select value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Momento"
            className="rounded-lg border border-line bg-bg px-3 py-2.5 text-sm">
            {slots.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del plato"
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[["kcal", kcal, setKcal], ["Prot", prot, setProt], ["Grasa", fat, setFat], ["Carbs", carbs, setCarbs]].map(([ph, v, set]) => (
            <input key={ph as string} value={v as string}
              onChange={(e) => (set as (s: string) => void)(e.target.value)}
              type="number" inputMode="numeric" placeholder={ph as string} aria-label={`${ph} de la comida`}
              className="figure rounded-lg border border-line bg-bg px-2 py-2.5 text-center text-sm" />
          ))}
        </div>
        <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)}
          placeholder={"Ingredientes (uno por línea):\n200 g lentejas\n100 g remolacha cocida"} rows={3}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
          placeholder="Instrucciones (opcional)" rows={2}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        {msg && <p className="text-xs text-accent">{msg}</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={add} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
            Añadir comida
          </button>
          <button onClick={copyDayToNext} className="rounded-full border border-line px-5 py-2.5 text-sm text-muted">
            Copiar día {day} → {day + 1}
          </button>
          {week < weeks && (
            <button onClick={copyWeekToNext} className="rounded-full border border-line px-5 py-2.5 text-sm text-muted">
              Copiar semana {week} → {week + 1}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
