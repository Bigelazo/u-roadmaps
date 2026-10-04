'use client';

import { InboxDriverProvider, useCounts, useNotifications, useInboxClient } from './inbox-driver';
import {
  acknowledgeOwnInbox,
  prepareOwnInboxNodeOpening,
  getOwnInboxRecord,
  type InboxRecord,
  type NoticeAcknowledgementOperation,
} from './inbox-api';
import { OwnInboxContext, LegacyInboxContext } from './inbox-context';
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
import {
  ROADMAP_CHANGE_RECEIVED_EVENT,
  requestRoadmapRecovery,
  subscribeToRoadmapRecovery,
} from '@/shared/client/roadmap-events';

type NotificationRecord = InboxRecord;
type NotificationDataFilter = Record<string, string | number>;
const notificationDateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
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
  const own = useContext(OwnInboxContext);
  const { counts, refetch, error } = useCounts({ filters: [{ read: false, data: filter }] });
  useEffect(
    () =>
      own
        ? undefined
        : subscribeToRoadmapRecovery(() => {
            void refetch().catch(() => undefined);
          }),
    [own, refetch],
  );
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

const SelectedNotificationContext = createContext<{
  notification: NotificationRecord | null;
  select: (notification: NotificationRecord | null) => void;
  filter: NotificationDataFilter | undefined;
  openInbox: (filter?: NotificationDataFilter) => void;
  resetFilter: () => void;
}>({
  notification: null,
  select: () => undefined,
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
  nodeId?: string;
  accessibleNodeIds?: ReadonlySet<string>;
};
const NotificationAcknowledgementContext = createContext<{
  acknowledge: (input: AcknowledgeInput) => Promise<boolean>;
  retry: (input: AcknowledgeInput) => Promise<boolean>;
}>({ acknowledge: async () => true, retry: async () => true });

export function useNotificationAcknowledgement() {
  return useContext(NotificationAcknowledgementContext);
}

export function useSelectedNotification() {
  return useContext(SelectedNotificationContext);
}

export function useOpenNotificationInbox() {
  return useContext(SelectedNotificationContext).openInbox;
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
  const [seenError, setSeenError] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);

  const markSeen = useCallback(() => {
    void notification.seen().then(
      ({ error }) => setSeenError(Boolean(error)),
      () => setSeenError(true),
    );
  }, [notification]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      markSeen();
      observer.disconnect();
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [markSeen]);

  return (
    <li ref={rowRef}>
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
        {seenError ? (
          <div
            className="flex items-center justify-between px-4 pb-2 text-xs text-destructive"
            role="status"
          >
            <span>No se pudo marcar como visto.</span>
            <button
              className="min-h-11 px-2 font-semibold underline"
              onClick={markSeen}
              type="button"
            >
              Reintentar
            </button>
          </div>
        ) : null}
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
  const own = useContext(OwnInboxContext);
  const { open, setOpen } = useContext(InboxOpenContext);
  const router = useRouter();
  const { select, filter, openInbox, resetFilter } = useSelectedNotification();
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
  useEffect(
    () =>
      own
        ? undefined
        : subscribeToRoadmapRecovery(() => {
            void refetch().catch(() => undefined);
            void refetchCounts().catch(() => undefined);
          }),
    [own, refetch, refetchCounts],
  );
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

    const params = new URLSearchParams({
      notice: notification.id,
    });
    const nodeId = stringField(data, 'nodeId');
    if (data.targetKind === 'node' && nodeId) params.set('targetNode', nodeId);
    select(notification);
    router.push(
      `/courses/${encodeURIComponent(courseCode)}/${year}/${semester}?${params.toString()}`,
    );
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
    <div className="contents" key={identity?.subscriber ?? 'anonymous'}>
      {identity ? (
        <InboxDriverProvider identity={identity}>
          <SelectedNotificationProvider>
            <NotificationRealtimeBridge />
            <NotificationAcknowledgementProvider>{children}</NotificationAcknowledgementProvider>
          </SelectedNotificationProvider>
        </InboxDriverProvider>
      ) : (
        <SelectedNotificationProvider>{children}</SelectedNotificationProvider>
      )}
    </div>
  );
}

