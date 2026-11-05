"use client";

import { useEffect, useState } from "react";
import { Bug, Inbox, Lightbulb, MessageSquare } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";
import {
  KINDS, SUGGESTION_SELECT, BODY_MAX, SCREEN_MAX,
  kindLabel, statusLabel, statusTone,
  type Suggestion, type SuggestionKind,
} from "@/lib/suggestions";

const KIND_ICON = { fallo: Bug, idea: Lightbulb, otro: MessageSquare } as const;

export default function Sugerencias() {
  const [kind, setKind] = useState<SuggestionKind>("idea");
  const [body, setBody] = useState("");
  const [screen, setScreen] = useState("");
  const [list, setList] = useState<Suggestion[]>(requireAuth ? [] : demo.suggestions);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(requireAuth);

  async function load() {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data: u } = await sb.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await sb.from("suggestions").select(SUGGESTION_SELECT)
      .eq("client_id", u.user.id).order("created_at", { ascending: false });
    setList((data as Suggestion[]) || []);
    setLoading(false);
  }
  useEffect(() => { if (requireAuth) load(); }, []);

  async function send() {
    setMsg(null);
    const text = body.trim();
    if (!text) { setMsg({ ok: false, text: "Escribe tu sugerencia antes de enviarla." }); return; }
    const where = screen.trim() || null;

    if (!requireAuth) {
      setList((l) => [{
        id: `demo-${Date.now()}`, client_id: "demo", kind, body: text, screen: where,
        status: "recibida", coach_reply: null, created_at: new Date().toISOString(),
      }, ...l]);
    } else {
      const sb = getSupabase();
      if (!sb) return;
      setBusy(true);
      const { data: u } = await sb.auth.getUser();
      // solo estas columnas: estado y respuesta los pone la base de datos / la coach
      const { error } = await sb.from("suggestions").insert({
        client_id: u.user!.id, kind, body: text, screen: where,
      });
      setBusy(false);
      if (error) { setMsg({ ok: false, text: "No se pudo enviar. Comprueba tu conexión e inténtalo de nuevo." }); return; }
      load();
    }
    setBody(""); setScreen("");
    setMsg({ ok: true, text: "Gracias, lo leerá Nathalie." });
  }

  return (
    <main className="space-y-7">
      <PageHeader back="/perfil" eyebrow="Perfil" title="Sugerencias">
        Estamos en fase piloto: cuéntanos qué falla o qué echas de menos.
      </PageHeader>

      <section className="card space-y-3">
        <div className="flex gap-1" role="radiogroup" aria-label="Tipo de sugerencia">
          {KINDS.map((k) => {
            const Icon = KIND_ICON[k.value];
            return (
              <button key={k.value} onClick={() => setKind(k.value)}
                role="radio" aria-checked={kind === k.value}
                className={`chip flex-1 justify-center gap-1.5 ${kind === k.value ? "chip-active" : ""}`}>
                <Icon size={16} strokeWidth={1.75} aria-hidden />{k.label}
              </button>
            );
          })}
        </div>

        <div>
          <label htmlFor="sug-body" className="sr-only">Tu sugerencia</label>
          <textarea id="sug-body" value={body} maxLength={BODY_MAX} rows={4}
            onChange={(e) => { setBody(e.target.value); setMsg(null); }}
            placeholder={kind === "fallo" ? "¿Qué ha pasado? ¿Qué esperabas que pasara?" : "Cuéntanos tu idea o comentario"}
            className="field bg-raised" />
          <p className="mt-1 text-right text-[11px] text-muted">{body.length}/{BODY_MAX}</p>
        </div>

        <input value={screen} maxLength={SCREEN_MAX} onChange={(e) => setScreen(e.target.value)}
          placeholder="¿En qué pantalla? (opcional, p. ej. Entreno)" aria-label="Pantalla (opcional)"
          className="field bg-raised" />

        <button onClick={send} disabled={busy} className="btn-primary w-full">
          {busy ? "Enviando…" : "Enviar"}
        </button>
        {msg && (
          <p role="status" className={`text-center text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>
        )}
        {!requireAuth && <p className="text-center text-[11px] text-muted">Modo demo: no se guarda.</p>}
      </section>

      <section>
        <p className="eyebrow border-b border-line pb-2">Tus sugerencias</p>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Cargando…</p>
        ) : list.length === 0 ? (
          <EmptyState icon={Inbox}>Aún no has enviado ninguna.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((s) => {
              const k = kindLabel(s.kind);
              const Icon = KIND_ICON[s.kind] ?? MessageSquare;
              return (
                <li key={s.id} className="py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <Icon size={14} strokeWidth={1.75} aria-hidden />
                      {k.label} · {new Date(s.created_at).toLocaleDateString("es-ES")}
                      {s.screen ? ` · ${s.screen}` : ""}
                    </p>
                    <span className={`chip min-h-6 shrink-0 px-2.5 text-[10px] ${statusTone(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm">{s.body}</p>
                  {s.coach_reply && (
                    <div className="mt-3 rounded-xl bg-surface p-3">
                      <p className="eyebrow text-accent">Respuesta de tu entrenadora</p>
                      <p className="mt-1 whitespace-pre-line text-sm">{s.coach_reply}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
