import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { describe, expect } from 'vitest';
import { prisma } from '@/shared/server/db';
import { noticesPort } from '@/app/_adapters/notice-change-port';
import {
  createRoadmapDependency,
  deleteRoadmapDependency,
  deleteRoadmapDependencies,
  previewRoadmapDependency,
  type RoadmapChangePort,
} from '@/features/roadmap/server';
import { teacher, test, type IntegrationCourse } from './fixtures';
import { enrollStudents } from './roadmap';

const LAYERS = 10;
const NODES_PER_LAYER = 10;
const ROUNDS = 5;
const BATCH = 5;

type Scenario = Readonly<{
  sourceNodeId: string;
  targetNodeId: string;
  batchTargetNodeIds: readonly string[];
  studentIds: readonly string[];
}>;

async function layeredRoadmap(course: IntegrationCourse, students: number): Promise<Scenario> {
  const layers = Array.from({ length: LAYERS }, () =>
    Array.from({ length: NODES_PER_LAYER }, () => randomUUID()),
  );
  const sourceNodeId = randomUUID();
  await prisma.roadmapNode.createMany({
    data: [
      ...layers.flatMap((layer, depth) =>
        layer.map((id, position) => ({
          id,
          roadmapId: course.roadmapId,
          nodeTypeId: course.nodeTypeId,
          title: `Tema ${depth}.${position}`,
          positionX: depth * 300,
          positionY: position * 120,
        })),
      ),
      {
        id: sourceNodeId,
        roadmapId: course.roadmapId,
        nodeTypeId: course.nodeTypeId,
        title: 'Diagnóstico',
        positionX: -300,
        positionY: 0,
      },
    ],
  });
  await prisma.dependency.createMany({
    data: layers
      .slice(1)
      .flatMap((layer, index) =>
        layer.flatMap((targetNodeId, position) => [
          { sourceNodeId: layers[index][position], targetNodeId },
          ...(position > 0 && position < 8
            ? [{ sourceNodeId: layers[index][position - 1], targetNodeId }]
            : []),
        ]),
      ),
  });
  const studentIds = [
    course.studentId,
    course.classmateId,
    ...(await enrollStudents(course, students - 2)),
  ];
  await prisma.completion.createMany({
    data: studentIds.flatMap((userId, index) => {
      const completedLayers = 4 + (index % 7);
      const completed = layers.slice(0, completedLayers).flat();
      const partial =
        index % 2 === 0 && completedLayers < LAYERS ? [layers[completedLayers][0]] : [];
      return [...completed, ...partial].map((roadmapNodeId) => ({ userId, roadmapNodeId }));
    }),
  });
  return {
    sourceNodeId,
    targetNodeId: layers[1][0],
    batchTargetNodeIds: layers[1].slice(0, BATCH),
    studentIds,
  };
}

function countingQueries() {
  let queries = 0;
  const query = pg.Client.prototype.query;
  pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
    queries += 1;
    return (query as (...values: unknown[]) => unknown).apply(this, args);
  } as typeof query;
  return {
    take: () => {
      const taken = queries;
      queries = 0;
      return taken;
    },
    restore: () => {
      pg.Client.prototype.query = query;
    },
  };
}

async function measured<T>(counter: ReturnType<typeof countingQueries>, run: () => Promise<T>) {
  counter.take();
  const started = performance.now();
  const result = await run();
  return { result, ms: performance.now() - started, queries: counter.take() };
}

