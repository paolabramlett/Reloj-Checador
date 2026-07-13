import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RegistrarSW } from "./registrar-sw";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chekly",
  description:
    "Registro de asistencia para tu negocio: checadas de entrada, salida y descansos, en regla con la ley.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon_tab.svg",
    apple: "/icon_app.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chekly",
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
    <html lang="es-MX" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
