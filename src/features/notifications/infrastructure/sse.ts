import 'server-only';
import { subscribeToPostgresSignals } from './postgres-signals';
import { prisma } from '@/shared/server/db';

/** Authenticated invalidations only; projections remain authorized HTTP requests. */
export async function openNotificationStream(userId: string, signal: AbortSignal) {
  let unsubscribe: (() => void) | undefined;
  let stopped = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const encoder = new TextEncoder();
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    signal.removeEventListener('abort', stop);
    try {
      controller?.close();
    } catch {
      /* Already cancelled by the browser. */
    }
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
      disconnected: stop,
      receive(change) {
        void (async () => {
          if (stopped) return;
          if (change.kind === 'inbox' && change.userId === userId) {
            send('inbox', { userId });
          } else if (change.kind === 'roadmap' && (!change.userId || change.userId === userId)) {
            // Inactive memberships still receive invalidation so HTTP can revoke access.
            const participation = await prisma.participation.findFirst({
              where: { userId, courseOfferingId: String(change.courseOfferingId) },
              select: { id: true },
            });
            if (participation || change.userId === userId) send('roadmap', { ...change, userId });
          }
        })().catch(() => {
          console.warn('Roadmap live signal projection failed');
          stop();
        });
      },
    });
    if (signal.aborted || stopped) {
      unsubscribe();
      throw new Error('Stream disconnected');
    }
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
        // Reauthenticate periodically rather than holding an expired JWT indefinitely.
        lifetime = setTimeout(stop, 5 * 60_000);
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
