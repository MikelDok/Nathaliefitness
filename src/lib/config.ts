// Configuración derivada de las variables de entorno.
// - hasSupabase: hay proyecto conectado (.env.local con URL + clave).
// - requireAuth: pedir login real. Se activa solo si hay Supabase, y se puede
//   desactivar poniendo NEXT_PUBLIC_REQUIRE_AUTH=false para enseñar la demo.

export const hasSupabase =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const requireAuth =
  hasSupabase && process.env.NEXT_PUBLIC_REQUIRE_AUTH !== "false";
