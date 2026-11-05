"use client";

import { useEffect, useState } from "react";
import { ListVideo, Trash2, Video } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { EmptyState, ICON, PageHeader } from "@/components/ui";

type Exercise = { id: string; name: string; muscle_group: string; video_url: string | null };

const muscles = ["Cuádriceps","Isquiotibial","Glúteos","Espalda","Pecho","Hombros","Bíceps","Tríceps","Core","Cardio","Movilidad"];

export default function Ejercicios() {
  const [list, setList] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState(muscles[0]);
  const [video, setVideo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data } = await sb
      .from("exercises")
      .select("id, name, muscle_group, video_url")
      .order("name");
    setList(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setMsg(null);
    if (!name.trim()) { setMsg("Ponle un nombre al ejercicio."); return; }
    const sb = getSupabase();
    if (!sb) return;
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("exercises").insert({
      coach_id: u.user!.id,
      name: name.trim(),
      muscle_group: muscle,
      video_url: video.trim() || null,
    });
    if (error) { setMsg("No se pudo guardar. Inténtalo de nuevo."); return; }
    setName(""); setVideo("");
    load();
  }

  async function remove(id: string) {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("exercises").delete().eq("id", id);
    if (error) setMsg("No se pudo borrar: seguramente está usado en un programa.");
    else load();
  }

  return (
    <main className="space-y-8">
      <PageHeader eyebrow="Entrenamiento" title="Biblioteca de ejercicios" />

      <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
      <section className="card space-y-3 self-start">
        <p className="eyebrow">Añadir ejercicio</p>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (p. ej. Prensa)" aria-label="Nombre del ejercicio"
          className="field bg-raised"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={muscle} onChange={(e) => setMuscle(e.target.value)}
            aria-label="Grupo muscular"
            className="field w-auto bg-raised"
          >
            {muscles.map((m) => <option key={m}>{m}</option>)}
          </select>
          <input
            value={video} onChange={(e) => setVideo(e.target.value)}
            placeholder="URL de vídeo (YouTube no listado, opcional)" aria-label="URL del vídeo"
            className="field min-w-0 flex-1 basis-48 bg-raised"
          />
        </div>
        {msg && <p className="text-xs text-danger">{msg}</p>}
        <button onClick={add} className="btn-primary w-full">
          Añadir a la biblioteca
        </button>
      </section>

      <section>
        <p className="eyebrow border-b border-line pb-2">Ejercicios ({list.length})</p>
        {loading ? (
          <p className="py-3 text-sm text-muted">Cargando…</p>
        ) : list.length === 0 ? (
          <EmptyState icon={ListVideo}>
            Aún no hay ejercicios. Añade el primero, o ejecuta la
            migración 0004 para cargar una biblioteca inicial.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    {e.muscle_group} ·
                    {e.video_url
                      ? <><Video size={14} strokeWidth={1.75} aria-hidden /> vídeo</>
                      : " sin vídeo"}
                  </p>
                </div>
                <button
                  onClick={() => remove(e.id)} aria-label={`Borrar ${e.name}`} title="Borrar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-danger"
                >
                  <Trash2 {...ICON} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </main>
  );
}
