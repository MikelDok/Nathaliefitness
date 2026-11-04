// Cálculos de las gráficas de progreso. Funciones puras: las usan la
// pestaña Progreso de la clienta y la ficha de la coach.

import type { Measurement, MeasurementKey } from "@/lib/measurements";

/** Un punto de una serie: fecha YYYY-MM-DD y valor. */
export type Point = { date: string; value: number };

export type Range = "1m" | "3m" | "6m" | "all";
export const RANGES: { value: Range; label: string; months: number | null }[] = [
  { value: "1m", label: "1 m", months: 1 },
  { value: "3m", label: "3 m", months: 3 },
  { value: "6m", label: "6 m", months: 6 },
  { value: "all", label: "Todo", months: null },
];

/** Registro de entreno tal como llega de exercise_logs (+ nombre del ejercicio). */
export type LoadLog = {
  performed_at: string;
  sets: { reps: number; kg: number }[] | null;
  name: string | null;
};

/** Serie de cargas de un ejercicio: kg máximo por sesión. */
export type LoadSeries = { name: string; points: Point[]; pr: number; prDate: string; sessions: number };

/**
 * "2026-11-04" → fecha local a medianoche. new Date("2026-11-04") la
 * interpreta en UTC y en España podría mostrar el día anterior.
 */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Fecha local → "YYYY-MM-DD". */
export function toDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Puntos dentro del rango (desde hoy hacia atrás). Mantiene el orden. */
export function filterRange(points: Point[], range: Range, now = new Date()): Point[] {
  const months = RANGES.find((r) => r.value === range)?.months;
  if (!months) return points;
  const from = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return points.filter((p) => parseDay(p.date) >= from);
}

/** Serie de una medida, solo con las fechas que tienen dato, de la más antigua a la más reciente. */
export function seriesOf(rows: Measurement[], key: MeasurementKey): Point[] {
  return rows
    .filter((r) => r[key] != null)
    .map((r) => ({ date: r.measured_at, value: Number(r[key]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Agrupa los registros por ejercicio y se queda con el kg máximo de cada
 * día (si hay varios registros el mismo día, cuenta uno). Los ejercicios
 * sin peso (cardio, calentamiento: todo a 0 kg) no aparecen.
 * Orden: los que tienen más sesiones primero.
 */
export function loadsByExercise(logs: LoadLog[]): LoadSeries[] {
  const byName = new Map<string, Map<string, number>>();
  for (const l of logs) {
    if (!l.name) continue;
    const kg = (l.sets || []).reduce((m, s) => Math.max(m, Number(s.kg) || 0), 0);
    if (kg <= 0) continue;
    const day = l.performed_at.slice(0, 10);
    const days = byName.get(l.name) ?? new Map<string, number>();
    days.set(day, Math.max(days.get(day) ?? 0, kg));
    byName.set(l.name, days);
  }
  return [...byName.entries()]
    .map(([name, days]) => {
      const points = [...days.entries()]
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
      // la primera vez que alcanzó su máximo
      const best = points.reduce((b, p) => (p.value > b.value ? p : b), points[0]);
      return { name, points, pr: best.value, prDate: best.date, sessions: points.length };
    })
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "es"));
}

/** Las n mejores marcas personales (para los chips). */
export function topPRs(series: LoadSeries[], n = 3): LoadSeries[] {
  return [...series].sort((a, b) => b.pr - a.pr).slice(0, n);
}

/** Número en español: 71,2 · 42,5 · 120. */
export function fmtNum(n: number, decimals = 1): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: decimals });
}

/** Diferencia con signo tipográfico: "+10", "−7,2", "0". */
export function fmtDelta(n: number, decimals = 1): string {
  const r = Math.round(n * 10 ** decimals) / 10 ** decimals;
  if (r === 0) return "0";
  return `${r > 0 ? "+" : "−"}${fmtNum(Math.abs(r), decimals)}`;
}

/** "12 oct" (y el año si no es el actual: "12 oct 25"). */
export function fmtShortDate(iso: string): string {
  const d = parseDay(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("es-ES", sameYear
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "2-digit" }).replace(".", "");
}

/** "12 oct 2026", para tooltips y textos accesibles. */
export function fmtLongDate(iso: string): string {
  return parseDay(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
}
