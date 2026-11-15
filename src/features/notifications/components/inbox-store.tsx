'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { OwnInboxSnapshot } from '../contracts/own-inbox-snapshot';
import { emptySnapshot, viewOwnInbox, type OwnInboxView } from './inbox-view';
import { useInboxSnapshot } from './use-inbox-snapshot';
export type { OfferingFilter, OwnInboxView } from './inbox-view';

export type OwnInboxSnapshotPromise = Promise<OwnInboxSnapshot | null>;

type OwnInboxStore = Readonly<{
  view: OwnInboxView | null;
  acknowledgeRoadmap: (roadmapId: string) => void;
}>;

const OwnInboxStoreContext = createContext<OwnInboxStore>({
  view: viewOwnInbox(emptySnapshot, new Set()),
  acknowledgeRoadmap: () => undefined,
});

export function OwnInboxStoreProvider({
  snapshot,
  children,
}: {
  snapshot: OwnInboxSnapshotPromise | null;
  children: ReactNode;
}) {
  const resolved = useInboxSnapshot(snapshot);
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(() => new Set());
  const acknowledgeRoadmap = useCallback((roadmapId: string) => {
    setAcknowledged((previous) =>
      previous.has(roadmapId) ? previous : new Set([...previous, roadmapId]),
    );
  }, []);
  const store = useMemo(
    () => ({
      view: resolved === undefined ? null : viewOwnInbox(resolved, acknowledged),
      acknowledgeRoadmap,
    }),
    [resolved, acknowledged, acknowledgeRoadmap],
  );
  return <OwnInboxStoreContext value={store}>{children}</OwnInboxStoreContext>;
}

export function useOwnInbox(): OwnInboxView | null {
  return useContext(OwnInboxStoreContext).view;
}

export function useAcknowledgeRoadmap() {
  return useContext(OwnInboxStoreContext).acknowledgeRoadmap;
}
