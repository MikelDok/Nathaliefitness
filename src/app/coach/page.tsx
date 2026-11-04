"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { unreadByThread } from "@/lib/chat";
import {
  APPOINTMENT_SELECT, pendingByThread, formatWhen, type Appointment,
} from "@/lib/agenda";

type Client = { id: string; full_name: string; created_at: string };
type CheckIn = { id: string; client_id: string; week_start: string };
type Activity = { last: string | null; days: number | null }; // days desde la última actividad

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + (dateStr.length === 10 ? "T12:00:00" : ""));
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export default function CoachDashboard() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [activity, setActivity] = useState<Record<string, Activity>>({});
  const [err, setErr] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [pendingAppt, setPendingAppt] = useState<Record<string, number>>({});
  const [newSuggestions, setNewSuggestions] = useState(0);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setLoading(false); return; }

      const [{ data: cl, error: e1 }, { data: ci, error: e2 }] = await Promise.all([
        sb.from("profiles").select("id, full_name, created_at")
          .eq("coach_id", uid).eq("role", "client")
          .order("created_at", { ascending: false }),
        sb.from("check_ins").select("id, client_id, week_start")
          .is("coach_reply", null)
          .order("week_start", { ascending: false }),
      ]);
      if (e1 || e2) setErr("No se pudieron cargar todos los datos.");
      const clientList = cl || [];
      setClients(clientList);
      setCheckins(ci || []);
      setUnread(await unreadByThread(sb, uid));

      // sugerencias sin revisar (la RLS ya limita a las de sus clientas)
      const { count: sug } = await sb.from("suggestions").select("id", { count: "exact", head: true })
        .eq("status", "recibida");
      setNewSuggestions(sug || 0);

      // citas de todas sus clientas, próximas primero (la RLS ya filtra)
      const from = new Date(); from.setHours(0, 0, 0, 0);
      const { data: ap } = await sb.from("appointments").select(APPOINTMENT_SELECT)
        .eq("status", "confirmada").gte("starts_at", from.toISOString())
        .order("starts_at").limit(10);
      setAppts((ap as unknown as Appointment[]) || []);
      setPendingAppt(await pendingByThread(sb, uid, true));

      // Última actividad por clienta: entrenos, hábitos, diario, peso, check-ins
      const [logs, habs, fd, ms, allCi] = await Promise.all([
        sb.from("exercise_logs").select("client_id, performed_at")
          .order("performed_at", { ascending: false }).limit(300),
        sb.from("habits").select("id, client_id"),
        sb.from("food_diary").select("client_id, eaten_on")
          .order("eaten_on", { ascending: false }).limit(300),
        sb.from("measurements").select("client_id, measured_at")
          .order("measured_at", { ascending: false }).limit(300),
        sb.from("check_ins").select("client_id, week_start")
          .order("week_start", { ascending: false }).limit(300),
      ]);
      const habitOwner = new Map((habs.data || []).map((h) => [h.id, h.client_id]));
      const habitIds = [...habitOwner.keys()];
      const hl = habitIds.length
        ? await sb.from("habit_logs").select("habit_id, logged_on")
            .in("habit_id", habitIds).order("logged_on", { ascending: false }).limit(300)
        : { data: [] as { habit_id: string; logged_on: string }[] };

      const best: Record<string, string> = {};
      const consider = (clientId: string | undefined, date: string | null) => {
        if (!clientId || !date) return;
        if (!best[clientId] || date > best[clientId]) best[clientId] = date;
      };
      (logs.data || []).forEach((r) => consider(r.client_id, r.performed_at));
      (fd.data || []).forEach((r) => consider(r.client_id, r.eaten_on));
      (ms.data || []).forEach((r) => consider(r.client_id, r.measured_at));
      (allCi.data || []).forEach((r) => consider(r.client_id, r.week_start));
      (hl.data || []).forEach((r) => consider(habitOwner.get(r.habit_id), r.logged_on));

      const act: Record<string, Activity> = {};
      clientList.forEach((c) => {
        const last = best[c.id] || null;
        act[c.id] = { last, days: last ? daysSince(last) : null };
      });
      setActivity(act);
      setLoading(false);
    })();
  }, []);

  const nameById = (id: string) => clients.find((c) => c.id === id)?.full_name || "Cliente";

  const unreadEntries = Object.entries(unread).filter(([, n]) => n > 0);

  // En riesgo: ≥5 días sin actividad, o nunca activa y alta hace ≥5 días
  const atRisk = clients.filter((c) => {
    const a = activity[c.id];
    if (!a) return false;
    if (a.days != null) return a.days >= 5;
    return daysSince(c.created_at.slice(0, 10)) >= 5;
  });

  const activityLabel = (c: Client) => {
    const a = activity[c.id];
    if (!a || a.days == null) return { text: "sin actividad aún", tone: "muted" };
    if (a.days === 0) return { text: "activa hoy", tone: "ok" };
    if (a.days === 1) return { text: "activa ayer", tone: "ok" };
    if (a.days < 5) return { text: `hace ${a.days} días`, tone: "mid" };
    return { text: `⚠ ${a.days} días inactiva`, tone: "risk" };
  };

  const dot = (tone: string) =>
    tone === "ok" ? "bg-ok" : tone === "mid" ? "bg-accent" : tone === "risk" ? "bg-red-400" : "bg-line";

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Resumen</h1>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="eyebrow">Clientes</p>
          <p className="figure mt-1 text-3xl">{loading ? "—" : clients.length}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Check-ins</p>
          <p className="figure mt-1 text-3xl">{loading ? "—" : checkins.length}</p>
        </div>
        <div className={`card p-4 ${atRisk.length > 0 ? "border-red-400/40" : ""}`}>
          <p className="eyebrow">En riesgo</p>
          <p className={`figure mt-1 text-3xl ${atRisk.length > 0 ? "text-red-400" : ""}`}>
            {loading ? "—" : atRisk.length}
          </p>
        </div>
      </div>

      {err && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{err}</p>
      )}

      {!loading && unreadEntries.length > 0 && (
        <section className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
          <p className="eyebrow text-accent">💬 Mensajes sin leer</p>
          <ul className="mt-3 divide-y divide-line/50">
            {unreadEntries.map(([cid, n]) => (
              <li key={cid}>
                <Link href={`/coach/clientes/${cid}/chat`}
                  className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium">{nameById(cid)}</span>
                  <span className="text-xs text-accent">
                    {n} sin leer ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && newSuggestions > 0 && (
        <Link href="/coach/sugerencias"
          className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/5 p-4">
          <div className="min-w-0">
            <p className="eyebrow text-accent">💡 Sugerencias</p>
            <p className="mt-1 text-sm">
              {newSuggestions} sugerencia{newSuggestions > 1 ? "s" : ""} nueva{newSuggestions > 1 ? "s" : ""} del piloto
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">
            {newSuggestions}
          </span>
        </Link>
      )}

      {!loading && appts.length > 0 && (
        <section className="card p-4">
          <p className="eyebrow">🗓 Próximas citas</p>
          <ul className="mt-3 divide-y divide-line">
            {appts.map((a) => (
              <li key={a.id}>
                <Link href={`/coach/clientes/${a.client_id}/agenda`}
                  className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{nameById(a.client_id)}</span>
                    <span className="block truncate text-xs text-muted">{a.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatWhen(a.starts_at)} ›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && atRisk.length > 0 && (
        <section className="rounded-2xl border border-red-400/40 bg-red-500/5 p-4">
          <p className="eyebrow text-red-400">⚠ Necesitan un empujón</p>
          <ul className="mt-3 divide-y divide-line/50">
            {atRisk.map((c) => {
              const a = activity[c.id];
              return (
                <li key={c.id}>
                  <Link href={`/coach/clientes/${c.id}`} className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium">{c.full_name}</span>
                    <span className="text-xs text-red-300">
                      {a?.days != null ? `${a.days} días sin actividad ›` : "nunca ha registrado nada ›"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            Un mensaje a tiempo evita un abandono. Entra en su ficha y revisa qué está pasando.
          </p>
        </section>
      )}

      <section className="card p-4">
        <p className="eyebrow">Tus clientes</p>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Cargando…</p>
        ) : clients.length === 0 ? (
          <div className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
            Aún no tienes clientes asignados. Crea una cuenta de cliente y aparecerá aquí automáticamente.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {clients.map((c) => {
              const lab = activityLabel(c);
              return (
                <li key={c.id}>
                  <Link href={`/coach/clientes/${c.id}`} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot(lab.tone)}`} />
                      <span className="truncate text-sm">{c.full_name}</span>
                      {pendingAppt[c.id] > 0 && (
                        <span className="shrink-0 rounded-full border border-accent/50 px-2 py-0.5 text-[10px] text-accent">
                          🗓 {pendingAppt[c.id]}
                        </span>
                      )}
                      {unread[c.id] > 0 && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">
                          {unread[c.id]}
                        </span>
                      )}
                    </span>
                    <span className={`shrink-0 text-xs ${lab.tone === "risk" ? "text-red-300" : "text-muted"}`}>
                      {lab.text} ›
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <p className="eyebrow">Check-ins por revisar</p>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Cargando…</p>
        ) : checkins.length === 0 ? (
          <div className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
            Sin check-ins pendientes. Cuando una clienta complete su revisión semanal, aparecerá aquí.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {checkins.map((ci) => (
              <li key={ci.id}>
                <Link href={`/coach/clientes/${ci.client_id}`} className="flex items-center justify-between py-3">
                  <span className="text-sm">{nameById(ci.client_id)}</span>
                  <span className="text-xs text-muted">
                    semana {new Date(ci.week_start).toLocaleDateString("es-ES")} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
