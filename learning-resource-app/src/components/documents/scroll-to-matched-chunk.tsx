"use client";

import { useEffect } from "react";

export function ScrollToMatchedChunk({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const scrollToMatch = () => {
      if (cancelled) return;
      document.getElementById("matched-chunk")?.scrollIntoView({ block: "start" });
    };
    const frame = requestAnimationFrame(() => requestAnimationFrame(scrollToMatch));
    const retry = window.setTimeout(scrollToMatch, 250);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(retry);
    };
  }, [enabled]);

  return null;
}
