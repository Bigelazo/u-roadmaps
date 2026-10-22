import { expect } from 'vitest';
import type { Prisma } from '@/shared/server/db';
import { recordRoadmapNotices, type NoticeDelivery } from '@/features/notifications/server';
import type { RoadmapChangePort } from '@/features/roadmap/server';
import { test, type IntegrationCourse } from './fixtures';
import { enrollStudents, pendingNotices, teacherEdits } from './roadmap';

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
  course: IntegrationCourse,
  edit: (port: RoadmapChangePort) => Promise<unknown>,
) {
  let queries = 0;
  const deliveries: NoticeDelivery[] = [];
  await edit({
    async report(transaction, changes) {
      const delivery = await recordRoadmapNotices(
        countedQueries(transaction, () => queries++),
        changes,
      );
      if (delivery) deliveries.push(delivery);
    },
  });
  for (const delivery of deliveries) await delivery((persist) => persist());
  return queries;
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
    const small = await recordingQueries(course, (port) => change(port, course));
    const large = await recordingQueries(otherCourse, (port) => change(port, otherCourse));
    expect(large).toBe(small);
    expect(await pendingNotices(newcomer, otherCourse.roadmapId)).toHaveLength(1);
  },
);
