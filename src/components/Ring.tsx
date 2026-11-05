/** Anillo de "hoy": progreso 0..1, elemento firma de la app. Trazo 12 px, sin halo; en ok al completarse. */
export default function Ring({
  value,
  size = 108,
  stroke = 12,
  done = false,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  /** Día completado: el progreso pasa a color ok. */
  done?: boolean;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Progreso del día: ${Math.round(clamped * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-raised)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={done ? "var(--color-ok)" : "var(--color-accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
