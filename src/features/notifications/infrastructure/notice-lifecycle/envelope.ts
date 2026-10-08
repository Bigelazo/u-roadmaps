import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type { NoticeEnvelope } from './reconcile';

/** Course context of a Roadmap's notices; the actor is named when there is one. */
export async function roadmapEnvelope(
  client: Prisma.TransactionClient,
  roadmapId: string,
  actorId?: string,
): Promise<NoticeEnvelope | null> {
  const [roadmap, actor] = await Promise.all([
    client.roadmap.findUnique({
      where: { id: roadmapId },
      select: { courseOffering: { include: { course: { select: { name: true } } } } },
    }),
    actorId
      ? client.user.findUnique({ where: { id: actorId }, select: { name: true } })
      : Promise.resolve(null),
  ]);
  if (!roadmap) return null;
  const offering = roadmap.courseOffering;
  return {
    roadmapId,
    courseOfferingId: offering.id,
    courseCode: offering.courseCode,
    year: offering.year,
    semester: offering.semester,
    courseName: offering.course.name,
    ...(actorId ? { actorId, actorName: actor?.name ?? 'Equipo docente' } : {}),
  };
}
