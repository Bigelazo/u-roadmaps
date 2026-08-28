import './globals.css';
import type { Metadata } from 'next';
import AuthenticationAlert from '@/components/app-shell/AuthenticationAlert';
import DevelopmentBar from '@/components/app-shell/DevelopmentBar';
import GlobalNavigation from '@/components/app-shell/GlobalNavigation';
import { getApplicationSession } from '@/lib/auth';
import { developmentEnvironmentEnabled, developmentPersonas } from '@/lib/development';
import { Archivo, Plus_Jakarta_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const archivo = Archivo({ axes: ['wdth'], subsets: ['latin'], variable: '--font-archivo' });

export const metadata: Metadata = {
  title: 'U-Roadmaps',
  description: 'Visualizador y gestor de rutas pedagógicas y asignaturas universitarias.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getApplicationSession();

  return (
    <html lang="es" className={cn('font-sans', plusJakartaSans.variable, archivo.variable)}>
      <body>
        <GlobalNavigation isAuthenticated={Boolean(session)} />
        <AuthenticationAlert />
        {developmentEnvironmentEnabled() && <DevelopmentBar personas={developmentPersonas} />}
        {children}
      </body>
    </html>
  );
}
