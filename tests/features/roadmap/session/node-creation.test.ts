import { expect, test } from 'vitest';
import type { CanvasCommand } from '@/features/roadmap/canvas/commands/commands';
import type { StagedResource } from '@/features/roadmap/editor/types';
import {
  createNodeWithResources,
  nodeCreationSummary,
} from '@/features/roadmap/session/node-creation';

const addNode: Extract<CanvasCommand, { kind: 'add-node' }> = {
  kind: 'add-node',
  node: { title: 'Límites', description: '', nodeTypeId: 'content', isVisible: true },
  position: { x: 0, y: 0 },
  displaced: [],
};

const guide: StagedResource = {
  id: 'guide',
  type: 'FILE',
  file: new File(['pdf'], 'guia.pdf', { type: 'application/pdf' }),
};
const video: StagedResource = {
  id: 'video',
  type: 'LINK',
  title: 'Clase grabada',
  url: 'https://video.example/clase',
};

function recordingRun(rejected: (command: CanvasCommand) => boolean = () => false) {
  const calls: { command: CanvasCommand; announce: boolean | undefined }[] = [];
  const run = async (command: CanvasCommand, options?: { readonly announce?: boolean }) => {
    calls.push({ command, announce: options?.announce });
    if (rejected(command)) return { applied: false };
    return command.kind === 'add-node'
      ? { applied: true, createdNodeId: 'created' }
      : { applied: true };
  };
  return { run, calls };
}

test('creates the node quietly, then attaches every staged resource in order', async () => {
  const { run, calls } = recordingRun();
  const progress: unknown[] = [];

  const outcome = await createNodeWithResources(run, addNode, [guide, video], (step) =>
    progress.push(step),
  );

  expect(outcome).toEqual({ nodeId: 'created', failed: [] });
  expect(calls).toEqual([
    { command: addNode, announce: false },
    { command: { kind: 'upload-resource', nodeId: 'created', file: guide.file }, announce: false },
    {
      command: {
        kind: 'add-resource',
        nodeId: 'created',
        resource: { title: 'Clase grabada', url: 'https://video.example/clase', type: 'LINK' },
      },
      announce: false,
    },
  ]);
  expect(progress).toEqual([
    { current: 1, total: 2 },
    { current: 2, total: 2 },
  ]);
});

test('keeps the default announcement when no resources are staged', async () => {
  const { run, calls } = recordingRun();

  await createNodeWithResources(run, addNode, []);

  expect(calls).toEqual([{ command: addNode, announce: true }]);
});

test('reports the resources that failed while the node stays created', async () => {
  const { run } = recordingRun((command) => command.kind === 'upload-resource');

  const outcome = await createNodeWithResources(run, addNode, [guide, video]);

  expect(outcome).toEqual({ nodeId: 'created', failed: [guide] });
});

test('stops before any resource when the node itself is not created', async () => {
  const { run, calls } = recordingRun((command) => command.kind === 'add-node');

  expect(await createNodeWithResources(run, addNode, [guide])).toBeNull();
  expect(calls).toHaveLength(1);
});

test('summarizes the creation in one message', () => {
  expect(nodeCreationSummary(0, [])).toBeNull();
  expect(nodeCreationSummary(1, [])).toEqual({
    tone: 'success',
    message: 'Nodo creado con 1 recurso.',
  });
  expect(nodeCreationSummary(3, [])?.message).toBe('Nodo creado con 3 recursos.');
  expect(nodeCreationSummary(2, [guide])).toEqual({
    tone: 'error',
    message: 'Nodo creado; 1 recurso no se pudo subir: guia.pdf.',
  });
  expect(nodeCreationSummary(3, [guide, video])?.message).toBe(
    'Nodo creado; 2 recursos no se pudieron subir: guia.pdf y Clase grabada.',
  );
});
