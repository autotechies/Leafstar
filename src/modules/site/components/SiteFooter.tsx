import { Suspense } from "react";
import { CurrentYear } from "./CurrentYear";
import Link from "next/link";
import { AtSign, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { formatPhone } from "@/lib/formats";
import { nav } from "../content";
import type { PublicSettings } from "../data";
import { instagramLink, mapsLink, telLink, whatsappLink } from "../links";
import { Container } from "./Layout";

/* Footer (DESIGN.md §7): brand, links, contact. Only contact details the owner has entered are shown. */

export function SiteFooter({ settings }: { settings: PublicSettings | null }) {
  const phone = telLink(settings?.phone);
  const wa = whatsappLink(settings?.whatsapp);
  const ig = instagramLink(settings?.instagram);
  const map = mapsLink(settings?.address, settings?.city);
  const linkClass = "inline-flex min-h-control items-center gap-2 rounded-sm type-small hover:text-gold-on-chrome focus-ring";
  return (
    <footer className="bg-chrome text-chrome-fg dark:border-t dark:border-chrome-line">
      <Container className="grid gap-8 py-12 lg:grid-cols-3 lg:py-16">
        <div className="flex flex-col gap-4">
          <Logo kind="lockup" surface="chrome" />
          <p className="max-w-prose type-small">{settings?.tagline ?? "Premium wear. Trusted quality."}</p>
          <p className="max-w-prose type-small">Shirts and pants made in our own factory and supplied to retailers in wholesale lots.</p>
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
          {phone && settings?.phone ? <a href={phone} className={linkClass}><Phone aria-hidden="true" className="size-icon-sm" /> {formatPhone(settings.phone)}</a> : null}
          {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className={linkClass}><MessageCircle aria-hidden="true" className="size-icon-sm" /> WhatsApp us</a> : null}
          {settings?.email ? <a href={`mailto:${settings.email}`} className={linkClass}><Mail aria-hidden="true" className="size-icon-sm" /> {settings.email}</a> : null}
          {ig && settings?.instagram ? <a href={ig} target="_blank" rel="noopener noreferrer" className={linkClass}><AtSign aria-hidden="true" className="size-icon-sm" /> @{settings.instagram}</a> : null}
          {map ? <a href={map} target="_blank" rel="noopener noreferrer" className={linkClass}><MapPin aria-hidden="true" className="size-icon-sm" /> {[settings?.address, settings?.city].filter(Boolean).join(", ")}</a> : null}
          {!phone && !wa && !settings?.email ? <p className="type-small">Contact details will appear here soon.</p> : null}
        </div>
      </Container>
      <div className="border-t border-chrome-line">
        <Container className="py-4">
          <p className="type-caption">© <Suspense fallback={null}><CurrentYear /></Suspense> {settings?.businessName ?? "Leaf Star"}. All rights reserved.</p>
        </Container>
      </div>
    </footer>
  );
}
