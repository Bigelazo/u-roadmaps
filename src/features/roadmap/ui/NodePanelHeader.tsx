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
        'relative border-b border-border px-6 pt-7 pb-6',
        isSidebar && 'shrink-0 p-0 px-6 pt-7 pb-6',
      )}
    >
      <div className="min-w-0 pr-20">
        <p className="text-xs font-bold tracking-[1.2px] text-primary uppercase">Nodo seleccionado</p>
        <div className="mt-1 flex min-w-0 items-start gap-3">
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
            <SheetTitle className="min-w-0 font-heading text-2xl font-semibold tracking-[-0.035em] wrap-break-word">
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
      </div>
      <div
        className="absolute top-4 right-4 flex items-center gap-1"
        role="group"
        aria-label="Acciones del nodo"
      >
        {actions}
      </div>
      {footer}
    </Header>
  );
}
