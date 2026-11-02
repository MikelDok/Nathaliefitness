// Citas y planificación de entrenos. El hilo de una agenda es su client_id,
// igual que en el chat.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AppointmentKind = "presencial" | "videollamada" | "otro";

export type Appointment = {
  id: string;
  client_id: string;
  created_by: string;
  title: string;
  kind: AppointmentKind;
  starts_at: string;
  duration_min: number;
  location: string | null;
  note: string | null;
  status: "confirmada" | "cancelada";
  created_at: string;
  updated_at: string;
  seen_by_client_at: string | null;
  seen_by_coach_at: string | null;
};

export const APPOINTMENT_SELECT =
  "id,client_id,created_by,title,kind,starts_at,duration_min,location,note,status," +
  "created_at,updated_at,seen_by_client_at,seen_by_coach_at";

export const KINDS: { value: AppointmentKind; label: string; icon: string }[] = [
  { value: "presencial", label: "Presencial", icon: "📍" },
  { value: "videollamada", label: "Videollamada", icon: "🎥" },
  { value: "otro", label: "Otro", icon: "🗓" },
];

export const WEEKDAYS = [
  { value: 1, label: "Lunes", short: "L" },
  { value: 2, label: "Martes", short: "M" },
  { value: 3, label: "Miércoles", short: "X" },
  { value: 4, label: "Jueves", short: "J" },
  { value: 5, label: "Viernes", short: "V" },
  { value: 6, label: "Sábado", short: "S" },
  { value: 7, label: "Domingo", short: "D" },
];

// ---------- Fechas ----------
// Todo se calcula sobre la fecha LOCAL. Pasar por UTC cambiaría el día en
// según qué franja horaria.

/** "YYYY-MM-DD" de una fecha local. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" -> Date local a medianoche (no new Date(str), que asume UTC). */
export function parseDateKey(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 1 = lunes … 7 = domingo. */
export function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

/** Número de día absoluto, inmune al cambio de hora (usa Y/M/D, no ms). */
function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/** El lunes de la semana de esa fecha. */
export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return dayNumber(a) === dayNumber(b);
}

// ---------- Planificación ----------

export type Plan = {
  id: string;
  title: string;
  weeks: number;
  days_per_week: number;
  starts_on: string | null;
  weekdays: number[] | null;
};

export const PLAN_SELECT = "id,title,weeks,days_per_week,starts_on,weekdays";

/**
 * Qué sesión del programa cae en esa fecha, o null si es descanso, si el
 * programa no está planificado o si la fecha queda fuera de sus semanas.
 * La semana se ancla al LUNES de la semana de inicio, para que "Semana 2"
 * coincida con la semana natural del calendario.
 */
export function sessionOn(plan: Plan | null, date: Date): { week: number; day: number } | null {
  if (!plan?.starts_on || !plan.weekdays?.length) return null;
  const dayIdx = plan.weekdays.indexOf(isoWeekday(date));
  if (dayIdx < 0) return null;
  const start = parseDateKey(plan.starts_on);
  // nada antes de la fecha de inicio, aunque caiga en la misma semana que ella
  if (dayNumber(date) < dayNumber(start)) return null;
  const diff = dayNumber(date) - dayNumber(mondayOf(start));
  if (diff < 0) return null;
  const week = Math.floor(diff / 7) + 1;
  if (week > plan.weeks) return null;
  return { week, day: dayIdx + 1 };
}

// ---------- Avisos ----------

/** Citas que aún no he visto, por hilo. La RLS ya limita lo que veo. */
export async function pendingByThread(
  sb: SupabaseClient,
  myId: string,
  asCoach: boolean,
): Promise<Record<string, number>> {
  const col = asCoach ? "seen_by_coach_at" : "seen_by_client_at";
  const { data } = await sb
    .from("appointments")
    .select("client_id")
    .is(col, null)
    .neq("created_by", myId);
  const out: Record<string, number> = {};
  ((data || []) as { client_id: string }[]).forEach((a) => {
    out[a.client_id] = (out[a.client_id] || 0) + 1;
  });
  return out;
}

export async function pendingTotal(
  sb: SupabaseClient,
  myId: string,
  asCoach: boolean,
): Promise<number> {
  const col = asCoach ? "seen_by_coach_at" : "seen_by_client_at";
  const { count } = await sb
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .is(col, null)
    .neq("created_by", myId);
  return count || 0;
}

// ---------- Formato ----------

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
