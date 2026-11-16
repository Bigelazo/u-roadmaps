import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test, teacher } from '../../notifications-integration/fixtures';
import { prisma } from '@/shared/server/db';
import {
  createRoadmapNode,
  readRoadmapForParticipant,
  saveRoadmapNodePositions,
} from '@/features/roadmap/server';
import { recordingChangePort } from './support/recording-change-port';

async function roadmapStateOf(course: Parameters<typeof teacher>[0]) {
  const { nodeTypes, ...state } = await readRoadmapForParticipant(teacher(course));
  return { ...state, nodeTypes: nodeTypes.filter(({ isPredefined }) => !isPredefined) };
}

test('creation persists its stable identity and displaced Nodes together', async ({ course }) => {
  const nodeId = randomUUID();
  const { port, facts } = recordingChangePort();
  const created = await createRoadmapNode(
    {
      ...teacher(course),
      input: {
        nodeId,
        title: 'Colas',
        description: null,
        nodeTypeId: course.nodeTypeId,
        isVisible: true,
        positionX: 0,
        positionY: 0,
        displaced: [{ nodeId: course.change.nodeId, position: { x: 160, y: 0 } }],
      },
    },
    port,
  );
  expect(created.id).toBe(nodeId);
  const saved = await readRoadmapForParticipant(teacher(course));
  expect(saved.nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: nodeId, title: 'Colas', positionX: 0, positionY: 0 }),
      expect.objectContaining({ id: course.change.nodeId, positionX: 160, positionY: 0 }),
    ]),
  );
  expect(facts()).toEqual([expect.objectContaining({ kind: 'node-created', nodeId })]);
});

test('replaying a creation recovers current content without displacement or another creation fact', async ({
  course,
}) => {
  const nodeId = randomUUID();
  const input = {
    nodeId,
    title: 'Colas',
    nodeTypeId: course.nodeTypeId,
    positionX: 0,
    positionY: 0,
    displaced: [{ nodeId: course.change.nodeId, position: { x: 160, y: 0 } }],
  };
  const { port, facts } = recordingChangePort();
  await createRoadmapNode({ ...teacher(course), input }, port);
  await prisma.roadmapNode.update({ where: { id: nodeId }, data: { title: 'Colas revisadas' } });
  await saveRoadmapNodePositions(
    {
      ...teacher(course),
      input: { positions: [{ nodeId: course.change.nodeId, position: { x: 320, y: 40 } }] },
    },
    port,
  );
  const replay = await createRoadmapNode({ ...teacher(course), input }, port);
  expect(replay).toMatchObject({ id: nodeId, title: 'Colas revisadas' });
  const saved = await readRoadmapForParticipant(teacher(course));
  expect(saved.nodes.filter(({ id }) => id === nodeId)).toHaveLength(1);
  expect(saved.nodes).toContainEqual(
    expect.objectContaining({ id: course.change.nodeId, positionX: 320, positionY: 40 }),
  );
  expect(facts()).toHaveLength(1);
});

test('concurrent resends of one logical creation resolve to one Node and one creation fact', async ({
  course,
}) => {
  const nodeId = randomUUID();
  const input = {
    nodeId,
    title: 'Colas',
    nodeTypeId: course.nodeTypeId,
    positionX: 0,
    positionY: 0,
    displaced: [{ nodeId: course.change.nodeId, position: { x: 160, y: 0 } }],
  };
  const changes: string[] = [];
  const port = {
    async report(_tx: unknown, change: { facts: readonly { kind: string }[] }) {
      return () => {
        changes.push(...change.facts.map(({ kind }) => kind));
      };
    },
  };
  const attempts = await Promise.all([
    createRoadmapNode({ ...teacher(course), input }, port),
    createRoadmapNode({ ...teacher(course), input }, port),
  ]);
  expect(attempts.map(({ id }) => id)).toEqual([nodeId, nodeId]);
  const saved = await readRoadmapForParticipant(teacher(course));
  expect(saved.nodes.filter(({ id }) => id === nodeId)).toHaveLength(1);
  expect(changes).toEqual(['node-created']);
});

