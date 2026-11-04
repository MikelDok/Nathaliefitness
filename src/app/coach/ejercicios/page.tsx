"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

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
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Biblioteca de ejercicios</h1>

      <section className="card space-y-3 p-4">
        <p className="eyebrow">Añadir ejercicio</p>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (p. ej. Prensa)"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={muscle} onChange={(e) => setMuscle(e.target.value)}
            aria-label="Grupo muscular"
            className="rounded-lg border border-line bg-bg px-3 py-2.5 text-sm"
          >
            {muscles.map((m) => <option key={m}>{m}</option>)}
          </select>
          <input
            value={video} onChange={(e) => setVideo(e.target.value)}
            placeholder="URL de vídeo (YouTube no listado, opcional)"
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 text-sm"
          />
        </div>
        {msg && <p className="text-xs text-danger">{msg}</p>}
        <button onClick={add} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
          Añadir a la biblioteca
        </button>
      </section>

      <section className="card p-4">
        <p className="eyebrow">Ejercicios ({list.length})</p>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
            Aún no hay ejercicios. Añade el primero arriba, o ejecuta la
            migración 0004 para cargar una biblioteca inicial.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {list.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{e.name}</p>
                  <p className="text-xs text-muted">
                    {e.muscle_group} {e.video_url ? "· 🎬 vídeo" : "· sin vídeo"}
                  </p>
                </div>
                <button
                  onClick={() => remove(e.id)}
                  className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-muted"
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
