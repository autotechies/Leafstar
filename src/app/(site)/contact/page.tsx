import { Suspense } from "react";
import type { Metadata } from "next";
import { AtSign, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { formatPhone } from "@/lib/formats";
import { loadSettings } from "@/modules/site/data";
import { instagramLink, mapsLink, telLink, whatsappLink } from "@/modules/site/links";
import { ContactForm } from "@/modules/site/components/ContactForm";
import { Section } from "@/modules/site/components/Layout";

export const metadata: Metadata = { title: "Contact", description: "Call, message or write to Leaf Star." };

async function Details() {
  const s = await loadSettings();
  const tel = telLink(s?.phone);
  const wa = whatsappLink(s?.whatsapp);
  const ig = instagramLink(s?.instagram);
  const map = mapsLink(s?.address, s?.city);
  const row = "flex min-h-control items-center gap-3 rounded-sm type-body hover:text-gold-text focus-ring";
  const anything = Boolean(tel || wa || s?.email || ig || map);
  return (
    <div className="flex flex-col gap-2">
      {tel && s?.phone ? <a href={tel} className={row}><Phone aria-hidden="true" className="size-icon text-gold-text" /> {formatPhone(s.phone)}</a> : null}
      {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className={row}><MessageCircle aria-hidden="true" className="size-icon text-gold-text" /> Message us on WhatsApp</a> : null}
      {s?.email ? <a href={`mailto:${s.email}`} className={row}><Mail aria-hidden="true" className="size-icon text-gold-text" /> {s.email}</a> : null}
      {ig && s?.instagram ? <a href={ig} target="_blank" rel="noopener noreferrer" className={row}><AtSign aria-hidden="true" className="size-icon text-gold-text" /> @{s.instagram}</a> : null}
      {map ? <a href={map} target="_blank" rel="noopener noreferrer" className={row}><MapPin aria-hidden="true" className="size-icon text-gold-text" /> {[s?.address, s?.city].filter(Boolean).join(", ")}</a> : null}
      {!anything ? <p className="type-body text-fg-muted">Our contact details will be shown here soon. Please use the form and we will get back to you.</p> : null}
    </div>
  );
}

export default function ContactPage() {
  return (
    <Section className="!py-12 lg:!py-16">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="type-h1">Contact us</h1>
        <p className="max-w-prose type-body text-fg-muted">Tell us what you are looking for and a member of our team will call you back.</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col gap-4">
          <h2 className="type-h3">Reach us directly</h2>
          <Suspense fallback={<Skeleton className="h-40 w-full" rounded="lg" />}>
            <Details />
          </Suspense>
        </div>
        <Card>
          <h2 className="type-h3 mb-4">Send a message</h2>
          <ContactForm />
        </Card>
      </div>
    </Section>
  );
}
