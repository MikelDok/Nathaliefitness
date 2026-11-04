"use client";

import { useState } from "react";
import TrendChart from "@/components/charts/TrendChart";
import { fmtDelta, fmtLongDate, fmtNum, loadsByExercise, topPRs, type LoadLog } from "@/lib/progress";

/**
 * Cargas por ejercicio: marcas personales (top 3, tocables), selector con
 * todos los ejercicios con peso y gráfica del kg máximo por sesión.
 */
export default function LoadsPanel({ logs, compact = false }: { logs: LoadLog[]; compact?: boolean }) {
  const series = loadsByExercise(logs);
  const [name, setName] = useState<string | null>(null);
  const current = series.find((s) => s.name === name) ?? series[0];

  if (!current) {
    return (
      <p className="mt-2 text-sm text-muted">
        {compact
          ? "Aún no ha registrado series con peso."
          : "Cuando registres series con peso en tus entrenos, aquí verás cómo progresas."}
      </p>
    );
  }

  const first = current.points[0];
  const last = current.points[current.points.length - 1];
  const gain = last.value - first.value;
  const several = current.points.length > 1;
  const lastIsPr = several && last.date === current.prDate;

  return (
    <div>
      {!compact && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Marcas personales">
          {topPRs(series).map((s) => (
            <li key={s.name}>
              <button onClick={() => setName(s.name)} aria-pressed={s.name === current.name}
                className={`rounded-full px-3 py-1.5 text-xs ${s.name === current.name ? "bg-raised ring-1 ring-accent/60" : "border border-line text-muted"}`}>
                🏆 {s.name} <span className="figure text-ink">{fmtNum(s.pr)} kg</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <select value={current.name} onChange={(e) => setName(e.target.value)} aria-label="Ejercicio"
        className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm">
        {series.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name} · {s.sessions} {s.sessions === 1 ? "sesión" : "sesiones"}
          </option>
        ))}
      </select>

      <p className="mt-3 text-sm">
        Marca personal: <span className="figure text-ok">{fmtNum(current.pr)} kg</span>
        <span className="text-xs text-muted"> · {fmtLongDate(current.prDate)}</span>
      </p>
      {!compact && several && (lastIsPr || gain > 0) && (
        <p className="mt-1 text-sm text-accent">
          {lastIsPr ? "¡Nueva marca personal! 🏆" : `${fmtDelta(gain)} kg desde tu primera sesión 💪`}
        </p>
      )}
      {compact && several && gain !== 0 && (
        <p className="mt-1 text-xs text-muted">{fmtDelta(gain)} kg desde la primera sesión</p>
      )}

      {several ? (
        <TrendChart key={current.name} data={current.points} unit="kg" height={compact ? 160 : 200}
          prDate={current.prDate}
          label={`${current.name}: peso máximo por sesión, de ${fmtNum(first.value)} a ${fmtNum(last.value)} kg; marca personal ${fmtNum(current.pr)} kg`} />
      ) : (
        <p className="mt-3 rounded-xl bg-raised p-4 text-center text-sm text-muted">
          Con una sesión más de este ejercicio verás la gráfica.
        </p>
      )}
    </div>
  );
}
