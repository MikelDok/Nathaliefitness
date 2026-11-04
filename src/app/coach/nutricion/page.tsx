"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

type Plan = { id: string; title: string; client_id: string | null; kcal_target: number | null; created_at: string };
type Client = { id: string; full_name: string };

export default function NutricionCoach() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [kcal, setKcal] = useState(""); const [prot, setProt] = useState("");
  const [fat, setFat] = useState(""); const [carbs, setCarbs] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data: u } = await sb.auth.getUser();
    const [{ data: pl }, { data: cl }] = await Promise.all([
      sb.from("meal_plans").select("id,title,client_id,kcal_target,created_at").order("created_at", { ascending: false }),
      sb.from("profiles").select("id,full_name").eq("coach_id", u.user!.id).eq("role", "client").order("full_name"),
    ]);
    setPlans(pl || []); setClients(cl || []);
    if (!clientId && cl?.length) setClientId(cl[0].id);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.full_name || "Plantilla";

  async function create() {
    setMsg(null);
    if (!title.trim()) { setMsg("Ponle un título al plan."); return; }
    if (!clientId) { setMsg("Elige una clienta."); return; }
    const sb = getSupabase();
    if (!sb) return;
    const { data: u } = await sb.auth.getUser();
    const { data, error } = await sb.from("meal_plans").insert({
      coach_id: u.user!.id, client_id: clientId, title: title.trim(),
      kcal_target: +kcal || null, protein_g: +prot || null,
      fat_g: +fat || null, carbs_g: +carbs || null,
    }).select("id").single();
    if (error || !data) { setMsg("No se pudo crear el plan."); return; }
    window.location.href = `/coach/nutricion/${data.id}`;
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Planes de comida</h1>

      <section className="card space-y-3 p-4">
        <p className="eyebrow">Crear plan</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (p. ej. Definición · 1.900 kcal)"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Clienta"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm">
          {clients.length === 0 && <option value="">— sin clientas —</option>}
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <div className="grid grid-cols-4 gap-2">
          {[["kcal/día", kcal, setKcal], ["Prot (g)", prot, setProt], ["Grasa (g)", fat, setFat], ["Carbs (g)", carbs, setCarbs]].map(([ph, v, set]) => (
            <input key={ph as string} value={v as string}
              onChange={(e) => (set as (s: string) => void)(e.target.value)}
              type="number" inputMode="numeric" placeholder={ph as string} aria-label={ph as string}
              className="figure rounded-lg border border-line bg-bg px-2 py-2.5 text-center text-sm" />
          ))}
        </div>
        {msg && <p className="text-xs text-danger">{msg}</p>}
        <button onClick={create} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
          Crear y abrir editor
        </button>
        <p className="text-[11px] text-muted">
          Pautas de fitness y bienestar; la nutrición clínica queda fuera de la app.
        </p>
      </section>

      <section className="card p-4">
        <p className="eyebrow">Planes existentes</p>
        {loading ? <p className="mt-3 text-sm text-muted">Cargando…</p>
        : plans.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">Todavía no hay planes.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {plans.map((p) => (
              <li key={p.id}>
                <Link href={`/coach/nutricion/${p.id}`} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-muted">
                      {clientName(p.client_id)}{p.kcal_target ? ` · ${p.kcal_target} kcal` : ""}
                    </p>
                  </div>
                  <span aria-hidden className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
