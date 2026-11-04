"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Ring from "@/components/Ring";
import ProfileName from "@/components/ProfileName";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";
import { unreadTotal } from "@/lib/chat";
import {
  APPOINTMENT_SELECT, PLAN_SELECT, pendingTotal, sessionOn, formatWhen,
  type Appointment, type Plan,
} from "@/lib/agenda";

function mondayOf(d: Date): string {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

type Habit = { id: string; title: string; done: boolean };

export default function Inicio() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [programTitle, setProgramTitle] = useState<string | null>(null);
  const [logsToday, setLogsToday] = useState(0);
  const [checkinSent, setCheckinSent] = useState(false);
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [nextAppt, setNextAppt] = useState<Appointment | null>(null);
  const [pendingAppt, setPendingAppt] = useState(0);
  const [loading, setLoading] = useState(requireAuth);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setLoading(false); return; }
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: prog }, { count: logs }, { data: ci }, { data: ms }, { data: hb }, { data: hl }, unreadMsgs,
        { data: nextAp }, pendingAp] = await Promise.all([
        // mismo criterio que la pestaña Entreno: el activo y, si no hay, el más reciente
        sb.from("programs").select(PLAN_SELECT).eq("client_id", uid)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        sb.from("exercise_logs").select("id", { count: "exact", head: true })
          .eq("client_id", uid).eq("performed_at", today),
        sb.from("check_ins").select("id").eq("client_id", uid)
          .eq("week_start", mondayOf(new Date())).maybeSingle(),
        sb.from("measurements").select("weight_kg").eq("client_id", uid)
          .not("weight_kg", "is", null).order("measured_at", { ascending: false }).limit(1).maybeSingle(),
        sb.from("habits").select("id,title").eq("client_id", uid).eq("active", true).order("title"),
        sb.from("habit_logs").select("habit_id").eq("logged_on", today),
        unreadTotal(sb, uid),
        sb.from("appointments").select(APPOINTMENT_SELECT).eq("client_id", uid)
          .eq("status", "confirmada").gte("starts_at", new Date().toISOString())
          .order("starts_at").limit(1).maybeSingle(),
        pendingTotal(sb, uid, false),
      ]);
      const doneSet = new Set((hl || []).map((x) => x.habit_id));
      setHabits(((hb || []) as { id: string; title: string }[]).map((h) => ({ ...h, done: doneSet.has(h.id) })));
      setProgramTitle(prog?.title ?? null);
      setLogsToday(logs || 0);
      setCheckinSent(!!ci);
      setLastWeight(ms?.weight_kg ?? null);
      setUnread(unreadMsgs);
      setPlan((prog as unknown as Plan) || null);
      setNextAppt((nextAp as Appointment | null) || null);
      setPendingAppt(pendingAp);
      setLoading(false);
    })();
  }, []);

  async function toggleHabit(h: Habit) {
    const sb = getSupabase();
    if (!sb) return;
    const today = new Date().toISOString().slice(0, 10);
    setHabits((list) => list.map((x) => (x.id === h.id ? { ...x, done: !x.done } : x)));
    if (h.done) {
      await sb.from("habit_logs").delete().eq("habit_id", h.id).eq("logged_on", today);
    } else {
      await sb.from("habit_logs").upsert({ habit_id: h.id, logged_on: today, done: true });
    }
  }

  // ---------- Demo ----------
  if (!requireAuth) {
    const t = demo.today;
    const total = t.exercisesTotal + t.habitsTotal;
    const done = t.exercisesDone + t.habitsDone;
    return (
      <main className="space-y-5">
        <header>
          <p className="eyebrow">{demo.client.coach}</p>
          <h1 className="mt-1 text-2xl font-bold">Hola, {demo.client.name}</h1>
        </header>
        <section className="card flex items-center gap-5 p-5">
          <Ring value={done / total}>
            <span className="figure text-3xl">{done}<span className="text-muted">/{total}</span></span>
            <span className="text-[11px] text-muted">hoy</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Tu día</p>
            <p className="mt-1 text-sm leading-snug">{t.dayLabel}</p>
            <Link href="/entreno" className="mt-3 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
              Continuar entreno
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // ---------- Real ----------
  if (loading) return <main><p className="text-sm text-muted">Preparando tu día…</p></main>;

  const habitsDone = habits.filter((h) => h.done).length;
  const dayTotal = habits.length + (programTitle ? 1 : 0);
  const dayDone = habitsDone + (programTitle && logsToday > 0 ? 1 : 0);
  const ringValue = dayTotal > 0 ? dayDone / dayTotal : 0;
  const todaySession = sessionOn(plan, new Date());

  return (
    <main className="space-y-5">
      <header>
        <p className="eyebrow">NEA FITNESS</p>
        <h1 className="mt-1 text-2xl font-bold">Hola, <ProfileName /></h1>
      </header>

      <section className="card flex items-center gap-5 p-5">
        <Ring value={ringValue}>
          {dayTotal > 0 ? (
            <>
              <span className="figure text-3xl">{dayDone}<span className="text-muted">/{dayTotal}</span></span>
              <span className="text-[11px] text-muted">hoy</span>
            </>
          ) : (
            <>
              <span className="figure text-3xl">0</span>
              <span className="px-2 text-center text-[11px] leading-tight text-muted">Sin plan asignado</span>
            </>
          )}
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Tu día</p>
          <p className="mt-1 text-sm leading-snug">
            {programTitle ?? "Sin programa asignado todavía"}
          </p>
          {!!plan?.weekdays?.length && (
            <p className="mt-0.5 text-xs text-accent">
              {todaySession
                ? `Hoy toca: Semana ${todaySession.week} · Día ${todaySession.day}`
                : "Hoy descanso 💤"}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted">
            {logsToday > 0 ? `${logsToday} ejercicio${logsToday > 1 ? "s" : ""} registrado${logsToday > 1 ? "s" : ""} hoy 💪` : "Aún no has registrado ejercicios hoy"}
          </p>
          <Link href="/entreno" className="mt-3 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            {logsToday > 0 ? "Continuar entreno" : "Empezar entreno"}
          </Link>
        </div>
      </section>

      <Link href="/agenda" className="card flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="eyebrow">Agenda</p>
          <p className="mt-1 truncate text-sm">
            {nextAppt ? `Próxima cita: ${formatWhen(nextAppt.starts_at)}` : "Ver tu calendario"}
          </p>
        </div>
        {pendingAppt > 0 ? (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">
            {pendingAppt}
          </span>
        ) : (
          <span aria-hidden className="shrink-0 text-muted">›</span>
        )}
      </Link>

      <Link href="/mensajes" className="card flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="eyebrow">Mensajes</p>
          <p className="mt-1 text-sm">
            {unread > 0
              ? `Tienes ${unread} mensaje${unread > 1 ? "s" : ""} sin leer`
              : "Escribe a tu entrenadora"}
          </p>
        </div>
        {unread > 0 ? (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">
            {unread}
          </span>
        ) : (
          <span aria-hidden className="shrink-0 text-muted">›</span>
        )}
      </Link>

      <section className="card p-4">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Hábitos de hoy</p>
          <Link href="/habitos" className="text-xs text-muted underline">Gestionar</Link>
        </div>
        {habits.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Sin hábitos todavía. <Link href="/habitos" className="text-accent underline">Crea el primero</Link>.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {habits.map((h) => (
              <li key={h.id}>
                <button onClick={() => toggleHabit(h)} aria-pressed={h.done}
                  className="flex w-full items-center gap-3 text-left text-sm">
                  <span aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${h.done ? "border-ok bg-ok/15 text-ok" : "border-line text-transparent"}`}>
                    ✓
                  </span>
                  <span className={h.done ? "text-muted line-through" : ""}>{h.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/checkin" className="card block p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Check-in semanal</p>
            <p className="mt-1 text-sm">
              {checkinSent ? "Enviado esta semana ✓" : "Pendiente esta semana"}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${checkinSent ? "bg-ok/15 text-ok" : "border border-line"}`}>
            {checkinSent ? "Hecho" : "Completar"}
          </span>
        </div>
      </Link>

      {lastWeight != null && (
        <Link href="/progreso" className="card block p-4">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Último peso</p>
            <span className="figure text-sm">{lastWeight} kg</span>
          </div>
        </Link>
      )}
    </main>
  );
}
