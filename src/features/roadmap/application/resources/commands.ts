import 'server-only';

import { prisma } from '@/shared/server/db';
import {
  ApiError,
  apiResult,
  requireResourceType,
  requireString,
  requireUrl,
  requireUuid,
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

type JsonObject = Record<string, unknown>;
type ResourceInput = EditorInput & { id: string };

type UploadedResourceInput = ResourceInput & {
  file: unknown;
};

async function createRoadmapResourceUnsafe({
  id,
  input,
  ...editor
}: ResourceInput & { input: JsonObject }) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
    const title = requireString(input.title, 'title', 240);
    const url = requireUrl(input.url);
    const type = requireResourceType(input.type);
    return resourceDto(
      await transaction.resource.create({ data: { roadmapNodeId: node.id, title, url, type } }),
      editor.identifier,
    );
  });
}

function uploadedFileError(error: unknown): never {
  if (error instanceof Error && error.message === 'EMPTY_FILE') {
    throw new ApiError(400, 'INVALID_REQUEST', 'El archivo seleccionado está vacío.');
  }
  if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
    throw new ApiError(400, 'INVALID_REQUEST', 'El archivo no puede superar los 25 MB.');
  }
  throw error;
}

async function uploadRoadmapResourceUnsafe({ file, id, ...editor }: UploadedResourceInput) {
  if (!(file instanceof File)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Debes seleccionar un archivo para subir.');
  }
  try {
    validateUploadedFile(file);
  } catch (error) {
    uploadedFileError(error);
  }
  const fileKey = crypto.randomUUID();
  await saveUploadedFile(fileKey, file);
  try {
    return await prisma.$transaction(async (transaction) => {
      const roadmap = await requireEditorRoadmap(transaction, editor);
      const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
      const resource = await transaction.resource.create({
        data: {
          roadmapNodeId: node.id,
          title: requireString(file.name, 'title', 240),
          url: `https://files.u-roadmaps.invalid/${requireUuid(fileKey, 'fileKey')}`,
          type: 'FILE',
          fileKey,
          fileContentType: file.type || null,
        },
      });
      return resourceDto(resource, editor.identifier);
    });
  } catch (error) {
    await deleteUploadedFile(fileKey);
    throw error;
  }
}

async function updateRoadmapResourceUnsafe({
  id,
  input,
  ...editor
}: ResourceInput & { input: JsonObject }) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const resource = await requireResource(transaction, requireUuid(id, 'resourceId'), roadmap.id);
    const data: { title?: string; url?: string; type?: 'FILE' | 'LINK' | 'VIDEO' } = {};
    if ('title' in input) data.title = requireString(input.title, 'title', 240);
    if ('url' in input) data.url = requireUrl(input.url);
    if ('type' in input) data.type = requireResourceType(input.type);
    if (Object.keys(data).length === 0)
      throw new ApiError(400, 'INVALID_REQUEST', 'Debe indicar al menos un campo para actualizar.');
    return resourceDto(
      await transaction.resource.update({ where: { id: resource.id }, data }),
      editor.identifier,
    );
  });
}

async function removeRoadmapResourceUnsafe({ id, ...editor }: ResourceInput) {
  const fileKey = await prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const resource = await requireResource(transaction, requireUuid(id, 'resourceId'), roadmap.id);
    await transaction.resource.delete({ where: { id: resource.id } });
    return resource.fileKey;
  });
  if (fileKey) await deleteUploadedFile(fileKey).catch(() => undefined);
}

export function createRoadmapResource(input: ResourceInput & { input: JsonObject }) {
  return apiResult(() => createRoadmapResourceUnsafe(input));
}

export function uploadRoadmapResource(input: UploadedResourceInput) {
  return apiResult(() => uploadRoadmapResourceUnsafe(input));
}

export function updateRoadmapResource(input: ResourceInput & { input: JsonObject }) {
  return apiResult(() => updateRoadmapResourceUnsafe(input));
}

export function removeRoadmapResource(input: ResourceInput) {
  return apiResult(() => removeRoadmapResourceUnsafe(input));
}
