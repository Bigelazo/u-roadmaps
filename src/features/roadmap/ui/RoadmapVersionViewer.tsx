'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, ExternalLink, FileText, X } from 'lucide-react';
import { RoadmapGraph, type RoadmapGraphProjection } from '@/features/roadmap/graph/RoadmapGraph';
import { NodeDescription } from '@/features/roadmap/ui/NodeDescription';
import { NodePanelHeader } from '@/features/roadmap/ui/NodePanelHeader';
import { creatorLabel, originLabel, positionLabels } from '@/features/roadmap/ui/version-labels';
import { Button, buttonVariants } from '@/shared/ui/button';
import { versionHistoryUrl } from '@/shared/version-history-url';
import type { RoadmapVersion } from '@/features/roadmap/server';

export function RoadmapVersionViewer({ version }: Readonly<{ version: RoadmapVersion }>) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Without `editing`, the teaching projection renders a read-only canvas.
  const projection = useMemo<RoadmapGraphProjection>(
    () => ({ kind: 'teaching', roadmap: version }),
    [version],
  );
  const selectedNode = version.nodes.find(({ id }) => id === selectedNodeId);
  const { version: authorship } = version;

  return (
    <main className="flex min-h-screen flex-col bg-cloud text-foreground">
      <header className="border-b border-fog bg-card px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Link
            className={buttonVariants({ variant: 'ghost', className: 'self-start' })}
            href={versionHistoryUrl(version.course.code)}
          >
            <ArrowLeft data-icon="inline-start" />
            Historial de versiones
          </Link>
          <div>
            <p className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
              {version.course.code}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{version.course.name}</p>
            <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.04em]">
              {authorship.edition}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Versión cerrada · solo lectura</p>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="font-semibold">Origen</dt>
            <dd>{originLabel(authorship.origin)}</dd>
            <dt className="font-semibold">Creada por</dt>
            <dd>{creatorLabel(authorship.creator)}</dd>
            <dt className="font-semibold">Equipo docente</dt>
            <dd>
              {authorship.teachingStaff.length === 0 ? (
                'Sin registro'
              ) : (
                <ul className="grid gap-1">
                  {authorship.teachingStaff.map((member) => (
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
        </div>
      </header>
      <div className="relative flex min-h-[32rem] flex-1">
        <div className="relative min-w-0 flex-1">
          <RoadmapGraph
            projection={projection}
            onSelectNode={setSelectedNodeId}
            onClearSelectedNode={() => setSelectedNodeId(null)}
            selectedNodeId={selectedNodeId}
          />
        </div>
        {selectedNode ? (
          <aside
            aria-label={selectedNode.title}
            className="w-full max-w-md overflow-y-auto border-l border-fog bg-card"
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
