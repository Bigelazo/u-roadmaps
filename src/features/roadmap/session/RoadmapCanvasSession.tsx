'use client';

import { useCallback, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { RoadmapErrorToast } from '@/features/roadmap/RoadmapErrorToast';
import { RoadmapSuccessToast } from '@/features/roadmap/RoadmapSuccessToast';
import { RoadmapGraph } from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { isStudentBlockedNode, studentNodeStatus } from '@/features/roadmap/student/node-status';
import { useRoadmapCanvasSession } from '@/features/roadmap/session/session';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Spinner } from '@/shared/ui/spinner';
import { Button } from '@/shared/ui/button';

export function RoadmapCanvasSession(input: RoadmapCanvasSessionInput) {
  const { roadmap, error, dismissError, completeNode } = useRoadmapCanvasSession(input);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const isHistorical = input.experience.term === 'historical';

  const selectNode = useCallback(
    (nodeId: string) => {
      const node = roadmap?.nodes.find((candidate) => candidate.id === nodeId);
      if (!node || isStudentBlockedNode(node)) return;
      setSelectedNodeId(nodeId);
    },
    [roadmap],
  );
  const selectedNode = roadmap?.nodes.find((node) => node.id === selectedNodeId);

  if (input.experience.kind !== 'student') {
    throw new Error('La sesión del canvas de docencia continúa en el canvas heredado.');
  }
  if (error && !roadmap) {
    return (
      <Alert variant="destructive" className="m-4 max-w-2xl">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Error al cargar el roadmap</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button aria-label="Cerrar alerta" onClick={dismissError} size="icon" variant="ghost">
          ×
        </Button>
      </Alert>
    );
  }
  if (!roadmap) {
    return (
      <Empty className="m-4 min-h-56 w-auto border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Spinner aria-label="Cargando roadmap" /></EmptyMedia>
          <EmptyTitle>Cargando roadmap...</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <section className="relative grid min-h-[calc(100dvh-4rem)] min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden border border-border bg-card lg:h-full lg:min-h-0">
      <div aria-label={`Lienzo del roadmap de ${input.courseOffering.title}`} className="relative min-h-[540px] bg-background lg:min-h-0">
        <RoadmapGraph
          projection={{ kind: 'student', roadmap }}
          onSelectNode={selectNode}
          selectedNodeId={selectedNodeId}
          onClearSelectedNode={() => setSelectedNodeId(null)}
        />
      </div>
      <StudentNodeDetail
        node={selectedNode}
        status={selectedNode ? studentNodeStatus(selectedNode) : null}
        nodeTypes={roadmap.nodeTypes}
        isReadOnly={isHistorical}
        onClose={() => setSelectedNodeId(null)}
        onComplete={(node) => {
          void completeNode(node.id).then((completed) => setSuccess(completed));
        }}
      />
      <div className="pointer-events-none absolute right-4 bottom-4 z-5 flex flex-col gap-2">
        {error ? <RoadmapErrorToast message={error} onDismiss={dismissError} /> : null}
        {success ? <RoadmapSuccessToast message="Nodo completado." onDismiss={() => setSuccess(false)} /> : null}
      </div>
    </section>
  );
}
