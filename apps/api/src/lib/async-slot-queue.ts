/**
 * Cola simple en memoria: limita cuántos jobs async corren a la vez (p. ej. inferencia IA bajo pico de tráfico).
 */
export function createAsyncSlotQueue(maxConcurrent: number) {
  const limit = Math.max(1, Math.floor(maxConcurrent) || 1);
  let active = 0;
  const waiting: Array<() => void> = [];

  return function enqueue(task: () => Promise<void>): void {
    const run = async () => {
      active++;
      try {
        await task();
      } finally {
        active--;
        const next = waiting.shift();
        if (next) next();
      }
    };

    if (active < limit) {
      void run();
    } else {
      waiting.push(() => {
        void run();
      });
    }
  };
}
