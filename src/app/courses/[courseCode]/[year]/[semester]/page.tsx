import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { randomUUID } from 'node:crypto';
import {
  PostCreationInvitationDialog,
  RoadmapCanvasSession,
  type AnyRoadmapDto,
} from '@/features/roadmap';
import {
  readPostCreationInvitation,
  enterCourseOffering,
  readRoadmapForParticipant,
} from '@/features/roadmap/server';
import { parseCourseOfferingIdentifier } from '@/shared/course-offering';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';
import { prisma } from '@/shared/server/db';
import { notFound, redirect } from 'next/navigation';
import { RoadmapEntryNotices } from '@/app/_components/RoadmapEntryNotices';
import { RefreshOnParticipationChange } from '@/app/_components/RefreshOnParticipationChange';

function readRoadmapAsTheApiSendsIt(
  participant: Parameters<typeof readRoadmapForParticipant>[0],
): Promise<AnyRoadmapDto | null> {
  return readRoadmapForParticipant(participant).then(
    (roadmap) => JSON.parse(JSON.stringify(roadmap)) as AnyRoadmapDto,
    () => null,
  );
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
  const identifier = parseCourseOfferingIdentifier(params);
  if (!identifier) notFound();

  const user = await resolveSessionUser(await getApplicationSession(), {
    sharedAcademicHistory: true,
  });
  if (!user) redirect('/api/plogin/start');
  const { participation, participationChanged } = await enterCourseOffering(
    user,
    identifier,
    roadmapChangePort,
  );
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
  const entryRoadmap =
    courseOffering.roadmap && participation
      ? readRoadmapAsTheApiSendsIt({ userId: user.id, identifier })
      : undefined;
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
          entryRoadmap={entryRoadmap}
          courseOffering={{ identifier, title: courseName }}
          experience={{
            kind: isTeaching ? 'teaching' : 'student',
            term: isHistorical ? 'historical' : 'current',
          }}
        />
      </RoadmapEntryNotices>
      {participationChanged ? (
        <RefreshOnParticipationChange changed={participationChanged} />
      ) : null}
      {invitation ? (
        <PostCreationInvitationDialog
          wording={invitation.wording}
          origin={`/courses/${encodeURIComponent(identifier.courseCode)}/${identifier.year}/${identifier.semester}`}
        />
      ) : null}
    </main>
  );
}
