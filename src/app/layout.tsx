import Script from "next/script";
import type { Metadata, Viewport } from "next";
import { manrope, playfair } from "@/lib/fonts";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Leaf Star — Premium shirts and pants, wholesale",
    template: "%s · Leaf Star",
  },
  description: "Leaf Star manufactures premium shirts and pants in-house and supplies retailers in wholesale lots.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1C2B4A" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0D" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Load the theme initializer before hydration without embedding executable HTML in this component.
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${manrope.variable} ${playfair.variable}`}>
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
