'use client';

import {
  createContext,
  Suspense,
  use,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  OwnInboxNotice,
  OwnInboxOffering,
  OwnInboxSnapshot,
} from '../contracts/own-inbox-snapshot';

export type OwnInboxSnapshotPromise = Promise<OwnInboxSnapshot | null>;

export type OfferingFilter = Readonly<{ courseCode: string; year: number; semester: number }>;

export type OwnInboxView = Readonly<{
  available: boolean;
  total: number;
  unreadFor: (offering: OfferingFilter) => number;
  noticesFor: (offering?: OfferingFilter) => readonly OwnInboxNotice[];
}>;

const emptySnapshot: OwnInboxSnapshot = { total: 0, offerings: [], notices: [] };

function matches(offering: OwnInboxOffering, filter: OfferingFilter) {
  return (
    offering.courseCode === filter.courseCode &&
    offering.year === filter.year &&
    offering.semester === filter.semester
  );
}

function unreadIn(offerings: readonly OwnInboxOffering[]) {
  return offerings.reduce((sum, offering) => sum + offering.unread, 0);
}

export function viewOwnInbox(
  snapshot: OwnInboxSnapshot | null,
  acknowledged: ReadonlySet<string>,
): OwnInboxView {
  const source = snapshot ?? emptySnapshot;
  const offerings = source.offerings.filter((offering) => !acknowledged.has(offering.roadmapId));
  const notices = source.notices.filter((notice) => !acknowledged.has(notice.roadmapId));
  const offeringsOf = (filter: OfferingFilter) =>
    offerings.filter((offering) => matches(offering, filter));
  return {
    available: snapshot !== null,
    total: unreadIn(offerings),
    unreadFor: (filter) => unreadIn(offeringsOf(filter)),
    noticesFor: (filter) => {
      if (!filter) return notices;
      const roadmaps = new Set(offeringsOf(filter).map(({ roadmapId }) => roadmapId));
      return notices.filter((notice) => roadmaps.has(notice.roadmapId));
    },
  };
}

type OwnInboxStore = Readonly<{
  view: OwnInboxView | null;
  acknowledgeRoadmap: (roadmapId: string) => void;
}>;

const OwnInboxStoreContext = createContext<OwnInboxStore>({
  view: viewOwnInbox(emptySnapshot, new Set()),
  acknowledgeRoadmap: () => undefined,
});

function SnapshotResolution({
  snapshot,
  onResolved,
}: {
  snapshot: OwnInboxSnapshotPromise;
  onResolved: (snapshot: OwnInboxSnapshot | null) => void;
}) {
  const resolved = use(snapshot);
  useEffect(() => onResolved(resolved), [onResolved, resolved]);
  return null;
}

export function OwnInboxStoreProvider({
  snapshot,
  children,
}: {
  snapshot: OwnInboxSnapshotPromise | null;
  children: ReactNode;
}) {
  const [sessionSnapshot, setSessionSnapshot] = useState(snapshot);
  const [resolved, setResolved] = useState<OwnInboxSnapshot | null | undefined>(
    sessionSnapshot ? undefined : emptySnapshot,
  );
  if (resolved === null && snapshot && snapshot !== sessionSnapshot) setSessionSnapshot(snapshot);
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
  return (
    <OwnInboxStoreContext value={store}>
      {sessionSnapshot ? (
        <Suspense fallback={null}>
          <SnapshotResolution snapshot={sessionSnapshot} onResolved={setResolved} />
        </Suspense>
      ) : null}
      {children}
    </OwnInboxStoreContext>
  );
}

export function useOwnInbox(): OwnInboxView | null {
  return useContext(OwnInboxStoreContext).view;
}

export function useAcknowledgeRoadmap() {
  return useContext(OwnInboxStoreContext).acknowledgeRoadmap;
}
