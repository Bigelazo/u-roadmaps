import { redirect } from 'next/navigation';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';

export default async function AcademicOverviewLayout({
  children,
}: LayoutProps<'/academic-overview'>) {
  if (!(await resolveSessionUser(await getApplicationSession()))) redirect('/api/plogin/start');
  return children;
}
