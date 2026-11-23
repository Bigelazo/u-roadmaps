import { describe, expect } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import { prisma } from '@/shared/server/db';
import {
  addNode,
  addType,
  announceRoadmap,
  deferredNoticePort,
  enterRoadmap,
  inboxCount,
  pendingNotices,
  pendingTargets,
  summaryInInboxWords,
  teacherEdits,
} from './roadmap';
import { countOwnNodeChangeTargets, listOwnNotices } from '@/features/notifications/server';

type Edits = ReturnType<typeof teacherEdits>;

type Subject = {
  set: (value: string) => Promise<unknown>;
  nodeInput: (value: string) => Record<string, unknown>;
  notice: (known: string, current: string) => Record<string, unknown>;
};

type Target = {
  noticeTarget: string;
  values: [known: string, first: string, second: string];
  audience: 'visible' | 'accessible';
  nearlyKnown: string[];
  seed: (course: IntegrationCourse, edits: Edits, nodeId: string) => Promise<Subject>;
  creation: Record<string, unknown>;
  summary: { title: string; items: string[] }[];
};

const guideUrl = (title: string) => `https://example.test/${encodeURIComponent(title)}`;

const targets: Target[] = [
  {
    noticeTarget: 'node-title',
    values: ['Pilas', 'Pila', 'Colas'],
    audience: 'visible',
    nearlyKnown: [],
    seed: async (course, edits, nodeId) => ({
      set: (title) => edits.rename(nodeId, title),
      nodeInput: (title) => ({ title }),
      notice: (known, current) => ({
        subject: current,
        body: `«${known}» pasó a llamarse «${current}».`,
        data: {
          noticeTarget: 'node-title',
          noticeClass: 'roadmap-node-changed',
          nodeId,
          courseCode: course.identifier.courseCode,
          knownTitle: known,
          currentTitle: current,
        },
      }),
    }),
    creation: { nodeTitle: 'Colas' },
    summary: [{ title: 'Colas', items: ['Antes se llamaba «Pilas».'] }],
  },
  {
    noticeTarget: 'node-description',
    values: ['Original', 'Primera', 'Segunda'],
    audience: 'accessible',
    nearlyKnown: ['Original '],
    seed: async (_course, edits, nodeId) => ({
      set: (description) => edits.update(nodeId, { description }),
      nodeInput: (description) => ({ description }),
      notice: (known, current) => ({
        subject: 'Pilas',
        body: 'Se actualizó la descripción de «Pilas».',
        data: {
          noticeTarget: 'node-description',
          noticeClass: 'roadmap-node-changed',
          nodeId,
          nodeTitle: 'Pilas',
          knownValue: JSON.stringify(known),
          currentValue: JSON.stringify(current),
        },
      }),
    }),
    creation: {},
    summary: [{ title: 'Pilas', items: ['Se actualizó la descripción.'] }],
  },
  {
    noticeTarget: 'node-type',
    values: ['Tema', 'Lectura', 'Taller'],
    audience: 'visible',
    nearlyKnown: [],
    async seed(course, edits, nodeId) {
      const typeIds: Record<string, string> = { Tema: course.nodeTypeId };
      for (const name of ['Lectura', 'Taller'])
        typeIds[name] = (
          (await prisma.nodeType.findFirst({ where: { roadmapId: course.roadmapId, name } })) ??
          (await addType(course, name))
        ).id;
      return {
        set: (name) => edits.update(nodeId, { nodeTypeId: typeIds[name] }),
        nodeInput: (name) => ({ nodeTypeId: typeIds[name] }),
        notice: (known, current) => ({
          subject: 'Pilas',
          body: `«Pilas» pasó de tipo «${known}» a tipo «${current}».`,
          data: {
            noticeTarget: 'node-type',
            noticeClass: 'roadmap-node-changed',
            nodeId,
            knownValue: typeIds[known],
            currentValue: typeIds[current],
            knownTypeName: known,
            currentTypeName: current,
          },
        }),
      };
    },
    creation: {},
    summary: [
      { title: 'Ruta y clasificación', items: ['«Pilas» pasó de tipo «Tema» a tipo «Taller».'] },
    ],
  },
  {
    noticeTarget: 'resource',
    values: ['Guía 3', 'Guía posterior', 'Guía final'],
    audience: 'accessible',
    nearlyKnown: [],
    async seed(_course, edits, nodeId) {
      const resource = await prisma.resource.create({
        data: { roadmapNodeId: nodeId, title: 'Guía 3', url: guideUrl('Guía 3'), type: 'LINK' },
      });
      return {
        set: (title) => edits.editResource(resource.id, { title, url: guideUrl(title) }),
        nodeInput: () => ({}),
        notice: (known, current) => ({
          subject: known,
          body: `Se actualizó el recurso «${known}» en «Pilas». «${known}» ahora se llama «${current}».`,
          data: {
            noticeTarget: 'resource',
            noticeClass: 'roadmap-resource-changed',
            nodeId,
            resourceId: resource.id,
            resourceTitle: known,
            knownResource: { title: known },
            currentResource: { title: current },
          },
        }),
      };
    },
    creation: { resources: [{ title: 'Guía final' }] },
    summary: [
      {
        title: 'Pilas',
        items: ['Se actualizó el recurso «Guía 3». «Guía 3» ahora se llama «Guía final».'],
      },
    ],
  },
];

