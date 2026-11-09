import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { randomUUID } from 'node:crypto';
import {
  parseCourseOfferingIdentifier,
  PostCreationInvitationDialog,
  RoadmapCanvasSession,
} from '@/features/roadmap';
import { readPostCreationInvitation, synchronizeCourseOffering } from '@/features/roadmap/server';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';
import { prisma } from '@/shared/server/db';
import { notFound, redirect } from 'next/navigation';
import { RoadmapEntryNotices } from '@/app/_components/RoadmapEntryNotices';

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
  const identifier = parseCourseOfferingIdentifier(params);
  if (!identifier) notFound();

  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  const { participation } = await synchronizeCourseOffering(user, identifier, roadmapChangePort);
  const courseOffering = await prisma.courseOffering.findUnique({
    where: { courseCode_year_semester: identifier },
    select: {
      course: { select: { name: true } },
      roadmap: { select: { id: true, closedAt: true } },
    },
  });
  if (!courseOffering) notFound();
  const isTeaching = participation?.role === 'TEACHER';
  const isHistorical = Boolean(courseOffering.roadmap?.closedAt);
  const courseName = courseOffering.course.name ?? identifier.courseCode;
  const roadmapEntryKey = courseOffering.roadmap ? randomUUID() : null;
  const invitation = await readCourseCreationInvitation({
    userId: user.id,
    roadmapId: courseOffering.roadmap?.id,
    isTeaching,
    created: searchParams.created,
  });

  return (
    <main data-viewport-page className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-cloud">
      <RoadmapEntryNotices key={roadmapEntryKey}>
        <RoadmapCanvasSession
          notificationsEnabled
          roadmapEntryKey={roadmapEntryKey}
          courseOffering={{ identifier, title: courseName }}
          experience={{
            kind: isTeaching ? 'teaching' : 'student',
            term: isHistorical ? 'historical' : 'current',
          }}
        />
      </RoadmapEntryNotices>
      {invitation ? (
        <PostCreationInvitationDialog
          wording={invitation.wording}
          origin={`/courses/${encodeURIComponent(identifier.courseCode)}/${identifier.year}/${identifier.semester}`}
        />
      ) : null}
    </main>
  );
}
