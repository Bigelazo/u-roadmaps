'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import type { AcademicOverviewPage } from '../types';
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
  footer?: React.ReactNode;
};

export function CachedAcademicOverview({ userId, notice, footer, ...props }: Props) {
  const [state, setState] = useState<{
    userId: string;
    overview: AcademicOverviewPage;
    message: string | null;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setAcademicCacheIdentity(userId);
    setPending(true);
    void loadAcademicOverview(userId)
      .then((result) => {
        if (!active) return;
        const cache = readAcademicCourseCache(userId);
        setState({
          userId,
          overview:
            result.status === 'local' && cache
              ? presentCachedAcademicCourses(result.overview, cache)
              : result.overview,
          message:
            result.status === 'partial'
              ? 'U-Campus respondió de forma parcial. Conservamos los cursos que ya tenías; puedes intentar actualizar nuevamente.'
              : null,
        });
        setFailure(null);
      })
      .catch(() => {
        if (active)
          setFailure('No pudimos cargar tus cursos. Revisa tu conexión e intenta nuevamente.');
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
    setFailure(null);
    try {
      const result = await loadAcademicOverview(userId, true);
      const cache = readAcademicCourseCache(userId, true);
      const overview =
        cache && result.status !== 'complete'
          ? {
              ...presentCachedAcademicCourses(result.overview, cache),
              source: result.status === 'unavailable' ? ('LOCAL' as const) : ('CACHE' as const),
            }
          : result.overview;
      setState({
        userId,
        overview,
        message:
          result.status === 'partial'
            ? 'U-Campus respondió de forma parcial. Conservamos los cursos que ya tenías; puedes intentar actualizar nuevamente.'
            : null,
      });
    } catch {
      setFailure('No pudimos actualizar tus cursos. Revisa tu conexión e intenta nuevamente.');
    } finally {
      setPending(false);
    }
  }

  const current = state?.userId === userId ? state : null;
  const refreshButton = (
    <Button variant="outline" disabled={pending} onClick={() => void refresh()}>
      {pending ? (
        <Spinner aria-hidden="true" data-icon="inline-start" />
      ) : (
        <RefreshCw aria-hidden="true" data-icon="inline-start" />
      )}
      {pending ? 'Actualizando cursos...' : 'Actualizar cursos'}
    </Button>
  );

  if (!current && !failure) return <AcademicOverviewLoading />;
  return (
    <>
      <AcademicOverview
        {...props}
        overview={current?.overview ?? { source: 'LOCAL', terms: [] }}
        actions={refreshButton}
        notice={
          notice || failure || current?.message || current?.overview.source === 'CACHE' ? (
            <>
              {notice}
              {failure || current?.message ? (
                <Alert role="status">
                  <AlertDescription>{failure ?? current?.message}</AlertDescription>
                </Alert>
              ) : null}
              {current?.overview.source === 'CACHE' ? (
                <p className="text-sm text-muted-foreground">
                  Cursos guardados en este navegador. Actualiza para consultar cambios en U-Campus.
                </p>
              ) : null}
            </>
          ) : null
        }
      />
      {footer}
    </>
  );
}
