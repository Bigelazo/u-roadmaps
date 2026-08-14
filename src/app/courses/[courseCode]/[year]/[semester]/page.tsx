import RoadmapCanvas from '@/components/RoadmapCanvas';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Box, Container, Paper, Typography } from '@mui/material';

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
    <Box component="main" sx={{ minHeight: '100vh', py: 4 }}>
      <Container maxWidth={false} sx={{ maxWidth: 1366, display: 'grid', gap: 3 }}>
        <Paper component="header" sx={{ p: 4, bgcolor: '#1a1a1a', color: 'common.white' }}>
          <Typography variant="overline" sx={{ color: '#c9e0fc', letterSpacing: '0.16em' }}>
            Curso
          </Typography>
          <Typography variant="h3" sx={{ mt: 1 }}>
            {courseCode}
          </Typography>
          <Typography color="#c2c2c2" sx={{ mt: 1 }}>
            {year}, semestre {semester}
          </Typography>
        </Paper>
        <RoadmapCanvas identifier={{ courseCode, year, semester }} canEdit={canEdit} />
      </Container>
    </Box>
  );
}
