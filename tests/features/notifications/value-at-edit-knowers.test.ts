import { expect, test } from 'vitest';
import {
  noticeTargetDescriptors,
  type RoadmapView,
} from '@/features/notifications/application/notice-targets';
import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';

const accessFact = {
  kind: 'node-access',
  nodeId: 'node',
  recipientId: 'student',
  previous: 'Bloqueado',
  current: 'Disponible',
  nodeTitle: 'Recursividad',
  nodeTypeName: 'Tema',
} as RoadmapChangeFact;

const changes = {
  roadmapId: 'roadmap',
  actorId: 'teacher',
  facts: [accessFact],
} as unknown as RoadmapChanges;

// The value at edit time is stored on existing Known values only: every recipient it
// names must be a knower, whose baseline the same change records first.
test('every target with a value at edit time names only its knowers', async () => {
  const withValueAtEdit = noticeTargetDescriptors.filter((each) => each.currentAtEdit);
  expect(withValueAtEdit.map(({ noticeTarget }) => noticeTarget)).toEqual(['node-access']);
  for (const descriptor of withValueAtEdit) {
    const knowers = await descriptor.knowers(accessFact, changes, {} as RoadmapView);
    expect(knowers).toEqual(
      expect.arrayContaining([...descriptor.currentAtEdit!(accessFact).recipientIds]),
    );
  }
});
