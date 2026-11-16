import { notFound } from 'next/navigation';
import { fixtureEnvironmentEnabled } from '@/shared/server/environment/development';

export const dynamic = 'force-dynamic';

export default function ServerErrorRehearsalPage() {
  if (!fixtureEnvironmentEnabled()) notFound();
  throw new Error('Fallo provocado para ensayar la página de error.');
}
