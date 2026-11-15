'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from 'cn';
import { ArrowLeft, ChevronDown, Lock } from 'lucide-react';
import { RoadmapGraph, type RoadmapGraphProjection } from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { originLabel } from '@/features/roadmap/ui/version-labels';
import { Badge } from '@/shared/ui/badge';
import { buttonVariants } from '@/shared/ui/button-variants';
import { versionHistoryUrl, versionUrl } from '@/shared/version-history-url';
import type { RoadmapVersion } from '@/features/roadmap/version-types';

export function RoadmapVersionViewer({ version }: Readonly<{ version: RoadmapVersion }>) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(426);
  const projection = useMemo<RoadmapGraphProjection>(
    () => ({ kind: 'teaching', roadmap: version }),
    [version],
  );
  const selectedNode = version.nodes.find(({ id }) => id === selectedNodeId);

  return (
    <main data-viewport-page className="flex min-h-0 flex-1 flex-col bg-cloud text-foreground">
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <RoadmapGraph
            projection={projection}
            onSelectNode={setSelectedNodeId}
            onClearSelectedNode={() => setSelectedNodeId(null)}
            selectedNodeId={selectedNodeId}
            overlaySlots={{ topLeft: <VersionInformation version={version} /> }}
          />
        </div>
        <StudentNodeDetail
          node={selectedNode}
          status={selectedNode ? 'available' : null}
          onClose={() => setSelectedNodeId(null)}
          nodeTypes={version.nodeTypes}
          panelWidth={panelWidth}
          onPanelWidthChange={setPanelWidth}
        />
      </div>
    </main>
  );
}

function VersionInformation({ version }: Readonly<{ version: RoadmapVersion }>) {
  const { version: authorship } = version;
  return (
    <div className="pointer-events-auto flex max-h-[calc(100dvh-12rem)] w-80 max-w-full flex-col gap-2 overflow-y-auto max-sm:flex-row max-sm:flex-wrap max-sm:items-center max-sm:gap-x-2 max-sm:gap-y-0 [@media(max-height:500px)]:w-md [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:flex-wrap [@media(max-height:500px)]:items-center [@media(max-height:500px)]:gap-x-3 [@media(max-height:500px)]:gap-y-0">
      <Link
        className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2 w-fit' })}
        href={versionHistoryUrl(version.course.code)}
      >
        <ArrowLeft data-icon="inline-start" />
        <span className="max-sm:sr-only">Historial de versiones</span>
      </Link>
      <p className="text-sm text-muted-foreground max-sm:hidden">
        {version.course.code} · {version.course.name}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 max-sm:flex-1">
        <h1 className="font-heading text-xl font-semibold text-ink [@media(max-height:500px)]:text-base">
          {authorship.edition}
        </h1>
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-muted px-2 py-0.5 text-xs font-bold text-ink">
          <Lock aria-hidden="true" className="size-3 shrink-0" />
          <span className="max-sm:hidden">Versión cerrada · </span>Solo lectura
        </span>
      </div>
      <details className="group/version mt-1 border-t border-fog pt-1 max-sm:basis-full [@media(max-height:500px)]:basis-full">
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-sm text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          Procedencia
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform duration-200 ease-out group-open/version:rotate-180"
          />
        </summary>
        <div className="mt-2 grid gap-3 pb-1">
          <p className="text-sm text-muted-foreground sm:hidden">
            {version.course.code} · {version.course.name}
          </p>
          <VersionLineage
            courseCode={version.course.code}
            lineage={authorship.lineage}
            origin={authorship.origin}
          />
        </div>
      </details>
    </div>
  );
}

function VersionLineage({
  courseCode,
  lineage,
  origin,
}: Readonly<{
  courseCode: string;
  lineage: RoadmapVersion['version']['lineage'];
  origin: RoadmapVersion['version']['origin'];
}>) {
  return (
    <ol aria-label="Linaje" className="grid text-sm">
      {lineage.map((ancestor, index) => {
        const isCurrent = index === lineage.length - 1;
        return (
          <li
            className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 pb-3 last:pb-0"
            key={ancestor.edition}
          >
            {isCurrent ? null : (
              <span
                aria-hidden="true"
                className="absolute top-4.5 -bottom-1 left-[7px] w-0.5 rounded-full bg-steel"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'mt-1 size-3 justify-self-center rounded-full border-2',
                isCurrent ? 'border-progress bg-progress' : 'border-primary bg-card',
              )}
            />
            {isCurrent ? (
              <div className="grid gap-0.5">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-ink">{ancestor.edition}</span>
                  <Badge variant="progress">Esta versión</Badge>
                </p>
                <p className="text-xs text-muted-foreground">{originLabel(origin)}</p>
              </div>
            ) : (
              <Link
                className="w-fit font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
                href={versionUrl({ courseCode, ...ancestor })}
              >
                {ancestor.edition}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
