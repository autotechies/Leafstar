import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 text-center text-fg">
      <Logo kind="stacked" />
      <h1 className="type-h1">We could not find that page</h1>
      <p className="max-w-prose type-body text-fg-muted">The address may have changed, or the article is no longer available. The catalog has everything we have ready to ship.</p>
      <div className="flex flex-col gap-3 md:flex-row">
        <Link href="/catalog" className={buttonClasses({ size: "lg" })}>Browse catalog</Link>
        <Link href="/" className={buttonClasses({ variant: "secondary", size: "lg" })}>Go to home</Link>
      </div>
    </main>
  );
}
