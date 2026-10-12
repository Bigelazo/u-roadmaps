'use client';

import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import {
  Check,
  CircleCheckBig,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  LockKeyhole,
  X,
} from 'lucide-react';
import type { NodeType, Resource, RoadmapNode, StudentRoadmapNode } from '@/features/roadmap/types';
import {
  isStudentBlockedNode,
  studentNodeBlockMessages,
  type StudentNodeStatus,
} from '@/features/roadmap/student/node-status';
import { Button } from '@/shared/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/shared/ui/item';
import { Separator } from '@/shared/ui/separator';
import { Sheet, SheetContent } from '@/shared/ui/sheet';
import { SidebarContent, SidebarProvider } from '@/shared/ui/sidebar';
import { RoadmapSidePanel } from '@/features/roadmap/ui/RoadmapSidePanel';
import { NodePanelHeader } from '@/features/roadmap/ui/NodePanelHeader';
import { NodeFullscreenDialog } from '@/features/roadmap/ui/NodeFullscreenDialog';
import { NodeDescription } from '@/features/roadmap/ui/NodeDescription';

function resourceIcon(type: Resource['type']) {
  return type === 'VIDEO' ? <FileCode2 size={20} /> : <FileText size={20} />;
}

function resourceTypeLabel(type: Resource['type']) {
  return type === 'FILE' ? 'Archivo descargable' : type === 'VIDEO' ? 'Video' : 'Enlace externo';
}

function resourceActionIcon(type: Resource['type']) {
  return type === 'FILE' ? (
    <Download size={18} aria-hidden="true" />
  ) : (
    <ExternalLink size={18} aria-hidden="true" />
  );
}

type ContentProps = {
  node: RoadmapNode | StudentRoadmapNode;
  status: StudentNodeStatus;
  onClose: () => void;
  onComplete: (node: RoadmapNode | StudentRoadmapNode) => void;
  isReadOnly?: boolean;
  isModal?: boolean;
  isSidebar?: boolean;
  nodeType?: NodeType;
};

function StudentNodeDetailContent({
  node,
  status,
  onClose,
  onComplete,
  isReadOnly = false,
  isModal = false,
  isSidebar = false,
  nodeType,
}: ContentProps) {
  const blocked = isStudentBlockedNode(node);
  return (
    <>
      <NodePanelHeader
        title={node.title}
        nodeType={nodeType}
        iconTestId="student-node-type-icon"
        headingId="student-node-detail-title"
        isModal={isModal}
        isSidebar={isSidebar}
        actions={
          <>
            {status === 'completed' ? (
              <Button disabled variant="outline">
                <Check data-icon="inline-start" />
                Completado
              </Button>
            ) : (
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={status === 'locked' || isReadOnly}
                onClick={() => onComplete(node)}
              >
                {status === 'locked' ? (
                  <LockKeyhole data-icon="inline-start" />
                ) : (
                  <CircleCheckBig data-icon="inline-start" />
                )}
                {status === 'locked' ? 'Completa prerrequisitos' : 'Completar'}
              </Button>
            )}
            {!blocked ? (
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
                        aria-label={resource.title}
                      />
                    }
                  >
                    <ItemMedia variant="icon" className="text-primary">
                      {resourceIcon(resource.type)}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{resource.title}</ItemTitle>
                      <ItemDescription>{resourceTypeLabel(resource.type)}</ItemDescription>
                    </ItemContent>
                    <ItemActions className="text-primary">
                      {resourceActionIcon(resource.type)}
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

  return <div className="overflow-y-auto px-6 py-6">{children}</div>;
}

type Props = Omit<ContentProps, 'node' | 'status'> & {
  node: RoadmapNode | StudentRoadmapNode | undefined;
  status: StudentNodeStatus | null;
  nodeTypes?: NodeType[];
  panelWidth?: number;
  onPanelWidthChange?: (width: number) => void;
};

const mobileLayoutQuery = '(max-width: 767px)';

function subscribeToMobileLayout(onStoreChange: () => void) {
  const media = window.matchMedia(mobileLayoutQuery);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function getMobileLayoutSnapshot() {
  return window.matchMedia(mobileLayoutQuery).matches;
}

function useMobileLayout() {
  return useSyncExternalStore(subscribeToMobileLayout, getMobileLayoutSnapshot, () => false);
}

export function StudentNodeDetail({
  node,
  status,
  onClose,
  onComplete,
  isReadOnly,
  nodeTypes,
  panelWidth = 426,
  onPanelWidthChange,
}: Props) {
  const isMobile = useMobileLayout();
  if (!node || !status || isStudentBlockedNode(node)) return null;
  const contentProps = {
    node,
    status,
    onClose,
    onComplete,
    isReadOnly,
    nodeType: nodeTypes?.find((type) => type.id === node.nodeTypeId),
  };
  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-modal="true"
          className="gap-0 overflow-y-auto border-0 bg-card shadow-none data-[side=bottom]:h-dvh! data-[side=bottom]:max-h-dvh!"
        >
          <StudentNodeDetailContent {...contentProps} isModal />
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
        <StudentNodeDetailContent {...contentProps} isSidebar />
      </RoadmapSidePanel>
    </SidebarProvider>
  );
}