describe.each(targets)(
  '$noticeTarget',
  ({
    noticeTarget,
    values: [known, first, second],
    audience,
    nearlyKnown,
    seed,
    creation,
    summary,
  }) => {
    const seeded = async (
      course: IntegrationCourse,
      edits: Edits,
      state: { isVisible?: boolean; isTeacherBlocked?: boolean } = {},
    ) => {
      const node = await addNode(course, 'Pilas', { description: 'Original', ...state });
      return { node, ...(await seed(course, edits, node.id)) };
    };
    const ownTargets = (userId: string, course: IntegrationCourse) =>
      pendingTargets(userId, course.roadmapId, noticeTarget);

    test('edits before recognition leave one notice from the Known value; only an exact return withdraws it', async ({
      course,
    }) => {
      const { set, notice } = await seeded(course, teacherEdits(course));
      await set(first);
      const [pending] = await pendingNotices(course.studentId, course.roadmapId);
      await set(second);
      expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
        { id: pending.id, ...notice(known, second) },
      ]);
      expect(await pendingNotices(course.teacherId, course.roadmapId)).toEqual([]);
      for (const value of nearlyKnown) {
        await set(value);
        expect(await pendingNotices(course.studentId, course.roadmapId)).toHaveLength(1);
      }
      await set(known);
      expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
    });

    test('recognition rebases later edits on the recognized value', async ({ course }) => {
      const { set, notice } = await seeded(course, teacherEdits(course));
      await set(first);
      await enterRoadmap(course.studentId, course.roadmapId);
      expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
      await set(second);
      expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
        notice(first, second),
      ]);
      await set(first);
      expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
    });

    test('retried and concurrent deliveries keep one notice', async ({ course }) => {
      const deferred = deferredNoticePort();
      const { set, notice } = await seeded(course, teacherEdits(course, deferred.port));
      await set(first);
      await set(second);
      const [early, late] = deferred.deliveries;
      await Promise.all([deferred.deliver(late), deferred.deliver(early), deferred.deliver(late)]);
      await deferred.deliver(early);
      for (const recipient of [course.studentId, course.classmateId])
        expect(await pendingNotices(recipient, course.roadmapId)).toMatchObject([
          notice(known, second),
        ]);
    });

    test('the Change summary places the change', async ({ course }) => {
      const { set } = await seeded(course, teacherEdits(course));
      await enterRoadmap(course.studentId, course.roadmapId);
      await set(second);
      const { summary: shown } = await enterRoadmap(course.studentId, course.roadmapId);
      expect(shown?.courseCode).toBe(course.identifier.courseCode);
      expect(summaryInInboxWords(shown)).toEqual(summary);
    });

    test('Node creation, Node deletion and Roadmap availability absorb the change', async ({
      course,
    }) => {
      const edits = teacherEdits(course);
      const created = await edits.create('Pilas');
      await (await seed(course, edits, created.id)).set(second);
      expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
        { data: { noticeTarget: 'node-creation', nodeId: created.id, ...creation } },
      ]);
      await enterRoadmap(course.studentId, course.roadmapId);
      const deleted = await seeded(course, edits);
      await deleted.set(first);
      await edits.remove(deleted.node.id);
      expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
        { data: { noticeTarget: 'node-deletion', nodeId: deleted.node.id } },
      ]);
      await announceRoadmap(course);
      await (await seeded(course, edits)).set(first);
      expect(await pendingNotices(course.classmateId, course.roadmapId)).toMatchObject([
        { data: { noticeTarget: 'roadmap-availability' } },
      ]);
    });

    test(`a Node locked by a dependency is news ${audience === 'visible' ? 'to everyone who sees it' : 'only where accessible'}`, async ({
      course,
    }) => {
      const { node, set } = await seeded(course, teacherEdits(course));
      const prerequisite = course.change.nodeId;
      await prisma.dependency.create({
        data: { sourceNodeId: prerequisite, targetNodeId: node.id },
      });
      await prisma.completion.create({
        data: { userId: course.studentId, roadmapNodeId: prerequisite },
      });
      await set(first);
      expect(await ownTargets(course.studentId, course)).toMatchObject([
        { data: { nodeId: node.id } },
      ]);
      expect(await pendingNotices(course.classmateId, course.roadmapId)).toHaveLength(
        audience === 'visible' ? 1 : 0,
      );
    });

    test('a hidden Node is nobody’s news until revealed, and a blocked one only for a visible audience', async ({
      course,
    }) => {
      const edits = teacherEdits(course);
      const blocked = await seeded(course, edits, { isTeacherBlocked: true });
      const hidden = await seeded(course, edits, { isVisible: false });
      await blocked.set(first);
      await hidden.set(first);
      const toldOfBlocked = audience === 'visible' ? [blocked.notice(known, first)] : [];
      for (const recipient of [course.studentId, course.classmateId])
        expect(await pendingNotices(recipient, course.roadmapId)).toMatchObject(toldOfBlocked);
      await edits.unblock(blocked.node.id);
      await edits.update(hidden.node.id, { isVisible: true, ...hidden.nodeInput(second) });
      for (const recipient of [course.studentId, course.classmateId])
        expect(await ownTargets(recipient, course)).toMatchObject(toldOfBlocked);
    });

    test('a pending notice is neither shown nor counted while concealed, and returns intact', async ({
      course,
    }) => {
      const edits = teacherEdits(course);
      const { node, set, notice } = await seeded(course, edits);
      const setVisible = (isVisible: boolean) => edits.update(node.id, { isVisible });
      await set(first);
      const [pending] = await ownTargets(course.studentId, course);
      for (const { conceal, reveal, shown } of [
        {
          conceal: () => edits.block(node.id),
          reveal: () => edits.unblock(node.id),
          shown: audience === 'visible' ? 1 : 0,
        },
        { conceal: () => setVisible(false), reveal: () => setVisible(true), shown: 0 },
      ]) {
        await conceal();
        expect(await ownTargets(course.studentId, course)).toHaveLength(shown);
        expect(await inboxCount(course.studentId, course.roadmapId)).toEqual({ count: shown + 1 });
        await reveal();
        expect(await ownTargets(course.studentId, course)).toMatchObject([
          { id: pending.id, ...notice(known, first) },
        ]);
      }
    });
  },
);

