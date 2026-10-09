import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier } from '@/shared/course-offering';

/**
 * The Course offering every stored notice belongs to, for navigation and the read side
 * (stored flat in `data`). An actor without a name (the Scheduled unlock) is stored as
 * `actorName: null`; the read side projects its label (`noticeActorLabel`).
 */
export type NoticeCourseContext = Readonly<
  CourseOfferingIdentifier & {
    roadmapId: string;
    courseOfferingId: string;
    courseName: string;
    actorId?: string;
    actorName?: string | null;
  }
>;

/** Course context of a Roadmap's notices; the actor is named when there is one. */
export async function noticeCourseContext(
  client: Prisma.TransactionClient,
  roadmapId: string,
  actorId?: string,
): Promise<NoticeCourseContext | null> {
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
    ...(actorId ? { actorId, actorName: actor?.name ?? null } : {}),
  };
}

/** Course context loaded at most once, and only if a notice is written. */
export function lazyNoticeCourseContext(transaction: Prisma.TransactionClient, roadmapId: string) {
  let context: Promise<NoticeCourseContext> | undefined;
  return () =>
    (context ??= noticeCourseContext(transaction, roadmapId).then((loaded) => {
      if (!loaded) throw new Error('Roadmap not found.');
      return loaded;
    }));
}
