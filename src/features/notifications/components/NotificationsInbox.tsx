'use client';

import { InboxDriverProvider, useCounts, useNotifications } from './inbox-driver';
import {
  acknowledgeOwnInbox,
  prepareOwnInboxOpening,
  type InboxRecord,
  type NoticeAcknowledgementOperation,
} from './inbox-api';
import { ChangeSummaryDialog } from './ChangeSummaryDialog';
import type { ChangeSummary } from '../contracts/change-summary';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { Bell, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import type { InboxIdentity } from '../server';
type NotificationRecord = InboxRecord;
type NotificationDataFilter = Record<string, string | number>;
const notificationDateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function NotificationCountButton({
  filter,
  label,
  enabled = true,
}: {
  filter: NotificationDataFilter;
  label: string;
  enabled?: boolean;
}) {
  if (!enabled) return null;
  return <NotificationCount filter={filter} label={label} />;
}

function NotificationCount({ filter, label }: { filter: NotificationDataFilter; label: string }) {
  const openInbox = useOpenNotificationInbox();
  const { counts, error } = useCounts({ filters: [{ read: false, data: filter }] });
  const count = counts?.[0]?.count ?? 0;
  if (count === 0 && !error) return null;
  return (
    <button
      aria-label={
        error
          ? `Avisos para ${label}, contador no disponible`
          : `${count} avisos sin leer para ${label}`
      }
      className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => openInbox(filter)}
      type="button"
    >
      <Bell aria-hidden="true" size={16} />
      <span>{error ? '?' : count}</span>
    </button>
  );
}

const NotificationInboxContext = createContext<{
  filter: NotificationDataFilter | undefined;
  openInbox: (filter?: NotificationDataFilter) => void;
  resetFilter: () => void;
}>({
  filter: undefined,
  openInbox: () => undefined,
  resetFilter: () => undefined,
});
const InboxOpenContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => undefined,
});
type AcknowledgeInput = {
  roadmapId: string;
  openingId?: string | null;
};
const NotificationAcknowledgementContext = createContext<{
  acknowledge: (input: AcknowledgeInput) => Promise<boolean>;
  retry: (input: AcknowledgeInput) => Promise<boolean>;
}>({ acknowledge: async () => true, retry: async () => true });

export function useNotificationAcknowledgement() {
  return useContext(NotificationAcknowledgementContext);
}

export function useOpenNotificationInbox() {
  return useContext(NotificationInboxContext).openInbox;
}

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
  return notificationDateFormatter.format(new Date(occurredAt));
}

function NotificationRow({
  notification,
  onSelect,
}: {
  notification: NotificationRecord;
  onSelect: (notification: NotificationRecord) => void;
}) {
  return (
    <li>
      <div className="border-b">
        <button
          className="flex min-h-16 w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={() => onSelect(notification)}
          type="button"
        >
          <span className="font-semibold">{notification.subject ?? 'Aviso de U-Roadmaps'}</span>
          <span className="text-sm text-muted-foreground">{notification.body}</span>
          <time className="text-xs text-muted-foreground">{notificationDate(notification)}</time>
        </button>
      </div>
    </li>
  );
}

