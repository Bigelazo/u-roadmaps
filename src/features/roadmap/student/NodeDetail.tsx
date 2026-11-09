'use client';

import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Eye, Pencil, X } from 'lucide-react';
import type { NodeType, Resource, RoadmapNode, StudentRoadmapNode } from '@/features/roadmap/types';
import {
  isStudentBlockedNode,
  studentNodeBlockMessages,
  type StudentNodeStatus,
} from '@/features/roadmap/student/node-status';
import { Button } from '@/shared/ui/button';
import { CompleteNodeButton } from '@/features/roadmap/student/CompleteNodeButton';
import { ResourceMetadata } from '@/features/roadmap/ui/ResourceMetadata';
import { Separator } from '@/shared/ui/separator';
import { Sheet, SheetContent } from '@/shared/ui/sheet';
import { SidebarContent, SidebarProvider } from '@/shared/ui/sidebar';
import { RoadmapSidePanel } from '@/features/roadmap/ui/RoadmapSidePanel';
import { NodePanelHeader } from '@/features/roadmap/ui/NodePanelHeader';
import { useCompactCanvasLayout } from '@/features/roadmap/ui/compact-canvas-layout';
import { NodeFullscreenDialog } from '@/features/roadmap/ui/NodeFullscreenDialog';
import { NodeDescription } from '@/features/roadmap/ui/NodeDescription';
import {
  ResourceActionIcon,
  ResourceIcon,
  resourceActionLabel,
} from '@/features/roadmap/ui/ResourceIcon';

type ContentProps = {
  node: RoadmapNode | StudentRoadmapNode;
  status: StudentNodeStatus;
  onClose: () => void;
  onComplete: (node: RoadmapNode | StudentRoadmapNode) => void;
  onResourceAccess?: (resource: Resource) => void;
  isReadOnly?: boolean;
  isModal?: boolean;
  isSidebar?: boolean;
  isTeacherPreview?: boolean;
  nodeType?: NodeType;
};

function StudentNodeDetailContent({
  node,
  status,
  onClose,
  onComplete,
  onResourceAccess,
  isReadOnly = false,
  isModal = false,
  isSidebar = false,
  isTeacherPreview = false,
  nodeType,
}: ContentProps) {
  const blocked = isStudentBlockedNode(node);
  const [previewReviewedIds, setPreviewReviewedIds] = useState<ReadonlySet<string>>(new Set());
  const resources = blocked ? [] : node.resources;
  const isReviewed = (resource: Resource) =>
    isTeacherPreview ? previewReviewedIds.has(resource.id) : Boolean(resource.isReviewed);
  const accessResource = (resource: Resource) => {
    if (isTeacherPreview) setPreviewReviewedIds((ids) => new Set(ids).add(resource.id));
    else onResourceAccess?.(resource);
  };

  return (
    <>
      {isTeacherPreview ? (
        <div className="flex shrink-0 items-center justify-between gap-3 bg-primary py-2 pr-3 pl-6 text-sm font-semibold text-primary-foreground">
          <p className="flex min-w-0 items-center gap-2">
            <Eye aria-hidden="true" className="size-4 shrink-0" />
            Vista previa como estudiante
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0"
            onClick={onClose}
          >
            <Pencil data-icon="inline-start" />
            Volver a editar
          </Button>
        </div>
      ) : null}
      <NodePanelHeader
        title={node.title}
        nodeType={nodeType}
        iconTestId="student-node-type-icon"
        headingId="student-node-detail-title"
        isModal={isModal}
        isSidebar={isSidebar}
        actions={
          <>
            <CompleteNodeButton
              status={status}
              isReadOnly={isReadOnly}
              hasUnreviewedResources={resources.some((resource) => !isReviewed(resource))}
              onComplete={() => onComplete(node)}
            />
            {!blocked && !isModal ? (
              <NodeFullscreenDialog
                key={node.id}
                title={node.title}
                description={node.description}
              />
            ) : null}
            <Button aria-label="Cerrar detalle" onClick={onClose} variant="ghost" size="icon">
              <X size={18} />
            </Button>
          </>
        }
        footer={
          status === 'locked' ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {blocked
                ? studentNodeBlockMessages[node.access.reason]
                : 'Este nodo se desbloquea cuando completes sus prerrequisitos.'}
            </p>
          ) : null
        }
      />
      {!blocked ? (
        <DetailBody isSidebar={isSidebar}>
          {node.resources.length ? (
            <>
              <StudentResourceList
                resources={node.resources}
                isReviewed={isReviewed}
                onAccess={accessResource}
              />
              <Separator className="my-5" />
            </>
          ) : null}
          <NodeDescription description={node.description} />
        </DetailBody>
      ) : null}
    </>
  );
}

