// Definición única de las medidas de progreso. La usan el formulario de la
// clienta, la ficha de la entrenadora, la exportación a Excel y el informe
// imprimible: añadir una medida nueva se hace aquí y en una migración.

export type MeasurementKey =
  | "weight_kg" | "waist_cm" | "chest_cm" | "shoulders_cm" | "hip_cm"
  | "arm_cm" | "thigh_cm" | "calf_cm" | "neck_cm" | "legs_cm";

export type Measurement = { id: string; measured_at: string; note: string | null } &
  Record<MeasurementKey, number | null>;

export type Field = { key: MeasurementKey; label: string; unit: string; legacy?: boolean };

/** Orden en el que se muestran en todas las pantallas. */
export const FIELDS: Field[] = [
  { key: "weight_kg", label: "Peso", unit: "kg" },
  { key: "waist_cm", label: "Cintura", unit: "cm" },
  { key: "chest_cm", label: "Pecho", unit: "cm" },
  { key: "shoulders_cm", label: "Hombros", unit: "cm" },
  { key: "hip_cm", label: "Cadera", unit: "cm" },
  { key: "arm_cm", label: "Brazo", unit: "cm" },
  { key: "thigh_cm", label: "Muslo", unit: "cm" },
  { key: "calf_cm", label: "Gemelo", unit: "cm" },
  { key: "neck_cm", label: "Cuello", unit: "cm" },
  // Legado: nunca tuvo formulario; muslo y gemelo la sustituyen. Se sigue
  // mostrando y exportando si alguna medición antigua tuviera dato.
  { key: "legs_cm", label: "Piernas", unit: "cm", legacy: true },
];

/** Columnas para el .select() de Supabase. */
export const SELECT = ["id", "measured_at", "note", ...FIELDS.map((f) => f.key)].join(",");

/** Peso y cintura: siempre visibles en el formulario de la clienta. */
export const MAIN_FIELDS = FIELDS.filter((f) => f.key === "weight_kg" || f.key === "waist_cm");

/** El resto: van dentro del desplegable "Más medidas". Sin las de legado. */
export const EXTRA_FIELDS = FIELDS.filter((f) => !f.legacy && !MAIN_FIELDS.includes(f));

/** Solo las medidas con algún dato: evita tablas de 10 columnas vacías. */
export function usedFields(rows: Measurement[]): Field[] {
  return FIELDS.filter((f) => rows.some((r) => r[f.key] != null));
}

/** Una fila por fecha, con las cabeceras en español, para el .xlsx. */
export function toExportRows(rows: Measurement[]): Record<string, string | number>[] {
  const cols = usedFields(rows);
  return rows.map((r) => {
    const row: Record<string, string | number> = { Fecha: r.measured_at };
    cols.forEach((f) => { row[`${f.label} (${f.unit})`] = r[f.key] ?? ""; });
    row["Nota"] = r.note ?? "";
    return row;
  });
}

/** "12/03/2025" a partir de un date de Postgres (YYYY-MM-DD). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES");
}
