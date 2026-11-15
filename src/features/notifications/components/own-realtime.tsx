'use client';

import { useEffect } from 'react';
import {
  ROADMAP_CHANGE_RECEIVED_EVENT,
  requestRoadmapRecovery,
} from '@/shared/client/roadmap-events';

type Connection = { source: EventSource; listeningSince: number };

const CONNECTING = 0;
const CLOSED = 2;

function ownFrame(event: Event, userId: string) {
  try {
    const parsed: unknown = JSON.parse((event as MessageEvent<string>).data);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    return value.userId === userId ? value : null;
  } catch {
    return null;
  }
}

function relayRoadmapChange(value: Record<string, unknown>) {
  if (
    typeof value.courseCode !== 'string' ||
    value.courseCode.trim().length === 0 ||
    value.courseCode.length > 20 ||
    !Number.isSafeInteger(value.year) ||
    (value.year as number) <= 0 ||
    (value.semester !== 1 && value.semester !== 2)
  )
    return;
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

export function OwnInboxRealtime({ userId }: { userId: string }) {
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    let active = true;
    let current: Connection | undefined;
    let successor: Connection | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;
    const closeAll = () => {
      current?.source.close();
      successor?.source.close();
      current = undefined;
      successor = undefined;
    };
    const ready = (connection: Connection) => {
      retryDelay = 1000;
      if (connection === successor) {
        current?.source.close();
        current = connection;
        successor = undefined;
        return;
      }
      requestRoadmapRecovery(connection.listeningSince);
    };
    const failed = (connection: Connection) => {
      const { source } = connection;
      if (connection === successor) {
        if (source.readyState !== CLOSED) return;
        source.close();
        successor = undefined;
        return;
      }
      if (successor) {
        source.close();
        current = successor;
        successor = undefined;
        return;
      }
      if (source.readyState === CONNECTING) {
        connection.listeningSince = Date.now();
        return;
      }
      if (source.readyState !== CLOSED) return;
      source.close();
      retry = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    };
    const open = (): Connection => {
      const connection: Connection = {
        source: new EventSource('/api/notifications/stream'),
        listeningSince: Date.now(),
      };
      const accepted = () => active && (connection === current || connection === successor);
      connection.source.addEventListener('ready', (event) => {
        if (accepted() && ownFrame(event, userId)) ready(connection);
      });
      connection.source.addEventListener('roadmap', (event) => {
        const value = accepted() ? ownFrame(event, userId) : null;
        if (value) relayRoadmapChange(value);
      });
      connection.source.addEventListener('rotate', (event) => {
        if (active && connection === current && !successor && ownFrame(event, userId))
          successor = open();
      });
      connection.source.addEventListener('error', () => {
        if (accepted()) failed(connection);
      });
      return connection;
    };
    const connect = () => {
      if (!active || !navigator.onLine) return;
      clearTimeout(retry);
      closeAll();
      current = open();
    };
    const disconnect = () => {
      clearTimeout(retry);
      closeAll();
    };
    connect();
    window.addEventListener('offline', disconnect);
    window.addEventListener('online', connect);
    return () => {
      active = false;
      clearTimeout(retry);
      window.removeEventListener('offline', disconnect);
      window.removeEventListener('online', connect);
      closeAll();
    };
  }, [userId]);
  return null;
}
