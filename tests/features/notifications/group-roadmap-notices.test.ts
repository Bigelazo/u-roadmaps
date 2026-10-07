import { expect, test } from 'vitest';
import { groupRoadmapNotices } from '@/features/notifications/application/group-roadmap-notices';

const notice = (id: string, roadmapId = 'roadmap-a', noticeClass = 'roadmap-node-changed') => ({
  id,
  roadmapId,
  noticeClass,
  subject: id,
  body: id,
  data: {
    courseCode: 'CC1002',
    year: 2026,
    semester: 2,
    changeKind: noticeClass === 'roadmap-available' ? 'roadmap-available' : 'node-updated',
  },
  availableAt: new Date(`2026-10-06T12:00:0${id}Z`),
  acknowledgedAt: null,
});

test('three pending targets become one row with the newest identity, date and target count', () => {
  expect(groupRoadmapNotices([notice('1'), notice('3'), notice('2')])).toMatchObject([
    {
      id: '3',
      subject: 'El Roadmap de CC1002 ha recibido cambios',
      body: '3 cambios',
      data: { changeKind: 'roadmap-grouped', targetCount: 3 },
      availableAt: new Date('2026-10-06T12:00:03Z'),
    },
  ]);
});

test('two targets in each Roadmap remain four individual entries', () => {
  expect(
    groupRoadmapNotices([
      notice('1'),
      notice('2'),
      notice('3', 'roadmap-b'),
      notice('4', 'roadmap-b'),
    ]).map(({ id }) => id),
  ).toEqual(['4', '3', '2', '1']);
});

test('withdrawal below three restores individual rows and availability never joins a group', () => {
  const targets = [notice('1'), notice('2'), notice('3')];
  const availability = notice('4', 'roadmap-a', 'roadmap-available');
  expect(groupRoadmapNotices([...targets, availability])).toMatchObject([
    { id: '4', noticeClass: 'roadmap-available' },
    { id: '3', data: { targetCount: 3 } },
  ]);
  expect(groupRoadmapNotices([targets[0], targets[1], availability]).map(({ id }) => id)).toEqual([
    '4',
    '2',
    '1',
  ]);
});
