"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { demo } from "@/lib/demo-data";
import {
  FIELDS, MAIN_FIELDS, EXTRA_FIELDS, SELECT, formatDate,
  type Measurement,
} from "@/lib/measurements";

type Photo = { id: string; taken_at: string; angle: string; storage_path: string; shared_with_coach: boolean; url?: string };
type PR = { name: string; kg: number };

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 280},${52 - ((v - min) / (max - min || 1)) * 44}`)
    .join(" ");
  return (
    <svg viewBox="0 0 280 56" className="mt-3 w-full" role="img" aria-label="Evolución del peso">
      <polyline points={pts} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const angles = [
  { value: "front", label: "Frente" },
  { value: "side", label: "Lado" },
  { value: "back", label: "Espalda" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function Progreso() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [prs, setPrs] = useState<PR[]>([]);
  // el formulario guarda texto por medida; se precarga con la medición de hoy
  const [form, setForm] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState("front");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(requireAuth);

  const setField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function load() {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data: u } = await sb.auth.getUser();
    const uid = u.user?.id;
    if (!uid) { setLoading(false); return; }

    const [{ data: ms }, { data: ph }, { data: logs }] = await Promise.all([
      sb.from("measurements").select(SELECT)
        .eq("client_id", uid).order("measured_at"),
      sb.from("progress_photos").select("id,taken_at,angle,storage_path,shared_with_coach")
        .eq("client_id", uid).order("taken_at", { ascending: false }).limit(6),
      sb.from("exercise_logs")
        .select("sets, program_exercises(exercises(name))")
        .eq("client_id", uid),
    ]);

    const rows = (ms as unknown as Measurement[]) || [];
    setMeasurements(rows);

    // Precarga: si ya hay medición de hoy, el formulario muestra lo guardado.
    // Así dejar un campo vacío significa borrarlo, y no se pierde lo anterior
    // al volver a guardar para añadir una medida suelta.
    const mine = rows.find((m) => m.measured_at === today());
    const filled: Record<string, string> = {};
    if (mine) FIELDS.forEach((f) => { if (mine[f.key] != null) filled[f.key] = String(mine[f.key]); });
    setForm(filled);
    setNote(mine?.note ?? "");

    // URLs firmadas para el bucket privado
    const list = (ph as Photo[]) || [];
    if (list.length) {
      const { data: signed } = await sb.storage
        .from("progress-photos")
        .createSignedUrls(list.map((p) => p.storage_path), 3600);
      list.forEach((p, i) => { p.url = signed?.[i]?.signedUrl ?? undefined; });
    }
    setPhotos(list);

    // PRs: máximo kg por ejercicio
    const best = new Map<string, number>();
    type LogRow = { sets: { kg: number }[] | null; program_exercises: { exercises: { name: string } | null } | null };
    ((logs as unknown as LogRow[]) || []).forEach((l) => {
      const name = l.program_exercises?.exercises?.name;
      if (!name) return;
      const maxKg = (l.sets || []).reduce((m, s) => Math.max(m, s.kg || 0), 0);
      if (maxKg > (best.get(name) || 0)) best.set(name, maxKg);
    });
    setPrs([...best.entries()].map(([name, kg]) => ({ name, kg }))
      .sort((a, b) => b.kg - a.kg).slice(0, 3));
    setLoading(false);
  }

  useEffect(() => { if (requireAuth) load(); /* eslint-disable-next-line */ }, []);

  async function saveMeasurement() {
    setMsg(null);
    const num = (k: string) => {
      const raw = (form[k] || "").replace(",", ".").trim();
      if (!raw) return null;
      const n = parseFloat(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    // las de legado no se tocan desde aquí: si tuvieran dato, se conserva
    const values = Object.fromEntries(
      FIELDS.filter((f) => !f.legacy).map((f) => [f.key, num(f.key)])
    );
    const anyValue = Object.values(values).some((v) => v != null);
    if (!anyValue && !note.trim()) { setMsg("Escribe al menos una medida o una nota."); return; }
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("measurements").upsert({
      client_id: u.user!.id,
      measured_at: today(),
      ...values,
      note: note.trim() || null,
    }, { onConflict: "client_id,measured_at" });
    setBusy(false);
    if (error) { setMsg("No se pudo guardar la medición."); return; }
    setMsg("Medición de hoy guardada ✓");
    load();
  }

  async function uploadPhoto() {
    setPhotoMsg(null);
    if (!file) { setPhotoMsg("Elige primero una foto."); return; }
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const { data: u } = await sb.auth.getUser();
    const uid = u.user!.id;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${uid}/${Date.now()}-${angle}.${ext}`;
    const { error: upErr } = await sb.storage.from("progress-photos").upload(path, file);
    if (upErr) { setBusy(false); setPhotoMsg("No se pudo subir la foto."); return; }
    const { error: rowErr } = await sb.from("progress_photos").insert({
      client_id: uid,
      taken_at: today(),
      angle,
      storage_path: path,
      shared_with_coach: share,
    });
    setBusy(false);
    if (rowErr) { setPhotoMsg("Foto subida, pero no se pudo registrar. Reintenta."); return; }
    setFile(null); setShare(false);
    load();
  }

  // ---------- Demo ----------
  if (!requireAuth) {
    const p = demo.progress;
    const lost = (p.weightStart - p.weightNow).toFixed(1);
    return (
      <main className="space-y-5">
        <header><p className="eyebrow">Mi recorrido</p><h1 className="mt-1 text-2xl font-bold">Progreso</h1></header>
        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Peso</p>
            <span className="rounded-full bg-ok/15 px-2.5 py-1 text-xs font-semibold text-ok">−{lost} kg</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="figure text-4xl">{p.weightNow}</span>
            <span className="text-sm text-muted">kg · desde {p.weightStart} kg</span>
          </div>
          <Sparkline data={p.weightSeries} />
        </section>
        <section className="card p-5">
          <p className="eyebrow">Marcas personales</p>
          <ul className="mt-3 space-y-2">
            {p.prs.map((pr) => (
              <li key={pr.name} className="flex items-center justify-between text-sm">
                <span>🏆 {pr.name}</span><span className="figure">{pr.kg} kg</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  // ---------- Real ----------
  if (loading) return <main><p className="text-sm text-muted">Cargando tu progreso…</p></main>;

  const weights = measurements.filter((m) => m.weight_kg != null);
  const first = weights[0]?.weight_kg ?? null;
  const last = weights[weights.length - 1]?.weight_kg ?? null;
  const diff = first != null && last != null ? (last - first) : null;
  const extrasFilled = EXTRA_FIELDS.filter((f) => (form[f.key] || "").trim()).length;
  const history = [...measurements].reverse().slice(0, 10);

  return (
    <main className="space-y-5">
      <header><p className="eyebrow">Mi recorrido</p><h1 className="mt-1 text-2xl font-bold">Progreso</h1></header>

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Peso</p>
          {diff != null && diff !== 0 && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${diff < 0 ? "bg-ok/15 text-ok" : "bg-accent/15 text-accent"}`}>
              {diff < 0 ? "−" : "+"}{Math.abs(diff).toFixed(1)} kg
            </span>
          )}
        </div>
        {last != null ? (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="figure text-4xl">{last}</span>
              <span className="text-sm text-muted">kg{first != null && first !== last ? ` · desde ${first} kg` : ""}</span>
            </div>
            <Sparkline data={weights.map((m) => m.weight_kg!) } />
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Registra tu primer peso abajo para empezar la gráfica.</p>
        )}

        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            {MAIN_FIELDS.map((f) => (
              <input key={f.key} value={form[f.key] || ""} onChange={(e) => setField(f.key, e.target.value)}
                type="text" inputMode="decimal" placeholder={`${f.label} (${f.unit})`}
                aria-label={`${f.label} en ${f.unit === "kg" ? "kilogramos" : "centímetros"}`}
                className="figure min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 text-center text-sm" />
            ))}
          </div>

          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional): en ayunas, semana de regla…"
            aria-label="Nota de la medición"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />

          <details className="rounded-lg border border-line">
            <summary className="cursor-pointer px-3 py-2.5 text-sm text-muted">
              Más medidas (opcional)
              {extrasFilled > 0 && ` · ${extrasFilled} rellena${extrasFilled > 1 ? "s" : ""}`}
            </summary>
            <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
              {EXTRA_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="text-[11px] text-muted">{f.label}</span>
                  <input value={form[f.key] || ""} onChange={(e) => setField(f.key, e.target.value)}
                    type="text" inputMode="decimal" placeholder={f.unit}
                    aria-label={`${f.label} en centímetros`}
                    className="figure mt-1 w-full rounded-lg border border-line bg-bg px-2 py-2 text-center text-sm" />
                </label>
              ))}
            </div>
          </details>

          <button onClick={saveMeasurement} disabled={busy}
            className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60">
            {busy ? "Guardando…" : "Guardar medición"}
          </button>
          {msg && <p className="text-xs text-muted">{msg}</p>}
          <p className="text-[11px] text-muted">
            Una medición por día; si guardas otra vez hoy, se actualiza con lo que veas aquí.
          </p>
        </div>
      </section>

      <section className="card p-5">
        <p className="eyebrow">Historial</p>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aquí aparecerá cada medición que guardes.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {history.map((m) => {
              const vals = FIELDS.filter((f) => m[f.key] != null);
              return (
                <li key={m.id} className="py-2.5">
                  <p className="text-sm font-medium">{formatDate(m.measured_at)}</p>
                  {vals.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted">
                      {vals.map((f) => `${f.label} ${m[f.key]} ${f.unit}`).join(" · ")}
                    </p>
                  )}
                  {m.note && <p className="mt-1 text-xs">📝 {m.note}</p>}
                </li>
              );
            })}
          </ul>
        )}
        {measurements.length > history.length && (
          <p className="mt-3 text-[11px] text-muted">
            Mostrando las {history.length} últimas de {measurements.length}.
          </p>
        )}
      </section>

      <section className="card p-5">
        <p className="eyebrow">Fotos de evolución</p>
        {photos.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sube tu primera foto: será tu punto de partida.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <figure key={p.id} className="overflow-hidden rounded-xl border border-line">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={`Foto ${p.angle} del ${p.taken_at}`} className="aspect-[3/4] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center bg-raised text-xs text-muted">…</div>
                )}
                <figcaption className="px-1.5 py-1 text-center text-[10px] text-muted">
                  {formatDate(p.taken_at)}{p.shared_with_coach ? " · 👁" : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)}
              aria-label="Elegir foto"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-xs text-muted file:mr-2 file:rounded-full file:border-0 file:bg-raised file:px-3 file:py-1.5 file:text-xs file:text-ink" />
            <select value={angle} onChange={(e) => setAngle(e.target.value)} aria-label="Ángulo"
              className="rounded-lg border border-line bg-bg px-2 py-2 text-xs">
              {angles.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)}
              className="mt-0.5 accent-[var(--color-accent)]" />
            Compartir esta foto con mi entrenadora para que vea mi progreso.
          </label>
          {photoMsg && <p className="text-xs text-red-300">{photoMsg}</p>}
          <button onClick={uploadPhoto} disabled={busy}
            className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60">
            {busy ? "Subiendo…" : "Subir foto"}
          </button>
          <p className="text-[11px] text-muted">
            Tus fotos son privadas: tu entrenadora solo ve las que marques compartir.
          </p>
        </div>
      </section>

      {prs.length > 0 && (
        <section className="card p-5">
          <p className="eyebrow">Marcas personales</p>
          <ul className="mt-3 space-y-2">
            {prs.map((pr) => (
              <li key={pr.name} className="flex items-center justify-between text-sm">
                <span>🏆 {pr.name}</span><span className="figure">{pr.kg} kg</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
