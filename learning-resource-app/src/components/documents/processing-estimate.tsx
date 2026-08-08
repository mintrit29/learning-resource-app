"use client";

import { useEffect, useRef, useState } from "react";
import {
  estimateItemsPerMinuteFromSamples,
  formatRemainingDuration,
  type ProcessingProgressSample,
} from "@/lib/documents/processing-estimate";

type ProcessingEstimateProps = {
  completedItems: number;
  device: string;
  initialItemsPerMinute: number | null;
  jobId: string;
  progress: number;
  totalItems: number;
  updatedAt: string;
};

export function ProcessingEstimate({
  completedItems,
  device,
  initialItemsPerMinute,
  jobId,
  progress,
  totalItems,
  updatedAt,
}: ProcessingEstimateProps) {
  const jobIdRef = useRef(jobId);
  const sampleRef = useRef<ProcessingProgressSample>({ completedItems, observedAt: updatedAt });
  const [observedItemsPerMinute, setObservedItemsPerMinute] = useState<number | null>(null);

  useEffect(() => {
    if (jobIdRef.current !== jobId) {
      jobIdRef.current = jobId;
      sampleRef.current = { completedItems, observedAt: updatedAt };
      setObservedItemsPerMinute(null);
      return;
    }

    if (completedItems < sampleRef.current.completedItems) {
      sampleRef.current = { completedItems, observedAt: updatedAt };
      setObservedItemsPerMinute(null);
      return;
    }

    const currentSample = { completedItems, observedAt: updatedAt };
    const measuredRate = estimateItemsPerMinuteFromSamples(sampleRef.current, currentSample);
    if (measuredRate === null) return;

    sampleRef.current = currentSample;
    setObservedItemsPerMinute((currentRate) =>
      currentRate === null ? measuredRate : currentRate * 0.65 + measuredRate * 0.35,
    );
  }, [completedItems, jobId, updatedAt]);

  const itemsPerMinute = observedItemsPerMinute ?? initialItemsPerMinute;
  const remainingItems = Math.max(0, totalItems - completedItems);
  const remainingSeconds = itemsPerMinute && itemsPerMinute > 0
    ? (remainingItems / itemsPerMinute) * 60
    : null;

  return (
    <span aria-live="polite" className="processing-estimate">
      Tạo vector {device === "cuda" ? "GPU" : "CPU"} · {progress}% · {itemsPerMinute && remainingSeconds !== null
        ? `${itemsPerMinute.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} đoạn/phút · ${formatRemainingDuration(remainingSeconds)}`
        : "đang đo tốc độ thực tế…"}
    </span>
  );
}
