"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Banner } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { SwatchRow } from "@/components/ui/Product";
import { assetUrl, isStaticPreview } from "@/lib/assets";
import { ImageViewer } from "@/modules/images/components/LazyImageViewer";
import { PhotoUploader, toPhoto, type UploadedPhoto } from "@/modules/images/components/PhotoUploader";
import { SmartImage } from "@/modules/images/components/SmartImage";
import { photoFromFile } from "@/modules/images/localPhotos";
import type { Photo } from "@/modules/images/types";

/*
  /dev/image-lab (Step 3): the place to judge photo smoothness on a real phone.
  Section 1 and 2 need no server, so they work on the GitHub Pages preview.
  Section 3 uses the real upload pipeline and only works in the full application.
*/

interface Sample {
  n: number;
  name: string;
  hex: string;
  width: number;
  height: number;
  blur: string;
}

export function LabClient({ samples }: { samples: Sample[] }) {
  const patterns = useMemo<Photo[]>(
    () =>
      samples.map((s) => ({
        id: `pattern-${s.n}`,
        thumbUrl: assetUrl(`/dev/lab/pattern-${s.n}-thumb.webp`),
        mediumUrl: assetUrl(`/dev/lab/pattern-${s.n}-medium.webp`),
        url: assetUrl(`/dev/lab/pattern-${s.n}-large.webp`),
        blurDataUrl: s.blur,
        width: s.width,
        height: s.height,
        alt: `${s.name} test pattern`,
      })),
    [samples],
  );

  const [colour, setColour] = useState(0);
  const [mine, setMine] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ photos: Photo[]; index: number } | null>(null);
  const [uploads, setUploads] = useState<UploadedPhoto[]>([]);

  // Preload the first image of each colour so a swatch tap switches instantly.
  useEffect(() => {
    for (const p of patterns) {
      const img = new Image();
      img.src = p.mediumUrl;
    }
  }, [patterns]);

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setProblem(null);
    try {
      const made: Photo[] = [];
      for (const [i, file] of Array.from(files).slice(0, 12).entries()) made.push(await photoFromFile(file, mine.length + i));
      setMine((all) => [...all, ...made]);
    } catch {
      setProblem("This browser could not open one of the photos. Try a JPG from your gallery.");
    } finally {
      setBusy(false);
    }
  }

  const uploaded = uploads.map((u, i) => toPhoto(u, "Lab upload", i)).filter((p): p is Photo => p !== null);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="type-h2">1 · Colour switching and the viewer</h2>
          <p className="type-small text-fg-muted">Tap a colour dot: the photo should change instantly with no blank flash. Tap the photo to open the viewer.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
            <button type="button" onClick={() => setViewer({ photos: patterns, index: colour })} className="block overflow-hidden rounded-md focus-ring" aria-label="Open photo larger">
              <SmartImage photo={patterns[colour]} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" priority />
            </button>
            <SwatchRow colours={samples.map((s) => ({ name: s.name, hex: s.hex }))} selectedIndex={colour} onSelect={setColour} />
          </div>
          <div className="grid grid-cols-4 content-start gap-3 sm:col-span-1 lg:col-span-2">
            {patterns.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setViewer({ photos: patterns, index: i })} className="block overflow-hidden rounded-md focus-ring" aria-label={`Open ${p.alt}`}>
                <SmartImage photo={p} sizes="(min-width: 1024px) 15vw, 25vw" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="type-h2">2 · Your own phone photos</h2>
          <p className="type-small text-fg-muted">Pick photos from your phone. They are resized inside your browser and never uploaded. Use big, full-resolution photos for a harsh test.</p>
        </div>
        <div>
          <label className="inline-flex">
            <input type="file" accept="image/*" multiple className="sr-only peer" onChange={(e) => void onPick(e.target.files)} />
            <span className="inline-flex h-control cursor-pointer items-center justify-center gap-2 rounded-md bg-gold px-4 type-small font-bold text-on-gold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
              <ImagePlus aria-hidden="true" className="size-icon" />
              {busy ? "Preparing…" : "Choose photos"}
            </span>
          </label>
        </div>
        {problem ? <Banner tone="warning">{problem}</Banner> : null}
        {mine.length ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {mine.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setViewer({ photos: mine, index: i })} className="block overflow-hidden rounded-md focus-ring" aria-label={`Open ${p.alt}`}>
                <SmartImage photo={p} sizes="(min-width: 1024px) 15vw, 30vw" />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="type-h2">3 · Real upload pipeline</h2>
          <p className="type-small text-fg-muted">Uploads to Storage, converts iPhone HEIC, rotates, strips location data and makes thumb / medium / large WebP.</p>
        </div>
        {isStaticPreview ? (
          <Banner tone="info">This part needs the full application (login and Storage), so it is switched off in the GitHub Pages preview. It is tested automatically and will be live at the hosting step.</Banner>
        ) : (
          <>
            <PhotoUploader value={uploads} onChange={setUploads} label="Lab upload" />
            {uploaded.length ? (
              <div className="flex flex-col gap-2">
                <Button variant="secondary" onClick={() => setViewer({ photos: uploaded, index: 0 })}>
                  Open the uploaded photos in the viewer
                </Button>
                <p className="type-small text-fg-muted">
                  {uploaded.map((p, i) => `#${i + 1}: ${p.width}×${p.height}`).join(" · ")}
                </p>
              </div>
            ) : null}
          </>
        )}
      </section>

      {viewer ? (
        <ImageViewer
          photos={viewer.photos}
          open
          index={viewer.index}
          onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}
