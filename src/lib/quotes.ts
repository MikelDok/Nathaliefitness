/**
 * Frase del día en Inicio: una por día de la semana (0 = domingo … 6 = sábado).
 * Nathalie puede cambiarlas aquí. Cortas, en femenino y sin exclamaciones.
 */
export const DAILY_QUOTES = [
  "Descansar también es parte del plan.",            // domingo
  "Empieza la semana sin prisa y sin pausa.",         // lunes
  "Constancia antes que perfección.",                 // martes
  "Hoy toca moverse un poco más que ayer.",           // miércoles
  "Cada serie cuenta, aunque no lo parezca.",         // jueves
  "Estás más cerca que el lunes.",                    // viernes
  "Muévete por lo bien que te sienta.",               // sábado
];

export const quoteOfDay = (d = new Date()) => DAILY_QUOTES[d.getDay()];
