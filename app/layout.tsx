import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistrarSW } from "./registrar-sw";

export const metadata: Metadata = {
  title: "Reloj Checador",
  description:
    "Registro de asistencia para tu negocio: checadas de entrada, salida y descansos, en regla con la ley.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Reloj Checador",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
