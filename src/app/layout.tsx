import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "./globals.css";
import ThemeSync from "@/components/ThemeSync";
import { THEME_COLOR, THEME_SCRIPT } from "@/lib/theme";

// Se autoalojan en el build: el navegador no pide nada a Google.
const display = Barlow_Condensed({
  subsets: ["latin"], weight: ["600", "700"], variable: "--font-barlow", display: "swap",
});
const sans = Manrope({
  subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-manrope", display: "swap",
});

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
    <html lang="es" data-theme="dark" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
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
