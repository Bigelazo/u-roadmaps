import { appendFile } from 'node:fs/promises';
import type { ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { OwnInboxRealtime } from '@/features/notifications/components/own-realtime';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import type { RoadmapDto } from '@/features/roadmap/types';
import { useTestCanvasSession } from '../support/use-test-canvas-session';
import { SimulatedNotificationStream } from '../../../support/notification-stream';

const courseOffering = {
  identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
  title: 'Programación I',
};

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

function TeachingCanvas() {
  useTestCanvasSession({
    courseOffering,
    experience: { kind: 'teaching', term: 'current' },
  });
  return null;
}

function countingLoads() {
  const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
  let loads = 0;
  const load = persistence.load.bind(persistence);
  persistence.load = () => {
    loads += 1;
    return load();
  };
  return {
    persistence,
    take: () => {
      const taken = loads;
      loads = 0;
      return taken;
    },
  };
}

function Page({ children }: { children: ReactNode }) {
  return (
    <>
      <OwnInboxRealtime userId="teacher" />
      {children}
    </>
  );
}

afterEach(() => {
  SimulatedNotificationStream.reset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe.skipIf(!process.env.ROADMAP_LOAD_BENCHMARK)('roadmap load benchmark', () => {
  test('counts Roadmap loads while a teacher opens the canvas and stays idle', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', SimulatedNotificationStream);
    const loads = countingLoads();
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={loads.persistence}>
        <Page>
          <TeachingCanvas />
        </Page>
      </RoadmapCanvasSessionPersistenceProvider>,
    );
    await act(() => vi.advanceTimersByTimeAsync(1000));
    const opening = loads.take();
    await act(() => vi.advanceTimersByTimeAsync(11 * 60_000));
    const idle = loads.take();
    expect(opening).toBeGreaterThan(0);
    await appendFile(
      process.env.ROADMAP_LOAD_BENCHMARK!,
      `${JSON.stringify({ scenario: 'teacher-open-and-idle', openingLoads: opening, idleLoadsIn11Minutes: idle })}\n`,
    );
  });
});
