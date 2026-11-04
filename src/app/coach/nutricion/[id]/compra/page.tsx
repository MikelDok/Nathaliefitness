"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { currentWeek } from "@/lib/meals";
import { aggregate, describeDays, formatItem, toPlainText } from "@/lib/shopping";

type Plan = { id: string; title: string; client_id: string | null; weeks: number; starts_on: string | null };
type Meal = { week: number; day: number; slot: string; name: string; ingredients: string[] | null };

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const toggle = (s: Set<number>, v: number) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; };

/** Lista de la compra de un plan, para la coach: varias semanas, copiar e imprimir. */
export default function CompraCoach({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [weeks, setWeeks] = useState<Set<number>>(new Set([1]));
  const [days, setDays] = useState<Set<number>>(new Set(ALL_DAYS));
  const [persons, setPersons] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      const [{ data: p }, { data: ms }] = await Promise.all([
        sb.from("meal_plans").select("id,title,client_id,weeks,starts_on").eq("id", id).maybeSingle(),
        sb.from("meals").select("week,day,slot,name,ingredients").eq("meal_plan_id", id).order("week").order("day"),
      ]);
      if (p) {
        setPlan(p);
        setWeeks(new Set([currentWeek(p.starts_on, p.weeks || 1)]));
        if (p.client_id) {
          const { data: c } = await sb.from("profiles").select("full_name").eq("id", p.client_id).maybeSingle();
          setClientName(c?.full_name ?? null);
        }
      }
      setMeals((ms as Meal[]) || []);
      setLoading(false);
    })();
  }, [id]);

  const planWeeks = plan?.weeks || 1;
  const selected = useMemo(
    () => meals.filter((m) => weeks.has(m.week || 1) && days.has(m.day)),
    [meals, weeks, days],
  );
  const items = useMemo(() => aggregate(selected, persons), [selected, persons]);
  const noIngredients = selected.filter((m) => !(m.ingredients || []).some((l) => l.trim()));

  const weekList = [...weeks].sort((a, b) => a - b);
  const subtitle = [
    planWeeks > 1 ? `${weekList.length > 1 ? "Semanas" : "Semana"} ${weekList.join(", ")}` : null,
    describeDays([...days]),
    `${persons} ${persons === 1 ? "persona" : "personas"}`,
  ].filter(Boolean).join(" · ");
  // primera letra en mayúscula ("días 1-7 · …" → "Días 1-7 · …")
  const subtitleCap = subtitle.charAt(0).toUpperCase() + subtitle.slice(1);

  async function copy() {
    if (!plan) return;
    const text = toPlainText(items, persons, plan.title, subtitleCap);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copiada ✓ Ya puedes pegarla en WhatsApp.");
    } catch {
      setCopied("No se pudo copiar automáticamente. Usa Imprimir o copia la lista a mano.");
    }
    setTimeout(() => setCopied(null), 3000);
  }

  if (loading) return <p className="text-sm text-muted">Cargando…</p>;
  if (!plan) return <p className="text-sm text-muted">Plan no encontrado.</p>;

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium ${on ? "bg-accent text-accent-ink" : "border border-line text-muted"}`;

  return (
    <main className="space-y-5">
      {/* ---------- Pantalla ---------- */}
      <div className="space-y-5 print:hidden">
        <header className="flex items-center gap-3">
          <Link href={`/coach/nutricion/${id}`} aria-label="Volver al plan" className="rounded-full border border-line p-2 text-muted">←</Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Lista de la compra</h1>
            <p className="truncate text-xs text-muted">{plan.title}{clientName ? ` · ${clientName}` : ""}</p>
          </div>
        </header>

        <section className="card space-y-4 p-4">
          <p className="eyebrow">Qué incluir</p>
          {planWeeks > 1 && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Semanas">
              <span className="w-16 text-xs text-muted">Semanas</span>
              {Array.from({ length: planWeeks }, (_, i) => i + 1).map((w) => (
                <button key={w} onClick={() => setWeeks((s) => toggle(s, w))} aria-pressed={weeks.has(w)} className={chip(weeks.has(w))}>
                  S{w}{weeks.has(w) ? " ✓" : ""}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2" aria-label="Días">
            <span className="w-16 text-xs text-muted">Días</span>
            {ALL_DAYS.map((d) => (
              <button key={d} onClick={() => setDays((s) => toggle(s, d))} aria-pressed={days.has(d)} className={chip(days.has(d))}>
                {d}
              </button>
            ))}
            <button onClick={() => setDays(new Set(ALL_DAYS))} className="text-xs text-muted underline">Todos</button>
            <button onClick={() => setDays(new Set())} className="text-xs text-muted underline">Ninguno</button>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs text-muted">Personas</span>
            <button onClick={() => setPersons((p) => Math.max(1, p - 1))} aria-label="Menos personas"
              className="h-9 w-9 rounded-full border border-line text-lg">−</button>
            <span className="figure w-8 text-center text-lg">{persons}</span>
            <button onClick={() => setPersons((p) => Math.min(12, p + 1))} aria-label="Más personas"
              className="h-9 w-9 rounded-full border border-line text-lg">+</button>
          </div>
        </section>

        {noIngredients.length > 0 && (
          <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs">
            <p className="font-semibold">
              ⚠ {noIngredients.length} {noIngredients.length === 1 ? "comida no tiene" : "comidas no tienen"} ingredientes y no cuenta{noIngredients.length === 1 ? "" : "n"} en la lista:
            </p>
            <p className="mt-1 text-muted">
              {noIngredients.slice(0, 5).map((m) =>
                `${planWeeks > 1 ? `S${m.week || 1} · ` : ""}Día ${m.day} · ${m.slot} «${m.name}»`).join("; ")}
              {noIngredients.length > 5 ? ` y ${noIngredients.length - 5} más.` : "."}
            </p>
          </div>
        )}

        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Lista · {items.length} artículos</p>
            <div className="flex gap-2">
              <button onClick={copy} disabled={items.length === 0}
                className="rounded-full border border-line px-3 py-1.5 text-xs disabled:opacity-50">
                📋 Copiar
              </button>
              <button onClick={() => window.print()} disabled={items.length === 0}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-50">
                🖨 Imprimir
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">{subtitleCap}</p>
          {copied && <p role="status" className="mt-2 text-xs text-ok">{copied}</p>}
          {items.length === 0 ? (
            <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
              {selected.length === 0
                ? "No hay comidas en la selección. Elige al menos una semana y un día con comidas."
                : "Las comidas elegidas no tienen ingredientes."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line sm:columns-2 sm:gap-6 sm:divide-y-0">
              {items.map((i) => (
                <li key={i.key} className="break-inside-avoid py-2 text-sm sm:border-b sm:border-line">{formatItem(i, persons)}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- Impresión: hoja blanca como el informe (sin tokens del tema) ---------- */}
      <article className="hidden text-[#111111] print:block">
        <header className="border-b border-[#dddddd] pb-3">
          <h1 className="text-xl font-bold">Lista de la compra</h1>
          <p className="mt-1">{plan.title}{clientName ? ` · ${clientName}` : ""}</p>
          <p className="mt-1 text-xs text-[#666666]">{subtitleCap}</p>
        </header>
        <ul className="mt-4 columns-2 gap-8 text-sm">
          {items.map((i) => (
            <li key={i.key} className="flex break-inside-avoid items-start gap-2 border-b border-[#eeeeee] py-1.5">
              <span aria-hidden className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-[#999999]" />
              {formatItem(i, persons)}
            </li>
          ))}
        </ul>
        <footer className="mt-6 border-t border-[#dddddd] pt-2 text-[10px] text-[#999999]">
          NEA FITNESS · {new Date().toLocaleDateString("es-ES")}
        </footer>
      </article>
    </main>
  );
}
