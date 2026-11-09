// Esquema de series de un ejercicio del programa (`program_exercises.set_scheme`).
// Fuente única: el constructor de la coach lo escribe y todas las pantallas
// lo leen con estas funciones.
//
// Formato canónico: series separadas por "/" y, dentro de cada una, un
// número fijo o un rango con guion: "10/10/10/10", "6-10/6-10/6-10/6-10",
// "8/8/6". Lo que no son series (cardio, calentamiento: "15 min") es texto.
// Los esquemas antiguos se leen de forma tolerante (ver parseScheme).

/** Objetivo de una serie: fijo si min === max. */
export type SetTarget = { min: number; max: number };
export type Scheme =
  | { kind: "sets"; sets: SetTarget[] }
  | { kind: "text"; text: string };

export const MAX_SETS = 10;
export const MAX_REPS = 100;

/** Tipos de serie del constructor. */
export const SET_TYPES = ["normal", "calentamiento", "cardio", "superserie", "dropset"];
/** Tipos que por defecto se escriben como texto libre ("15 min"). */
export const isFreeTextType = (type: string | null | undefined) =>
  type === "cardio" || type === "calentamiento";

const clampReps = (n: number) => Math.min(MAX_REPS, Math.max(1, Math.round(n) || 1));

/** Objetivo con los extremos ordenados y dentro de límites. */
export function target(a: number, b: number = a): SetTarget {
  const x = clampReps(a), y = clampReps(b);
  return { min: Math.min(x, y), max: Math.max(x, y) };
}

const many = (n: number, t: SetTarget): SetTarget[] =>
  Array.from({ length: Math.min(MAX_SETS, Math.max(1, n)) }, () => ({ ...t }));

/**
 * Interpreta un esquema, también los escritos a mano:
 * espacios sueltos, "–"/"—" o " a " como guion, comas como "/",
 * "4x10" y "4x6-10", y "10-10-10-10" (tres o más números con guiones = series;
 * dos números con guion son un rango de una serie). Lo demás es texto.
 */
export function parseScheme(raw: string | null | undefined): Scheme {
  const text = (raw ?? "").trim();
  const s = text.toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+a\s+/g, "-")
    .replace(/[×*]/g, "x")
    .replace(/,/g, "/")
    .replace(/\s+/g, "")
    .replace(/^\/+|\/+$/g, "");
  if (!s) return { kind: "text", text };

  const nx = s.match(/^(\d+)x(\d+)(?:-(\d+))?$/);
  if (nx) {
    const n = +nx[1];
    if (n < 1) return { kind: "text", text };
    return { kind: "sets", sets: many(n, target(+nx[2], nx[3] ? +nx[3] : +nx[2])) };
  }
  if (/^\d+(-\d+){2,}$/.test(s)) {
    return { kind: "sets", sets: s.split("-").slice(0, MAX_SETS).map((n) => target(+n)) };
  }
  if (/^\d+(-\d+)?(\/\d+(-\d+)?)*$/.test(s)) {
    return {
      kind: "sets",
      sets: s.split("/").slice(0, MAX_SETS).map((p) => {
        const [a, b] = p.split("-");
        return target(+a, b ? +b : +a);
      }),
    };
  }
  return { kind: "text", text };
}

/** "10" o "6-10". */
export const targetLabel = (t: SetTarget) => (t.min === t.max ? `${t.min}` : `${t.min}-${t.max}`);

/** Formato canónico para guardar. */
export const toScheme = (sets: SetTarget[]) => sets.map(targetLabel).join("/");

/** El objetivo común si todas las series son iguales; si no, null. */
export function uniform(sets: SetTarget[]): SetTarget | null {
  const [f] = sets;
  return f && sets.every((t) => t.min === f.min && t.max === f.max) ? f : null;
}

/** "4 series · 6-10 reps", "3 series · 8/8/6 reps" o el texto ("15 min"). */
export function schemeSummary(raw: string | null | undefined): string {
  const p = parseScheme(raw);
  if (p.kind === "text") return p.text;
  const n = p.sets.length;
  const u = uniform(p.sets);
  return `${n} ${n === 1 ? "serie" : "series"} · ${u ? targetLabel(u) : toScheme(p.sets)} reps`;
}

/** Para listas: "4×6-10", "8/8/6" o el texto. */
export function schemeShort(raw: string | null | undefined): string {
  const p = parseScheme(raw);
  if (p.kind === "text") return p.text;
  const u = uniform(p.sets);
  return u ? `${p.sets.length}×${targetLabel(u)}` : toScheme(p.sets);
}

// ---------- Estado del editor del constructor ----------

/** Fila de "Personalizar por serie": fija o rango. */
export type CustomRow = { min: number; max: number; range: boolean };
export type SchemeDraft = {
  /** fixed/range: todas las series iguales; custom: una fila por serie; text: libre */
  mode: "fixed" | "range" | "custom" | "text";
  count: number;
  min: number;
  max: number;
  custom: CustomRow[];
  text: string;
};

export const DEFAULT_DRAFT: SchemeDraft = {
  mode: "fixed", count: 4, min: 10, max: 12, custom: [], text: "",
};

/** Estado del editor a partir de lo guardado. */
export function draftFromScheme(raw: string | null | undefined): SchemeDraft {
  const p = parseScheme(raw);
  if (p.kind === "text") return { ...DEFAULT_DRAFT, mode: "text", text: p.text };
  const u = uniform(p.sets);
  const base = { ...DEFAULT_DRAFT, count: p.sets.length };
  if (u) return u.min === u.max
    ? { ...base, mode: "fixed", min: u.min, max: Math.min(MAX_REPS, u.min + 2) }
    : { ...base, mode: "range", min: u.min, max: u.max };
  return {
    ...base, mode: "custom", min: p.sets[0].min, max: p.sets[0].max,
    custom: p.sets.map((t) => ({ min: t.min, max: t.max, range: t.min !== t.max })),
  };
}

/** Lo que se guarda en `set_scheme`. */
export function draftToScheme(d: SchemeDraft): string {
  switch (d.mode) {
    case "text": return d.text.trim() || "10 min";
    case "fixed": return toScheme(many(d.count, target(d.min)));
    case "range": return toScheme(many(d.count, target(d.min, d.max)));
    case "custom": return toScheme(d.custom.map((r) => target(r.min, r.range ? r.max : r.min)));
  }
}
