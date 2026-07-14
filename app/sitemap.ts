import type { MetadataRoute } from "next";

const SITIO_URL = "https://reloj-checador-chi.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITIO_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITIO_URL}/registro`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITIO_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
