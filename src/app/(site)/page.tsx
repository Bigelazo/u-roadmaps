import { redirect } from 'next/navigation';
import { AudienceFeatures } from '@/app/_components/landing/AudienceFeatures';
import { CourseRouteComparison } from '@/app/_components/landing/CourseRouteComparison';
import { LandingRoute } from '@/app/_components/landing/LandingRoute';
import {
  HeroTutorialButton,
  LandingTutorialButton,
} from '@/app/_components/landing/LandingTutorialButton';
import { RevealStatement } from '@/app/_components/landing/RevealStatement';
import { RouteSpecimen } from '@/features/roadmap';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';

const productStatement =
  '[U-Roadmaps] es una herramienta didáctica que busca [mejorar], [actualizar] y [revolucionar] la forma en la que estudiantes y docentes interactúan con los contenidos de un curso.';

const cloudGrid =
  'bg-[radial-gradient(circle,var(--fog)_1.25px,transparent_1.75px)] [background-size:24px_24px]';
const brandGrid =
  'bg-[radial-gradient(circle,color-mix(in_srgb,var(--brand-surface-line)_45%,transparent)_1.25px,transparent_1.75px)] [background-size:24px_24px]';

export default async function Home() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (user) redirect('/academic-overview');

  return (
    <main data-landing className={`relative bg-cloud text-foreground ${cloudGrid}`}>
      <LandingTutorialButton />
      <div
        data-route-surface="brand"
        className={`relative overflow-hidden bg-brand-surface text-brand-surface-foreground ${brandGrid}`}
      >
        <section
          aria-labelledby="landing-title"
          className="relative mx-auto flex max-w-360 flex-col px-4 pt-14 pb-12 sm:px-6 lg:h-[clamp(32rem,calc(100svh-8rem),47rem)] lg:px-12 lg:pt-18 lg:pb-16"
        >
          <h1
            id="landing-title"
            className="relative z-10 max-w-[11ch] font-heading text-[2.75rem] leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl lg:text-[4.5rem] lg:leading-[0.96] xl:text-[5.25rem]"
          >
            Los contenidos de tus cursos merecen un mapa.
          </h1>
          <div
            data-route-anchor="out"
            className="relative z-10 mt-8 self-start lg:order-last lg:mt-auto"
          >
            <HeroTutorialButton />
          </div>
          <RouteSpecimen
            variant="hero"
            className="mt-6 lg:absolute lg:inset-y-3 lg:right-6 lg:left-[38.75rem] lg:mt-0 lg:w-auto"
            canvasClassName="lg:h-full"
          />
        </section>
      </div>

      <section
        aria-label="Qué es U-Roadmaps"
        className="mx-auto max-w-360 px-4 pt-20 pb-24 sm:px-6 lg:px-12 lg:pt-12 lg:pb-28"
      >
        <div className="pl-6 lg:pl-72 xl:pl-80">
          <span data-route-anchor="in" aria-hidden="true" className="block size-0" />
          <RevealStatement text={productStatement} className="mt-6" />
          <span data-route-anchor="out" aria-hidden="true" className="mt-10 block size-0" />
        </div>
      </section>

      <div
        data-route-surface="brand"
        className={`bg-brand-surface text-brand-surface-foreground ${brandGrid}`}
      >
        <CourseRouteComparison />
      </div>

      <AudienceFeatures />
      <LandingRoute />
    </main>
  );
}
