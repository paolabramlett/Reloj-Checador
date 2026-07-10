import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
