'use client';

import { OwnInboxRealtime } from './own-realtime';
import { acknowledgeOwnInbox, prepareOwnInboxOpening } from './inbox-api';
import {
  OwnInboxStoreProvider,
  useAcknowledgeRoadmap,
  useOwnInbox,
  type OfferingFilter,
  type OwnInboxSnapshotPromise,
  type OwnInboxView,
} from './inbox-store';
import type { OwnInboxNotice } from '../contracts/own-inbox-snapshot';
import { ChangeSummaryDialog, type ChangeSummaryNodeName } from './ChangeSummaryDialog';
import type { ChangeSummary } from '../contracts/change-summary';
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from '@/shared/ui/popover';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Empty, EmptyHeader, EmptyDescription } from '@/shared/ui/empty';
import { Bell, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { formatBadgeCount } from '@/shared/badge-count';
import type { InboxIdentity } from '../server';
const notificationDateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function NotificationCountButton({
  filter,
  label,
}: {
  filter: OfferingFilter;
  label: string;
}) {
  const openInbox = useOpenNotificationInbox();
  const inbox = useOwnInbox();
  if (!inbox) return null;
  const count = inbox.unreadFor(filter);
  if (count === 0 && inbox.available) return null;
  return (
    <button
      aria-label={
        inbox.available
          ? `${count} avisos sin leer para ${label}`
          : `Avisos para ${label}, contador no disponible`
      }
      className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => openInbox(filter)}
      type="button"
    >
      <Bell aria-hidden="true" size={16} />
      <span>{inbox.available ? count : '?'}</span>
    </button>
  );
}

const NotificationInboxContext = createContext<{
  filter: OfferingFilter | undefined;
  openInbox: (filter?: OfferingFilter) => void;
  resetFilter: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  filter: undefined,
  openInbox: () => undefined,
  resetFilter: () => undefined,
  open: false,
  setOpen: () => undefined,
});
type AcknowledgeInput = {
  roadmapId: string;
  entryKey?: string | null;
};
const NotificationAcknowledgementContext = createContext<{
  acknowledge: (input: AcknowledgeInput) => Promise<boolean>;
}>({ acknowledge: async () => true });

export function useNotificationAcknowledgement() {
  return useContext(NotificationAcknowledgementContext);
}

function useOpenNotificationInbox() {
  return useContext(NotificationInboxContext).openInbox;
}

function field<T extends 'string' | 'number'>(
  data: Record<string, unknown>,
  name: string,
  type: T,
): (T extends 'string' ? string : number) | null {
  const value = data[name];
  return typeof value === type ? (value as T extends 'string' ? string : number) : null;
}

function notificationDate(notification: OwnInboxNotice) {
  const occurredAt = field(notification.data ?? {}, 'occurredAt', 'string');
  if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) return 'Fecha no disponible';
  return notificationDateFormatter.format(new Date(occurredAt));
}

function NotificationRow({
  notification,
  onSelect,
}: {
  notification: OwnInboxNotice;
  onSelect: (notification: OwnInboxNotice) => void;
}) {
  return (
    <li>
      <div className="border-b">
        <button
          className="flex min-h-16 w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={() => onSelect(notification)}
          type="button"
        >
          <span className="font-semibold">
            {notification.courseName ?? notification.subject ?? 'Aviso de U-Roadmaps'}
          </span>
          <span className="text-sm text-muted-foreground">{notification.body}</span>
          <time className="text-xs text-muted-foreground">{notificationDate(notification)}</time>
        </button>
      </div>
    </li>
  );
}

