import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import type { PublicSettings } from "../data";
import { whatsappLink } from "../links";
import { CallButton } from "./CallButton";
import { Container } from "./Layout";

/*
  The closing section above the footer on every page: why buyers can rely on us, and the three ways to reach us.
  Wording lives in content.ts. It makes no numeric or certificate claims.
*/

export function TrustBand({ settings }: { settings: PublicSettings | null }) {
  const wa = whatsappLink(settings?.whatsapp, "Hello Leaf Star, I would like to know more about your shirts and pants.");
  return (
    <section aria-labelledby="trust-title" className="bg-surface-2 py-16 lg:py-24">
      <Container className="flex flex-col gap-12">
        <div className="flex max-w-prose flex-col gap-3">
          <p className="type-caption uppercase text-gold-text">About Leaf Star</p>
          <h2 id="trust-title" className="type-h1">Built on trust, one lot at a time</h2>
          <p className="type-body-lg text-fg-muted">
            Leaf Star is a clothing manufacturer. We make premium shirts and pants in our own factory and supply retailers in wholesale lots. Our aim is simple: be the supplier you can rely on, season after season.
          </p>
        </div>
        <p className="max-w-prose type-body text-fg-muted">
          Ask us anything: what is ready to ship, how a lot works, how we deal with regular buyers. A real person from our team will get back to you.
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <CallButton phone={settings?.phone ?? null} variant="primary" />
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "whatsapp", size: "lg" })}>
              <MessageCircle aria-hidden="true" className="size-icon" /> WhatsApp us
            </a>
          ) : null}
          <Link href="/catalog" className={buttonClasses({ variant: "secondary", size: "lg" })}>Browse the catalog</Link>
          <Link href="/about" className="inline-flex min-h-control items-center rounded-sm type-small font-bold text-gold-text underline focus-ring">Read our story</Link>
        </div>
      </Container>
    </section>
  );
}
