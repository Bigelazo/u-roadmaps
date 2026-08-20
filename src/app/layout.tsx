import './globals.css';
import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import ThemeRegistry from '@/components/ThemeRegistry';
import AuthenticationAlert from '@/components/AuthenticationAlert';
import DevelopmentBar from '@/components/DevelopmentBar';
import GlobalNavigation from '@/components/GlobalNavigation';
import { getApplicationSession } from '@/lib/auth';
import { developmentEnvironmentEnabled, developmentPersonas } from '@/lib/development';
import { Archivo, Plus_Jakarta_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const archivo = Archivo({ subsets: ['latin'], variable: '--font-heading' });

export const metadata: Metadata = {
  title: 'Roadmaps Interactivos DCC - Universidad de Chile',
  description: 'Visualizador y gestor de rutas pedagógicas y asignaturas universitarias.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getApplicationSession();

  return (
    <html lang="es" className={cn('font-sans', plusJakartaSans.variable, archivo.variable)}>
      <body>
        <AppRouterCacheProvider>
          <ThemeRegistry>
            <GlobalNavigation isAuthenticated={Boolean(session)} />
            <AuthenticationAlert />
            {developmentEnvironmentEnabled() && <DevelopmentBar personas={developmentPersonas} />}
            {children}
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
