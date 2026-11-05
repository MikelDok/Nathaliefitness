"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronRight, ClipboardCheck, MessageCircle, Scale } from "lucide-react";
import Ring from "@/components/Ring";
import MuscleDay from "@/components/MuscleDay";
import WaterCard from "@/components/WaterCard";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { localDay, localMonday } from "@/lib/dates";
import { demo } from "@/lib/demo-data";
import { unreadTotal } from "@/lib/chat";
import { fmtNum } from "@/lib/progress";
import { quoteOfDay } from "@/lib/quotes";
import {
  APPOINTMENT_SELECT, PLAN_SELECT, pendingTotal, sessionOn, formatWhen,
  type Appointment, type Plan,
} from "@/lib/agenda";

/** "JUEVES 5 NOV" (el eyebrow ya pone las mayúsculas). */
function todayLabel(d = new Date()): string {
  const weekday = d.toLocaleDateString("es-ES", { weekday: "long" });
  const month = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  return `${weekday} ${d.getDate()} ${month}`;
}

const firstName = (full: string) => full.trim().split(/\s+/)[0] || "";

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

type Habit = { id: string; title: string; done: boolean };

/** Datos que pinta Inicio; los rellena la demo o Supabase. */
type Today = {
  name: string;
  ringDone: number;
  ringTotal: number;
  /** Línea principal de la sesión: "Semana 2 · Día 3", "Descanso" o el título del programa. */
  session: string;
  /** Línea secundaria en muted. */
  detail: string;
  cta: string | null;
  habits: Habit[];
  checkinSent: boolean;
  unread: number;
  nextAppt: Appointment | null;
  pendingAppt: number;
  lastWeight: number | null;
  /** grupos musculares de la sesión de hoy; null si es descanso o no hay programa */
  todayGroups: (string | null)[] | null;
};

