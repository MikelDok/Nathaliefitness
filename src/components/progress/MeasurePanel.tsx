"use client";

import { useState } from "react";
import TrendPanel from "@/components/progress/TrendPanel";
import { usedFields, type Measurement } from "@/lib/measurements";
import { seriesOf } from "@/lib/progress";

/** Medidas corporales (sin el peso): chips con las que tienen datos + su gráfica. */
export default function MeasurePanel({ measurements }: { measurements: Measurement[] }) {
  const fields = usedFields(measurements).filter((f) => f.key !== "weight_kg");
  const [key, setKey] = useState(fields[0]?.key);
  const field = fields.find((f) => f.key === key) ?? fields[0];

  if (!field) {
    return (
      <p className="mt-2 text-sm text-muted">
        Aún no has registrado medidas. Añádelas en &ldquo;Más medidas&rdquo;, en la tarjeta de peso.
      </p>
    );
  }

  return (
    <>
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Medida">
        {fields.map((f) => (
          <button key={f.key} onClick={() => setKey(f.key)} role="radio" aria-checked={f.key === field.key}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${f.key === field.key ? "bg-raised text-ink ring-1 ring-accent/60" : "border border-line text-muted"}`}>
            {f.label}
          </button>
        ))}
      </div>
      {/* key: al cambiar de medida, el panel empieza de nuevo (rango por defecto) */}
      <TrendPanel key={field.key} points={seriesOf(measurements, field.key)} name={field.label}
        unit={field.unit} showValue emptyText="" />
    </>
  );
}
