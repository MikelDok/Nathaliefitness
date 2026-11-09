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
  `accent` rosa intenso, `accent-ink`, `accent2` lila, `accent2-ink`, `ok`,
  `danger`). **Usa siempre tokens**,
  nunca colores sueltos (`red-300`, hex…): el tema claro solo redefine esos tokens.
- **Sistema visual** (rediseño 1/3, "deportivo y minimalista"):
  - Fuentes con `next/font/google` en el layout raíz (autoalojadas):
    **Barlow Condensed** 600/700 → `font-display` (h1, eyebrows, `.figure`,
    botones, chips, etiquetas de la barra; siempre en mayúsculas, tracking
    0.12–0.18em en etiquetas y -0.01em en títulos) y **Manrope** 400/500/700 →
    `font-sans` (resto del texto). Variables `--font-barlow` / `--font-manrope`
    mapeadas en `@theme inline`.
  - **Paleta de la web de NEA** (berenjena `#2B1230`, rosa claro `#FBE7E1`,
    rose gold `#E5A38F`, rosa intenso `#E8436E`, lila `#CDBCFF`), ajustada a AA.
    Tokens oscuros: bg `#170a1a`, surface `#2b1630`, raised `#38213d`, line
    `#4b3051`, ink `#fbf1f3`, muted `#bca6b9`, accent `#f46a8e`, accent-ink
    `#2b1230`, accent2 `#cdbcff`, accent2-ink `#2b1230`, ok `#7fc29b`, danger
    `#ffa066`. Claros: bg `#f8e9e4`, surface `#ffffff`, raised `#f2dad3`, line
    `#e9cbc2`, ink `#2b1230`, muted `#6b4f65`, accent `#a8193f`, accent-ink
    `#fff`, accent2 `#5335b8`, accent2-ink `#fff`, ok `#1f603b`, danger
    `#9c3e00`. surface/bg ≥ 1,15:1 (tarjetas sin borde) y raised un escalón
    más. AA comprobado en ambos: todo el texto (ink, muted, accent, accent2,
    ok, danger) ≥ 4,5:1 sobre bg, surface, raised y sobre su tinte al 15 %
    (encima de bg y de surface). danger es naranja para no confundirse con el
    acento rosa. Si cambia bg, actualizar `THEME_COLOR` (`src/lib/theme.ts`)
    y el manifest.
  - **`accent2` (lila) solo** en: barra e icono del agua (`WaterCard`), checks
    de hábitos de Inicio y pestañas de semana/día de Nutrición
    (`chip(activo, true)` → `.chip-alt`). Todo lo demás, `accent`.
  - Logo (`logo.png`, fondo casi negro): placa `.logo-mark` redondeada en los
    dos temas.
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
    la coach. Pantallas migradas: todas las de la clienta (Inicio, Entreno,
    detalle de ejercicio + `RestTimer`, Progreso, Nutrición, Compra, Hábitos,
    Check-in, Agenda, Mensajes, Sugerencias, FAQs, Perfil), BottomNav, login,
    `/recuperar`, `/nueva-contrasena`, `/privacidad`, y todo el panel de la
    coach (`CoachHeader`, Resumen, ficha, chat/agenda de la ficha, programas y
    constructor, nutrición, editor y lista de la compra, ejercicios,
    sugerencias, FAQs). Sin migrar: `diario/` (oculto). El informe y la hoja
    impresa de la compra siguen en papel blanco con hex (solo heredan la
    fuente de los h1).
  - Panel: contenedor `max-w-5xl`; en escritorio, rejillas de 2 columnas
    (formulario en `.card` a un lado, lista plana al otro). Acciones de fila
    como iconos con `aria-label` (Pencil, Trash2, ArrowUp/ArrowDown,
    Eye/EyeOff, Copy). Badges ("Activo", "Plantilla", "Oculto", estados) como
    `chip` pequeño (`min-h-6 px-2.5 text-[10px]`).
  - **Borrados con doble toque**: `useConfirm` (`src/lib/useConfirm.ts`) +
    `DeleteButton`. El primer toque muestra "¿Borrar? Toca otra vez" y se
    desarma solo a los 3 s. Cualquier borrado nuevo debe usarlo (sin
    `confirm()` del navegador).
  - Piezas comunes en `src/components/ui.tsx`: `PageHeader` (eyebrow + h1 de
    32 px, flecha de volver y acción opcionales), `EmptyState` (icono lucide de
    32 px en muted + una línea, sin caja), `CheckDot` (check redondo relleno en
    accent), `Avatar` (inicial en círculo), `ICON` (props de lucide: 20 px,
    trazo 1.75) y `chip(activo)`. Iconos por tipo de cita y de sugerencia en
    `src/components/icons.ts` (los `KINDS` de `lib/` ya no llevan emoji).
  - Dentro de una `.card` (surface), los campos y botones secundarios van en
    `bg-raised` para que se distingan. `.range` da estilo a los deslizadores
    (check-in). Componentes compartidos con el panel (`Chat`, `Appointments`,
    paneles de progreso, `ThemeSwitcher`) ya usan el sistema nuevo.
  - `Ring`: 108 px, trazo 12, sin halo, accent (ok con `done`). Frase del día
    de Inicio en `src/lib/quotes.ts` (7, una por día de la semana).
  **Zonas seguras (app instalada en iPhone)**: con `viewportFit: "cover"`
  y la barra de estado `black-translucent`, la página empieza bajo la hora y
  la batería. Todo contenedor que toque el borde superior suma
  `env(safe-area-inset-top)` (`pt-[calc(env(safe-area-inset-top)+…)]`):
  layout de pestañas, `CoachHeader`, detalle de ejercicio, login, recuperar,
  nueva contraseña, privacidad, créditos, bienvenida y el escáner. Lo fijo
  abajo (BottomNav, `RestTimer`, hoja de la guía) y el relleno inferior de
  las pantallas suman `safe-area-inset-bottom`. Una pantalla nueva fuera de
  esos layouts debe hacer lo mismo. En el navegador normal valen 0.
  Los títulos que reciben el foco por código (`h1[tabindex="-1"]`) no
  muestran anillo de foco.
