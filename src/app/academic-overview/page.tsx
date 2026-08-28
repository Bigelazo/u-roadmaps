import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, BookOpen, MapPinned, Route } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getMufasaEnrolledCourses } from '@/lib/mufasa';

type ParticipationWithCourse = Prisma.ParticipacionGetPayload<{
  include: { courseOffering: { include: { course: true; roadmap: true } } };
}>;

type OverviewCourse = Readonly<{
  courseCode: string;
  name: string;
  department: string | null;
  year: number;
  semester: number;
  section: string | null;
  role: 'STUDENT' | 'TEACHER';
  hasRoadmap: boolean;
}>;

function termLabel({ year, semester }: Pick<OverviewCourse, 'year' | 'semester'>) {
  return `${semester === 1 ? 'Otoño' : 'Primavera'} ${year}`;
}

function localOverviewCourse({ role, courseOffering }: ParticipationWithCourse): OverviewCourse {
  return {
    courseCode: courseOffering.course.code,
    name: courseOffering.course.name,
    department: courseOffering.course.department,
    year: courseOffering.year,
    semester: courseOffering.semester,
    section: null,
    role,
    hasRoadmap: Boolean(courseOffering.roadmap),
  };
}

function courseKey(course: Pick<OverviewCourse, 'courseCode' | 'year' | 'semester'>) {
  return `${course.courseCode}:${course.year}:${course.semester}`;
}

function uniqueCourses(courses: OverviewCourse[]) {
  return Array.from(
    new Map(courses.map((course) => [courseKey(course), course])).values(),
  ).toSorted(
    (left, right) =>
      right.year - left.year ||
      right.semester - left.semester ||
      left.courseCode.localeCompare(right.courseCode, 'es-CL'),
  );
}

function CourseRow({ course }: Readonly<{ course: OverviewCourse }>) {
  return (
    <li className="min-w-0">
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
            <span>{course.courseCode}</span>
            {course.section ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Sección {course.section}</span>
              </>
            ) : null}
          </div>
          <h4 className="mt-2 font-heading text-xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-2xl">
            {course.name}
          </h4>
          <p className="mt-2 text-sm text-muted-foreground">
            {course.role === 'TEACHER' ? 'Equipo docente' : 'Inscrito como estudiante'}
            {course.department ? ` · ${course.department}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 sm:justify-end">
          <p
            className={
              course.hasRoadmap
                ? 'flex items-center gap-2 text-sm font-medium text-progress-deep'
                : 'flex items-center gap-2 text-sm text-muted-foreground'
            }
          >
            {course.hasRoadmap ? (
              <Route aria-hidden="true" size={17} />
            ) : (
              <BookOpen aria-hidden="true" size={17} />
            )}
            {course.hasRoadmap ? 'Roadmap disponible' : 'Sin roadmap'}
          </p>
          {course.hasRoadmap ? (
            <Link
              aria-label={`Abrir roadmap de ${course.name}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href={`/courses/${encodeURIComponent(course.courseCode)}/${course.year}/${course.semester}`}
            >
              Abrir roadmap
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

type TermGroup = Readonly<{
  year: number;
  semester: number;
  courses: OverviewCourse[];
}>;

type YearGroup = Readonly<{
  year: number;
  terms: TermGroup[];
}>;

function groupCoursesByAcademicTerm(courses: OverviewCourse[]): YearGroup[] {
  const years = new Map<number, TermGroup[]>();

  for (const course of courses) {
    const terms = years.get(course.year) ?? [];
    const term = terms.find((candidate) => candidate.semester === course.semester);

    if (term) {
      term.courses.push(course);
    } else {
      terms.push({ year: course.year, semester: course.semester, courses: [course] });
      years.set(course.year, terms);
    }
  }

  return Array.from(years, ([year, terms]) => ({ year, terms }));
}

function AcademicTermSection({ term }: Readonly<{ term: TermGroup }>) {
  const id = `term-${term.year}-${term.semester}`;

  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8"
    >
      <div className="flex items-baseline justify-between gap-4 md:block">
        <h3 className="font-heading text-2xl font-semibold tracking-[-0.02em]" id={id}>
          {termLabel(term)}
        </h3>
        <p className="shrink-0 text-sm text-muted-foreground md:mt-1">
          {term.courses.length} {term.courses.length === 1 ? 'curso' : 'cursos'}
        </p>
      </div>
      <ul className="divide-y divide-fog overflow-hidden rounded-xl border border-fog bg-card">
        {term.courses.map((course) => (
          <CourseRow course={course} key={courseKey(course)} />
        ))}
      </ul>
    </section>
  );
}

export default async function AcademicOverviewPage() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');

  const [mufasa, participations] = await Promise.all([
    getMufasaEnrolledCourses(user.rut),
    prisma.participation.findMany({
      where: { userId: user.id, isActive: true },
      include: { courseOffering: { include: { course: true, roadmap: true } } },
      orderBy: [{ courseOffering: { year: 'desc' } }, { courseOffering: { semester: 'desc' } }],
    }),
  ]);
  const localCourses = participations.map(localOverviewCourse);
  const localCoursesByKey = new Map(localCourses.map((course) => [courseKey(course), course]));
  const courses =
    mufasa.source === 'MUFASA'
      ? uniqueCourses(
          mufasa.courses.map((course) => {
            const localCourse = localCoursesByKey.get(courseKey(course));
            return {
              courseCode: course.courseCode,
              name: course.name,
              year: course.year,
              semester: course.semester,
              section: course.section,
              department: localCourse?.department ?? null,
              role: localCourse?.role ?? 'STUDENT',
              hasRoadmap: localCourse?.hasRoadmap ?? false,
            };
          }),
        )
      : uniqueCourses(localCourses);
  const coursesByYear = groupCoursesByAcademicTerm(courses);

  return (
    <main className="min-h-screen bg-cloud py-10 text-foreground md:py-16">
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="flex flex-col gap-10 md:gap-16">
          <header className="max-w-3xl">
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
              Resumen académico
            </p>
            <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
              Hola, {user.name}
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
              Tus cursos inscritos y el acceso a sus roadmaps, ordenados por período académico.
            </p>
          </header>

          {mufasa.source === 'LOCAL' ? (
            <div
              className="flex gap-3 rounded-lg border border-fog bg-card px-4 py-3 text-sm text-muted-foreground"
              role="status"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-primary"
                size={18}
              />
              <p>
                No fue posible actualizar tus cursos desde U-Campus. Mostramos los cursos con
                participación vigente en U-Roadmaps.
              </p>
            </div>
          ) : null}

          {courses.length === 0 ? (
            <Empty className="border bg-card py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapPinned aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No hay cursos para mostrar</EmptyTitle>
                <EmptyDescription>
                  {mufasa.source === 'LOCAL'
                    ? 'No tienes participaciones activas en cursos.'
                    : 'No hay cursos inscritos disponibles para este resumen académico.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-12 md:gap-16">
              {coursesByYear.map(({ year, terms }) => (
                <section
                  aria-labelledby={`year-${year}`}
                  className="flex flex-col gap-6"
                  key={year}
                >
                  <h2
                    className="border-b border-primary pb-3 font-heading text-3xl font-semibold tracking-[-0.03em]"
                    id={`year-${year}`}
                  >
                    {year}
                  </h2>
                  <div className="flex flex-col gap-8">
                    {terms.map((term) => (
                      <AcademicTermSection key={`${term.year}-${term.semester}`} term={term} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
