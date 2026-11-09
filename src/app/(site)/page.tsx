import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Check, Scissors, Shirt, Package } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";
import { dealSteps, trustFacts } from "@/modules/site/content";
import { loadCatalog, loadSettings } from "@/modules/site/data";
import { Container, Section, SectionTitle } from "@/modules/site/components/Layout";
import { ProductCard } from "@/modules/site/components/ProductCard";
import { SitePhoto } from "@/modules/site/components/SitePhoto";

/* Home (DESIGN.md §7). Order: hero, proof in four facts, what we make, what is ready now, how it is made, how a deal works. */

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

/** The four facts under the hero. "Since 2016" comes from Settings, so it is never out of date. */
async function Facts() {
  const settings = await loadSettings();
  const facts = [settings?.establishedYear ? { title: `Since ${settings.establishedYear}`, caption: "Years of trusted dealing" } : null, ...trustFacts].filter((f) => f !== null);
  return (
    <ul aria-label="Why buyers choose us" className="card-surface grid grid-cols-2 gap-4 p-4 md:p-6 lg:grid-cols-4">
      {facts.map((f) => (
        <li key={f.title} className="flex flex-col gap-1">
          <p className="type-h4 text-gold-text">{f.title}</p>
          <p className="type-small text-fg-muted">{f.caption}</p>
        </li>
      ))}
    </ul>
  );
}

const categories = [
  { label: "Shirts", garment: "Shirt", slot: "shirts", line: "Cotton shirts in wholesale lots" },
  { label: "Pants", garment: "Pant", slot: "pants", line: "Pants and denims in wholesale lots" },
] as const;

const madeHere = [
  { icon: Scissors, title: "Cut here", body: "Fabric is checked and cut to our own patterns." },
  { icon: Shirt, title: "Stitched here", body: "Our team stitches and finishes every piece." },
  { icon: Package, title: "Packed here", body: "Lots are checked and packed before they leave." },
] as const;

export default function HomePage() {
  return (
    <>
      <section aria-labelledby="hero-title" className="bg-chrome pb-24 pt-12 text-chrome-fg lg:pb-32 lg:pt-16">
        <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-6">
            <p className="type-caption uppercase text-gold-on-chrome">Wholesale shirts and pants · Peenya, Bengaluru</p>
            <h1 id="hero-title" className="type-display">Made in our factory. Ready for your shelves.</h1>
            <p className="type-body-lg">Premium shirts and pants in wholesale lots, supplied to retailers across India. See what is ready to ship and get our price in a minute.</p>
            <div className="flex flex-col gap-3 md:flex-row">
              <Link href="/catalog" className={buttonClasses({ size: "lg" })}>Browse the catalog <ArrowRight aria-hidden="true" className="size-icon" /></Link>
              <Link href="/contact" className={buttonClasses({ variant: "on-chrome", size: "lg" })}>Talk to us</Link>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 type-small">
              {["Produced in-house", "Clear minimum order", "Call or WhatsApp us"].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check aria-hidden="true" className="size-icon-sm text-gold-on-chrome" /> {t}</li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-modal lg:ml-auto">
            <div aria-hidden="true" className="absolute -bottom-4 -right-4 size-full rounded-xl border-2 border-gold" />
            <div className="relative aspect-4/5 overflow-hidden rounded-xl bg-chrome-line">
              <SitePhoto slot="hero" priority sizes="(min-width: 1024px) 480px, 90vw" />
            </div>
          </div>
        </Container>
      </section>

      <Container className="relative -mt-12">
        <Suspense fallback={<Skeleton className="h-32 w-full" rounded="lg" />}>
          <Facts />
        </Suspense>
      </Container>

      <Section labelledBy="categories-title">
        <SectionTitle eyebrow="What we make" title="Shirts and pants for your shelves" id="categories-title" />
        <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
          {categories.map((c) => (
            <li key={c.label}>
              <Link href={`/catalog?garment=${c.garment}`} className="group relative block overflow-hidden rounded-xl focus-ring">
                <div className="aspect-4/5 md:aspect-4/3">
                  <SitePhoto slot={c.slot} position="top" sizes="(min-width: 768px) 50vw, 100vw" className="transition-transform duration-300 group-hover:scale-105" />
                </div>
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-chrome px-4 py-4 text-chrome-fg md:px-6">
                  <span className="flex flex-col">
                    <span className="type-h3">{c.label}</span>
                    <span className="type-small">{c.line}</span>
                  </span>
                  <span className="inline-flex size-control shrink-0 items-center justify-center rounded-full bg-gold text-on-gold">
                    <ArrowRight aria-hidden="true" className="size-icon" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="soft" labelledBy="featured-title">
        <SectionTitle eyebrow="Ready to ship" title="In stock right now" id="featured-title">Pick a few, tell us the pieces you need, and we send our price.</SectionTitle>
        <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
          <Featured />
        </Suspense>
        <div className="mt-8">
          <Link href="/catalog" className={buttonClasses({ variant: "secondary", size: "lg" })}>View the full catalog</Link>
        </div>
      </Section>

      <Section tone="chrome" labelledBy="factory-title">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-6">
            <SectionTitle eyebrow="Made in our factory" title="We make what we sell" id="factory-title" onChrome>
              No middlemen. Your lot is cut, stitched and packed under one roof, so we can tell you honestly what is ready and when it ships.
            </SectionTitle>
            <ul className="flex flex-col gap-4">
              {madeHere.map((m) => (
                <li key={m.title} className="flex gap-4">
                  <span className="inline-flex size-control shrink-0 items-center justify-center rounded-full border border-chrome-line text-gold-on-chrome">
                    <m.icon aria-hidden="true" className="size-icon" />
                  </span>
                  <div className="flex flex-col">
                    <p className="type-h4">{m.title}</p>
                    <p className="type-small">{m.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div>
              <Link href="/about" className={buttonClasses({ variant: "on-chrome", size: "lg" })}>See how we make it <ArrowRight aria-hidden="true" className="size-icon" /></Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 aspect-video overflow-hidden rounded-xl"><SitePhoto slot="factory" sizes="(min-width: 1024px) 560px, 100vw" /></div>
            <div className="aspect-square overflow-hidden rounded-xl"><SitePhoto slot="machinery" sizes="(min-width: 1024px) 270px, 50vw" /></div>
            <div className="aspect-square overflow-hidden rounded-xl"><SitePhoto slot="cutting" sizes="(min-width: 1024px) 270px, 50vw" /></div>
          </div>
        </div>
      </Section>

      <Section labelledBy="deal-title">
        <SectionTitle eyebrow="How a deal closes" title="From enquiry to delivery in five steps" id="deal-title" />
        <ol className="grid gap-4 md:grid-cols-5 md:gap-6">
          {dealSteps.map((s, i) => (
            <li key={s.title} className="card-surface flex flex-col gap-2 p-4">
              <span aria-hidden="true" className="inline-flex size-control items-center justify-center rounded-full bg-gold type-h4 text-on-gold">{i + 1}</span>
              <h3 className="type-h4">{s.title}</h3>
              <p className="type-small text-fg-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          <Link href="/enquiry" className={buttonClasses({ size: "lg" })}>Start an enquiry</Link>
          <Link href="/about" className={buttonClasses({ variant: "secondary", size: "lg" })}>Read more about how we work</Link>
        </div>
      </Section>
    </>
  );
}
