import Link from 'next/link';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  History,
  MapPinned,
  Route,
  Users,
} from 'lucide-react';
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
import { courseParticipantsUrl, termLabel } from '@/shared/course-offering';
import { dividedListClassName, PageShell, PageTitle } from '@/shared/ui/page-layout';
import { NotificationCountButton } from '@/features/notifications/client';
import { versionHistoryUrl } from '@/shared/version-history-url';
import { buttonVariants } from '@/shared/ui/button-variants';
import { cn } from 'cn';
import { AcademicOverviewTutorialButton } from './AcademicOverviewTutorialButton';

const positionDetails: Record<
  AcademicOverviewInstitutionalPosition | 'TEACHING_STAFF',
  Readonly<{ label: string; color: string | null }>
> = {
  TEACHING_STAFF: { label: 'Equipo docente', color: null },
  COORDINATING_PROFESSOR: {
    label: 'Profesor coordinador',
    color: 'var(--position-coordinating-professor)',
  },
  COURSE_PROFESSOR: { label: 'Profesor de cátedra', color: 'var(--position-course-professor)' },
  AUXILIARY_PROFESSOR: { label: 'Auxiliar', color: 'var(--position-auxiliary-professor)' },
  TEACHING_ASSISTANT: { label: 'Ayudante', color: 'var(--position-teaching-assistant)' },
  STUDENT: { label: 'Estudiante', color: 'var(--position-student)' },
  OBSERVER: { label: 'Oyente', color: 'var(--position-observer)' },
};

function PositionPlate({
  position,
}: Readonly<{ position: (typeof positionDetails)[keyof typeof positionDetails] }>) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm bg-[color-mix(in_srgb,var(--position-color)_16%,var(--card))] px-2 py-0.5 text-xs font-bold text-ink"
      style={{ '--position-color': position.color ?? 'var(--steel)' } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className={
          position.color
            ? 'size-2 shrink-0 rounded-full bg-(--position-color)'
            : 'size-2 shrink-0 rounded-full border border-graphite'
        }
      />
      {position.label}
    </span>
  );
}

function CourseProgress({
  progress,
}: Readonly<{ progress: NonNullable<AcademicOverviewCourse['progress']> }>) {
  const { completedNodes, visibleNodes } = progress;
  const percent = Math.round((completedNodes / visibleNodes) * 100);
  return (
    <div className="mt-4 flex max-w-md items-center gap-3">
      <div
        aria-hidden="true"
        className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-progress-soft"
      >
        <div className="h-full rounded-full bg-progress" style={{ width: `${percent}%` }} />
      </div>
      <p
        className={
          completedNodes > 0
            ? 'shrink-0 text-sm font-medium text-progress-deep tabular-nums'
            : 'shrink-0 text-sm text-muted-foreground'
        }
      >
        {completedNodes > 0 ? (
          <>
            {completedNodes} de {visibleNodes} {visibleNodes === 1 ? 'nodo' : 'nodos'}
            <span className="sr-only"> completados, {percent} %</span>
          </>
        ) : (
          'Aún no completas nodos'
        )}
      </p>
    </div>
  );
}

function roadmapUrl(course: AcademicOverviewCourse) {
  return `/courses/${encodeURIComponent(course.courseCode)}/${course.year}/${course.semester}`;
}

function courseCountLabel(count: number) {
  return `${count} ${count === 1 ? 'curso' : 'cursos'}`;
}

type RoadmapCreationAction = (props: {
  courseCode: string;
  courseName: string;
  semester: number;
  year: number;
}) => React.ReactNode;

type CourseHeadingLevel = 'h3' | 'h4';

function CourseRoadmapAction({
  course,
  isPastOffering,
  awaitsCreation,
  renderRoadmapCreation,
}: Readonly<{
  course: AcademicOverviewCourse;
  isPastOffering: boolean;
  awaitsCreation: boolean;
  renderRoadmapCreation: RoadmapCreationAction;
}>) {
  if (course.hasRoadmap) {
    return (
      <>
        <NotificationCountButton
          filter={{
            courseCode: course.courseCode,
            year: course.year,
            semester: course.semester,
          }}
          label={`el curso ${course.name}`}
        />
        {isPastOffering ? (
          <Link
            aria-label={`Ver roadmap de ${course.name}`}
            className={buttonVariants({ variant: 'outline' })}
            href={roadmapUrl(course)}
          >
            Ver roadmap
          </Link>
        ) : (
          <Link
            aria-label={`Abrir roadmap de ${course.name}`}
            className={buttonVariants()}
            href={roadmapUrl(course)}
          >
            <Route aria-hidden="true" data-icon="inline-start" />
            Abrir roadmap
          </Link>
        )}
      </>
    );
  }
  if (course.canCreateRoadmap) {
    return renderRoadmapCreation({
      courseCode: course.courseCode,
      courseName: course.name,
      semester: course.semester,
      year: course.year,
    });
  }
  if (awaitsCreation) {
    return (
      <p className="max-w-64 text-sm text-muted-foreground">
        Solo el profesor de cátedra puede crear el roadmap. Mientras tanto, revisa sus versiones
        anteriores.
      </p>
    );
  }
  if (course.role === 'STUDENT') {
    return (
      <p className="max-w-64 text-sm text-muted-foreground">
        {isPastOffering
          ? 'Este curso cerró sin una ruta publicada.'
          : 'Tu equipo docente aún no publica la ruta de este curso.'}
      </p>
    );
  }
  return null;
}

