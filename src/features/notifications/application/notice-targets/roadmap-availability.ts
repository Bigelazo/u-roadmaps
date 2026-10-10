import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import { ABSENT, PRESENT, absorbs, availabilityRef } from '../absorption';
import type { NoticeTargetDescriptor, TargetValues } from './descriptor';

type RoadmapCreatedFact = Extract<RoadmapChangeFact, { kind: 'roadmap-created' }>;

function text({ context }: TargetValues) {
  const courseCode = String(context.courseCode ?? '');
  return {
    subject: `Roadmap disponible: ${courseCode}`,
    body: `${String(context.actorName ?? 'Equipo docente')} creó el roadmap de ${courseCode}.`,
  };
}

/**
 * Roadmap availability: the broadest target. Until the recipient recognizes the new
 * Roadmap (empty or copied), it is the only notice for that Roadmap.
 */
export const roadmapAvailabilityTarget: NoticeTargetDescriptor<RoadmapCreatedFact> = {
  noticeTarget: NOTICE_TARGET.roadmapAvailability,
  noticeClass: 'roadmap-available',
  readSide: { changeKind: 'roadmap-available', changedFields: [], targetKind: 'roadmap' },
  scope: 'roadmap',
  matches: (fact): fact is RoadmapCreatedFact => fact.kind === 'roadmap-created',
  target: (_fact, changes) => availabilityRef(changes.roadmapId),
  previousValue: () => ABSENT,
  knowers: async (_fact, changes, roadmap) =>
    (await roadmap.participants())
      .map(({ userId }) => userId)
      .filter((userId) => userId !== changes.actorId),
  audience: async (_fact, _changes, roadmap) =>
    (await roadmap.participants()).map(({ userId }) => userId),
  async current(_target, roadmap) {
    const course = await roadmap.course();
    return course ? { value: PRESENT, visible: true, context: course } : null;
  },
  // A Roadmap the recipient has not recognized (even if its notice is on its way).
  entryValues: async (roadmap, _recipientId, known) =>
    known.some(({ knownValue }) => absorbs(knownValue))
      ? [{ target: availabilityRef(roadmap.roadmapId), currentValue: PRESENT }]
      : [],
  factContext: (fact) => ({ actorName: fact.current.actorName }),
  wording: (values) => ({
    ...text(values),
    summaryGroup: 'general',
    summary: 'Roadmap disponible.',
  }),
  apiData: () => ({}),
};
