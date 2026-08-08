export type SequentialTaskQueue<T> = {
  enqueue: (key: string, input: T) => Promise<void>;
  pendingCount: () => number;
};

export function createSequentialTaskQueue<T>(
  runner: (input: T) => Promise<void>,
): SequentialTaskQueue<T> {
  let tail = Promise.resolve();
  const pending = new Map<string, Promise<void>>();

  return {
    enqueue(key, input) {
      const existing = pending.get(key);
      if (existing) return existing;

      const task = tail
        .catch(() => undefined)
        .then(() => runner(input))
        .finally(() => pending.delete(key));
      pending.set(key, task);
      tail = task.catch(() => undefined);
      return task;
    },
    pendingCount() {
      return pending.size;
    },
  };
}