function CourseActions({
  course,
  isPastOffering,
  renderRoadmapCreation,
}: Readonly<{
  course: AcademicOverviewCourse;
  isPastOffering: boolean;
  renderRoadmapCreation: RoadmapCreationAction;
}>) {
  const awaitsCreation =
    course.role === 'TEACHER' &&
    !course.hasRoadmap &&
    !course.canCreateRoadmap &&
    !course.isPastClosure;

  return (
    <>
      {!course.hasRoadmap ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen aria-hidden="true" size={17} />
          Sin roadmap
        </p>
      ) : null}
      <CourseRoadmapAction
        course={course}
        isPastOffering={isPastOffering}
        awaitsCreation={awaitsCreation}
        renderRoadmapCreation={renderRoadmapCreation}
      />
      {(isPastOffering && course.role === 'TEACHER') || awaitsCreation ? (
        <Link
          aria-label={`Historial de versiones de ${course.name}`}
          className={buttonVariants({ variant: 'outline' })}
          href={versionHistoryUrl(course.courseCode)}
        >
          <History aria-hidden="true" size={16} />
          Historial de versiones
        </Link>
      ) : null}
      {course.role === 'TEACHER' && course.hasRoadmap ? (
        <Link
          aria-label={`Integrantes de ${course.name}`}
          className={buttonVariants({ variant: 'outline' })}
          href={courseParticipantsUrl(course)}
        >
          <Users aria-hidden="true" size={16} />
          Integrantes
        </Link>
      ) : null}
    </>
  );
}

function CourseRow({
  course,
  headingLevel: Heading,
  isPastTerm,
  renderRoadmapCreation,
}: Readonly<{
  course: AcademicOverviewCourse;
  headingLevel: CourseHeadingLevel;
  isPastTerm: boolean;
  renderRoadmapCreation: RoadmapCreationAction;
}>) {
  const position =
    positionDetails[
      course.institutionalPosition ?? (course.role === 'TEACHER' ? 'TEACHING_STAFF' : 'STUDENT')
    ];

  const isPastOffering = isPastTerm || course.isPastClosure;

  return (
    <li className="min-w-0 sm:col-span-2 sm:grid sm:grid-cols-subgrid">
      <div className="grid gap-4 px-5 py-5 sm:col-span-2 sm:grid-cols-subgrid sm:items-center sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
            <span>{course.courseCode}</span>
            {course.section ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Sección {course.section}</span>
              </>
            ) : null}
            {course.hasRoadmap && isPastOffering ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Solo lectura</span>
              </>
            ) : null}
          </div>
          <Heading className="mt-2 font-heading text-xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-2xl">
            {course.name}
          </Heading>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <PositionPlate position={position} />
            {course.department ? <span>{course.department}</span> : null}
          </div>
          {course.progress ? <CourseProgress progress={course.progress} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 sm:justify-end">
          <CourseActions
            course={course}
            isPastOffering={isPastOffering}
            renderRoadmapCreation={renderRoadmapCreation}
          />
        </div>
      </div>
    </li>
  );
}

function CourseList({
  term,
  headingLevel,
  isPastTerm = false,
  renderRoadmapCreation,
}: Readonly<{
  term: AcademicOverviewTerm;
  headingLevel: CourseHeadingLevel;
  isPastTerm?: boolean;
  renderRoadmapCreation: RoadmapCreationAction;
}>) {
  return (
    <ul className={cn(dividedListClassName, 'sm:grid sm:grid-cols-[minmax(0,1fr)_auto]')}>
      {term.courses.map((course) => (
        <CourseRow
          course={course}
          headingLevel={headingLevel}
          isPastTerm={isPastTerm}
          key={`${course.courseCode}:${course.year}:${course.semester}`}
          renderRoadmapCreation={renderRoadmapCreation}
        />
      ))}
    </ul>
  );
}

