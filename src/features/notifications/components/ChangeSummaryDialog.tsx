'use client';

import type { ComponentType } from 'react';
import { History } from 'lucide-react';
import type {
  ChangeSummary,
  ChangeSummaryGroup,
  ChangeSummaryItem,
  ChangeSummaryNode,
} from '../contracts/change-summary';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';

export type ChangeSummaryNodeName = ComponentType<ChangeSummaryNode>;

export function ChangeSummaryDialog({
  summary,
  close,
  NodeName,
}: {
  summary: ChangeSummary | null;
  close: () => void;
  NodeName: ChangeSummaryNodeName;
}) {
  return (
    <Dialog
      open={Boolean(summary)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[80dvh] gap-5 overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <div
            aria-hidden="true"
            data-change-summary-icon
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <History className="size-5" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle className="tracking-tight">
              Cambios en el Roadmap de {summary?.courseCode}
            </DialogTitle>
            <DialogDescription>Desde tu última visita</DialogDescription>
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {summary?.groups.map((group, index) => (
            <ChangeSummarySection key={index} group={group} NodeName={NodeName} />
          ))}
        </div>
        <DialogFooter>
          <Button onClick={close} type="button">
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeSummarySection({
  group,
  NodeName,
}: {
  group: ChangeSummaryGroup;
  NodeName: ChangeSummaryNodeName;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold">
        {group.node ? (
          <NodeName title={group.node.title} nodeType={group.node.nodeType} />
        ) : (
          group.title
        )}
      </h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-muted-foreground">
        {group.items.map((item, itemIndex) => (
          <li key={itemIndex}>
            <ChangeSummaryText item={item} NodeName={NodeName} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChangeSummaryText({
  item,
  NodeName,
}: {
  item: ChangeSummaryItem;
  NodeName: ChangeSummaryNodeName;
}) {
  if (typeof item === 'string') return item;
  return item.map((part, index) =>
    typeof part === 'string' ? (
      <span key={index}>{part}</span>
    ) : (
      <NodeName key={index} title={part.node.title} nodeType={part.node.nodeType} />
    ),
  );
}
