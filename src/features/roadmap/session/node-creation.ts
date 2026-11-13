import type { CanvasCommand } from '@/features/roadmap/canvas/commands/commands';
import type { CanvasCommands } from '@/features/roadmap/canvas/commands/use-canvas-commands';
import {
  stagedResourceTitle,
  type NodeCreationProgress,
  type StagedResource,
} from '@/features/roadmap/editor/types';

type AddNodeCommand = Extract<CanvasCommand, { kind: 'add-node' }>;

export type NodeCreationOutcome = {
  readonly nodeId: string | null;
  readonly failed: readonly StagedResource[];
};

export type NodeCreationSummary = { readonly tone: 'success' | 'error'; readonly message: string };

function resourceCommand(nodeId: string, resource: StagedResource): CanvasCommand {
  return resource.type === 'FILE'
    ? { kind: 'upload-resource', nodeId, file: resource.file }
    : {
        kind: 'add-resource',
        nodeId,
        resource: { title: resource.title, url: resource.url, type: 'LINK' },
      };
}

export async function createNodeWithResources(
  run: CanvasCommands['run'],
  addNode: AddNodeCommand,
  resources: readonly StagedResource[],
  onProgress?: (progress: NodeCreationProgress) => void,
): Promise<NodeCreationOutcome | null> {
  const created = await run(addNode, { announce: resources.length === 0 });
  if (!created.applied) return null;
  const nodeId = created.createdNodeId ?? null;
  if (!nodeId) return { nodeId, failed: resources };
  const failed: StagedResource[] = [];
  for (const [index, resource] of resources.entries()) {
    onProgress?.({ current: index + 1, total: resources.length });
    const { applied } = await run(resourceCommand(nodeId, resource), { announce: false });
    if (!applied) failed.push(resource);
  }
  return { nodeId, failed };
}

function listInProse(items: readonly string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0];
}

function resourceCount(count: number) {
  return count === 1 ? '1 recurso' : `${count} recursos`;
}

export function nodeCreationSummary(
  total: number,
  failed: readonly StagedResource[],
): NodeCreationSummary | null {
  if (total === 0) return null;
  if (failed.length === 0) {
    return { tone: 'success', message: `Nodo creado con ${resourceCount(total)}.` };
  }
  const verb = failed.length === 1 ? 'no se pudo subir' : 'no se pudieron subir';
  return {
    tone: 'error',
    message: `Nodo creado; ${resourceCount(failed.length)} ${verb}: ${listInProse(failed.map(stagedResourceTitle))}.`,
  };
}
