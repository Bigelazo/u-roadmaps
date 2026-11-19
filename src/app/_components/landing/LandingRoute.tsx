'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  animate,
  domAnimation,
  LazyMotion,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import * as m from 'motion/react-m';
import { type Point, roundedPath } from '@/app/_components/landing/CourseRouteComparison';

type Rect = { x: number; y: number; width: number; height: number };
type Connector = { d: string; tip: Point; start: number; end: number };

const spineX = 8;
const tick = 12;
const desktopQuery = '(min-width: 64rem)';

function connectorPoints([x1, y1]: Point, [x2, y2]: Point, desktop: boolean): Point[] {
  if (!desktop) {
    return [
      [x1, y1],
      [x1, y1 + tick],
      [spineX, y1 + tick],
      [spineX, y2 - tick],
      [x2, y2 - tick],
      [x2, y2],
    ];
  }
  const middle = Math.max((y1 + y2) / 2, y2 - 40);
  return [
    [x1, y1],
    [x1, middle],
    [x2, middle],
    [x2, y2],
  ];
}

function measureRoute(main: HTMLElement) {
  const origin = main.getBoundingClientRect();
  const desktop = window.matchMedia(desktopQuery).matches;
  const pageTop = origin.top + window.scrollY;
  const connectors: Connector[] = [];
  let leaving: Point | null = null;
  main.querySelectorAll<HTMLElement>('[data-route-anchor]').forEach((anchor) => {
    if (!anchor.getClientRects().length) return;
    const rect = anchor.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - origin.left;
    if (anchor.dataset.routeAnchor === 'out') {
      leaving = [x, rect.bottom - origin.top];
      return;
    }
    if (!leaving) return;
    const arriving: Point = [x, rect.top - origin.top];
    connectors.push({
      d: roundedPath(connectorPoints(leaving, arriving, desktop)),
      tip: arriving,
      start: pageTop + leaving[1] - window.innerHeight * 0.9,
      end: pageTop + arriving[1] - window.innerHeight * 0.55,
    });
    leaving = null;
  });
  const surfaces: Rect[] = [...main.querySelectorAll('[data-route-surface="brand"]')].map(
    (surface) => {
      const rect = surface.getBoundingClientRect();
      return {
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      };
    },
  );
  return { connectors, surfaces };
}

function ConnectorStroke({
  connector,
  progress,
  color,
}: {
  connector: Connector;
  progress: MotionValue<number>;
  color: string;
}) {
  const arrowOpacity = useTransform(progress, [0.92, 1], [0, 1]);
  const [x, y] = connector.tip;
  return (
    <>
      <m.path
        d={connector.d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        style={{ pathLength: progress }}
      />
      <m.path
        d={`M ${x - 6} ${y - 10} L ${x} ${y} L ${x + 6} ${y - 10} Z`}
        fill={color}
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
        style={{ opacity: arrowOpacity }}
      />
    </>
  );
}

function useAssemblyProgress() {
  const progress = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (reduceMotion) return progress.jump(1);
    const controls = animate(progress, 1, { delay: 0.9, duration: 0.8, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [progress, reduceMotion]);
  return progress;
}

function ScrollConnector(props: ConnectorProps & { scrollY: MotionValue<number> }) {
  const { connector, scrollY } = props;
  const progress = useTransform(
    scrollY,
    [connector.start, Math.max(connector.end, connector.start + 1)],
    [0, 1],
  );
  return <RouteConnector {...props} progress={progress} />;
}

function AssemblyConnector(props: ConnectorProps) {
  return <RouteConnector {...props} progress={useAssemblyProgress()} />;
}

type ConnectorProps = { connector: Connector; cloudMask: string; brandClip: string };

function RouteConnector({
  connector,
  progress,
  cloudMask,
  brandClip,
}: ConnectorProps & { progress: MotionValue<number> }) {
  return (
    <>
      <g mask={`url(#${cloudMask})`}>
        <ConnectorStroke connector={connector} progress={progress} color="var(--ink)" />
      </g>
      <g clipPath={`url(#${brandClip})`}>
        <ConnectorStroke
          connector={connector}
          progress={progress}
          color="var(--brand-surface-foreground)"
        />
      </g>
    </>
  );
}

export function LandingRoute() {
  const svgRef = useRef<SVGSVGElement>(null);
  const id = useId();
  const cloudMask = `${id}-cloud`;
  const brandClip = `${id}-brand`;
  const { scrollY } = useScroll();
  const [route, setRoute] = useState<ReturnType<typeof measureRoute>>({
    connectors: [],
    surfaces: [],
  });

  const measure = useCallback(() => {
    const main = svgRef.current?.parentElement;
    if (main) setRoute(measureRoute(main));
  }, []);

  useEffect(() => {
    const main = svgRef.current?.parentElement;
    if (!main) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] size-full overflow-visible"
    >
      <defs>
        <mask id={cloudMask} maskUnits="userSpaceOnUse">
          <rect width="100%" height="100%" fill="white" />
          {route.surfaces.map((surface) => (
            <rect key={`${surface.x}-${surface.y}`} {...surface} fill="black" />
          ))}
        </mask>
        <clipPath id={brandClip}>
          {route.surfaces.map((surface) => (
            <rect key={`${surface.x}-${surface.y}`} {...surface} />
          ))}
        </clipPath>
      </defs>
      <LazyMotion features={domAnimation} strict>
        {route.connectors.map((connector, index) =>
          index === 0 ? (
            <AssemblyConnector
              key="assembly"
              connector={connector}
              cloudMask={cloudMask}
              brandClip={brandClip}
            />
          ) : (
            <ScrollConnector
              key={connector.d}
              connector={connector}
              scrollY={scrollY}
              cloudMask={cloudMask}
              brandClip={brandClip}
            />
          ),
        )}
      </LazyMotion>
    </svg>
  );
}
