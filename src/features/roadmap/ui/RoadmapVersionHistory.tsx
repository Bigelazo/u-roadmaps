import Link from 'next/link';
import { ArrowRight, History } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { buttonVariants } from '@/shared/ui/button-variants';
import { dividedListClassName, PageEyebrow, PageShell, PageTitle } from '@/shared/ui/page-layout';
import { VersionOrigin } from '@/features/roadmap/ui/VersionOrigin';
import { VersionTeachingStaff } from '@/features/roadmap/ui/VersionTeachingStaff';
import { versionUrl } from '@/shared/version-history-url';
import type { RoadmapVersionHistory as VersionHistory } from '@/features/roadmap/version-types';

export function RoadmapVersionHistory({ history }: Readonly<{ history: VersionHistory }>) {
  const courseCode = history.course.code;
  return (
    <PageShell className="mx-auto flex max-w-4xl flex-col gap-10 px-4 sm:px-6">
      <header>
        <PageEyebrow>{courseCode}</PageEyebrow>
        <PageTitle className="mt-2 md:text-5xl">Historial de versiones</PageTitle>
        <p className="mt-2 text-muted-foreground">{history.course.name}</p>
      </header>
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
                <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em]">
                  {version.edition}
                </h2>
                <VersionOrigin
                  courseCode={courseCode}
                  openEditions={history.versions}
                  origin={version.origin}
                />
              </div>
              <section aria-label={`Equipo docente de ${version.edition}`} className="grid gap-2">
                <h3 className="text-xs font-semibold text-muted-foreground">Equipo docente</h3>
                <VersionTeachingStaff {...version} />
              </section>
              <Link
                aria-label={`Ver ${version.edition}`}
                className={buttonVariants({
                  variant: 'outline',
                  className: 'justify-self-start sm:col-start-2 sm:row-start-1 sm:self-start',
                })}
                href={versionUrl({ courseCode, ...version })}
              >
                Ver versión
                <ArrowRight data-icon="inline-end" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  );
}
