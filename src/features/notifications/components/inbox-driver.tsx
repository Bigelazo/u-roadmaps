'use client';

import {
  NovuProvider,
  useCounts as useLegacyCounts,
  useNotifications as useLegacyNotifications,
  useNovu as useLegacyNovu,
} from '@novu/nextjs/hooks';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { InboxIdentity } from '../server';
import { record, refreshEvent, request, type InboxRecord } from './inbox-api';
import { LegacyInboxContext, OwnInboxContext } from './inbox-context';

type Filter = Record<string, string | number>;
type ListInput = {
  limit?: number;
  data?: Filter;
  read?: boolean;
  createdLte?: number;
  after?: string;
  useCache?: boolean;
};
type Page = { notifications: InboxRecord[]; hasMore: boolean };

function query(input: ListInput) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input.data ?? {})) params.set(key, String(value));
  if (input.limit) params.set('limit', String(input.limit));
  if (input.after) params.set('after', input.after);
  if (input.read === false) params.set('read', 'false');
  return params.toString();
}
async function list(input: ListInput): Promise<Page> {
  const page = await request<{
    notifications: Omit<InboxRecord, 'seen' | 'read'>[];
    hasMore: boolean;
  }>(`?${query(input)}`);
  return { ...page, notifications: page.notifications.map(record) };
}

function useInboxRefresh(refetch: () => Promise<unknown>, generation: { current: number }) {
  useEffect(() => {
    void refetch();
    window.addEventListener(refreshEvent, refetch);
    return () => {
      ++generation.current;
      window.removeEventListener(refreshEvent, refetch);
    };
  }, [refetch, generation]);
}

