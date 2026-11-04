"use client";

// Vista imprimible del historial de medidas: la entrenadora la guarda como
// PDF desde el diálogo del navegador (0 dependencias, 0 KB).
// Va en claro a propósito: los navegadores no imprimen fondos, así que el
// tema oscuro de la app saldría en blanco sobre blanco.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { SELECT, usedFields, formatDate, type Measurement } from "@/lib/measurements";

type Profile = { full_name: string };

export default function InformeProgreso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    (async () => {
      const [{ data: p }, { data: ms }] = await Promise.all([
        sb.from("profiles").select("full_name").eq("id", id).maybeSingle(),
        sb.from("measurements").select(SELECT).eq("client_id", id).order("measured_at"),
      ]);
      setProfile(p as Profile | null);
      setRows((ms as unknown as Measurement[]) || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <p className="text-sm text-muted">Preparando el informe…</p>;

  const cols = usedFields(rows);
  const weights = rows.filter((m) => m.weight_kg != null);
  const first = weights[0]?.weight_kg ?? null;
  const last = weights[weights.length - 1]?.weight_kg ?? null;
  const diff = first != null && last != null ? last - first : null;
  const notes = rows.filter((m) => m.note);

  return (
    <>
      {/* Barra de acciones: no se imprime */}
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link href={`/coach/clientes/${id}`} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
          ← Volver a la ficha
        </Link>
        <button onClick={() => window.print()}
          className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-ink">
          🖨 Imprimir / Guardar como PDF
        </button>
      </div>

      <article className="mx-auto max-w-3xl rounded-xl bg-[#ffffff] p-8 text-[#111111] print:rounded-none print:p-0">
        <header className="border-b border-[#dddddd] pb-4">
          <h1 className="text-xl font-bold">Informe de progreso</h1>
          <p className="mt-1 text-lg">{profile?.full_name || "Clienta"}</p>
          <p className="mt-1 text-xs text-[#666666]">
            {rows.length > 0
              ? `${rows.length} ${rows.length === 1 ? "medición" : "mediciones"} · del ${formatDate(rows[0].measured_at)} al ${formatDate(rows[rows.length - 1].measured_at)}`
              : "Sin mediciones registradas"}
            {" · "}Generado el {new Date().toLocaleDateString("es-ES")}
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-[#666666]">
            Esta clienta todavía no ha registrado ninguna medida.
          </p>
        ) : (
          <>
            {last != null && (
              <section className="mt-5 flex flex-wrap gap-6 text-sm">
                {first != null && (
                  <p><span className="text-[#666666]">Peso inicial:</span> <b>{first} kg</b></p>
                )}
                <p><span className="text-[#666666]">Peso actual:</span> <b>{last} kg</b></p>
                {diff != null && diff !== 0 && (
                  <p>
                    <span className="text-[#666666]">Diferencia:</span>{" "}
                    <b>{diff < 0 ? "−" : "+"}{Math.abs(diff).toFixed(1)} kg</b>
                  </p>
                )}
              </section>
            )}

            <section className="mt-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#666666]">Mediciones</h2>
              <table className="mt-2 w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#111111]">
                    <th className="py-1.5 pr-3 font-semibold">Fecha</th>
                    {cols.map((f) => (
                      <th key={f.key} className="py-1.5 pr-3 text-right font-semibold">
                        {f.label} <span className="font-normal text-[#666666]">({f.unit})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id} className="border-b border-[#eeeeee]">
                      <td className="whitespace-nowrap py-1.5 pr-3">{formatDate(m.measured_at)}</td>
                      {cols.map((f) => (
                        <td key={f.key} className="py-1.5 pr-3 text-right tabular-nums">
                          {m[f.key] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {notes.length > 0 && (
              <section className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#666666]">Notas</h2>
                <ul className="mt-2 space-y-1.5 text-xs">
                  {notes.map((m) => (
                    <li key={m.id} className="break-inside-avoid">
                      <b className="whitespace-nowrap">{formatDate(m.measured_at)}</b>
                      <span className="text-[#666666]"> · </span>
                      {m.note}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <footer className="mt-8 border-t border-[#dddddd] pt-3 text-[10px] text-[#999999]">
          NEA FITNESS
        </footer>
      </article>
    </>
  );
}
