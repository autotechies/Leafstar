import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Handshake, Headset, ShieldCheck } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { dealSteps, pillars, processSteps } from "@/modules/site/content";
import { Container, Section, SectionTitle } from "@/modules/site/components/Layout";
import { SitePhoto } from "@/modules/site/components/SitePhoto";
import type { SitePhotoSlot } from "@/modules/site/photos";

export const metadata: Metadata = {
  title: "About us",
  description: "Leaf Star makes premium shirts and pants in its own factory in Peenya, Bengaluru, and supplies retailers across India in wholesale lots.",
};

const icons = { shield: ShieldCheck, handshake: Handshake, headset: Headset } as const;

function Row({ eyebrow, title, children, slot, flip }: { eyebrow: string; title: string; children: string; slot: SitePhotoSlot; flip?: boolean }) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <div className={flip ? "lg:order-2" : undefined}>
        <div className="aspect-video overflow-hidden rounded-xl"><SitePhoto slot={slot} sizes="(min-width: 1024px) 600px, 100vw" /></div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="type-caption uppercase text-gold-text">{eyebrow}</p>
        <h3 className="type-h1">{title}</h3>
        <p className="type-body-lg text-fg-muted">{children}</p>
      </div>
    </div>
  );
}

function Timeline({ steps }: { steps: ReadonlyArray<{ title: string; body: string }> }) {
  return (
    <ol className="grid gap-4 md:grid-cols-5 md:gap-6">
      {steps.map((s, i) => (
        <li key={s.title} className="card-surface flex flex-col gap-2 p-4">
          <span aria-hidden="true" className="inline-flex size-control items-center justify-center rounded-full bg-gold type-h4 text-on-gold">{i + 1}</span>
          <h3 className="type-h4">{s.title}</h3>
          <p className="type-small text-fg-muted">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

/* About (DESIGN.md §7). Same rhythm as Home: a navy opening, then plain and soft sections taking turns. */

export default function AboutPage() {
  return (
    <>
      <section aria-labelledby="about-title" className="bg-chrome pb-16 pt-12 text-chrome-fg lg:pb-24 lg:pt-16">
        <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-6">
            <p className="type-caption uppercase text-gold-on-chrome">About us</p>
            <h1 id="about-title" className="type-display">We make the clothes we sell.</h1>
            <p className="type-body-lg">Leaf Star is a clothing manufacturer in Peenya, Bengaluru. Our shirts and pants are made in our own factory and supplied to retailers across India in wholesale lots.</p>
            <div className="flex flex-col gap-3 md:flex-row">
              <Link href="/catalog" className={buttonClasses({ size: "lg" })}>Browse the catalog <ArrowRight aria-hidden="true" className="size-icon" /></Link>
              <Link href="/contact" className={buttonClasses({ variant: "on-chrome", size: "lg" })}>Contact us</Link>
            </div>
          </div>
          <div className="relative mx-auto w-full lg:ml-auto">
            <div aria-hidden="true" className="absolute -bottom-4 -right-4 size-full rounded-xl border-2 border-gold" />
            <div className="relative aspect-video overflow-hidden rounded-xl bg-chrome-line">
              <SitePhoto slot="factory" priority sizes="(min-width: 1024px) 600px, 90vw" />
            </div>
          </div>
        </Container>
      </section>

      <Section labelledBy="story-title">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col gap-4">
            <p className="type-caption uppercase text-gold-text">Our story</p>
            <h2 id="story-title" className="type-h1">Premium wear. Trusted quality.</h2>
            <p className="type-body-lg text-fg-muted">Those words are on everything we make. They are a promise: garments that look and feel premium, and a supplier that does what it says.</p>
            <p className="type-body text-fg-muted">We work with retailers who care about what reaches their shelves. Because we manufacture in-house, we can tell you honestly what is available, what a lot looks like and when it can ship.</p>
          </div>
          <div className="mx-auto w-full lg:ml-auto">
            <div className="aspect-4/3 overflow-hidden rounded-xl"><SitePhoto slot="cutting" sizes="(min-width: 1024px) 560px, 90vw" /></div>
          </div>
        </div>
      </Section>

      <Section tone="soft" labelledBy="factory-title">
        <div className="sr-only"><h2 id="factory-title">Our factory, people and machines</h2></div>
        <div className="flex flex-col gap-16 lg:gap-24">
        <Row eyebrow="Our factory" title="One roof, start to finish" slot="stitching">
          Cutting, stitching and finishing happen in our own factory, so quality is something we can see and correct, not something we hope for.
        </Row>
        <Row eyebrow="Our people" title="The team behind every lot" slot="team" flip>
          Skilled people stitch and finish every piece. They are the reason a reorder looks like the first order.
        </Row>
        <Row eyebrow="Our machines" title="Equipment that keeps work consistent" slot="machinery">
          Our machines help us keep stitching and finishing even across a large lot.
        </Row>
        </div>
      </Section>

      <Section labelledBy="promise-title">
        <SectionTitle eyebrow="What you can count on" title="A manufacturer you can rely on" id="promise-title" />
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

      <Section tone="soft" labelledBy="process-title">
        <SectionTitle eyebrow="How we make it" title="From fabric to finished lot" id="process-title" />
        <Timeline steps={processSteps} />
      </Section>

      <Section labelledBy="deal-title">
        <SectionTitle eyebrow="How we work with you" title="From enquiry to delivery" id="deal-title">
          A simple, clear path. You always know where your order stands.
        </SectionTitle>
        <Timeline steps={dealSteps} />
        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          <Link href="/enquiry" className={buttonClasses({ size: "lg" })}>Start an enquiry</Link>
          <Link href="/catalog" className={buttonClasses({ variant: "secondary", size: "lg" })}>Browse the catalog</Link>
        </div>
      </Section>
    </>
  );
}
