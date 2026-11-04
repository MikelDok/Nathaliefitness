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
  `accent` rose gold, `accent-ink`, `ok`; clases `.card`, `.eyebrow`, `.figure`).
- **Supabase** (`@supabase/supabase-js` 2.112): Auth email+contraseña,
  Postgres con RLS, Storage, Realtime (chat).
- Otras: `@zxing/browser` (código de barras → Open Food Facts), `xlsx`
  (exportar progreso a Excel desde la ficha de la clienta).
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
  ejercicio/[id]/        Detalle de ejercicio + registro de series
  coach/                 Entrenadora, con CoachGate
    page.tsx             Panel (lista de clientas)
    clientes/[id]/       Ficha de clienta (+ /chat, /agenda, /informe imprimible)
    programas/[id]  ejercicios/  nutricion/[id]
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

**La siguiente es `0012_…`.**

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
- En Perfil, "Datos y objetivos", "Preferencias alimentarias" y "Notificaciones"
  se muestran como **Próximamente** (texto, no botones).

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
