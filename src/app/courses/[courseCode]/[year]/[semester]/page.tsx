import RoadmapCanvas from '@/components/RoadmapCanvas';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Props = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export default async function CoursePage({ params }: Props) {
  const { courseCode, year: yearParameter, semester: semesterParameter } = await params;
  const year = Number(yearParameter);
  const semester = Number(semesterParameter);
  const user = await resolveSessionUser(await getApplicationSession());
  const courseOffering = user
    ? await prisma.courseOffering.findUnique({
        where: { courseCode_year_semester: { courseCode, year, semester } },
        include: {
          participants: {
            where: { userId: user.id, isActive: true, role: 'TEACHER' },
          },
        },
      })
    : null;
  const canEdit = Boolean(user && courseOffering?.participants.length);

  return (
    <main className="min-h-screen bg-[#f7f7f7] px-4 py-8 text-[#1a1a1a] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1366px] space-y-6">
        <header className="rounded-2xl bg-[#1a1a1a] p-8 text-white">
          <p className="text-sm uppercase tracking-[0.16em] text-[#8ebdce]">Curso</p>
          <h1 className="mt-3 text-[24px] font-medium leading-[1.17]">{courseCode}</h1>
          <p className="mt-2 text-[#c2c2c2]">
            {year}, semestre {semester}
          </p>
        </header>
        <RoadmapCanvas identifier={{ courseCode, year, semester }} canEdit={canEdit} />
      </div>
    </main>
  );
}
