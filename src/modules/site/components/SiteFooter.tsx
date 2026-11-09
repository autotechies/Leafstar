import { Suspense } from "react";
import Link from "next/link";
import { CalendarCheck, Factory, Mail, MapPin, MessageCircle, Phone, Truck } from "lucide-react";
import { FacebookIcon, InstagramIcon } from "@/components/brand/Social";
import { Logo } from "@/components/brand/Logo";
import { formatPhone } from "@/lib/formats";
import { nav } from "../content";
import type { PublicSettings } from "../data";
import { addressLine, facebookLink, instagramLink, mapEmbedSrc, mapsLink, telLink, whatsappLink } from "../links";
import { CurrentYear } from "./CurrentYear";
import { Container } from "./Layout";

/*
  Footer (DESIGN.md §7). Everything comes from Settings, so the owner changes it in one place.
  Only details the owner has entered are shown. The strip at the top uses facts the owner has confirmed
  (years in business, made in our own factory, served across India); nothing else is claimed.
*/

export function SiteFooter({ settings }: { settings: PublicSettings | null }) {
  const phone = telLink(settings?.phone);
  const wa = whatsappLink(settings?.whatsapp);
  const ig = instagramLink(settings?.instagram);
  const fb = facebookLink(settings?.facebook);
  const map = mapsLink(settings?.address, settings?.city);
  const embed = mapEmbedSrc(settings?.address, settings?.city);
  const name = settings?.businessName ?? "Leaf Star";
  const linkClass = "inline-flex min-h-control items-center gap-2 rounded-sm type-small hover:text-gold-on-chrome focus-ring";
  const socialClass = "inline-flex size-control items-center justify-center rounded-full border border-chrome-line hover:border-gold-on-chrome hover:text-gold-on-chrome focus-ring";
  const facts = [
    settings?.establishedYear ? { icon: CalendarCheck, title: `Since ${settings.establishedYear}`, caption: "Years of trusted dealing" } : null,
    { icon: Factory, title: "Our own factory", caption: "Every lot made in-house" },
    { icon: Truck, title: "Across India", caption: "Delivered with care" },
    settings?.city ? { icon: MapPin, title: "Peenya, Bengaluru", caption: "Visit us at the factory" } : null,
  ].filter((f) => f !== null);

  return (
    <footer className="bg-chrome text-chrome-fg dark:border-t dark:border-chrome-line">
      <div className="border-b border-chrome-line">
        <Container className="grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <f.icon aria-hidden="true" className="mt-1 size-icon shrink-0 text-gold-on-chrome" />
              <div className="flex flex-col">
                <p className="type-small font-bold">{f.title}</p>
                <p className="type-caption">{f.caption}</p>
              </div>
            </div>
          ))}
        </Container>
      </div>

      <Container className="grid gap-12 py-12 md:grid-cols-2 lg:grid-cols-4 lg:py-16">
        <div className="flex flex-col gap-4">
          <Logo kind="lockup" surface="chrome" />
          <p className="max-w-prose type-small">{settings?.tagline ?? "Premium wear. Trusted quality."}</p>
          <p className="max-w-prose type-small">Shirts and pants made in our own factory and supplied to retailers in wholesale lots.</p>
          {ig || fb ? (
            <div className="flex gap-3">
              {ig && settings?.instagram ? <a href={ig} target="_blank" rel="noopener noreferrer" aria-label="Leaf Star on Instagram" className={socialClass}><InstagramIcon className="size-icon" /></a> : null}
              {fb ? <a href={fb} target="_blank" rel="noopener noreferrer" aria-label="Leaf Star on Facebook" className={socialClass}><FacebookIcon className="size-icon" /></a> : null}
            </div>
          ) : null}
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-1">
          <h2 className="type-caption mb-2 uppercase text-gold-on-chrome">Explore</h2>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={linkClass}>{n.label}</Link>
          ))}
          <Link href="/enquiry" className={linkClass}>Enquiry list</Link>
          <Link href="/privacy" className={linkClass}>Privacy</Link>
        </nav>

        <div className="flex flex-col gap-1">
          <h2 className="type-caption mb-2 uppercase text-gold-on-chrome">Contact</h2>
          {map ? (
            <a href={map} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 rounded-sm py-2 type-small hover:text-gold-on-chrome focus-ring">
              <MapPin aria-hidden="true" className="mt-1 size-icon-sm shrink-0" />
              <span>{addressLine(settings?.address, settings?.city)}</span>
            </a>
          ) : null}
          {phone && settings?.phone ? <a href={phone} className={linkClass}><Phone aria-hidden="true" className="size-icon-sm" /> {formatPhone(settings.phone)}</a> : null}
          {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className={linkClass}><MessageCircle aria-hidden="true" className="size-icon-sm" /> WhatsApp us</a> : null}
          {settings?.email ? <a href={`mailto:${settings.email}`} className={linkClass}><Mail aria-hidden="true" className="size-icon-sm" /> <span className="break-all">{settings.email}</span></a> : null}
          {!phone && !wa && !settings?.email && !map ? <p className="type-small">Contact details will appear here soon.</p> : null}
        </div>

        {map && embed ? (
          <div className="flex flex-col gap-2">
            <h2 className="type-caption mb-2 uppercase text-gold-on-chrome">Find us</h2>
            {/* The whole box is one link to Google Maps; the map inside is only a picture of the place. */}
            <div className="relative aspect-video overflow-hidden rounded-lg border border-chrome-line bg-chrome-line">
              <MapPin aria-hidden="true" className="absolute left-1/2 top-1/2 size-icon-lg -translate-x-1/2 -translate-y-1/2 text-gold-on-chrome" />
              <iframe src={embed} title={`Map showing ${name}`} loading="lazy" referrerPolicy="no-referrer" tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full border-0" />
              <a href={map} target="_blank" rel="noopener noreferrer" aria-label={`Open ${name} in Google Maps`} className="absolute inset-0 rounded-lg focus-ring" />
            </div>
            <a href={map} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-control items-center gap-2 rounded-sm type-small font-bold text-gold-on-chrome underline focus-ring">Open in Google Maps</a>
          </div>
        ) : null}
      </Container>

      <div className="border-t border-chrome-line">
        <Container className="py-4">
          <p className="type-caption">© <Suspense fallback={null}><CurrentYear /></Suspense> {name}. All rights reserved.</p>
        </Container>
      </div>
    </footer>
  );
}
