// Fechas de calendario ("YYYY-MM-DD") en la hora local de quien usa la app.
// Fuente única: nunca toISOString().slice(0, 10), que da el día en UTC
// (en España, entre las 00:00 y la 01:00/02:00 devolvería el día anterior).

/** Fecha local → "YYYY-MM-DD". Sin argumento, hoy. */
export function localDay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * "YYYY-MM-DD" → Date local a medianoche. new Date("YYYY-MM-DD") la
 * interpreta en UTC y al formatearla podría mostrar el día anterior.
 */
export function parseLocalDay(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** El lunes de la semana de esa fecha, como "YYYY-MM-DD" (check-ins). */
export function localMonday(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return localDay(x);
}

/** Suma (o resta) días de calendario a una fecha local. */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
