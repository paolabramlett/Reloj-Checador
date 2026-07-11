import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // pdfkit lee sus archivos de métricas de fuente (.afm) con rutas
  // relativas a su propia carpeta en tiempo de ejecución; si webpack lo
  // empaqueta junto al resto del server bundle, esas rutas se rompen
  // (ENOENT buscando Helvetica.afm). Dejarlo fuera del bundle, como
  // require() nativo de Node, resuelve el problema.
  serverExternalPackages: ["pdfkit"],
  headers: async () => [
    {
      // El service worker debe servirse sin caché para que las
      // actualizaciones de la PWA lleguen sin intervención del usuario.
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ],
};

// Sin SENTRY_AUTH_TOKEN todavía — el plugin sube sourcemaps solo si hay
// token; sin él, se salta esa parte y el build sigue funcionando normal.
export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: false,
  disableLogger: true,
});
