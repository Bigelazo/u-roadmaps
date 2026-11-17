'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import type { AcademicOverviewBrowserResponse, AcademicOverviewPage } from '../types';
import { presentCachedAcademicCourses } from '../domain/browser-cache';
import {
  loadAcademicOverview,
  readAcademicCourseCache,
  setAcademicCacheIdentity,
} from '../infrastructure/browser-courses';
import { AcademicOverview } from './AcademicOverview';
import { AcademicOverviewLoading } from './AcademicOverviewLoading';

type Props = Omit<React.ComponentProps<typeof AcademicOverview>, 'overview'> & {
  userId: string;
};

type OverviewState = Readonly<{
  userId: string;
  overview: AcademicOverviewPage;
  synchronizedAt: number | null;
}>;

function twoDigits(value: number) {
  return String(value).padStart(2, '0');
}

function formatSynchronization(time: number) {
  const date = new Date(time);
  return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

function presentOverview(
  userId: string,
  result: AcademicOverviewBrowserResponse | null,
): OverviewState {
  const cache = readAcademicCourseCache(userId, true);
  const overview = result?.overview ?? { terms: [] };
  return {
    userId,
    overview:
      cache && result?.status !== 'complete'
        ? presentCachedAcademicCourses(overview, cache)
        : overview,
    synchronizedAt: result?.cache?.synchronizedAt ?? cache?.synchronizedAt ?? null,
  };
}

export function CachedAcademicOverview({ userId, notice, ...props }: Props) {
  const [state, setState] = useState<OverviewState | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    setAcademicCacheIdentity(userId);
    setPending(true);
    void loadAcademicOverview(userId)
      .then(
        (result) => presentOverview(userId, result),
        () => presentOverview(userId, null),
      )
      .then((next) => {
        if (active) setState(next);
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function refresh() {
    setPending(true);
    try {
      setState(presentOverview(userId, await loadAcademicOverview(userId, true)));
    } catch {
      setState((current) => (current?.userId === userId ? current : presentOverview(userId, null)));
    } finally {
      setPending(false);
    }
  }

  const current = state?.userId === userId ? state : null;
  if (!current) return <AcademicOverviewLoading />;
  return (
    <AcademicOverview
      {...props}
      overview={current.overview}
      actions={
        <Button variant="outline" disabled={pending} onClick={() => void refresh()}>
          {pending ? (
            <Spinner aria-hidden="true" data-icon="inline-start" />
          ) : (
            <RefreshCw aria-hidden="true" data-icon="inline-start" />
          )}
          {pending ? 'Actualizando...' : 'Actualizar'}
        </Button>
      }
      notice={notice}
      lastSynchronization={
        current.synchronizedAt === null ? null : formatSynchronization(current.synchronizedAt)
      }
    />
  );
}
