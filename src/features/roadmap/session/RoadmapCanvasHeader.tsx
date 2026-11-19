'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, CircleAlert, History, UserGroup } from 'lucide-react';
import { courseParticipantsUrl, versionHistoryUrl } from '@/features/roadmap/client';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';
import { Empty, EmptyHeader, EmptyMedia } from '@/shared/ui/empty';
import { Badge } from '@/shared/ui/badge';
import { buttonVariants } from '@/shared/ui/button-variants';
import { cn } from 'cn';
import { useCompactCanvasLayout } from '@/features/roadmap/ui/compact-canvas-layout';
import { termLabel, type CourseOfferingIdentifier } from '@/shared/course-offering';

export function RoadmapCanvasHeader({
  title,
  academicWeek,
  courseCode,
  year,
  semester,
  isCanvasPreview,
  isEditing,
  showsCourseLinks,
  themeToggle,
}: CourseOfferingIdentifier & {
  title: string;
  academicWeek?: string | null;
  isCanvasPreview: boolean;
  isEditing: boolean;
  showsCourseLinks: boolean;
  themeToggle?: ReactNode;
}) {
  const isCompact = useCompactCanvasLayout();
  const hidesBadgeRow = isCanvasPreview && isCompact;
  return (
    <header>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className={cn('flex flex-wrap items-center gap-2', hidesBadgeRow && 'hidden')}>
            {isCanvasPreview ? (
              <Badge className="bg-[color-mix(in_srgb,var(--background)_78%,#f97316)] text-secondary-foreground dark:bg-warning-soft">
                Modo previsualización
              </Badge>
            ) : isEditing ? (
              <Badge variant="secondary">Modo edición</Badge>
            ) : null}
          </div>
          <h1
            className={cn(
              'font-heading text-[23px] leading-none font-semibold tracking-[-0.045em] text-balance sm:text-[30px]',
              !hidesBadgeRow && 'mt-2',
            )}
          >
            {title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>{courseCode}</span>
            <span aria-hidden="true">·</span>
            <span>{termLabel({ year, semester })}</span>
            {academicWeek ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{academicWeek}</span>
              </>
            ) : null}
          </p>
        </div>
        {themeToggle ? (
          <div className="pointer-events-auto -my-1 -mr-2 shrink-0 [body:has([data-global-navigation])_&]:hidden">
            {themeToggle}
          </div>
        ) : null}
      </div>
      {showsCourseLinks ? (
        <RoadmapCourseLinks courseCode={courseCode} year={year} semester={semester} />
      ) : null}
    </header>
  );
}

function RoadmapCourseLinks({ courseCode, year, semester }: CourseOfferingIdentifier) {
  const linkClassName = cn(
    buttonVariants({ variant: 'ghost', size: 'sm' }),
    'pointer-events-auto justify-start text-primary hover:bg-primary-soft/50 hover:text-primary-deep',
  );
  return (
    <nav
      aria-label="Secciones del curso"
      className="-mx-3 mt-2 -mb-2 flex flex-wrap gap-1 border-t border-border/70 p-1 [@media(max-height:500px)]:mt-1 [@media(max-height:500px)]:-mb-1.5"
    >
      <Link className={linkClassName} href={courseParticipantsUrl({ courseCode, year, semester })}>
        <UserGroup data-icon="inline-start" />
        Integrantes
      </Link>
      <Link className={linkClassName} href={versionHistoryUrl(courseCode)}>
        <History data-icon="inline-start" />
        Versiones
      </Link>
    </nav>
  );
}

export function RoadmapLoadError({
  input,
  error,
}: {
  input: RoadmapCanvasSessionInput;
  error: string;
}) {
  return (
    <section
      data-page-width="full"
      aria-labelledby="roadmap-load-error-title"
      className="flex min-h-full w-full flex-1 bg-cloud text-foreground"
    >
      <Empty className="gap-6 rounded-none px-6 py-16">
        <EmptyHeader className="max-w-lg gap-4">
          <EmptyMedia className="text-destructive">
            <CircleAlert aria-hidden="true" className="size-10" />
          </EmptyMedia>
          <h1
            id="roadmap-load-error-title"
            className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            No pudimos abrir el roadmap
          </h1>
          <p className="max-w-full text-base font-medium wrap-anywhere">
            {input.courseOffering.title}
          </p>
          <div
            role="alert"
            className="flex max-w-full flex-col gap-2 text-base text-muted-foreground"
          >
            <p className="wrap-anywhere">{error}</p>
            <p>
              {input.practice?.exitHref
                ? 'Vuelve a la práctica para continuar.'
                : 'Vuelve a tus cursos para abrir el roadmap nuevamente.'}
            </p>
          </div>
        </EmptyHeader>
        <Link href={input.practice?.exitHref ?? '/academic-overview'} className={buttonVariants()}>
          <ArrowLeft data-icon="inline-start" />
          {input.practice?.exitHref ? 'Volver a la práctica' : 'Volver a mis cursos'}
        </Link>
      </Empty>
    </section>
  );
}
