'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { useNodesInitialized } from '@xyflow/react';
import { animate, cubicBezier, motionValue, useMotionValue, type MotionValue } from 'motion/react';
import {
  dependencyAnimationSchedule,
  dependencyDrawingEase,
} from '@/features/roadmap/graph/dependency-animation-schedule';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import { DependencyPath } from '@/features/roadmap/graph/DependencyPath';
import { useRoutingEngineStatus } from '@/features/roadmap/graph/routing/DependencyRouting';

export type DependencyAnimationControls = { finish: () => void };

type EdgePlayback = {
  progress: MotionValue<number>;
  animation?: { stop: () => void };
};

function createPlayback(edges: readonly RoadmapFlowEdge[], nodeIds: readonly string[]) {
  const schedule = dependencyAnimationSchedule(edges);
  const nodeRecords = new Map<string, EdgePlayback>(
    nodeIds.map((id) => [id, { progress: motionValue(0) }]),
  );
  const arrivals = new Map(nodeIds.map((id) => [id, 0]));
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  for (const slot of schedule) {
    const target = edgeById.get(slot.id)!.target;
    if (!nodeRecords.has(target)) nodeRecords.set(target, { progress: motionValue(0) });
    arrivals.set(target, Math.max(arrivals.get(target) ?? 0, slot.start + slot.duration));
  }
  const revealNode = (record: EdgePlayback) => {
    if (record.progress.get() >= 1 || record.animation) return;
    record.animation = animate(record.progress, 1, {
      duration: 0.18 * (1 - record.progress.get()),
      ease: cubicBezier(0.16, 1, 0.3, 1),
      onComplete: () => {
        record.animation = undefined;
      },
    });
  };
  const initialIds = new Set(schedule.map((slot) => slot.id));
  const records = new Map<string, EdgePlayback>(
    schedule.map((slot) => [slot.id, { progress: motionValue(0) }]),
  );
  const clock = motionValue(0);
  const total = schedule.length
    ? schedule[schedule.length - 1].start + schedule[schedule.length - 1].duration
    : 0;
  let entryAnimation: { stop: () => void } | undefined;
  let entryComplete = false;

  const recordFor = (id: string) => {
    let record = records.get(id);
    if (!record) {
      record = { progress: motionValue(0) };
      records.set(id, record);
    }
    return record;
  };

  const start = () => {
    if (entryComplete || entryAnimation) return;
    let index = 0;
    const paint = (time: number) => {
      for (const [id, arrival] of arrivals) {
        if (time >= arrival) revealNode(nodeRecords.get(id)!);
      }
      while (index < schedule.length) {
        const slot = schedule[index];
        const progress = Math.max(0, Math.min(1, (time - slot.start) / slot.duration));
        recordFor(slot.id).progress.set(progress);
        if (progress < 1) break;
        index++;
      }
    };
    paint(clock.get());
    entryAnimation = animate(clock, total, {
      duration: Math.max(0, total - clock.get()),
      // Ease the complete sequence so speed does not reset at each Node.
      ease: dependencyDrawingEase,
      onUpdate: paint,
      onComplete: () => {
        paint(total);
        entryComplete = true;
        entryAnimation = undefined;
      },
    });
  };

  const stop = () => {
    entryAnimation?.stop();
    entryAnimation = undefined;
    for (const record of [...records.values(), ...nodeRecords.values()]) {
      record.animation?.stop();
      record.animation = undefined;
    }
  };

  const finish = () => {
    stop();
    entryComplete = true;
    clock.set(total);
    for (const record of [...records.values(), ...nodeRecords.values()]) record.progress.set(1);
  };

  const mountPath = (id: string) => {
    if (initialIds.has(id)) return;
    const record = recordFor(id);
    if (record.progress.get() >= 1) return;
    record.animation?.stop();
    record.animation = animate(record.progress, 1, {
      duration: 0.32 * (1 - record.progress.get()),
      ease: dependencyDrawingEase,
    });
    return () => {
      record.animation?.stop();
      record.animation = undefined;
    };
  };

  const mountNode = (id: string) => {
    const record = nodeRecords.get(id)!;
    if (
      !arrivals.has(id) ||
      ((entryComplete || entryAnimation) && clock.get() >= arrivals.get(id)!)
    )
      revealNode(record);
    return () => {
      record.animation?.stop();
      record.animation = undefined;
    };
  };
  const nodeProgressFor = (id: string) => {
    // Nodes added after opening should reveal when mounted, rather than wait for the entry clock.
    let record = nodeRecords.get(id);
    if (!record) {
      record = { progress: motionValue(0) };
      nodeRecords.set(id, record);
    }
    return record.progress;
  };

  return {
    nodeProgressFor,
    mountNode,
    progressFor: (id: string) => recordFor(id).progress,
    start,
    stop,
    finish,
    mountPath,
  };
}

const DependencyAnimationContext = createContext<ReturnType<typeof createPlayback> | null>(null);

/** One playback owner per mounted Roadmap visit; changing edge props does not reset it. */
export function DependencyAnimationProvider({
  edges,
  nodeIds,
  controlsRef,
  children,
}: {
  edges: readonly RoadmapFlowEdge[];
  nodeIds: readonly string[];
  controlsRef: RefObject<DependencyAnimationControls | null>;
  children: ReactNode;
}) {
  const [playback] = useState(() => createPlayback(edges, nodeIds));
  useEffect(() => {
    controlsRef.current = playback;
    return () => {
      playback.stop();
      controlsRef.current = null;
    };
  }, [controlsRef, playback]);
  return <DependencyAnimationContext value={playback}>{children}</DependencyAnimationContext>;
}

/** Render inside ReactFlow so paths are mounted and Nodes measured before entry playback. */
export function DependencyAnimationReady() {
  const ready = useNodesInitialized();
  const engine = useRoutingEngineStatus();
  const playback = useContext(DependencyAnimationContext);
  useEffect(() => {
    // Waiting Nodes stay hidden during entry: a slow engine must not keep them out of reach.
    if (engine === 'unavailable') playback?.finish();
    else if (ready && engine === 'routed') playback?.start();
  }, [engine, playback, ready]);
  return null;
}

export function useDependencyProgress(id: string) {
  const playback = useContext(DependencyAnimationContext);
  const complete = useMotionValue(1);
  useEffect(() => playback?.mountPath(id), [id, playback]);
  return playback?.progressFor(id) ?? complete;
}

/** Shared entry timing keeps the Node reveal attached to its incoming Dependencies. */
export function useNodeEntryProgress(id: string) {
  const playback = useContext(DependencyAnimationContext);
  const complete = useMotionValue(1);
  const progress = playback?.nodeProgressFor(id) ?? complete;
  useEffect(() => playback?.mountNode(id), [id, playback]);
  return progress;
}

export function AnimatedDependencyPath({
  id,
  path,
  style,
}: {
  id: string;
  path: string;
  style?: CSSProperties;
}) {
  const progress = useDependencyProgress(id);
  return <DependencyPath id={id} path={path} style={style} progress={progress} />;
}
