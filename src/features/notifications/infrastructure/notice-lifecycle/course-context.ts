import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier } from '@/shared/course-offering';

export type NoticeCourseContext = Readonly<
  CourseOfferingIdentifier & {
    roadmapId: string;
    courseOfferingId: string;
    courseName: string;
    actorId?: string;
    actorName?: string | null;
  }
>;

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

export function lazyNoticeCourseContext(transaction: Prisma.TransactionClient, roadmapId: string) {
  let context: Promise<NoticeCourseContext> | undefined;
  return () =>
    (context ??= noticeCourseContext(transaction, roadmapId).then((loaded) => {
      if (!loaded) throw new Error('Roadmap not found.');
      return loaded;
    }));
}
