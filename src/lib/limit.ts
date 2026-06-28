// Tiny concurrency limiter (so we don't pull in a dependency).
export function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    active--;
    if (queue.length > 0) queue.shift()!();
  };

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active++;
        fn().then(resolve, reject).finally(next);
      };
      if (active < concurrency) start();
      else queue.push(start);
    });
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry with exponential backoff — handles 429 rate-limit responses from free-tier providers.
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 2000,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("429")) throw err; // only retry rate-limit errors
      if (attempt < maxAttempts - 1) {
        await sleep(baseDelayMs * 2 ** attempt); // 2s, 4s, 8s
      }
    }
  }
  throw lastErr;
}
