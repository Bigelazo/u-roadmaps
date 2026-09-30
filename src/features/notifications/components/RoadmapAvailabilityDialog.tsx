'use client';

import { useNotifications } from '@novu/nextjs/hooks';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';

type Props = Readonly<{
  noticeId: string | null;
  courseName: string;
  actorName: string;
  occurredAt: string;
}>;

export function RoadmapAvailabilityDialog({ noticeId, courseName, actorName, occurredAt }: Props) {
  const router = useRouter();
  const { notifications } = useNotifications({ limit: 10 });
  const acknowledgedNotice = useRef<string | null>(null);
  const date = new Date(occurredAt);
  const effectiveDate = Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' }).format(date);

  useEffect(() => {
    if (!noticeId || acknowledgedNotice.current === noticeId) return;
    const notice = notifications?.find((item) => item.id === noticeId);
    if (!notice) return;
    acknowledgedNotice.current = noticeId;
    void notice.read();
  }, [noticeId, notifications]);

  function close() {
    router.replace(window.location.pathname, { scroll: false });
  }

  return (
    <Dialog open={Boolean(noticeId)} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roadmap disponible</DialogTitle>
          <DialogDescription>
            Se creó el roadmap de {courseName} para que puedas comenzar a recorrerlo.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="font-semibold">Autor</dt>
            <dd className="text-muted-foreground">{actorName}</dd>
          </div>
          <div>
            <dt className="font-semibold">Fecha y hora</dt>
            <dd className="text-muted-foreground">{effectiveDate}</dd>
          </div>
        </dl>
        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" onClick={close}>
                Entendido
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
