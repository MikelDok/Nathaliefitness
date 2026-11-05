/**
 * Mapa corporal: zonas de la silueta (BodyMap) y su relación con
 * exercises.muscle_group. Un solo sitio para añadir grupos o zonas.
 */

export type Zone =
  | "pecho" | "hombros" | "biceps" | "triceps" | "antebrazos" | "core"
  | "espalda_alta" | "lumbar" | "gluteos" | "cuadriceps" | "isquios" | "gemelos";

export type View = "front" | "back";

/** Nombre de cada zona (aria-label y textos) y vistas en las que aparece. */
export const ZONES: Record<Zone, { label: string; views: View[] }> = {
  pecho: { label: "Pecho", views: ["front"] },
  hombros: { label: "Hombros", views: ["front", "back"] },
  biceps: { label: "Bíceps", views: ["front"] },
  triceps: { label: "Tríceps", views: ["back"] },
  antebrazos: { label: "Antebrazos", views: ["front", "back"] },
  core: { label: "Abdomen y core", views: ["front"] },
  espalda_alta: { label: "Espalda alta", views: ["back"] },
  lumbar: { label: "Lumbar", views: ["back"] },
  gluteos: { label: "Glúteos", views: ["back"] },
  cuadriceps: { label: "Cuádriceps", views: ["front"] },
  isquios: { label: "Isquiotibiales", views: ["back"] },
  gemelos: { label: "Gemelos", views: ["back"] },
};

/**
 * Grupos musculares de la biblioteca (lista del panel, en este orden).
 * Cardio y Movilidad no tienen zona en la silueta.
 */
export const MUSCLE_GROUPS = [
  "Cuádriceps", "Isquiotibial", "Glúteos", "Gemelos", "Espalda", "Pecho", "Hombros",
  "Bíceps", "Tríceps", "Antebrazos", "Core", "Cardio", "Movilidad",
];

/** Grupos sin zona: en la guía salen como chips aparte. */
export const ZONELESS_GROUPS = ["Cardio", "Movilidad"];

/** Minúsculas y sin tildes: "Cuádriceps" y "cuadriceps" son el mismo grupo. */
export const normalize = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type GroupInfo = { zones: Zone[]; word: string | null };

/** muscle_group normalizado → zonas que resalta y palabra para "Hoy trabajas". */
const GROUPS: Record<string, GroupInfo> = {
  cuadriceps: { zones: ["cuadriceps"], word: "pierna" },
  isquiotibial: { zones: ["isquios"], word: "pierna" },
  isquiotibiales: { zones: ["isquios"], word: "pierna" },
  gluteos: { zones: ["gluteos"], word: "glúteo" },
  gemelos: { zones: ["gemelos"], word: "pierna" },
  espalda: { zones: ["espalda_alta", "lumbar"], word: "espalda" },
  pecho: { zones: ["pecho"], word: "pecho" },
  hombros: { zones: ["hombros"], word: "hombro" },
  biceps: { zones: ["biceps"], word: "brazo" },
  triceps: { zones: ["triceps"], word: "brazo" },
  antebrazos: { zones: ["antebrazos"], word: "brazo" },
  core: { zones: ["core"], word: "core" },
  cardio: { zones: [], word: null },
  movilidad: { zones: [], word: null },
};

/** Zonas que resalta un grupo muscular (vacío si no tiene o no se reconoce). */
export const zonesOf = (group: string | null | undefined): Zone[] =>
  GROUPS[normalize(group)]?.zones ?? [];

/** Zonas de varios grupos, sin repetir. */
export const zonesOfGroups = (groups: (string | null | undefined)[]): Zone[] =>
  [...new Set(groups.flatMap(zonesOf))];

/** Grupos de la biblioteca que corresponden a una zona (para filtrar en la guía). */
export const groupsOfZone = (zone: Zone): string[] =>
  Object.entries(GROUPS).filter(([, g]) => g.zones.includes(zone)).map(([k]) => k);

/** "pierna y glúteo", "pecho, hombro y brazo"… o null si no hay ninguna palabra. */
export function workSummary(groups: (string | null | undefined)[]): string | null {
  const words = [...new Set(groups.map((g) => GROUPS[normalize(g)]?.word).filter(Boolean))] as string[];
  if (words.length === 0) return null;
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} y ${words[words.length - 1]}`;
}

/** Vista que mejor enseña un grupo: la de su primera zona (delante por defecto). */
export const viewOf = (group: string | null | undefined): View => {
  const z = zonesOf(group)[0];
  return z ? ZONES[z].views[0] : "front";
};
