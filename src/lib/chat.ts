// Tipos y consultas del chat. El hilo de una conversación es su client_id.

import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAT_BUCKET = "chat-media";

export type ChatMessage = {
  id: string;
  client_id: string;
  sender_id: string;
  kind: "text" | "image" | "video";
  body: string | null;
  storage_path: string | null;
  created_at: string;
  read_at: string | null;
  url?: string; // firmada al vuelo, no está en la tabla
};

export const MESSAGE_SELECT = "id,client_id,sender_id,kind,body,storage_path,created_at,read_at";

/**
 * Mensajes sin leer dirigidos a mí. La RLS hace el resto: una clienta solo ve
 * su hilo y la entrenadora los de sus clientas, así que la misma consulta
 * sirve para las dos.
 */
export async function unreadTotal(sb: SupabaseClient, myId: string): Promise<number> {
  const { count } = await sb
    .from("messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .neq("sender_id", myId);
  return count || 0;
}

/** Lo mismo, pero desglosado por hilo: para los avisos del panel de la coach. */
export async function unreadByThread(
  sb: SupabaseClient,
  myId: string,
): Promise<Record<string, number>> {
  const { data } = await sb
    .from("messages")
    .select("client_id")
    .is("read_at", null)
    .neq("sender_id", myId);
  const out: Record<string, number> = {};
  ((data || []) as { client_id: string }[]).forEach((m) => {
    out[m.client_id] = (out[m.client_id] || 0) + 1;
  });
  return out;
}

/** "14:05" o "12/03, 14:05" si no es de hoy. */
export function messageTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (sameDay) return time;
  return `${d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}, ${time}`;
}
