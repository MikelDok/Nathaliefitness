"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { aggregate, formatItem } from "@/lib/shopping";
import { currentWeek } from "@/lib/meals";

type Meal = { week: number; day: number; ingredients: string[] | null };

export default function Compra() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [weeks, setWeeks] = useState(1);
  const [week, setWeek] = useState(1);
  const [days, setDays] = useState<Set<number>>(new Set());
  const [persons, setPersons] = useState(1);
  const [bought, setBought] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requireAuth) { setLoading(false); return; }
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setLoading(false); return; }
      const { data: plan } = await sb.from("meal_plans").select("id,weeks,starts_on")
        .eq("client_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!plan) { setLoading(false); return; }
      const { data: ms } = await sb.from("meals")
        .select("week,day,ingredients").eq("meal_plan_id", plan.id);
      const list = (ms as Meal[]) || [];
      const w = currentWeek(plan.starts_on, plan.weeks || 1);
      setMeals(list);
      setWeeks(plan.weeks || 1);
      setWeek(w);
      setDays(new Set(list.filter((m) => m.week === w).map((m) => m.day)));
      setLoading(false);
    })();
  }, []);

  const weekMeals = useMemo(() => meals.filter((m) => m.week === week), [meals, week]);
  const planDays = useMemo(() => [...new Set(weekMeals.map((m) => m.day))].sort((a, b) => a - b), [weekMeals]);
  const items = useMemo(
    () => aggregate(weekMeals.filter((m) => days.has(m.day)), persons),
    [weekMeals, days, persons],
  );

  const pending = items.filter((i) => !bought.has(i.key));
  const done = items.filter((i) => bought.has(i.key));
  const fmt = (i: (typeof items)[number]) => formatItem(i, persons);

  /** Al cambiar de semana se seleccionan todos sus días y se reinicia lo marcado. */
  function pickWeek(w: number) {
    setWeek(w);
    setDays(new Set(meals.filter((m) => m.week === w).map((m) => m.day)));
    setBought(new Set());
  }
  const toggleDay = (d: number) =>
    setDays((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  const toggleItem = (key: string) =>
    setBought((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  if (loading) return <main><p className="text-sm text-muted">Preparando tu lista…</p></main>;

  return (
    <main className="space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/nutricion" aria-label="Volver" className="rounded-full border border-line p-2 text-muted">←</Link>
        <div>
          <p className="eyebrow">Nutrición</p>
          <h1 className="text-2xl font-bold">Lista de la compra</h1>
        </div>
      </header>

      {meals.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-3xl" aria-hidden>🛒</p>
          <p className="mt-2 text-sm">Tu plan de comidas aún no tiene ingredientes.</p>
          <p className="mt-1 text-xs text-muted">La lista se genera sola a partir de las recetas de tu plan.</p>
        </div>
      ) : (
        <>
          <section className="card space-y-3 p-4">
            {weeks > 1 && (
              <div>
                <p className="eyebrow">Semana</p>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Semana">
                  {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
                    <button key={w} onClick={() => pickWeek(w)} role="radio" aria-checked={w === week}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium ${w === week ? "bg-accent text-accent-ink" : "border border-line text-muted"}`}>
                      Semana {w}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="eyebrow">Toca para incluir o quitar días</p>
            {planDays.length === 0 ? (
              <p className="rounded-xl bg-raised p-3 text-sm text-muted">Esta semana aún no tiene comidas.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {planDays.map((d) => (
                  <button key={d} onClick={() => toggleDay(d)} aria-pressed={days.has(d)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium ${days.has(d) ? "bg-accent text-accent-ink" : "border border-line text-muted"}`}>
                    Día {d} {days.has(d) ? "✓" : ""}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <p className="text-sm">Para cuántas personas</p>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setPersons((p) => Math.max(1, p - 1))} aria-label="Menos personas"
                  className="h-9 w-9 rounded-full border border-line text-lg">−</button>
                <span className="figure w-8 text-center text-lg">{persons}</span>
                <button onClick={() => setPersons((p) => Math.min(8, p + 1))} aria-label="Más personas"
                  className="h-9 w-9 rounded-full border border-line text-lg">+</button>
              </div>
            </div>
          </section>

          <section className="card p-4">
            <p className="eyebrow">Por comprar ({pending.length})</p>
            {pending.length === 0 ? (
              <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
                {items.length === 0 ? "Selecciona al menos un día." : "¡Todo comprado! 🎉"}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {pending.map((i) => (
                  <li key={i.key}>
                    <button onClick={() => toggleItem(i.key)}
                      className="flex w-full items-center gap-3 py-3 text-left">
                      <span aria-hidden className="h-5 w-5 shrink-0 rounded-full border border-line" />
                      <span className="text-sm">{fmt(i)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <section className="rounded-2xl border border-ok/30 bg-ok/10 p-4">
              <p className="eyebrow text-ok">🛒 Lista comprada · {done.length} artículos</p>
              <ul className="mt-3 divide-y divide-line/50">
                {done.map((i) => (
                  <li key={i.key}>
                    <button onClick={() => toggleItem(i.key)}
                      className="flex w-full items-center gap-3 py-2.5 text-left">
                      <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ok bg-ok/20 text-xs text-ok">✓</span>
                      <span className="text-sm text-muted line-through">{fmt(i)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-[11px] text-muted">
            Las cantidades se suman desde las recetas de los días elegidos y se multiplican por personas.
            Marca cada artículo al meterlo en el carro; la lista se reinicia al salir.
          </p>
        </>
      )}
    </main>
  );
}