- **Supabase** (`@supabase/supabase-js` 2.112): Auth email+contraseña,
  Postgres con RLS, Storage, Realtime (chat).
- Otras: `lucide-react` (iconos), `react-muscle-highlighter` (mapa corporal),
  `@zxing/browser` (código de barras → Open Food Facts), `xlsx`
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
  `/login`, coach → `/coach`, clienta sin `profiles.onboarded_at` →
  `/bienvenida`; si esa consulta falla, no redirige) y `CoachGate` (panel). `homePath()` en
  `src/lib/auth.ts` decide el destino según `profiles.role`.

## Estructura y rutas
```
src/app/
  login/                 Acceso (público)
  recuperar/             Pedir enlace de recuperación (público)
  nueva-contrasena/      Destino del enlace del correo (público)
  privacidad/            Política de privacidad piloto (público)
  creditos/              Licencias de terceros (público, lee THIRD_PARTY_NOTICES.md)
  bienvenida/            Bienvenida de la clienta (3 pantallas; ?repaso=1 desde Perfil)
  (tabs)/                Clienta, con AuthGate + BottomNav
    page.tsx             Inicio
    entreno/  progreso/  nutricion/  diario/  compra/
    habitos/  checkin/   mensajes/   agenda/  perfil/
    sugerencias/  faqs/  (se llega desde Perfil; diario/ sin accesos, oculto)
    guia/                Guía de ejercicios con mapa corporal (desde Entreno)
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
  `profiles.coach_id`. Si falla un envío, el texto se queda en el campo y el
  error real de Supabase va a la consola (`[Chat]`). Ficheros del chat en el bucket privado `chat-media`,
  carpeta `{client_id}/…`, controlados por `in_chat_thread()`.
- Citas: no se borran (sin policy de delete); se cancelan con `status`.
- Registro de series (`exercise_logs`): **un registro por clienta, ejercicio
  del programa y día** (índice único, 0015) y **guardado automático** desde
  el detalle de ejercicio (`src/lib/logDraft.ts`): el primer ✓ crea el
  registro (upsert), los siguientes lo actualizan y desmarcar todas lo borra;
  reps/kg de una serie marcada se envían 0,8 s después de editar y la nota al
  salir del campo. `sets` guarda **solo las series marcadas** como
  `{reps, kg, n}` (`n` = nº de serie; los registros antiguos no lo llevan y
  todos los lectores usan solo `reps`/`kg`). Mientras Supabase no confirma,
  borrador en `localStorage["nea:log:{ejercicio}:{día}"]`; se reenvía al
  volver la conexión, al siguiente ✓, al abrir cualquier ejercicio o Entreno.
  Entreno da un ejercicio por hecho desde la primera serie (también si está
  pendiente de enviar). "Última sesión" es la última anterior a hoy. El botón
  final es "Siguiente ejercicio" (siguiente visible del día) o "Volver al
  entreno".
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
  `globals.css` (contraste AA comprobado; acento claro `#a8193f`). Preferencia
  en `localStorage["nea:theme"]` (`dark` por defecto | `light` | `system`),
  lógica en `src/lib/theme.ts`. Script inline en el `<head>` del layout raíz
  (sin parpadeo) + `ThemeSync` (reaplica tras el remontaje de Strict Mode en
  desarrollo y sigue a "Sistema"). Selector `ThemeSwitcher` en Perfil y en la
  cabecera del panel. El informe imprimible es papel blanco en ambos temas
  (sus hex son intencionados); el manifest se queda en el bg oscuro (`#170a1a`).
