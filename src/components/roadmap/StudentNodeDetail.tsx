'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
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
import type { Resource, RoadmapNode } from '@/lib/roadmap-types';
import type { StudentNodeStatus } from '@/components/roadmap/node-status';
import { Button } from '@/components/ui/button';

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
  node: RoadmapNode;
  status: StudentNodeStatus;
  onClose: () => void;
  onComplete: (node: RoadmapNode) => void;
};

function StudentNodeDetailContent({ node, status, onClose, onComplete }: ContentProps) {
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
        <h2
          id="student-node-detail-title"
          className="mt-1 font-heading text-2xl font-semibold tracking-[-0.035em]"
        >
          {node.title}
        </h2>
        {status === 'completed' ? (
          <Button disabled className="mt-5">
            <Check size={16} />
            Completado
          </Button>
        ) : (
          <Button className="mt-5" disabled={status === 'locked'} onClick={() => onComplete(node)}>
            {status === 'locked' ? <LockKeyhole size={16} /> : <CheckCircle2 size={16} />}
            {status === 'locked' ? 'Completa prerrequisitos' : 'Completar'}
          </Button>
        )}
        {status === 'locked' ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Este nodo se desbloquea cuando completes sus prerrequisitos.
          </p>
        ) : null}
      </header>
      <div className="overflow-y-auto px-6 py-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <FileText size={18} /> Descripción
        </h3>
        <p className="mt-5 leading-[1.62] whitespace-pre-line text-muted-foreground">
          {node.description || 'Este nodo no tiene una descripción disponible.'}
        </p>
        <hr className="my-6 border-border" />
        <h3 className="flex items-center gap-2 font-semibold">
          <Download size={18} /> Recursos
        </h3>
        <div className="mt-6 space-y-5">
          {node.resources.length ? (
            node.resources.map((resource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-5 rounded-lg border border-border p-5 text-foreground transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="text-primary">{resourceIcon(resource.type)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{resource.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {resourceTypeLabel(resource.type)}
                  </span>
                </span>
                <span className="text-primary">{resourceActionIcon(resource.type)}</span>
              </a>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay recursos adjuntos para este nodo.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

type Props = Omit<ContentProps, 'node' | 'status'> & {
  node: RoadmapNode | undefined;
  status: StudentNodeStatus | null;
};

function useMobileLayout() {
  const query = '(max-width: 767px)';
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : (window.matchMedia?.(query).matches ?? true),
  );

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isMobile;
}

export function StudentNodeDetail({ node, status, onClose, onComplete }: Props) {
  const isMobile = useMobileLayout();
  if (!node || !status) {
    if (isMobile) return null;
    return (
      <aside className="absolute top-0 right-0 bottom-0 z-[6] w-[426px] border-l border-border bg-card shadow-[-8px_0_24px_rgb(18_33_58_/_10%)]">
        <div className="mt-0 p-6 lg:mt-8">
          <h2 className="font-heading text-xl font-semibold">Selecciona un nodo</h2>
          <p className="mt-4 text-muted-foreground">
            Revisa su descripción, materiales y estado de avance desde este panel.
          </p>
        </div>
      </aside>
    );
  }
  const content = (
    <StudentNodeDetailContent
      node={node}
      status={status}
      onClose={onClose}
      onComplete={onComplete}
    />
  );

  if (isMobile) {
    return (
      <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/30" />
          <Dialog.Viewport className="fixed inset-0 z-50 overflow-y-auto">
            <Dialog.Popup
              className="min-h-full bg-card"
              aria-labelledby="student-node-detail-title"
              aria-modal="true"
            >
              {content}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <aside
      aria-labelledby="student-node-detail-title"
      className="absolute top-0 right-0 bottom-0 z-[6] flex w-[426px] flex-col border-l border-border bg-card shadow-[-8px_0_24px_rgb(18_33_58_/_10%)]"
    >
      {content}
    </aside>
  );
}
