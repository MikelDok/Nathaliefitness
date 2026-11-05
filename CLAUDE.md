@AGENTS.md

# NEA FITNESS — contexto del proyecto

## Qué es y para quién
PWA mobile-first de la marca **NEA FITNESS**, para **Nathalie, entrenadora personal**, y sus **clientas**.
Sustituye, entre otras cosas, el Excel de seguimiento de la entrenadora: programas de entreno con vídeo,
registro de series, progreso (peso, medidas, fotos), check-ins semanales,
nutrición (plan, diario con lector de código de barras, lista de la compra),
hábitos, chat 1 a 1 y agenda de citas. La entrenadora tiene su panel en `/coach`.
Hoy hay **una sola coach**, pero el esquema está preparado para varias (`coach_id`).
Coste objetivo: 0 €/mes (Vercel Hobby + Supabase Free). Fase actual: **piloto**.

Todo el producto (textos, comentarios, commits) va **en español**, con trato
en femenino a la clienta ("tu entrenadora", "estás lista"…).

## Stack
- **Next.js 16.3.4** (App Router, Turbopack). Lee `AGENTS.md`: esta versión
  tiene cambios respecto a lo conocido; consulta `node_modules/next/dist/docs/`.
- **React 19.2.8**, **TypeScript 5**, **Tailwind CSS 4** (tokens en
  `src/app/globals.css`: `bg`, `surface`, `raised`, `line`, `ink`, `muted`,
  `accent` rose gold, `accent-ink`, `ok`, `danger`). **Usa siempre tokens**,
  nunca colores sueltos (`red-300`, hex…): el tema claro solo redefine esos tokens.
- **Sistema visual** (rediseño 1/3, "deportivo y minimalista"):
  - Fuentes con `next/font/google` en el layout raíz (autoalojadas):
    **Barlow Condensed** 600/700 → `font-display` (h1, eyebrows, `.figure`,
    botones, chips, etiquetas de la barra; siempre en mayúsculas, tracking
    0.12–0.18em en etiquetas y -0.01em en títulos) y **Manrope** 400/500/700 →
    `font-sans` (resto del texto). Variables `--font-barlow` / `--font-manrope`
    mapeadas en `@theme inline`.
  - Tokens oscuros: bg `#0b0b0c`, surface `#1c1c1f`, raised `#25252a`, line
    `#2a2a2f`, ink `#f5f2ef`, muted `#8e8e94`, accent `#dfa08f`, accent-ink
    `#1a0f0b`, ok `#7fc29b`, danger `#f5a3a3`. Claros: bg `#f7f7f6`, surface
    `#e7e7e4`, raised `#dbdbd7`, line `#d0d0cb`, ink `#18181a`, muted `#5a5a61`,
    accent `#844334`, accent-ink `#fff`, ok `#266a43`, danger `#a11f18`.
    surface/bg ≈ 1,15:1 (tarjetas sin borde) y raised un escalón más. AA
    comprobado en ambos (texto sobre bg/surface/raised, acento y danger sobre
    su tinte al 15 %). Si cambia bg, actualizar `THEME_COLOR` (`src/lib/theme.ts`).
  - Clases base (en `@layer components`, así las utilidades las ajustan):
    `.card` (surface, sin borde, radio 14, padding 16), `.eyebrow`, `.figure`
    (display 700, tabular-nums), `.btn-primary` (píldora accent, display en
    mayúsculas, 44 px), `.chip` + `.chip-active`, `.field` (campo sin borde),
    `.logo-mark`. `h1` es display en mayúsculas por defecto (`@layer base`).
  - **Tarjetas solo para bloques de acción** (enlaces, botones); las listas de
    información van **planas** con separadores finos (`divide-y divide-line`).
  - Espaciado: márgenes laterales 20 px (`px-5`), 28 px entre bloques
    (`space-y-7`), 16 px dentro de tarjetas.
  - Iconos **lucide-react** a 20 px y trazo 1.75 (22 px en la barra) en vez de
    emojis decorativos de la interfaz. Los emojis solo en contenido que escribe
    la coach. Pantallas ya migradas: Inicio, BottomNav, login, `/recuperar`,
    `/nueva-contrasena`, `/privacidad` (el resto, encargos 2 y 3).
  - `Ring`: 108 px, trazo 12, sin halo, accent (ok con `done`). Frase del día
    de Inicio en `src/lib/quotes.ts` (7, una por día de la semana).
- **Supabase** (`@supabase/supabase-js` 2.112): Auth email+contraseña,
  Postgres con RLS, Storage, Realtime (chat).
