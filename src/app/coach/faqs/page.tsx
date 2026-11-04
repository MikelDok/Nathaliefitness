"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Faq = { id: string; question: string; answer: string; position: number; published: boolean };

const Q_MAX = 300, A_MAX = 3000; // igual que los check de la tabla faqs (0013)

export default function FaqsCoach() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data, error } = await sb.from("faqs").select("id,question,answer,position,published")
      .order("position").order("created_at");
    if (error) setMsg("No se pudieron cargar las FAQs (¿falta la migración 0013?).");
    setFaqs((data as Faq[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setMsg(null);
    const q = question.trim(), a = answer.trim();
    if (!q || !a) { setMsg("Escribe la pregunta y la respuesta."); return; }
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const { data: u } = await sb.auth.getUser();
    const position = faqs.reduce((m, f) => Math.max(m, f.position), -1) + 1;
    const { error } = await sb.from("faqs").insert({ coach_id: u.user!.id, question: q, answer: a, position });
    setBusy(false);
    if (error) { setMsg("No se pudo crear la pregunta."); return; }
    setQuestion(""); setAnswer("");
    setMsg("Pregunta añadida ✓");
    load();
  }

  /** Mueve una FAQ arriba o abajo y renumera las posiciones que cambian. */
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= faqs.length) return;
    const sb = getSupabase();
    if (!sb) return;
    const next = [...faqs];
    [next[index], next[target]] = [next[target], next[index]];
    const changed = next.map((f, i) => ({ ...f, position: i })).filter((f, i) => faqs[i].id !== f.id || faqs[i].position !== i);
    setFaqs(next.map((f, i) => ({ ...f, position: i })));
    const results = await Promise.all(
      changed.map((f) => sb.from("faqs").update({ position: f.position }).eq("id", f.id)),
    );
    if (results.some((r) => r.error)) { setMsg("No se pudo cambiar el orden."); load(); }
  }

  function startEdit(f: Faq) {
    setEditId(f.id); setEditQ(f.question); setEditA(f.answer); setMsg(null);
  }

  async function saveEdit() {
    const q = editQ.trim(), a = editA.trim();
    if (!editId || !q || !a) { setMsg("La pregunta y la respuesta no pueden quedar vacías."); return; }
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("faqs").update({ question: q, answer: a }).eq("id", editId);
    if (error) { setMsg("No se pudieron guardar los cambios."); return; }
    setFaqs((fs) => fs.map((f) => (f.id === editId ? { ...f, question: q, answer: a } : f)));
    setEditId(null);
  }

  async function togglePublished(f: Faq) {
    const sb = getSupabase();
    if (!sb) return;
    const published = !f.published;
    setFaqs((fs) => fs.map((x) => (x.id === f.id ? { ...x, published } : x)));
    const { error } = await sb.from("faqs").update({ published }).eq("id", f.id);
    if (error) {
      setFaqs((fs) => fs.map((x) => (x.id === f.id ? { ...x, published: f.published } : x)));
      setMsg("No se pudo cambiar la visibilidad.");
    }
  }

  /** Borrar pide un segundo toque (sin diálogos del navegador). */
  async function remove(f: Faq) {
    if (confirmDel !== f.id) {
      setConfirmDel(f.id);
      setTimeout(() => setConfirmDel((cur) => (cur === f.id ? null : cur)), 4000);
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("faqs").delete().eq("id", f.id);
    setConfirmDel(null);
    if (error) { setMsg("No se pudo borrar."); return; }
    setFaqs((fs) => fs.filter((x) => x.id !== f.id));
  }

  return (
    <main className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Preguntas frecuentes</h1>
        <p className="mt-1 text-sm text-muted">
          Tus clientas ven las publicadas en Perfil → Preguntas frecuentes, en este orden.
        </p>
      </header>

      {msg && <p className="text-xs text-accent">{msg}</p>}

      <section className="card p-4">
        <p className="eyebrow">Tus preguntas ({faqs.length})</p>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Cargando…</p>
        ) : faqs.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">Aún no hay preguntas. Crea la primera abajo.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {faqs.map((f, i) => (
              <li key={f.id} className="py-3">
                {editId === f.id ? (
                  <div className="space-y-2">
                    <input value={editQ} maxLength={Q_MAX} onChange={(e) => setEditQ(e.target.value)}
                      aria-label="Pregunta"
                      className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
                    <textarea value={editA} maxLength={A_MAX} rows={4} onChange={(e) => setEditA(e.target.value)}
                      aria-label="Respuesta"
                      className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={saveEdit}
                        className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-ink">Guardar</button>
                      <button onClick={() => setEditId(null)}
                        className="rounded-full border border-line px-4 py-2 text-xs text-muted">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex shrink-0 flex-col gap-1">
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir: ${f.question}`}
                        className="h-7 w-7 rounded-full border border-line text-xs text-muted disabled:opacity-30">↑</button>
                      <button onClick={() => move(i, 1)} disabled={i === faqs.length - 1} aria-label={`Bajar: ${f.question}`}
                        className="h-7 w-7 rounded-full border border-line text-xs text-muted disabled:opacity-30">↓</button>
                    </div>
                    <div className={`min-w-0 flex-1 ${f.published ? "" : "opacity-50"}`}>
                      <p className="text-sm font-medium">
                        {f.question}
                        {!f.published && (
                          <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Oculta
                          </span>
                        )}
                      </p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted">{f.answer}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button onClick={() => togglePublished(f)} role="switch" aria-checked={f.published}
                        aria-label={`Publicada: ${f.question}`}
                        className="flex items-center gap-1.5 text-[10px] text-muted">
                        Publicada
                        <span aria-hidden
                          className={`relative h-5 w-9 rounded-full transition-colors ${f.published ? "bg-accent" : "bg-line"}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all ${f.published ? "left-[1.125rem]" : "left-0.5"}`} />
                        </span>
                      </button>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(f)}
                          className="rounded-full border border-line px-3 py-1 text-xs text-muted">Editar</button>
                        <button onClick={() => remove(f)}
                          className={`rounded-full border px-3 py-1 text-xs ${confirmDel === f.id ? "border-red-400 text-red-300" : "border-line text-muted"}`}>
                          {confirmDel === f.id ? "¿Borrar? Toca otra vez" : "Borrar"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <p className="eyebrow">Nueva pregunta</p>
        <input value={question} maxLength={Q_MAX} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pregunta (p. ej. ¿Qué hago si me pierdo un entreno?)" aria-label="Pregunta"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        <textarea value={answer} maxLength={A_MAX} rows={4} onChange={(e) => setAnswer(e.target.value)}
          placeholder="Respuesta" aria-label="Respuesta"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
        <button onClick={create} disabled={busy}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60">
          {busy ? "Guardando…" : "Añadir pregunta"}
        </button>
        <p className="text-[11px] text-muted">Las nuevas se publican al momento y van al final de la lista.</p>
      </section>
    </main>
  );
}
