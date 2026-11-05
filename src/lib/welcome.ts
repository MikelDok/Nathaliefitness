// Textos de la bienvenida de la clienta (/bienvenida). Nathalie puede
// cambiarlos aquí sin tocar la pantalla.

/** Pantalla 1: mensaje de Nathalie, en primera persona (un párrafo por elemento). */
export const WELCOME_MESSAGE: string[] = [
  "Soy Nathalie y a partir de hoy te acompaño en cada entreno. Aquí tienes tu programa, tu plan de comidas y todo lo que necesitas para avanzar a tu ritmo. Si tienes cualquier duda, escríbeme: te respondo yo.",
];

/** Firma bajo el mensaje. */
export const WELCOME_SIGNATURE = "Nathalie";

/**
 * Foto de Nathalie para la pantalla 1 (ruta dentro de /public, p. ej.
 * "/nathalie.jpg"). Mientras sea null se muestra el logo.
 */
export const WELCOME_PHOTO: string | null = null;

/** Pantalla 2: lo que va a encontrar (el icono se elige en la pantalla). */
export const WELCOME_FEATURES: { key: "entreno" | "progreso" | "comidas" | "chat"; title: string; body: string }[] = [
  { key: "entreno", title: "Tu entreno del día", body: "Con el vídeo de cada ejercicio y un temporizador de descanso entre series." },
  { key: "progreso", title: "Tu progreso", body: "Peso, medidas, fotos y tus marcas, en gráficas." },
  { key: "comidas", title: "Tu plan de comidas", body: "El menú de cada día y la lista de la compra." },
  { key: "chat", title: "El chat conmigo", body: "Escríbeme cuando lo necesites; te respondo yo." },
];

/** Pantalla 3: opciones del objetivo de agua (ml). */
export const WATER_OPTIONS = [1500, 2000, 2500, 3000];

/** En demo, la bienvenida se ve una vez por sesión del navegador (sessionStorage). */
export const DEMO_WELCOME_KEY = "nea:welcome-seen";