- Otras: `lucide-react` (iconos), `@zxing/browser` (código de barras → Open Food Facts), `xlsx`
  (exportar progreso a Excel desde la ficha de la clienta), `recharts`
  (gráficas de progreso).
- Despliegue: **Vercel**, se redespliega solo con cada push a `main` en
  GitHub (`MikelDok/Nathaliefitness`).
- Sin tests ni ESLint configurados. Verificación: `npm run build` + probar en
  `npm run dev`.

## Arquitectura
- Casi todas las páginas son **client components** (`"use client"`) que leen
  y escriben directamente en Supabase con `getSupabase()` (`src/lib/supabase.ts`,
  cliente singleton, flujo de auth **implícito** por defecto). La seguridad la
  da **RLS**, no el frontend.
- **Modo demo**: sin variables de entorno, `getSupabase()` devuelve `null` y
  las pantallas usan `src/lib/demo-data.ts`. `NEXT_PUBLIC_REQUIRE_AUTH=false`
  fuerza la demo aunque haya Supabase (`src/lib/config.ts`).
- Protección de rutas en cliente: `AuthGate` (pestañas de clienta: sin sesión →
  `/login`, coach → `/coach`) y `CoachGate` (panel). `homePath()` en
  `src/lib/auth.ts` decide el destino según `profiles.role`.

## Estructura y rutas
```
src/app/
  login/                 Acceso (público)
  recuperar/             Pedir enlace de recuperación (público)
  nueva-contrasena/      Destino del enlace del correo (público)
  privacidad/            Política de privacidad piloto (público)
  (tabs)/                Clienta, con AuthGate + BottomNav
    page.tsx             Inicio
    entreno/  progreso/  nutricion/  diario/  compra/
    habitos/  checkin/   mensajes/   agenda/  perfil/
    sugerencias/  faqs/  (se llega desde Perfil; diario/ sin accesos, oculto)
  ejercicio/[id]/        Detalle de ejercicio + registro de series
  coach/                 Entrenadora, con CoachGate
    page.tsx             Panel (lista de clientas)
    clientes/[id]/       Ficha de clienta (+ /chat, /agenda, /informe imprimible)
    programas/[id]  ejercicios/  nutricion/[id] (+ /compra imprimible)  sugerencias/  faqs/
src/components/          AuthGate, CoachGate, BottomNav, Chat, Appointments,
                         BarcodeScanner, PasswordForm, ChangePassword, …
src/lib/                 supabase, config, auth, chat, agenda, ics,
                         measurements, media, demo-data
supabase/migrations/     SQL numerado, se ejecuta a mano en el SQL Editor
```

## Modelo de datos y RLS clave
- `profiles` (1:1 con `auth.users`): `role` (`coach` | `client`), `coach_id`
  (la entrenadora de cada clienta). Se crea por trigger al registrarse y se
  asigna a la coach automáticamente (0002, 0003).
- Función `is_coach_of(target)`: base de casi todas las policies de la coach.
  Patrón general: la clienta accede a sus filas (`client_id = auth.uid()`), la
  coach a las de sus clientas (`is_coach_of(client_id)`).
- **Fotos de progreso**: la coach SOLO ve las que la clienta marca
  (`progress_photos.shared_with_coach`, por defecto `false`), tanto en la tabla
  como en el bucket `progress-photos` (0005). No relajar nunca esta regla.
- **Hilos por `client_id`**: chat (`messages`) y citas (`appointments`) no tienen
  tabla de conversación; el hilo ES la clienta y la coach se deriva de
  `profiles.coach_id`. Ficheros del chat en el bucket privado `chat-media`,
  carpeta `{client_id}/…`, controlados por `in_chat_thread()`.
- Citas: no se borran (sin policy de delete); se cancelan con `status`.
- Programa activo: como mucho uno por clienta, vía RPC `set_active_program` (0008).
- Medidas: definición única en `src/lib/measurements.ts` (formulario, ficha,
  Excel e informe); añadir una medida = tocar ese archivo + una migración.
- `profiles` tiene **permisos de columna** (0012): la clienta solo puede
  actualizar `full_name`, `avatar_url`, `goals`, `dietary_prefs` y
  `water_goal_ml`; nunca `role` ni `coach_id`. Si se añade una columna
  editable por la clienta, hay que añadirla al `grant update (...)`.
- Notas privadas de la coach: tabla `client_notes` (solo policy de coach), no
  columna en `profiles`: los permisos de columna son por rol de Postgres y
  coach y clienta comparten `authenticated`, así que una columna en su propia
  fila sería legible por la clienta.
- Agua: `water_logs` (una fila por clienta y día, `ml`); objetivo en
  `profiles.water_goal_ml` (2000 por defecto).