test.for(['missing', 'foreign', 'duplicate', 'self', 'coordinate', 'type'] as const)(
  'a creation with a rejected %s target leaves no new Node or displacement',
  async (invalid, { course, otherCourse }) => {
    const nodeId = randomUUID();
    const before = await roadmapStateOf(course);
    const displaced = [{ nodeId: course.change.nodeId, position: { x: 160, y: 0 } }];
    if (invalid === 'missing' || invalid === 'foreign' || invalid === 'self')
      displaced.push({
        nodeId:
          invalid === 'missing'
            ? randomUUID()
            : invalid === 'foreign'
              ? otherCourse.change.nodeId
              : nodeId,
        position: { x: 320, y: 0 },
      });
    if (invalid === 'duplicate') displaced.push(displaced[0]);
    if (invalid === 'coordinate') displaced[0].position.x = Infinity;
    await expect(
      createRoadmapNode(
        {
          ...teacher(course),
          input: {
            nodeId,
            title: 'Colas',
            nodeTypeId: invalid === 'type' ? randomUUID() : course.nodeTypeId,
            positionX: 0,
            positionY: 0,
            displaced,
          },
        },
        recordingChangePort().port,
      ),
    ).rejects.toMatchObject({
      code:
        invalid === 'duplicate' || invalid === 'coordinate'
          ? 'INVALID_REQUEST'
          : invalid === 'type'
            ? 'NODE_TYPE_NOT_FOUND'
            : 'NODE_NOT_FOUND',
    });
    expect(await roadmapStateOf(course)).toEqual(before);
  },
);

test('a foreign pending creation identity exposes and modifies neither Roadmap', async ({
  course,
  otherCourse,
}) => {
  const before = await roadmapStateOf(course);
  const otherBefore = await roadmapStateOf(otherCourse);
  await expect(
    createRoadmapNode(
      {
        ...teacher(course),
        input: {
          nodeId: otherCourse.change.nodeId,
          title: 'Colas',
          nodeTypeId: course.nodeTypeId,
          positionX: 0,
          positionY: 0,
          displaced: [{ nodeId: course.change.nodeId, position: { x: 160, y: 0 } }],
        },
      },
      recordingChangePort().port,
    ),
  ).rejects.toMatchObject({ code: 'NODE_NOT_FOUND' });
  expect(await roadmapStateOf(course)).toEqual(before);
  expect(await roadmapStateOf(otherCourse)).toEqual(otherBefore);
});

test.for(['inactive', 'student', 'closed'] as const)(
  'a %s participant cannot create or recover a creation',
  async (restriction, { course }) => {
    const nodeId = randomUUID();
    const input = {
      nodeId,
      title: 'Colas',
      nodeTypeId: course.nodeTypeId,
      positionX: 0,
      positionY: 0,
      displaced: [{ nodeId: course.change.nodeId, position: { x: 160, y: 0 } }],
    };
    const { port } = recordingChangePort();
    await createRoadmapNode({ ...teacher(course), input }, port);
    if (restriction === 'closed')
      await prisma.roadmap.update({
        where: { id: course.roadmapId },
        data: { closedAt: new Date() },
      });
    else
      await prisma.participation.updateMany({
        where: { userId: course.teacherId },
        data: restriction === 'inactive' ? { isActive: false } : { role: 'STUDENT' },
      });
    for (const pendingId of [nodeId, randomUUID()])
      await expect(
        createRoadmapNode({ ...teacher(course), input: { ...input, nodeId: pendingId } }, port),
      ).rejects.toMatchObject({ code: restriction === 'closed' ? 'ROADMAP_CLOSED' : 'FORBIDDEN' });
    const saved = await readRoadmapForParticipant({
      ...teacher(course),
      userId: course.colleagueId,
    });
    expect(saved.nodes).toHaveLength(2);
    expect(saved.nodes).toContainEqual(
      expect.objectContaining({ id: course.change.nodeId, positionX: 160, positionY: 0 }),
    );
  },
);