function NotificationAcknowledgementProvider({ children }: { children: ReactNode }) {
  const inbox = useInboxClient();
  const own = useContext(OwnInboxContext);
  const legacyEnabled = useContext(LegacyInboxContext);
  const ownOperations = useRef(
    new Map<string, (NoticeAcknowledgementOperation & { nodeId?: string }) | null>(),
  );
  const acknowledgeOwn = useCallback(
    async (input: AcknowledgeInput, retry: boolean) => {
      if (!own) return true;
      const key = `${input.roadmapId}:${input.nodeId ?? 'roadmap'}`;
      const operation = retry
        ? ownOperations.current.get(key)
        : input.nodeId
          ? { roadmapId: input.roadmapId, nodeId: input.nodeId, operationId: crypto.randomUUID() }
          : input.openingId
            ? { roadmapId: input.roadmapId, operationId: input.openingId }
            : null;
      ownOperations.current.set(key, operation ?? null);
      if (!operation) return false;
      try {
        if (operation.nodeId)
          await prepareOwnInboxNodeOpening({ ...operation, nodeId: operation.nodeId, retry });
        await acknowledgeOwnInbox(operation);
        return true;
      } catch {
        return false;
      }
    },
    [own],
  );
  const pending = useRef(
    new Map<
      string,
      { records: NotificationRecord[]; createdLte: number; listingIncomplete: boolean }
    >(),
  );
  const keyFor = (input: AcknowledgeInput) => `${input.roadmapId}:${input.nodeId ?? 'roadmap'}`;

  const readNotifications = useCallback(
    async (
      input: AcknowledgeInput,
      snapshot: { records: NotificationRecord[]; createdLte: number; listingIncomplete: boolean },
    ) => {
      const succeeded = await Promise.all(
        snapshot.records.map(async (record) => {
          try {
            const result = await record.read();
            return !result.error;
          } catch {
            return false;
          }
        }),
      );
      snapshot.records = snapshot.records.filter((_, index) => !succeeded[index]);
      pending.current.set(keyFor(input), snapshot);
      return snapshot.records.length === 0;
    },
    [],
  );

  const collectSnapshot = useCallback(
    async (
      input: AcknowledgeInput,
      snapshot: { records: NotificationRecord[]; createdLte: number; listingIncomplete: boolean },
    ) => {
      if (own && !legacyEnabled) {
        snapshot.listingIncomplete = false;
        return true;
      }
      const knownIds = new Set(snapshot.records.map(({ id }) => id));
      let after: string | undefined;
      do {
        const page = await inbox.list({
          data: { roadmapId: input.roadmapId },
          read: false,
          limit: 100,
          createdLte: snapshot.createdLte,
          ...(after ? { after } : {}),
          useCache: false,
        });
        if (page.error || !page.data) {
          snapshot.listingIncomplete = true;
          return false;
        }
        for (const record of page.data.notifications) {
          const createdAt = Date.parse(record.createdAt);
          if (Number.isNaN(createdAt) || createdAt > snapshot.createdLte) continue;
          const data = record.data ?? {};
          const isNodeNotice = data.targetKind === 'node' && typeof data.nodeId === 'string';
          const eligible = input.nodeId
            ? isNodeNotice && data.nodeId === input.nodeId
            : !isNodeNotice || !input.accessibleNodeIds?.has(data.nodeId as string);
          if (eligible && !knownIds.has(record.id)) {
            snapshot.records.push(record);
            knownIds.add(record.id);
          }
        }
        const last = page.data.notifications.at(-1);
        after = page.data.hasMore ? last?.id : undefined;
        if (page.data.hasMore && !after) {
          snapshot.listingIncomplete = true;
          return false;
        }
      } while (after);
      snapshot.listingIncomplete = false;
      return true;
    },
    [inbox, own, legacyEnabled],
  );

  const acknowledge = useCallback(
    async (input: AcknowledgeInput) => {
      const snapshot = { records: [], createdLte: Date.now(), listingIncomplete: true };
      pending.current.set(keyFor(input), snapshot);
      const ownResult = await acknowledgeOwn(input, false);
      if (!(await collectSnapshot(input, snapshot))) return false;
      return (await readNotifications(input, snapshot)) && ownResult;
    },
    [collectSnapshot, readNotifications, acknowledgeOwn],
  );

  const retry = useCallback(
    async (input: AcknowledgeInput) => {
      const snapshot = pending.current.get(keyFor(input));
      const ownResult = await acknowledgeOwn(input, true);
      if (!snapshot) return ownResult;
      if (snapshot.listingIncomplete && !(await collectSnapshot(input, snapshot))) return false;
      return (await readNotifications(input, snapshot)) && ownResult;
    },
    [collectSnapshot, readNotifications, acknowledgeOwn],
  );

  return (
    <NotificationAcknowledgementContext.Provider value={{ acknowledge, retry }}>
      {children}
    </NotificationAcknowledgementContext.Provider>
  );
}