- Ejercicios ocultos: `program_exercises.hidden`. Es presentación, no
  seguridad: la RLS no cambia (los registros antiguos conservan el nombre) y
  Entreno filtra `hidden = false`. Duplicar y copiar semana lo copian.
- Tema claro/oscuro: `html[data-theme="light"]` redefine los tokens en
  `globals.css` (contraste AA comprobado; acento claro `#844334`). Preferencia
  en `localStorage["nea:theme"]` (`dark` por defecto | `light` | `system`),
  lógica en `src/lib/theme.ts`. Script inline en el `<head>` del layout raíz
  (sin parpadeo) + `ThemeSync` (reaplica tras el remontaje de Strict Mode en
  desarrollo y sigue a "Sistema"). Selector `ThemeSwitcher` en Perfil y en la
  cabecera del panel. El informe imprimible es papel blanco en ambos temas
  (sus hex son intencionados); el manifest se queda oscuro.
- Cifras decimales en pantalla con coma: `fmtNum` / `fmtDelta` de
  `src/lib/progress.ts` (el Excel conserva números).
- Gráficas de progreso: cálculos puros en `src/lib/progress.ts` (rangos,
  series por medida, kg máximo por sesión y ejercicio, formatos es-ES; las
  fechas `YYYY-MM-DD` se leen como locales con `parseDay`). Gráfica base
  `components/charts/TrendChart` (colores con `var(--color-…)`) y paneles en
  `components/progress/` (`TrendPanel`, `MeasurePanel`, `LoadsPanel`, con
  prop `compact` para la ficha). Diferencias en color neutro.
- Planes de comida por semanas (0014): `meal_plans.weeks` (1-4) y
  `meals.week` (por defecto 1, los planes antiguos son de 1 semana). Con
  `starts_on`, la semana actual la calcula `currentWeek` (`src/lib/meals.ts`)
  y **rota** al acabar el plan; sin fecha, semana 1. El editor bloquea bajar
  el nº de semanas si las que se quitan tienen comidas. "Copiar semana" como
  en programas. No hay duplicado de planes de comida.
- Lista de la compra: lógica única en `src/lib/shopping.ts` (`parseLine`,
  `aggregate`, `formatItem`, `toPlainText`). La clienta (`/compra`) elige una
  semana; la coach (`/coach/nutricion/[id]/compra`) varias, copia texto para
  WhatsApp e imprime una hoja blanca (con hex, como el informe).
- Franjas de comida: lista y orden únicos en `src/lib/meals.ts` (`MEAL_SLOTS`,
  `sortBySlot`), usados por el editor de la coach y la pestaña de la clienta.
- Sugerencias (`suggestions`, 0013): la clienta inserta y lee las suyas, sin
  update ni delete; la coach lee y actualiza las de sus clientas, sin delete.
  Permisos de columna: insert solo de `client_id, kind, body, screen` y update
  solo de `status, coach_reply`; `updated_at` lo pone un trigger. Tipos y
  estados en `src/lib/suggestions.ts`.
- FAQs (`faqs`, 0013): la coach gestiona las suyas; la clienta lee solo las
  `published` de su coach (mismo patrón que `exercises`). Orden por `position`.

## Migraciones (`supabase/migrations/`)
Se ejecutan **a mano y en orden** en el SQL Editor de Supabase. Escríbelas
re-ejecutables (`if not exists`, `drop policy if exists`, `on conflict`).
| Nº | Contenido |
|---|---|
| 0001 | Esquema inicial + RLS + `is_coach_of` |
| 0002 | Trigger que crea `profiles` al registrarse |
| 0003 | Asignar la clienta a la coach al registrarse |
| 0004 | Ejercicios de ejemplo (opcional, una sola vez) |
| 0005 | Policies de Storage del bucket `progress-photos` |
| 0006 | Diario de alimentos (`food_diary`) |
| 0007 | La coach gestiona hábitos de sus clientas |
| 0008 | Programa activo por clienta (`set_active_program`) |
| 0009 | Medidas extra + nota por registro |
| 0010 | Chat (`messages`, Realtime, bucket `chat-media`) |
| 0011 | Agenda (`appointments`) + `programs.starts_on` / `weekdays` |
| 0012 | `client_notes`, `water_logs`, `profiles.water_goal_ml` + permisos de columna en `profiles`, `program_exercises.hidden` |
| 0013 | Buzón de sugerencias (`suggestions`, permisos de columna) y FAQs (`faqs`) |
| 0014 | Planes de comida por semanas: `meal_plans.weeks` (1-4), `meal_plans.starts_on`, `meals.week` |

