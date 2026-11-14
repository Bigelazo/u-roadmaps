import { expect } from 'vitest';
import { prisma, type Prisma } from '@/shared/server/db';
import { recordRoadmapNotices } from '@/features/notifications/server';
import type { RoadmapChangePort } from '@/features/roadmap/server';
import { test, type IntegrationCourse } from './fixtures';
import { addNode, enrollStudents, pendingNotices, teacherEdits } from './roadmap';

function countedQueries(transaction: Prisma.TransactionClient, count: () => void) {
  const counted =
    <A extends unknown[], R>(query: (...args: A) => R, self: object) =>
    (...args: A) => {
      count();
      return query.apply(self, args);
    };
  return new Proxy(transaction, {
    get(client, property) {
      const value: unknown = Reflect.get(client, property);
      if (typeof value === 'function') return counted(value as () => unknown, client);
      if (!value || typeof value !== 'object') return value;
      return new Proxy(value, {
        get(model, operation) {
          const query: unknown = Reflect.get(model, operation);
          return typeof query === 'function' ? counted(query as () => unknown, model) : query;
        },
      });
    },
  });
}

async function recordingQueries(
  edit: (port: RoadmapChangePort) => Promise<unknown>,
  afterRecording: (
    transaction: Prisma.TransactionClient,
    attempt: number,
  ) => Promise<void> = async () => {},
) {
  const attempts: number[] = [];
  const delivered: number[] = [];
  await edit({
    async report(transaction, changes) {
      let queries = 0;
      const delivery = await recordRoadmapNotices(
        countedQueries(transaction, () => queries++),
        changes,
      );
      attempts.push(queries);
      const attempt = attempts.length;
      await afterRecording(transaction, attempt);
      return (
        delivery &&
        (async () => {
          delivered.push(attempt);
          await delivery((persist) => persist());
        })
      );
    },
  });
  return { attempts, delivered };
}

const changes = {
  description: (port: RoadmapChangePort, course: IntegrationCourse) =>
    teacherEdits(course, port).update(course.change.nodeId, { description: 'Funciones' }),
  Resource: (port: RoadmapChangePort, course: IntegrationCourse) =>
    teacherEdits(course, port).addResource(course.change.nodeId, 'Guía 3'),
};

test.for(Object.entries(changes))(
  'a %s change reads the Node access of the whole roster at once',
  async ([, change], { course, otherCourse }) => {
    const [newcomer] = await enrollStudents(otherCourse, 40);
    const small = await recordingQueries((port) => change(port, course));
    const large = await recordingQueries((port) => change(port, otherCourse));
    expect(small.attempts.length).toBeGreaterThan(0);
    expect(large.attempts.length).toBeGreaterThan(0);
    expect([...small.attempts, ...large.attempts]).toEqual(
      Array(small.attempts.length + large.attempts.length).fill(small.attempts[0]),
    );
    expect(await pendingNotices(newcomer, otherCourse.roadmapId)).toHaveLength(1);
  },
);

test('recording measures each retry separately and delivers only the committed attempt', async ({
  course,
  otherCourse,
}) => {
  const baseline = await recordingQueries((port) => changes.description(port, otherCourse));
  const retried = await recordingQueries(
    (port) => changes.description(port, course),
    async (transaction, attempt) => {
      if (attempt !== 1) return;
      await transaction.course.findUniqueOrThrow({ where: { code: course.identifier.courseCode } });
      await prisma.course.update({
        where: { code: course.identifier.courseCode },
        data: { name: 'Concurrent edit' },
      });
      await transaction.course.update({
        where: { code: course.identifier.courseCode },
        data: { name: 'Retried edit' },
      });
    },
  );
  expect(retried.attempts.length).toBeGreaterThanOrEqual(2);
  expect(retried.attempts).toEqual(Array(retried.attempts.length).fill(baseline.attempts[0]));
  expect(retried.delivered).toEqual([retried.attempts.length]);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toHaveLength(1);
});

test('a blocking Dependency records the Node access of the whole roster at once', async ({
  course,
  otherCourse,
}) => {
  await enrollStudents(otherCourse, 40);
  const blocking = async (port: RoadmapChangePort, blocked: IntegrationCourse) => {
    const prerequisite = await addNode(blocked, 'Diagnóstico');
    const target = await addNode(blocked, 'Listas');
    return teacherEdits(blocked, port).connect(prerequisite.id, target.id);
  };
  const small = await recordingQueries((port) => blocking(port, course));
  const large = await recordingQueries((port) => blocking(port, otherCourse));
  expect(small.attempts).toHaveLength(1);
  expect(large.attempts).toEqual(small.attempts);
});
