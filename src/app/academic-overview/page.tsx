import Link from 'next/link';
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
          {participations.map(({ role, courseOffering }) => {
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
                  {courseOffering.roadmap ? (
                    <Button component={Link} href={href} variant="contained">
                      Abrir roadmap
                    </Button>
                  ) : (
                    <Typography color="text.secondary">
                      Aún no hay roadmap para esta oferta.
                    </Typography>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Container>
    </Box>
  );
}
