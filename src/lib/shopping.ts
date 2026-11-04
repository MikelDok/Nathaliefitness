// Lista de la compra a partir de los ingredientes de las comidas del plan.
// La usan la clienta (/compra) y la coach (/coach/nutricion/[id]/compra).
// Ingredientes: una línea por ingrediente, p. ej. "200 g lentejas".

import { fmtNum } from "@/lib/progress";

export type Item = { qty: number | null; unit: string; name: string; key: string };

/** "200 g lentejas" → { qty: 200, unit: "g", name: "lentejas" }. Sin cantidad: qty null. */
export function parseLine(line: string): Item {
  const m = line.trim().match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|ud|uds|x|tr|cdta|cda)?\.?\s+(.+)$/i);
  if (m) {
    const name = m[3].trim();
    const unit = (m[2] || "x").toLowerCase();
    return { qty: parseFloat(m[1].replace(",", ".")), unit, name, key: `${name.toLowerCase()}|${unit}` };
  }
  const name = line.trim();
  return { qty: null, unit: "", name, key: name.toLowerCase() };
}

/**
 * Suma los ingredientes de las comidas (mismo nombre y unidad = misma
 * línea) y multiplica por personas. Orden alfabético.
 */
export function aggregate(meals: { ingredients: string[] | null }[], persons: number): Item[] {
  const map = new Map<string, Item>();
  meals
    .flatMap((m) => m.ingredients || [])
    .filter((line) => line.trim())
    .forEach((line) => {
      const it = parseLine(line);
      const prev = map.get(it.key);
      if (prev && prev.qty != null && it.qty != null) prev.qty += it.qty;
      else if (!prev) map.set(it.key, { ...it });
    });
  return [...map.values()]
    .map((it) => ({ ...it, qty: it.qty != null ? it.qty * persons : null }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** "1,2 kg · pechuga de pollo", "3 × huevos", "sal ×2". */
export function formatItem(i: Item, persons: number): string {
  if (i.qty == null) return i.name + (persons > 1 ? ` ×${persons}` : "");
  let qty = i.qty, unit = i.unit;
  if (unit === "g" && qty >= 1000) { qty /= 1000; unit = "kg"; }
  if (unit === "ml" && qty >= 1000) { qty /= 1000; unit = "l"; }
  return `${fmtNum(qty, 2)} ${unit === "x" ? "×" : unit} · ${i.name}`;
}

/** Texto plano para pegar en WhatsApp o en una nota. */
export function toPlainText(items: Item[], persons: number, title: string, subtitle: string): string {
  const lines = items.map((i) => `• ${formatItem(i, persons).replace(" · ", " ")}`);
  return [`🛒 Lista de la compra — ${title}`, subtitle, "", ...lines].join("\n");
}

/** "días 1-7", "días 1, 3 y 5", "día 2". */
export function describeDays(days: number[]): string {
  const d = [...days].sort((a, b) => a - b);
  if (d.length === 0) return "ningún día";
  if (d.length === 1) return `día ${d[0]}`;
  const consecutive = d.every((v, i) => i === 0 || v === d[i - 1] + 1);
  if (consecutive) return `días ${d[0]}-${d[d.length - 1]}`;
  return `días ${d.slice(0, -1).join(", ")} y ${d[d.length - 1]}`;
}
