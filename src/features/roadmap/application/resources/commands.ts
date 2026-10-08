import type { RoadmapChangePort } from '../change-port';
import { roadmapChangeTransaction } from '../change-transaction';
import 'server-only';
import { resourceContentState } from '@/shared/server/resource-content-state';

import { captureAccessSnapshot } from '../access-snapshot';
import { type Prisma } from '@/shared/server/db';
import {
  requireResourceType,
  requireString,
  requireUrl,
  resourceDto,
} from '@/features/roadmap/application/roadmap';
import {
  requireEditorRoadmap,
  requireNode,
  requireResource,
  type EditorInput,
} from '@/features/roadmap/application/editor-access';
import {
  deleteUploadedFile,
  saveUploadedFile,
  validateUploadedFile,
} from '@/features/roadmap/infrastructure/resources/filesystem';
import { fileResourceUrl } from '@/features/roadmap/domain/resource';
import { requireUuid } from '@/shared/validation';
import { ApplicationError, applicationResult } from '@/shared/errors/server';

type JsonObject = Record<string, unknown>;
type ResourceInput = EditorInput & { id: string };

type UploadedResourceInput = ResourceInput & {
  file: unknown;
};

async function captureResourceKnowledge(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  actorId: string,
  resource: { id: string; roadmapNodeId: string },
  previous: Parameters<typeof resourceContentState>[0] | null,
) {
  const access = await captureAccessSnapshot(transaction, roadmapId);
  const recipients = access.participants.filter(
    ({ userId }) =>
      userId !== actorId && access.accessibleByUser.get(userId)?.has(resource.roadmapNodeId),
  );
  if (recipients.length)
    await transaction.resourceNoticeKnowledge.createMany({
      data: recipients.map(({ userId }) => ({
        recipientId: userId,
        resourceId: resource.id,
        nodeId: resource.roadmapNodeId,
        knownState: previous ? JSON.stringify(resourceContentState(previous)) : null,
      })),
      skipDuplicates: true,
    });
}

async function createRoadmapResourceUnsafe(
  { id, input, ...editor }: ResourceInput & { input: JsonObject },
  changePort: RoadmapChangePort,
) {
  return roadmapChangeTransaction(changePort, async (transaction, report) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
    const title = requireString(input.title, 'title', 240);
    const url = requireUrl(input.url);
    const type = requireResourceType(input.type);
    const resource = await transaction.resource.create({
      data: { roadmapNodeId: node.id, title, url, type },
    });
    await captureResourceKnowledge(transaction, roadmap.id, editor.userId, resource, null);
    await report({
      actorId: editor.userId,
      identifier: editor.identifier,
      roadmapId: roadmap.id,
      facts: [
        {
          kind: 'resource',
          nodeId: node.id,
          resourceId: resource.id,
          previous: null,
          current: resourceContentState(resource),
        },
      ],
    });
    return resourceDto(resource, editor.identifier);
  });
}

function uploadedFileError(error: unknown): never {
  if (error instanceof Error && error.message === 'EMPTY_FILE') {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'El archivo seleccionado está vacío.');
  }
  if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'El archivo no puede superar los 25 MB.');
  }
  throw error;
}

async function uploadRoadmapResourceUnsafe(
  { file, id, ...editor }: UploadedResourceInput,
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
    return await roadmapChangeTransaction(changePort, async (transaction, report) => {
      const roadmap = await requireEditorRoadmap(transaction, editor);
      const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
      const resource = await transaction.resource.create({
        data: {
          roadmapNodeId: node.id,
          title: requireString(file.name, 'title', 240),
          url: fileResourceUrl(requireUuid(fileKey, 'fileKey')),
          type: 'FILE',
          fileKey,
          fileContentType: file.type || null,
        },
      });
      await captureResourceKnowledge(transaction, roadmap.id, editor.userId, resource, null);
      await report({
        actorId: editor.userId,
        identifier: editor.identifier,
        roadmapId: roadmap.id,
        facts: [
          {
            kind: 'resource',
            nodeId: node.id,
            resourceId: resource.id,
            previous: null,
            current: resourceContentState(resource),
          },
        ],
      });
      return resourceDto(resource, editor.identifier);
    });
  } catch (error) {
    await deleteUploadedFile(fileKey);
    throw error;
  }
}

async function updateRoadmapResourceUnsafe(
  { id, input, ...editor }: ResourceInput & { input: JsonObject },
  changePort: RoadmapChangePort,
) {
  return roadmapChangeTransaction(changePort, async (transaction, report) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const resource = await requireResource(transaction, requireUuid(id, 'resourceId'), roadmap.id);
    const data: { title?: string; url?: string; type?: 'FILE' | 'LINK' | 'VIDEO' } = {};
    if ('title' in input) data.title = requireString(input.title, 'title', 240);
    if ('url' in input) data.url = requireUrl(input.url);
    if ('type' in input) data.type = requireResourceType(input.type);
    if (Object.keys(data).length === 0)
      throw new ApplicationError(
        400,
        'INVALID_REQUEST',
        'Debe indicar al menos un campo para actualizar.',
      );
    const changed = Object.entries(data).some(
      ([field, value]) => resource[field as 'title' | 'url' | 'type'] !== value,
    );
    if (changed)
      await captureResourceKnowledge(transaction, roadmap.id, editor.userId, resource, resource);
    const updated = changed
      ? await transaction.resource.update({ where: { id: resource.id }, data })
      : resource;
    if (changed)
      await report({
        actorId: editor.userId,
        identifier: editor.identifier,
        roadmapId: roadmap.id,
        facts: [
          {
            kind: 'resource',
            nodeId: resource.roadmapNodeId,
            resourceId: resource.id,
            previous: resourceContentState(resource),
            current: resourceContentState(updated),
          },
        ],
      });
    return { resource: resourceDto(updated, editor.identifier) };
  });
}

async function removeRoadmapResourceUnsafe(
  { id, ...editor }: ResourceInput,
  changePort: RoadmapChangePort,
) {
  const deleted = await roadmapChangeTransaction(changePort, async (transaction, report) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const resource = await requireResource(transaction, requireUuid(id, 'resourceId'), roadmap.id);
    await captureResourceKnowledge(transaction, roadmap.id, editor.userId, resource, resource);
    await transaction.resource.delete({ where: { id: resource.id } });
    await report({
      actorId: editor.userId,
      identifier: editor.identifier,
      roadmapId: roadmap.id,
      facts: [
        {
          kind: 'resource',
          nodeId: resource.roadmapNodeId,
          resourceId: resource.id,
          previous: resourceContentState(resource),
          current: null,
        },
      ],
    });
    return { fileKey: resource.fileKey };
  });
  if (deleted.fileKey) await deleteUploadedFile(deleted.fileKey).catch(() => undefined);
  return {};
}

export function createRoadmapResource(
  input: ResourceInput & { input: JsonObject },
  changePort: RoadmapChangePort,
) {
  return applicationResult(() => createRoadmapResourceUnsafe(input, changePort));
}

export function uploadRoadmapResource(input: UploadedResourceInput, changePort: RoadmapChangePort) {
  return applicationResult(() => uploadRoadmapResourceUnsafe(input, changePort));
}

export function updateRoadmapResource(
  input: ResourceInput & { input: JsonObject },
  changePort: RoadmapChangePort,
) {
  return applicationResult(() => updateRoadmapResourceUnsafe(input, changePort));
}

export function removeRoadmapResource(input: ResourceInput, changePort: RoadmapChangePort) {
  return applicationResult(() => removeRoadmapResourceUnsafe(input, changePort));
}
