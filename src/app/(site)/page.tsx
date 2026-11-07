import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Check, Handshake, Headset, ShieldCheck } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";
import { dealSteps, pillars, trustFacts } from "@/modules/site/content";
import { loadCatalog, loadSettings } from "@/modules/site/data";
import { Container, Section, SectionTitle } from "@/modules/site/components/Layout";
import { PhotoPlaceholder } from "@/modules/site/components/PhotoPlaceholder";
import { ProductCard } from "@/modules/site/components/ProductCard";

/* Home (DESIGN.md §7). Photos are labelled placeholders until the owner supplies real ones. */

const icons = { shield: ShieldCheck, handshake: Handshake, headset: Headset } as const;

async function Featured() {
  const [{ articles }, settings] = await Promise.all([loadCatalog(), loadSettings()]);
  const featured = articles.filter((a) => a.featured);
  const shown = (featured.length >= 2 ? featured : articles).slice(0, 4);
  if (shown.length === 0) {
    return <p className="max-w-prose type-body text-fg-muted">We are adding our latest styles. Call or message us to hear what is ready to ship today.</p>;
  }
  return (
    <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:px-0">
      {shown.map((a) => (
        <li key={a.id} className="w-60 shrink-0 snap-start md:w-auto">
          <ProductCard article={a} contact={{ phone: settings?.phone ?? null, whatsapp: settings?.whatsapp ?? null }} />
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <>
      <section aria-labelledby="hero-title" className="bg-chrome pb-24 pt-12 text-chrome-fg lg:pb-24 lg:pt-16">
        <Container className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col gap-6">
            <p className="type-caption uppercase text-gold-on-chrome">Wholesale clothing manufacturer</p>
            <h1 id="hero-title" className="type-display">Premium shirts and pants, made in our own factory.</h1>
            <p className="type-body-lg">We supply retailers in wholesale lots. See what is ready to ship and ask for our price in a minute.</p>
            <div className="flex flex-col gap-3 md:flex-row">
              <Link href="/catalog" className={buttonClasses({ size: "lg" })}>Browse catalog <ArrowRight aria-hidden="true" className="size-icon" /></Link>
              <Link href="/contact" className={buttonClasses({ variant: "on-chrome", size: "lg" })}>Talk to us</Link>
            </div>
            <ul className="flex flex-col gap-2 type-small">
              {["Produced in-house at our factory", "Wholesale lots with a clear minimum order", "Reach us by call or WhatsApp"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check aria-hidden="true" className="size-icon-sm text-gold-on-chrome" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <PhotoPlaceholder label="Factory and garments" className="lg:ml-auto lg:max-w-modal" />
        </Container>
      </section>

      <Container className="relative -mt-12">
        <ul aria-label="Why buyers choose us" className="card-surface grid grid-cols-2 gap-4 p-4 md:p-6 lg:grid-cols-4">
          {trustFacts.map((f) => (
            <li key={f.title} className="flex flex-col gap-1">
              <p className="type-h4 text-gold-text">{f.title}</p>
              <p className="type-small text-fg-muted">{f.caption}</p>
            </li>
          ))}
        </ul>
      </Container>

      <Section labelledBy="categories-title">
        <SectionTitle eyebrow="Shop by category" title="Find what your customers ask for" id="categories-title" />
        <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
          {[{ label: "Shirts", garment: "Shirt" }, { label: "Pants", garment: "Pant" }].map((c) => (
            <li key={c.label}>
              <Link href={`/catalog?garment=${c.garment}`} className="group relative block overflow-hidden rounded-xl focus-ring">
                <PhotoPlaceholder label={`${c.label} photo`} ratio="landscape" rounded={false} />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-chrome px-4 py-4 text-chrome-fg md:px-6">
                  <span className="type-h3">{c.label}</span>
                  <span className="inline-flex size-control items-center justify-center rounded-full bg-gold text-on-gold">
                    <ArrowRight aria-hidden="true" className="size-icon" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="soft" labelledBy="featured-title">
        <SectionTitle eyebrow="Featured" title="Ready to ship now" id="featured-title" />
        <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
          <Featured />
        </Suspense>
        <div className="mt-8">
          <Link href="/catalog" className={buttonClasses({ variant: "secondary", size: "lg" })}>View full catalog</Link>
        </div>
      </Section>

      <Section labelledBy="about-title">
        <SectionTitle eyebrow="About us" title="A manufacturer you can rely on" id="about-title">
          We are the people who make what we sell. That keeps us honest about quality, stock and delivery.
        </SectionTitle>
        <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
          {pillars.map((p) => {
            const Icon = icons[p.icon];
            return (
              <li key={p.title} className="card-surface flex flex-col gap-3 p-4 md:p-6">
                <span className="inline-flex size-control items-center justify-center rounded-full bg-surface-2 text-gold-text">
                  <Icon aria-hidden="true" className="size-icon" />
                </span>
                <h3 className="type-h3">{p.title}</h3>
                <p className="type-body text-fg-muted">{p.body}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section tone="soft" labelledBy="proof-title">
        <SectionTitle eyebrow="Proof of work" title="See where your clothes are made" id="proof-title" />
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="grid grid-cols-2 gap-4">
            <PhotoPlaceholder label="Our factory" ratio="landscape" className="col-span-2" />
            <PhotoPlaceholder label="Our team at work" ratio="square" />
            <PhotoPlaceholder label="Machinery" ratio="square" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="type-h3">How a deal closes</h3>
            <ol className="flex flex-col gap-4">
              {dealSteps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span aria-hidden="true" className="inline-flex size-control shrink-0 items-center justify-center rounded-full bg-gold type-h4 text-on-gold">{i + 1}</span>
                  <div className="flex flex-col gap-1">
                    <p className="type-h4">{s.title}</p>
                    <p className="type-body text-fg-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/about" className="mt-2 inline-flex min-h-control items-center gap-2 rounded-sm type-small font-bold text-gold-text underline focus-ring">
              Read more about how we work <ArrowRight aria-hidden="true" className="size-icon-sm" />
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
