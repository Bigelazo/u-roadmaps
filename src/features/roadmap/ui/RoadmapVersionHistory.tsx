import Link from 'next/link';
import { History, Route } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { buttonVariants } from '@/shared/ui/button-variants';
import { dividedListClassName, PageShell } from '@/shared/ui/page-layout';
import { CoursePageHeader } from '@/features/roadmap/ui/CoursePageHeader';
import { VersionOrigin } from '@/features/roadmap/ui/VersionOrigin';
import { VersionTeachingStaff } from '@/features/roadmap/ui/VersionTeachingStaff';
import { versionUrl } from '@/shared/version-history-url';
import type { RoadmapVersionHistory as VersionHistory } from '@/features/roadmap/version-types';

export function RoadmapVersionHistory({ history }: Readonly<{ history: VersionHistory }>) {
  const courseCode = history.course.code;
  return (
    <PageShell className="mx-auto flex max-w-5xl flex-col gap-10 px-4 sm:px-6">
      <CoursePageHeader
        courseName={history.course.name}
        courseCode={courseCode}
        courseDetail={courseCode}
        offering={history.latestOffering}
        current="versions"
        section="Historial de versiones"
        fallbackHref="/academic-overview"
      />
      {history.versions.length === 0 ? (
        <Empty className="border bg-card py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay versiones cerradas</EmptyTitle>
            <EmptyDescription>
              Una versión aparece aquí cuando el Roadmap de su semestre se cierra.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className={dividedListClassName}>
          {history.versions.map((version) => (
            <li
              aria-label={version.edition}
              className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6"
              key={version.edition}
            >
              <div className="grid gap-1">
                <h3 className="font-heading text-xl font-semibold tracking-[-0.02em]">
                  {version.edition}
                </h3>
                <VersionOrigin
                  courseCode={courseCode}
                  openEditions={history.versions}
                  origin={version.origin}
                />
              </div>
              <section aria-label={`Equipo docente de ${version.edition}`} className="grid gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground">Equipo docente</h4>
                <VersionTeachingStaff {...version} />
              </section>
              <Link
                aria-label={`Abrir roadmap de ${version.edition}`}
                className={buttonVariants({
                  className: 'justify-self-start sm:col-start-2 sm:row-start-1 sm:self-start',
                })}
                href={versionUrl({ courseCode, ...version })}
              >
                <Route aria-hidden="true" data-icon="inline-start" />
                Abrir roadmap
              </Link>
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  );
}
