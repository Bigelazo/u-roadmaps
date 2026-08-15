import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { ArrowRight, BookOpen, ListChecks, Map as MapIcon } from 'lucide-react';
import { redirect } from 'next/navigation';
import Link from '@/components/Link';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';

export default async function Home() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (user) redirect('/academic-overview');

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: '#f7f7f7' }}>
      <Container maxWidth="xl" sx={{ py: { xs: 4, sm: 8 } }}>
        <Stack spacing={{ xs: 5, sm: 8 }}>
          <Paper
            sx={{
              position: 'relative',
              overflow: 'hidden',
              p: { xs: 4, sm: 7 },
              bgcolor: '#1a1a1a',
              color: 'common.white',
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: { xs: 72, sm: 160 },
                height: '100%',
                bgcolor: '#024ad8',
              }}
            />
            <Stack spacing={3} sx={{ position: 'relative', maxWidth: 700 }}>
              <Typography variant="overline" sx={{ color: '#c9e0fc', letterSpacing: '0.16em' }}>
                U-ROADMAPS · DCC
              </Typography>
              <Typography
                component="h1"
                sx={{ fontSize: { xs: 38, sm: 56 }, fontWeight: 500, lineHeight: 1 }}
              >
                Entiende el camino antes de recorrerlo.
              </Typography>
              <Typography
                sx={{
                  maxWidth: 590,
                  color: '#e8e8e8',
                  fontSize: { xs: 17, sm: 20 },
                  lineHeight: 1.5,
                }}
              >
                U-Roadmaps muestra cómo se conectan los contenidos de tus cursos para que puedas
                preparar cada unidad con una visión clara de sus requisitos y recursos.
              </Typography>
              <Button
                component={Link}
                href="/auth/signin"
                variant="contained"
                endIcon={<ArrowRight size={18} />}
                sx={{ alignSelf: 'start', px: 3 }}
              >
                Ingresar con U-Pasaporte
              </Button>
            </Stack>
          </Paper>

          <Box>
            <Typography variant="overline" color="primary" sx={{ letterSpacing: '0.14em' }}>
              UNA RUTA PARA CADA CURSO
            </Typography>
            <Typography
              component="h2"
              sx={{ mt: 1, fontSize: { xs: 28, sm: 36 }, fontWeight: 500 }}
            >
              Lo importante, en el orden que importa.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2,
                mt: 3,
              }}
            >
              {[
                {
                  icon: MapIcon,
                  title: 'Explora el mapa del curso',
                  description:
                    'Visualiza unidades, evaluaciones y materiales complementarios en una sola ruta.',
                },
                {
                  icon: ListChecks,
                  title: 'Sigue tu avance',
                  description:
                    'Identifica qué contenidos ya completaste y cuáles debes preparar antes de continuar.',
                },
                {
                  icon: BookOpen,
                  title: 'Encuentra recursos a tiempo',
                  description:
                    'Accede a lecturas, archivos y enlaces asociados directamente a cada tema.',
                },
              ].map(({ icon: Icon, title, description }) => (
                <Paper key={title} variant="outlined" sx={{ p: 3, minHeight: 220 }}>
                  <Box
                    sx={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 44,
                      height: 44,
                      mb: 3,
                      bgcolor: '#c9e0fc',
                      color: '#024ad8',
                      borderRadius: 1,
                    }}
                  >
                    <Icon size={23} strokeWidth={2} />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    {title}
                  </Typography>
                  <Typography color="text.secondary">{description}</Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        </Stack>
      </Container>
      <Box
        component="footer"
        sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', py: 3 }}
      >
        <Container maxWidth="xl">
          <Typography variant="caption" color="text.secondary">
            © 2026 Propuesta de Memoria DCC - Universidad de Chile.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
