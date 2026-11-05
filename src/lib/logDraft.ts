// Guardado automático del registro de series (exercise_logs).
// Un registro por clienta, ejercicio del programa y día (índice único, 0015).
// Mientras Supabase no confirma, el estado vive en un borrador de
// localStorage para que recargar o cerrar la app no lo pierda.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Fila de la pantalla: todas las series del esquema, marcadas o no. */
export type SetRow = { reps: number; kg: number; done: boolean };
/** Serie guardada: solo las marcadas; `n` es su número (1, 2, 3…). */
export type LogSet = { reps: number; kg: number; n?: number };

export type Draft = { peId: string; day: string; rows: SetRow[]; note: string };

const PREFIX = "nea:log:";
const keyOf = (peId: string, day: string) => `${PREFIX}${peId}:${day}`;

/** Lo que se guarda en `sets`: las series marcadas, con su número. */
export function toSets(rows: SetRow[]): LogSet[] {
  return rows.flatMap((r, i) => (r.done ? [{ reps: r.reps, kg: r.kg, n: i + 1 }] : []));
}

/**
 * Firma de lo que debería haber en Supabase. Sin series marcadas no hay
 * registro (la nota sola espera en el borrador al primer ✓).
 */
export function signature(rows: SetRow[], note: string): string {
  const sets = toSets(rows);
  return sets.length ? JSON.stringify({ sets, note: note.trim() || null }) : "[]";
}

export function readDraft(peId: string, day: string): Draft | null {
  try {
    const raw = localStorage.getItem(keyOf(peId, day));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch { return null; }
}

export function writeDraft(d: Draft) {
  try { localStorage.setItem(keyOf(d.peId, d.day), JSON.stringify(d)); } catch { /* sin espacio o modo privado */ }
}

export function clearDraft(peId: string, day: string) {
  try { localStorage.removeItem(keyOf(peId, day)); } catch { /* nada */ }
}

/** Todos los borradores pendientes (de cualquier ejercicio y día). */
export function allDrafts(): Draft[] {
  const out: Draft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const d = JSON.parse(localStorage.getItem(k) || "null") as Draft | null;
      if (d?.peId && d.day && Array.isArray(d.rows)) out.push(d);
    }
  } catch { /* nada */ }
  return out;
}

/** ¿Hay que conservar el borrador aunque Supabase esté al día? (nota sin series) */
export const keepsDraft = (rows: SetRow[], note: string) =>
  toSets(rows).length === 0 && note.trim() !== "";

/**
 * Envía el estado a Supabase: crea o actualiza el registro del día si hay
 * series marcadas; si no queda ninguna, lo borra. Devuelve si fue bien.
 */
export async function pushLog(sb: SupabaseClient, uid: string, d: Draft): Promise<boolean> {
  const sets = toSets(d.rows);
  try {
    if (!sets.length) {
      const { error } = await sb.from("exercise_logs").delete()
        .eq("client_id", uid).eq("program_exercise_id", d.peId).eq("performed_at", d.day);
      return !error;
    }
    const { error } = await sb.from("exercise_logs").upsert({
      client_id: uid,
      program_exercise_id: d.peId,
      performed_at: d.day,
      sets,
      note: d.note.trim() || null,
    }, { onConflict: "client_id,program_exercise_id,performed_at" });
    return !error;
  } catch { return false; }
}

/** Envía los borradores pendientes (salvo `except`, que gestiona su pantalla). */
export async function flushDrafts(sb: SupabaseClient, uid: string, except?: { peId: string; day: string }) {
  for (const d of allDrafts()) {
    if (except && d.peId === except.peId && d.day === except.day) continue;
    if (await pushLog(sb, uid, d)) {
      if (!keepsDraft(d.rows, d.note)) clearDraft(d.peId, d.day);
    }
  }
}