test('a later displacement failure rolls back the new Node and every displaced position', async ({
  course,
}) => {
  const nodeId = randomUUID();
  const before = await roadmapStateOf(course);
  const suffix = randomUUID().replaceAll('-', '');
  const name = `reject_creation_${suffix}`;
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE "${name}"`);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.id = '${course.change.nodeId}'::uuid AND NEW."positionX" = 160 THEN
      IF EXISTS (SELECT 1 FROM "RoadmapNode" WHERE id = '${nodeId}'::uuid) THEN
        PERFORM nextval('${name}');
        RAISE EXCEPTION 'displacement rejected after Node creation';
      END IF;
    END IF;
    RETURN NEW;
  END $$`);
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${name}" BEFORE UPDATE ON "RoadmapNode" FOR EACH ROW EXECUTE FUNCTION "${name}"()`,
  );
  try {
    await expect(
      createRoadmapNode(
        {
          ...teacher(course),
          input: {
            nodeId,
            title: 'Colas',
            nodeTypeId: course.nodeTypeId,
            positionX: 0,
            positionY: 0,
            displaced: [{ nodeId: course.change.nodeId, position: { x: 160, y: 0 } }],
          },
        },
        recordingChangePort().port,
      ),
    ).rejects.toThrow();
    const [attempt] = await prisma.$queryRawUnsafe<{ is_called: boolean }[]>(
      `SELECT is_called FROM "${name}"`,
    );
    expect(attempt.is_called).toBe(true);
    expect(await roadmapStateOf(course)).toEqual(before);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${name}" ON "RoadmapNode"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${name}"()`);
    await prisma.$executeRawUnsafe(`DROP SEQUENCE "${name}"`);
  }
});

test('one placement saves every target position without producing Roadmap notice facts', async ({
  course,
}) => {
  const second = await prisma.roadmapNode.create({
    data: {
      id: randomUUID(),
      roadmapId: course.roadmapId,
      nodeTypeId: course.nodeTypeId,
      title: 'Colas',
      positionX: 160,
      positionY: 0,
    },
  });
  const { port, facts } = recordingChangePort();
  await saveRoadmapNodePositions(
    {
      ...teacher(course),
      input: {
        positions: [
          { nodeId: course.change.nodeId, position: { x: 40, y: 240 } },
          { nodeId: second.id, position: { x: 200, y: 240 } },
        ],
      },
    },
    port,
  );
  const saved = await readRoadmapForParticipant(teacher(course));
  expect(saved.nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: course.change.nodeId, positionX: 40, positionY: 240 }),
      expect.objectContaining({ id: second.id, positionX: 200, positionY: 240 }),
    ]),
  );
  expect(facts()).toEqual([]);
});

async function positionsOf(course: Parameters<typeof teacher>[0]) {
  const saved = await readRoadmapForParticipant(teacher(course));
  return saved.nodes.map(({ id, positionX, positionY }) => ({ id, positionX, positionY }));
}

test.for(['missing', 'foreign'] as const)(
  'a %s target rejects the entire position set',
  async (target, { course, otherCourse }) => {
    const before = await positionsOf(course);
    await expect(
      saveRoadmapNodePositions(
        {
          ...teacher(course),
          input: {
            positions: [
              { nodeId: course.change.nodeId, position: { x: 40, y: 240 } },
              {
                nodeId: target === 'foreign' ? otherCourse.change.nodeId : randomUUID(),
                position: { x: 200, y: 240 },
              },
            ],
          },
        },
        recordingChangePort().port,
      ),
    ).rejects.toMatchObject({ code: 'NODE_NOT_FOUND' });
    expect(await positionsOf(course)).toEqual(before);
    expect(await positionsOf(otherCourse)).toEqual([
      { id: otherCourse.change.nodeId, positionX: 0, positionY: 0 },
    ]);
  },
);

test('a duplicate target rejects every position, including differently cased UUIDs', async ({
  course,
}) => {
  const before = await positionsOf(course);
  await expect(
    saveRoadmapNodePositions(
      {
        ...teacher(course),
        input: {
          positions: [
            { nodeId: course.change.nodeId, position: { x: 40, y: 240 } },
            { nodeId: course.change.nodeId.toUpperCase(), position: { x: 200, y: 240 } },
          ],
        },
      },
      recordingChangePort().port,
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(await positionsOf(course)).toEqual(before);
});

test.for([NaN, Infinity, -Infinity, null, '40'])(
  'an invalid coordinate %s rejects the whole movement',
  async (coordinate, { course }) => {
    const before = await positionsOf(course);
    await expect(
      saveRoadmapNodePositions(
        {
          ...teacher(course),
          input: {
            positions: [{ nodeId: course.change.nodeId, position: { x: coordinate, y: 240 } }],
          },
        },
        recordingChangePort().port,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await positionsOf(course)).toEqual(before);
  },
);

test.for([
  null,
  {},
  [{ nodeId: 'invalid', position: { x: 0, y: 0 } }],
  [{ nodeId: randomUUID(), position: null }],
])('invalid position identities or shape reject the movement', async (positions, { course }) => {
  const before = await positionsOf(course);
  await expect(
    saveRoadmapNodePositions(
      { ...teacher(course), input: { positions } },
      recordingChangePort().port,
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(await positionsOf(course)).toEqual(before);
});

test.for(['inactive', 'student', 'closed'] as const)(
  'a %s editor cannot save any part of a placement',
  async (restriction, { course }) => {
    const editor = teacher(course);
    if (restriction === 'closed')
      await prisma.roadmap.update({
        where: { id: course.roadmapId },
        data: { closedAt: new Date() },
      });
    else
      await prisma.participation.updateMany({
        where: { userId: course.teacherId },
        data: restriction === 'inactive' ? { isActive: false } : { role: 'STUDENT' },
      });
    await expect(
      saveRoadmapNodePositions(
        {
          ...editor,
          input: { positions: [{ nodeId: course.change.nodeId, position: { x: 40, y: 240 } }] },
        },
        recordingChangePort().port,
      ),
    ).rejects.toMatchObject({ code: restriction === 'closed' ? 'ROADMAP_CLOSED' : 'FORBIDDEN' });
    const saved = await readRoadmapForParticipant({ ...editor, userId: course.colleagueId });
    expect(saved.nodes).toContainEqual(
      expect.objectContaining({ id: course.change.nodeId, positionX: 0, positionY: 0 }),
    );
  },
);

test('an empty movement preserves the persisted Roadmap', async ({ course }) => {
  const before = await roadmapStateOf(course);
  const { port, facts } = recordingChangePort();
  await saveRoadmapNodePositions({ ...teacher(course), input: { positions: [] } }, port);
  expect(await roadmapStateOf(course)).toEqual(before);
  expect(facts()).toEqual([]);
});

test('failure after an earlier position write rolls every target back', async ({ course }) => {
  const second = await prisma.roadmapNode.create({
    data: {
      roadmapId: course.roadmapId,
      nodeTypeId: course.nodeTypeId,
      title: 'Colas',
      positionX: 160,
      positionY: 0,
    },
  });
  const before = await positionsOf(course);
  const suffix = randomUUID().replaceAll('-', '');
  const functionName = `reject_placement_${suffix}`;
  const triggerName = `reject_placement_${suffix}`;
  const sequenceName = `placement_attempt_${suffix}`;
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE "${sequenceName}"`);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW."roadmapId" = '${course.roadmapId}'::uuid AND NEW."positionY" = 240 THEN
      IF nextval('${sequenceName}') = 2 THEN
        RAISE EXCEPTION 'later placement rejected';
      END IF;
    END IF;
    RETURN NEW;
  END $$`);
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${triggerName}" BEFORE UPDATE ON "RoadmapNode" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`,
  );
  try {
    await expect(
      saveRoadmapNodePositions(
        {
          ...teacher(course),
          input: {
            positions: [
              { nodeId: course.change.nodeId, position: { x: 40, y: 240 } },
              { nodeId: second.id, position: { x: 200, y: 240 } },
            ],
          },
        },
        recordingChangePort().port,
      ),
    ).rejects.toThrow();
    const [attempt] = await prisma.$queryRawUnsafe<{ last_value: bigint }[]>(
      `SELECT last_value FROM "${sequenceName}"`,
    );
    expect(Number(attempt.last_value)).toBe(2);
    expect(await positionsOf(course)).toEqual(before);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${triggerName}" ON "RoadmapNode"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${functionName}"()`);
    await prisma.$executeRawUnsafe(`DROP SEQUENCE "${sequenceName}"`);
  }
});
