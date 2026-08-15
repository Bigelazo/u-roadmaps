import { redirect } from 'next/navigation';
import { getApplicationSession } from '@/lib/auth';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';

type Props = { searchParams: Promise<{ error?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  if (await getApplicationSession()) redirect('/');
  const { error: authenticationError } = await searchParams;
  const error = authenticationError
    ? 'No fue posible completar la autenticación institucional. Inténtalo nuevamente.'
    : null;
  return (
    <Box
      component="main"
      sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center', px: 2, py: 6 }}
    >
      <Paper
        component="section"
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 512,
          mx: 'auto',
          p: { xs: 4, sm: 6 },
          boxShadow: '0 2px 8px rgba(26, 26, 26, 0.08)',
        }}
      >
        <Stack spacing={3}>
          <Typography
            variant="overline"
            color="primary"
            sx={{ fontWeight: 600, letterSpacing: '0.16em' }}
          >
            U-roadmaps
          </Typography>
          <Typography variant="h3">Acceso institucional</Typography>
          <Typography color="text.secondary">
            Ingresa con tu identidad de Universidad de Chile mediante U-Pasaporte / VTI.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {process.env.NEXT_PUBLIC_VTI_LOGIN_URL ? (
            <Button component="a" href="/api/plogin/start" variant="contained" fullWidth>
              Autenticarse con U-Pasaporte / VTI
            </Button>
          ) : (
            <Alert severity="error">El acceso institucional no está configurado.</Alert>
          )}
          <Button href="/" variant="text">
            Volver al inicio
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
