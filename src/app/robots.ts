import type { MetadataRoute } from "next";

/* Search engines may read the public website only. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/dev", "/auth", "/enquiry"] }],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
