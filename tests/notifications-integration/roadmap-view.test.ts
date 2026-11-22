import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { prisma, type Prisma } from '@/shared/server/db';
import { roadmapView } from '@/features/notifications/infrastructure/notice-lifecycle';
import { test, type IntegrationCourse } from './fixtures';
import { addNode, addType } from './roadmap';

function addResource(nodeId: string, title: string) {
  return prisma.resource.create({
    data: { roadmapNodeId: nodeId, title, url: `https://example.test/${title}`, type: 'LINK' },
  });
}

async function lookups(course: IntegrationCourse, preload: boolean, ids: Ids) {
  return prisma.$transaction(async (transaction) => {
    const view = roadmapView(transaction, course.roadmapId);
    if (preload) await view.preload();
    return {
      nodes: await Promise.all(ids.nodes.map((id) => view.node(id))),
      resources: await Promise.all(ids.resources.map((id) => view.resource(id))),
      nodeResources: await Promise.all(ids.nodes.map((id) => view.nodeResources(id))),
      dependencies: await Promise.all(
        ids.nodes.flatMap((source) => ids.nodes.map((target) => view.dependency(source, target))),
      ),
      nodeTypes: await Promise.all(ids.nodeTypes.map((id) => view.nodeType(id))),
    };
  });
}

type Ids = { nodes: string[]; resources: string[]; nodeTypes: string[] };

test('a preloaded Roadmap view answers every lookup as the database does', async ({
  course,
  otherCourse,
}) => {
  const first = course.change.nodeId;
  const hidden = await addNode(course, 'Pilas', { isVisible: false });
  const last = await addNode(course, 'Colas');
  const unused = await addType(course, 'Proyecto');
  await prisma.dependency.createMany({
    data: [
      { sourceNodeId: first, targetNodeId: hidden.id },
      { sourceNodeId: hidden.id, targetNodeId: last.id },
    ],
  });
  const later = await addResource(first, 'segunda');
  const earlier = await addResource(first, 'primera');
  await prisma.resource.update({
    where: { id: earlier.id },
    data: { createdAt: new Date(later.createdAt.getTime() - 1000) },
  });
  const onLast = await addResource(last.id, 'tercera');
  const foreignNode = otherCourse.change.nodeId;
  const foreignResource = await addResource(foreignNode, 'ajena');
  await prisma.dependency.create({
    data: {
      sourceNodeId: foreignNode,
      targetNodeId: (await addNode(otherCourse, 'Ajeno')).id,
    },
  });
  const ids = {
    nodes: [first, hidden.id, last.id, foreignNode, randomUUID()],
    resources: [earlier.id, later.id, onLast.id, foreignResource.id, randomUUID()],
    nodeTypes: [course.nodeTypeId, unused.id, otherCourse.nodeTypeId, randomUUID()],
  };

  const fromDatabase = await lookups(course, false, ids);
  const preloaded = await lookups(course, true, ids);

  expect(preloaded).toEqual(fromDatabase);
  expect(fromDatabase.nodeResources[0].map(({ id }) => id)).toEqual([earlier.id, later.id]);
  expect(fromDatabase.dependencies.filter(Boolean)).toHaveLength(2);
  expect(fromDatabase.nodes.map((node) => node?.id ?? null)).toEqual([
    first,
    hidden.id,
    last.id,
    null,
    null,
  ]);
  expect(fromDatabase.nodeTypes.map((type) => type?.hasVisibleNode ?? null)).toEqual([
    true,
    false,
    null,
    null,
  ]);
});

function recordingQueries(transaction: Prisma.TransactionClient, queries: string[]) {
  return new Proxy(transaction, {
    get(client, model) {
      const delegate: unknown = Reflect.get(client, model);
      if (!delegate || typeof delegate !== 'object') return delegate;
      return new Proxy(delegate, {
        get(target, operation) {
          const query: unknown = Reflect.get(target, operation);
          if (typeof query !== 'function') return query;
          return (...args: unknown[]) => {
            queries.push(`${String(model)}.${String(operation)}`);
            return query.apply(target, args);
          };
        },
      });
    },
  });
}

test('a Roadmap view reads single rows until preloaded and then answers from memory', async ({
  course,
}) => {
  const nodeId = course.change.nodeId;
  const resource = await addResource(nodeId, 'guía');
  const queries: string[] = [];
  await prisma.$transaction(async (transaction) => {
    const view = roadmapView(recordingQueries(transaction, queries), course.roadmapId);
    const everyLookup = () =>
      Promise.all(
        [1, 2].flatMap(() => [
          view.node(nodeId),
          view.resource(resource.id),
          view.nodeResources(nodeId),
          view.nodeType(course.nodeTypeId),
          view.dependency(nodeId, nodeId),
        ]),
      );
    await everyLookup();
    expect(queries.toSorted()).toEqual([
      'dependency.findFirst',
      'dependency.findFirst',
      'nodeType.findFirst',
      'resource.findFirst',
      'resource.findMany',
      'roadmapNode.findFirst',
    ]);
    await view.preload();
    queries.length = 0;
    await everyLookup();
    expect(queries).toEqual([]);
  });
});
