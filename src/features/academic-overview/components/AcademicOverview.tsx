import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, BookOpen, ChevronDown, MapPinned, Route } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { Separator } from '@/shared/ui/separator';
import type {
  AcademicOverviewCourse,
  AcademicOverviewInstitutionalPosition,
  AcademicOverviewPage,
  AcademicOverviewTerm,
} from '../types';

const institutionalPositionDetails: Record<
  AcademicOverviewInstitutionalPosition,
  Readonly<{ label: string; accentClass: string }>
> = {
  COORDINATING_PROFESSOR: {
    label: 'Profesor coordinador',
    accentClass: 'border-l-[#9acc24]',
  },
  COURSE_PROFESSOR: {
    label: 'Profesor de cátedra',
    accentClass: 'border-l-[#1d3193]',
  },
  AUXILIARY_PROFESSOR: {
    label: 'Auxiliar',
    accentClass: 'border-l-[#f0195c]',
  },
  TEACHING_ASSISTANT: { label: 'Ayudante', accentClass: 'border-l-[#933D8A]' },
  OBSERVER: { label: 'Oyente', accentClass: 'border-l-[#6f7a8a]' },
};

function termLabel({ year, semester }: Pick<AcademicOverviewTerm, 'year' | 'semester'>) {
  return `${semester === 1 ? 'Otoño' : 'Primavera'} ${year}`;
}

type RoadmapCreationAction = (props: {
  courseCode: string;
  courseName: string;
  semester: number;
  year: number;
}) => React.ReactNode;

function CourseRow({
  course,
  renderRoadmapCreation,
}: Readonly<{
  course: AcademicOverviewCourse;
  renderRoadmapCreation: RoadmapCreationAction;
}>) {
  const position = course.institutionalPosition
    ? institutionalPositionDetails[course.institutionalPosition]
    : course.role === 'TEACHER'
      ? { label: 'Equipo docente', accentClass: 'border-l-[#1d3193]' }
      : { label: 'Estudiante', accentClass: 'border-l-[#f4ce62]' };

  return (
    <li className={`min-w-0 border-l-4 ${position.accentClass}`}>
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
            {position.label}
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
          ) : course.canCreateRoadmap ? (
            renderRoadmapCreation({
              courseCode: course.courseCode,
              courseName: course.name,
              semester: course.semester,
              year: course.year,
            })
          ) : null}
        </div>
      </div>
    </li>
  );
}

function CourseList({
  term,
  renderRoadmapCreation,
}: Readonly<{ term: AcademicOverviewTerm; renderRoadmapCreation: RoadmapCreationAction }>) {
  return (
    <ul className="divide-y divide-fog overflow-hidden rounded-xl border border-fog bg-card">
      {term.courses.map((course) => (
        <CourseRow
          course={course}
          key={`${course.courseCode}:${course.year}:${course.semester}`}
          renderRoadmapCreation={renderRoadmapCreation}
        />
      ))}
    </ul>
  );
}

function AcademicTermSection({
  term,
  renderRoadmapCreation,
}: Readonly<{ term: AcademicOverviewTerm; renderRoadmapCreation: RoadmapCreationAction }>) {
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
      <CourseList renderRoadmapCreation={renderRoadmapCreation} term={term} />
    </section>
  );
}

export function AcademicOverview({
  overview,
  renderRoadmapCreation,
}: Readonly<{ overview: AcademicOverviewPage; renderRoadmapCreation: RoadmapCreationAction }>) {
  const [currentTerm, ...previousTerms] = overview.terms;

  return (
    <main className="min-h-screen bg-cloud py-10 text-foreground md:py-16">
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="flex flex-col gap-10 md:gap-16">
          <header className="max-w-3xl">
            <h1 className="font-heading text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
              Resumen académico
            </h1>
          </header>

          {overview.source === 'LOCAL' ? (
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

          {overview.terms.length === 0 ? (
            <Empty className="border bg-card py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapPinned aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No hay cursos para mostrar</EmptyTitle>
                <EmptyDescription>
                  {overview.source === 'LOCAL'
                    ? 'No tienes participaciones activas en cursos.'
                    : 'No hay cursos inscritos ni docentes disponibles para este resumen académico.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-12 md:gap-16">
              {currentTerm ? (
                <AcademicTermSection
                  renderRoadmapCreation={renderRoadmapCreation}
                  term={currentTerm}
                />
              ) : null}
              {previousTerms.length > 0 ? (
                <Collapsible>
                  <div className="flex flex-col items-start gap-1">
                    <CollapsibleTrigger className="group/previous-terms inline-flex cursor-pointer items-center gap-2 text-left font-heading text-3xl font-semibold tracking-[-0.02em] transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                      <span>Semestres anteriores</span>
                      <ChevronDown
                        aria-hidden="true"
                        className="shrink-0 transition-transform group-data-panel-open/previous-terms:rotate-180"
                        size={20}
                      />
                    </CollapsibleTrigger>
                    <span className="text-sm text-muted-foreground">
                      {previousTerms.length} {previousTerms.length === 1 ? 'semestre' : 'semestres'}
                    </span>
                  </div>
                  <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
                    <div className="pt-6">
                      <Separator />
                      <Accordion className="pt-4" multiple>
                        {previousTerms.map((term, index) => (
                          <AccordionItem
                            className="grid gap-4 not-last:border-b-0 md:grid-cols-[13rem_minmax(0,1fr)] md:[&>[data-slot=accordion-content]]:col-start-2 md:[&>[data-slot=separator]]:col-span-2"
                            key={`${term.year}-${term.semester}`}
                            value={`${term.year}-${term.semester}`}
                          >
                            {index > 0 ? <Separator /> : null}
                            <div className="flex flex-col items-start gap-1 pb-4">
                              <AccordionTrigger className="w-fit flex-none cursor-pointer gap-2 py-0 font-heading text-2xl font-semibold tracking-[-0.02em] transition-colors hover:text-primary hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50">
                                <span>{termLabel(term)}</span>
                              </AccordionTrigger>
                              <span className="text-sm text-muted-foreground">
                                {term.courses.length}{' '}
                                {term.courses.length === 1 ? 'curso' : 'cursos'}
                              </span>
                            </div>
                            <AccordionContent className="pb-4">
                              <CourseList
                                renderRoadmapCreation={renderRoadmapCreation}
                                term={term}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
