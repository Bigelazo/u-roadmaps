import 'server-only';
import { Client } from 'pg';
import { prisma } from '@/shared/server/db';

type Change = Record<string, unknown>;
type RoadmapSignal = Change & { userId: string; accessLost?: true };
type Subscriber = {
  userId: string;
  receive: (signal: RoadmapSignal) => void;
  disconnected: () => void;
};
type Recipient = { subscriber: Subscriber; memberships: Set<string> };
type SignalConnection = { subscribe: (subscriber: Subscriber) => () => void };
const processSignals = globalThis as typeof globalThis & {
  roadmapSignalConnection?: Promise<SignalConnection>;
};

function deliver({ subscriber }: Recipient, change: Change, accessLost: boolean) {
  try {
    subscriber.receive({
      ...change,
      userId: subscriber.userId,
      ...(accessLost ? { accessLost: true as const } : {}),
    });
  } catch {
    console.warn('Roadmap live signal projection failed');
    subscriber.disconnected();
  }
}

async function dispatchRoadmapChange(
  change: Change,
  recipients: readonly Recipient[],
  isSubscribed: (recipient: Recipient) => boolean,
) {
  const courseOfferingId = String(change.courseOfferingId);
  const owner = change.userId;
  const addressed = recipients.filter(({ subscriber }) => !owner || subscriber.userId === owner);
  const pending = owner
    ? addressed
    : addressed.filter(({ memberships }) => !memberships.has(courseOfferingId));
  for (const recipient of addressed) {
    if (!pending.includes(recipient)) deliver(recipient, change, false);
  }
  if (!pending.length) return;
  let participations: { userId: string; isActive: boolean }[];
  try {
    participations = await prisma.participation.findMany({
      where: {
        courseOfferingId,
        userId: { in: [...new Set(pending.map(({ subscriber }) => subscriber.userId))] },
      },
      select: { userId: true, isActive: true },
    });
  } catch {
    console.warn('Roadmap live signal projection failed');
    for (const { subscriber } of pending) subscriber.disconnected();
    return;
  }
  for (const recipient of pending) {
    if (!isSubscribed(recipient)) continue;
    const own = participations.filter(({ userId }) => userId === recipient.subscriber.userId);
    if (owner) {
      deliver(recipient, change, !own.some(({ isActive }) => isActive));
    } else if (own.length) {
      recipient.memberships.add(courseOfferingId);
      deliver(recipient, change, false);
    }
  }
}

async function connect(): Promise<SignalConnection> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    application_name: 'u-roadmaps-sse',
  });
  const recipients = new Map<Subscriber, Recipient>();
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    processSignals.roadmapSignalConnection = undefined;
    for (const subscriber of [...recipients.keys()]) subscriber.disconnected();
    recipients.clear();
    void client.end().catch(() => undefined);
  };
  client.on('error', () => {
    console.warn('Roadmap live signal connection failed');
    stop();
  });
  client.on('end', stop);
  client.on('notification', ({ payload }) => {
    let change: unknown;
    try {
      change = JSON.parse(payload ?? '{}');
    } catch {
      console.warn('Roadmap live signal payload failed');
      stop();
      return;
    }
    if (!change || typeof change !== 'object' || (change as Change).kind !== 'roadmap') return;
    void dispatchRoadmapChange(change as Change, [...recipients.values()], (recipient) =>
      recipients.has(recipient.subscriber),
    );
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
      recipients.set(subscriber, { subscriber, memberships: new Set() });
      return () => {
        recipients.delete(subscriber);
        if (!recipients.size) stop();
      };
    },
  };
}

export async function subscribeToPostgresSignals(subscriber: Subscriber) {
  const connection = await (processSignals.roadmapSignalConnection ??= connect());
  try {
    return connection.subscribe(subscriber);
  } catch {
    return (await (processSignals.roadmapSignalConnection ??= connect())).subscribe(subscriber);
  }
}
