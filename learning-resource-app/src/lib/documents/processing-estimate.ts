export type ProcessingEstimate = {
  elapsedSeconds: number;
  itemsPerMinute: number;
  remainingSeconds: number;
};

export type ProcessingProgressSample = {
  completedItems: number;
  observedAt: Date | string;
};

type ProcessingEstimateInput = {
  totalItems: number;
  completedItems: number;
  startedAt: Date | string | null | undefined;
  now?: Date;
};

const MINIMUM_SAMPLE_SECONDS = 15;

export function estimateProcessingRemaining({
  totalItems,
  completedItems,
  startedAt,
  now = new Date(),
}: ProcessingEstimateInput): ProcessingEstimate | null {
  if (!startedAt || totalItems <= 0 || completedItems <= 0 || completedItems >= totalItems) {
    return null;
  }

  const startedAtMs = new Date(startedAt).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs) || nowMs <= startedAtMs) {
    return null;
  }

  const elapsedSeconds = (nowMs - startedAtMs) / 1000;
  if (elapsedSeconds < MINIMUM_SAMPLE_SECONDS) return null;

  const itemsPerSecond = completedItems / elapsedSeconds;
  const remainingSeconds = (totalItems - completedItems) / itemsPerSecond;
  if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) return null;

  return {
    elapsedSeconds,
    itemsPerMinute: itemsPerSecond * 60,
    remainingSeconds,
  };
}

export function estimateItemsPerMinuteFromSamples(
  previous: ProcessingProgressSample,
  current: ProcessingProgressSample,
) {
  const previousAtMs = new Date(previous.observedAt).getTime();
  const currentAtMs = new Date(current.observedAt).getTime();
  const completedDelta = current.completedItems - previous.completedItems;
  const elapsedMinutes = (currentAtMs - previousAtMs) / 60000;

  if (
    completedDelta <= 0 ||
    elapsedMinutes <= 0 ||
    !Number.isFinite(previousAtMs) ||
    !Number.isFinite(currentAtMs)
  ) {
    return null;
  }

  const itemsPerMinute = completedDelta / elapsedMinutes;
  return Number.isFinite(itemsPerMinute) && itemsPerMinute > 0 ? itemsPerMinute : null;
}

export function formatRemainingDuration(seconds: number) {
  const roundedSeconds = Math.max(1, Math.round(seconds));
  if (roundedSeconds < 60) return `còn khoảng ${roundedSeconds} giây`;

  const minutes = Math.max(1, Math.round(roundedSeconds / 60));
  if (minutes < 60) return `còn khoảng ${minutes} phút`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `còn khoảng ${hours} giờ ${remainingMinutes} phút`
    : `còn khoảng ${hours} giờ`;
}
