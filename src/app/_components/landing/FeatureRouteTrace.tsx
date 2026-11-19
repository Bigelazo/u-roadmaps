'use client';

import { type RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'motion/react';
import * as m from 'motion/react-m';

type Edge = { d: string; x1: number; y0: number; y1: number; drawn: boolean };
type Geometry = { width: number; height: number; edges: Edge[]; stopTops: number[] };

const stopAnchorOffset = 32;
const turnAboveTarget = 48;
const cornerRadius = 12;
const viewportLine = 0.6;

function stepPath(sx: number, sy: number, tx: number, ty: number, turnY: number) {
  if (Math.abs(tx - sx) < 1) return `M ${sx} ${sy} L ${tx} ${ty}`;
  const dir = tx > sx ? 1 : -1;
  const r = Math.min(cornerRadius, Math.abs(tx - sx) / 2, turnY - sy, ty - turnY);
  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${turnY - r}`,
    `Q ${sx} ${turnY} ${sx + dir * r} ${turnY}`,
    `L ${tx - dir * r} ${turnY}`,
    `Q ${tx} ${turnY} ${tx} ${turnY + r}`,
    `L ${tx} ${ty}`,
  ].join(' ');
}

function measure(container: HTMLElement): Geometry | null {
  const box = container.getBoundingClientRect();
  const rect = (element: Element) => {
    const r = element.getBoundingClientRect();
    return {
      left: r.left - box.left,
      center: r.left - box.left + r.width / 2,
      top: r.top - box.top,
      bottom: r.bottom - box.top,
    };
  };
  const fork = container.querySelector('[data-route-anchor="in"]');
  if (!fork) return null;
  const root = rect(fork);
  const audiences = [...container.querySelectorAll('[data-route-audience]')].map((element) => ({
    ...rect(element),
    chosen: element.hasAttribute('data-chosen'),
  }));
  const stops = [...container.querySelectorAll('[data-route-stop]')].map(rect);
  const edges: Edge[] = audiences.map((audience) => {
    const turnY = (root.bottom + audience.top) / 2;
    return {
      d: stepPath(root.center, root.bottom, audience.center, audience.top, turnY),
      x1: audience.center,
      y0: root.bottom,
      y1: audience.top,
      drawn: audience.chosen,
    };
  });
  const chosen = audiences.find((audience) => audience.chosen);
  const sources = [
    ...(chosen ? [{ x: chosen.center, bottom: chosen.bottom }] : []),
    ...stops.slice(0, -1).map((stop) => ({ x: stop.left + stopAnchorOffset, bottom: stop.bottom })),
  ];
  sources.forEach((source, index) => {
    const target = stops[index];
    if (!target) return;
    const tx = target.left + stopAnchorOffset;
    const turnY = Math.max(source.bottom + cornerRadius, target.top - turnAboveTarget);
    edges.push({
      d: stepPath(source.x, source.bottom, tx, target.top, turnY),
      x1: tx,
      y0: source.bottom,
      y1: target.top,
      drawn: true,
    });
  });
  return { width: box.width, height: box.height, edges, stopTops: stops.map((stop) => stop.top) };
}

export function useRouteTrace(containerRef: RefObject<HTMLElement | null>, routeKey: string) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [furthest, setFurthest] = useState(-1);
  const reach = useMotionValue(0);
  const { scrollY } = useScroll();

  const currentLine = useCallback(() => {
    const container = containerRef.current;
    return container
      ? window.innerHeight * viewportLine - container.getBoundingClientRect().top
      : 0;
  }, [containerRef]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setGeometry(measure(container));
    update();
    reach.jump(currentLine());
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, currentLine, reach, routeKey]);

  useMotionValueEvent(scrollY, 'change', () => {
    reach.set(Math.max(reach.get(), currentLine()));
  });

  useEffect(() => {
    const tops = geometry?.stopTops ?? [];
    const sync = (value: number) => setFurthest(tops.filter((top) => top <= value).length - 1);
    sync(reach.get());
    return reach.on('change', sync);
  }, [geometry, reach]);

  return { geometry, reach, furthest };
}

function Trace({ edge, reach }: { edge: Edge; reach: MotionValue<number> }) {
  const progress = useTransform(reach, (value) =>
    Math.min(1, Math.max(0, (value - edge.y0) / Math.max(1, edge.y1 - edge.y0))),
  );
  const headOpacity = useTransform(progress, (value) => (value >= 0.999 ? 1 : 0));
  const head = `${edge.x1 - 6},${edge.y1 - 9} ${edge.x1 + 6},${edge.y1 - 9} ${edge.x1},${edge.y1}`;

  return (
    <g>
      <path d={edge.d} stroke="var(--steel)" strokeWidth={1.5} />
      <polygon points={head} fill="var(--steel)" stroke="none" />
      {edge.drawn ? (
        <>
          <m.path d={edge.d} stroke="var(--ink)" strokeWidth={2} style={{ pathLength: progress }} />
          <m.polygon
            points={head}
            fill="var(--ink)"
            stroke="none"
            style={{ opacity: headOpacity }}
          />
        </>
      ) : null}
    </g>
  );
}

export function FeatureRouteTrace({
  geometry,
  reach,
}: {
  geometry: Geometry | null;
  reach: MotionValue<number>;
}) {
  if (!geometry) return null;
  return (
    <svg
      aria-hidden="true"
      width={geometry.width}
      height={geometry.height}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute inset-0 overflow-visible"
    >
      {geometry.edges.map((edge) => (
        <Trace key={edge.d} edge={edge} reach={reach} />
      ))}
    </svg>
  );
}
