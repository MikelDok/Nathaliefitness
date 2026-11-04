import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeSync from "@/components/ThemeSync";
import { THEME_COLOR, THEME_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "NEA FITNESS",
  description: "Entrena · Avanza · Disfruta. Entrenamiento, nutrición y progreso con Nathalie.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NEA" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // oscuro por defecto; el script de tema lo cambia si el activo es el claro
  themeColor: THEME_COLOR.dark,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme lo corrige el script antes del primer pintado: el DOM manda
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
