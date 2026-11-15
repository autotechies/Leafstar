"use client";

import { useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Counter from "yet-another-react-lightbox/plugins/counter";
import { Minus, Plus, RotateCcw } from "lucide-react";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import "yet-another-react-lightbox/plugins/counter.css";
import type { Photo } from "../types";
import { useBackToClose } from "../useBackToClose";

/*
  THE photo viewer (AGENTS.md §4): used on the article page, catalog, Inventory, Add Stock, CRM and bill review.
  Library: yet-another-react-lightbox. Chosen because it provides GPU-accelerated transforms without hand-rolled
  gesture bugs: pinch zoom, double-tap zoom, drag-pan, swipe between photos, wheel/trackpad zoom, arrow keys,
  fullscreen, a thumbnail strip, neighbour preloading, and a locked page behind it.
  Enhanced with:
  - Explicit Zoom In (+) and Zoom Out (-) and Reset Zoom toolbar controls for ultra-convenient navigation
  - Single high-fidelity source to prevent mid-gesture srcset thrashing/stutter
  - Safe dimension fallbacks preventing NaN crashes
  - Phone back gesture support via useBackToClose
*/

export interface ImageViewerProps {
  photos: Photo[];
  open: boolean;
  /** Which photo is showing. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export default function ImageViewer({ photos, open, index, onIndexChange, onClose }: ImageViewerProps) {
  useBackToClose(open, onClose);

  const slides = useMemo(
    () =>
      photos.map((p) => {
        const w = p.width && Number.isFinite(p.width) && p.width > 0 ? p.width : 1200;
        const h = p.height && Number.isFinite(p.height) && p.height > 0 ? p.height : 1500;
        const masterUrl = p.url || p.mediumUrl || p.thumbUrl;
        const thumb = p.thumbUrl || p.mediumUrl || p.url;

        return {
          src: masterUrl,
          alt: p.alt || "Product garment photo",
          width: w,
          height: h,
          thumbnail: thumb,
        };
      }),
    [photos],
  );

  const single = photos.length < 2;

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      plugins={single ? [Zoom, Fullscreen] : [Zoom, Thumbnails, Fullscreen, Counter]}
      on={{ view: ({ index: next }) => onIndexChange(next) }}
      carousel={{ finite: true, preload: 2, spacing: 0.05, padding: 0 }}
      animation={{ swipe: 240, zoom: 240 }}
      controller={{ closeOnBackdropClick: true, closeOnPullDown: true, closeOnPullUp: true }}
      zoom={{
        maxZoomPixelRatio: 4,
        zoomInMultiplier: 1.5,
        scrollToZoom: true,
        pinchZoomV4: true,
        doubleTapDelay: 300,
        doubleClickDelay: 300,
        doubleClickMaxStops: 3,
      }}
      thumbnails={{
        position: "bottom",
        width: 60,
        height: 75,
        gap: 8,
        border: 0,
        borderRadius: 6,
        padding: 0,
        showToggle: false,
      }}
      labels={{
        Close: "Close photo viewer",
        Next: "Next photo",
        Previous: "Previous photo",
        "Zoom in": "Zoom in",
        "Zoom out": "Zoom out",
        "Enter Fullscreen": "Full screen",
        "Exit Fullscreen": "Exit full screen",
      }}
      render={{
        buttonZoom: (zoomRef) => (
          <div className="flex items-center gap-1 rounded-full border border-chrome-line bg-chrome/80 px-2 py-1 mr-2 backdrop-blur-md">
            <button
              type="button"
              disabled={zoomRef.disabled || zoomRef.zoom <= zoomRef.minZoom}
              onClick={() => zoomRef.zoomOut()}
              aria-label="Zoom out photo"
              title="Zoom out (-)"
              className="inline-flex size-control-sm items-center justify-center rounded-full text-chrome-fg hover:bg-chrome-line focus-ring disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
            >
              <Minus aria-hidden="true" className="size-icon-sm" />
            </button>
            <button
              type="button"
              disabled={zoomRef.disabled}
              onClick={() => zoomRef.changeZoom(1)}
              aria-label="Reset zoom to 100%"
              title="Reset zoom to 100% (0)"
              className="px-2 type-caption font-mono font-semibold text-chrome-fg hover:underline rounded focus-ring"
            >
              {Math.round(zoomRef.zoom * 100)}%
            </button>
            <button
              type="button"
              disabled={zoomRef.disabled || zoomRef.zoom >= zoomRef.maxZoom}
              onClick={() => zoomRef.zoomIn()}
              aria-label="Zoom in photo"
              title="Zoom in (+)"
              className="inline-flex size-control-sm items-center justify-center rounded-full text-chrome-fg hover:bg-chrome-line focus-ring disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
            >
              <Plus aria-hidden="true" className="size-icon-sm" />
            </button>
            {zoomRef.zoom > 1 ? (
              <button
                type="button"
                onClick={() => zoomRef.changeZoom(1)}
                aria-label="Fit to screen"
                title="Fit to screen"
                className="ml-1 inline-flex size-control-sm items-center justify-center rounded-full text-chrome-fg hover:bg-chrome-line focus-ring transition-colors"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>
        ),
      }}
      // The viewer is a dark room in both themes: photos are judged on a neutral dark ground (the chrome colour token).
      styles={{
        container: { backgroundColor: "var(--ls-chrome)" },
      }}
    />
  );
}