- **Fechas de calendario en hora local**: `src/lib/dates.ts` es la fuente
  única (`localDay`, `localMonday`, `parseLocalDay`, `addDays`) para
  `performed_at`, `logged_on` (hábitos y agua), `week_start` (check-ins),
  `measured_at`, `eaten_on` y los "hoy" de Inicio, Entreno y la agenda. Nunca
  `toISOString().slice(0, 10)` (da el día en UTC: en España, entre las 00:00
  y la 01:00/02:00 contaba como el día anterior) ni `new Date("YYYY-MM-DD")`
  para mostrar una fecha. `toDay`/`parseDay` (progress) y
  `dateKey`/`parseDateKey` (agenda) son alias de estas.
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
- Mapa corporal: `src/lib/muscles.ts` es la fuente única (zonas, grupos de la
  biblioteca `MUSCLE_GROUPS` que usa el panel, mapeo grupo → zonas y palabra
  de "Hoy trabajas"; normaliza mayúsculas y tildes; Cardio y Movilidad sin
  zona). `BodyMap` envuelve `react-muscle-highlighter` (modelo femenino):
  la librería solo acepta colores, así que lee los tokens con
  `getComputedStyle` y repinta al cambiar `data-theme` (oscuro: cuerpo en
  raised, músculo entre line y muted al 30 %, resaltado al 85 %; claro: cuerpo
  en raised, músculo entre line y muted al 20 %, resaltado al 60 %). Añade el teclado y ARIA que la librería no trae. Úsalo
  siempre con `BodyMapLazy` (`next/dynamic`, `ssr:false`): ~59 KB gzip que
  solo cargan Guía, Inicio, Entreno y el detalle de ejercicio. Los dibujos
  son MIT (react-native-body-highlighter vía react-muscle-highlighter):
  mantener `THIRD_PARTY_NOTICES.md` y la página `/creditos`, enlazada desde
  `/privacidad`. Usos: `/guia` (biblioteca de su coach por zona, vídeo en
  hoja inferior, sin registro), "Hoy trabajas" en Inicio y "Este día
  trabajas" en Entreno (`MuscleDay`, solo ejercicios visibles; no sale en
  descanso ni sin programa) y mini silueta en el detalle de ejercicio.
- Bienvenida (`/bienvenida`, 0016): la primera vez que entra una clienta
  (también las que ya usaban la app). Tres pantallas (hola de Nathalie, lo que
  va a encontrar, objetivo + agua), con puntos de progreso, Atrás/Saltar,
  deslizar y foco en el título de cada pantalla; las ocultas son `inert`.
  Textos, foto opcional (`WELCOME_PHOTO`, si es null sale el logo) y opciones
  de agua en `src/lib/welcome.ts`, para que Nathalie los cambie. "Empezar"
  guarda `goals`, `water_goal_ml` y `onboarded_at`; "Saltar", solo
  `onboarded_at`. Desde Perfil, `?repaso=1` no marca nada y vuelve a Perfil.
  En demo, una vez por sesión del navegador (`sessionStorage`).
- Instalación de la PWA: `src/lib/install.ts` (`useInstall`, detección
  android / ios-safari / ios-otro / ordenador, "Ahora no" 7 días en
  `localStorage["nea:install-snooze"]`) y `components/Install.tsx`
  (`InstallGuide`, `InstallCard` en Inicio, `InstallRow` en Perfil). El
  `beforeinstallprompt` de Android lo guarda `INSTALL_SCRIPT` en el `<head>`
  del layout raíz (llega en el login, antes de montar Inicio). Instalada =
  `display-mode: standalone`, `navigator.standalone` o `appinstalled`. No hay
  service worker (irá con las notificaciones): si Chrome no ofrece el aviso
  nativo, salen las instrucciones del menú ⋮. Para probar en escritorio,
  solo en desarrollo: `localStorage["nea:install-debug"]` = `android`,
  `android-prompt`, `ios-safari`, `ios-other` o `desktop`.
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
| 0015 | Un registro por clienta, ejercicio y día en `exercise_logs` (borra duplicados previos conservando el más reciente + índice único) |
| 0016 | `profiles.onboarded_at` (bienvenida vista) + `grant update (onboarded_at)` |
| 0017 | Reaplica la seguridad de `messages` de la 0010 (en producción quedó sin policies: el chat no enviaba) |

**La siguiente es `0018_…`.**

**Diagnóstico de escrituras**: `supabase/diagnostico_escrituras.sql` (no es
una migración). Pegado en el SQL Editor, hace cada escritura de la app como
la clienta de prueba y como su coach (RLS, permisos de columna, triggers
reales), deshace todo y devuelve una tabla OK/FALLA con el código de error.
Úsalo tras aplicar una migración o si algo "no se guarda". Si se añade una
escritura nueva a la app, añádela también ahí.

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
- Rediseño visual completo (3 encargos): sistema base, pantallas de la
  clienta y panel de la coach.
- Mapa corporal: guía de ejercicios por músculo, "Hoy trabajas" y grupos
  Gemelos y Antebrazos en la biblioteca.
- Guardado automático de series con borrador local y reintento sin conexión
  (requiere la 0015 aplicada).
- Fecha "de hoy" en hora local en toda la app (`src/lib/dates.ts`).
- Bienvenida de 3 pantallas y aviso para instalar la app (requiere la 0016).
- Paleta de la web de NEA (berenjena, rosa intenso y lila) en la app.

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
