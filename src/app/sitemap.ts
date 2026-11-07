import type { MetadataRoute } from "next";
import { loadCatalog } from "@/modules/site/data";

/* Public pages and the articles buyers can currently see (never hidden or out-of-stock ones: the catalog view already filters them). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { articles } = await loadCatalog();
  return [
    ...["", "/about", "/catalog", "/contact", "/privacy"].map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 })),
    ...articles.map((a) => ({ url: `${base}/catalog/${encodeURIComponent(a.code)}`, lastModified: a.createdAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
