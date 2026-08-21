import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MapPinned } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

type ParticipationWithCourse = Prisma.ParticipacionGetPayload<{
  include: { courseOffering: { include: { course: true; roadmap: true } } };
}>;

function CourseOfferingCard({ role, courseOffering }: ParticipationWithCourse) {
  const href = `/courses/${encodeURIComponent(courseOffering.course.code)}/${courseOffering.year}/${courseOffering.semester}`;

  return (
    <li>
      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <p className="text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase">
            {courseOffering.year}, semestre {courseOffering.semester}
          </p>
          <h3 className="font-heading text-2xl font-semibold tracking-[-0.02em]">
            {courseOffering.course.code} · {courseOffering.course.name}
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {role === 'TEACHER' ? 'Personal docente' : 'Estudiante'} ·{' '}
            {courseOffering.course.department}
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Link
            className={buttonVariants({
              variant: courseOffering.roadmap ? 'default' : 'outline',
              className: 'w-full sm:w-auto',
            })}
            href={href}
          >
            {courseOffering.roadmap ? 'Abrir roadmap' : 'Ver curso'}
          </Link>
        </CardFooter>
      </Card>
    </li>
  );
}

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
  return (
    <main className="min-h-screen bg-cloud py-10 text-foreground md:py-16">
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="flex flex-col gap-10 md:gap-20">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
              Resumen académico
            </p>
            <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
              Hola, {user.name}
            </h1>
          </div>
          {participations.length === 0 ? (
            <Empty className="border bg-card py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapPinned aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No hay cursos para mostrar</EmptyTitle>
                <EmptyDescription>No tienes participaciones activas en cursos.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {currentOfferings.length > 0 && (
                <section
                  aria-labelledby="current-offerings-heading"
                  className="flex flex-col gap-4"
                >
                  <h2
                    className="font-heading text-2xl font-semibold tracking-[-0.02em]"
                    id="current-offerings-heading"
                  >
                    Cursos actuales
                  </h2>
                  <ul className="flex flex-col gap-4">
                    {currentOfferings.map((participation) => (
                      <CourseOfferingCard
                        key={participation.courseOffering.id}
                        {...participation}
                      />
                    ))}
                  </ul>
                </section>
              )}
              {historicalOfferings.length > 0 && (
                <section aria-labelledby="academic-history-heading" className="flex flex-col gap-4">
                  <h2
                    className="font-heading text-2xl font-semibold tracking-[-0.02em]"
                    id="academic-history-heading"
                  >
                    Historial académico
                  </h2>
                  <ul className="flex flex-col gap-4">
                    {historicalOfferings.map((participation) => (
                      <CourseOfferingCard
                        key={participation.courseOffering.id}
                        {...participation}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
