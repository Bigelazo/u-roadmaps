import {
  parseCourseOfferingIdentifier,
  RoadmapCanvasSession,
  type CourseOfferingIdentifier,
} from '@/features/roadmap';
import { readRoadmapForParticipant, synchronizeParticipation } from '@/features/roadmap/server';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';
import { prisma } from '@/shared/server/db';
import { notFound, redirect } from 'next/navigation';
import { RoadmapAvailabilityDialog } from '@/features/notifications';
import { getInboxIdentity, prepareOwnNoticeOpening } from '@/features/notifications/server';

function redirectUnavailableNotice(
  noticeId: string | null,
  participation: unknown,
  roadmap: unknown,
) {
  if (noticeId && !participation) {
    redirect(
      `/academic-overview?${new URLSearchParams({ notice: noticeId, noticeFallback: 'course-unavailable' })}`,
    );
  }
  if (noticeId && !roadmap) {
    redirect(
      `/academic-overview?${new URLSearchParams({ notice: noticeId, noticeFallback: 'roadmap-unavailable' })}`,
    );
  }
}

async function resolveNoticeTargetNode(
  userId: string,
  identifier: CourseOfferingIdentifier,
  requestedNodeId: string | undefined,
  role: string | undefined,
  noticeId: string | null,
) {
  if (!noticeId || !requestedNodeId) return requestedNodeId;
  const projection = await readRoadmapForParticipant({ userId, identifier }).match(
    (value) => value,
    () => null,
  );
  const target = projection?.nodes.find(({ id }) => id === requestedNodeId);
  let canOpen = false;
  if (target && role === 'TEACHER') {
    canOpen =
      'isVisible' in target &&
      target.isVisible &&
      'isTeacherBlocked' in target &&
      !target.isTeacherBlocked;
  } else if (target && role === 'STUDENT' && 'access' in target) {
    canOpen = target.access?.status === 'ACCESSIBLE';
  }
  return canOpen ? requestedNodeId : undefined;
}

export default async function CoursePage(
  props: PageProps<'/courses/[courseCode]/[year]/[semester]'>,
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const singleSearchParam = (value: string | string[] | undefined) =>
    typeof value === 'string' ? value : null;
  const noticeId = singleSearchParam(searchParams.notice);
  const identifier = parseCourseOfferingIdentifier(params);
  if (!identifier) notFound();

  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  const courseOffering = await prisma.courseOffering.findUnique({
    where: { courseCode_year_semester: identifier },
    select: {
      course: { select: { name: true } },
      roadmap: { select: { id: true } },
      participants: {
        where: { userId: user.id, isActive: true },
        select: { role: true },
      },
    },
  });
  if (!courseOffering) {
    if (noticeId) {
      redirect(
        `/academic-overview?${new URLSearchParams({ notice: noticeId, noticeFallback: 'course-unavailable' })}`,
      );
    }
    notFound();
  }
  const academicTerm = await prisma.academicTerm.findUnique({
    where: { year_semester: { year: identifier.year, semester: identifier.semester } },
    select: { roadmapFreezeDate: true },
  });
  // U-Campus manda sobre el cargo: quien nunca abrió el curso obtiene su
  // participación al entrar. Con una participación vigente, la vista evita el
  // viaje a U-Campus y el cargo se actualiza en la siguiente operación.
  const participation =
    courseOffering.participants[0] ?? (await synchronizeParticipation(user, identifier));
  redirectUnavailableNotice(noticeId, participation, courseOffering.roadmap);
  const requestedNodeId = singleSearchParam(searchParams.targetNode) ?? undefined;
  const targetNodeId = await resolveNoticeTargetNode(
    user.id,
    identifier,
    requestedNodeId,
    participation?.role,
    noticeId,
  );
  const isTeaching = participation?.role === 'TEACHER';
  const isHistorical = Boolean(
    // This async Server Component evaluates the calendar for the current request.
    // eslint-disable-next-line react-hooks/purity
    academicTerm && academicTerm.roadmapFreezeDate.getTime() <= Date.now(),
  );
  const courseName = courseOffering.course.name ?? identifier.courseCode;
  const inboxIdentity = getInboxIdentity(user.id);
  const notificationOpeningId = courseOffering.roadmap
    ? await prepareOwnNoticeOpening(user.id, courseOffering.roadmap.id).catch(() => null)
    : null;

  return (
    <main className="bg-cloud lg:fixed lg:inset-x-0 lg:top-16 lg:bottom-0">
      <RoadmapCanvasSession
        notificationsEnabled={Boolean(inboxIdentity)}
        notificationOpeningId={notificationOpeningId}
        targetNodeId={targetNodeId}
        courseOffering={{ identifier, title: courseName }}
        experience={{
          kind: isTeaching ? 'teaching' : 'student',
          term: isHistorical ? 'historical' : 'current',
        }}
      />
      {inboxIdentity && singleSearchParam(searchParams.notice) ? (
        <RoadmapAvailabilityDialog
          noticeId={singleSearchParam(searchParams.notice)}
          courseCode={identifier.courseCode}
          year={identifier.year}
          semester={identifier.semester}
          courseName={courseName}
        />
      ) : null}
    </main>
  );
}
