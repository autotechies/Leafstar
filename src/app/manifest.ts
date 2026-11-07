import type { MetadataRoute } from "next";

/* Installing "Leaf Star Admin" from the browser puts the owner's app on the phone's home screen, opening straight to the Inbox. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leaf Star Admin",
    short_name: "Leaf Star",
    description: "Stock, bills, buyers and enquiries for Leaf Star",
    start_url: "/admin/inbox",
    scope: "/admin",
    display: "standalone",
    background_color: "#0B0B0D",
    theme_color: "#1C2B4A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
