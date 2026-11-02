"use client";

// Chat 1 a 1 de un hilo (clientId). Lo usan la pantalla de la clienta y la
// de la entrenadora: quién es cada cual sale de la sesión, no de props.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { CHAT_BUCKET, MESSAGE_SELECT, messageTime, type ChatMessage } from "@/lib/chat";
import { prepareMedia, uploadMedia } from "@/lib/media";

export default function Chat({ clientId }: { clientId: string }) {
  const [me, setMe] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (uid: string) => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data } = await sb.from("messages").select(MESSAGE_SELECT)
      .eq("client_id", clientId).order("created_at");
    const rows = (data as ChatMessage[]) || [];

    // URLs firmadas del bucket privado, igual que las fotos de progreso
    const paths = rows.filter((r) => r.storage_path).map((r) => r.storage_path!);
    if (paths.length) {
      const { data: signed } = await sb.storage.from(CHAT_BUCKET).createSignedUrls(paths, 3600);
      let i = 0;
      rows.forEach((r) => { if (r.storage_path) r.url = signed?.[i++]?.signedUrl ?? undefined; });
    }
    setMessages(rows);
    setLoading(false);

    // el chat está abierto: lo que me han enviado queda leído
    const unread = rows.filter((r) => r.sender_id !== uid && !r.read_at).map((r) => r.id);
    if (unread.length) {
      await sb.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread);
    }
  }, [clientId]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    let channel: RealtimeChannel | null = null;
    let uid = "";
    (async () => {
      const { data: u } = await sb.auth.getUser();
      uid = u.user?.id || "";
      if (!uid) { setLoading(false); return; }
      setMe(uid);
      await load(uid);
      // Realtime: los mensajes nuevos del hilo entran solos
      channel = sb.channel(`chat:${clientId}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `client_id=eq.${clientId}` },
          () => load(uid))
        .subscribe();
    })();
    // red de seguridad por si Realtime se cayera: al volver el foco, recarga
    const onFocus = () => { if (uid) load(uid); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      if (channel) sb.removeChannel(channel);
    };
  }, [clientId, load]);

  // el hilo siempre abre por abajo, en el último mensaje
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function sendText() {
    const t = text.trim();
    if (!t || !me) return;
    const sb = getSupabase();
    if (!sb) return;
    setErr(null); setBusy(true);
    const { error } = await sb.from("messages").insert({
      client_id: clientId, sender_id: me, kind: "text", body: t,
    });
    setBusy(false);
    if (error) { setErr("No se pudo enviar el mensaje."); return; }
    setText("");
    load(me);
  }

  async function sendMedia(file: File) {
    if (!me) return;
    const sb = getSupabase();
    if (!sb) return;
    setErr(null); setBusy(true);
    const prepared = await prepareMedia(file);   // valida y comprime la foto
    if ("error" in prepared) { setBusy(false); setErr(prepared.error); return; }
    const up = await uploadMedia(sb, CHAT_BUCKET, clientId, prepared.file);
    if ("error" in up) { setBusy(false); setErr(up.error); return; }
    const { error } = await sb.from("messages").insert({
      client_id: clientId, sender_id: me, kind: prepared.kind,
      storage_path: up.path, body: text.trim() || null,
    });
    if (error) {
      // sin mensaje que lo referencie, el fichero sobra en el bucket
      await sb.storage.from(CHAT_BUCKET).remove([up.path]);
      setBusy(false); setErr("No se pudo enviar el archivo.");
      return;
    }
    setText(""); setBusy(false);
    load(me);
  }

  return (
    <div className="space-y-3">
      <div ref={listRef}
        className="max-h-[58vh] min-h-[38vh] space-y-2 overflow-y-auto rounded-2xl border border-line bg-surface p-3">
        {loading ? (
          <p className="text-sm text-muted">Cargando mensajes…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Aún no hay mensajes. Escribe el primero 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-accent text-accent-ink" : "bg-raised"}`}>
                  {m.kind === "image" && (m.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.body || "Foto enviada"} className="mb-1 max-h-64 rounded-lg" />
                  ) : (
                    <p className="mb-1 text-xs italic opacity-70">📷 Foto no disponible</p>
                  ))}
                  {m.kind === "video" && (m.url ? (
                    <video src={m.url} controls playsInline className="mb-1 max-h-64 rounded-lg" />
                  ) : (
                    <p className="mb-1 text-xs italic opacity-70">🎬 Vídeo no disponible</p>
                  ))}
                  {m.body && <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>}
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-accent-ink/70" : "text-muted"}`}>
                    {messageTime(m.created_at)}{mine && m.read_at ? " ✓✓" : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {err && <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{err}</p>}

      <div className="flex items-center gap-2">
        <label className={`shrink-0 cursor-pointer rounded-full border border-line px-3 py-2.5 text-sm ${busy ? "opacity-60" : ""}`}>
          📎
          <input type="file" accept="image/*,video/*" className="hidden" disabled={busy}
            aria-label="Adjuntar foto o vídeo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";           // permite reenviar el mismo fichero
              if (f) sendMedia(f);
            }} />
        </label>
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
          placeholder="Escribe un mensaje…" aria-label="Mensaje" disabled={busy}
          className="min-w-0 flex-1 rounded-full border border-line bg-bg px-4 py-2.5 text-sm" />
        <button onClick={sendText} disabled={busy || !text.trim()}
          className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60">
          {busy ? "…" : "Enviar"}
        </button>
      </div>
      <p className="text-[11px] text-muted">
        Puedes adjuntar fotos (máx. 5 MB, se comprimen solas) y vídeos cortos (máx. 30 MB).
      </p>
    </div>
  );
}
