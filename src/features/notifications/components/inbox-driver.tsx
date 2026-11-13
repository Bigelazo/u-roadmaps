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

function useNodeChangeCounts(roadmapId: string) {
  const [result, setResult] = useState<{ roadmapId: string; byNode: Record<string, number> }>();
  const generation = useRef(0);
  const refetch = useCallback(async () => {
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
  return { byNode: result?.roadmapId === roadmapId ? result.byNode : undefined, refetch };
}

function ActiveNodeChangeCounts({
  roadmapId,
  openedNodeId,
  children,
}: {
  roadmapId: string;
  openedNodeId: string | null;
  children: ReactNode;
}) {
  const { byNode, refetch } = useNodeChangeCounts(roadmapId);
  const reviewedOpening = useRef<string | null>(null);
  useEffect(() => {
    if (!openedNodeId) {
      reviewedOpening.current = null;
      return;
    }
    if (!byNode || reviewedOpening.current === openedNodeId) return;
    reviewedOpening.current = openedNodeId;
    if (!byNode[openedNodeId]) return;
    void postJson('/node-changes', { roadmapId, nodeId: openedNodeId }).then(refetch, () => {
      reviewedOpening.current = null;
    });
  }, [byNode, openedNodeId, refetch, roadmapId]);
  return <NodeChangeCountsContext value={byNode}>{children}</NodeChangeCountsContext>;
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
  if (simulatedCounts)
    return <NodeChangeCountsContext value={simulatedCounts}>{children}</NodeChangeCountsContext>;
  return enabled ? (
    <ActiveNodeChangeCounts key={roadmapId} roadmapId={roadmapId} openedNodeId={openedNodeId}>
      {children}
    </ActiveNodeChangeCounts>
  ) : (
    <NodeChangeCountsContext value={undefined}>{children}</NodeChangeCountsContext>
  );
}

export function useNodeChangeCount(nodeId: string) {
  const counts = useContext(NodeChangeCountsContext);
  return counts ? (counts[nodeId] ?? 0) : undefined;
}
