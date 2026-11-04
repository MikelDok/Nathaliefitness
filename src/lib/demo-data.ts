// Datos de demostración. Cuando NEXT_PUBLIC_SUPABASE_URL esté configurado,
// las pantallas leerán de Supabase; mientras tanto, la app es 100% navegable.

import type { Measurement } from "@/lib/measurements";
import { toDay, type LoadLog } from "@/lib/progress";

export const demo = {
  client: { name: "Laura", coach: "NEA FITNESS" },

  today: {
    dayLabel: "Semana 2 · Día 1 — Tren inferior",
    exercisesDone: 3,
    exercisesTotal: 7,
    habitsDone: 2,
    habitsTotal: 3,
    kcal: { eaten: 0, target: 1910 },
  },

  habits: [
    { id: "h1", title: "10.000 pasos", done: true },
    { id: "h2", title: "2 L de agua", done: true },
    { id: "h3", title: "Dormir 7 h+", done: false },
  ],

  program: {
    title: "Programa personalizado",
    weeks: [1, 2, 3, 4],
    currentWeek: 2,
    days: [1, 2, 3],
    currentDay: 1,
  },

  exercises: [
    { id: "e1", rest: null, name: "Calentamiento tren inferior", muscle: "Movilidad", scheme: "8 min", type: "Calentamiento", done: true, video: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" },
    { id: "e2", rest: 90, name: "Prensa", muscle: "Cuádriceps", scheme: "8/8/6", type: "Serie normal", done: true, video: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" },
    { id: "e3", rest: 90, name: "Zancadas (multipower)", muscle: "Cuádriceps", scheme: "8/8/6", type: "Serie normal", done: true, video: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" },
    { id: "e4", rest: 60, name: "Curl femoral (tumbado)", muscle: "Isquiotibial", scheme: "8/8/6", type: "Serie normal", done: false, video: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" },
    { id: "e5", rest: 60, name: "Curl femoral (de pie)", muscle: "Isquiotibial", scheme: "8/8/6", type: "Serie normal", done: false, video: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" },
    { id: "e6", rest: 90, name: "Búlgaras", muscle: "Glúteos", scheme: "8/8/6", type: "Serie normal", done: false, video: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" },
    { id: "e7", rest: null, name: "Cardio suave", muscle: "Cardio", scheme: "15 min", type: "Cardio", done: false, video: "" },
  ],

  lastLogs: {
    e2: { pr: 120, sets: [{ reps: 8, kg: 110 }, { reps: 8, kg: 110 }, { reps: 6, kg: 115 }] },
    e4: { pr: 45, sets: [{ reps: 8, kg: 40 }, { reps: 8, kg: 40 }, { reps: 6, kg: 42.5 }] },
  } as Record<string, { pr: number; sets: { reps: number; kg: number }[] }>,

  progress: {
    weightStart: 78.4,
    weightNow: 71.2,
    weightSeries: [78.4, 77.9, 77.1, 76.2, 75.5, 74.9, 74.1, 73.6, 72.8, 72.1, 71.6, 71.2],
    waistStart: 88,
    waistNow: 79,
    photos: { before: "oct. 2025", after: "jul. 2026" },
  },

  checkin: { pendingWeek: "Semana del 10 de agosto" },

  mealDay: {
    day: 1,
    macros: { protein: 114, fat: 61, carbs: 209, kcal: 1910 },
    meals: [
      { slot: "Desayuno", name: "Tostada de fiambre de pollo, mozzarella y fruta", kcal: 492, protein: 35 },
      { slot: "Almuerzo", name: "Arroz blanco, contramuslo y verduras", kcal: 734, protein: 33 },
      { slot: "Snack", name: "Queso fresco batido, fruta y frutos secos", kcal: 486, protein: 34 },
      { slot: "Cena", name: "Ensalada de lentejas, remolacha, atún y feta", kcal: 486, protein: 34 },
    ],
  },

  // Solo para el modo demo: en la app real las FAQs las escribe la entrenadora.
  faqs: [
    { id: "f1", question: "¿Qué hago si no puedo entrenar el día que me toca?",
      answer: "No pasa nada: haz la sesión al día siguiente y sigue el orden del programa. Si te pasa a menudo, escríbeme por el chat y lo ajustamos." },
    { id: "f2", question: "¿Cuánto tengo que descansar entre series?",
      answer: "Lo verás en cada ejercicio, junto a las series. Al marcar una serie con ✓ arranca el temporizador de descanso." },
    { id: "f3", question: "¿Cuándo hago el check-in semanal?",
      answer: "Una vez por semana, mejor siempre el mismo día. Te responderé en tu ficha de check-in." },
  ],

  suggestions: [
    { id: "s1", client_id: "demo", kind: "idea" as const, body: "Estaría bien poder ver el vídeo del ejercicio a pantalla completa.",
      screen: "Detalle de ejercicio", status: "hecha" as const, coach_reply: "¡Hecho! Pulsa el botón de pantalla completa del vídeo.",
      created_at: "2026-10-20T10:00:00Z" },
  ],
};

export const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Fecha de hace n días, como YYYY-MM-DD (las series de demo terminan siempre "ahora"). */
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return toDay(d); };

/** Mediciones de demo: una cada 15 días durante ~6 meses, la última hace 2 días. */
export function demoMeasurements(): Measurement[] {
  const w = demo.progress.weightSeries;
  const waist = [88, 87.5, 86.5, 86, 85, 84, 83.5, 82.5, 81.5, 80.5, 80, 79];
  const hip = [102, 101.5, 101, 100.5, 100, 99, 98.5, 98, 97.5, 97, 96.5, 96];
  return w.map((kg, i) => ({
    id: `m${i}`, measured_at: daysAgo(2 + (w.length - 1 - i) * 15), note: null,
    weight_kg: kg, waist_cm: waist[i], hip_cm: hip[i],
    arm_cm: i % 3 === 0 ? 31 - i * 0.1 : null, // medida tomada de vez en cuando
    chest_cm: null, shoulders_cm: null, thigh_cm: null, calf_cm: null, neck_cm: null, legs_cm: null,
  }));
}

/** Registros de entreno de demo: kg máximo por sesión, una sesión por semana. */
export function demoLoadLogs(): LoadLog[] {
  const series: Record<string, number[]> = {
    "Prensa": [90, 95, 95, 100, 105, 105, 110, 115, 115, 120],
    "Sentadilla (barra)": [45, 47.5, 50, 50, 52.5, 55, 57.5, 60, 62.5],
    "Peso muerto": [60, 65, 65, 70, 75, 80, 80, 85],
    "Curl femoral (tumbado)": [35, 37.5, 40, 40, 42.5, 45],
    "Cardio suave": [0, 0, 0], // sin peso: no sale en las cargas
  };
  return Object.entries(series).flatMap(([name, kgs]) =>
    kgs.map((kg, i) => ({
      name, performed_at: daysAgo(1 + (kgs.length - 1 - i) * 7),
      sets: [{ reps: 8, kg: kg > 0 ? kg - 5 : 0 }, { reps: 8, kg: kg > 0 ? kg - 2.5 : 0 }, { reps: 6, kg }],
    })));
}
