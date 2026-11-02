// Generación de ficheros .ics (iCalendar, RFC 5545) a mano: son cuatro
// reglas de formato y evita meter una dependencia para esto.

import type { Appointment } from "./agenda";

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha en UTC con el formato 20250912T170000Z. */
function icsStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** En iCalendar, \ ; , y los saltos de línea van escapados. */
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Las líneas no pueden pasar de 75 octetos: se parten con un espacio delante. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

/** Un .ics con una cita y un recordatorio una hora antes. */
export function appointmentToIcs(a: Appointment, organiser = "Nathalie · Personal Trainer"): string {
  const start = new Date(a.starts_at);
  const end = new Date(start.getTime() + a.duration_min * 60000);
  const description = [a.note, a.kind === "videollamada" ? a.location : null]
    .filter(Boolean).join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${organiser}//ES`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.id}@nathalie-app`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(a.title)}`,
    a.location ? `LOCATION:${esc(a.location)}` : null,
    description ? `DESCRIPTION:${esc(description)}` : null,
    `STATUS:${a.status === "cancelada" ? "CANCELLED" : "CONFIRMED"}`,
    // recordatorio 1 h antes
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(a.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);

  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Descarga el .ics. El navegador lo abre en Google/Apple Calendar. */
export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** "cita-sesion-de-fuerza.ics" */
export function icsFilename(title: string): string {
  const slug = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cita";
  return `cita-${slug}.ics`;
}
