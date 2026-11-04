"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  STATUSES, SUGGESTION_SELECT, REPLY_MAX,
  kindLabel, statusTone,
  type Suggestion, type SuggestionStatus,
} from "@/lib/suggestions";

type Row = Suggestion & { profiles: { full_name: string } | null };
type Filter = "todas" | SuggestionStatus;

export default function SugerenciasCoach() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("todas");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      // la RLS ya limita a las de sus clientas
      const { data, error } = await sb.from("suggestions")
        .select(`${SUGGESTION_SELECT},profiles(full_name)`)
        .order("created_at", { ascending: false });
      if (error) setErr("No se pudieron cargar las sugerencias (¿falta la migración 0013?).");
      const list = (data as unknown as Row[]) || [];
      setRows(list);
      setDrafts(Object.fromEntries(list.map((r) => [r.id, r.coach_reply || ""])));
      setLoading(false);
    })();
  }, []);

  function flash(id: string) {
    setSavedId(id);
    setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1500);
  }

  async function setStatus(r: Row, status: SuggestionStatus) {
    setErr(null);
    const sb = getSupabase();
    if (!sb || status === r.status) return;
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status } : x)));
    const { error } = await sb.from("suggestions").update({ status }).eq("id", r.id);
    if (error) {
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status: r.status } : x)));
      setErr("No se pudo cambiar el estado.");
      return;
    }
    flash(r.id);
  }

  async function reply(r: Row) {
    setErr(null);
    const sb = getSupabase();
    if (!sb) return;
    const text = (drafts[r.id] || "").trim().slice(0, REPLY_MAX) || null;
    // responder implica haberla leído: si seguía "recibida", pasa a "leída"
    const status: SuggestionStatus = r.status === "recibida" ? "leida" : r.status;
    const { error } = await sb.from("suggestions").update({ coach_reply: text, status }).eq("id", r.id);
    if (error) { setErr("No se pudo guardar la respuesta."); return; }
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, coach_reply: text, status } : x)));
    flash(r.id);
  }

  const count = (s: SuggestionStatus) => rows.filter((r) => r.status === s).length;
  const shown = filter === "todas" ? rows : rows.filter((r) => r.status === filter);
  const filters: { value: Filter; label: string }[] = [
    { value: "todas", label: `Todas (${rows.length})` },
    ...STATUSES.map((s) => ({ value: s.value, label: `${s.label}s (${count(s.value)})` })),
  ];

  return (
    <main className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Sugerencias</h1>
        <p className="mt-1 text-sm text-muted">Fallos, ideas y comentarios que te envían tus clientas desde Perfil.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por estado">
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} role="tab" aria-selected={filter === f.value}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${filter === f.value ? "bg-accent text-accent-ink" : "border border-line text-muted"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {err && <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{err}</p>}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : shown.length === 0 ? (
        <p className="card p-6 text-center text-sm text-muted">
          {rows.length === 0 ? "Todavía no has recibido ninguna sugerencia." : "No hay sugerencias con este estado."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const k = kindLabel(r.kind);
            const draft = drafts[r.id] ?? "";
            return (
              <li key={r.id} className={`card p-4 ${r.status === "recibida" ? "border-accent/40" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <Link href={`/coach/clientes/${r.client_id}`} className="font-semibold underline-offset-2 hover:underline">
                      {r.profiles?.full_name || "Clienta"}
                    </Link>
                    <span className="text-muted"> · <span aria-hidden>{k.icon} </span>{k.label} · {new Date(r.created_at).toLocaleDateString("es-ES")}</span>
                  </p>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Estado
                    <select value={r.status} onChange={(e) => setStatus(r, e.target.value as SuggestionStatus)}
                      className={`rounded-full border border-line px-2 py-1 text-xs font-semibold ${statusTone(r.status)}`}>
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    {savedId === r.id && <span className="text-ok">✓</span>}
                  </label>
                </div>
                {r.screen && <p className="mt-1 text-xs text-muted">Pantalla: {r.screen}</p>}
                <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>

                <div className="mt-3 flex gap-2">
                  <input value={draft} maxLength={REPLY_MAX}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") reply(r); }}
                    placeholder="Respuesta corta para la clienta (opcional)"
                    aria-label={`Respuesta a ${r.profiles?.full_name || "la clienta"}`}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
                  <button onClick={() => reply(r)} disabled={draft.trim() === (r.coach_reply || "")}
                    className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-ink disabled:opacity-50">
                    {r.coach_reply ? "Actualizar" : "Responder"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
