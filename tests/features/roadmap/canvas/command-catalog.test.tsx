import { useTestCanvasSession } from '../support/use-test-canvas-session';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { CanvasCommand } from '@/features/roadmap/canvas/commands/canvas-command';
import {
  createInMemoryRoadmapSessionPersistence,
  type PracticeRoadmap,
} from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';
import type { RoadmapDto } from '@/features/roadmap/types';
import { notify } from '@/shared/ui/notify';

type RenameNode = { kind: 'rename-node'; nodeId: string; title: string };

vi.mock('@/features/roadmap/canvas/commands/commands', async (importOriginal) => {
  const commands =
    await importOriginal<typeof import('@/features/roadmap/canvas/commands/commands')>();
  return {
    ...commands,
    canvasCommandCatalog: {
      ...commands.canvasCommandCatalog,
      'rename-node': {
        practice: (practice: PracticeRoadmap, { nodeId, title }: RenameNode) =>
          practice.mutateNode(nodeId, (node) => ({ ...node, title })),
        success: ({ title }: RenameNode) => `Nodo renombrado a ${title}.`,
        report: ({ nodeId }: RenameNode) => ({ type: 'selectNode', nodeId }),
      },
    },
  };
});

const renameNode = {
  kind: 'rename-node',
  nodeId: 'limits',
  title: 'Límites laterales',
} as unknown as CanvasCommand;

const roadmap: RoadmapDto = {
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [
    { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
  ],
  nodes: [
    {
      id: 'limits',
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

const identifier = { courseCode: 'CC1001', year: 2026, semester: 2 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('the in-memory adapter applies a catalog-only command to the Practice roadmap', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);

  await persistence.execute(renameNode);

  expect((await persistence.load()).nodes.map(({ title }) => title)).toEqual(['Límites laterales']);
});

test('the command engine runs a catalog-only command with its success copy and Practice report', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
  const report = vi.fn<(action: PracticeCanvasAction) => void>();
  const onCommandApplied = vi.fn();
  vi.spyOn(notify, 'success');
  const input = {
    courseOffering: { identifier, title: 'Cálculo' },
    experience: { kind: 'teaching' as const, term: 'current' as const },
    practice: { nodeChangeCounts: {}, onAction: report },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
      {children}
    </RoadmapCanvasSessionPersistenceProvider>
  );
  const { result } = renderHook(() => useTestCanvasSession(input, { onCommandApplied }), {
    wrapper,
  });
  await waitFor(() => expect(result.current.roadmap).not.toBeNull());

  let applied = false;
  await act(async () => {
    applied = await result.current.canvasCommands.request(renameNode);
  });

  expect(applied).toBe(true);
  expect(result.current.roadmap?.nodes.map(({ title }) => title)).toEqual(['Límites laterales']);
  expect(notify.success).toHaveBeenCalledWith('Nodo renombrado a Límites laterales.');
  expect(report).toHaveBeenCalledWith({ type: 'selectNode', nodeId: 'limits' });
  expect(onCommandApplied).toHaveBeenCalledWith(renameNode, undefined);
});
