'use client';

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { cn } from 'cn';
import type { Resource } from '@/features/roadmap/types';
import {
  resourcePreviewKind,
  type ResourcePreviewKind,
} from '@/features/roadmap/domain/resource-file-category';
import { buttonVariants } from '@/shared/ui/button-variants';
import { resourceActionLabel } from './resource-action-label';
import { NodeFullscreenDialog } from './NodeFullscreenDialog';
import { NodeDescription } from './LazyNodeDescription';

type Props = {
  resource: Resource;
  className: string;
  onAccess?: (resource: Resource) => void;
  children: ReactNode;
};

export function ResourceAction({ resource, className, onAccess, children }: Props) {
  const previewKind = resourcePreviewKind(resource);
  const label = resourceActionLabel(resource);
  if (!previewKind) {
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        onClick={() => onAccess?.(resource)}
        onAuxClick={(event: MouseEvent) => {
          if (event.button === 1) onAccess?.(resource);
        }}
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <NodeFullscreenDialog
      title={resource.title}
      trigger={
        <button
          type="button"
          aria-label={label}
          onClick={() => onAccess?.(resource)}
          className={cn(className, 'text-left')}
        >
          {children}
        </button>
      }
      actions={
        <a
          href={resource.url}
          download={resource.title}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' })}
        >
          <Download data-icon="inline-start" />
          Descargar
        </a>
      }
    >
      <ResourcePreview kind={previewKind} resource={resource} />
    </NodeFullscreenDialog>
  );
}

function ResourcePreview({ kind, resource }: { kind: ResourcePreviewKind; resource: Resource }) {
  if (kind === 'pdf') {
    return (
      <iframe
        title={`Vista previa de ${resource.title}`}
        src={`${resource.url}?disposition=inline`}
        className="size-full rounded-md border border-border"
      />
    );
  }
  return <MarkdownPreview url={resource.url} />;
}

type MarkdownState =
  { status: 'loading' } | { status: 'ready'; text: string } | { status: 'error' };

function MarkdownPreview({ url }: { url: string }) {
  const [state, setState] = useState<MarkdownState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(response.statusText);
        return response.text();
      })
      .then(
        (text) => setState({ status: 'ready', text }),
        () => {
          if (!controller.signal.aborted) setState({ status: 'error' });
        },
      );
    return () => controller.abort();
  }, [url]);

  if (state.status === 'loading')
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Cargando vista previa…
      </p>
    );
  if (state.status === 'error')
    return (
      <p role="alert" className="text-sm text-destructive">
        No se pudo cargar la vista previa. Descarga el archivo para verlo.
      </p>
    );
  return <NodeDescription description={state.text} />;
}
