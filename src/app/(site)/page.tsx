import { redirect } from 'next/navigation';
import { AudienceFeatures } from '@/app/_components/landing/AudienceFeatures';
import { CourseRouteComparison } from '@/app/_components/landing/CourseRouteComparison';
import { LandingTutorialButton } from '@/app/_components/landing/LandingTutorialButton';
import { RevealStatement } from '@/app/_components/landing/RevealStatement';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';

const productStatement =
  '[U-Roadmaps] es una herramienta didáctica que busca [mejorar], [actualizar] y [revolucionar] la forma en la que estudiantes y docentes interactúan con los contenidos de un curso.';

export default async function Home() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (user) redirect('/academic-overview');

  return (
    <main className="bg-cloud text-foreground">
      <LandingTutorialButton />
      <div className="bg-brand-surface text-brand-surface-foreground">
        <section
          aria-labelledby="landing-title"
          className="mx-auto grid max-w-360 gap-8 px-4 pt-20 pb-16 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16 lg:px-12 lg:pt-16 lg:pb-20"
        >
          <h1
            id="landing-title"
            className="max-w-[15ch] font-heading text-[2.5rem] leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl xl:text-7xl"
          >
            Los contenidos de tus cursos merecen un mapa.
          </h1>
        </section>
      </div>

      <section
        aria-label="Qué es U-Roadmaps"
        className="mx-auto max-w-360 px-4 py-24 sm:px-6 md:py-40 lg:px-12"
      >
        <RevealStatement text={productStatement} />
      </section>

      <div className="bg-brand-surface text-brand-surface-foreground">
        <CourseRouteComparison />
      </div>

      <AudienceFeatures />
    </main>
  );
}
