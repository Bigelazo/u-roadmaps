import { redirect } from 'next/navigation';
import CreateRoadmapButton from '@/app/_components/CreateRoadmapButton';
import { AcademicOverview } from '@/features/academic-overview';
import { getAcademicOverviewPage } from '@/features/academic-overview/server';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';
import { getInboxIdentity } from '@/features/notifications/server';

export default async function AcademicOverviewPage() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');

  return (
    <AcademicOverview
      overview={await getAcademicOverviewPage(user)}
      notificationsEnabled={Boolean(getInboxIdentity(user.id))}
      renderRoadmapCreation={(course) => <CreateRoadmapButton {...course} />}
    />
  );
}
