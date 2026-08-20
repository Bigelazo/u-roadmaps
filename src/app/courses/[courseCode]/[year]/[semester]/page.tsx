import RoadmapCanvas from '@/components/RoadmapCanvas';
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
    include: {
      course: true,
      participants: user ? { where: { userId: user.id, isActive: true, role: 'TEACHER' } } : false,
    },
  });
  if (!courseOffering) notFound();
  const canEdit = Boolean(user && courseOffering?.participants.length);
  const courseName = courseOffering?.course.name ?? courseCode;

  return (
    <main className="min-h-screen bg-cloud">
      <RoadmapCanvas
        identifier={{ courseCode, year, semester }}
        canEdit={canEdit}
        title={courseName}
        subtitle={`${courseCode} · ${year}, semestre ${semester}${canEdit ? ' · Modo edición' : ''}`}
      />
    </main>
  );
}
