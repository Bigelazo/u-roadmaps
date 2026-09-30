import './globals.css';
import type { Metadata } from 'next';
import AuthenticationAlert from '@/app/_components/AuthenticationAlert';
import { DevelopmentBar, developmentPersonas } from '@/development';
import GlobalNavigation from '@/app/_components/GlobalNavigation';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';
import { developmentEnvironmentEnabled } from '@/shared/server/environment/development';
import { Archivo, Plus_Jakarta_Sans } from 'next/font/google';
import { cn } from 'cn';
import { getInboxIdentity } from '@/features/notifications/server';
import { NotificationsProvider } from '@/features/notifications';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const archivo = Archivo({ axes: ['wdth'], subsets: ['latin'], variable: '--font-archivo' });

export const metadata: Metadata = {
  title: 'U-Roadmaps',
  description: 'Visualizador y gestor de rutas pedagógicas y asignaturas universitarias.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getApplicationSession();
  const user = await resolveSessionUser(session);
  const inboxIdentity = user ? getInboxIdentity(user.id) : null;

  return (
    <html lang="es" className={cn('font-sans', plusJakartaSans.variable, archivo.variable)}>
      <body>
        <NotificationsProvider identity={inboxIdentity}>
          <GlobalNavigation
            isAuthenticated={Boolean(session)}
            userName={user?.name ?? null}
            inboxIdentity={inboxIdentity}
          />
          <AuthenticationAlert />
          {developmentEnvironmentEnabled() && <DevelopmentBar personas={developmentPersonas} />}
          {children}
        </NotificationsProvider>
      </body>
    </html>
  );
}
