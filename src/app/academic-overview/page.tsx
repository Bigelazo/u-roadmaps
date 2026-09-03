import { redirect } from 'next/navigation';
import { AcademicOverview } from '@/features/academic-overview';
import { getAcademicOverviewPage } from '@/features/academic-overview/server';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';

export default async function AcademicOverviewPage() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');

  return <AcademicOverview overview={await getAcademicOverviewPage(user)} />;
}
