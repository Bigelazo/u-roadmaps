'use client';

import { useEffect } from 'react';
import {
  ROADMAP_CHANGE_RECEIVED_EVENT,
  subscribeToRoadmapRecovery,
  requestRoadmapRecovery,
} from '@/shared/client/roadmap-events';

export const OWN_INBOX_REFRESH_EVENT = 'own-inbox-updated';
// Showing several rows marks each one seen; one refresh reconciles the whole burst.
const INBOX_SIGNAL_COALESCE_MS = 100;

/** Mounted once by the application provider, never by Inbox/count consumers. */
export function OwnInboxRealtime({ userId }: { userId: string }) {
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    let active = true;
    let source: EventSource;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let pendingRefresh: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;
    const refresh = () => {
      clearTimeout(pendingRefresh);
      pendingRefresh = undefined;
      if (active) window.dispatchEvent(new Event(OWN_INBOX_REFRESH_EVENT));
    };
    const scheduleRefresh = () => {
      pendingRefresh ??= setTimeout(refresh, INBOX_SIGNAL_COALESCE_MS);
    };
    const receive = (event: MessageEvent<string>, kind: 'ready' | 'inbox' | 'roadmap') => {
      if (!active) return;
      let value: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(event.data);
        if (!parsed || typeof parsed !== 'object') return;
        value = parsed as Record<string, unknown>;
      } catch {
        return;
      }
      if (value.userId !== userId) return;
      if (kind === 'ready') {
        retryDelay = 1000;
        requestRoadmapRecovery();
      } else if (kind === 'inbox') {
        scheduleRefresh();
      } else if (
        typeof value.courseCode === 'string' &&
        value.courseCode.trim().length > 0 &&
        value.courseCode.length <= 20 &&
        Number.isSafeInteger(value.year) &&
        (value.year as number) > 0 &&
        (value.semester === 1 || value.semester === 2)
      ) {
        window.dispatchEvent(
          new CustomEvent(ROADMAP_CHANGE_RECEIVED_EVENT, {
            detail: {
              courseCode: value.courseCode,
              year: value.year,
              semester: value.semester,
              ...(value.accessLost === true ? { accessLost: true } : {}),
            },
          }),
        );
      }
    };
    const connect = () => {
      if (!active || !navigator.onLine) return;
      clearTimeout(retry);
      source?.close();
      const connection = new EventSource('/api/notifications/stream');
      source = connection;
      for (const kind of ['ready', 'inbox', 'roadmap'] as const) {
        connection.addEventListener(kind, (event) => {
          if (connection === source) receive(event as MessageEvent<string>, kind);
        });
      }
      connection.addEventListener('error', () => {
        if (!active || connection !== source || connection.readyState !== 2) return;
        // EventSource retries interrupted streams itself, but HTTP failures can
        // close it permanently. Recreate only that closed connection.
        connection.close();
        retry = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      });
    };
    const disconnect = () => {
      clearTimeout(retry);
      source?.close();
    };
    connect();
    window.addEventListener('offline', disconnect);
    window.addEventListener('online', connect);
    const stopRecovery = subscribeToRoadmapRecovery(refresh);
    return () => {
      active = false;
      stopRecovery();
      clearTimeout(retry);
      clearTimeout(pendingRefresh);
      window.removeEventListener('offline', disconnect);
      window.removeEventListener('online', connect);
      source?.close();
    };
  }, [userId]);
  return null;
}
