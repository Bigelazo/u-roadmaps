import 'server-only';

const DEFAULT_INTERVAL_MS = 5 * 60_000;

export function startPeriodicPass({
  run,
  intervalMs,
  defaultIntervalMs = DEFAULT_INTERVAL_MS,
  onError,
}: {
  run: () => Promise<void>;
  intervalMs: string | undefined;
  defaultIntervalMs?: number;
  onError: (error: unknown) => void;
}) {
  const configured = Number(intervalMs);
  const interval =
    Number.isFinite(configured) && configured >= 1_000 ? configured : defaultIntervalMs;
  let running = false;
  const pass = () => {
    if (running) return;
    running = true;
    void run()
      .catch(onError)
      .finally(() => {
        running = false;
      });
  };
  pass();
  setInterval(pass, interval).unref();
}
