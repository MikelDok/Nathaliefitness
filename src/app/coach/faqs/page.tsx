"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, HelpCircle, Pencil, Trash2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { EmptyState, ICON, PageHeader } from "@/components/ui";

const iconBtn = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted disabled:opacity-30";

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
    setMsg("Pregunta añadida.");
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
    <main className="space-y-8">
      <PageHeader eyebrow="Clientas" title="Preguntas frecuentes">
        Tus clientas ven las publicadas en Perfil, en Preguntas frecuentes, en este orden.
      </PageHeader>

      {msg && <p role="status" className="text-xs text-accent">{msg}</p>}

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <section className="min-w-0">
        <p className="eyebrow border-b border-line pb-2">Tus preguntas ({faqs.length})</p>
        {loading ? (
          <p className="py-3 text-sm text-muted">Cargando…</p>
        ) : faqs.length === 0 ? (
          <EmptyState icon={HelpCircle}>Aún no hay preguntas. Crea la primera.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {faqs.map((f, i) => (
              <li key={f.id} className="py-3">
                {editId === f.id ? (
                  <div className="space-y-2">
                    <input value={editQ} maxLength={Q_MAX} onChange={(e) => setEditQ(e.target.value)}
                      aria-label="Pregunta" className="field" />
                    <textarea value={editA} maxLength={A_MAX} rows={4} onChange={(e) => setEditA(e.target.value)}
                      aria-label="Respuesta" className="field" />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="btn-primary">Guardar</button>
                      <button onClick={() => setEditId(null)} className="chip min-h-11 bg-surface">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="flex shrink-0 flex-col">
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir: ${f.question}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-muted disabled:opacity-30">
                        <ArrowUp size={16} strokeWidth={1.75} aria-hidden />
                      </button>
                      <button onClick={() => move(i, 1)} disabled={i === faqs.length - 1} aria-label={`Bajar: ${f.question}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-muted disabled:opacity-30">
                        <ArrowDown size={16} strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                    <div className={`min-w-0 flex-1 ${f.published ? "" : "opacity-50"}`}>
                      <p className="text-sm font-medium">
                        {f.question}
                        {!f.published && (
                          <span className="chip ml-2 min-h-6 bg-surface px-2.5 text-[10px]">Oculta</span>
                        )}
                      </p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted">{f.answer}</p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button onClick={() => togglePublished(f)} aria-pressed={f.published}
                        aria-label={`${f.published ? "Ocultar" : "Publicar"}: ${f.question}`}
                        title={f.published ? "Publicada" : "Oculta"}
                        className={`${iconBtn} ${f.published ? "text-ink" : "bg-surface"}`}>
                        {f.published ? <Eye {...ICON} /> : <EyeOff {...ICON} />}
                      </button>
                      <button onClick={() => startEdit(f)} aria-label={`Editar: ${f.question}`} title="Editar" className={iconBtn}>
                        <Pencil {...ICON} />
                      </button>
                      {confirmDel === f.id ? (
                        <button onClick={() => remove(f)} className="chip min-h-9 bg-danger/15 px-3 text-danger">
                          ¿Borrar? Toca otra vez
                        </button>
                      ) : (
                        <button onClick={() => remove(f)} aria-label={`Borrar: ${f.question}`} title="Borrar"
                          className={`${iconBtn} hover:text-danger`}>
                          <Trash2 {...ICON} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3 self-start">
        <p className="eyebrow">Nueva pregunta</p>
        <input value={question} maxLength={Q_MAX} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pregunta (p. ej. ¿Qué hago si me pierdo un entreno?)" aria-label="Pregunta"
          className="field bg-raised" />
        <textarea value={answer} maxLength={A_MAX} rows={4} onChange={(e) => setAnswer(e.target.value)}
          placeholder="Respuesta" aria-label="Respuesta"
          className="field bg-raised" />
        <button onClick={create} disabled={busy} className="btn-primary w-full">
          {busy ? "Guardando…" : "Añadir pregunta"}
        </button>
        <p className="text-[11px] text-muted">Las nuevas se publican al momento y van al final de la lista.</p>
      </section>
      </div>
    </main>
  );
}
