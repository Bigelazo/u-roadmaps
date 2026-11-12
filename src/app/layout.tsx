import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import AuthenticationAlert from '@/app/_components/AuthenticationAlert';
import { DevelopmentBar, developmentPersonas } from '@/development';
import GlobalNavigation from '@/app/_components/GlobalNavigation';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';
import { isFramedRequest } from '@/app/_adapters/embedding';
import { developmentEnvironmentEnabled } from '@/shared/server/environment/development';
import { Plus_Jakarta_Sans, Poppins } from 'next/font/google';
import { cn } from 'cn';
import { getInboxIdentity } from '@/features/notifications/server';
import { NotificationsProvider } from '@/features/notifications';
import { AcademicCacheIdentity } from '@/features/academic-overview';
import { Toaster } from '@/shared/ui/toast';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const poppins = Poppins({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'U-Roadmaps',
  description:
    'Cada curso, una ruta clara. Explora contenidos, requisitos y recursos en una ruta que muestra tu avance.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, requestHeaders] = await Promise.all([getApplicationSession(), headers()]);
  const user = await resolveSessionUser(session);
  const framed = isFramedRequest(requestHeaders);
  const inboxIdentity = user ? getInboxIdentity(user.id) : null;

  return (
    <html lang="es" className={cn('font-sans', plusJakartaSans.variable, poppins.variable)}>
      <body>
        <NotificationsProvider identity={inboxIdentity}>
          <AcademicCacheIdentity userId={user?.id ?? null} />
          {framed ? null : (
            <GlobalNavigation
              isAuthenticated={Boolean(user)}
              userName={user?.name ?? null}
              inboxIdentity={inboxIdentity}
              developmentTools={
                developmentEnvironmentEnabled() ? (
                  <DevelopmentBar personas={developmentPersonas} />
                ) : null
              }
            />
          )}
          <AuthenticationAlert />
          {children}
          <Toaster limit={3} />
        </NotificationsProvider>
      </body>
    </html>
  );
}
