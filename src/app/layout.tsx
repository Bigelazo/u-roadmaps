import './globals.css';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import AuthenticationAlert from '@/app/_components/AuthenticationAlert';
import { DevelopmentBar, developmentPersonas } from '@/development';
import GlobalNavigation from '@/app/_components/GlobalNavigation';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';
import { isFramedRequest } from '@/app/_adapters/embedding';
import { developmentEnvironmentEnabled } from '@/shared/server/environment/development';
import { Plus_Jakarta_Sans, Poppins } from 'next/font/google';
import { cn } from 'cn';
import { getInboxIdentity, readOwnInbox } from '@/features/notifications/server';
import { NotificationsProvider } from '@/features/notifications';
import { AcademicCacheIdentity } from '@/features/academic-overview';
import { Toaster } from '@/shared/ui/toast';
import { parseThemePreference, themeCookieName } from '@/shared/theme-preference';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const poppins = Poppins({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'U-Roadmaps',
  description:
    'Los contenidos de tus cursos merecen un mapa. Ordena clases, evaluaciones y material en una ruta con requisitos y fechas, donde cada estudiante ve su avance.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, requestHeaders, requestCookies] = await Promise.all([
    getApplicationSession(),
    headers(),
    cookies(),
  ]);
  const theme = parseThemePreference(requestCookies.get(themeCookieName)?.value);
  const user = await resolveSessionUser(session);
  const framed = isFramedRequest(requestHeaders);
  const inboxIdentity = user ? getInboxIdentity(user.id) : null;
  const inbox = user
    ? readOwnInbox(user.id).catch((error: unknown) => {
        console.error('[inbox] no se pudo leer la bandeja', error);
        return null;
      })
    : null;

  return (
    <html
      lang="es"
      data-theme={theme}
      className={cn('font-sans', plusJakartaSans.variable, poppins.variable)}
    >
      <body>
        <NotificationsProvider identity={inboxIdentity} inbox={inbox}>
          <AcademicCacheIdentity userId={user?.id ?? null} />
          {framed ? null : (
            <GlobalNavigation
              isAuthenticated={Boolean(user)}
              userName={user?.name ?? null}
              inboxIdentity={inboxIdentity}
              theme={theme}
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