function AcademicTermSection({
  term,
  isPastTerm = false,
  renderRoadmapCreation,
}: Readonly<{
  term: AcademicOverviewTerm;
  isPastTerm?: boolean;
  renderRoadmapCreation: RoadmapCreationAction;
}>) {
  const id = `term-${term.year}-${term.semester}`;
  const Heading = isPastTerm ? 'h3' : 'h2';

  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8"
    >
      <div className="flex items-baseline justify-between gap-4 md:block">
        <Heading
          className={
            isPastTerm
              ? 'font-heading text-xl font-semibold tracking-[-0.02em]'
              : 'font-heading text-2xl font-semibold tracking-[-0.02em]'
          }
          id={id}
        >
          {termLabel(term)}
        </Heading>
        <p className="shrink-0 text-sm text-muted-foreground md:mt-1">
          {courseCountLabel(term.courses.length)}
        </p>
      </div>
      <CourseList
        headingLevel={isPastTerm ? 'h4' : 'h3'}
        isPastTerm={isPastTerm}
        renderRoadmapCreation={renderRoadmapCreation}
        term={term}
      />
    </section>
  );
}

function PreviousTermsSection({
  previousTerms,
  renderRoadmapCreation,
}: Readonly<{
  previousTerms: AcademicOverviewTerm[];
  renderRoadmapCreation: RoadmapCreationAction;
}>) {
  return (
    <Collapsible>
      <div className="flex flex-col items-start gap-1">
        <h2>
          <CollapsibleTrigger className="group/previous-terms inline-flex cursor-pointer items-center gap-2 text-left font-heading text-2xl font-semibold tracking-[-0.02em] transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <span>Semestres anteriores</span>
            <ChevronDown
              aria-hidden="true"
              className="shrink-0 transition-transform group-data-panel-open/previous-terms:rotate-180"
              size={20}
            />
          </CollapsibleTrigger>
        </h2>
        <span className="text-sm text-muted-foreground">
          {previousTerms.length} {previousTerms.length === 1 ? 'semestre' : 'semestres'}
        </span>
      </div>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
        <div className="pt-6">
          <Separator />
          {previousTerms.length === 1 ? (
            <div className="pt-6">
              <AcademicTermSection
                isPastTerm
                renderRoadmapCreation={renderRoadmapCreation}
                term={previousTerms[0]}
              />
            </div>
          ) : (
            <Accordion className="pt-4" multiple>
              {previousTerms.map((term, index) => (
                <AccordionItem
                  className="grid gap-4 not-last:border-b-0 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-8 md:*:data-[slot=accordion-content]:col-start-2 md:*:data-[slot=separator]:col-span-2"
                  key={`${term.year}-${term.semester}`}
                  value={`${term.year}-${term.semester}`}
                >
                  {index > 0 ? <Separator /> : null}
                  <div className="flex flex-col items-start gap-1 pb-4">
                    <AccordionTrigger className="w-fit flex-none cursor-pointer gap-2 py-0 font-heading text-xl font-semibold tracking-[-0.02em] transition-colors hover:text-primary hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50">
                      <span>{termLabel(term)}</span>
                    </AccordionTrigger>
                    <span className="text-sm text-muted-foreground">
                      {courseCountLabel(term.courses.length)}
                    </span>
                  </div>
                  <AccordionContent className="pb-4 [&_a]:no-underline">
                    <CourseList
                      headingLevel="h4"
                      isPastTerm
                      renderRoadmapCreation={renderRoadmapCreation}
                      term={term}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AcademicOverview({
  overview,
  renderRoadmapCreation,
  tutorialInvitation = false,
  notice,
}: Readonly<{
  overview: AcademicOverviewPage;
  notice?: React.ReactNode;
  renderRoadmapCreation: RoadmapCreationAction;
  tutorialInvitation?: boolean;
}>) {
  const [currentTerm, ...previousTerms] = overview.terms;

  return (
    <PageShell className="mx-auto max-w-[1440px] px-6">
      <div className="flex flex-col gap-10 md:gap-16">
        <header className="flex max-w-3xl items-center gap-3">
          <PageTitle className="md:text-5xl">Resumen académico</PageTitle>
          <AcademicOverviewTutorialButton invited={tutorialInvitation} />
        </header>

        {notice || overview.source === 'LOCAL' ? (
          <div className="flex flex-col gap-3">
            {notice}
            {overview.source === 'LOCAL' ? (
              <Alert role="status">
                <AlertTriangle aria-hidden="true" />
                <AlertDescription>
                  No pudimos actualizar tus cursos desde U-Campus. Mostramos los cursos que ya
                  tenías en U-Roadmaps; recarga la página más tarde para ver cambios recientes.
                </AlertDescription>
              </Alert>
            ) : null}
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
                  ? 'Aún no tienes cursos en U-Roadmaps. Cuando U-Campus responda, verás aquí los cursos que inscribes y los que dictas.'
                  : 'U-Campus no registra cursos inscritos ni cursos en los que formes parte del equipo docente.'}
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
              <PreviousTermsSection
                previousTerms={previousTerms}
                renderRoadmapCreation={renderRoadmapCreation}
              />
            ) : null}
          </div>
        )}
      </div>
    </PageShell>
  );
}
