"use client";

import { useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import "yet-another-react-lightbox/plugins/counter.css";
import type { Photo } from "../types";
import { useBackToClose } from "../useBackToClose";

/*
  THE photo viewer (AGENTS.md §4): used on the article page, catalog, Inventory, Add Stock, CRM and bill review.
  Library: yet-another-react-lightbox (MIT, maintained, React-native). Chosen because it gives, without hand-rolled
  gesture code: pinch zoom, double-tap zoom, drag-pan, swipe between photos, wheel/trackpad zoom, arrow keys,
  fullscreen, a thumbnail strip, neighbour preloading and a locked page behind it, all driven by CSS transforms.
  What we add: the phone's back gesture closes it, and the large master is only fetched when zooming in
  (each slide offers medium and large; the browser and the zoom plugin pick the right one).
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
      photos.map((p) => ({
        src: p.mediumUrl,
        alt: p.alt,
        width: p.width,
        height: p.height,
        // Offering both lets the viewer show the already-cached medium at once and fetch the large one when zoomed.
        srcSet: [
          { src: p.thumbUrl, width: 320, height: Math.round((320 * p.height) / p.width) },
          { src: p.mediumUrl, width: 800, height: Math.round((800 * p.height) / p.width) },
          { src: p.url, width: p.width >= p.height ? Math.min(p.width, 2000) : Math.round((Math.min(p.height, 2000) * p.width) / p.height), height: Math.min(p.height, 2000) },
        ],
      })),
    [photos],
  );
  const thumbnails = useMemo(() => photos.map((p) => p.thumbUrl), [photos]);
  const single = photos.length < 2;

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides.map((s, i) => ({ ...s, thumbnail: thumbnails[i] }))}
      plugins={single ? [Zoom, Fullscreen] : [Zoom, Thumbnails, Fullscreen, Counter]}
      on={{ view: ({ index: next }) => onIndexChange(next) }}
      carousel={{ finite: true, preload: 2, spacing: 0.05, padding: 0 }}
      animation={{ swipe: 220, zoom: 220 }}
      controller={{ closeOnBackdropClick: true, closeOnPullDown: true, closeOnPullUp: true }}
      zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true, doubleTapDelay: 250, doubleClickDelay: 250, doubleClickMaxStops: 2 }}
      thumbnails={{ position: "bottom", width: 56, height: 70, gap: 8, border: 0, borderRadius: 6, padding: 0, showToggle: false }}
      labels={{ Close: "Close photo viewer", Next: "Next photo", Previous: "Previous photo", "Zoom in": "Zoom in", "Zoom out": "Zoom out", "Enter Fullscreen": "Full screen", "Exit Fullscreen": "Exit full screen" }}
      // The viewer is a dark room in both themes: photos are judged on a neutral dark ground (the chrome colour token).
      styles={{
        container: { backgroundColor: "var(--ls-chrome)" },
      }}
    />
  );
}
