"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function usePdfPage(file: File | null, pageNumber: number) {
  const [document, setDocument] = useState<{ file: File; pdf: PDFDocumentProxy } | null>(null);
  const [page, setPage] = useState<{ file: File; number: number; url: string; width: number; height: number } | null>(null);
  const [failure, setFailure] = useState<{ file: File; message: string } | null>(null);
  const isPdf = file?.name.toLowerCase().endsWith(".pdf");
  useEffect(() => {
    if (!file || !isPdf) return;
    let disposed = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/api/pdf-worker";
        const data = new Uint8Array(await file.arrayBuffer());
        if (disposed) return;
        task = pdfjs.getDocument({ data, useSystemFonts: true });
        task.onPassword = () => {
          if (!disposed) setFailure({ file, message: "PDF có mật khẩu. Hãy mở khóa file trước khi tìm." });
          void task?.destroy();
        };
        const pdf = await task.promise;
        if (!disposed) { setFailure(null); setDocument({ file, pdf }); }
      } catch {
        if (!disposed) setFailure({ file, message: "Không đọc được PDF. File có thể hỏng hoặc có mật khẩu." });
      }
    })();
    return () => { disposed = true; void task?.destroy(); };
  }, [file, isPdf]);

  useEffect(() => {
    if (!file || document?.file !== file) return;
    let disposed = false;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    void (async () => {
      try {
        const pdfPage = await document.pdf.getPage(Math.max(1, Math.min(document.pdf.numPages, pageNumber)));
        if (disposed) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(3, 3000 / base.width, 3000 / base.height, Math.sqrt(8_000_000 / (base.width * base.height)));
        const viewport = pdfPage.getViewport({ scale });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        render = pdfPage.render({ canvas, viewport });
        await render.promise;
        if (!disposed) { setFailure(null); setPage({ file, number: pageNumber, url: canvas.toDataURL("image/png"), width: base.width, height: base.height }); }
        canvas.width = canvas.height = 0;
        pdfPage.cleanup();
      } catch {
        if (!disposed) setFailure({ file, message: "Không thể hiển thị trang PDF này." });
      }
    })();
    return () => { disposed = true; render?.cancel(); };
  }, [document, file, pageNumber]);
  const current = page?.file === file && page.number === pageNumber ? page : null;
  const error = failure?.file === file ? failure.message : "";
  return { page: current, pageCount: document?.file === file ? document.pdf.numPages : 0, loading: Boolean(isPdf && !current && !error), error };
}
