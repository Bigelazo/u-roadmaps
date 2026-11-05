'use client';

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

  return (
    <Header
      className={cn(
        'shrink-0 border-b border-border px-6 pt-4 pb-6',
        isSidebar && 'shrink-0 p-0 px-6 pt-4 pb-6',
      )}
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-bold tracking-[1.2px] text-primary uppercase max-sm:sr-only">
          Nodo seleccionado
        </p>
        <div
          className="ml-auto flex shrink-0 items-center justify-end gap-1"
          role="group"
          aria-label="Acciones del nodo"
        >
          {actions}
        </div>
      </div>
      <div className="mt-2 flex min-w-0 items-start gap-3">
        {nodeType ? (
          <NodeTypeIcon
            icon={nodeType.icon}
            data-testid={iconTestId}
            className="mt-1 size-5 shrink-0"
            style={{ color: nodeType.color }}
            aria-hidden="true"
          />
        ) : null}
        {isModal ? (
          <SheetTitle
            id={headingId}
            className="min-w-0 font-heading text-2xl font-semibold tracking-[-0.035em] wrap-break-word"
          >
            {title}
          </SheetTitle>
        ) : (
          <h2
            id={headingId}
            className="min-w-0 font-heading text-2xl font-semibold tracking-[-0.035em] wrap-break-word"
          >
            {title}
          </h2>
        )}
      </div>
      {footer}
    </Header>
  );
}
