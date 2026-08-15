import { notFound } from 'next/navigation';
import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import { developmentEnvironmentEnabled, developmentPersonas } from '@/lib/development';

export default function DevelopmentPersonasPage() {
  if (!developmentEnvironmentEnabled()) notFound();
  return (
    <Box component="main" sx={{ minHeight: '100vh', py: 6 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4 }}>
          <Stack spacing={2}>
            <Typography variant="overline" color="primary">
              Entorno de desarrollo
            </Typography>
            <Typography variant="h3">Seleccionar persona</Typography>
            <Typography color="text.secondary">
              Alterna entre los casos representativos usando la barra DESARROLLO.
            </Typography>
            {developmentPersonas.map((persona) => (
              <Typography key={persona.id}>{persona.label}</Typography>
            ))}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
