import { parseCourseOfferingIdentifier, RoadmapCanvas, RoadmapCanvasSession } from '@/features/roadmap';
import { synchronizeParticipation } from '@/features/roadmap/server';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';
import { prisma } from '@/shared/server/db';
import { notFound, redirect } from 'next/navigation';

export default async function CoursePage(
  props: PageProps<'/courses/[courseCode]/[year]/[semester]'>,
) {
  const params = await props.params;
  const identifier = parseCourseOfferingIdentifier(params);
  if (!identifier) notFound();

  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  const courseOffering = await prisma.courseOffering.findUnique({
    where: { courseCode_year_semester: identifier },
    select: {
      course: { select: { name: true } },
      participants: {
        where: { userId: user.id, isActive: true },
        select: { role: true },
      },
    },
  });
  if (!courseOffering) notFound();
  const academicTerm = await prisma.academicTerm.findUnique({
    where: { year_semester: { year: identifier.year, semester: identifier.semester } },
    select: { roadmapFreezeDate: true },
  });
  // U-Campus manda sobre el cargo: quien nunca abrió el curso obtiene su
  // participación al entrar. Con una participación vigente, la vista evita el
  // viaje a U-Campus y el cargo se actualiza en la siguiente operación.
  const participation =
    courseOffering.participants[0] ?? (await synchronizeParticipation(user, identifier));
  const canPreview = participation?.role === 'TEACHER';
  const isHistorical = Boolean(
    // This async Server Component evaluates the calendar for the current request.
    // eslint-disable-next-line react-hooks/purity
    academicTerm && academicTerm.roadmapFreezeDate.getTime() <= Date.now(),
  );
  const canEdit = canPreview && !isHistorical;
  const courseName = courseOffering.course.name ?? identifier.courseCode;

  return (
    <main className="bg-cloud lg:fixed lg:inset-x-0 lg:top-16 lg:bottom-0">
      {canPreview ? (
        <RoadmapCanvas
          key={`${identifier.courseCode}-${identifier.year}-${identifier.semester}`}
          identifier={identifier}
          canEdit={canEdit}
          canPreview={canPreview}
          isHistorical={isHistorical}
          title={courseName}
          courseCode={identifier.courseCode}
          year={identifier.year}
          semester={identifier.semester}
        />
      ) : (
        <RoadmapCanvasSession
          courseOffering={{ identifier, title: courseName }}
          experience={{ kind: 'student', term: isHistorical ? 'historical' : 'current' }}
        />
      )}
    </main>
  );
}