**La siguiente es `0015_…`.**

## Variables de entorno (`.env.local`, y las mismas en Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave anon>
NEXT_PUBLIC_REQUIRE_AUTH=false   # opcional: fuerza el modo demo
```
- **Usa la clave `anon` legacy** (JWT que empieza por `eyJ…`, en Supabase →
  Project Settings → API Keys → *Legacy API keys*). Es la que está configurada
  y probada; no cambiarla por la nueva `sb_publishable_…` sin probar antes.
- **Nunca** la `service_role` en el frontend ni en variables `NEXT_PUBLIC_*`.
- `.env*` está en `.gitignore`: no subir nunca credenciales.

## Estado actual (noviembre 2026)
- Mejoras 1–4 hechas (commit inicial): pantallas conectadas a Supabase, panel
  de la coach, check-in, fotos, nutrición y diario, hábitos, progreso ampliado
  con Excel e informe, chat y agenda.
- Next actualizado a 16.3.4 (parche de seguridad).
- Recuperación de contraseña (`/recuperar` → `/nueva-contrasena`) y cambio de
  contraseña desde Perfil.
- Página `/privacidad` (texto piloto con marcadores `[NOMBRE COMPLETO / CONTACTO]`
  y `[CONTACTO]` que debe rellenar Nathalie).
- En Perfil, "Datos y objetivos" edita `profiles.goals` (la coach lo ve en la
  ficha); "Preferencias alimentarias" y "Notificaciones" siguen como
  **Próximamente** (texto, no botones).
- Descansos entre series (`rest_seconds`) y temporizador de descanso en el
  detalle del ejercicio (`src/lib/useRestTimer.ts`, `RestTimer`).
- Notas privadas de la coach, registro de agua, franja "Picoteo" y ejercicios
  ocultos (0012).
- Buzón de sugerencias (Perfil → `/sugerencias`; panel → `/coach/sugerencias`,
  con contador de nuevas en el Resumen) y FAQs (Perfil → `/faqs`; panel →
  `/coach/faqs`). Sin contenido sembrado: las FAQs las escribe Nathalie. En
  modo demo hay 3 FAQs y 1 sugerencia de ejemplo en `demo-data.ts`.
- Gráficas de progreso con Recharts: en Progreso (peso con rango, medidas con
  selector, cargas por ejercicio con marcas personales) y versión compacta de
  peso y cargas en la ficha. Datos de demo con fechas relativas a hoy
  (`demoMeasurements`, `demoLoadLogs`).
- Tema claro/oscuro/sistema (clienta y panel) y decimales con coma.
- Planes de comida de varias semanas (pestañas en el editor y en Nutrición,
  fecha de inicio) y lista de la compra en el panel (copiar e imprimir).
- Rediseño visual 1/3: fuentes, tokens, componentes base, Inicio, barra
  inferior y pantallas de acceso. Pendientes los encargos 2 y 3 (resto de
  pantallas de la clienta y panel).

## Pendientes conocidos
- **Form-check**: la clienta sube vídeos de su ejecución para que la coach los
  corrija. `src/lib/media.ts` ya es genérico para reutilizarlo.
- **PDF del plan** (entreno/nutrición) para enviar o descargar.
- **Notificaciones** (push o email).
- **SMTP propio** (p. ej. Resend con dominio verificado) en Supabase → Auth →
  SMTP Settings: sin él, Supabase solo envía correos a miembros de la
  organización y las clientas no reciben el de recuperación. Revisar también
  Rate Limits y traducir la plantilla "Reset Password".
- **Supabase → URL Configuration**: Site URL = dominio de Vercel; Redirect URLs
  con `/nueva-contrasena` (producción y `http://localhost:3000`).
- **Baja de cuenta / borrado en cascada**: la mayoría de tablas apuntan a
  `profiles` sin `on delete cascade` y los archivos de Storage no se borran
  solos. Hoy borrar a una clienta es manual; hace falta migración con
  `cascade` + limpieza de Storage (y quizá un botón de baja).
- **Revisión RGPD**: peso, medidas y fotos son datos de salud (categoría
  especial). Consentimiento explícito y revisión por alguien de protección de
  datos antes del lanzamiento; confirmar que la región del proyecto Supabase
  es UE (`eu-west-1`, Irlanda), como dice `/privacidad`.
- `npm audit` muestra avisos en dependencias, pendientes de revisar.

## Forma de trabajar
- Cambios pequeños y en commits separados, con mensaje en español.
- Antes de commit: `npm run build` sin errores.
- No tocar funcionalidad que no se ha pedido; confirmar el plan antes de cambios
  grandes.
