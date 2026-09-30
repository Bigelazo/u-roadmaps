'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelectedNotification } from './NotificationsInbox';
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
  const { notification, select } = useSelectedNotification();
  const acknowledgedNotice = useRef<string | null>(null);
  const [readError, setReadError] = useState(false);
  const date = new Date(occurredAt);
  const effectiveDate = Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' }).format(date);

  const markRead = useCallback(() => {
    if (!notification) return;
    setReadError(false);
    void notification.read().then(
      () => select(null),
      () => setReadError(true),
    );
  }, [notification, select]);

  useEffect(() => {
    if (!noticeId || notification?.id !== noticeId || acknowledgedNotice.current === noticeId)
      return;
    acknowledgedNotice.current = noticeId;
    markRead();
  }, [markRead, noticeId, notification]);

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
        {readError ? (
          <p className="text-sm text-destructive" role="alert">
            No se pudo reconocer el aviso.{' '}
            <button className="font-semibold underline" onClick={markRead} type="button">
              Reintentar
            </button>
          </p>
        ) : null}
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
