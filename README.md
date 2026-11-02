# Nathalie · Personal Trainer — Plataforma de coaching

PWA mobile-first para una entrenadora y sus clientes: entrenamientos con vídeo,
registro de series, progreso (peso, medidas, fotos), check-ins y nutrición.
Coste de infraestructura objetivo: 0 €/mes (Vercel Hobby + Supabase Free).

## Ejecutar en local (modo demo, sin cuentas)

```bash
npm install
npm run dev        # http://localhost:3000
```

Sin variables de entorno la app funciona con datos de demostración: navegable al 100%.

## Conectar Supabase (cuentas reales)

1. Crea un proyecto gratuito en supabase.com.
2. En SQL Editor, ejecuta `supabase/migrations/0001_init.sql`.
3. Crea el bucket privado `progress-photos` en Storage.
4. Copia las credenciales en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU-ANON-KEY
```

5. Crea el usuario de la entrenadora en Authentication → Users y ponle
   `role = 'coach'` en la tabla `profiles`.

## Desplegar gratis

1. Sube el repo a GitHub.
2. Importa en vercel.com (plan Hobby) y añade las dos variables de entorno.
3. Conecta tu dominio (~12 €/año).

## Decisiones de arquitectura

- **PWA, no app de stores**: instalable con icono, sin cuotas de Apple/Google.
- **Vídeos por URL** (YouTube no listado / Vimeo): 0 € de almacenamiento y
  migrable a Mux más adelante sin tocar la base de datos.
- **`coach_id` en todas las tablas**: multi-entrenador preparado desde el día 1.
- **RLS estricta**: cada cliente solo ve lo suyo; las fotos de progreso solo
  llegan a la coach con consentimiento explícito (`shared_with_coach`).
- **Modo demo**: la app renderiza datos de `src/lib/demo-data.ts` cuando no hay
  variables de entorno, útil para enseñar el producto y para desarrollo.

## Estructura

```
supabase/migrations/0001_init.sql   Esquema + RLS
src/app/(tabs)/                     Inicio · Entreno · Progreso · Nutrición · Perfil
src/app/ejercicio/[id]/             Detalle de ejercicio + registro de series
src/app/login/                      Acceso
src/lib/                            Cliente Supabase + datos demo
```

## Roadmap corto

- [ ] Conectar pantallas a Supabase (queries + mutaciones)
- [ ] Panel de la entrenadora (ruta /coach, rol `coach`)
- [ ] Check-in semanal funcional
- [ ] Subida de fotos de progreso a Storage
- [ ] V1: recetas, lista de compra, PDF por email
