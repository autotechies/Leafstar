import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { dealSteps, processSteps } from "@/modules/site/content";
import { Section, SectionTitle } from "@/modules/site/components/Layout";
import { PhotoPlaceholder } from "@/modules/site/components/PhotoPlaceholder";

export const metadata: Metadata = {
  title: "About us",
  description: "Leaf Star makes premium shirts and pants in its own factory and supplies retailers in wholesale lots.",
};

function Row({ eyebrow, title, children, photo, flip }: { eyebrow: string; title: string; children: string; photo: string; flip?: boolean }) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <div className={flip ? "lg:order-2" : undefined}>
        <PhotoPlaceholder label={photo} ratio="landscape" />
      </div>
      <div className="flex flex-col gap-3">
        <p className="type-caption uppercase text-gold-text">{eyebrow}</p>
        <h2 className="type-h1">{title}</h2>
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

export default function AboutPage() {
  return (
    <>
      <Section className="bg-chrome text-chrome-fg">
        <div className="flex max-w-prose flex-col gap-4">
          <p className="type-caption uppercase text-gold-on-chrome">About us</p>
          <h1 className="type-display">We make the clothes we sell.</h1>
          <p className="type-body-lg">Leaf Star is a clothing manufacturer. Our shirts and pants are produced in our own factory and supplied to retailers in wholesale lots.</p>
        </div>
      </Section>

      <Section labelledBy="story-title">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col gap-4">
            <p className="type-caption uppercase text-gold-text">Our story</p>
            <h2 id="story-title" className="type-h1">Premium wear. Trusted quality.</h2>
            <p className="type-body-lg text-fg-muted">Those words are on everything we make. They are a promise: garments that look and feel premium, and a supplier that does what it says.</p>
            <p className="type-body text-fg-muted">We work with retailers who care about what reaches their shelves. Because we manufacture in-house, we can tell you honestly what is available, what a lot looks like and when it can ship.</p>
          </div>
          <PhotoPlaceholder label="The Leaf Star team" />
        </div>
      </Section>

      <Section tone="soft" className="flex flex-col gap-16 lg:gap-24" labelledBy="factory-title">
        <div className="sr-only"><h2 id="factory-title">Our factory, people and machines</h2></div>
        <Row eyebrow="Our factory" title="One roof, start to finish" photo="Factory floor">
          Cutting, stitching and finishing happen in our own factory, so quality is something we can see and correct, not something we hope for.
        </Row>
        <Row eyebrow="Our people" title="The team behind every lot" photo="Our workers" flip>
          Skilled people stitch and finish every piece. They are the reason a reorder looks like the first order.
        </Row>
        <Row eyebrow="Our machines" title="Equipment that keeps work consistent" photo="Machinery">
          Our machines help us keep stitching and finishing even across a large lot.
        </Row>
      </Section>

      <Section labelledBy="process-title">
        <SectionTitle eyebrow="How we make it" title="From fabric to finished lot" id="process-title" />
        <Timeline steps={processSteps} />
      </Section>

      <Section tone="soft" labelledBy="deal-title">
        <SectionTitle eyebrow="How we work with you" title="From enquiry to delivery" id="deal-title">
          A simple, clear path. You always know where your order stands.
        </SectionTitle>
        <Timeline steps={dealSteps} />
      </Section>

      <Section labelledBy="video-title">
        <SectionTitle eyebrow="Watch" title="A look inside Leaf Star" id="video-title" />
        <PhotoPlaceholder label="Factory video" ratio="landscape" className="max-w-prose" />
        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          <Link href="/catalog" className={buttonClasses({ size: "lg" })}>Browse catalog</Link>
          <Link href="/contact" className={buttonClasses({ variant: "secondary", size: "lg" })}>Contact us</Link>
        </div>
      </Section>
    </>
  );
}
