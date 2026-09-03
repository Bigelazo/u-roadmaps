import { RoadmapCanvas } from '@/features/roadmap';
import { synchronizeParticipation } from '@/features/roadmap/server';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';
import { prisma } from '@/shared/server/db';
import { notFound, redirect } from 'next/navigation';

type Props = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export default async function CoursePage({ params }: Props) {
  const { courseCode, year: yearParameter, semester: semesterParameter } = await params;
  const year = Number(yearParameter);
  const semester = Number(semesterParameter);
  if (!courseCode.trim() || !Number.isInteger(year) || year < 1 || ![1, 2].includes(semester)) {
    notFound();
  }
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  const identifier = { courseCode, year, semester };
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
  // U-Campus manda sobre el cargo: quien nunca abrió el curso obtiene su
  // participación al entrar. Con una participación vigente, la vista evita el
  // viaje a U-Campus y el cargo se actualiza en la siguiente operación.
  const participation =
    courseOffering.participants[0] ?? (await synchronizeParticipation(user, identifier));
  const canEdit = participation?.role === 'TEACHER';
  const courseName = courseOffering.course.name ?? courseCode;

  return (
    <main className="bg-cloud lg:fixed lg:inset-x-0 lg:top-16 lg:bottom-0">
      <RoadmapCanvas
        key={`${courseCode}-${year}-${semester}`}
        identifier={{ courseCode, year, semester }}
        canEdit={canEdit}
        title={courseName}
        courseCode={courseCode}
        year={year}
        semester={semester}
      />
    </main>
  );
}