export default function Inicio() {
  const [habits, setHabits] = useState<Habit[]>(requireAuth ? [] : demo.habits.map((h) => ({ ...h })));
  const [fullName, setFullName] = useState(requireAuth ? "" : demo.client.name);
  const [programTitle, setProgramTitle] = useState<string | null>(null);
  const [logsToday, setLogsToday] = useState(0);
  const [checkinSent, setCheckinSent] = useState(false);
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [nextAppt, setNextAppt] = useState<Appointment | null>(null);
  const [pendingAppt, setPendingAppt] = useState(0);
  const [todayGroups, setTodayGroups] = useState<(string | null)[] | null>(null);
  const [loading, setLoading] = useState(requireAuth);

  useEffect(() => {
    if (!requireAuth) return;
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setLoading(false); return; }
      const today = localDay();
      const [{ data: prog }, { count: logs }, { data: ci }, { data: ms }, { data: hb }, { data: hl }, unreadMsgs,
        { data: nextAp }, pendingAp, { data: prof }] = await Promise.all([
        // mismo criterio que la pestaña Entreno: el activo y, si no hay, el más reciente
        sb.from("programs").select(PLAN_SELECT).eq("client_id", uid)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        sb.from("exercise_logs").select("id", { count: "exact", head: true })
          .eq("client_id", uid).eq("performed_at", today),
        sb.from("check_ins").select("id").eq("client_id", uid)
          .eq("week_start", localMonday()).maybeSingle(),
        sb.from("measurements").select("weight_kg").eq("client_id", uid)
          .not("weight_kg", "is", null).order("measured_at", { ascending: false }).limit(1).maybeSingle(),
        sb.from("habits").select("id,title").eq("client_id", uid).eq("active", true).order("title"),
        sb.from("habit_logs").select("habit_id").eq("logged_on", today),
        unreadTotal(sb, uid),
        sb.from("appointments").select(APPOINTMENT_SELECT).eq("client_id", uid)
          .eq("status", "confirmada").gte("starts_at", new Date().toISOString())
          .order("starts_at").limit(1).maybeSingle(),
        pendingTotal(sb, uid, false),
        sb.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
      ]);
      const doneSet = new Set((hl || []).map((x) => x.habit_id));
      setHabits(((hb || []) as { id: string; title: string }[]).map((h) => ({ ...h, done: doneSet.has(h.id) })));
      setFullName(prof?.full_name || u.user?.email?.split("@")[0] || "");
      setProgramTitle(prog?.title ?? null);
      setLogsToday(logs || 0);
      setCheckinSent(!!ci);
      setLastWeight(ms?.weight_kg ?? null);
      setUnread(unreadMsgs);
      setPlan((prog as unknown as Plan) || null);
      setNextAppt((nextAp as Appointment | null) || null);
      setPendingAppt(pendingAp);

      // "Hoy trabajas": la sesión de hoy (o, sin días asignados, la que abre
      // Entreno: semana 1, día 1), solo con los ejercicios visibles
      const p = prog as unknown as Plan | null;
      if (p) {
        const s = p.weekdays?.length ? sessionOn(p, new Date()) : { week: 1, day: 1 };
        if (s) {
          const { data: pe } = await sb.from("program_exercises")
            .select("exercises(muscle_group)")
            .eq("program_id", p.id).eq("hidden", false).eq("week", s.week).eq("day", s.day);
          type PE = { exercises: { muscle_group: string | null } | null };
          setTodayGroups(((pe as unknown as PE[]) || []).map((r) => r.exercises?.muscle_group ?? null));
        }
      }
      setLoading(false);
    })();
  }, []);

  async function toggleHabit(h: Habit) {
    setHabits((list) => list.map((x) => (x.id === h.id ? { ...x, done: !x.done } : x)));
    if (!requireAuth) return; // demo: solo en pantalla
    const sb = getSupabase();
    if (!sb) return;
    const today = localDay();
    if (h.done) {
      await sb.from("habit_logs").delete().eq("habit_id", h.id).eq("logged_on", today);
    } else {
      await sb.from("habit_logs").upsert({ habit_id: h.id, logged_on: today, done: true });
    }
  }

  const habitsDone = habits.filter((h) => h.done).length;

  // ---------- Demo ----------
  if (!requireAuth) {
    const t = demo.today;
    const [session, focus] = t.dayLabel.split(" — ");
    return (
      <TodayView
        onToggle={toggleHabit}
        data={{
          name: firstName(fullName),
          ringDone: t.exercisesDone + habitsDone,
          ringTotal: t.exercisesTotal + habits.length,
          session,
          detail: `${focus} · ${t.exercisesDone} ejercicios hoy`,
          cta: "Continuar",
          habits, checkinSent: false, unread: 0, nextAppt: null, pendingAppt: 0,
          lastWeight: demo.progress.weightNow,
          todayGroups: demo.exercises.map((e) => e.muscle),
        }}
      />
    );
  }

  // ---------- Real ----------
  if (loading) return <main><p className="text-sm text-muted">Preparando tu día…</p></main>;

  const dayTotal = habits.length + (programTitle ? 1 : 0);
  const dayDone = habitsDone + (programTitle && logsToday > 0 ? 1 : 0);
  const todaySession = sessionOn(plan, new Date());
  const scheduled = !!plan?.weekdays?.length;
  const logsText = logsToday > 0
    ? `${logsToday} ejercicio${logsToday > 1 ? "s" : ""} hoy`
    : "Aún no has registrado ejercicios hoy";

  return (
    <TodayView
      onToggle={toggleHabit}
      data={{
        name: firstName(fullName),
        ringDone: dayDone,
        ringTotal: dayTotal,
        session: !programTitle
          ? "Sin programa"
          : scheduled
            ? (todaySession ? `Semana ${todaySession.week} · Día ${todaySession.day}` : "Descanso")
            : programTitle,
        detail: !programTitle
          ? "Tu entrenadora te lo asignará pronto"
          : scheduled ? `${programTitle} · ${logsText}` : logsText,
        cta: !programTitle ? null : dayTotal > 0 && dayDone === dayTotal ? "Ver entreno" : logsToday > 0 ? "Continuar" : "Empezar",
        habits, checkinSent, unread, nextAppt, pendingAppt, lastWeight, todayGroups,
      }}
    />
  );
}

