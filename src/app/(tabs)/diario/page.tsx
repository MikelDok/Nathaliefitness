"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/config";
import { localDay } from "@/lib/dates";
import BarcodeScanner from "@/components/BarcodeScanner";

type Entry = {
  id: string; name: string; grams: number | null;
  kcal: number; protein_g: number; fat_g: number; carbs_g: number; barcode: string | null;
};
type Product = {
  name: string; per100: { kcal: number; protein: number; fat: number; carbs: number };
  barcode: string;
};
type Target = { kcal_target: number | null; protein_g: number | null; fat_g: number | null; carbs_g: number | null };

export default function Diario() {
  const today = localDay();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [grams, setGrams] = useState("100");
  const [manual, setManual] = useState(false);
  const [mName, setMName] = useState(""); const [mKcal, setMKcal] = useState("");
  const [mProt, setMProt] = useState(""); const [mFat, setMFat] = useState(""); const [mCarbs, setMCarbs] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const sb = getSupabase();
    if (!sb) return;
    const { data: u } = await sb.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const [{ data: fd }, { data: mp }] = await Promise.all([
      sb.from("food_diary").select("id,name,grams,kcal,protein_g,fat_g,carbs_g,barcode")
        .eq("client_id", uid).eq("eaten_on", today).order("created_at"),
      sb.from("meal_plans").select("kcal_target,protein_g,fat_g,carbs_g")
        .eq("client_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setEntries((fd as Entry[]) || []);
    setTarget(mp as Target | null);
  }
  useEffect(() => { if (requireAuth) load(); /* eslint-disable-next-line */ }, []);

  async function lookup(barcode: string) {
    setMsg(null); setProduct(null); setBusy(true);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,nutriments`
      );
      const json = await res.json();
      const p = json?.product;
      const n = p?.nutriments;
      if (!p || !n) {
        setMsg("Producto no encontrado en la base de datos. Puedes añadirlo a mano abajo.");
        setManual(true);
        setBusy(false);
        return;
      }
      setProduct({
        name: p.product_name || "Producto",
        barcode,
        per100: {
          kcal: Math.round(n["energy-kcal_100g"] || 0),
          protein: +(n["proteins_100g"] || 0),
          fat: +(n["fat_100g"] || 0),
          carbs: +(n["carbohydrates_100g"] || 0),
        },
      });
    } catch {
      setMsg("No se pudo consultar el producto. Comprueba tu conexión.");
    }
    setBusy(false);
  }

  function scaled(p: Product, g: number) {
    const f = g / 100;
    return {
      kcal: Math.round(p.per100.kcal * f),
      protein_g: +(p.per100.protein * f).toFixed(1),
      fat_g: +(p.per100.fat * f).toFixed(1),
      carbs_g: +(p.per100.carbs * f).toFixed(1),
    };
  }

  async function addProduct() {
    if (!product) return;
    const g = parseFloat(grams.replace(",", ".")) || 100;
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("food_diary").insert({
      client_id: u.user!.id, eaten_on: today,
      name: product.name, grams: g, barcode: product.barcode, ...scaled(product, g),
    });
    setBusy(false);
    if (error) { setMsg("No se pudo guardar."); return; }
    setProduct(null); setCode(""); setGrams("100");
    load();
  }

  async function addManual() {
    setMsg(null);
    if (!mName.trim()) { setMsg("Ponle nombre al alimento."); return; }
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("food_diary").insert({
      client_id: u.user!.id, eaten_on: today, name: mName.trim(),
      kcal: +mKcal || 0, protein_g: +mProt || 0, fat_g: +mFat || 0, carbs_g: +mCarbs || 0,
    });
    setBusy(false);
    if (error) { setMsg("No se pudo guardar."); return; }
    setMName(""); setMKcal(""); setMProt(""); setMFat(""); setMCarbs(""); setManual(false);
    load();
  }

  async function remove(id: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("food_diary").delete().eq("id", id);
    load();
  }

  const tot = (k: "kcal" | "protein_g" | "fat_g" | "carbs_g") =>
    Math.round(entries.reduce((s, e) => s + (Number(e[k]) || 0), 0) * 10) / 10;

  if (!requireAuth) {
    return (
      <main className="space-y-5">
        <header><p className="eyebrow">Diario</p><h1 className="mt-1 text-2xl font-bold">Diario de comida</h1></header>
        <p className="card p-4 text-sm text-muted">El diario funciona con cuenta real (conecta Supabase).</p>
      </main>
    );
  }

  return (
    <main className="space-y-5">
      {scanning && (
        <BarcodeScanner
          onResult={(c) => { setScanning(false); setCode(c); lookup(c); }}
          onClose={() => setScanning(false)}
        />
      )}

      <header className="flex items-center gap-3">
        <Link href="/nutricion" aria-label="Volver" className="rounded-full border border-line p-2 text-muted">←</Link>
        <div>
          <p className="eyebrow">Hoy · {new Date().toLocaleDateString("es-ES")}</p>
          <h1 className="text-2xl font-bold">Diario de comida</h1>
        </div>
      </header>

      <section className="card grid grid-cols-4 divide-x divide-line p-4 text-center">
        {([["Proteínas", "protein_g", "g"], ["Grasas", "fat_g", "g"], ["Carbs", "carbs_g", "g"], ["Calorías", "kcal", ""]] as const).map(([label, key, unit]) => {
          const t = target?.[key === "kcal" ? "kcal_target" : key] ?? null;
          return (
            <div key={key}>
              <p className="figure text-lg">{tot(key)}{unit}</p>
              <p className="mt-0.5 text-[11px] text-muted">{label}{t ? ` / ${t}` : ""}</p>
            </div>
          );
        })}
      </section>

      <section className="card space-y-3 p-4">
        <p className="eyebrow">Añadir alimento</p>
        <button onClick={() => setScanning(true)}
          className="w-full rounded-full bg-accent py-3 font-semibold text-accent-ink">
          📷 Escanear código de barras
        </button>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)}
            type="text" inputMode="numeric" placeholder="…o escribe el código (p. ej. 8480000123456)"
            aria-label="Código de barras"
            className="figure min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
          <button onClick={() => code.trim() && lookup(code.trim())} disabled={busy}
            className="shrink-0 rounded-full border border-line px-4 py-2.5 text-sm disabled:opacity-60">
            Buscar
          </button>
        </div>

        {busy && <p className="text-xs text-muted">Consultando…</p>}
        {msg && <p className="text-xs text-accent">{msg}</p>}

        {product && (
          <div className="rounded-xl bg-raised p-3">
            <p className="text-sm font-semibold">{product.name}</p>
            <p className="text-xs text-muted">
              Por 100 g: {product.per100.kcal} kcal · P {product.per100.protein} · G {product.per100.fat} · C {product.per100.carbs}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input value={grams} onChange={(e) => setGrams(e.target.value)}
                type="text" inputMode="decimal" aria-label="Gramos"
                className="figure w-24 rounded-lg border border-line bg-bg px-3 py-2 text-center text-sm" />
              <span className="text-xs text-muted">gramos</span>
              <span className="ml-auto figure text-sm">
                = {scaled(product, parseFloat(grams.replace(",", ".")) || 100).kcal} kcal
              </span>
            </div>
            <button onClick={addProduct} disabled={busy}
              className="mt-2 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60">
              Añadir al diario
            </button>
          </div>
        )}

        <button onClick={() => setManual(!manual)} className="w-full py-1 text-xs text-muted underline">
          {manual ? "Ocultar entrada manual" : "Añadir a mano (sin código)"}
        </button>
        {manual && (
          <div className="space-y-2">
            <input value={mName} onChange={(e) => setMName(e.target.value)}
              placeholder="Nombre (p. ej. Lentejas cocidas, 1 plato)"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm" />
            <div className="grid grid-cols-4 gap-2">
              {[["kcal", mKcal, setMKcal], ["Prot", mProt, setMProt], ["Grasa", mFat, setMFat], ["Carbs", mCarbs, setMCarbs]].map(([ph, v, set]) => (
                <input key={ph as string} value={v as string}
                  onChange={(e) => (set as (s: string) => void)(e.target.value)}
                  type="number" inputMode="numeric" placeholder={ph as string} aria-label={ph as string}
                  className="figure rounded-lg border border-line bg-bg px-2 py-2.5 text-center text-sm" />
              ))}
            </div>
            <button onClick={addManual} disabled={busy}
              className="w-full rounded-full border border-line py-2.5 text-sm disabled:opacity-60">
              Guardar en el diario
            </button>
          </div>
        )}
      </section>

      <section className="card p-4">
        <p className="eyebrow">Lo que has comido hoy ({entries.length})</p>
        {entries.length === 0 ? (
          <p className="mt-3 rounded-xl bg-raised p-4 text-sm text-muted">
            Todavía nada. Escanea un producto o añádelo a mano.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{e.name}{e.grams ? ` · ${e.grams} g` : ""}</p>
                  <p className="text-xs text-muted">{e.kcal} kcal · P {e.protein_g} · G {e.fat_g} · C {e.carbs_g}</p>
                </div>
                <button onClick={() => remove(e.id)}
                  className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-muted">Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-muted">
        Datos de productos: Open Food Facts (base de datos abierta). Pueden contener errores; revisa la etiqueta si algo no cuadra.
      </p>
    </main>
  );
}
