"use client";

import { useState } from "react";
import TrendChart from "@/components/charts/TrendChart";
import RangePills from "@/components/charts/RangePills";
import { filterRange, fmtDelta, fmtLongDate, fmtNum, type Point, type Range } from "@/lib/progress";

/**
 * Gráfica de una serie (peso o una medida) con selector de rango, valor
 * actual y diferencia en el rango (en color neutro: subir o bajar no es
 * bueno ni malo por sí mismo). Resuelve los estados con pocos datos.
 */
export default function TrendPanel({ points, name, unit, showValue = false, compact = false, emptyText }: {
  points: Point[];
  /** "Peso", "Cintura"… (para textos accesibles) */
  name: string;
  unit: string;
  /** muestra el último valor en grande (la tarjeta de peso de la clienta ya lo tiene) */
  showValue?: boolean;
  compact?: boolean;
  emptyText: string;
}) {
  const [range, setRange] = useState<Range>("3m");

  if (points.length === 0) return <p className="mt-2 text-sm text-muted">{emptyText}</p>;

  const last = points[points.length - 1];
  const value = showValue && (
    <p className="mt-1 flex items-baseline gap-1.5">
      <span className={`figure ${compact ? "text-2xl" : "text-3xl"}`}>{fmtNum(last.value)}</span>
      <span className="text-sm text-muted">{unit}</span>
    </p>
  );

  if (points.length === 1) {
    return (
      <>
        {value}
        <p className="mt-2 text-sm text-muted">Con un registro más verás tu evolución.</p>
      </>
    );
  }

  const shown = filterRange(points, range);
  const enough = shown.length >= 2;
  const delta = enough ? shown[shown.length - 1].value - shown[0].value : 0;

  return (
    <div>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <div>
          {value}
          {enough && (
            <p className="text-xs text-muted">
              <span className="figure text-ink">{fmtDelta(delta)} {unit}</span> en este periodo
            </p>
          )}
        </div>
        <RangePills value={range} onChange={setRange} label={`Periodo de ${name.toLowerCase()}`} />
      </div>
      {enough ? (
        <TrendChart data={shown} unit={unit} height={compact ? 160 : 200}
          label={`${name}: de ${fmtNum(shown[0].value)} a ${fmtNum(shown[shown.length - 1].value)} ${unit} entre el ${fmtLongDate(shown[0].date)} y el ${fmtLongDate(shown[shown.length - 1].date)}`} />
      ) : (
        <div className="mt-3 rounded-xl bg-raised p-4 text-center text-sm text-muted">
          Pocos datos en este periodo.{" "}
          <button onClick={() => setRange("all")} className="font-semibold text-accent underline">Ver todo</button>
        </div>
      )}
    </div>
  );
}
