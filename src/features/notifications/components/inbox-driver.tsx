'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { InboxIdentity } from '../server';
import { OwnInboxRealtime, OWN_INBOX_REFRESH_EVENT } from './own-realtime';
import { request, record, type InboxRecord } from './inbox-api';

type Filter = Record<string, string | number>;
type ListInput = {
  limit?: number;
  data?: Filter;
  read?: boolean;
  after?: string;
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
const refreshEvent = OWN_INBOX_REFRESH_EVENT;
async function list(input: ListInput): Promise<Page> {
  const page = await request<{
    notifications: Omit<InboxRecord, 'seen' | 'read'>[];
    hasMore: boolean;
  }>(`?${query(input)}`);
  return { ...page, notifications: page.notifications.map(record) };
}

function useInboxRefresh(refetch: () => Promise<unknown>, generation: { current: number }) {
  useEffect(() => {
    const requestGeneration = generation;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;
    const refresh = async () => {
      clearTimeout(retry);
      const result = await refetch();
      if (!active) return;
      if (result === false) {
        retry = setTimeout(() => void refresh(), delay);
        delay = Math.min(delay * 2, 30_000);
      } else {
        delay = 1000;
      }
    };
    void refresh();
    window.addEventListener(refreshEvent, refresh);
    return () => {
      active = false;
      clearTimeout(retry);
      ++requestGeneration.current;
      window.removeEventListener(refreshEvent, refresh);
    };
  }, [refetch, generation]);
}

export function useNotifications(input: ListInput) {
  const key = query(input);
  const [page, setPage] = useState<Page & { queryKey: string }>();
  const [error, setError] = useState<unknown>();
  const [isFetching, setFetching] = useState(false);
  const generation = useRef(0);
  const pagination = useRef({ queryKey: key, pages: 1 });
  const refetch = useCallback(async () => {
    if (pagination.current.queryKey !== key) pagination.current = { queryKey: key, pages: 1 };
    const current = ++generation.current;
    setFetching(true);
    try {
      let result = await list(input);
      // Seen/read signals and summary arrivals must refresh the expanded feed,
      // including an expansion requested while this refresh was in flight.
      for (let loaded = 1; loaded < pagination.current.pages && result.hasMore; loaded++) {
        if (current !== generation.current) return;
        const next = await list({ ...input, after: result.notifications.at(-1)?.id });
        result = { ...next, notifications: [...result.notifications, ...next.notifications] };
      }
      if (current === generation.current) {
        setPage({ ...result, queryKey: key });
        setError(undefined);
      }
    } catch (failure) {
      if (current === generation.current) {
        setError(failure);
        return false;
      }
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
    pagination.current.pages++;
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
export function useCounts(input: { filters: { read?: boolean; data?: Filter }[] }) {
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
      if (current === generation.current) {
        setError(failure);
        return false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useInboxRefresh(refetch, generation);
  return { counts, error, isLoading: !counts && !error, refetch };
}
export function InboxDriverProvider({
  identity,
  children,
}: {
  identity: InboxIdentity;
  children: ReactNode;
}) {
  return (
    <>
      <OwnInboxRealtime userId={identity.userId} />
      {children}
    </>
  );
}
