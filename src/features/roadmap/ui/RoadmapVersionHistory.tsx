import Link from 'next/link';
import { History } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { buttonVariants } from '@/shared/ui/button';
import { creatorLabel, originLabel, positionLabels } from '@/features/roadmap/ui/version-labels';
import { versionUrl } from '@/shared/version-history-url';
import type { RoadmapVersionHistory as VersionHistory } from '@/features/roadmap/server';

export function RoadmapVersionHistory({ history }: Readonly<{ history: VersionHistory }>) {
  return (
    <main className="min-h-screen bg-cloud py-10 text-foreground md:py-16">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 sm:px-6">
        <header>
          <p className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
            {history.course.code}
          </p>
          <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
            Historial de versiones
          </h1>
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
          <ol className="divide-y divide-fog overflow-hidden rounded-xl border border-fog bg-card">
            {history.versions.map((version) => (
              <li
                aria-label={version.edition}
                className="grid gap-3 px-5 py-5 sm:px-6"
                key={version.edition}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em]">
                    {version.edition}
                  </h2>
                  <p className="text-sm text-muted-foreground">{originLabel(version.origin)}</p>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <dt className="font-semibold">Creada por</dt>
                  <dd>{creatorLabel(version.creator)}</dd>
                  <dt className="font-semibold">Equipo docente</dt>
                  <dd>
                    {version.teachingStaff.length === 0 ? (
                      'Sin registro'
                    ) : (
                      <ul className="grid gap-1">
                        {version.teachingStaff.map((member) => (
                          <li key={member.id}>
                            {member.name}
                            {member.institutionalPosition
                              ? ` · ${positionLabels[member.institutionalPosition]}`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </dl>
                <Link
                  aria-label={`Ver ${version.edition}`}
                  className={buttonVariants({
                    variant: 'outline',
                    className: 'justify-self-start',
                  })}
                  href={versionUrl({ courseCode: history.course.code, ...version })}
                >
                  Ver versión
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
