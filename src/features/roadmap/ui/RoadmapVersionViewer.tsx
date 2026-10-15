'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Download, ExternalLink, FileText, X } from 'lucide-react';
import { RoadmapGraph, type RoadmapGraphProjection } from '@/features/roadmap/graph/RoadmapGraph';
import { NodeDescription } from '@/features/roadmap/ui/NodeDescription';
import { NodePanelHeader } from '@/features/roadmap/ui/NodePanelHeader';
import { originLabel, VersionAuthorshipList } from '@/features/roadmap/ui/version-labels';
import { Button, buttonVariants } from '@/shared/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { versionHistoryUrl } from '@/shared/version-history-url';
import type { RoadmapVersion } from '@/features/roadmap/version-types';

export function RoadmapVersionViewer({ version }: Readonly<{ version: RoadmapVersion }>) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Without `editing`, the teaching projection renders a read-only canvas.
  const projection = useMemo<RoadmapGraphProjection>(
    () => ({ kind: 'teaching', roadmap: version }),
    [version],
  );
  const selectedNode = version.nodes.find(({ id }) => id === selectedNodeId);

  return (
    <main className="flex h-[calc(100dvh-4rem)] min-h-[32rem] flex-col bg-cloud text-foreground">
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
        {selectedNode ? (
          <aside
            aria-label={selectedNode.title}
            className="absolute inset-0 z-10 overflow-y-auto border-l border-fog bg-card sm:static sm:w-80 sm:shrink-0 lg:w-96"
          >
            <NodePanelHeader
              title={selectedNode.title}
              nodeType={version.nodeTypes.find(({ id }) => id === selectedNode.nodeTypeId)}
              iconTestId="version-node-type-icon"
              headingId="version-node-detail-title"
              actions={
                <Button
                  aria-label="Cerrar detalle"
                  onClick={() => setSelectedNodeId(null)}
                  variant="ghost"
                  size="icon"
                >
                  <X size={18} />
                </Button>
              }
            />
            <div className="px-6 py-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <FileText size={18} /> Descripción
              </h3>
              <div className="mt-4">
                <NodeDescription description={selectedNode.description} />
              </div>
              <h3 className="mt-6 flex items-center gap-2 font-semibold">
                <Download size={18} /> Recursos
              </h3>
              {selectedNode.resources.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Este nodo no tiene recursos.</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {selectedNode.resources.map((resource) => (
                    <li key={resource.id}>
                      <a
                        className="flex items-center gap-2 rounded-lg border border-fog px-3 py-2 text-sm hover:bg-muted"
                        href={resource.url}
                        {...(resource.type === 'FILE'
                          ? { download: resource.title }
                          : { target: '_blank', rel: 'noreferrer' })}
                      >
                        {resource.type === 'FILE' ? (
                          <Download size={16} aria-hidden="true" />
                        ) : (
                          <ExternalLink size={16} aria-hidden="true" />
                        )}
                        {resource.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}

function VersionInformation({ version }: Readonly<{ version: RoadmapVersion }>) {
  const { version: authorship } = version;
  return (
    <Card
      className="pointer-events-auto max-h-[calc(100dvh-12rem)] w-80 max-w-full gap-3 overflow-y-auto"
      size="sm"
    >
      <CardHeader className="gap-2">
        <Link
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-fit' })}
          href={versionHistoryUrl(version.course.code)}
        >
          <ArrowLeft data-icon="inline-start" />
          Historial de versiones
        </Link>
        <p className="text-sm text-muted-foreground">
          {version.course.code} · {version.course.name}
        </p>
        <h1 className="font-heading text-xl font-semibold text-ink">{authorship.edition}</h1>
        <p className="text-xs text-muted-foreground">Versión cerrada · solo lectura</p>
      </CardHeader>
      <CardContent>
        <details className="group/version">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-sm text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            Información de la versión
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 group-open/version:rotate-180"
            />
          </summary>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm [&_dd]:min-w-0 [&_dd]:wrap-break-word">
            <dt className="font-semibold">Origen</dt>
            <dd>{originLabel(authorship.origin)}</dd>
            <VersionAuthorshipList {...authorship} />
            <dt className="font-semibold">Linaje</dt>
            <dd>
              <ol aria-label="Linaje" className="flex flex-wrap gap-x-2">
                {authorship.lineage.map((ancestor, index) => (
                  <li key={ancestor.edition}>
                    {index > 0 ? '→ ' : ''}
                    {ancestor.edition}
                  </li>
                ))}
              </ol>
            </dd>
          </dl>
        </details>
      </CardContent>
    </Card>
  );
}
