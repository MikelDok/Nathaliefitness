"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";

type Habit = { id: string; title: string; active: boolean };

export default function Habitos() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data: u } = await sb.auth.getUser();
    const { data } = await sb.from("habits").select("id,title,active")
      .eq("client_id", u.user!.id).order("title");
    setHabits((data as Habit[]) || []);
    setLoading(false);
  }
  useEffect(() => { if (requireAuth) load(); else setLoading(false); }, []);

  async function add() {
    setMsg(null);
    if (!title.trim()) { setMsg("Escribe el hábito."); return; }
    const sb = getSupabase();
    if (!sb) return;
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("habits").insert({ client_id: u.user!.id, title: title.trim() });
    if (error) { setMsg("No se pudo guardar."); return; }
    setTitle(""); load();
  }

  async function toggleActive(h: Habit) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("habits").update({ active: !h.active }).eq("id", h.id);
    load();
  }

  if (!requireAuth) {
    return (
      <main className="space-y-7">
        <PageHeader back="/" eyebrow="Rutina diaria" title="Mis hábitos" />
        <EmptyState icon={ListChecks}>Los hábitos funcionan con cuenta real.</EmptyState>
      </main>
    );
  }
  if (loading) return <main><p className="text-sm text-muted">Cargando…</p></main>;

  return (
    <main className="space-y-7">
      <PageHeader back="/" eyebrow="Rutina diaria" title="Mis hábitos" />

      <section className="card space-y-3">
        <p className="eyebrow">Añadir hábito</p>
        <div className="flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="P. ej. 10.000 pasos, 2 L de agua…"
            className="field min-w-0 flex-1 bg-raised" />
          <button onClick={add} className="btn-primary shrink-0 px-5">
            Añadir
          </button>
        </div>
        {msg && <p className="text-xs text-danger">{msg}</p>}
        <p className="text-[11px] text-muted">Tu entrenadora también puede asignarte hábitos; aparecerán aquí.</p>
      </section>

      <section>
        <p className="eyebrow border-b border-line pb-2">Tus hábitos</p>
        {habits.length === 0 ? (
          <EmptyState icon={ListChecks}>Aún no tienes hábitos. El primero es el que más cuesta.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {habits.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                <span className={`text-sm ${h.active ? "" : "text-muted line-through"}`}>{h.title}</span>
                <button onClick={() => toggleActive(h)}
                  className="chip shrink-0 bg-surface">
                  {h.active ? "Pausar" : "Reactivar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
