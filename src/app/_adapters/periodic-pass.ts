import 'server-only';

const DEFAULT_INTERVAL_MS = 5 * 60_000;

/** Starts immediately, suppresses overlapping passes and does not keep Node alive. */
export function startPeriodicPass({
  run,
  intervalMs,
  onError,
}: {
  run: () => Promise<void>;
  intervalMs: string | undefined;
  onError: (error: unknown) => void;
}) {
  const configured = Number(intervalMs);
  const interval =
    Number.isFinite(configured) && configured >= 1_000 ? configured : DEFAULT_INTERVAL_MS;
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
