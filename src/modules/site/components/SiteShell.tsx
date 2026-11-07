import { Suspense, type ReactNode } from "react";
import { ChatWidget } from "@/modules/chat/components/ChatWidget";
import { loadSettings } from "../data";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { TrustBand } from "./TrustBand";

/*
  The frame around every public page. Contact details come from the owner's settings, read in two
  small pieces inside Suspense so the page itself can show at once.
*/

async function Header() {
  const settings = await loadSettings();
  return <SiteHeader phone={settings?.phone ?? null} />;
}

async function Closing() {
  const settings = await loadSettings();
  return (
    <>
      <TrustBand settings={settings} />
      <SiteFooter settings={settings} />
    </>
  );
}

async function Chat() {
  const settings = await loadSettings();
  return <ChatWidget whatsapp={settings?.whatsapp ?? null} />;
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-md focus:bg-gold focus:px-4 focus:py-3 focus:text-on-gold">Skip to content</a>
      <Suspense fallback={<SiteHeader phone={null} />}>
        <Header />
      </Suspense>
      <main id="main" className="flex-1">{children}</main>
      <Suspense fallback={<TrustBand settings={null} />}>
        <Closing />
      </Suspense>
      <Suspense fallback={null}>
        <Chat />
      </Suspense>
    </div>
  );
}
