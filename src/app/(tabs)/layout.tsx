import BottomNav from "@/components/BottomNav";
import AuthGate from "@/components/AuthGate";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-24 pt-6">
        {children}
        <BottomNav />
      </div>
    </AuthGate>
  );
}
