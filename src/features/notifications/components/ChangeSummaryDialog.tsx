'use client';

import type { ChangeSummary } from '../contracts/change-summary';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';

export function ChangeSummaryDialog({
  summary,
  close,
}: {
  summary: ChangeSummary | null;
  close: () => void;
}) {
  return (
    <Dialog
      open={Boolean(summary)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent showCloseButton={false} className="max-h-[80dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambios en el Roadmap de {summary?.courseCode}</DialogTitle>
          <DialogDescription>Desde tu última visita</DialogDescription>
        </DialogHeader>
        {summary?.groups.map((group, index) => (
          <section key={index} className="flex flex-col gap-2">
            <h3 className="font-semibold">{group.title}</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {group.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <DialogFooter>
          <Button onClick={close} type="button">
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
