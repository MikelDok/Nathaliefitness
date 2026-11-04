"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "Quién es responsable",
    body: (
      <>
        <p>Nathalie, entrenadora personal, es la responsable de tus datos.</p>
        <p className="text-muted">[NOMBRE COMPLETO / CONTACTO]</p>
      </>
    ),
  },
  {
    title: "Qué datos guardamos",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Tu cuenta:</strong> el correo con el que entras.</li>
        <li><strong>Entrenamiento:</strong> tus programas y lo que registras en cada sesión.</li>
        <li><strong>Medidas y peso.</strong></li>
        <li>
          <strong>Fotos de progreso:</strong> solo las que subes tú. Tu entrenadora
          solo ve las que marcas para compartir.
        </li>
        <li><strong>Nutrición:</strong> tu plan de comidas y tu diario de comida.</li>
        <li><strong>Hábitos y check-ins semanales.</strong></li>
        <li><strong>Mensajes del chat</strong> y las fotos o vídeos que adjuntes.</li>
        <li><strong>Citas</strong> que tengas con tu entrenadora.</li>
      </ul>
    ),
  },
  {
    title: "Para qué los usamos",
    body: (
      <p>
        Solo para hacer el seguimiento de tu entrenamiento y tu nutrición con tu
        entrenadora. Nada más.
      </p>
    ),
  },
  {
    title: "Dónde se guardan",
    body: (
      <p>
        Los datos y los archivos se guardan en Supabase, en servidores de la Unión
        Europea (Irlanda). La app se sirve a través de Vercel.
      </p>
    ),
  },
  {
    title: "Quién puede verlos",
    body: (
      <p>
        Solo tú y tu entrenadora. Las fotos de progreso, únicamente si tú las
        compartes. Supabase y Vercel alojan la app, pero no pueden usar tus datos
        para nada más. No vendemos ni cedemos tus datos a nadie.
      </p>
    ),
  },
  {
    title: "Cuánto tiempo los guardamos",
    body: (
      <p>
        Mientras tengas tu cuenta. Cuando pidas la baja, borraremos tus datos y tus
        archivos.
      </p>
    ),
  },
  {
    title: "Tus derechos",
    body: (
      <>
        <p>
          Puedes pedir ver tus datos, corregirlos o borrarlos escribiendo a [CONTACTO].
        </p>
        <p>Puedes dejar de compartir tus fotos de progreso cuando quieras.</p>
      </>
    ),
  },
];

export default function Privacidad() {
  const router = useRouter();

  // Vuelve a donde estaba (Perfil o login); si se abrió directamente, al login.
  function back() {
    if (window.history.length > 1) router.back();
    else router.replace("/login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <div className="flex justify-center">
        <Image src="/logo.png" alt="NEA FITNESS" width={230} height={230}
          priority className="logo-mark h-auto w-32" />
      </div>
      <p className="eyebrow mt-6 text-center">Privacidad</p>
      <h1 className="mt-1 text-center text-2xl font-bold">Tus datos en la app</h1>
      <p className="mt-3 rounded-xl bg-raised p-3 text-xs text-muted">
        Versión piloto. Este texto es provisional y lo completaremos antes del
        lanzamiento definitivo.
      </p>

      <div className="mt-6 space-y-6">
        {sections.map((s) => (
          <section key={s.title} className="space-y-2 text-sm leading-relaxed">
            <h2 className="text-base font-semibold">{s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>

      <button onClick={back} className="mt-8 w-full py-2 text-center text-xs text-muted">
        Volver
      </button>
    </main>
  );
}
