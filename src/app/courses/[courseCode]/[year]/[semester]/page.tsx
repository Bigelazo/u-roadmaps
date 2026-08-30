import RoadmapCanvas from '@/features/roadmap/RoadmapCanvas';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
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
  const courseOffering = await prisma.courseOffering.findUnique({
    where: { courseCode_year_semester: { courseCode, year, semester } },
    select: {
      course: { select: { name: true } },
      participants: {
        where: { userId: user.id, isActive: true, role: 'TEACHER' },
        select: { id: true },
      },
    },
  });
  if (!courseOffering) notFound();
  const canEdit = courseOffering.participants.length > 0;
  const courseName = courseOffering.course.name ?? courseCode;

  return (
    <main className="bg-cloud lg:fixed lg:inset-x-0 lg:top-16 lg:bottom-0">
      <RoadmapCanvas
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
