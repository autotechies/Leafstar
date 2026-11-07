import type { NextConfig } from "next";

/*
  Two builds from one codebase:
  - normal (`npm run build`): the full application, for local runs now and Vercel at Step 13;
  - preview (`npm run build:preview`): a static export of only the pages that need no server,
    published to GitHub Pages so the owner can check design and photos on a phone.
    scripts/build-preview.mjs sets LS_PREVIEW_EXPORT and copies only the allowed routes.
*/
const isPreviewExport = process.env.LS_PREVIEW_EXPORT === "1";
const basePath = process.env.LS_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // Partial prerendering needs a server, so the static preview turns it off.
  cacheComponents: !isPreviewExport,
  partialPrefetching: !isPreviewExport,
  poweredByHeader: false,
  // The Excel stock import sends a file (up to 5 MB) to a Server Action.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  env: {
    // Lets browser code build correct addresses for files in /public, and know it is the server-less preview.
    NEXT_PUBLIC_BASE_PATH: isPreviewExport ? (basePath ?? "") : "",
    NEXT_PUBLIC_IS_PREVIEW: isPreviewExport ? "1" : "",
  },
  turbopack: {
    // Only set by the preview build, which runs in a sub-folder of the project.
    ...(process.env.LS_TURBOPACK_ROOT ? { root: process.env.LS_TURBOPACK_ROOT } : {}),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Browser protections on every page. (Not available in the static preview, which has no server.)
  ...(isPreviewExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
                { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
                { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
              ],
            },
          ];
        },
      }),
  ...(isPreviewExport
    ? {
        output: "export" as const,
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
