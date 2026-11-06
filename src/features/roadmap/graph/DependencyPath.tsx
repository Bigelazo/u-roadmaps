'use client';

import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { MotionValue } from 'motion/react';

export function DependencyPath({
  path,
  style,
  className = 'react-flow__edge-path',
  id,
  progress,
}: {
  path: string;
  style?: CSSProperties;
  className?: string;
  id?: string;
  progress?: MotionValue<number>;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const stroke = pathRef.current;
    const tip = tipRef.current;
    if (!stroke || !tip || !stroke.getTotalLength || !stroke.getPointAtLength) return;
    const length = stroke.getTotalLength();
    const paint = (value: number) => {
      const fraction = Math.max(0, Math.min(1, value));
      stroke.setAttribute('stroke-dasharray', `${fraction} 1`);
      const distance = length * fraction;
      const point = stroke.getPointAtLength(distance);
      const before = stroke.getPointAtLength(Math.max(0, distance - 0.5));
      const after = stroke.getPointAtLength(Math.min(length, distance + 0.5));
      const angle = (Math.atan2(after.y - before.y, after.x - before.x) * 180) / Math.PI;
      tip.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${angle})`);
      tip.style.visibility = fraction > 0 && length > 0 ? 'visible' : 'hidden';
      stroke.style.visibility = fraction > 0 ? 'visible' : 'hidden';
    };
    paint(progress?.get() ?? 1);
    return progress?.on('change', paint);
  }, [path, progress]);

  return (
    <g style={style} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        ref={pathRef}
        id={id}
        d={path}
        pathLength={1}
        className={className}
        style={style}
        strokeDasharray={progress ? '0 1' : undefined}
      />
      <path
        ref={tipRef}
        data-testid="dependency-arrowhead"
        className="roadmap-dependency-tip"
        d="M -9 -5 L 0 0 L -9 5"
        style={{ visibility: 'hidden', pointerEvents: 'none' }}
        pointerEvents="none"
      />
    </g>
  );
}
