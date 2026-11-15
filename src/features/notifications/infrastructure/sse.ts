import 'server-only';
import { subscribeToPostgresSignals } from './postgres-signals';
import {
  NOTIFICATION_STREAM_LIFETIME_MS,
  NOTIFICATION_STREAM_ROTATION_LEAD_MS,
} from '../contracts/notification-stream';

export async function openNotificationStream(userId: string, signal: AbortSignal) {
  let unsubscribe: (() => void) | undefined;
  let stopped = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  let rotation: ReturnType<typeof setTimeout> | undefined;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const encoder = new TextEncoder();
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    clearTimeout(rotation);
    signal.removeEventListener('abort', stop);
    try {
      controller?.close();
      // eslint-disable-next-line no-empty -- Already cancelled by the browser.
    } catch {}
    unsubscribe?.();
  };
  const enqueue = (frame: string) => {
    if (controller && controller.desiredSize !== null && controller.desiredSize <= 0) stop();
    if (!stopped) controller?.enqueue(encoder.encode(frame));
  };
  const send = (event: string, data: unknown) => {
    enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    unsubscribe = await subscribeToPostgresSignals({
      userId,
      disconnected: stop,
      receive(roadmapSignal) {
        send('roadmap', roadmapSignal);
      },
    });
    if (stopped) unsubscribe();
    else if (signal.aborted) stop();
  } catch (error) {
    stop();
    throw error;
  }
  return new Response(
    new ReadableStream<Uint8Array>({
      start(output) {
        controller = output;
        if (stopped) {
          output.close();
          return;
        }
        send('ready', { userId });
        heartbeat = setInterval(() => {
          enqueue(': keepalive\n\n');
        }, 15_000);
        rotation = setTimeout(() => {
          send('rotate', { userId });
        }, NOTIFICATION_STREAM_LIFETIME_MS - NOTIFICATION_STREAM_ROTATION_LEAD_MS);
        lifetime = setTimeout(stop, NOTIFICATION_STREAM_LIFETIME_MS);
      },
      cancel: stop,
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'private, no-cache, no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    },
  );
}
