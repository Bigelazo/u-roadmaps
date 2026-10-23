import { describe, expect, test } from 'vitest';
import {
  decideRoadmapCapability,
  decideRoadmapCreation,
  type RoadmapCapability,
} from '@/features/roadmap/domain/roadmap-capability';

const participants = {
  'active teaching staff': { role: 'TEACHER', isActive: true },
  'active student': { role: 'STUDENT', isActive: true },
  'inactive teaching staff': { role: 'TEACHER', isActive: false },
  'inactive student': { role: 'STUDENT', isActive: false },
  'no Participation': null,
} as const;

const roadmaps = {
  open: { closedAt: null },
  closed: { closedAt: new Date('2026-07-21T04:00:00.000Z') },
  missing: null,
} as const;

function outcome(
  capability: RoadmapCapability,
  participant: keyof typeof participants,
  roadmap: keyof typeof roadmaps,
) {
  const decision = decideRoadmapCapability({
    capability,
    participation: participants[participant],
    roadmap: roadmaps[roadmap],
  });
  return decision.kind === 'ALLOWED' ? 'ALLOWED' : decision.reason;
}

describe('Roadmap capability', () => {
  test.each([
    ['read', 'active teaching staff', 'ALLOWED', 'ALLOWED', 'ROADMAP_NOT_FOUND'],
    ['read', 'active student', 'ALLOWED', 'ALLOWED', 'ROADMAP_NOT_FOUND'],
    ['read', 'inactive teaching staff', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['read', 'inactive student', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['read', 'no Participation', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['oversee', 'active teaching staff', 'ALLOWED', 'ALLOWED', 'ROADMAP_NOT_FOUND'],
    ['oversee', 'active student', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['oversee', 'inactive teaching staff', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['oversee', 'no Participation', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['complete', 'active student', 'ALLOWED', 'ROADMAP_CLOSED', 'ROADMAP_NOT_FOUND'],
    ['complete', 'active teaching staff', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['complete', 'inactive student', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['complete', 'no Participation', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['edit', 'active teaching staff', 'ALLOWED', 'ROADMAP_CLOSED', 'ROADMAP_NOT_FOUND'],
    ['edit', 'active student', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['edit', 'inactive teaching staff', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
    ['edit', 'no Participation', 'FORBIDDEN', 'FORBIDDEN', 'FORBIDDEN'],
  ] as const)(
    '%s by %s: open %s, closed %s, missing %s',
    (capability, participant, ...expected) => {
      expect([
        outcome(capability, participant, 'open'),
        outcome(capability, participant, 'closed'),
        outcome(capability, participant, 'missing'),
      ]).toEqual(expected);
    },
  );

  test('a legacy teaching-staff Participation with an unknown position still edits', () => {
    const legacy = { role: 'TEACHER', isActive: true, institutionalPosition: null } as const;

    expect(
      decideRoadmapCapability({
        capability: 'edit',
        participation: legacy,
        roadmap: roadmaps.open,
      }),
    ).toEqual({ kind: 'ALLOWED', participation: legacy, roadmap: roadmaps.open });
  });
});

describe('Roadmap creation', () => {
  const storedParticipations = {
    'active course professor': { isActive: true, institutionalPosition: 'COURSE_PROFESSOR' },
    'inactive course professor': { isActive: false, institutionalPosition: 'COURSE_PROFESSOR' },
    'active coordinating professor': {
      isActive: true,
      institutionalPosition: 'COORDINATING_PROFESSOR',
    },
    'active unknown position': { isActive: true, institutionalPosition: null },
    'no Participation': null,
  } as const;

  function creation(
    report: Parameters<typeof decideRoadmapCreation>[0]['report'],
    stored: keyof typeof storedParticipations,
  ) {
    const decision = decideRoadmapCreation({ report, participation: storedParticipations[stored] });
    return decision.kind === 'ALLOWED' ? 'ALLOWED' : decision.reason;
  }

  test.each([
    ['COURSE_PROFESSOR', 'no Participation', 'ALLOWED'],
    ['COURSE_PROFESSOR', 'inactive course professor', 'ALLOWED'],
    ['COORDINATING_PROFESSOR', 'active course professor', 'FORBIDDEN'],
    ['TEACHING_ASSISTANT', 'no Participation', 'FORBIDDEN'],
    [null, 'active course professor', 'FORBIDDEN'],
  ] as const)(
    'follows the U-Campus report when it is complete: %s with %s is %s',
    (position, stored, expected) => {
      expect(creation({ position }, stored)).toBe(expected);
    },
  );

  test.each([
    ['active course professor', 'ALLOWED'],
    ['inactive course professor', 'FORBIDDEN'],
    ['active coordinating professor', 'FORBIDDEN'],
    ['active unknown position', 'FORBIDDEN'],
    ['no Participation', 'FORBIDDEN'],
  ] as const)(
    'falls back to the stored position during a U-Campus outage: %s is %s',
    (stored, expected) => {
      expect(creation(null, stored)).toBe(expected);
    },
  );
});
