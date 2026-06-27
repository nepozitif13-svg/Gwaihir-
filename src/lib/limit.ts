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
