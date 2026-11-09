"use client";

// Controles del constructor para un ejercicio del programa: tipo, series,
// repeticiones (fijas, rango o por serie, o texto libre) y descanso.
// Lo usan "Añadir a esta sesión" y la edición de una fila ya añadida.

import { Minus, Plus } from "lucide-react";
import { chip } from "@/components/ui";
import {
  MAX_REPS, MAX_SETS, SET_TYPES, draftFromScheme, draftToScheme, isFreeTextType,
  type CustomRow, type SchemeDraft,
} from "@/lib/scheme";

export type PlanFields = { draft: SchemeDraft; type: string; rest: string };

export const fieldsFrom = (scheme: string, type: string | null, rest: number | null): PlanFields => ({
  draft: draftFromScheme(scheme),
  type: type || "normal",
  rest: rest == null ? "" : String(rest),
});

export const schemeOf = (f: PlanFields) => draftToScheme(f.draft);

/** Campo numérico de repeticiones (vacío mientras se escribe; se acota al guardar). */
function Reps({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <input type="number" inputMode="numeric" min={1} max={MAX_REPS} value={value || ""}
      onChange={(e) => onChange(+e.target.value)} aria-label={label}
      className="field figure w-16 bg-raised px-2 py-2 text-center text-base" />
  );
}

export default function SchemeEditor({ value, onChange, idPrefix }: {
  value: PlanFields;
  onChange: (next: PlanFields) => void;
  /** distingue los nombres accesibles cuando hay varios editores */
  idPrefix: string;
}) {
  const { draft: d, type, rest } = value;
  const set = (patch: Partial<SchemeDraft>) => onChange({ ...value, draft: { ...d, ...patch } });

  function changeType(t: string) {
    let draft = d;
    // cardio y calentamiento van como texto; al volver a otro tipo, a series
    if (isFreeTextType(t) && d.mode !== "text") draft = { ...d, mode: "text" };
    else if (!isFreeTextType(t) && d.mode === "text") draft = { ...d, mode: "fixed" };
    onChange({ ...value, type: t, draft });
  }

  function changeCount(n: number) {
    const count = Math.min(MAX_SETS, Math.max(1, n));
    if (d.mode !== "custom") return set({ count });
    const custom = d.custom.slice(0, count);
    while (custom.length < count) custom.push({ ...(custom[custom.length - 1] ?? { min: 10, max: 10, range: false }) });
    set({ count, custom });
  }

  function toCustom() {
    const row: CustomRow = { min: d.min, max: d.mode === "range" ? d.max : d.min, range: d.mode === "range" };
    set({ mode: "custom", custom: Array.from({ length: d.count }, () => ({ ...row })) });
  }

  function toSame() {
    const [r] = d.custom;
    set(r ? { mode: r.range ? "range" : "fixed", min: r.min, max: r.range ? r.max : Math.min(MAX_REPS, r.min + 2) } : { mode: "fixed" });
  }

  const editRow = (i: number, patch: Partial<CustomRow>) =>
    set({ custom: d.custom.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="w-24 shrink-0">Tipo</span>
        <select value={type} onChange={(e) => changeType(e.target.value)}
          className="field min-w-0 flex-1 bg-raised px-3 py-2">
          {SET_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>

      {d.mode === "text" ? (
        <label className="flex items-center gap-2 text-xs text-muted">
          <span className="w-24 shrink-0">Indicación</span>
          <input value={d.text} onChange={(e) => set({ text: e.target.value })}
            placeholder="15 min, 10 min suave…"
            className="field min-w-0 flex-1 bg-raised px-3 py-2" />
        </label>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="w-24 shrink-0" id={`${idPrefix}-series`}>Series</span>
            <div className="flex items-center gap-1" role="group" aria-labelledby={`${idPrefix}-series`}>
              <button type="button" onClick={() => changeCount(d.count - 1)} disabled={d.count <= 1}
                aria-label="Una serie menos"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-ink disabled:opacity-40">
                <Minus size={16} strokeWidth={2} aria-hidden />
              </button>
              <span className="figure w-8 text-center text-xl text-ink" aria-live="polite">{d.count}</span>
              <button type="button" onClick={() => changeCount(d.count + 1)} disabled={d.count >= MAX_SETS}
                aria-label="Una serie más"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-ink disabled:opacity-40">
                <Plus size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>

          {d.mode !== "custom" ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="w-24 shrink-0">Repeticiones</span>
              <div className="flex gap-1" role="radiogroup" aria-label="Repeticiones">
                <button type="button" role="radio" aria-checked={d.mode === "fixed"}
                  onClick={() => set({ mode: "fixed" })} className={chip(d.mode === "fixed")}>Fijas</button>
                <button type="button" role="radio" aria-checked={d.mode === "range"}
                  onClick={() => set({ mode: "range", max: Math.max(d.max, d.min + 1) })}
                  className={chip(d.mode === "range")}>Rango</button>
              </div>
              <div className="flex items-center gap-2">
                {d.mode === "fixed" ? (
                  <Reps value={d.min} onChange={(n) => set({ min: n })} label="Repeticiones por serie" />
                ) : (
                  <>
                    de <Reps value={d.min} onChange={(n) => set({ min: n })} label="Repeticiones mínimas" />
                    a <Reps value={d.max} onChange={(n) => set({ max: n })} label="Repeticiones máximas" />
                  </>
                )}
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {d.custom.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 py-2 text-xs text-muted">
                  <span className="eyebrow w-16 shrink-0">Serie {i + 1}</span>
                  <Reps value={r.min} onChange={(n) => editRow(i, { min: n })}
                    label={r.range ? `Serie ${i + 1}: mínimo` : `Serie ${i + 1}: repeticiones`} />
                  {r.range && (
                    <>a <Reps value={r.max} onChange={(n) => editRow(i, { max: n })} label={`Serie ${i + 1}: máximo`} /></>
                  )}
                  <button type="button" aria-pressed={r.range}
                    onClick={() => editRow(i, { range: !r.range, max: Math.max(r.max, r.min + 1) })}
                    className={`${chip(r.range)} ml-auto min-h-7 px-2.5 text-[10px] ${r.range ? "" : "bg-raised"}`}>
                    Rango
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button type="button" onClick={d.mode === "custom" ? toSame : toCustom}
            className="text-xs font-medium text-accent underline underline-offset-2">
            {d.mode === "custom" ? "Igual en todas las series" : "Personalizar por serie"}
          </button>
        </>
      )}

      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="w-24 shrink-0">Descanso</span>
        <input type="number" inputMode="numeric" min={0} step={15} value={rest}
          onChange={(e) => onChange({ ...value, rest: e.target.value })} placeholder="90"
          className="field figure w-20 bg-raised px-2 py-2 text-center text-base" />
        <span>s entre series</span>
      </label>
    </div>
  );
}
