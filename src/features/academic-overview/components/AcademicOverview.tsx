import Link from 'next/link';
import { ChevronDown, History, MapPinned, Route, RouteOff, UserGroup } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { Separator } from '@/shared/ui/separator';
import type { AcademicOverviewCourse, AcademicOverviewPage, AcademicOverviewTerm } from '../types';
import { courseParticipantsUrl, termLabel } from '@/shared/course-offering';
import { dividedListClassName, PageShell, PageTitle } from '@/shared/ui/page-layout';
import { NotificationCountButton } from '@/features/notifications/client';
import { versionHistoryUrl } from '@/shared/version-history-url';
import { buttonVariants } from '@/shared/ui/button-variants';
import { cn } from 'cn';
import { PositionPlate } from '@/shared/ui/position-plate';
import { PendingLinkContent } from '@/shared/ui/pending-link-content';
import { AcademicOverviewTutorialButton } from './AcademicOverviewTutorialButton';

function CourseProgress({
  progress,
}: Readonly<{ progress: NonNullable<AcademicOverviewCourse['progress']> }>) {
  const { completedNodes, visibleNodes } = progress;
  const percent = Math.round((completedNodes / visibleNodes) * 100);
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="h-1.5 w-24 overflow-hidden rounded-full bg-progress-soft">
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
  renderRoadmapCreation,
}: Readonly<{
  course: AcademicOverviewCourse;
  isPastOffering: boolean;
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
        <Link
          aria-label={`Abrir roadmap de ${course.name}`}
          className={buttonVariants({ variant: isPastOffering ? 'outline' : 'default' })}
          href={roadmapUrl(course)}
        >
          <PendingLinkContent icon={<Route aria-hidden="true" data-icon="inline-start" />}>
            Roadmap
          </PendingLinkContent>
        </Link>
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
  if (
    course.role === 'TEACHER' &&
    !course.isPastClosure &&
    !course.isPositionConfirmed &&
    course.institutionalPosition === null
  ) {
    return (
      <p className="max-w-64 text-sm text-muted-foreground">
        No pudimos confirmar tu cargo con U-Campus. Si eres profesor de cátedra, recarga la página
        más tarde para crear el roadmap.
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
  return (
    <>
      {!course.hasRoadmap ? (
        <span className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <RouteOff aria-hidden="true" size={17} />
          Sin roadmap
        </span>
      ) : null}
      <CourseRoadmapAction
        course={course}
        isPastOffering={isPastOffering}
        renderRoadmapCreation={renderRoadmapCreation}
      />
      {course.role === 'TEACHER' ? (
        <Link
          aria-label={`Integrantes de ${course.name}`}
          className={buttonVariants({ variant: 'outline' })}
          href={courseParticipantsUrl(course)}
        >
          <PendingLinkContent icon={<UserGroup aria-hidden="true" data-icon="inline-start" />}>
            Integrantes
          </PendingLinkContent>
        </Link>
      ) : null}
      {course.role === 'TEACHER' ? (
        <Link
          aria-label={`Historial de versiones de ${course.name}`}
          className={buttonVariants({ variant: 'outline' })}
          href={versionHistoryUrl(course.courseCode)}
        >
          <PendingLinkContent icon={<History aria-hidden="true" data-icon="inline-start" />}>
            Versiones
          </PendingLinkContent>
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
  const position = course.institutionalPosition ?? (course.role === 'TEACHER' ? null : 'STUDENT');

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
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 sm:justify-end">
          {course.progress ? <CourseProgress progress={course.progress} /> : null}
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
  actions,
  lastSynchronization = null,
}: Readonly<{
  overview: AcademicOverviewPage;
  lastSynchronization?: string | null;
  notice?: React.ReactNode;
  actions?: React.ReactNode;
  renderRoadmapCreation: RoadmapCreationAction;
  tutorialInvitation?: boolean;
}>) {
  const [currentTerm, ...previousTerms] = overview.terms;

  return (
    <PageShell className="mx-auto max-w-[1440px] px-6">
      <div className="flex flex-col gap-10 md:gap-16">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <PageTitle className="md:text-5xl">Resumen académico</PageTitle>
            {lastSynchronization ? (
              <p className="text-sm text-muted-foreground">
                Última actualización: {lastSynchronization}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AcademicOverviewTutorialButton invited={tutorialInvitation} />
            {actions}
          </div>
        </header>

        {notice ? <div className="flex flex-col gap-3">{notice}</div> : null}

        {overview.terms.length === 0 ? (
          <Empty className="border bg-card py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPinned aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No hay cursos para mostrar</EmptyTitle>
              <EmptyDescription>
                No registramos cursos inscritos ni cursos en los que formes parte del equipo
                docente.
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
