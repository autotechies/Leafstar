"use client";

import { useEffect, useRef } from "react";

/*
  Makes the phone's back gesture (and the browser's Back button) close an overlay instead of leaving the page.
  Opening adds one history entry; Back removes it and closes the overlay; closing from the screen removes
  the entry again, so the history never fills up with leftovers.
*/
export function useBackToClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const marker = { lsOverlay: Math.random().toString(36).slice(2) };
    window.history.pushState(marker, "");
    let closedByBack = false;

    const onPop = () => {
      closedByBack = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed from the screen (not by Back): take our entry off the history again.
      if (!closedByBack && (window.history.state as { lsOverlay?: string } | null)?.lsOverlay === marker.lsOverlay) {
        window.history.back();
      }
    };
  }, [open]);
}
