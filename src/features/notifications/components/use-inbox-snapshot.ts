import { useEffect, useState } from 'react';
import type { OwnInboxSnapshot } from '../contracts/own-inbox-snapshot';
import { emptySnapshot } from './inbox-view';
import type { OwnInboxSnapshotPromise } from './inbox-store';

type SnapshotResolution =
  | { status: 'pending' }
  | { status: 'resolved'; value: OwnInboxSnapshot | null }
  | { status: 'rejected'; error: unknown };

export function useInboxSnapshot(snapshot: OwnInboxSnapshotPromise | null) {
  const [sessionSnapshot, setSessionSnapshot] = useState(snapshot);
  const [resolution, setResolution] = useState<SnapshotResolution>(() =>
    snapshot ? { status: 'pending' } : { status: 'resolved', value: emptySnapshot },
  );
  if (
    resolution.status === 'resolved' &&
    resolution.value === null &&
    snapshot &&
    snapshot !== sessionSnapshot
  )
    setSessionSnapshot(snapshot);

  useEffect(() => {
    if (!sessionSnapshot) return;
    let active = true;
    void sessionSnapshot.then(
      (value) => {
        if (active) setResolution({ status: 'resolved', value });
      },
      (error: unknown) => {
        if (active) setResolution({ status: 'rejected', error });
      },
    );
    return () => {
      active = false;
    };
  }, [sessionSnapshot]);

  if (resolution.status === 'rejected') throw resolution.error;
  return resolution.status === 'resolved' ? resolution.value : undefined;
}
