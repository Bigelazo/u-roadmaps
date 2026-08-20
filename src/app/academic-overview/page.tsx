import { redirect } from 'next/navigation';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function AcademicOverviewPage() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  const participations = await prisma.participation.findMany({
    where: { userId: user.id, isActive: true },
    include: { courseOffering: { include: { course: true, roadmap: true } } },
    orderBy: [{ courseOffering: { year: 'desc' } }, { courseOffering: { semester: 'desc' } }],
  });
  const today = new Date();
  const currentTerm = { year: today.getFullYear(), semester: today.getMonth() >= 6 ? 2 : 1 };
  const currentOfferings = participations.filter(
    ({ courseOffering }) =>
      courseOffering.year === currentTerm.year && courseOffering.semester === currentTerm.semester,
  );
  const historicalOfferings = participations.filter(
    ({ courseOffering }) =>
      courseOffering.year !== currentTerm.year || courseOffering.semester !== currentTerm.semester,
  );
  function offeringCard({ role, courseOffering }: (typeof participations)[number]) {
    const href = `/courses/${encodeURIComponent(courseOffering.course.code)}/${courseOffering.year}/${courseOffering.semester}`;
    return (
      <article
        className="rounded-[var(--radius-xl)] border border-[#dce1e8] bg-white p-6"
        key={courseOffering.id}
      >
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-[#5a6474] uppercase">
              {courseOffering.year}, semestre {courseOffering.semester}
            </p>
            <h3 className="mt-1 font-heading text-2xl font-semibold tracking-[-0.02em]">
              {courseOffering.course.code} · {courseOffering.course.name}
            </h3>
            <p className="mt-1 text-sm text-[#5a6474]">
              {role === 'TEACHER' ? 'Personal docente' : 'Estudiante'} ·{' '}
              {courseOffering.course.department}
            </p>
          </div>
          <Link
            className={buttonVariants({ variant: courseOffering.roadmap ? 'default' : 'outline' })}
            href={href}
          >
            {courseOffering.roadmap ? 'Abrir roadmap' : 'Ver curso'}
          </Link>
        </div>
      </article>
    );
  }
  return (
    <main className="min-h-screen bg-[#f3f5f7] py-10 text-[#12213a] md:py-16">
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="space-y-10">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-[#024ad8] uppercase">
              Resumen académico
            </p>
            <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
              Hola, {user.name}
            </h1>
          </div>
          {currentOfferings.length > 0 && (
            <section aria-labelledby="current-offerings-heading" className="space-y-4">
              <h2
                className="font-heading text-2xl font-semibold tracking-[-0.02em]"
                id="current-offerings-heading"
              >
                Cursos actuales
              </h2>
              <div className="space-y-4">{currentOfferings.map(offeringCard)}</div>
            </section>
          )}
          {historicalOfferings.length > 0 && (
            <section aria-labelledby="academic-history-heading" className="space-y-4">
              <h2
                className="font-heading text-2xl font-semibold tracking-[-0.02em]"
                id="academic-history-heading"
              >
                Historial académico
              </h2>
              <div className="space-y-4">{historicalOfferings.map(offeringCard)}</div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
