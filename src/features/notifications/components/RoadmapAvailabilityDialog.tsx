'use client';

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
  courseCode: string;
  year: number;
  semester: number;
  courseName: string;
}>;

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length <= 256 ? value : fallback;
}

export function RoadmapAvailabilityDialog({
  noticeId,
  courseCode,
  year,
  semester,
  courseName,
}: Props) {
  const router = useRouter();
  const { notification } = useSelectedNotification();
  const data = notification?.id === noticeId ? (notification.data ?? {}) : null;
  const noticeMatchesCourse = Boolean(
    data && data.courseCode === courseCode && data.year === year && data.semester === semester,
  );
  const changeKind = noticeMatchesCourse ? data?.changeKind : null;
  const resourceChange =
    changeKind === 'resource-added' ||
    changeKind === 'resource-updated' ||
    changeKind === 'resource-removed';
  const pathChange = changeKind === 'dependency-added' || changeKind === 'dependency-removed';
  const nodeTitle = noticeMatchesCourse ? stringValue(data?.nodeTitle, '') : '';
  const nodeTypeName = noticeMatchesCourse ? stringValue(data?.nodeTypeName, '') : '';
  const nodeChange =
    changeKind === 'node-available' ||
    changeKind === 'node-updated' ||
    changeKind === 'node-retired' ||
    changeKind === 'node-deleted' ||
    changeKind === 'node-blocked';
  const preservedNodeTitle =
    nodeTitle || (nodeChange ? stringValue(notification?.subject, '') : '');
  const occurredAt = noticeMatchesCourse ? stringValue(data?.occurredAt, '') : '';
  const date = occurredAt ? new Date(occurredAt) : null;
  const effectiveDate =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' }).format(date)
      : 'Fecha no disponible';
  const actorName = noticeMatchesCourse
    ? stringValue(data?.actorName, 'Equipo docente')
    : 'Equipo docente';
  const open = Boolean(noticeId && notification?.id === noticeId && noticeMatchesCourse);

  function close() {
    router.replace(window.location.pathname, { scroll: false });
  }

  const title = resourceChange
    ? stringValue(notification?.subject, 'Cambio de recurso')
    : pathChange
      ? stringValue(notification?.subject, 'Ruta actualizada')
      : changeKind === 'node-available'
        ? 'Nodo disponible'
        : changeKind === 'node-updated'
          ? 'Nodo actualizado'
          : changeKind === 'node-retired'
            ? 'Nodo retirado'
            : changeKind === 'node-deleted'
              ? 'Nodo eliminado'
              : changeKind === 'node-blocked'
                ? 'Nodo bloqueado'
                : 'Roadmap disponible';
  const description =
    resourceChange || pathChange || (nodeChange && notification?.body)
      ? stringValue(
          notification?.body,
          pathChange
            ? `Se actualizó la ruta del Roadmap de ${courseName}.`
            : `Se modificó un recurso en ${courseName}.`,
        )
      : changeKind === 'node-available'
        ? `Se agregó un Nodo al Roadmap de ${courseName}.`
        : changeKind === 'node-updated'
          ? `Se actualizó un Nodo del Roadmap de ${courseName}.`
          : changeKind === 'node-retired'
            ? `Se retiró un Nodo visible del Roadmap de ${courseName}.`
            : changeKind === 'node-deleted'
              ? `Se eliminó un Nodo del Roadmap de ${courseName}.`
              : changeKind === 'node-blocked'
                ? `Un Nodo del Roadmap de ${courseName} dejó de estar disponible.`
                : `Se creó el Roadmap de ${courseName} para que puedas comenzar a recorrerlo.`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {preservedNodeTitle ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-semibold">{preservedNodeTitle}</p>
            {changeKind === 'node-deleted' && nodeTypeName ? (
              <p className="text-muted-foreground">Tipo: {nodeTypeName}</p>
            ) : null}
          </div>
        ) : null}
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
