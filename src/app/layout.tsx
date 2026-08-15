import './globals.css';
import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import ThemeRegistry from '@/components/ThemeRegistry';
import DevelopmentBar from '@/components/DevelopmentBar';
import GlobalNavigation from '@/components/GlobalNavigation';
import { getApplicationSession } from '@/lib/auth';
import { developmentEnvironmentEnabled, developmentPersonas } from '@/lib/development';

export const metadata: Metadata = {
  title: 'Roadmaps Interactivos DCC - Universidad de Chile',
  description: 'Visualizador y gestor de rutas pedagógicas y asignaturas universitarias.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getApplicationSession();

  return (
    <html lang="es">
      <body>
        <AppRouterCacheProvider>
          <ThemeRegistry>
            <GlobalNavigation isAuthenticated={Boolean(session)} />
            {developmentEnvironmentEnabled() && <DevelopmentBar personas={developmentPersonas} />}
            {children}
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
