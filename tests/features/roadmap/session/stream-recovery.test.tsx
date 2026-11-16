import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { OwnInboxRealtime } from '@/features/notifications/components/own-realtime';
import {
  NOTIFICATION_STREAM_LIFETIME_MS,
  NOTIFICATION_STREAM_ROTATION_LEAD_MS,
} from '@/features/notifications/contracts/notification-stream';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import {
  RoadmapCanvasSessionPersistenceProvider,
  useRoadmapCanvasSession,
} from '@/features/roadmap/session/session';
import type { RoadmapDto } from '@/features/roadmap/types';
import { SimulatedNotificationStream } from '../../../support/notification-stream';

const identifier = { courseCode: 'CC1001', year: 2026, semester: 2 };

const teachingRoadmap: RoadmapDto = {
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [
    { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
  ],
  nodes: [
    {
      id: 'node-1',
      title: 'Límites',
      description: null,
      nodeTypeId: 'content',
      positionX: 0,
      positionY: 0,
      isVisible: true,
      isTeacherBlocked: false,
      resources: [],
    },
  ],
  dependencies: [],
};

type EntryRoadmap = Promise<RoadmapDto | null>;

function TeachingCanvas({ entryRoadmap }: { entryRoadmap?: EntryRoadmap }) {
  const { roadmap } = useRoadmapCanvasSession(
    {
      courseOffering: { identifier, title: 'Programación I' },
      experience: { kind: 'teaching', term: 'current' },
      entryRoadmap,
    },
    {},
  );
  return roadmap ? <p>{roadmap.nodes.map((node) => node.title).join(', ')}</p> : null;
}

function openTeachingCanvas({
  entryRoadmap,
  listening = true,
}: { entryRoadmap?: EntryRoadmap; listening?: boolean } = {}) {
  const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
  let loads = 0;
  const load = persistence.load.bind(persistence);
  persistence.load = () => {
    loads += 1;
    return load();
  };
  const { unmount } = render(
    <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
      {listening ? <OwnInboxRealtime userId="teacher" /> : null}
      <TeachingCanvas entryRoadmap={entryRoadmap} />
    </RoadmapCanvasSessionPersistenceProvider>,
  );
  const takeLoads = () => {
    const taken = loads;
    loads = 0;
    return taken;
  };
  return Object.assign(takeLoads, { leave: unmount });
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('EventSource', SimulatedNotificationStream);
});

afterEach(() => {
  SimulatedNotificationStream.reset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('opening the teaching canvas loads its Roadmap exactly once', async () => {
  const loads = openTeachingCanvas();
  await advance(1000);
  expect(loads()).toBe(1);
});

test('a Roadmap read before entry opens the canvas without loading it again', async () => {
  const loads = openTeachingCanvas({
    entryRoadmap: Promise.resolve(teachingRoadmap),
    listening: false,
  });
  await advance(1000);
  expect(loads()).toBe(0);
  expect(screen.getByText('Límites')).toBeTruthy();
});

test('a stream that starts listening after the entry read reloads the Roadmap once', async () => {
  const loads = openTeachingCanvas({ entryRoadmap: Promise.resolve(teachingRoadmap) });
  await advance(1000);
  expect(loads()).toBe(1);
});

test('an entry read streamed as a bare thenable still opens the canvas', async () => {
  const streamed = {
    then(resolve: (roadmap: RoadmapDto) => void) {
      resolve(teachingRoadmap);
    },
  } as unknown as EntryRoadmap;
  const loads = openTeachingCanvas({ entryRoadmap: streamed, listening: false });
  await advance(1000);
  expect(loads()).toBe(0);
  expect(screen.getByText('Límites')).toBeTruthy();
});

test('an entry read that found nothing falls back to loading the Roadmap', async () => {
  const loads = openTeachingCanvas({ entryRoadmap: Promise.resolve(null), listening: false });
  await advance(1000);
  expect(loads()).toBe(1);
  expect(screen.getByText('Límites')).toBeTruthy();
});

test('an entry read is not reused when the same page is entered again', async () => {
  const entryRoadmap = Promise.resolve(teachingRoadmap);
  const firstEntry = openTeachingCanvas({ entryRoadmap, listening: false });
  await advance(1000);
  firstEntry.leave();
  const loads = openTeachingCanvas({ entryRoadmap, listening: false });
  await advance(1000);
  expect(loads()).toBe(1);
});

test('eleven idle minutes rotate the stream without reloading the Roadmap', async () => {
  const loads = openTeachingCanvas();
  await advance(1000);
  loads();
  await advance(11 * 60_000);
  expect(loads()).toBe(0);
  expect(SimulatedNotificationStream.open()).toHaveLength(1);
});

test('a stream that fails and reconnects reloads the Roadmap once', async () => {
  const loads = openTeachingCanvas();
  await advance(1000);
  loads();
  act(() => SimulatedNotificationStream.open()[0].fail());
  await advance(5000);
  expect(loads()).toBe(1);
  expect(SimulatedNotificationStream.open()).toHaveLength(1);
});

test('a Roadmap change during a rotation still reloads the Roadmap', async () => {
  const loads = openTeachingCanvas();
  await advance(1000);
  loads();
  await advance(NOTIFICATION_STREAM_LIFETIME_MS - NOTIFICATION_STREAM_ROTATION_LEAD_MS - 1000 + 60);
  expect(SimulatedNotificationStream.instances).toHaveLength(2);
  expect(SimulatedNotificationStream.open()).toHaveLength(1);
  act(() => SimulatedNotificationStream.broadcast('roadmap', { ...identifier, userId: 'teacher' }));
  await advance(1000);
  expect(loads()).toBe(1);
  act(() => SimulatedNotificationStream.broadcast('roadmap', { ...identifier, userId: 'teacher' }));
  await advance(100);
  expect(loads()).toBe(1);
});