function SelectedNotificationProvider({ children }: { children: ReactNode }) {
  const [notification, select] = useState<NotificationRecord | null>(null);
  const [filter, setFilter] = useState<NotificationDataFilter | undefined>();
  const own = useContext(OwnInboxContext);
  useEffect(() => {
    if (!own) return;
    const id = new URLSearchParams(window.location.search).get('notice');
    if (!id) return;
    let active = true;
    void getOwnInboxRecord(id)
      .then((record) => {
        if (active) select(record);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [own]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const openInbox = useCallback((nextFilter?: NotificationDataFilter) => {
    setFilter(nextFilter);
    setInboxOpen(true);
  }, []);
  const resetFilter = useCallback(() => setFilter(undefined), []);
  return (
    <SelectedNotificationContext.Provider
      value={{ notification, select, filter, openInbox, resetFilter }}
    >
      <InboxOpenContext.Provider value={{ open: inboxOpen, setOpen: setInboxOpen }}>
        {children}
      </InboxOpenContext.Provider>
    </SelectedNotificationContext.Provider>
  );
}

export function NotificationsInbox({ identity }: { identity: InboxIdentity }) {
  return <InboxBell key={identity.subscriber} />;
}

const roadmapChangeKinds = new Set([
  'roadmap-available',
  'node-available',
  'node-updated',
  'node-retired',
  'node-deleted',
  'node-blocked',
  'resource-added',
  'resource-updated',
  'resource-removed',
  'dependency-added',
  'dependency-removed',
  'classification-updated',
]);

function NotificationRealtimeBridge() {
  const inbox = useInboxClient();
  useEffect(() => {
    const stopReceived = inbox.subscribeReceived((data) => {
      if (!data || !roadmapChangeKinds.has(data.changeKind as string)) return;
      if (
        typeof data.courseCode !== 'string' ||
        !data.courseCode.trim() ||
        data.courseCode.trim().length > 20
      )
        return;
      if (!Number.isSafeInteger(data.year) || (data.year as number) < 1) return;
      if (data.semester !== 1 && data.semester !== 2) return;
      window.dispatchEvent(
        new CustomEvent(ROADMAP_CHANGE_RECEIVED_EVENT, {
          detail: { courseCode: data.courseCode.trim(), year: data.year, semester: data.semester },
        }),
      );
    });
    const stopConnected = inbox.subscribeConnected(requestRoadmapRecovery);
    return () => {
      stopReceived();
      stopConnected();
    };
  }, [inbox]);
  return null;
}