function InboxNotificationList({
  notifications,
  isLoading,
  isFetching,
  hasMore,
  error,
  fetchMore,
  refetch,
  onSelect,
}: Pick<
  ReturnType<typeof useNotifications>,
  'notifications' | 'isLoading' | 'isFetching' | 'hasMore' | 'error' | 'fetchMore' | 'refetch'
> & { onSelect: (notification: NotificationRecord) => void }) {
  if (isLoading && !notifications) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground" role="status">
        Cargando avisos…
      </p>
    );
  }
  const refreshError = error ? (
    <div className="grid justify-items-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground" role="alert">
        No se pudieron cargar los avisos.
      </p>
      <Button onClick={() => void refetch()} type="button" variant="outline">
        Reintentar
      </Button>
    </div>
  ) : null;
  if (error && !notifications?.length) return refreshError;
  if (!notifications?.length) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">No tienes avisos todavía.</p>
    );
  }
  return (
    <>
      {refreshError}
      <ul aria-label="Lista de avisos">
        {notifications.map((notification) => (
          <NotificationRow key={notification.id} notification={notification} onSelect={onSelect} />
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
  );
}

function InboxBell() {
  const { open, setOpen } = useContext(InboxOpenContext);
  const router = useRouter();
  const { filter, openInbox, resetFilter } = useContext(NotificationInboxContext);
  const {
    counts,
    isLoading: countsLoading,
    error: countsError,
    refetch: refetchCounts,
  } = useCounts({
    filters: [{ read: false }],
  });
  const { notifications, isLoading, isFetching, hasMore, error, fetchMore, refetch } =
    useNotifications({ limit: 10, data: filter });
  useEffect(() => {
    if (!open) return;
    void refetch();
    void refetchCounts();
  }, [open, refetch, refetchCounts]);
  const unreadCount = counts?.[0]?.count ?? 0;

  function selectNotification(notification: NotificationRecord) {
    const data = notification.data ?? {};
    const courseCode = stringField(data, 'courseCode');
    const year = numberField(data, 'year');
    const semester = numberField(data, 'semester');
    if (!courseCode || year === null || semester === null) return;

    router.push(`/courses/${encodeURIComponent(courseCode)}/${year}/${semester}`);
    router.refresh();
    setOpen(false);
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetFilter();
      }}
    >
      <PopoverPrimitive.Trigger
        aria-label={
          countsError
            ? 'Avisos, contador no disponible'
            : `Avisos${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`
        }
        className="relative inline-flex size-11 items-center justify-center rounded-md text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => openInbox()}
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
        <PopoverPrimitive.Positioner
          align="end"
          className="max-lg:!fixed max-lg:!inset-0 max-lg:!translate-x-0 max-lg:!translate-y-0"
          side="bottom"
          sideOffset={8}
        >
          <PopoverPrimitive.Popup className="z-50 max-h-[min(32rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg outline-none max-lg:h-dvh max-lg:max-h-dvh max-lg:w-screen max-lg:max-w-none max-lg:rounded-none lg:rounded-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-heading text-base font-semibold">Avisos</h2>
              <div className="flex items-center gap-2">
                {countsError ? (
                  <p className="mt-1 text-sm text-destructive" role="status">
                    No se pudo actualizar el contador.
                  </p>
                ) : null}
                <Button
                  aria-label="Cerrar avisos"
                  className="lg:hidden"
                  onClick={() => setOpen(false)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" size={20} />
                </Button>
              </div>
            </div>
            <div className="max-h-[calc(min(32rem,100dvh-6rem)-4rem)] overflow-y-auto max-lg:h-[calc(100dvh-4rem)] max-lg:max-h-none">
              <InboxNotificationList
                notifications={notifications}
                isLoading={isLoading}
                isFetching={isFetching}
                hasMore={hasMore}
                error={error}
                fetchMore={fetchMore}
                refetch={refetch}
                onSelect={selectNotification}
              />
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
  return (
    <div className="contents" key={identity?.userId ?? 'anonymous'}>
      {identity ? (
        <InboxDriverProvider identity={identity}>
          <NotificationInboxProvider>
            <NotificationAcknowledgementProvider>{children}</NotificationAcknowledgementProvider>
          </NotificationInboxProvider>
        </InboxDriverProvider>
      ) : (
        <NotificationInboxProvider>{children}</NotificationInboxProvider>
      )}
    </div>
  );
}

function NotificationAcknowledgementProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<ChangeSummary | null>(null);
  const shownOperations = useRef(new Set<string>());
  const ownOperations = useRef(new Map<string, NoticeAcknowledgementOperation | null>());
  const acknowledgeOwn = useCallback(async (input: AcknowledgeInput, retry: boolean) => {
    const operation = retry
      ? ownOperations.current.get(input.roadmapId)
      : input.openingId
        ? { roadmapId: input.roadmapId, operationId: crypto.randomUUID() }
        : null;
    ownOperations.current.set(input.roadmapId, operation ?? null);
    if (!operation) return false;
    try {
      await prepareOwnInboxOpening({ ...operation, retry });
      const result = await acknowledgeOwnInbox(operation);
      if (result.summary?.groups.length && !shownOperations.current.has(operation.operationId)) {
        shownOperations.current.add(operation.operationId);
        setSummary(result.summary);
      }
      return true;
    } catch {
      return false;
    }
  }, []);
  const acknowledge = useCallback(
    (input: AcknowledgeInput) => acknowledgeOwn(input, false),
    [acknowledgeOwn],
  );
  const retry = useCallback(
    (input: AcknowledgeInput) => acknowledgeOwn(input, true),
    [acknowledgeOwn],
  );

  return (
    <NotificationAcknowledgementContext.Provider value={{ acknowledge, retry }}>
      {children}
      <ChangeSummaryDialog summary={summary} close={() => setSummary(null)} />
    </NotificationAcknowledgementContext.Provider>
  );
}

function NotificationInboxProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<NotificationDataFilter | undefined>();
  const [inboxOpen, setInboxOpen] = useState(false);
  const openInbox = useCallback((nextFilter?: NotificationDataFilter) => {
    setFilter(nextFilter);
    setInboxOpen(true);
  }, []);
  const resetFilter = useCallback(() => setFilter(undefined), []);
  return (
    <NotificationInboxContext.Provider value={{ filter, openInbox, resetFilter }}>
      <InboxOpenContext.Provider value={{ open: inboxOpen, setOpen: setInboxOpen }}>
        {children}
      </InboxOpenContext.Provider>
    </NotificationInboxContext.Provider>
  );
}

export function NotificationsInbox({ identity }: { identity: InboxIdentity }) {
  return <InboxBell key={identity.userId} />;
}
