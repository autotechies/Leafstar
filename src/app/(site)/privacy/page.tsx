import type { Metadata } from "next";
import { Section } from "@/modules/site/components/Layout";

export const metadata: Metadata = { title: "Privacy", description: "How Leaf Star handles the details you share on this website." };

const blocks: Array<{ title: string; body: string[] }> = [
  { title: "What we collect", body: [
    "When you send a price request, a callback request or a message, we keep the details you type: your name, phone number, business name, city, Instagram handle, the articles you asked about and your note.",
    "When you tap the Call button we note that someone tapped it. We do not know whether a call connected, and we do not record calls.",
  ] },
  { title: "How we use it", body: [
    "We use your details only to reply to you about your enquiry and to serve you as a buyer. We do not sell your details.",
  ] },
  { title: "On your device", body: [
    "We save your theme choice (light or dark) and your enquiry list in your browser so they are there when you return. They stay on your device until you send the request or clear your browser data.",
  ] },
  { title: "Our assistant", body: [
    "If you use the chat assistant, we ask your permission before remembering your visits so that it can welcome you back. You can ask us to forget you at any time and we will delete what we hold.",
  ] },
  { title: "Your choices", body: [
    "You can ask us to see, correct or delete the details we hold about you by calling or messaging us using the contact details on this site.",
  ] },
];

export default function PrivacyPage() {
  return (
    <Section className="!py-12 lg:!py-16">
      <div className="flex max-w-prose flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="type-h1">Privacy</h1>
          <p className="type-body text-fg-muted">A short, plain explanation of what happens to the details you share with Leaf Star on this website.</p>
        </div>
        {blocks.map((b) => (
          <section key={b.title} className="flex flex-col gap-2">
            <h2 className="type-h3">{b.title}</h2>
            {b.body.map((p) => (
              <p key={p} className="type-body text-fg-muted">{p}</p>
            ))}
          </section>
        ))}
      </div>
    </Section>
  );
}
