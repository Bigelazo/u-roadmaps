import 'server-only';
import { resourceContentState } from '@/shared/server/resource-content-state';

import type { Prisma } from '@/shared/server/db';
import type { RoadmapChangePort } from '../change-port';
import { resourceNotFound } from '../errors';
import { roadmapCommand, roadmapRead, type RoadmapParticipant } from '../roadmap-command';
import { resourceDto } from '@/features/roadmap/application/roadmap';
import { requireNode } from '@/features/roadmap/application/editor';
import {
  requireResourceType,
  requireLinkResourceType,
  requireString,
  requireUrl,
} from '@/features/roadmap/application/validation';
import { validateUploadedFile } from '@/features/roadmap/infrastructure/resources/filesystem';
import {
  cleanupStoredFiles,
  withStoredFiles,
} from '@/features/roadmap/infrastructure/resources/lifecycle';
import {
  resourceEditError,
  fileResourceUrl,
  uploadedContentType,
  fileReplacementError,
} from '@/features/roadmap/domain/resource';
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
  if (!resource) throw resourceNotFound();
  return resource;
}

type NewResource = {
  nodeId: string;
  title: string;
  url: string;
  type: 'FILE' | 'LINK';
  fileKey?: string;
  fileContentType?: string | null;
  fileSize?: number;
};

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
    type: requireLinkResourceType(input.type),
  }),
);

type UploadedResource = Omit<NewResource, 'url' | 'type'> & { fileKey: string };

const createUploadedResource = resourceCreation(
  ({ nodeId, title, fileKey, fileContentType, fileSize }: UploadedResource) => ({
    nodeId,
    title,
    url: fileResourceUrl(fileKey),
    type: 'FILE',
    fileKey,
    fileContentType,
    fileSize,
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

function requireUploadedFile(file: unknown): File {
  if (!(file instanceof File)) {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'Debes seleccionar un archivo para subir.');
  }
  try {
    validateUploadedFile(file);
  } catch (error) {
    uploadedFileError(error);
  }
  return file;
}

export async function uploadRoadmapResource(
  { id, file: upload, ...participant }: RoadmapParticipant & { id: string; file: unknown },
  changePort: RoadmapChangePort,
) {
  const file = requireUploadedFile(upload);
  const nodeId = requireUuid(id, 'nodeId');
  const title = requireString(file.name, 'title', 240);
  await roadmapRead(participant, 'edit', async () => undefined);
  const fileKey = crypto.randomUUID();
  return withStoredFiles('upload Resource', async (files) => {
    await files.upload(fileKey, file);
    return createUploadedResource(
      {
        ...participant,
        nodeId,
        title,
        fileKey,
        fileContentType: uploadedContentType(file),
        fileSize: file.size,
      },
      changePort,
    );
  });
}

export const updateRoadmapResource = roadmapCommand({
  capability: 'edit',
  parse: ({ id, input }: { id: string; input: JsonObject }) => {
    const resourceId = requireUuid(id, 'resourceId');
    const changes: { title?: string; url?: string; type?: 'FILE' | 'LINK' } = {};
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
    const error = resourceEditError(resource.type, changes);
    if (error) throw new ApplicationError(400, 'INVALID_RESOURCE_EDIT', error);
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

const resourceFileReplacement = roadmapCommand({
  capability: 'edit',
  parse: (input: {
    resourceId: string;
    title: string;
    fileKey: string;
    fileContentType: string | null;
    fileSize: number;
  }) => input,
  access: 'none',
  run: async ({
    tx,
    roadmap,
    actor,
    input: { resourceId, title, fileKey, fileContentType, fileSize },
  }) => {
    const resource = await requireResource(tx, resourceId, roadmap.id);
    const error = fileReplacementError(resource.type);
    if (error) throw new ApplicationError(400, 'INVALID_RESOURCE_EDIT', error);
    const [updated] = await Promise.all([
      tx.resource.update({
        where: { id: resource.id },
        data: { title, url: fileResourceUrl(fileKey), fileKey, fileContentType, fileSize },
      }),
      tx.resourceAccess.updateMany({
        where: { resourceId: resource.id },
        data: { isReviewed: false },
      }),
      tx.simulatedResourceReview.deleteMany({ where: { resourceId: resource.id } }),
    ]);
    return {
      result: {
        resource: resourceDto(updated, actor.identifier),
        replacedFileKey: resource.fileKey,
      },
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

export async function replaceRoadmapResourceFile(
  {
    id,
    file: upload,
    title: rawTitle,
    ...participant
  }: RoadmapParticipant & { id: string; file: unknown; title: unknown },
  changePort: RoadmapChangePort,
) {
  const file = requireUploadedFile(upload);
  const resourceId = requireUuid(id, 'resourceId');
  const title = requireString(rawTitle ?? file.name, 'title', 240);
  await roadmapRead(participant, 'edit', async () => undefined);
  const fileKey = crypto.randomUUID();
  const { resource, replacedFileKey } = await withStoredFiles(
    'replace Resource file',
    async (files) => {
      await files.upload(fileKey, file);
      return resourceFileReplacement(
        {
          ...participant,
          resourceId,
          title,
          fileKey,
          fileContentType: uploadedContentType(file),
          fileSize: file.size,
        },
        changePort,
      );
    },
  );
  if (replacedFileKey) await cleanupStoredFiles('replace Resource file', [replacedFileKey]);
  return { resource };
}

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

export async function removeRoadmapResource(
  request: Parameters<typeof resourceRemoval>[0],
  changePort: RoadmapChangePort,
) {
  const fileKey = await resourceRemoval(request, changePort);
  if (fileKey) await cleanupStoredFiles('remove Resource', [fileKey]);
  return {};
}
