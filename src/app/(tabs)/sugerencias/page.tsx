"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";
import {
  KINDS, SUGGESTION_SELECT, BODY_MAX, SCREEN_MAX,
  kindLabel, statusLabel, statusTone,
  type Suggestion, type SuggestionKind,
} from "@/lib/suggestions";

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
    setMsg({ ok: true, text: "Gracias, lo leerá Nathalie ✓" });
  }

  return (
    <main className="space-y-5">
      <header>
        <Link href="/perfil" className="text-xs text-muted">‹ Perfil</Link>
        <h1 className="mt-1 text-2xl font-bold">Sugerencias</h1>
        <p className="mt-1 text-sm text-muted">
          Estamos en fase piloto: cuéntanos qué falla o qué echas de menos.
        </p>
      </header>

      <section className="card space-y-3 p-4">
        <div className="flex gap-2" role="radiogroup" aria-label="Tipo de sugerencia">
          {KINDS.map((k) => (
            <button key={k.value} onClick={() => setKind(k.value)}
              role="radio" aria-checked={kind === k.value}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium ${kind === k.value ? "bg-accent text-accent-ink" : "border border-line text-muted"}`}>
              <span aria-hidden>{k.icon} </span>{k.label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="sug-body" className="sr-only">Tu sugerencia</label>
          <textarea id="sug-body" value={body} maxLength={BODY_MAX} rows={4}
            onChange={(e) => { setBody(e.target.value); setMsg(null); }}
            placeholder={kind === "fallo" ? "¿Qué ha pasado? ¿Qué esperabas que pasara?" : "Cuéntanos tu idea o comentario"}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
          <p className="text-right text-[11px] text-muted">{body.length}/{BODY_MAX}</p>
        </div>

        <input value={screen} maxLength={SCREEN_MAX} onChange={(e) => setScreen(e.target.value)}
          placeholder="¿En qué pantalla? (opcional, p. ej. Entreno)" aria-label="Pantalla (opcional)"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />

        <button onClick={send} disabled={busy}
          className="w-full rounded-full bg-accent py-3 font-semibold text-accent-ink disabled:opacity-60">
          {busy ? "Enviando…" : "Enviar"}
        </button>
        {msg && (
          <p role="status" className={`text-center text-sm ${msg.ok ? "text-ok" : "text-red-300"}`}>{msg.text}</p>
        )}
        {!requireAuth && <p className="text-center text-[11px] text-muted">Modo demo: no se guarda.</p>}
      </section>

      <section>
        <p className="eyebrow">Tus sugerencias</p>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">Aún no has enviado ninguna.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {list.map((s) => {
              const k = kindLabel(s.kind);
              return (
                <li key={s.id} className="card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted">
                      <span aria-hidden>{k.icon} </span>{k.label} · {new Date(s.created_at).toLocaleDateString("es-ES")}
                      {s.screen ? ` · ${s.screen}` : ""}
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusTone(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm">{s.body}</p>
                  {s.coach_reply && (
                    <div className="mt-3 rounded-xl bg-raised p-3">
                      <p className="text-xs font-semibold text-accent">Respuesta de tu entrenadora</p>
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
