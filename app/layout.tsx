import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RegistrarSW } from "./registrar-sw";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITIO_URL = "https://reloj-checador-chi.vercel.app";
const DESCRIPCION =
  "Reloj checador digital para micro y pequeñas empresas mexicanas. Registra entradas, salidas y descansos con geocerca, PIN y selfie, cumple con el artículo 132 fracción XXXIV de la LFT, y genera reportes listos para una inspección de la STPS.";

export const metadata: Metadata = {
  metadataBase: new URL(SITIO_URL),
  title: {
    default: "Chekly — reloj checador digital para negocios mexicanos",
    template: "%s · Chekly",
  },
  description: DESCRIPCION,
  keywords: [
    "reloj checador",
    "registro de asistencia",
    "control de asistencia laboral",
    "LFT artículo 132",
    "reforma de 40 horas",
    "STPS",
    "checador digital México",
    "control de horarios PyME",
  ],
  authors: [{ name: "Chekly" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: SITIO_URL,
    siteName: "Chekly",
    title: "Chekly — reloj checador digital para negocios mexicanos",
    description: DESCRIPCION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Chekly — reloj checador digital para negocios mexicanos",
    description: DESCRIPCION,
  },
  robots: {
    index: true,
    follow: true,
  },
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
