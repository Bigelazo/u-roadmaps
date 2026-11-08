'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AvoidModule } from 'libavoid-js';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import { useCoarsePointer } from '@/features/roadmap/ui/compact-canvas-layout';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { cn } from 'cn';
import {
  DependencyRouter,
  loadRoutingModule,
  prepareRoutingEngine,
  roadmapRoutingScene,
  type RoutingResult,
  type RoutingScene,
} from './libavoid';

const engineStatusDelayMs = 400;
const engineRetryDelayMs = 1000;

const emptyRoutes: RoutingResult = { routes: new Map(), fallbacks: 0 };
const PreviewRoutingContext = createContext<{ module: AvoidModule; sceneKey: string } | null>(null);

export function useConnectionPreviewRoute(source: string | null, target: string | null) {
  const context = useContext(PreviewRoutingContext);
  const [preview, setPreview] = useState<{ key: string; path: string } | null>(null);
  const key =
    context && source && target ? JSON.stringify([context.sceneKey, source, target]) : null;
  useLayoutEffect(() => {
    if (!context || !source || !target || !key) return;
    const router = new DependencyRouter(context.module);
    try {
      const scene = JSON.parse(context.sceneKey) as RoutingScene;
      let id = '__connection-preview__';
      while (scene.dependencies.some((dependency) => dependency.id === id)) id += '_';
      const result = router.route({
        ...scene,
        dependencies: [...scene.dependencies, { id, source, target }],
      });
      const route = result.routes.get(id);
      setPreview(route ? { key, path: route.path } : null);
    } catch {
      setPreview(null);
    } finally {
      router.dispose();
    }
  }, [context, key, source, target]);
  return preview?.key === key ? preview.path : null;
}

const RoutingContext = createContext(emptyRoutes.routes);

export function useDependencyRoute(id: string) {
  return useContext(RoutingContext).get(id);
}

export type RoutingEngineStatus = 'waiting' | 'routed' | 'unavailable';
const RoutingEngineStatusContext = createContext<RoutingEngineStatus>('routed');

export function useRoutingEngineStatus() {
  return useContext(RoutingEngineStatusContext);
}

export function DependencyRouting({
  nodes,
  edges,
  children,
}: {
  nodes: readonly RoadmapFlowNode[];
  edges: readonly RoadmapFlowEdge[];
  children: ReactNode;
}) {
  useState(prepareRoutingEngine);
  const coarsePointer = useCoarsePointer();
  const [module, setModule] = useState<AvoidModule | null>(null);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const status = setTimeout(() => setSlow(true), engineStatusDelayMs);
    const load = (retries: number) => {
      loadRoutingModule()
        .then((loaded) => {
          if (!active) return;
          clearTimeout(status);
          setModule(loaded);
        })
        .catch(() => {
          if (!active) return;
          if (retries > 0) {
            retry = setTimeout(() => load(retries - 1), engineRetryDelayMs);
            return;
          }
          clearTimeout(status);
          setError(true);
        });
    };
    load(attempt === 0 ? 1 : 0);
    return () => {
      active = false;
      clearTimeout(status);
      clearTimeout(retry);
    };
  }, [attempt]);

  const status: RoutingEngineStatus = module ? 'routed' : slow || error ? 'unavailable' : 'waiting';
  return (
    <RoutingEngineStatusContext value={status}>
      <RoutedCanvas
        module={module}
        sceneKey={JSON.stringify(roadmapRoutingScene(nodes, edges, { coarsePointer }))}
      >
        {children}
        {module || !(slow || error) ? null : (
          <div
            className={cn(
              'absolute bottom-24 left-1/2 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2',
              error ? 'pointer-events-auto' : 'pointer-events-none',
            )}
          >
            <div
              className="flex items-center gap-3 rounded-lg border border-border bg-card/95 px-3 py-2 text-sm text-ink shadow-sm"
              role={error ? 'alert' : 'status'}
            >
              <p>
                {error
                  ? 'No pudimos trazar las dependencias. Vuelve a intentarlo.'
                  : 'Preparando dependencias…'}
              </p>
              {error ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(false);
                    setSlow(false);
                    setAttempt((n) => n + 1);
                  }}
                >
                  Reintentar
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </RoutedCanvas>
    </RoutingEngineStatusContext>
  );
}

function RoutedCanvas({
  module,
  sceneKey,
  children,
}: {
  module: AvoidModule | null;
  sceneKey: string;
  children: ReactNode;
}) {
  const previewContext = useMemo(() => (module ? { module, sceneKey } : null), [module, sceneKey]);
  const [router, setRouter] = useState<DependencyRouter | null>(null);
  const [result, setResult] = useState(emptyRoutes);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    if (!module) return;
    const instance = new DependencyRouter(module);
    setRouter(instance);
    return () => instance.dispose();
  }, [module]);
  useLayoutEffect(() => {
    if (!router) return;
    try {
      setResult(router.route(JSON.parse(sceneKey) as RoutingScene));
      setFailed(false);
    } catch {
      setResult(emptyRoutes);
      setFailed(true);
    }
  }, [router, sceneKey]);
  return (
    <PreviewRoutingContext value={previewContext}>
      <RoutingContext value={result.routes}>
        {children}
        {failed ? (
          <div className="pointer-events-none absolute top-3 left-1/2 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2">
            <Alert role="status">
              <AlertDescription>
                No pudimos trazar las dependencias. Vuelve a abrir el mapa.
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
      </RoutingContext>
    </PreviewRoutingContext>
  );
}
