"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronRight, ClipboardCheck, MessageCircle, Users } from "lucide-react";
import { Avatar, EmptyState, ICON, PageHeader } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import { parseLocalDay } from "@/lib/dates";
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
    return { text: `${a.days} días inactiva`, tone: "risk" };
  };

  const dot = (tone: string) =>
    tone === "ok" ? "bg-ok" : tone === "mid" ? "bg-accent" : tone === "risk" ? "bg-danger" : "bg-raised";

  const unreadTotal = unreadEntries.reduce((s, [, n]) => s + n, 0);
  const num = (n: number) => (loading ? "—" : n);
  const stats: { label: string; value: number | string; tone?: string; href?: string }[] = [
    { label: "Clientas", value: num(clients.length) },
    { label: "Check-ins por revisar", value: num(checkins.length), tone: checkins.length > 0 ? "text-accent" : "" },
    { label: "En riesgo", value: num(atRisk.length), tone: atRisk.length > 0 ? "text-danger" : "" },
    { label: "Mensajes sin leer", value: num(unreadTotal), tone: unreadTotal > 0 ? "text-accent" : "" },
    { label: "Sugerencias nuevas", value: num(newSuggestions), tone: newSuggestions > 0 ? "text-accent" : "", href: "/coach/sugerencias" },
  ];

  return (
    <main className="space-y-8">
      <PageHeader eyebrow="Panel" title="Resumen" />

      {/* ---------- Indicadores ---------- */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => {
          const body = (
            <>
              <dt className="eyebrow">{s.label}</dt>
              <dd className={`figure mt-2 text-[40px] ${s.tone ?? ""}`}>{s.value}</dd>
            </>
          );
          return s.href
            ? <Link key={s.label} href={s.href} className="block">{body}</Link>
            : <div key={s.label}>{body}</div>;
        })}
      </dl>

      {err && <p className="rounded-xl bg-danger/15 p-3 text-xs text-danger">{err}</p>}

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        {/* ---------- Columna principal: clientas ---------- */}
        <section>
          <p className="eyebrow border-b border-line pb-2">Tus clientas</p>
          {loading ? (
            <p className="py-4 text-sm text-muted">Cargando…</p>
          ) : clients.length === 0 ? (
            <EmptyState icon={Users}>
              Aún no tienes clientas asignadas. Crea una cuenta de clienta y aparecerá aquí automáticamente.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {clients.map((c) => {
                const lab = activityLabel(c);
                return (
                  <li key={c.id}>
                    <Link href={`/coach/clientes/${c.id}`} className="flex items-center gap-3 py-3">
                      <Avatar name={c.full_name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.full_name}</span>
                        <span className={`mt-0.5 flex items-center gap-1.5 text-xs ${lab.tone === "risk" ? "text-danger" : "text-muted"}`}>
                          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot(lab.tone)}`} />
                          {lab.text}
                        </span>
                      </span>
                      {pendingAppt[c.id] > 0 && (
                        <span className="chip min-h-6 shrink-0 gap-1 bg-accent/15 px-2 text-[10px] text-accent"
                          aria-label={`${pendingAppt[c.id]} citas por ver`}>
                          <CalendarDays size={12} strokeWidth={2} aria-hidden /> {pendingAppt[c.id]}
                        </span>
                      )}
                      {unread[c.id] > 0 && (
                        <span className="chip chip-active min-h-6 shrink-0 gap-1 px-2 text-[10px]"
                          aria-label={`${unread[c.id]} mensajes sin leer`}>
                          <MessageCircle size={12} strokeWidth={2} aria-hidden /> {unread[c.id]}
                        </span>
                      )}
                      <ChevronRight {...ICON} className="shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ---------- Columna lateral: lo que pide atención ---------- */}
        <div className="space-y-8">
          {!loading && atRisk.length > 0 && (
            <section>
              <p className="eyebrow flex items-center gap-1.5 border-b border-line pb-2 text-danger">
                <AlertTriangle size={14} strokeWidth={2} aria-hidden /> Necesitan un empujón
              </p>
              <ul className="divide-y divide-line">
                {atRisk.map((c) => {
                  const a = activity[c.id];
                  return (
                    <li key={c.id}>
                      <Link href={`/coach/clientes/${c.id}`} className="flex items-center justify-between gap-3 py-3">
                        <span className="truncate text-sm font-medium">{c.full_name}</span>
                        <span className="shrink-0 text-xs text-danger">
                          {a?.days != null ? `${a.days} días sin actividad` : "nunca ha registrado nada"}
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

          {!loading && unreadEntries.length > 0 && (
            <section>
              <p className="eyebrow flex items-center gap-1.5 border-b border-line pb-2 text-accent">
                <MessageCircle size={14} strokeWidth={2} aria-hidden /> Mensajes sin leer
              </p>
              <ul className="divide-y divide-line">
                {unreadEntries.map(([cid, n]) => (
                  <li key={cid}>
                    <Link href={`/coach/clientes/${cid}/chat`} className="flex items-center justify-between gap-3 py-3">
                      <span className="truncate text-sm font-medium">{nameById(cid)}</span>
                      <span className="shrink-0 text-xs text-accent">{n} sin leer</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <p className="eyebrow flex items-center gap-1.5 border-b border-line pb-2">
              <ClipboardCheck size={14} strokeWidth={2} aria-hidden /> Check-ins por revisar
            </p>
            {loading ? (
              <p className="py-4 text-sm text-muted">Cargando…</p>
            ) : checkins.length === 0 ? (
              <p className="py-4 text-sm text-muted">
                Sin check-ins pendientes. Cuando una clienta complete su revisión semanal, aparecerá aquí.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {checkins.map((ci) => (
                  <li key={ci.id}>
                    <Link href={`/coach/clientes/${ci.client_id}`} className="flex items-center justify-between gap-3 py-3">
                      <span className="truncate text-sm">{nameById(ci.client_id)}</span>
                      <span className="shrink-0 text-xs text-muted">
                        semana {parseLocalDay(ci.week_start).toLocaleDateString("es-ES")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!loading && appts.length > 0 && (
            <section>
              <p className="eyebrow flex items-center gap-1.5 border-b border-line pb-2">
                <CalendarDays size={14} strokeWidth={2} aria-hidden /> Próximas citas
              </p>
              <ul className="divide-y divide-line">
                {appts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/coach/clientes/${a.client_id}/agenda`}
                      className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{nameById(a.client_id)}</span>
                        <span className="block truncate text-xs text-muted">{a.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">{formatWhen(a.starts_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
