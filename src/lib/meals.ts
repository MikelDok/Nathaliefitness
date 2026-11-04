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
