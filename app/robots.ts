import type { MetadataRoute } from "next";

const SITIO_URL = "https://reloj-checador-chi.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/panel", "/mi-cuenta", "/kiosco", "/api", "/invitacion", "/actualizar-password", "/auth"],
    },
    sitemap: `${SITIO_URL}/sitemap.xml`,
  };
}