function median(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

describe.skipIf(!process.env.DEPENDENCY_EDIT_BENCHMARK)('dependency edit benchmark', () => {
  test.for([20, 200])(
    'creates and deletes a blocking Dependency with %i students',
    { timeout: 600_000 },
    async (students, { course }) => {
      const scenario = await layeredRoadmap(course, students);
      const scheduled: (() => Promise<void>)[] = [];
      const notices = noticesPort((task) => {
        scheduled.push(task);
      });
      const accessFacts: number[] = [];
      const port: RoadmapChangePort = {
        report(transaction, changes) {
          accessFacts.push(changes.facts.filter(({ kind }) => kind === 'node-access').length);
          return notices.report(transaction, changes);
        },
      };
      const editor = teacher(course);
      const request = {
        ...editor,
        input: { sourceNodeId: scenario.sourceNodeId, targetNodeId: scenario.targetNodeId },
      };
      const counter = countingQueries();
      const rounds: {
        create: number[];
        createQueries: number[];
        remove: number[];
        removeQueries: number[];
      } = { create: [], createQueries: [], remove: [], removeQueries: [] };
      try {
        for (let round = 0; round < ROUNDS; round += 1) {
          const { version } = await previewRoadmapDependency(request);
          const created = await measured(counter, () =>
            createRoadmapDependency({ ...request, previewVersion: version }, port),
          );
          rounds.create.push(created.ms);
          rounds.createQueries.push(created.queries);
          await Promise.all(scheduled.splice(0).map((task) => task()));
          const removed = await measured(counter, () =>
            deleteRoadmapDependency({ ...editor, id: created.result.dependency.id }, port),
          );
          rounds.remove.push(removed.ms);
          rounds.removeQueries.push(removed.queries);
          await Promise.all(scheduled.splice(0).map((task) => task()));
        }
      } finally {
        counter.restore();
      }
      expect(Math.min(...accessFacts)).toBeGreaterThanOrEqual(students * 5);
      await appendFile(
        process.env.DEPENDENCY_EDIT_BENCHMARK!,
        `${JSON.stringify({
          students: scenario.studentIds.length,
          createMs: Math.round(median(rounds.create)),
          createQueries: median(rounds.createQueries),
          deleteMs: Math.round(median(rounds.remove)),
          deleteQueries: median(rounds.removeQueries),
          accessFacts: median(accessFacts),
          rounds,
        })}\n`,
      );
    },
  );

  test.for([20, 200])(
    'deletes five blocking Dependencies with %i students',
    { timeout: 600_000 },
    async (students, { course }) => {
      const scenario = await layeredRoadmap(course, students);
      const scheduled: (() => Promise<void>)[] = [];
      const port = noticesPort((task) => {
        scheduled.push(task);
      });
      const editor = teacher(course);
      const connectAll = async () => {
        const ids: string[] = [];
        for (const targetNodeId of scenario.batchTargetNodeIds) {
          const request = {
            ...editor,
            input: { sourceNodeId: scenario.sourceNodeId, targetNodeId },
          };
          const { version } = await previewRoadmapDependency(request);
          ids.push(
            (await createRoadmapDependency({ ...request, previewVersion: version }, port))
              .dependency.id,
          );
        }
        await Promise.all(scheduled.splice(0).map((task) => task()));
        return ids;
      };
      const counter = countingQueries();
      const rounds = {
        each: [] as number[],
        eachQueries: [] as number[],
        together: [] as number[],
        togetherQueries: [] as number[],
      };
      try {
        for (let round = 0; round < ROUNDS; round += 1) {
          const separate = await connectAll();
          const each = await measured(counter, () =>
            Promise.all(separate.map((id) => deleteRoadmapDependency({ ...editor, id }, port))),
          );
          rounds.each.push(each.ms);
          rounds.eachQueries.push(each.queries);
          await Promise.all(scheduled.splice(0).map((task) => task()));
          const joined = await connectAll();
          const together = await measured(counter, () =>
            deleteRoadmapDependencies({ ...editor, input: { dependencyIds: joined } }, port),
          );
          rounds.together.push(together.ms);
          rounds.togetherQueries.push(together.queries);
          await Promise.all(scheduled.splice(0).map((task) => task()));
        }
      } finally {
        counter.restore();
      }
      expect(
        await prisma.dependency.count({ where: { sourceNodeId: scenario.sourceNodeId } }),
      ).toBe(0);
      await appendFile(
        process.env.DEPENDENCY_EDIT_BENCHMARK!,
        `${JSON.stringify({
          students: scenario.studentIds.length,
          deleteEachMs: Math.round(median(rounds.each)),
          deleteEachQueries: median(rounds.eachQueries),
          deleteTogetherMs: Math.round(median(rounds.together)),
          deleteTogetherQueries: median(rounds.togetherQueries),
          rounds,
        })}\n`,
      );
    },
  );
});
