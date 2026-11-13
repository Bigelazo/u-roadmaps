import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { isFirstVisitInvitationDue } from '@/features/roadmap/server';
import { AcademicOverviewClient } from './AcademicOverviewClient';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';

export default async function AcademicOverviewPage(props: PageProps<'/academic-overview'>) {
  const searchParams = await props.searchParams;
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');

  return (
    <AcademicOverviewClient
      userId={user.id}
      notice={
        searchParams.accessLost === '1' ? (
          <Alert role="status">
            <AlertTitle>Ya no tienes acceso a ese roadmap</AlertTitle>
            <AlertDescription>
              Tu participación en el curso cambió. Aquí están los cursos en los que participas hoy.
            </AlertDescription>
          </Alert>
        ) : null
      }
      tutorialInvitation={await isFirstVisitInvitationDue(user.id)}
    />
  );
}
