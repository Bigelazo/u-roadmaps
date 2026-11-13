'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { postJson, request } from './inbox-api';

const NodeChangeCountsContext = createContext<Record<string, number> | undefined>(undefined);

function useNodeChangeCounts(roadmapId: string | undefined) {
  const [result, setResult] = useState<{ roadmapId: string; byNode: Record<string, number> }>();
  const generation = useRef(0);
  const refetch = useCallback(async () => {
    if (!roadmapId) return;
    const current = ++generation.current;
    const response = await request<{ byNode: Record<string, number> }>(
      `/node-changes?${new URLSearchParams({ roadmapId })}`,
    ).catch(() => null);
    if (response && current === generation.current)
      setResult({ roadmapId, byNode: response.byNode });
  }, [roadmapId]);
  useEffect(() => {
    void refetch();
    const requestGeneration = generation;
    return () => {
      ++requestGeneration.current;
    };
  }, [refetch]);
  return { byNode: result && result.roadmapId === roadmapId ? result.byNode : undefined, refetch };
}

export function NodeChangeCountsProvider({
  roadmapId,
  openedNodeId = null,
  enabled,
  simulatedCounts,
  children,
}: {
  roadmapId: string;
  openedNodeId?: string | null;
  enabled: boolean;
  simulatedCounts?: Readonly<Record<string, number>>;
  children: ReactNode;
}) {
  const activeRoadmapId = enabled && !simulatedCounts ? roadmapId : undefined;
  const { byNode, refetch } = useNodeChangeCounts(activeRoadmapId);
  const reviewedOpening = useRef<string | null>(null);
  useEffect(() => {
    if (!activeRoadmapId || !openedNodeId) {
      reviewedOpening.current = null;
      return;
    }
    const opening = JSON.stringify([activeRoadmapId, openedNodeId]);
    if (!byNode || reviewedOpening.current === opening) return;
    reviewedOpening.current = opening;
    if (!byNode[openedNodeId]) return;
    void postJson('/node-changes', { roadmapId: activeRoadmapId, nodeId: openedNodeId }).then(
      refetch,
      () => {
        reviewedOpening.current = null;
      },
    );
  }, [activeRoadmapId, byNode, openedNodeId, refetch]);
  return (
    <NodeChangeCountsContext value={simulatedCounts ?? (enabled ? byNode : undefined)}>
      {children}
    </NodeChangeCountsContext>
  );
}

export function useNodeChangeCount(nodeId: string) {
  const counts = useContext(NodeChangeCountsContext);
  return counts ? (counts[nodeId] ?? 0) : undefined;
}
