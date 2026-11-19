import Link from 'next/link';
import { ChevronDown, History, Route } from 'lucide-react';
import { cn } from 'cn';
import { buttonVariants } from '@/shared/ui/button-variants';
import { CHILE_TIME_ZONE } from '@/features/roadmap/domain/scheduled-unlock';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { dividedListClassName, PageShell } from '@/shared/ui/page-layout';
import { CoursePageHeader } from '@/features/roadmap/ui/CoursePageHeader';
import { RoadmapClosureNotice } from '@/features/roadmap/ui/RoadmapClosureNotice';
import { VersionOrigin } from '@/features/roadmap/ui/VersionOrigin';
import { VersionTeachingStaff } from '@/features/roadmap/ui/VersionTeachingStaff';
import { lineageLanes, type LineageRow } from '@/features/roadmap/ui/version-lineage';
import { versionUrl } from '@/shared/version-history-url';
import type { RoadmapVersionHistory as VersionHistory } from '@/features/roadmap/version-types';

const closedAtFormat = new Intl.DateTimeFormat('es-CL', {
  timeZone: CHILE_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const calendarDayFormat = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function nodeCountLabel(count: number) {
  return count === 1 ? '1 nodo' : `${count} nodos`;
}

function EditionFacts({ facts }: Readonly<{ facts: readonly string[] }>) {
  return <p className="text-sm text-muted-foreground">{facts.join(' · ')}</p>;
}

const editionLinkClassName =
  '-my-2 inline-block rounded-sm py-2 underline decoration-primary/40 decoration-1 underline-offset-[6px] transition-colors outline-none hover:decoration-current focus-visible:ring-3 focus-visible:ring-ring/50';

function offeringUrl(courseCode: string, { year, semester }: { year: number; semester: number }) {
  return `/courses/${encodeURIComponent(courseCode)}/${year}/${semester}`;
}

const LANE_WIDTH = 16;
const NODE_TOP = 28;
const laneCenter = (lane: number) => lane * LANE_WIDTH + 6;

function lineageInset(laneCount: number) {
  return { paddingLeft: 20 + laneCount * LANE_WIDTH + 12 };
}

function LineageMarker({
  row: { lane, incoming, passing, continues },
  laneCount,
  current = false,
}: Readonly<{ row: LineageRow; laneCount: number; current?: boolean }>) {
  const segment = 'absolute w-0.5 bg-current';
  const at = (column: number) => ({ left: laneCenter(column) - 1 });
  const merging = incoming.filter((column) => column !== lane);
  return (
    <span
      aria-hidden="true"
      className="absolute inset-y-0 left-5 text-primary/40"
      style={{ width: laneCount * LANE_WIDTH }}
    >
      {passing.map((column) => (
        <span className={cn(segment, 'inset-y-0')} key={column} style={at(column)} />
      ))}
      {incoming.includes(lane) ? (
        <span className={cn(segment, 'top-0')} style={{ ...at(lane), height: NODE_TOP }} />
      ) : null}
      {merging.length > 0 ? (
        <svg
          className="absolute top-0 left-0 overflow-visible"
          fill="none"
          height={NODE_TOP + 6}
          stroke="currentColor"
          strokeWidth={2}
          width={laneCount * LANE_WIDTH}
        >
          {merging.map((column) => (
            <path
              d={`M ${laneCenter(column)} 0 V 8 C ${laneCenter(column)} 24, ${laneCenter(lane)} 18, ${laneCenter(lane)} ${NODE_TOP + 6}`}
              key={column}
            />
          ))}
        </svg>
      ) : null}
      <span
        className={cn(
          'absolute size-3 rounded-full border-2 border-primary',
          current ? 'bg-primary' : 'bg-card',
        )}
        style={{ left: lane * LANE_WIDTH, top: NODE_TOP }}
      />
      {continues ? (
        <span className={cn(segment, 'bottom-0')} style={{ ...at(lane), top: NODE_TOP + 12 }} />
      ) : null}
    </span>
  );
}

export function RoadmapVersionHistory({
  history,
  now,
}: Readonly<{ history: VersionHistory; now: Date }>) {
  const courseCode = history.course.code;
  const { current, versions } = history;
  const lineage = lineageLanes(current ? [current, ...versions] : versions);
  const versionRows = current ? lineage.rows.slice(1) : lineage.rows;
  const closesOn = current?.closesOn
    ? calendarDayFormat.format(new Date(`${current.closesOn}T12:00:00.000Z`))
    : null;
  return (
    <PageShell className="mx-auto flex max-w-5xl flex-col gap-10 px-4 sm:px-6">
      <CoursePageHeader
        courseName={history.course.name}
        courseCode={courseCode}
        courseDetail={courseCode}
        offering={history.latestOffering}
        current="versions"
        section="Historial de versiones"
      />
      <RoadmapClosureNotice history={history} now={now} />
      {versions.length === 0 ? (
        <Empty className="border bg-card py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay versiones cerradas</EmptyTitle>
            <EmptyDescription>
              {current
                ? `El Roadmap de ${current.edition} quedará aquí como versión de solo lectura cuando se cierre${closesOn ? `, al terminar el ${closesOn}` : ''}.`
                : 'Cuando se cierre el Roadmap de un semestre, quedará aquí como versión de solo lectura.'}
            </EmptyDescription>
          </EmptyHeader>
          {current ? (
            <Link
              className={buttonVariants({ variant: 'outline' })}
              href={offeringUrl(courseCode, current)}
            >
              <Route aria-hidden="true" data-icon="inline-start" />
              Ir al Roadmap en curso
            </Link>
          ) : null}
        </Empty>
      ) : (
        <ol className={dividedListClassName}>
          {current ? (
            <li
              className="relative grid gap-1 py-5 pr-5 sm:pr-6"
              style={lineageInset(lineage.laneCount)}
            >
              <LineageMarker current laneCount={lineage.laneCount} row={lineage.rows[0]} />
              <h3 className="flex flex-wrap items-baseline gap-x-3 font-heading text-xl font-semibold tracking-[-0.02em]">
                <Link className={editionLinkClassName} href={offeringUrl(courseCode, current)}>
                  {current.edition}
                </Link>
                <span className="font-sans text-sm font-semibold tracking-normal text-primary">
                  En curso
                </span>
              </h3>
              <VersionOrigin
                courseCode={courseCode}
                openEditions={versions}
                origin={current.origin}
              />
              <EditionFacts
                facts={[
                  nodeCountLabel(current.nodeCount),
                  ...(closesOn ? [`editable hasta el ${closesOn}`] : []),
                ]}
              />
            </li>
          ) : null}
          {versions.map((version, index) => (
            <li
              aria-label={version.edition}
              className="relative grid gap-4 py-5 pr-5 sm:pr-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-x-10"
              key={version.edition}
              style={lineageInset(lineage.laneCount)}
            >
              <LineageMarker laneCount={lineage.laneCount} row={versionRows[index]} />
              <div className="grid content-start gap-1">
                <h3 className="font-heading text-xl font-semibold tracking-[-0.02em]">
                  <Link
                    className={editionLinkClassName}
                    href={versionUrl({ courseCode, ...version })}
                  >
                    {version.edition}
                  </Link>
                </h3>
                <VersionOrigin
                  courseCode={courseCode}
                  openEditions={versions}
                  origin={version.origin}
                />
                <EditionFacts
                  facts={[
                    nodeCountLabel(version.nodeCount),
                    `cerrada el ${closedAtFormat.format(new Date(version.closedAt))}`,
                  ]}
                />
              </div>
              <details className="group/staff lg:hidden [&>div]:mt-3">
                <summary className="-my-2.5 flex w-fit cursor-pointer list-none items-center gap-2 rounded-sm py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  <h4 className="text-base font-semibold text-ink">
                    Equipo docente
                    {version.teachingStaff.length > 0 ? (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        · {version.teachingStaff.length}
                      </span>
                    ) : null}
                  </h4>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-open/staff:rotate-180"
                  />
                </summary>
                <VersionTeachingStaff {...version} />
              </details>
              <div className="hidden lg:block lg:pt-1">
                <VersionTeachingStaff {...version} layout="inline" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  );
}
