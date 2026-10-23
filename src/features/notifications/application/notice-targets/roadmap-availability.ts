import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import { ABSENT, PRESENT, absorbs, availabilityRef } from '../absorption';
import { participantIds, type NoticeTargetDescriptor, type TargetValues } from './descriptor';

type RoadmapCreatedFact = Extract<RoadmapChangeFact, { kind: 'roadmap-created' }>;

function text({ context }: TargetValues) {
  const courseCode = String(context.courseCode ?? '');
  return {
    subject: `Roadmap disponible: ${courseCode}`,
    body: `${String(context.actorName ?? 'Equipo docente')} creó el roadmap de ${courseCode}.`,
  };
}

export const roadmapAvailabilityTarget: NoticeTargetDescriptor<RoadmapCreatedFact> = {
  noticeTarget: NOTICE_TARGET.roadmapAvailability,
  noticeClass: 'roadmap-available',
  shownTo: 'everyone',
  scope: 'roadmap',
  matches: (fact): fact is RoadmapCreatedFact => fact.kind === 'roadmap-created',
  target: (_fact, changes) => availabilityRef(changes.roadmapId),
  previousValue: () => ABSENT,
  knowers: async (_fact, changes, roadmap) =>
    (await participantIds(roadmap)).filter((userId) => userId !== changes.actorId),
  audience: async (_fact, _changes, roadmap) => participantIds(roadmap),
  async current(_target, roadmap) {
    const course = await roadmap.course();
    return course ? { value: PRESENT, visible: true, context: course } : null;
  },
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
