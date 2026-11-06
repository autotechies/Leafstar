"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cx } from "@/lib/cx";
import { ACCEPT_ATTRIBUTE, type ProcessedImage } from "../constants";
import type { Photo } from "../types";
import { UploadError, uploadPhoto } from "../upload";
import { SmartImage } from "./SmartImage";
import { ImageViewer } from "./LazyImageViewer";

/*
  Photo picker for the admin (Add Stock, replace photos, ...). Several photos at once; each shows its own
  progress and its own error with a Retry, so one bad file never blocks the others.
  Guidance shown to the owner: portrait 4:5, plain background, long side at least 1600px.
*/

export interface UploadedPhoto {
  key: string;
  status: "uploading" | "done" | "error";
  /** Local preview while the server works. */
  preview: string;
  file: File;
  error?: string;
  image?: ProcessedImage;
}

interface Props {
  value: UploadedPhoto[];
  onChange: (next: UploadedPhoto[] | ((previous: UploadedPhoto[]) => UploadedPhoto[])) => void;
  max?: number;
  /** Used for the alt text of finished photos, e.g. "Navy check shirt". */
  label: string;
  disabled?: boolean;
}

const PARALLEL = 2;

export function toPhoto(item: UploadedPhoto, label: string, position: number): Photo | null {
  if (!item.image) return null;
  const { image } = item;
  return {
    id: item.key,
    thumbUrl: image.thumbUrl,
    mediumUrl: image.mediumUrl,
    url: image.url,
    blurDataUrl: image.blurDataUrl,
    width: image.width,
    height: image.height,
    alt: `${label} photo ${position + 1}`,
  };
}

export function PhotoUploader({ value, onChange, max = 12, label, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const running = useRef(0);
  const valueRef = useRef(value);
  const inFlight = useRef(new Set<string>());
  useEffect(() => {
    valueRef.current = value;
  });

  const patch = useCallback(
    (key: string, change: Partial<UploadedPhoto>) => onChange((all) => all.map((item) => (item.key === key ? { ...item, ...change } : item))),
    [onChange],
  );

  const pump = useCallback(() => {
    while (running.current < PARALLEL) {
      const next = valueRef.current.find((item) => item.status === "uploading" && !inFlight.current.has(item.key));
      if (!next) return;
      inFlight.current.add(next.key);
      running.current += 1;
      uploadPhoto(next.file)
        .then((image) => patch(next.key, { status: "done", image, error: undefined }))
        .catch((error: unknown) => patch(next.key, { status: "error", error: error instanceof UploadError ? error.message : "The upload failed. Please try again." }))
        .finally(() => {
          running.current -= 1;
          inFlight.current.delete(next.key);
        });
    }
  }, [patch]);

  // Start work whenever new files are waiting.
  useEffect(() => {
    pump();
  }, [value, pump]);

  // Free the local previews when the component goes away.
  useEffect(
    () => () => {
      for (const item of valueRef.current) URL.revokeObjectURL(item.preview);
    },
    [],
  );

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const room = Math.max(0, max - valueRef.current.length);
    const files = Array.from(list).slice(0, room);
    onChange((all) => [
      ...all,
      ...files.map<UploadedPhoto>((file) => ({ key: crypto.randomUUID(), status: "uploading", preview: URL.createObjectURL(file), file })),
    ]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(key: string) {
    const item = value.find((i) => i.key === key);
    if (item) URL.revokeObjectURL(item.preview);
    onChange((all) => all.filter((i) => i.key !== key));
  }

  const done = value.map((item, i) => toPhoto(item, label, i)).filter((p): p is Photo => p !== null);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {value.map((item) => {
          const doneIndex = done.findIndex((p) => p.id === item.key);
          return (
            <div key={item.key} className="relative">
              <div className="relative aspect-4/5 overflow-hidden rounded-md border border-border bg-surface-2">
                {item.status === "done" && item.image && doneIndex >= 0 ? (
                  <button type="button" onClick={() => setViewerIndex(doneIndex)} className="block size-full focus-ring" aria-label={`Open photo ${doneIndex + 1} larger`}>
                    <SmartImage photo={done[doneIndex]} sizes="(min-width: 1024px) 120px, 30vw" />
                  </button>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.preview} alt="" className={cx("size-full object-cover", item.status === "uploading" && "opacity-50")} />
                )}
                {item.status === "uploading" ? (
                  <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Uploading photo">
                    <Spinner />
                  </div>
                ) : null}
                {item.status === "error" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-danger-bg p-2 text-center">
                    <p className="type-caption text-danger">{item.error}</p>
                    <Button size="sm" variant="secondary" icon={<RotateCw aria-hidden="true" className="size-icon-sm" />} onClick={() => patch(item.key, { status: "uploading", error: undefined })}>
                      Retry
                    </Button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(item.key)}
                aria-label="Remove photo"
                className="absolute -right-2 -top-2 inline-flex size-control-sm items-center justify-center rounded-full border border-border-strong bg-surface text-fg shadow-sm focus-ring"
              >
                <X aria-hidden="true" className="size-icon-sm" />
              </button>
            </div>
          );
        })}
        {value.length < max ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-4/5 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border-strong text-fg-muted transition-colors duration-150 hover:bg-surface-2 focus-ring disabled:opacity-50"
          >
            <ImagePlus aria-hidden="true" className="size-icon-lg" />
            <span className="type-small font-semibold">Add photos</span>
          </button>
        ) : null}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT_ATTRIBUTE} multiple aria-label="Choose photos to upload" className="sr-only" tabIndex={-1} onChange={(e) => addFiles(e.target.files)} />
      <p className="type-small text-fg-muted">Best results: portrait (4:5), plain background, even light, long side at least 1600 px. JPG, PNG, WEBP or iPhone HEIC, up to 25 MB each.</p>
      <ImageViewer photos={done} open={viewerIndex !== null} index={viewerIndex ?? 0} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
    </div>
  );
}
