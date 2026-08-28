"use client";

import { useEffect, useRef } from "react";
import { previewVisitUrl } from "@/lib/documents/preview-navigation";

export function DocumentPreviewFrame({ src, title, fileType, direct, matched }: {
  src: string;
  title: string;
  fileType: string;
  direct: boolean;
  matched: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const resetMatch = matched && !direct;

  useEffect(() => {
    if (!resetMatch || !frameRef.current) return;
    // A cached iframe visit can restore its previous scroll offset over the
    // #matched-preview fragment. A new visit URL lets the fragment own the
    // position, including when React reactivates a cached detail page.
    frameRef.current.src = previewVisitUrl(src, window.location.href, crypto.randomUUID());
  }, [src, resetMatch]);

  return <iframe
    ref={frameRef}
    className={`document-preview-frame ${fileType.toLowerCase()}`}
    sandbox={direct ? undefined : ""}
    src={resetMatch ? undefined : src}
    title={title}
  />;
}
