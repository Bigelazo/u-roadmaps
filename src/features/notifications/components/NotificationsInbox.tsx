'use client';

import { NovuProvider } from '@novu/nextjs';
import { useCounts, useNotifications } from '@novu/nextjs/hooks';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { Bell } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import type { InboxIdentity } from '../server';

type NotificationRecord = NonNullable<ReturnType<typeof useNotifications>['notifications']>[number];

function stringField(data: Record<string, unknown>, field: string) {
  const value = data[field];
  return typeof value === 'string' ? value : null;
}

function numberField(data: Record<string, unknown>, field: string) {
  const value = data[field];
  return typeof value === 'number' ? value : null;
}

function notificationDate(notification: NotificationRecord) {
  const occurredAt = stringField(notification.data ?? {}, 'occurredAt');
  if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(occurredAt),
  );
}

function NotificationRow({
  notification,
  onSelect,
}: {
  notification: NotificationRecord;
  onSelect: (notification: NotificationRecord) => void;
}) {
  useEffect(() => {
    notification.seen();
  }, [notification]);

  return (
    <li>
      <button
        className="flex min-h-16 w-full flex-col items-start gap-1 border-b px-4 py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => onSelect(notification)}
        type="button"
      >
        <span className="font-semibold">{notification.subject ?? 'Aviso de U-Roadmaps'}</span>
        <span className="text-sm text-muted-foreground">{notification.body}</span>
        <time className="text-xs text-muted-foreground">{notificationDate(notification)}</time>
      </button>
    </li>
  );
}

function InboxBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    counts,
    isLoading: countsLoading,
    error: countsError,
  } = useCounts({
    filters: [{ read: false }],
  });
  const { notifications, isLoading, isFetching, hasMore, error, fetchMore, refetch } =
    useNotifications({ limit: 10 });
  const unreadCount = counts?.[0]?.count ?? 0;

  function selectNotification(notification: NotificationRecord) {
    const data = notification.data ?? {};
    const courseCode = stringField(data, 'courseCode');
    const year = numberField(data, 'year');
    const semester = numberField(data, 'semester');
    const occurredAt = stringField(data, 'occurredAt');
    if (!courseCode || year === null || semester === null || !occurredAt) return;

    const params = new URLSearchParams({
      notice: notification.id,
      actor: stringField(data, 'actorName') ?? 'Equipo docente',
      occurredAt,
    });
    router.push(
      `/courses/${encodeURIComponent(courseCode)}/${year}/${semester}?${params.toString()}`,
    );
    setOpen(false);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        aria-label={
          countsError
            ? 'Avisos, contador no disponible'
            : `Avisos${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`
        }
        className="relative inline-flex size-11 items-center justify-center rounded-md text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        type="button"
      >
        <Bell aria-hidden="true" size={20} />
        {!countsLoading && unreadCount > 0 ? (
          <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner align="end" side="bottom" sideOffset={8}>
          <PopoverPrimitive.Popup className="z-50 max-h-[min(32rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg outline-none">
            <div className="border-b px-4 py-3">
              <h2 className="font-heading text-base font-semibold">Avisos</h2>
              {countsError ? (
                <p className="mt-1 text-sm text-destructive" role="status">
                  No se pudo actualizar el contador.
                </p>
              ) : null}
            </div>
            <div className="max-h-[calc(min(32rem,100dvh-6rem)-4rem)] overflow-y-auto">
              {isLoading && !notifications ? (
                <p className="p-6 text-center text-sm text-muted-foreground" role="status">
                  Cargando avisos…
                </p>
              ) : error ? (
                <div className="grid justify-items-center gap-3 p-6 text-center">
                  <p className="text-sm text-muted-foreground" role="alert">
                    No se pudieron cargar los avisos.
                  </p>
                  <Button onClick={() => void refetch()} type="button" variant="outline">
                    Reintentar
                  </Button>
                </div>
              ) : notifications?.length ? (
                <>
                  <ul aria-label="Lista de avisos">
                    {notifications.map((notification) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        onSelect={selectNotification}
                      />
                    ))}
                  </ul>
                  {hasMore ? (
                    <div className="p-3">
                      <Button
                        className="w-full"
                        disabled={isFetching}
                        onClick={() => void fetchMore()}
                        type="button"
                        variant="outline"
                      >
                        {isFetching ? 'Cargando…' : 'Cargar más avisos'}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No tienes avisos todavía.
                </p>
              )}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function NotificationsProvider({
  identity,
  children,
}: {
  identity: InboxIdentity | null;
  children: ReactNode;
}) {
  if (!identity) return children;

  return (
    <NovuProvider
      key={identity.subscriber}
      applicationIdentifier={identity.applicationIdentifier}
      subscriber={identity.subscriber}
      subscriberHash={identity.subscriberHash}
      apiUrl={identity.apiUrl}
      socketUrl={identity.socketUrl}
    >
      {children}
    </NovuProvider>
  );
}

export function NotificationsInbox({ identity }: { identity: InboxIdentity }) {
  return <InboxBell key={identity.subscriber} />;
}
