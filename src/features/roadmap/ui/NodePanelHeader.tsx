'use client';

import { nodeTypePaint } from '@/shared/node-type';
import { type ReactNode } from 'react';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type { NodeType } from '@/features/roadmap/types';
import { SheetTitle } from '@/shared/ui/sheet';
import { SidebarHeader } from '@/shared/ui/sidebar';
import { cn } from 'cn';

type Props = {
  title: string;
  nodeType?: NodeType;
  actions: ReactNode;
  footer?: ReactNode;
  headingId?: string;
  iconTestId?: string;
  isModal?: boolean;
  isSidebar?: boolean;
};

export function NodePanelHeader({
  title,
  nodeType,
  actions,
  footer,
  headingId,
  iconTestId,
  isModal = false,
  isSidebar = false,
}: Props) {
  const Header = isSidebar ? SidebarHeader : 'header';
  const Title = isModal ? SheetTitle : 'h2';

  return (
    <Header
      className={cn(
        'sticky top-0 z-10 shrink-0 border-b border-border bg-card px-6 py-2.5',
        isSidebar && 'gap-0 p-0 px-6 py-2.5',
      )}
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {nodeType ? (
            <NodeTypeIcon
              icon={nodeType.icon}
              data-testid={iconTestId}
              className="size-5 shrink-0"
              style={{ color: nodeTypePaint(nodeType.color) }}
              aria-hidden="true"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[0.6875rem] leading-4 font-bold tracking-[1.2px] text-primary uppercase max-sm:sr-only">
              Nodo seleccionado
            </p>
            <Title
              id={headingId}
              title={title}
              className="line-clamp-2 min-w-0 font-heading text-lg leading-snug font-semibold tracking-[-0.02em] wrap-break-word"
            >
              {title}
            </Title>
          </div>
        </div>
        <div
          className="flex shrink-0 items-center justify-end gap-1"
          role="group"
          aria-label="Acciones del nodo"
        >
          {actions}
        </div>
      </div>
      {footer}
    </Header>
  );
}
