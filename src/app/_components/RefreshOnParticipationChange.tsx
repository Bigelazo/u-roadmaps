'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

async function settled(streamedThenable: PromiseLike<boolean>) {
  try {
    return await streamedThenable;
  } catch {
    return false;
  }
}

export function RefreshOnParticipationChange({ changed }: { changed: Promise<boolean> }) {
  const router = useRouter();
  useEffect(() => {
    let watching = true;
    void settled(changed).then((participationChanged) => {
      if (participationChanged && watching) router.refresh();
    });
    return () => {
      watching = false;
    };
  }, [changed, router]);
  return null;
}
