import 'server-only';

const DEFAULT_INTERVAL_MS = 5 * 60_000;

type PassOptions = {
  run: () => Promise<void>;
  onError: (error: unknown) => void;
};

function exclusivePass({ run, onError }: PassOptions) {
  let running = false;
  return () => {
    if (running) return;
    running = true;
    void run()
      .catch(onError)
      .finally(() => {
        running = false;
      });
  };
}

export function startPeriodicPass({
  run,
  intervalMs,
  defaultIntervalMs = DEFAULT_INTERVAL_MS,
  onError,
}: PassOptions & {
  intervalMs: string | undefined;
  defaultIntervalMs?: number;
}) {
  const configured = Number(intervalMs);
  const interval =
    Number.isFinite(configured) && configured >= 1_000 ? configured : defaultIntervalMs;
  const pass = exclusivePass({ run, onError });
  pass();
  setInterval(pass, interval).unref();
}

export function delayUntilNextBoundary(nowMs: number, periodMs: number, offsetMs: number) {
  const sinceBoundary = (((nowMs - offsetMs) % periodMs) + periodMs) % periodMs;
  return periodMs - sinceBoundary;
}

export function startAlignedPass({
  run,
  periodMs,
  offsetMs,
  onError,
}: PassOptions & { periodMs: number; offsetMs: number }) {
  const pass = exclusivePass({ run, onError });
  const scheduleNext = () => {
    setTimeout(
      () => {
        pass();
        scheduleNext();
      },
      delayUntilNextBoundary(Date.now(), periodMs, offsetMs),
    ).unref();
  };
  pass();
  scheduleNext();
}
