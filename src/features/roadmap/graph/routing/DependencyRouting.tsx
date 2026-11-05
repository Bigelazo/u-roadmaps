'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AvoidModule } from 'libavoid-js';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import {
  DependencyRouter,
  loadRoutingModule,
  roadmapRoutingScene,
  type RoutingResult,
  type RoutingScene,
} from './libavoid';

const emptyRoutes: RoutingResult = { routes: new Map(), blocked: 0 };
const RoutingContext = createContext(emptyRoutes.routes);

export function useDependencyRoute(id: string) {
  return useContext(RoutingContext).get(id);
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
  const [module, setModule] = useState<AvoidModule | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadRoutingModule()
      .then((loaded) => {
        if (active) {
          setModule(loaded);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (!module)
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-ink"
        role={error ? 'alert' : 'status'}
      >
        <p>{error ? 'No pudimos preparar el mapa. Vuelve a intentarlo.' : 'Preparando mapa…'}</p>
        {error ? (
          <Button
            variant="outline"
            onClick={() => {
              setError(false);
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar
          </Button>
        ) : null}
      </div>
    );
  return (
    <RoutedCanvas module={module} sceneKey={JSON.stringify(roadmapRoutingScene(nodes, edges))}>
      {children}
    </RoutedCanvas>
  );
}

function RoutedCanvas({
  module,
  sceneKey,
  children,
}: {
  module: AvoidModule;
  sceneKey: string;
  children: ReactNode;
}) {
  const [router, setRouter] = useState<DependencyRouter | null>(null);
  const [result, setResult] = useState(emptyRoutes);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    const instance = new DependencyRouter(module);
    setRouter(instance);
    return () => instance.dispose();
  }, [module]);
  useLayoutEffect(() => {
    if (!router) return;
    try {
      // A synchronous transaction before paint keeps routes on the same geometry
      // revision as the controlled nodes, including intermediate drag positions.
      setResult(router.route(JSON.parse(sceneKey) as RoutingScene));
      setFailed(false);
    } catch {
      setResult(emptyRoutes);
      setFailed(true);
    }
  }, [router, sceneKey]);
  return (
    <RoutingContext value={result.routes}>
      {children}
      {failed || result.blocked ? (
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2">
          <Alert role="status">
            <AlertDescription>
              {failed
                ? 'No pudimos trazar las dependencias. Vuelve a abrir el mapa.'
                : 'Hay dependencias sin espacio para trazarse. Separa los nodos superpuestos.'}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </RoutingContext>
  );
}
