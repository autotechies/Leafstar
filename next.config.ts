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
