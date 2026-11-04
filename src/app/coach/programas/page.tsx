"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

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
      ? `“${source.title}” guardado como plantilla ✓`
      : `“${source.title}” duplicado y activado para ${clientName(target)} ✓`);
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
    setMsg(`“${p.title}” es ahora el programa activo de ${clientName(p.client_id)} ✓`);
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
        <div className="flex items-center justify-between gap-2">
          <Link href={`/coach/programas/${p.id}`} className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="truncate">{p.title}</span>
              {p.is_active && (
                <span className="shrink-0 rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-semibold text-ok">
                  Activo
                </span>
              )}
            </p>
            <p className="text-xs text-muted">
              {p.is_template ? "📋 Plantilla" : clientName(p.client_id)} · {p.weeks} sem · {p.days_per_week} días/sem
            </p>
          </Link>
          {!p.is_template && p.client_id && !p.is_active && (
            <button onClick={() => activate(p)} disabled={busy}
              title={`Hacer que ${clientName(p.client_id)} vea este programa`}
              className="shrink-0 rounded-full border border-ok/50 px-3 py-1.5 text-xs font-medium text-ok disabled:opacity-60">
              Activar
            </button>
          )}
          <button
            onClick={() => { setDupOpen(open ? null : p.id); setDupTarget(p.is_template ? (clients[0]?.id || "") : "template"); }}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs">
            {p.is_template ? "Usar" : "Duplicar"}
          </button>
          <button onClick={() => remove(p)} aria-label={`Borrar ${p.title}`}
            className="shrink-0 rounded-full border border-line px-2.5 py-1.5 text-xs text-muted">
            🗑
          </button>
        </div>
        {open && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-raised p-2">
            <select value={dupTarget} onChange={(e) => setDupTarget(e.target.value)}
              aria-label="Destino de la copia"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
              {!p.is_template && <option value="template">📋 Guardar como plantilla</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>→ {c.full_name}</option>
              ))}
            </select>
            <button onClick={() => dupTarget && duplicate(p, dupTarget)} disabled={busy || !dupTarget}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-ink disabled:opacity-60">
              {busy ? "Copiando…" : "Copiar"}
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Programas</h1>

      {msg && <p className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs">{msg}</p>}

      <section className="card space-y-3 p-4">
        <p className="eyebrow">Crear programa desde cero</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (p. ej. Hipertrofia · Bloque 1)"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        <div className="flex flex-wrap items-center gap-2">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Clienta"
            className="rounded-lg border border-line bg-bg px-3 py-2.5 text-sm">
            {clients.length === 0 && <option value="">— sin clientas —</option>}
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted">
            Semanas
            <input type="number" min={1} max={12} value={weeks}
              onChange={(e) => setWeeks(+e.target.value || 1)}
              className="w-16 rounded-lg border border-line bg-bg px-2 py-2 text-center text-sm" />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            Días/semana
            <input type="number" min={1} max={7} value={days}
              onChange={(e) => setDays(+e.target.value || 1)}
              className="w-16 rounded-lg border border-line bg-bg px-2 py-2 text-center text-sm" />
          </label>
        </div>
        <button onClick={create} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
          Crear y abrir constructor
        </button>
        <p className="text-[11px] text-muted">
          Consejo: monta el programa una vez, guárdalo como plantilla y reutilízalo con cada clienta.
        </p>
      </section>

      <section className="card p-4">
        <p className="eyebrow">📋 Plantillas ({templates.length})</p>
        {loading ? <p className="mt-3 text-sm text-muted">Cargando…</p>
        : templates.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
            Sin plantillas aún. En cualquier programa, pulsa “Duplicar” → “Guardar como plantilla”.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-line">{templates.map((p) => <Row key={p.id} p={p} />)}</ul>
        )}
      </section>

      <section className="card p-4">
        <p className="eyebrow">Programas de clientas ({assigned.length})</p>
        {loading ? <p className="mt-3 text-sm text-muted">Cargando…</p>
        : assigned.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">Todavía no hay programas.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">{assigned.map((p) => <Row key={p.id} p={p} />)}</ul>
        )}
      </section>
    </main>
  );
}