function useOwnNotifications(input: ListInput) {
  const key = query(input);
  const [page, setPage] = useState<Page & { queryKey: string }>();
  const [error, setError] = useState<unknown>();
  const [isFetching, setFetching] = useState(false);
  const generation = useRef(0);
  const refetch = useCallback(async () => {
    const current = ++generation.current;
    setFetching(true);
    try {
      const result = await list(input);
      if (current === generation.current) {
        setPage({ ...result, queryKey: key });
        setError(undefined);
      }
    } catch (failure) {
      if (current === generation.current) setError(failure);
    } finally {
      if (current === generation.current) setFetching(false);
    }
    // The serialized query is the complete input identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useInboxRefresh(refetch, generation);
  const fetchMore = async () => {
    const current = generation.current;
    setFetching(true);
    try {
      const result = await list({ ...input, after: page?.notifications.at(-1)?.id });
      if (current === generation.current) {
        setPage((previous) => ({
          ...result,
          queryKey: key,
          notifications: [...(previous?.notifications ?? []), ...result.notifications],
        }));
        setError(undefined);
      }
    } catch (failure) {
      if (current === generation.current) setError(failure);
    } finally {
      if (current === generation.current) setFetching(false);
    }
  };
  const currentPage = page?.queryKey === key ? page : undefined;
  return {
    notifications: currentPage?.notifications,
    hasMore: currentPage?.hasMore ?? false,
    isLoading: !currentPage && !error,
    isFetching,
    error,
    fetchMore,
    refetch,
  };
}
function useOwnCounts(input: { filters: { read?: boolean; data?: Filter }[] }) {
  const key = JSON.stringify(input.filters);
  const [counts, setCounts] = useState<{ count: number }[]>();
  const [error, setError] = useState<unknown>();
  const generation = useRef(0);
  const refetch = useCallback(async () => {
    const current = ++generation.current;
    try {
      const result = await Promise.all(
        input.filters.map((filter) => request<{ count: number }>(`/counts?${query(filter)}`)),
      );
      if (current === generation.current) {
        setCounts(result);
        setError(undefined);
      }
    } catch (failure) {
      if (current === generation.current) setError(failure);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useInboxRefresh(refetch, generation);
  return { counts, error, isLoading: !counts && !error, refetch };
}
type InboxClient = {
  list: (input: ListInput) => Promise<{ data?: Page; error?: unknown }>;
  subscribeReceived: (listener: (data: Record<string, unknown> | undefined) => void) => () => void;
  subscribeConnected: (listener: () => void) => () => void;
};
const ownClient: InboxClient = {
  list: async (input) => ({ data: await list(input) }),
  subscribeReceived: () => () => undefined,
  subscribeConnected: () => () => undefined,
};
function useOwnClient() {
  return ownClient;
}
function useLegacyClient(): InboxClient {
  const novu = useLegacyNovu();
  return useMemo(
    () => ({
      list: async (input: ListInput) => {
        const result = await novu.notifications.list(input);
        return { data: result.data, error: result.error };
      },
      subscribeReceived: (listener: (data: Record<string, unknown> | undefined) => void) =>
        novu.on('notifications.notification_received', ({ result }) => listener(result?.data)),
      subscribeConnected: (listener: () => void) => novu.on('socket.connect.resolved', listener),
    }),
    [novu],
  );
}

// The legacy driver remains available until the remaining workflows migrate.
function useCombinedNotifications(input: ListInput) {
  const own = useOwnNotifications(input);
  const legacy = useLegacyNotifications(input);
  const ownRefetch = own.refetch;
  const legacyRefetch = legacy.refetch;
  return {
    ...own,
    notifications:
      own.notifications &&
      [...own.notifications, ...(legacy.notifications ?? [])].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    hasMore: own.hasMore || Boolean(legacy.hasMore),
    error: own.error || legacy.error,
    isFetching: own.isFetching || legacy.isFetching,
    refetch: useCallback(async () => {
      await Promise.all([ownRefetch(), legacyRefetch()]);
    }, [ownRefetch, legacyRefetch]),
    fetchMore: async () => {
      await Promise.all([
        own.hasMore ? own.fetchMore() : Promise.resolve(),
        legacy.hasMore ? legacy.fetchMore() : Promise.resolve(),
      ]);
    },
  };
}
function useCombinedCounts(input: { filters: { read?: boolean; data?: Filter }[] }) {
  const own = useOwnCounts(input);
  const legacy = useLegacyCounts(input);
  const ownRefetch = own.refetch;
  const legacyRefetch = legacy.refetch;
  return {
    ...own,
    counts: own.counts?.map((value, index) => ({
      count: value.count + (legacy.counts?.[index]?.count ?? 0),
    })),
    error: own.error || legacy.error,
    refetch: useCallback(async () => {
      await Promise.all([ownRefetch(), legacyRefetch()]);
    }, [ownRefetch, legacyRefetch]),
  };
}
const ownDriver = {
  useNotifications: useOwnNotifications,
  useCounts: useOwnCounts,
  useClient: useOwnClient,
};
const legacyDriver = {
  useNotifications: useLegacyNotifications,
  useCounts: useLegacyCounts,
  useClient: useLegacyClient,
};
const combinedDriver = {
  useNotifications: useCombinedNotifications,
  useCounts: useCombinedCounts,
  useClient: useLegacyClient,
};
type InboxDriver = {
  useNotifications: (input: ListInput) => {
    notifications?: InboxRecord[];
    hasMore?: boolean;
    isLoading: boolean;
    isFetching: boolean;
    error?: unknown;
    refetch: () => Promise<unknown>;
    fetchMore: () => Promise<unknown>;
  };
  useCounts: (input: { filters: { read?: boolean; data?: Filter }[] }) => {
    counts?: { count: number }[];
    error?: unknown;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };
  useClient: () => InboxClient;
};
const Driver = createContext<InboxDriver>(legacyDriver);
export function useNotifications(input: ListInput) {
  const driver = useContext(Driver);
  return driver.useNotifications(input);
}
export function useCounts(input: { filters: { read?: boolean; data?: Filter }[] }) {
  const driver = useContext(Driver);
  return driver.useCounts(input);
}
export function useInboxClient() {
  const driver = useContext(Driver);
  return driver.useClient();
}
export function InboxDriverProvider({
  identity,
  children,
}: {
  identity: InboxIdentity;
  children: ReactNode;
}) {
  const legacyEnabled = Boolean(identity.applicationIdentifier && identity.subscriberHash);
  const driver = identity.own ? (legacyEnabled ? combinedDriver : ownDriver) : legacyDriver;
  const content = (
    <LegacyInboxContext.Provider value={legacyEnabled}>
      <OwnInboxContext.Provider value={Boolean(identity.own)}>
        <Driver.Provider value={driver}>{children}</Driver.Provider>
      </OwnInboxContext.Provider>
    </LegacyInboxContext.Provider>
  );
  return legacyEnabled ? (
    <NovuProvider
      applicationIdentifier={identity.applicationIdentifier}
      subscriber={identity.subscriber}
      subscriberHash={identity.subscriberHash}
      apiUrl={identity.apiUrl}
      socketUrl={identity.socketUrl}
    >
      {content}
    </NovuProvider>
  ) : (
    content
  );
}
