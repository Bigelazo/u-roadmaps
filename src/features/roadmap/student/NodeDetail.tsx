'use client';

import { useSyncExternalStore } from 'react';
import {
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  LockKeyhole,
  X,
} from 'lucide-react';
import type { Resource, RoadmapNode, StudentRoadmapNode } from '@/features/roadmap/types';
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
import { Sheet, SheetContent, SheetTitle } from '@/shared/ui/sheet';

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
  isModal?: boolean;
};

function StudentNodeDetailContent({
  node,
  status,
  onClose,
  onComplete,
  isModal = false,
}: ContentProps) {
  const blocked = isStudentBlockedNode(node);
  return (
    <>
      <header className="relative border-b border-border px-6 pt-7 pb-6">
        <Button
          aria-label="Cerrar detalle"
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
        >
          <X size={18} />
        </Button>
        <p className="text-xs font-bold tracking-[1.2px] text-primary uppercase">
          Nodo del roadmap
        </p>
        {isModal ? (
          <SheetTitle className="mt-1 font-heading text-2xl font-semibold tracking-[-0.035em]">
            {node.title}
          </SheetTitle>
        ) : (
          <h2
            id="student-node-detail-title"
            className="mt-1 font-heading text-2xl font-semibold tracking-[-0.035em]"
          >
            {node.title}
          </h2>
        )}
        {status === 'completed' ? (
          <Button disabled className="mt-5">
            <Check data-icon="inline-start" />
            Completado
          </Button>
        ) : (
          <Button className="mt-5" disabled={status === 'locked'} onClick={() => onComplete(node)}>
            {status === 'locked' ? (
              <LockKeyhole data-icon="inline-start" />
            ) : (
              <CheckCircle2 data-icon="inline-start" />
            )}
            {status === 'locked' ? 'Completa prerrequisitos' : 'Completar'}
          </Button>
        )}
        {status === 'locked' ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {blocked
              ? studentNodeBlockMessages[node.access.reason]
              : 'Este nodo se desbloquea cuando completes sus prerrequisitos.'}
          </p>
        ) : null}
      </header>
      {!blocked ? (
        <div className="overflow-y-auto px-6 py-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <FileText size={18} /> Descripción
          </h3>
          <p className="mt-5 leading-[1.62] whitespace-pre-line text-muted-foreground">
            {node.description || 'Este nodo no tiene una descripción disponible.'}
          </p>
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
        </div>
      ) : null}
    </>
  );
}

type Props = Omit<ContentProps, 'node' | 'status'> & {
  node: RoadmapNode | StudentRoadmapNode | undefined;
  status: StudentNodeStatus | null;
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

export function StudentNodeDetail({ node, status, onClose, onComplete }: Props) {
  const isMobile = useMobileLayout();
  if (!node || !status || isStudentBlockedNode(node)) return null;
  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-modal="true"
          className="gap-0 overflow-y-auto border-0 bg-card shadow-none data-[side=bottom]:!h-dvh data-[side=bottom]:!max-h-dvh"
        >
          <StudentNodeDetailContent
            node={node}
            status={status}
            onClose={onClose}
            onComplete={onComplete}
            isModal
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      aria-labelledby="student-node-detail-title"
      className="absolute top-0 right-0 bottom-0 z-[6] flex w-[426px] flex-col border-l border-border bg-card shadow-[-8px_0_24px_rgb(18_33_58_/_10%)]"
    >
      <StudentNodeDetailContent
        node={node}
        status={status}
        onClose={onClose}
        onComplete={onComplete}
      />
    </aside>
  );
}
