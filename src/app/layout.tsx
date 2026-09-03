import './globals.css';
import type { Metadata } from 'next';
import AuthenticationAlert from '@/app/_components/AuthenticationAlert';
import { DevelopmentBar, developmentPersonas } from '@/development';
import GlobalNavigation from '@/app/_components/GlobalNavigation';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';
import { developmentEnvironmentEnabled } from '@/shared/server/environment/development';
import { Archivo, Plus_Jakarta_Sans } from 'next/font/google';
import { cn } from '@/shared/lib/utils';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const archivo = Archivo({ axes: ['wdth'], subsets: ['latin'], variable: '--font-archivo' });

export const metadata: Metadata = {
  title: 'U-Roadmaps',
  description: 'Visualizador y gestor de rutas pedagógicas y asignaturas universitarias.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getApplicationSession();
  const user = await resolveSessionUser(session);

  return (
    <html lang="es" className={cn('font-sans', plusJakartaSans.variable, archivo.variable)}>
      <body>
        <GlobalNavigation isAuthenticated={Boolean(session)} userName={user?.name ?? null} />
        <AuthenticationAlert />
        {developmentEnvironmentEnabled() && <DevelopmentBar personas={developmentPersonas} />}
        {children}
      </body>
    </html>
  );
}
