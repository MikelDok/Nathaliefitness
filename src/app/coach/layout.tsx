import CoachGate from "@/components/CoachGate";
import CoachHeader from "@/components/CoachHeader";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <CoachGate>
      <div className="min-h-dvh">
        <CoachHeader />
        <div className="mx-auto max-w-5xl px-5 py-8">{children}</div>
      </div>
    </CoachGate>
  );
}
