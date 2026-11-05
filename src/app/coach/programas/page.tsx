"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, LayoutTemplate, Trash2, Dumbbell } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { EmptyState, ICON, PageHeader } from "@/components/ui";

type Program = {
  id: string; title: string; weeks: number; days_per_week: number;
  client_id: string | null; is_template: boolean; is_active: boolean; created_at: string;
};
type Client = { id: string; full_name: string };

export default function Programas() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [days, setDays] = useState(3);
  const [msg, setMsg] = useState<string | null>(null);
  // panel de duplicado: id del programa abierto + destino elegido
  const [dupOpen, setDupOpen] = useState<string | null>(null);
  const [dupTarget, setDupTarget] = useState<string>("template");
  const [busy, setBusy] = useState(false);

  async function load() {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data: u } = await sb.auth.getUser();
    const [{ data: pr }, { data: cl }] = await Promise.all([
      sb.from("programs")
        .select("id,title,weeks,days_per_week,client_id,is_template,is_active,created_at")
        .order("created_at", { ascending: false }),
      sb.from("profiles").select("id, full_name").eq("coach_id", u.user!.id).eq("role", "client").order("full_name"),
    ]);
    setPrograms(pr || []);
    setClients(cl || []);
    if (!clientId && cl && cl.length) setClientId(cl[0].id);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const clientName = (id: string | null) =>
    clients.find((c) => c.id === id)?.full_name || "Sin asignar";

  async function create() {
    setMsg(null);
    if (!title.trim()) { setMsg("Ponle un título al programa."); return; }
    if (!clientId) { setMsg("Elige una clienta."); return; }
    const sb = getSupabase();
    if (!sb) return;
    const { data: u } = await sb.auth.getUser();
    const { data, error } = await sb.from("programs").insert({
      coach_id: u.user!.id, client_id: clientId, title: title.trim(),
      weeks, days_per_week: days,
    }).select("id").single();
    if (error || !data) { setMsg("No se pudo crear el programa."); return; }
    // el programa recién creado pasa a ser el activo de esa clienta
    await sb.rpc("set_active_program", { p_program_id: data.id });
    window.location.href = `/coach/programas/${data.id}`;
  }

  /** Copia un programa completo (con sus ejercicios) a una clienta o como plantilla. */
  async function duplicate(source: Program, target: string) {
    setMsg(null); setBusy(true);
    const sb = getSupabase();
    if (!sb) { setBusy(false); return; }
    const { data: u } = await sb.auth.getUser();
    const asTemplate = target === "template";
    const newTitle = asTemplate
      ? `${source.title} (plantilla)`
      : source.title;

    const { data: np, error: e1 } = await sb.from("programs").insert({
      coach_id: u.user!.id,
      client_id: asTemplate ? null : target,
      title: newTitle,
      weeks: source.weeks,
      days_per_week: source.days_per_week,
      is_template: asTemplate,
    }).select("id").single();
    if (e1 || !np) { setBusy(false); setMsg("No se pudo crear la copia."); return; }

    const { data: rows, error: e2 } = await sb.from("program_exercises")
      .select("exercise_id,week,day,position,set_scheme,set_type,rest_seconds,coach_notes,hidden")
      .eq("program_id", source.id);
    if (e2) { setBusy(false); setMsg("Copia creada, pero no se pudieron leer los ejercicios."); return; }

    if (rows && rows.length) {
      const { error: e3 } = await sb.from("program_exercises").insert(
        rows.map((r) => ({ ...r, program_id: np.id }))
      );
      if (e3) { setBusy(false); setMsg("Copia creada, pero falló el copiado de ejercicios."); return; }
    }
    // una copia asignada a una clienta pasa a ser su programa activo
    if (!asTemplate) {
      const { error: e4 } = await sb.rpc("set_active_program", { p_program_id: np.id });
      if (e4) {
        setBusy(false); setDupOpen(null);
        setMsg("Copia creada, pero no se pudo marcar como activa.");
        load(); return;
      }
    }
    setBusy(false); setDupOpen(null);
    setMsg(asTemplate
      ? `“${source.title}” guardado como plantilla.`
      : `“${source.title}” duplicado y activado para ${clientName(target)}.`);
    load();
  }

  /** Marca un programa como el activo de su clienta; la RPC desactiva el anterior. */
  async function activate(p: Program) {
    setMsg(null); setBusy(true);
    const sb = getSupabase();
    if (!sb) { setBusy(false); return; }
    const { error } = await sb.rpc("set_active_program", { p_program_id: p.id });
    setBusy(false);
    if (error) { setMsg("No se pudo activar el programa."); return; }
    setMsg(`“${p.title}” es ahora el programa activo de ${clientName(p.client_id)}.`);
    load();
  }

  async function remove(p: Program) {
    setMsg(null);
    const sb = getSupabase();
    if (!sb) return;
    // primero los ejercicios del programa, luego el programa
    await sb.from("program_exercises").delete().eq("program_id", p.id);
    const { error } = await sb.from("programs").delete().eq("id", p.id);
    if (error) setMsg("No se pudo borrar: la clienta ya tiene registros en este programa.");
    else { setMsg(`“${p.title}” borrado.`); load(); }
  }

  const templates = programs.filter((p) => p.is_template);
  const assigned = programs.filter((p) => !p.is_template);

  function Row({ p }: { p: Program }) {
    const open = dupOpen === p.id;
    return (
      <li className="py-3">
        <div className="flex items-center justify-between gap-1">
          <Link href={`/coach/programas/${p.id}`} className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="truncate">{p.title}</span>
              {p.is_active && (
                <span className="chip min-h-6 shrink-0 bg-ok/15 px-2.5 text-[10px] text-ok">Activo</span>
              )}
              {p.is_template && (
                <span className="chip min-h-6 shrink-0 bg-surface px-2.5 text-[10px]">Plantilla</span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {p.is_template ? "Plantilla" : clientName(p.client_id)} · {p.weeks} sem · {p.days_per_week} días/sem
            </p>
          </Link>
          {!p.is_template && p.client_id && !p.is_active && (
            <button onClick={() => activate(p)} disabled={busy}
              title={`Hacer que ${clientName(p.client_id)} vea este programa`}
              className="chip shrink-0 bg-ok/15 text-ok disabled:opacity-60">
              Activar
            </button>
          )}
          <button
            onClick={() => { setDupOpen(open ? null : p.id); setDupTarget(p.is_template ? (clients[0]?.id || "") : "template"); }}
            aria-expanded={open}
            className={`chip shrink-0 gap-1.5 ${open ? "chip-active" : "bg-surface text-ink"}`}>
            <Copy size={14} strokeWidth={1.75} aria-hidden /> {p.is_template ? "Usar" : "Duplicar"}
          </button>
          <button onClick={() => remove(p)} aria-label={`Borrar ${p.title}`} title="Borrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-danger">
            <Trash2 {...ICON} />
          </button>
        </div>
        {open && (
          <div className="card mt-2 flex items-center gap-2 p-2">
            <select value={dupTarget} onChange={(e) => setDupTarget(e.target.value)}
              aria-label="Destino de la copia"
              className="field min-w-0 flex-1 bg-raised py-2.5">
              {!p.is_template && <option value="template">Guardar como plantilla</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>Para {c.full_name}</option>
              ))}
            </select>
            <button onClick={() => dupTarget && duplicate(p, dupTarget)} disabled={busy || !dupTarget}
              className="btn-primary shrink-0">
              {busy ? "Copiando…" : "Copiar"}
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <main className="space-y-8">
      <PageHeader eyebrow="Entrenamiento" title="Programas" />

      {msg && <p role="status" className="rounded-xl bg-accent/15 p-3 text-xs">{msg}</p>}

      <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
      <section className="card space-y-3 self-start">
        <p className="eyebrow">Crear programa desde cero</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (p. ej. Hipertrofia · Bloque 1)" aria-label="Título del programa"
          className="field bg-raised" />
        <div className="flex flex-wrap items-center gap-2">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Clienta"
            className="field w-auto min-w-0 flex-1 bg-raised">
            {clients.length === 0 && <option value="">Sin clientas</option>}
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted">
            Semanas
            <input type="number" min={1} max={12} value={weeks}
              onChange={(e) => setWeeks(+e.target.value || 1)}
              className="field figure w-16 bg-raised px-2 text-center text-base" />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            Días/semana
            <input type="number" min={1} max={7} value={days}
              onChange={(e) => setDays(+e.target.value || 1)}
              className="field figure w-16 bg-raised px-2 text-center text-base" />
          </label>
        </div>
        <button onClick={create} className="btn-primary w-full">
          Crear y abrir constructor
        </button>
        <p className="text-[11px] text-muted">
          Consejo: monta el programa una vez, guárdalo como plantilla y reutilízalo con cada clienta.
        </p>
      </section>

      <div className="space-y-8">
      <section>
        <p className="eyebrow flex items-center gap-1.5 border-b border-line pb-2">
          <LayoutTemplate size={14} strokeWidth={2} aria-hidden /> Plantillas ({templates.length})
        </p>
        {loading ? <p className="py-3 text-sm text-muted">Cargando…</p>
        : templates.length === 0 ? (
          <p className="py-3 text-sm text-muted">
            Sin plantillas aún. En cualquier programa, pulsa “Duplicar” y elige “Guardar como plantilla”.
          </p>
        ) : (
          <ul className="divide-y divide-line">{templates.map((p) => <Row key={p.id} p={p} />)}</ul>
        )}
      </section>

      <section>
        <p className="eyebrow border-b border-line pb-2">Programas de clientas ({assigned.length})</p>
        {loading ? <p className="py-3 text-sm text-muted">Cargando…</p>
        : assigned.length === 0 ? (
          <EmptyState icon={Dumbbell}>Todavía no hay programas.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">{assigned.map((p) => <Row key={p.id} p={p} />)}</ul>
        )}
      </section>
      </div>
      </div>
    </main>
  );
}
