"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Inbox } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { EmptyState, PageHeader, chip } from "@/components/ui";
import { SUGGESTION_ICON } from "@/components/icons";
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
    <main className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Piloto" title="Sugerencias">
        Fallos, ideas y comentarios que te envían tus clientas desde Perfil.
      </PageHeader>

      <div className="-mx-5 flex gap-1 overflow-x-auto px-5" role="tablist" aria-label="Filtrar por estado">
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} role="tab" aria-selected={filter === f.value}
            className={chip(filter === f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {err && <p className="rounded-xl bg-danger/15 p-3 text-xs text-danger">{err}</p>}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : shown.length === 0 ? (
        <EmptyState icon={Inbox}>
          {rows.length === 0 ? "Todavía no has recibido ninguna sugerencia." : "No hay sugerencias con este estado."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {shown.map((r) => {
            const k = kindLabel(r.kind);
            const KindIcon = SUGGESTION_ICON[r.kind];
            const draft = drafts[r.id] ?? "";
            return (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
                    {r.status === "recibida" && <span aria-label="Nueva" className="h-2 w-2 rounded-full bg-accent" />}
                    <Link href={`/coach/clientes/${r.client_id}`} className="font-medium underline-offset-2 hover:underline">
                      {r.profiles?.full_name || "Clienta"}
                    </Link>
                    <span className="flex items-center gap-1.5 text-muted">
                      · <KindIcon size={14} strokeWidth={1.75} aria-hidden /> {k.label} · {new Date(r.created_at).toLocaleDateString("es-ES")}
                    </span>
                  </p>
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Estado</span>
                    <select value={r.status} onChange={(e) => setStatus(r, e.target.value as SuggestionStatus)}
                      className={`chip min-h-7 cursor-pointer border-0 px-3 text-[11px] ${statusTone(r.status)}`}>
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    {savedId === r.id && <Check size={14} strokeWidth={2.5} aria-label="Guardado" className="text-ok" />}
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
                    className="field min-w-0 flex-1" />
                  <button onClick={() => reply(r)} disabled={draft.trim() === (r.coach_reply || "")}
                    className="btn-primary shrink-0">
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
