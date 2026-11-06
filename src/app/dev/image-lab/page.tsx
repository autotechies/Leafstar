import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LabClient } from "./LabClient";

export const metadata: Metadata = {
  title: "Image lab",
  robots: { index: false, follow: false },
};

export default function ImageLabPage() {
  const samples = JSON.parse(readFileSync(join(process.cwd(), "public", "dev", "lab", "samples.json"), "utf8")) as Array<{
    n: number;
    name: string;
    hex: string;
    width: number;
    height: number;
    blur: string;
  }>;
  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-8 px-4 py-12 md:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="type-h1">Image lab</h1>
        <p className="type-body text-fg-muted">
          Judge photo smoothness on your own phone. Check: images blur then sharpen without jumping; pinch, double-tap, drag and swipe feel instant; the back gesture closes the viewer;
          the page behind does not move.
        </p>
      </header>
      <LabClient samples={samples} />
    </main>
  );
}
