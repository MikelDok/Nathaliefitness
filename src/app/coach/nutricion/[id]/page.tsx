"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Copy, Plus, ShoppingCart, Trash2, UtensilsCrossed } from "lucide-react";
import { EmptyState, ICON, PageHeader, chip } from "@/components/ui";
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
      ? `Guardado. Hoy toca la semana ${currentWeek(startsOn, planWeeks)}; la clienta la verá por defecto.`
      : "Guardado. Sin fecha de inicio, la clienta ve por defecto la semana 1.");
    load();
  }

  if (loading) return <p className="text-sm text-muted">Cargando…</p>;
  if (!plan) return <p className="text-sm text-muted">Plan no encontrado.</p>;

  return (
    <main className="space-y-8">
      <PageHeader back="/coach/nutricion" eyebrow="Plan de comidas" title={plan.title}
        right={
          <Link href={`/coach/nutricion/${id}/compra`} className="chip mt-1 shrink-0 gap-1.5 bg-surface text-ink">
            <ShoppingCart size={16} strokeWidth={1.75} aria-hidden /> Lista de la compra
          </Link>
        }>
        {plan.kcal_target
          ? `Objetivo: ${plan.kcal_target} kcal · P ${plan.protein_g ?? "—"} · G ${plan.fat_g ?? "—"} · C ${plan.carbs_g ?? "—"}`
          : null}
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        {/* ---------- Día ---------- */}
        <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            {weeks > 1 && (
              <div className="-mx-5 flex gap-1 overflow-x-auto px-5 lg:mx-0 lg:px-0" role="tablist" aria-label="Semanas">
                {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
                  <button key={w} onClick={() => setWeek(w)} role="tab" aria-selected={w === week} className={chip(w === week)}>
                    Semana {w}
                  </button>
                ))}
              </div>
            )}
            <div className="-mx-5 flex gap-1 overflow-x-auto px-5 lg:mx-0 lg:px-0" role="tablist" aria-label="Días">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button key={d} onClick={() => setDay(d)} role="tab" aria-selected={d === day} className={chip(d === day)}>
                  Día {d}
                </button>
              ))}
            </div>
          </div>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
              <p className="eyebrow">{weeks > 1 ? `Semana ${week} · ` : ""}Día {day} · {dayMeals.length} comidas</p>
              <p className="text-xs text-muted">
                <span className="figure text-sm text-ink">{tot("kcal")}</span> kcal · P {tot("protein_g")} · G {tot("fat_g")} · C {tot("carbs_g")}
              </p>
            </div>
            {dayMeals.length === 0 ? (
              <EmptyState icon={UtensilsCrossed}>Día vacío. Añade la primera comida.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {dayMeals.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="eyebrow">{m.slot}</p>
                      <p className="mt-1 truncate text-sm font-medium">{m.name}</p>
                      <p className="mt-0.5 text-xs text-muted">{m.kcal} kcal · P {m.protein_g} · G {m.fat_g} · C {m.carbs_g}</p>
                    </div>
                    <button onClick={() => remove(m.id)} aria-label={`Quitar ${m.name}`} title="Quitar"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-danger">
                      <Trash2 {...ICON} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-1">
              <button onClick={copyDayToNext} className="chip gap-1.5 bg-surface text-ink">
                <Copy size={14} strokeWidth={1.75} aria-hidden /> Copiar día {day} al {day + 1}
              </button>
              {week < weeks && (
                <button onClick={copyWeekToNext} className="chip gap-1.5 bg-surface text-ink">
                  <Copy size={14} strokeWidth={1.75} aria-hidden /> Copiar semana {week} a la {week + 1}
                </button>
              )}
            </div>
          </section>
        </div>

        {/* ---------- Lateral: añadir y planificar ---------- */}
        <div className="space-y-5">
          <section className="card space-y-3">
            <p className="eyebrow">Añadir comida {weeks > 1 ? `a la semana ${week}, día ${day}` : `al día ${day}`}</p>
            <div className="flex gap-2">
              <select value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Momento"
                className="field w-auto bg-raised">
                {slots.map((s) => <option key={s}>{s}</option>)}
              </select>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del plato" aria-label="Nombre del plato"
                className="field min-w-0 flex-1 bg-raised" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[["kcal", kcal, setKcal], ["Prot", prot, setProt], ["Grasa", fat, setFat], ["Carbs", carbs, setCarbs]].map(([ph, v, set]) => (
                <input key={ph as string} value={v as string}
                  onChange={(e) => (set as (s: string) => void)(e.target.value)}
                  type="number" inputMode="numeric" placeholder={ph as string} aria-label={`${ph} de la comida`}
                  className="field figure min-w-0 bg-raised px-2 text-center text-base placeholder:font-sans placeholder:text-xs placeholder:font-normal" />
              ))}
            </div>
            <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)}
              placeholder={"Ingredientes (uno por línea):\n200 g lentejas\n100 g remolacha cocida"} rows={3}
              aria-label="Ingredientes" className="field bg-raised" />
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
              placeholder="Instrucciones (opcional)" rows={2}
              aria-label="Instrucciones" className="field bg-raised" />
            {msg && <p className="text-xs text-accent">{msg}</p>}
            <button onClick={add} className="btn-primary w-full">
              <Plus size={18} strokeWidth={2.25} aria-hidden /> Añadir comida
            </button>
          </section>

          <section className="card space-y-3">
            <p className="eyebrow">Planificación</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted">
                Semanas
                <select value={planWeeks} onChange={(e) => setPlanWeeks(+e.target.value)}
                  className="field w-auto bg-raised px-3 py-2">
                  {Array.from({ length: MAX_MEAL_WEEKS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex flex-1 items-center gap-2 text-xs text-muted">
                Empieza el
                <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)}
                  className="field min-w-0 flex-1 bg-raised py-2" />
              </label>
            </div>
            <p className="text-xs text-muted">
              Con fecha de inicio, la clienta ve por defecto la semana que le toca (el plan rota al acabar).
            </p>
            <button onClick={savePlan} className="btn-primary w-full">Guardar planificación</button>
            {planMsg && <p className="text-xs text-accent">{planMsg}</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
