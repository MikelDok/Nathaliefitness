import type { SupabaseClient } from "@supabase/supabase-js";

/** Pantalla de inicio según el rol: la entrenadora va a su panel, la clienta a sus pestañas. */
export async function homePath(sb: SupabaseClient, userId: string): Promise<string> {
  const { data } = await sb.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (data as { role: string } | null)?.role === "coach" ? "/coach" : "/";
}

export const MIN_PASSWORD = 8;
