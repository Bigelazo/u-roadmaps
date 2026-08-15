import RoadmapCanvas from '@/components/RoadmapCanvas';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Box } from '@mui/material';

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
          course: true,
          participants: {
            where: { userId: user.id, isActive: true, role: 'TEACHER' },
          },
        },
      })
    : null;
  const canEdit = Boolean(user && courseOffering?.participants.length);
  const courseName = courseOffering?.course.name ?? courseCode;

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: '#f8f8f9' }}>
      <RoadmapCanvas
        identifier={{ courseCode, year, semester }}
        canEdit={canEdit}
        title={courseName}
        subtitle={`${courseCode} · ${year}, semestre ${semester}${canEdit ? ' · Modo edición' : ''}`}
      />
    </Box>
  );
}
