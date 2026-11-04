// Datos de demostración. Cuando NEXT_PUBLIC_SUPABASE_URL esté configurado,
// las pantallas leerán de Supabase; mientras tanto, la app es 100% navegable.

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
    prs: [
      { name: "Prensa", kg: 120 },
      { name: "Sentadilla (barra)", kg: 62.5 },
      { name: "Peso muerto", kg: 85 },
    ],
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
};

export const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL;
