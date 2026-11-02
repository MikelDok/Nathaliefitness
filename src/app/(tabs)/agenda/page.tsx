"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Appointments from "@/components/Appointments";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import {
  APPOINTMENT_SELECT, PLAN_SELECT, WEEKDAYS,
  dateKey, sessionOn, formatTime, sameDay,
  type Appointment, type Plan,
} from "@/lib/agenda";

export default function Agenda() {
  const [uid, setUid] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [doneDays, setDoneDays] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => new Date());
  const [loading, setLoading] = useState(requireAuth);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      const { data: u } = await sb.auth.getUser();
      const id = u.user?.id;
      if (!id) { setLoading(false); return; }
      setUid(id);
      const [{ data: p }, { data: ap }, { data: lg }] = await Promise.all([
        // el programa activo, con el mismo criterio que Entreno
        sb.from("programs").select(PLAN_SELECT).eq("client_id", id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        sb.from("appointments").select(APPOINTMENT_SELECT).eq("client_id", id).order("starts_at"),
        sb.from("exercise_logs").select("performed_at").eq("client_id", id),
      ]);
      setPlan((p as unknown as Plan) || null);
      setAppts((ap as unknown as Appointment[]) || []);
      setDoneDays(new Set(((lg || []) as { performed_at: string }[]).map((l) => l.performed_at)));
      setLoading(false);
    })();
  }, []);

  // ---------- Rejilla del mes ----------
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const pad = (first.getDay() + 6) % 7;              // la semana empieza en lunes
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: pad }, () => null),
    ...Array.from({ length: total }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];

  const apptsOn = (d: Date) =>
    appts.filter((a) => a.status === "confirmada" && sameDay(new Date(a.starts_at), d));

  const shiftMonth = (n: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  const selSession = sessionOn(plan, selected);
  const selDone = selSession && doneDays.has(dateKey(selected));
  const selAppts = apptsOn(selected);
  const today = new Date();

  if (!requireAuth) {
    return (
      <main className="space-y-4">
        <header><p className="eyebrow">Agenda</p><h1 className="mt-1 text-2xl font-bold">Calendario</h1></header>
        <p className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs">
          Modo demo: conecta Supabase para ver tus citas y entrenos planificados.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-5">
      <header><p className="eyebrow">Agenda</p><h1 className="mt-1 text-2xl font-bold">Calendario</h1></header>

      {loading ? (
        <p className="text-sm text-muted">Cargando tu calendario…</p>
      ) : (
        <>
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <button onClick={() => shiftMonth(-1)} aria-label="Mes anterior"
                className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">‹</button>
              <p className="text-sm font-semibold capitalize">
                {month.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
              </p>
              <button onClick={() => shiftMonth(1)} aria-label="Mes siguiente"
                className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">›</button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w.value} className="text-[10px] font-semibold text-muted">{w.short}</span>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={`x${i}`} />;
                const session = sessionOn(plan, d);
                const done = session && doneDays.has(dateKey(d));
                const dayAppts = apptsOn(d);
                const isSel = sameDay(d, selected);
                const isToday = sameDay(d, today);
                return (
                  <button key={dateKey(d)} onClick={() => setSelected(d)}
                    aria-label={`${d.getDate()} de ${month.toLocaleDateString("es-ES", { month: "long" })}`}
                    aria-pressed={isSel}
                    className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs
                      ${isSel ? "bg-accent text-accent-ink font-bold"
                        : isToday ? "border border-accent text-ink" : "text-ink"}`}>
                    {d.getDate()}
                    <span className="mt-0.5 flex h-1.5 gap-0.5">
                      {session && (
                        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${done ? "bg-ok" : "bg-accent"}
                          ${isSel ? "ring-1 ring-accent-ink" : ""}`} />
                      )}
                      {dayAppts.length > 0 && (
                        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-accent-ink" : "bg-ink"}`} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> Entreno pendiente
              </span>
              <span className="flex items-center gap-1">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" /> Entreno hecho
              </span>
              <span className="flex items-center gap-1">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" /> Cita
              </span>
            </div>
          </section>

          <section className="card p-4">
            <p className="eyebrow">
              {selected.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {selSession ? (
              <Link href="/entreno" className="mt-3 flex items-center justify-between rounded-xl bg-raised p-3">
                <span className="text-sm">
                  🏋️ Semana {selSession.week} · Día {selSession.day}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${selDone ? "bg-ok/15 text-ok" : "bg-accent/15 text-accent"}`}>
                  {selDone ? "Hecho" : "Pendiente"}
                </span>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-muted">
                {plan?.weekdays?.length ? "Día de descanso 💤" : "Sin entrenos planificados."}
              </p>
            )}
            {selAppts.length > 0 && (
              <ul className="mt-3 space-y-2">
                {selAppts.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{a.title}</span>
                    <span className="shrink-0 text-xs text-muted">{formatTime(a.starts_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {uid && <Appointments clientId={uid} asCoach={false} />}
        </>
      )}
    </main>
  );
}
