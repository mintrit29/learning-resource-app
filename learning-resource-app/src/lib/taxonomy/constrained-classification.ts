export function selectAllowedTopic<T extends { id: string }>(
  topics: T[],
  requestedTopicId: string | null,
  confidence: number,
  minimumConfidence = 0.75,
) {
  if (!requestedTopicId || confidence < minimumConfidence) return null;
  return topics.find((topic) => topic.id === requestedTopicId) ?? null;
}
