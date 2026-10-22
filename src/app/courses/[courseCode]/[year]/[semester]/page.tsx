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

async function readCourseCreationInvitation({
  userId,
  roadmapId,
  isTeaching,
  created,
}: {
  userId: string;
  roadmapId: string | undefined;
  isTeaching: boolean;
  created: string | string[] | undefined;
}) {
  if (!isTeaching || !roadmapId || created !== '1') return null;
  return readPostCreationInvitation(userId, roadmapId);
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
  // Refresh the stored Participation on entry, before reading it: a complete report can
  // grant, change or revoke it, and an unavailable source preserves local access.
  await synchronizeParticipation(user, identifier, roadmapChangePort);
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
    redirectUnavailableNotice(noticeId, null, null);
    notFound();
  }
  const participation = courseOffering.participants[0];
  redirectUnavailableNotice(noticeId, participation, courseOffering.roadmap);
  const isTeaching = participation?.role === 'TEACHER';
  const isHistorical = Boolean(courseOffering.roadmap?.closedAt);
  const courseName = courseOffering.course.name ?? identifier.courseCode;
  const inboxIdentity = getInboxIdentity(user.id);
  const roadmapEntryKey = courseOffering.roadmap ? randomUUID() : null;
  // Landing here from Roadmap creation may show the one-time teaching tutorial invitation.
  const invitation = await readCourseCreationInvitation({
    userId: user.id,
    roadmapId: courseOffering.roadmap?.id,
    isTeaching,
    created: searchParams.created,
  });

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