function TodayView({ data: d, onToggle }: { data: Today; onToggle: (h: Habit) => void }) {
  const complete = d.ringTotal > 0 && d.ringDone === d.ringTotal;
  const habitsDone = d.habits.filter((h) => h.done).length;
  // fecha y frase en el cliente: la página se prerenderiza en el build
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  return (
    <main className="space-y-7">
      {/* ---------- Cabecera ---------- */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow min-h-[1lh]">{now ? todayLabel(now) : ""}</p>
          <h1 className="mt-2 truncate text-[40px]">Hola{d.name ? `, ${d.name}` : ""}</h1>
          <p className="mt-2 min-h-[1lh] text-sm text-muted">{now ? quoteOfDay(now) : ""}</p>
        </div>
        <Link href="/perfil" aria-label="Tu perfil"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised font-display text-lg font-bold uppercase">
          {d.name.charAt(0) || "·"}
        </Link>
      </header>

      {/* ---------- Héroe: anillo + sesión de hoy ---------- */}
      <section className="flex items-center gap-5" aria-label="Tu día">
        <Ring value={d.ringTotal > 0 ? d.ringDone / d.ringTotal : 0} done={complete}>
          <span className="figure text-[32px]">{d.ringTotal > 0 ? d.ringDone : 0}</span>
          <span className="eyebrow mt-1 text-[10px] leading-none">
            {d.ringTotal > 0 ? `de ${d.ringTotal}` : "Sin plan"}
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className={`eyebrow ${complete ? "text-ok" : ""}`}>{complete ? "Día hecho" : "Hoy"}</p>
          <p className="mt-1 font-display text-2xl font-bold uppercase leading-none tracking-[-0.01em]">{d.session}</p>
          <p className="mt-1.5 text-xs text-muted">{d.detail}</p>
          {d.cta && (
            <Link href="/entreno" className="btn-primary mt-3">{d.cta}</Link>
          )}
        </div>
      </section>

      {/* ---------- Hoy trabajas (no sale en descanso ni sin programa) ---------- */}
      {d.todayGroups && <MuscleDay groups={d.todayGroups} />}

      {/* ---------- Hábitos: lista plana ---------- */}
      <section>
        <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
          <p className="eyebrow">Hábitos de hoy</p>
          <div className="flex items-baseline gap-3">
            {d.habits.length > 0 && (
              <span className="figure text-base text-accent">{habitsDone}/{d.habits.length}</span>
            )}
            <Link href="/habitos" className="text-xs text-muted underline">Gestionar</Link>
          </div>
        </div>
        {d.habits.length === 0 ? (
          <p className="pt-3 text-sm text-muted">
            Sin hábitos todavía. <Link href="/habitos" className="text-accent underline">Crea el primero</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {d.habits.map((h) => (
              <li key={h.id}>
                <button onClick={() => onToggle(h)} aria-pressed={h.done}
                  className="flex w-full items-center gap-3 py-3 text-left text-sm">
                  <span aria-hidden
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${h.done ? "bg-accent text-accent-ink" : "border-[1.5px] border-muted/60"}`}>
                    {h.done && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className={h.done ? "text-muted" : ""}>{h.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Agua ---------- */}
      <WaterCard />

      {/* ---------- Check-in y Mensajes ---------- */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/checkin" className="card block">
          <ClipboardCheck {...ICON} className={d.checkinSent ? "text-ok" : "text-muted"} />
          <p className="eyebrow mt-3">Check-in</p>
          <p className={`mt-1 font-display text-[22px] font-bold uppercase leading-none ${d.checkinSent ? "text-ok" : ""}`}>
            {d.checkinSent ? "Enviado" : "Pendiente"}
          </p>
          <p className="mt-1.5 text-xs text-muted">Esta semana</p>
        </Link>
        <Link href="/mensajes" className="card block">
          <MessageCircle {...ICON} className={d.unread > 0 ? "text-accent" : "text-muted"} />
          <p className="eyebrow mt-3">Mensajes</p>
          <p className={`mt-1 font-display text-[22px] font-bold uppercase leading-none ${d.unread > 0 ? "text-accent" : ""}`}>
            {d.unread > 0 ? `${d.unread} sin leer` : "Al día"}
          </p>
          <p className="mt-1.5 text-xs text-muted">{d.unread > 0 ? "De tu entrenadora" : "Escribe a tu entrenadora"}</p>
        </Link>
      </div>

      {/* ---------- Agenda y último peso: filas-tarjeta ---------- */}
      <div className="space-y-3">
        <Link href="/agenda" className="card flex items-center gap-3">
          <CalendarDays {...ICON} className="shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Agenda</p>
            <p className="mt-1 truncate text-sm">
              {d.nextAppt ? `Próxima cita: ${formatWhen(d.nextAppt.starts_at)}` : "Ver tu calendario"}
            </p>
          </div>
          {d.pendingAppt > 0 ? (
            <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 font-display text-xs font-bold text-accent-ink">
              {d.pendingAppt}
            </span>
          ) : (
            <ChevronRight {...ICON} className="shrink-0 text-muted" />
          )}
        </Link>

        {d.lastWeight != null && (
          <Link href="/progreso" className="card flex items-center gap-3">
            <Scale {...ICON} className="shrink-0 text-muted" />
            <p className="eyebrow flex-1">Último peso</p>
            <span className="figure text-xl uppercase">{fmtNum(d.lastWeight)} kg</span>
            <ChevronRight {...ICON} className="shrink-0 text-muted" />
          </Link>
        )}
      </div>
    </main>
  );
}