function StudentResourceList({
  resources,
  isReviewed,
  onAccess,
}: {
  resources: Resource[];
  isReviewed: (resource: Resource) => boolean;
  onAccess: (resource: Resource) => void;
}) {
  return (
    <section aria-labelledby="student-node-resources-heading">
      <h3 id="student-node-resources-heading" className="mb-1.5 text-sm font-semibold">
        Recursos
      </h3>
      <ul className="-mx-2 flex flex-col">
        {resources.map((resource) => (
          <li key={resource.id}>
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              aria-label={resourceActionLabel(resource)}
              onClick={() => onAccess(resource)}
              onAuxClick={(event: MouseEvent) => {
                if (event.button === 1) onAccess(resource);
              }}
              className="group/resource flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="shrink-0 text-primary">
                <ResourceIcon resource={resource} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{resource.title}</span>
                <ResourceMetadata resource={resource} isReviewed={isReviewed(resource)} />
              </span>
              <ResourceActionIcon
                type={resource.type}
                size={16}
                className="shrink-0 text-muted-foreground group-hover/resource:text-primary"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DetailBody({ children, isSidebar }: { children: ReactNode; isSidebar: boolean }) {
  if (isSidebar) {
    return <SidebarContent className="px-6 py-6">{children}</SidebarContent>;
  }

  return <div className="min-h-0 overflow-y-auto px-6 py-6">{children}</div>;
}

type Props = Omit<ContentProps, 'node' | 'status'> & {
  node: RoadmapNode | StudentRoadmapNode | undefined;
  status: StudentNodeStatus | null;
  nodeTypes?: NodeType[];
  panelWidth?: number;
  onPanelWidthChange?: (width: number) => void;
};

export function StudentNodeDetail({
  node,
  status,
  onClose,
  onComplete,
  onResourceAccess,
  isReadOnly,
  isTeacherPreview,
  nodeTypes,
  panelWidth = 426,
  onPanelWidthChange,
}: Props) {
  const isCompact = useCompactCanvasLayout();
  if (!node || !status || isStudentBlockedNode(node)) return null;
  const contentProps = {
    node,
    status,
    onClose,
    onComplete,
    onResourceAccess,
    isReadOnly,
    isTeacherPreview,
    nodeType: nodeTypes?.find((type) => type.id === node.nodeTypeId),
  };
  if (isCompact) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          id="student-node-detail-panel"
          side="bottom"
          showCloseButton={false}
          aria-modal="true"
          className="max-h-[85dvh] gap-0 overflow-hidden rounded-t-xl bg-card pb-[env(safe-area-inset-bottom)]"
        >
          <StudentNodeDetailContent key={node.id} {...contentProps} isModal />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <SidebarProvider
      className="contents"
      style={{ '--sidebar-width': `${panelWidth}px` } as CSSProperties}
    >
      <RoadmapSidePanel
        id="student-node-detail-panel"
        aria-labelledby="student-node-detail-title"
        railLabel="Redimensionar detalle del nodo"
        panelWidth={panelWidth}
        onPanelWidthChange={onPanelWidthChange}
      >
        <StudentNodeDetailContent key={node.id} {...contentProps} isSidebar />
      </RoadmapSidePanel>
    </SidebarProvider>
  );
}
