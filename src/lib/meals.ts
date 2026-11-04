/** Franjas del plan de comidas, en el orden en que se muestran. */
export const MEAL_SLOTS = ["Desayuno", "Almuerzo", "Comida", "Snack", "Picoteo", "Cena"];

const rank = (slot: string) => {
  const i = MEAL_SLOTS.findIndex((s) => s.toLowerCase() === slot.trim().toLowerCase());
  return i === -1 ? MEAL_SLOTS.length : i; // franjas antiguas o desconocidas, al final
};

/** Ordena por franja según MEAL_SLOTS (estable: respeta el orden previo dentro de cada franja). */
export function sortBySlot<T extends { slot: string }>(meals: T[]): T[] {
  return [...meals].sort((a, b) => rank(a.slot) - rank(b.slot));
}

/** Máximo de semanas de un plan de comidas (check de meal_plans.weeks, 0014). */
export const MAX_MEAL_WEEKS = 4;

/**
 * Semana del plan que toca hoy. El plan rota: uno de 4 semanas vuelve a la
 * 1 en la quinta. Sin fecha de inicio o antes de empezar: semana 1.
 */
export function currentWeek(startsOn: string | null, weeks: number, now = new Date()): number {
  if (!startsOn || weeks <= 1) return 1;
  const [y, m, d] = startsOn.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - start.getTime()) / 86400000);
  if (days < 0) return 1;
  return (Math.floor(days / 7) % weeks) + 1;
}
