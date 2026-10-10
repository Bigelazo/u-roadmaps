import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { randomUUID } from 'node:crypto';
import {
  parseCourseOfferingIdentifier,
  PostCreationInvitationDialog,
  RoadmapCanvasSession,
} from '@/features/roadmap';
import { readPostCreationInvitation, synchronizeParticipation } from '@/features/roadmap/server';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';
import { prisma } from '@/shared/server/db';
import { notFound, redirect } from 'next/navigation';
import { RoadmapEntryNotifications } from '@/features/notifications';
import { getInboxIdentity } from '@/features/notifications/server';

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
      roadmap: { select: { id: true, closedAt: true } },
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
  // Refresh stored roles on entry; an unavailable source preserves local access.
  const participation =
    (await synchronizeParticipation(user, identifier, roadmapChangePort)) ??
    courseOffering.participants[0];
  redirectUnavailableNotice(noticeId, participation, courseOffering.roadmap);
  const isTeaching = participation?.role === 'TEACHER';
  const isHistorical = Boolean(courseOffering.roadmap?.closedAt);
  const courseName = courseOffering.course.name ?? identifier.courseCode;
  const inboxIdentity = getInboxIdentity(user.id);
  const roadmapEntryKey = courseOffering.roadmap ? randomUUID() : null;
  // Landing here from Roadmap creation may show the one-time teaching tutorial invitation.
  const invitation =
    isTeaching && courseOffering.roadmap && searchParams.created === '1'
      ? await readPostCreationInvitation(user.id, courseOffering.roadmap.id)
      : null;

  return (
    <main className="bg-cloud lg:fixed lg:inset-x-0 lg:top-16 lg:bottom-0">
      <RoadmapEntryNotifications key={roadmapEntryKey}>
        <RoadmapCanvasSession
          notificationsEnabled={Boolean(inboxIdentity)}
          roadmapEntryKey={roadmapEntryKey}
          targetNodeId={
            noticeId ? undefined : (singleSearchParam(searchParams.targetNode) ?? undefined)
          }
          courseOffering={{ identifier, title: courseName }}
          experience={{
            kind: isTeaching ? 'teaching' : 'student',
            term: isHistorical ? 'historical' : 'current',
          }}
        />
      </RoadmapEntryNotifications>
      {invitation ? (
        <PostCreationInvitationDialog
          wording={invitation.wording}
          origin={`/courses/${encodeURIComponent(identifier.courseCode)}/${identifier.year}/${identifier.semester}`}
        />
      ) : null}
    </main>
  );
}
