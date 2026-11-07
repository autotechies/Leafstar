import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Feedback";
import { loadSettings } from "@/modules/site/data";
import { EnquiryView } from "@/modules/site/components/EnquiryView";
import { Section } from "@/modules/site/components/Layout";

export const metadata: Metadata = { title: "Your enquiry list", robots: { index: false } };

async function Content() {
  const settings = await loadSettings();
  return <EnquiryView contact={{ phone: settings?.phone ?? null, whatsapp: settings?.whatsapp ?? null }} />;
}

export default function EnquiryPage() {
  return (
    <Section className="!py-12 lg:!py-16">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="type-h1">Your enquiry list</h1>
        <p className="max-w-prose type-body text-fg-muted">Add the pieces you need for each article, then send everything as one request. There is nothing to pay.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" rounded="lg" />}>
        <Content />
      </Suspense>
    </Section>
  );
}
