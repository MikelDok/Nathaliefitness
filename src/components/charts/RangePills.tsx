"use client";

import { RANGES, type Range } from "@/lib/progress";

/** Selector de rango: 1 m · 3 m · 6 m · Todo. */
export default function RangePills({ value, onChange, label }: {
  value: Range; onChange: (r: Range) => void; label: string;
}) {
  return (
    <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={label}>
      {RANGES.map((r) => (
        <button key={r.value} onClick={() => onChange(r.value)} role="radio" aria-checked={value === r.value}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${value === r.value ? "bg-accent text-accent-ink" : "text-muted"}`}>
          {r.label}
        </button>
      ))}
    </div>
  );
}