test('a pending type notice keeps the type names the recipient knew after Node type renames', async ({
  course,
}) => {
  const node = await addNode(course, 'Pilas');
  const reading = await addType(course, 'Lectura');
  const workshop = await addType(course, 'Taller');
  const edits = teacherEdits(course);
  await edits.update(node.id, { nodeTypeId: reading.id });
  await edits.renameType(course.nodeTypeId, 'Tema renombrado');
  await edits.renameType(reading.id, 'Lectura renombrada');
  expect(await pendingTargets(course.studentId, course.roadmapId, 'node-type')).toMatchObject([
    {
      body: '«Pilas» pasó de tipo «Tema» a tipo «Lectura».',
      data: { knownTypeName: 'Tema', currentTypeName: 'Lectura' },
    },
  ]);
  await edits.update(node.id, { nodeTypeId: workshop.id });
  expect(await pendingTargets(course.studentId, course.roadmapId, 'node-type')).toMatchObject([
    { body: '«Pilas» pasó de tipo «Tema» a tipo «Taller».' },
  ]);
});

test('the Change summary lists a type change under «Ruta y clasificación» with the current Node title', async ({
  course,
}) => {
  const workshop = await addType(course, 'Taller');
  await enterRoadmap(course.studentId, course.roadmapId);
  const edits = teacherEdits(course);
  await edits.update(course.change.nodeId, { nodeTypeId: workshop.id });
  await edits.rename(course.change.nodeId, 'Recursión');
  const { summary } = await enterRoadmap(course.studentId, course.roadmapId);
  expect(summaryInInboxWords(summary)).toEqual([
    { title: 'Recursión', items: ['Antes se llamaba «Recursividad».'] },
    {
      title: 'Ruta y clasificación',
      items: ['«Recursión» pasó de tipo «Tema» a tipo «Taller».'],
    },
  ]);
  expect(summary?.groups.map(({ node }) => node?.nodeType.name)).toEqual(['Taller', undefined]);
});

test('counts, the Node change mark and the Grouped roadmap notice count title targets', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const nodeId = course.change.nodeId;
  const params = new URLSearchParams({ roadmapId: course.roadmapId });
  await edits.rename(nodeId, 'Recursión');
  await edits.rename(nodeId, 'Recursión avanzada');
  expect(await inboxCount(course.studentId, course.roadmapId)).toEqual({ count: 1 });
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.rename(nodeId, 'Recursión');
  expect(await countOwnNodeChangeTargets(course.studentId, params)).toEqual({
    byNode: { [nodeId]: 1 },
  });
  for (const title of ['Pilas', 'Colas']) {
    const node = await addNode(course, title);
    await edits.rename(node.id, `${title} dobles`);
  }
  expect(await inboxCount(course.studentId, course.roadmapId)).toEqual({ count: 3 });
  const grouped = await listOwnNotices(
    course.studentId,
    new URLSearchParams({ roadmapId: course.roadmapId, groupBy: 'roadmapId' }),
  );
  expect(grouped.notifications).toMatchObject([{ data: { targetCount: 3 } }]);
  await edits.update(nodeId, { description: 'Una descripción independiente del título.' });
  expect((await countOwnNodeChangeTargets(course.studentId, params)).byNode[nodeId]).toBe(2);
});
