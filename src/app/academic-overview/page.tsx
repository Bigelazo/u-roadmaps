import { redirect } from 'next/navigation';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function AcademicOverviewPage() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/auth/signin');
  const participations = await prisma.participation.findMany({
    where: { userId: user.id, isActive: true },
    include: { courseOffering: { include: { course: true, roadmap: true } } },
    orderBy: [{ courseOffering: { year: 'desc' } }, { courseOffering: { semester: 'desc' } }],
  });
  const today = new Date();
  const currentTerm = { year: today.getFullYear(), semester: today.getMonth() >= 6 ? 2 : 1 };
  const currentOfferings = participations.filter(
    ({ courseOffering }) =>
      courseOffering.year === currentTerm.year && courseOffering.semester === currentTerm.semester,
  );
  const historicalOfferings = participations.filter(
    ({ courseOffering }) =>
      courseOffering.year !== currentTerm.year || courseOffering.semester !== currentTerm.semester,
  );
  function offeringCard({ role, courseOffering }: (typeof participations)[number]) {
    const href = `/courses/${encodeURIComponent(courseOffering.course.code)}/${courseOffering.year}/${courseOffering.semester}`;
    return (
      <Paper key={courseOffering.id} sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Box>
            <Typography variant="overline">
              {courseOffering.year}, semestre {courseOffering.semester}
            </Typography>
            <Typography variant="h5">
              {courseOffering.course.code} · {courseOffering.course.name}
            </Typography>
            <Typography color="text.secondary">
              {role === 'TEACHER' ? 'Personal docente' : 'Estudiante'} ·{' '}
              {courseOffering.course.department}
            </Typography>
          </Box>
          <Button href={href} variant={courseOffering.roadmap ? 'contained' : 'outlined'}>
            {courseOffering.roadmap ? 'Abrir roadmap' : 'Ver curso'}
          </Button>
        </Stack>
      </Paper>
    );
  }
  return (
    <Box component="main" sx={{ minHeight: '100vh', py: 4 }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="primary">
              Resumen académico
            </Typography>
            <Typography variant="h3">Hola, {user.name}</Typography>
          </Box>
          {currentOfferings.length > 0 && (
            <>
              <Typography variant="h5">Cursos actuales</Typography>
              {currentOfferings.map(offeringCard)}
            </>
          )}
          {historicalOfferings.length > 0 && (
            <>
              <Typography variant="h5">Historial académico</Typography>
              {historicalOfferings.map(offeringCard)}
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
