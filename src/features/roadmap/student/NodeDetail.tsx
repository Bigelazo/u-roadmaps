'use client';

import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Download, Eye, FileText, Pencil, X } from 'lucide-react';
import type { NodeType, Resource, RoadmapNode, StudentRoadmapNode } from '@/features/roadmap/types';
import {
  isStudentBlockedNode,
  studentNodeBlockMessages,
  type StudentNodeStatus,
} from '@/features/roadmap/student/node-status';
import { Button } from '@/shared/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/empty';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/shared/ui/item';
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
  const accessOnMiddleClick = (resource: Resource) => (event: MouseEvent) => {
    if (event.button === 1) accessResource(resource);
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
          <h3 className="flex items-center gap-2 font-semibold">
            <FileText size={18} /> Descripción
          </h3>
          <div className="mt-5">
            <NodeDescription description={node.description} />
          </div>
          <Separator className="my-6" />
          <h3 className="flex items-center gap-2 font-semibold">
            <Download size={18} /> Recursos
          </h3>
          <div className="mt-6">
            {node.resources.length ? (
              <ItemGroup>
                {node.resources.map((resource) => (
                  <Item
                    key={resource.id}
                    variant="outline"
                    render={
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={resourceActionLabel(resource)}
                        onClick={() => accessResource(resource)}
                        onAuxClick={accessOnMiddleClick(resource)}
                      />
                    }
                  >
                    <ItemMedia variant="icon" className="text-primary">
                      <ResourceIcon resource={resource} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{resource.title}</ItemTitle>
                      <ResourceMetadata resource={resource} isReviewed={isReviewed(resource)} />
                    </ItemContent>
                    <ItemActions className="text-primary">
                      <ResourceActionIcon type={resource.type} size={18} />
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            ) : (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyTitle>No hay recursos adjuntos</EmptyTitle>
                  <EmptyDescription>No hay recursos adjuntos para este nodo.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </DetailBody>
      ) : null}
    </>
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