function InboxNotificationList({
  inbox,
  filter,
  onSelect,
}: {
  inbox: OwnInboxView | null;
  filter: OfferingFilter | undefined;
  onSelect: (notification: OwnInboxNotice) => void;
}) {
  if (!inbox) {
    return (
      <Alert role="status" className="m-3 w-auto">
        <AlertDescription>Cargando avisos…</AlertDescription>
      </Alert>
    );
  }
  if (!inbox.available) {
    return (
      <Alert variant="destructive" className="m-3 w-auto">
        <AlertDescription>No se pudieron cargar los avisos.</AlertDescription>
      </Alert>
    );
  }
  const notifications = inbox.noticesFor(filter);
  if (!notifications.length) {
    return (
      <Alert role="status" className="m-3 w-auto">
        <Empty className="p-0">
          <EmptyHeader>
            <EmptyDescription>No tienes avisos todavía.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Alert>
    );
  }
  return (
    <ul aria-label="Lista de avisos">
      {notifications.map((notification) => (
        <NotificationRow key={notification.id} notification={notification} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function InboxBell() {
  const inbox = useOwnInbox();
  const router = useRouter();
  const { filter, openInbox, resetFilter, open, setOpen } = useContext(NotificationInboxContext);
  const unreadCount = inbox?.total ?? 0;
  const countUnavailable = inbox !== null && !inbox.available;

  function selectNotification(notification: OwnInboxNotice) {
    const data = notification.data ?? {};
    const courseCode = field(data, 'courseCode', 'string');
    const year = field(data, 'year', 'number');
    const semester = field(data, 'semester', 'number');
    if (!courseCode || year === null || semester === null) return;

    router.push(`/courses/${encodeURIComponent(courseCode)}/${year}/${semester}`);
    router.refresh();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetFilter();
      }}
    >
      <PopoverTrigger
        aria-label={
          countUnavailable
            ? 'Avisos, contador no disponible'
            : `Avisos${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`
        }
        className="relative inline-flex size-11 items-center justify-center rounded-md text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => openInbox()}
        type="button"
      >
        <Bell aria-hidden="true" size={20} />
        {unreadCount > 0 ? (
          <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">
            {formatBadgeCount(unreadCount)}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        positionerClassName="max-lg:fixed! max-lg:inset-0! max-lg:transform-none!"
        className="max-h-[min(32rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0 max-lg:h-dvh max-lg:max-h-dvh max-lg:w-screen max-lg:max-w-none max-lg:rounded-none max-lg:duration-0 max-lg:data-open:animate-none max-lg:data-closed:animate-none"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <PopoverTitle>Avisos</PopoverTitle>
          <div className="flex items-center gap-2">
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
          <InboxNotificationList inbox={inbox} filter={filter} onSelect={selectNotification} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NotificationsProvider({
  identity,
  inbox = null,
  children,
}: {
  identity: InboxIdentity | null;
  inbox?: OwnInboxSnapshotPromise | null;
  children: ReactNode;
}) {
  return (
    <div className="contents" key={identity?.userId ?? 'anonymous'}>
      <OwnInboxStoreProvider snapshot={identity ? inbox : null}>
        <NotificationInboxProvider>
          {identity ? <OwnInboxRealtime userId={identity.userId} /> : null}
          {children}
        </NotificationInboxProvider>
      </OwnInboxStoreProvider>
    </div>
  );
}

export function RoadmapEntryNotifications({
  children,
  NodeName,
}: {
  children: ReactNode;
  NodeName: ChangeSummaryNodeName;
}) {
  const [summary, setSummary] = useState<ChangeSummary | null>(null);
  const acknowledgeRoadmap = useAcknowledgeRoadmap();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const acknowledge = useCallback(
    async (input: AcknowledgeInput) => {
      if (!input.entryKey) return false;
      const operation = { roadmapId: input.roadmapId, operationId: crypto.randomUUID() };
      try {
        await prepareOwnInboxOpening(operation);
        const result = await acknowledgeOwnInbox(operation);
        acknowledgeRoadmap(input.roadmapId);
        if (!active.current) return true;
        if (result.summary?.groups.length) setSummary(result.summary);
        return true;
      } catch {
        return false;
      }
    },
    [acknowledgeRoadmap],
  );
  const acknowledgement = useMemo(() => ({ acknowledge }), [acknowledge]);

  return (
    <NotificationAcknowledgementContext.Provider value={acknowledgement}>
      {children}
      <ChangeSummaryDialog summary={summary} close={() => setSummary(null)} NodeName={NodeName} />
    </NotificationAcknowledgementContext.Provider>
  );
}

function NotificationInboxProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<OfferingFilter | undefined>();
  const [open, setOpen] = useState(false);
  const openInbox = useCallback((nextFilter?: OfferingFilter) => {
    setFilter(nextFilter);
    setOpen(true);
  }, []);
  const resetFilter = useCallback(() => setFilter(undefined), []);
  const inbox = useMemo(
    () => ({ filter, openInbox, resetFilter, open, setOpen }),
    [filter, openInbox, resetFilter, open],
  );
  return (
    <NotificationInboxContext.Provider value={inbox}>{children}</NotificationInboxContext.Provider>
  );
}

export function NotificationsInbox({ identity }: { identity: InboxIdentity }) {
  return <InboxBell key={identity.userId} />;
}
