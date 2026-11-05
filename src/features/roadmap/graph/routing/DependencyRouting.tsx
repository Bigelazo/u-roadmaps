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
import styles from './DependencyRouting.module.css';

// Fast loads finish inside this budget and never show the status.
const engineStatusDelayMs = 400;
const engineRetryDelayMs = 1000;

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
  // Once per mount: a failed load must not restart on every later render of the canvas.
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
    // Only the initial load retries by itself; "Reintentar" answers with its own attempt.
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

  // The canvas, its nodes and overlays render at once and stay mounted; only dependencies
  // wait for the engine. Unrouted dependencies stay absent rather than drawn as unsafe
  // native paths.
  return (
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
  const [router, setRouter] = useState<DependencyRouter | null>(null);
  const [result, setResult] = useState(emptyRoutes);
  const [failed, setFailed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useLayoutEffect(() => {
    if (!module) return;
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
      {/* The fade rule only applies while this class is set, so it plays once: dependencies
          inserted later and re-routes during drags appear without it. */}
      <div
        className={revealed ? 'contents' : cn('contents', styles.reveal)}
        onAnimationEnd={(event) => {
          if ((event.target as Element).matches('.react-flow__edge-path')) setRevealed(true);
        }}
      >
        {children}
      </div>
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
