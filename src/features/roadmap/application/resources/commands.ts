import 'server-only';
import { resourceContentState } from '@/shared/server/resource-content-state';

import type { Prisma } from '@/shared/server/db';
import type { RoadmapChangePort } from '../change-port';
import { roadmapCommand } from '../roadmap-command';
import { resourceDto } from '@/features/roadmap/application/roadmap';
import { requireNode } from '@/features/roadmap/application/editor';
import {
  requireResourceType,
  requireString,
  requireUrl,
} from '@/features/roadmap/application/validation';
import {
  deleteUploadedFile,
  saveUploadedFile,
  validateUploadedFile,
} from '@/features/roadmap/infrastructure/resources/filesystem';
import { fileResourceUrl } from '@/features/roadmap/domain/resource';
import { requireUuid } from '@/shared/validation';
import { ApplicationError } from '@/shared/errors/server';

type JsonObject = Record<string, unknown>;

async function requireResource(
  transaction: Prisma.TransactionClient,
  id: string,
  roadmapId: string,
) {
  const resource = await transaction.resource.findFirst({
    where: { id, roadmapNode: { roadmapId } },
  });
  if (!resource)
    throw new ApplicationError(404, 'RESOURCE_NOT_FOUND', 'El recurso no existe en este roadmap.');
  return resource;
}

type NewResource = {
  nodeId: string;
  title: string;
  url: string;
  type: 'FILE' | 'LINK' | 'VIDEO';
  fileKey?: string;
  fileContentType?: string | null;
};

/** Adds a Resource to a Node: one content fact, no access change. */
function resourceCreation<Input>(parse: (input: Input) => NewResource) {
  return roadmapCommand({
    capability: 'edit',
    parse,
    access: 'none',
    run: async ({ tx, roadmap, actor, input: { nodeId, ...data } }) => {
      const node = await requireNode(tx, nodeId, roadmap.id);
      const resource = await tx.resource.create({ data: { roadmapNodeId: node.id, ...data } });
      return {
        result: resourceDto(resource, actor.identifier),
        facts: [
          {
            kind: 'resource',
            nodeId: node.id,
            resourceId: resource.id,
            previous: null,
            current: resourceContentState(resource),
          },
        ],
      };
    },
  });
}

export const createRoadmapResource = resourceCreation(
  ({ id, input }: { id: string; input: JsonObject }) => ({
    nodeId: requireUuid(id, 'nodeId'),
    title: requireString(input.title, 'title', 240),
    url: requireUrl(input.url),
    type: requireResourceType(input.type),
  }),
);

/** Records bytes already saved under `fileKey` as a FILE Resource. */
const createUploadedResource = resourceCreation(
  ({ id, file, fileKey }: { id: string; file: File; fileKey: string }) => ({
    nodeId: requireUuid(id, 'nodeId'),
    title: requireString(file.name, 'title', 240),
    url: fileResourceUrl(fileKey),
    type: 'FILE',
    fileKey,
    fileContentType: file.type || null,
  }),
);

function uploadedFileError(error: unknown): never {
  if (error instanceof Error && error.message === 'EMPTY_FILE') {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'El archivo seleccionado está vacío.');
  }
  if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'El archivo no puede superar los 25 MB.');
  }
  throw error;
}

/** Saves the file's bytes, then records them; a refused or failed record deletes the bytes. */
export async function uploadRoadmapResource(
  {
    file,
    ...request
  }: Omit<Parameters<typeof createUploadedResource>[0], 'file' | 'fileKey'> & {
    file: unknown;
  },
  changePort: RoadmapChangePort,
) {
  if (!(file instanceof File)) {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'Debes seleccionar un archivo para subir.');
  }
  try {
    validateUploadedFile(file);
  } catch (error) {
    uploadedFileError(error);
  }
  const fileKey = crypto.randomUUID();
  await saveUploadedFile(fileKey, file);
  try {
    return await createUploadedResource({ ...request, file, fileKey }, changePort);
  } catch (error) {
    await deleteUploadedFile(fileKey);
    throw error;
  }
}

export const updateRoadmapResource = roadmapCommand({
  capability: 'edit',
  parse: ({ id, input }: { id: string; input: JsonObject }) => {
    const resourceId = requireUuid(id, 'resourceId');
    const changes: { title?: string; url?: string; type?: 'FILE' | 'LINK' | 'VIDEO' } = {};
    if ('title' in input) changes.title = requireString(input.title, 'title', 240);
    if ('url' in input) changes.url = requireUrl(input.url);
    if ('type' in input) changes.type = requireResourceType(input.type);
    if (Object.keys(changes).length === 0)
      throw new ApplicationError(
        400,
        'INVALID_REQUEST',
        'Debe indicar al menos un campo para actualizar.',
      );
    return { resourceId, changes };
  },
  access: 'none',
  run: async ({ tx, roadmap, actor, input: { resourceId, changes } }) => {
    const resource = await requireResource(tx, resourceId, roadmap.id);
    const changed = Object.entries(changes).some(
      ([field, value]) => resource[field as keyof typeof changes] !== value,
    );
    if (!changed)
      return { result: { resource: resourceDto(resource, actor.identifier) }, facts: [] };
    const updated = await tx.resource.update({ where: { id: resource.id }, data: changes });
    return {
      result: { resource: resourceDto(updated, actor.identifier) },
      facts: [
        {
          kind: 'resource',
          nodeId: resource.roadmapNodeId,
          resourceId: resource.id,
          previous: resourceContentState(resource),
          current: resourceContentState(updated),
        },
      ],
    };
  },
});

/** Removes the Resource and returns its stored file's key, if any. */
const resourceRemoval = roadmapCommand({
  capability: 'edit',
  parse: ({ id }: { id: string }) => requireUuid(id, 'resourceId'),
  access: 'none',
  run: async ({ tx, roadmap, input: resourceId }) => {
    const resource = await requireResource(tx, resourceId, roadmap.id);
    await tx.resource.delete({ where: { id: resource.id } });
    return {
      result: resource.fileKey,
      facts: [
        {
          kind: 'resource',
          nodeId: resource.roadmapNodeId,
          resourceId: resource.id,
          previous: resourceContentState(resource),
          current: null,
        },
      ],
    };
  },
});

/** Removes the Resource, then its stored file once the removal committed. */
export async function removeRoadmapResource(
  request: Parameters<typeof resourceRemoval>[0],
  changePort: RoadmapChangePort,
) {
  const fileKey = await resourceRemoval(request, changePort);
  if (fileKey) await deleteUploadedFile(fileKey).catch(() => undefined);
  return {};
}
