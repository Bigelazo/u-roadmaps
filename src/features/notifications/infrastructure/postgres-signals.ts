import 'server-only';
import { Client } from 'pg';

type Change = Record<string, unknown>;
type Subscriber = { receive: (change: Change) => void; disconnected: () => void };
type SignalConnection = { subscribe: (subscriber: Subscriber) => () => void };
// Next may bundle the route more than once; share the listener across those modules.
const processSignals = globalThis as typeof globalThis & {
  roadmapSignalConnection?: Promise<SignalConnection>;
};

async function connect(): Promise<SignalConnection> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    application_name: 'u-roadmaps-sse',
  });
  const subscribers = new Set<Subscriber>();
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    processSignals.roadmapSignalConnection = undefined;
    for (const subscriber of [...subscribers]) subscriber.disconnected();
    subscribers.clear();
    void client.end().catch(() => undefined);
  };
  client.on('error', () => {
    console.warn('Roadmap live signal connection failed');
    stop();
  });
  client.on('end', stop);
  client.on('notification', ({ payload }) => {
    try {
      const change: unknown = JSON.parse(payload ?? '{}');
      if (!change || typeof change !== 'object') return;
      for (const subscriber of subscribers) subscriber.receive(change as Change);
    } catch {
      console.warn('Roadmap live signal payload failed');
      stop();
    }
  });
  try {
    await client.connect();
    await client.query('LISTEN u_roadmaps_changes');
  } catch (error) {
    console.warn('Roadmap live signal subscription failed');
    stop();
    throw error;
  }
  return {
    subscribe(subscriber) {
      if (stopped) throw new Error('Signal connection closed');
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
        if (!subscribers.size) stop();
      };
    },
  };
}

/** One PostgreSQL LISTEN connection per Node process, shared by its SSE tabs. */
export function subscribeToPostgresSignals(subscriber: Subscriber) {
  processSignals.roadmapSignalConnection ??= connect();
  return processSignals.roadmapSignalConnection.then((connection) =>
    connection.subscribe(subscriber),
  );
}
