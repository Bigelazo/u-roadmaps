import { GraduationCap } from 'lucide-react';
import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import SessionButton from '@/components/SessionButton';
import VtiInformation from '@/components/VtiInformation';
import { getApplicationSession } from '@/lib/auth';

export default async function Home() {
  const session = await getApplicationSession();
  return (
    <Box component="main" sx={{ minHeight: '100vh' }}>
      <Box
        component="header"
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Container
          maxWidth="xl"
          sx={{ height: 64, display: 'flex', alignItems: 'center', px: { xs: 2, sm: 3 } }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                p: 1,
                borderRadius: 2,
                bgcolor: '#c9e0fc',
                color: 'primary.main',
              }}
            >
              <GraduationCap size={24} />
            </Box>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                FCFM - Universidad de Chile
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Departamento de Ciencias de la Computación
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ ml: 'auto' }}>
            <SessionButton isAuthenticated={Boolean(session)} />
          </Box>
        </Container>
      </Box>
      <Container maxWidth="xl" sx={{ py: 6 }}>
        <Paper sx={{ p: { xs: 4, sm: 6 }, bgcolor: '#1a1a1a', color: 'common.white' }}>
          <Stack spacing={2} sx={{ maxWidth: 'md' }}>
            <Typography variant="overline" sx={{ color: '#c9e0fc', letterSpacing: '0.16em' }}>
              U-roadmaps
            </Typography>
            <Typography variant="h2">Rutas de aprendizaje para cursos universitarios</Typography>
            <Typography variant="body1" sx={{ color: '#c2c2c2', fontSize: '1.125rem' }}>
              Los roadmaps se identifican por ramo y período académico. La integración con U-Campus
              mediante Mufasa materializará aquí los cursos que necesiten una ruta.
            </Typography>
          </Stack>
        </Paper>
        {session?.vtiClaims && <VtiInformation claims={session.vtiClaims} />}
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
