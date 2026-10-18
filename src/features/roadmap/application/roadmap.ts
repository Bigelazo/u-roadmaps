import type { RoadmapChangePort } from './change-port';
import { roadmapChangeTransaction } from './roadmap-command';
import { roadmapClosed } from './errors';
import 'server-only';

import { randomUUID } from 'node:crypto';
import { isPastRoadmapClosure } from '../domain/closure';
import {
  planRoadmapCopy,
  resourcesWithStoredFiles,
  type RoadmapCopySource,
} from '../domain/roadmap-copy';
import type { VersionIdentifier } from '@/shared/version-history-url';
import {
  copyUploadedFile,
  deleteUploadedFile,
} from '@/features/roadmap/infrastructure/resources/filesystem';

import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import type { NodeTypeIconId } from '@/features/roadmap/node-type-appearance';
import { requireString } from './validation';
import { Prisma, prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';

type JsonObject = Record<string, unknown>;

export function resourceDownloadUrl(identifier: CourseOfferingIdentifier, resourceId: string) {
  return `/api/${encodeURIComponent(identifier.courseCode)}/${identifier.year}/${identifier.semester}/roadmap/resources/${resourceId}/file`;
}

export function resourceDto(
  resource: {
    id: string;
    title: string;
    url: string;
    type: 'FILE' | 'LINK';
    fileKey?: string | null;
  },
  identifier?: CourseOfferingIdentifier,
) {
  return {
    id: resource.id,
    title: resource.title,
    url:
      resource.fileKey && identifier ? resourceDownloadUrl(identifier, resource.id) : resource.url,
    type: resource.type,
  };
}

export function nodeDto(node: {
  id: string;
  title: string;
  description: string | null;
  positionX: number;
  positionY: number;
  nodeTypeId: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
  teacherUnlockOn?: Date | null;
}) {
  return {
    id: node.id,
    title: node.title,
    description: node.description,
    positionX: node.positionX,
    positionY: node.positionY,
    nodeTypeId: node.nodeTypeId,
    isVisible: node.isVisible,
    isTeacherBlocked: node.isTeacherBlocked,
    ...(node.teacherUnlockOn
      ? { teacherUnlockOn: node.teacherUnlockOn.toISOString().slice(0, 10) }
      : {}),
  };
}

export async function getAvailableTypes(
  roadmapId: string,
  client: Prisma.TransactionClient = prisma,
) {
  const [predefined, custom] = await Promise.all([
    client.nodeType.findMany({ where: { isPredefined: true }, orderBy: { name: 'asc' } }),
    client.nodeType.findMany({ where: { roadmapId }, orderBy: { name: 'asc' } }),
  ]);
  return [...predefined, ...custom].map(nodeTypeDto);
}

export function nodeTypeDto(nodeType: {
  id: string;
  name: string;
  icon: string;
  color: string;
  isPredefined: boolean;
}) {
  return {
    id: nodeType.id,
    name: nodeType.name,
    icon: nodeType.icon as NodeTypeIconId,
    color: nodeType.color,
    isPredefined: nodeType.isPredefined,
  };
}

/**
 * The optional frozen version to copy, identified by its Academic term as
 * `{ year, semester }`. A `courseCode` defaults to the target's own Course.
 */
function parseCopySource(
  value: unknown,
  identifier: CourseOfferingIdentifier,
): VersionIdentifier | undefined {
  if (value === undefined || value === null) return undefined;
  const source = value as JsonObject;
  if (
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (source.courseCode !== undefined && typeof source.courseCode !== 'string') ||
    !Number.isInteger(source.year) ||
    !Number.isInteger(source.semester)
  )
    throw new ApplicationError(
      400,
      'INVALID_REQUEST',
      'source debe identificar una versión con year y semester.',
    );
  return {
    courseCode:
      typeof source.courseCode === 'string' ? source.courseCode.trim() : identifier.courseCode,
    year: source.year as number,
    semester: source.semester as number,
  };
}

/** Stored files duplicated for a creation, removable if that creation fails. */
function fileCopyLedger() {
  const copied: string[] = [];
  return {
    /**
     * Duplicates every file's bytes and returns the keys stored; a source file
     * missing from storage is skipped. Waits for every copy before failing, so
     * no copy finishes after a rollback.
     */
    async copyAll(copies: readonly { sourceFileKey: string; fileKey: string }[]) {
      // Fresh keys are only ever ours, and a failed copy can leave partial bytes.
      copied.push(...copies.map(({ fileKey }) => fileKey));
      const results = await Promise.allSettled(
        copies.map(({ sourceFileKey, fileKey }) => copyUploadedFile(sourceFileKey, fileKey)),
      );
      const failure = results.find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;
      return new Set(
        copies
          .filter((_, index) => (results[index] as PromiseFulfilledResult<boolean>).value)
          .map(({ fileKey }) => fileKey),
      );
    },
    rollback() {
      return Promise.all(
        copied.map((fileKey) =>
          deleteUploadedFile(fileKey).catch((error) =>
            console.warn('Copied file cleanup failed', { fileKey, error }),
          ),
        ),
      );
    },
  };
}
type FileCopyLedger = ReturnType<typeof fileCopyLedger>;

/**
 * Writes a frozen version's content into the new Roadmap, recording it as the source.
 * File bytes are duplicated first; a file missing from storage omits its Resource.
 */
async function persistRoadmapCopy(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  sourceVersion: { roadmapId: string; year: number; semester: number },
  source: RoadmapCopySource,
  files: FileCopyLedger,
) {
  const plan = planRoadmapCopy(source, roadmapId, randomUUID);
  const storedFileKeys = await files.copyAll(plan.fileCopies);
  await transaction.roadmap.update({
    where: { id: roadmapId },
    data: {
      sourceRoadmapId: sourceVersion.roadmapId,
      sourceYear: sourceVersion.year,
      sourceSemester: sourceVersion.semester,
    },
  });
  await transaction.nodeType.createMany({ data: plan.nodeTypes });
  await transaction.roadmapNode.createMany({ data: plan.nodes });
  await transaction.dependency.createMany({ data: plan.dependencies });
  await transaction.resource.createMany({
    data: resourcesWithStoredFiles(plan.resources, storedFileKeys),
  });
}

/** Copies a frozen version of the same Course into the new Roadmap. */
async function copyFrozenVersion(
  transaction: Prisma.TransactionClient,
  identifier: CourseOfferingIdentifier,
  source: VersionIdentifier,
  roadmapId: string,
  files: FileCopyLedger,
) {
  const missing = new ApplicationError(
    404,
    'VERSION_NOT_FOUND',
    'La versión solicitada no existe.',
  );
  if (source.courseCode !== identifier.courseCode) throw missing;
  const sourceRoadmap = await transaction.roadmap.findFirst({
    where: { courseOffering: source },
    select: {
      id: true,
      closedAt: true,
      nodeTypes: { select: { id: true, name: true, icon: true, color: true } },
      roadmapNodes: {
        select: {
          id: true,
          nodeTypeId: true,
          title: true,
          description: true,
          positionX: true,
          positionY: true,
          isVisible: true,
          resources: {
            select: {
              roadmapNodeId: true,
              title: true,
              url: true,
              type: true,
              fileKey: true,
              fileContentType: true,
            },
          },
        },
      },
    },
  });
  if (!sourceRoadmap) throw missing;
  if (!sourceRoadmap.closedAt)
    throw new ApplicationError(
      409,
      'VERSION_NOT_CLOSED',
      'Solo se puede copiar una versión cerrada.',
    );
  const dependencies = await transaction.dependency.findMany({
    where: { sourceNode: { roadmapId: sourceRoadmap.id } },
    select: { sourceNodeId: true, targetNodeId: true, sourceHandle: true, targetHandle: true },
  });
  await persistRoadmapCopy(
    transaction,
    roadmapId,
    { roadmapId: sourceRoadmap.id, year: source.year, semester: source.semester },
    {
      customNodeTypes: sourceRoadmap.nodeTypes,
      nodes: sourceRoadmap.roadmapNodes,
      dependencies,
      resources: sourceRoadmap.roadmapNodes.flatMap(({ resources }) => resources),
    },
    files,
  );
}

// Copying file bytes inside the transaction can outlast Prisma's 5 s default.
// Not serializable: copying files is not retry-safe.
const copyTransactionOptions = { isolation: 'read-committed', timeout: 30_000 } as const;

const roadmapConflict = () =>
  new ApplicationError(409, 'ROADMAP_CONFLICT', 'Ya existe un roadmap para este curso.');

// The course may arrive without a description when it is already materialized from
// U-Campus. In that case it keeps the registered name and department.
export async function createRoadmap(
  identifier: CourseOfferingIdentifier,
  body: JsonObject,
  actor: { id: string; name?: string },
  changePort: RoadmapChangePort,
) {
  const courseBody =
    body.course && typeof body.course === 'object' && !Array.isArray(body.course)
      ? (body.course as JsonObject)
      : undefined;
  const source = parseCopySource(body.source, identifier);
  const files = fileCopyLedger();

  return roadmapChangeTransaction(
    changePort,
    async (transaction, report) => {
      const [existingCourse, existingCourseOffering] = await Promise.all([
        transaction.course.findUnique({ where: { code: identifier.courseCode } }),
        transaction.courseOffering.findUnique({
          where: {
            courseCode_year_semester: identifier,
          },
          include: { roadmap: true },
        }),
      ]);
      if (existingCourseOffering?.roadmap) throw roadmapConflict();
      const term = await transaction.academicTerm.findUnique({
        where: { year_semester: { year: identifier.year, semester: identifier.semester } },
      });
      if (
        isPastRoadmapClosure(
          identifier,
          term?.roadmapFreezeDate.toISOString().slice(0, 10) ?? null,
          new Date(),
        )
      ) {
        throw roadmapClosed('El período de este curso terminó. No se puede crear un roadmap.');
      }
      const name =
        courseBody?.name === undefined && existingCourse
          ? existingCourse.name
          : requireString(courseBody?.name, 'name', 200);
      const department =
        courseBody?.department === undefined && existingCourse
          ? existingCourse.department
          : requireString(courseBody?.department, 'department', 200);
      const course = await transaction.course.upsert({
        where: { code: identifier.courseCode },
        update: { name, department },
        create: { code: identifier.courseCode, name, department },
      });
      const materializedCourseOffering =
        existingCourseOffering ??
        (await transaction.courseOffering.create({
          data: { courseCode: course.code, year: identifier.year, semester: identifier.semester },
        }));
      const roadmap = await transaction.roadmap.create({
        data: { courseOfferingId: materializedCourseOffering.id, creatorId: actor.id },
      });
      if (source) await copyFrozenVersion(transaction, identifier, source, roadmap.id, files);
      await report({
        actorId: actor.id,
        identifier,
        roadmapId: roadmap.id,
        facts: [
          {
            kind: 'roadmap-created',
            previous: null,
            current: {
              courseOfferingId: materializedCourseOffering.id,
              courseName: course.name,
              actorName: actor.name ?? actor.id,
              occurredAt: new Date(),
            },
          },
        ],
      });
      return { roadmap };
    },
    copyTransactionOptions,
  ).catch(async (error) => {
    // Only an uncommitted creation discards its copied bytes.
    await files.rollback();
    // A concurrent creation (double click, two tabs) committed first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw roadmapConflict();
    throw error;
  });
}
