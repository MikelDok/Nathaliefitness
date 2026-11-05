"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Salad } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { EmptyState, ICON, PageHeader } from "@/components/ui";

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
    // sin sesión (modo demo) no hay coach: estado vacío en vez de fallar
    if (!u.user) { setLoading(false); return; }
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
    if (!u.user) { setMsg("Inicia sesión como entrenadora para crear."); return; }
    const { data, error } = await sb.from("meal_plans").insert({
      coach_id: u.user!.id, client_id: clientId, title: title.trim(),
      kcal_target: +kcal || null, protein_g: +prot || null,
      fat_g: +fat || null, carbs_g: +carbs || null,
    }).select("id").single();
    if (error || !data) { setMsg("No se pudo crear el plan."); return; }
    window.location.href = `/coach/nutricion/${data.id}`;
  }

  return (
    <main className="space-y-8">
      <PageHeader eyebrow="Nutrición" title="Planes de comida" />

      <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
      <section className="card space-y-3 self-start">
        <p className="eyebrow">Crear plan</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (p. ej. Definición · 1.900 kcal)" aria-label="Título del plan"
          className="field bg-raised" />
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Clienta"
          className="field bg-raised">
          {clients.length === 0 && <option value="">Sin clientas</option>}
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <div className="grid grid-cols-4 gap-2">
          {[["kcal/día", kcal, setKcal], ["Prot (g)", prot, setProt], ["Grasa (g)", fat, setFat], ["Carbs (g)", carbs, setCarbs]].map(([ph, v, set]) => (
            <input key={ph as string} value={v as string}
              onChange={(e) => (set as (s: string) => void)(e.target.value)}
              type="number" inputMode="numeric" placeholder={ph as string} aria-label={ph as string}
              className="field figure min-w-0 bg-raised px-2 text-center text-base placeholder:font-sans placeholder:text-xs placeholder:font-normal" />
          ))}
        </div>
        {msg && <p className="text-xs text-danger">{msg}</p>}
        <button onClick={create} className="btn-primary w-full">
          Crear y abrir editor
        </button>
        <p className="text-[11px] text-muted">
          Pautas de fitness y bienestar; la nutrición clínica queda fuera de la app.
        </p>
      </section>

      <section>
        <p className="eyebrow border-b border-line pb-2">Planes existentes ({plans.length})</p>
        {loading ? <p className="py-3 text-sm text-muted">Cargando…</p>
        : plans.length === 0 ? (
          <EmptyState icon={Salad}>Todavía no hay planes.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {plans.map((p) => (
              <li key={p.id}>
                <Link href={`/coach/nutricion/${p.id}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {clientName(p.client_id)}{p.kcal_target ? ` · ${p.kcal_target} kcal` : ""}
                    </p>
                  </div>
                  <ChevronRight {...ICON} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </main>
  );
}
