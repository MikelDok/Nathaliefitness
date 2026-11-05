"use client";

import { useId } from "react";
import {
  Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtLongDate, fmtNum, fmtShortDate, parseDay, toDay, type Point } from "@/lib/progress";

type Datum = { t: number; date: string; value: number };

/** Colores del tema (variables de globals.css): sin hex nuevos. */
const C = {
  accent: "var(--color-accent)",
  ok: "var(--color-ok)",
  line: "var(--color-line)",
  muted: "var(--color-muted)",
  bg: "var(--color-bg)",
};

/** Paso "redondo" (1, 2, 2,5, 5, 10 × 10ⁿ) para unas 3 divisiones del eje Y. */
function niceTicks(min: number, max: number): number[] {
  const span = Math.max(max - min, 1);
  const raw = (span * 1.4) / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const lo = Math.max(0, Math.floor((min - span * 0.2) / step) * step);
  const hi = Math.ceil((max + span * 0.2) / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

function ChartTooltip({ active, payload, unit }: {
  active?: boolean; payload?: readonly { payload?: Datum }[]; unit: string;
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="rounded-lg bg-raised px-2.5 py-1.5 text-xs shadow-lg">
      <p className="text-muted">{fmtLongDate(d.date)}</p>
      <p className="figure text-sm">{fmtNum(d.value)} {unit}</p>
    </div>
  );
}

/**
 * Línea con área suave para una serie temporal (peso, una medida, kg por
 * sesión). Necesita al menos 2 puntos: los estados vacíos los resuelve
 * quien la usa. Destaca el último valor y, si se indica, la marca personal.
 */
export default function TrendChart({ data, unit, label, height = 200, prDate }: {
  data: Point[];
  unit: string;
  /** resumen accesible, p. ej. "Peso: de 78,4 a 71,2 kg entre…" */
  label: string;
  height?: number;
  /** fecha de la marca personal (punto 🏆 en verde) */
  prDate?: string;
}) {
  const gradId = `grad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const rows: Datum[] = data.map((p) => ({ t: parseDay(p.date).getTime(), date: p.date, value: p.value }));
  const values = rows.map((r) => r.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const last = rows[rows.length - 1];
  const pr = prDate ? rows.find((r) => r.date === prDate) : undefined;

  return (
    <div role="img" aria-label={label} className="mt-3 -ml-2 select-none">
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 320, height }}>
        <AreaChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.line} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => fmtShortDate(toDay(new Date(t)))}
            tick={{ fill: C.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.line }}
            minTickGap={28} tickMargin={6} />
          <YAxis domain={[ticks[0], ticks[ticks.length - 1]]} ticks={ticks} width={38}
            tick={{ fill: C.muted, fontSize: 11 }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => fmtNum(v)} />
          <Tooltip content={<ChartTooltip unit={unit} />}
            cursor={{ stroke: C.muted, strokeDasharray: "3 3" }} />
          <Area type="monotone" dataKey="value" stroke={C.accent} strokeWidth={2.5}
            fill={`url(#${gradId})`} dot={false} animationDuration={600}
            activeDot={{ r: 5, fill: C.accent, stroke: C.bg, strokeWidth: 2 }} />
          {pr && pr !== last && (
            <ReferenceDot x={pr.t} y={pr.value} r={5} fill={C.ok} stroke={C.bg} strokeWidth={2} />
          )}
          <ReferenceDot x={last.t} y={last.value} r={6}
            fill={pr === last ? C.ok : C.accent} stroke={C.bg} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
