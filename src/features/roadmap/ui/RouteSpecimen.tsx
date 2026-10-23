'use client';

import {
  BookOpen,
  CalendarClock,
  CircleCheckBig,
  CircleEllipsis,
  ClipboardCheck,
  FileText,
  LibraryBig,
  Link2,
  LockKeyhole,
  type LucideIcon,
} from 'lucide-react';
import { domAnimation, LazyMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { cn } from 'cn';
import { roadmapNodeSizeForTitle } from '@/features/roadmap/graph/geometry';

const nodeTypes = {
  content: { name: 'Contenido', Icon: BookOpen, color: '#024AD8' },
  assessment: { name: 'Evaluación', Icon: ClipboardCheck, color: '#FF5050' },
  supplementary: { name: 'Material extra', Icon: LibraryBig, color: '#356373' },
} as const;

export type RouteSpecimenNodeId =
  'variables' | 'conditionals' | 'exercises' | 'functions' | 'recursion' | 'quiz';

type SpecimenNode = {
  id: RouteSpecimenNodeId;
  title: string;
  type: keyof typeof nodeTypes;
  status: 'completed' | 'available' | 'locked';
  x: number;
  y: number;
  current?: boolean;
  files?: number;
  links?: number;
  note?: { Icon: LucideIcon; text: string };
  description: string;
};

const nodes: SpecimenNode[] = [
  {
    id: 'variables',
    title: 'Variables',
    type: 'content',
    status: 'completed',
    x: 128,
    y: 20,
    files: 1,
    description: 'Contenido completado, con 1 archivo.',
  },
  {
    id: 'conditionals',
    title: 'Condicionales',
    type: 'content',
    status: 'completed',
    x: 16,
    y: 140,
    files: 1,
    description: 'Contenido completado, con 1 archivo. Requiere Variables.',
  },
  {
    id: 'exercises',
    title: 'Ejercicios',
    type: 'supplementary',
    status: 'available',
    x: 248,
    y: 140,
    links: 1,
    description: 'Material extra disponible, con 1 enlace. Requiere Variables.',
  },
  {
    id: 'functions',
    title: 'Funciones',
    type: 'content',
    status: 'available',
    current: true,
    x: 36,
    y: 260,
    files: 1,
    links: 1,
    description:
      'Contenido disponible y siguiente paso de la ruta, con 1 archivo y 1 enlace. Requiere Condicionales.',
  },
  {
    id: 'recursion',
    title: 'Recursión',
    type: 'content',
    status: 'locked',
    x: 248,
    y: 260,
    files: 1,
    note: { Icon: CalendarClock, text: 'Desde el 20 oct.' },
    description:
      'Contenido bloqueado por el equipo docente, con 1 archivo; se desbloquea el 20 de octubre. Requiere Condicionales.',
  },
  {
    id: 'quiz',
    title: 'Control 1',
    type: 'assessment',
    status: 'locked',
    x: 36,
    y: 380,
    files: 1,
    note: { Icon: LockKeyhole, text: 'Requiere Funciones' },
    description: 'Evaluación bloqueada hasta completar Funciones, con 1 archivo.',
  },
];

const dependencies = [
  ['variables', 'conditionals'],
  ['variables', 'exercises'],
  ['conditionals', 'functions'],
  ['conditionals', 'recursion'],
  ['functions', 'quiz'],
] as const;

const viewBox = { width: 424, height: 500 };
const nodeHeight = roadmapNodeSizeForTitle('').height;
const edgeRadius = 8;
const stagger = 0.11;
const easeOutExpo = [0.16, 1, 0.3, 1] as const;
const completedCount = nodes.filter((node) => node.status === 'completed').length;
const nextNode = nodes.find((node) => node.current);
const nodeById = new Map(nodes.map((node) => [node.id, node]));

function nodeWidth(node: SpecimenNode) {
  return roadmapNodeSizeForTitle(node.title).width;
}

function nodeDepth(id: RouteSpecimenNodeId): number {
  const parents = dependencies.filter(([, target]) => target === id);
  return parents.length ? 1 + Math.max(...parents.map(([source]) => nodeDepth(source))) : 0;
}

function stepPath(source: SpecimenNode, target: SpecimenNode) {
  const sx = source.x + nodeWidth(source) / 2;
  const sy = source.y + nodeHeight;
  const tx = target.x + nodeWidth(target) / 2;
  const ty = target.y - (target.current ? 6 : 0);
  if (sx === tx) return `M ${sx} ${sy} L ${tx} ${ty}`;
  const my = (sy + ty) / 2;
  const dir = tx > sx ? 1 : -1;
  const r = Math.min(edgeRadius, Math.abs(tx - sx) / 2, (ty - sy) / 2);
  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${my - r}`,
    `Q ${sx} ${my} ${sx + dir * r} ${my}`,
    `L ${tx - dir * r} ${my}`,
    `Q ${tx} ${my} ${tx} ${my + r}`,
    `L ${tx} ${ty}`,
  ].join(' ');
}

function StatusBadge({ node, width }: { node: SpecimenNode; width: number }) {
  const { Icon, color } = {
    completed: { Icon: CircleCheckBig, color: 'var(--progress-deep)' },
    available: { Icon: CircleEllipsis, color: 'var(--ink)' },
    locked: { Icon: LockKeyhole, color: 'var(--graphite)' },
  }[node.status];
  const cx = width - 6;
  const cy = nodeHeight - 6;
  return (
    <g>
      <circle cx={cx} cy={cy} r={15} fill="var(--card)" stroke="var(--card)" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={15} fill="none" stroke="var(--fog)" strokeWidth={1} />
      <Icon x={cx - 10} y={cy - 10} size={20} color={color} aria-hidden="true" />
    </g>
  );
}

function ResourceBadge({ node, width }: { node: SpecimenNode; width: number }) {
  const groups = [
    { count: node.files ?? 0, Icon: FileText, color: 'var(--graphite)' },
    { count: node.links ?? 0, Icon: Link2, color: 'var(--primary)' },
  ].filter((group) => group.count > 0);
  if (!groups.length) return null;
  const badgeWidth = groups.length === 1 ? 24 : 48;
  const left = width + 10 - badgeWidth;
  return (
    <g>
      <rect
        x={left}
        y={-10}
        width={badgeWidth}
        height={24}
        rx={6}
        fill="var(--card)"
        stroke="var(--fog)"
      />
      {groups.map(({ count, Icon, color }, index) => {
        const cx = left + (groups.length === 1 ? 12 : 13 + index * 22);
        return (
          <g key={color}>
            <Icon x={cx - 6} y={-4} size={12} color={color} aria-hidden="true" />
            <text
              x={cx + 7}
              y={11}
              fontSize={8}
              fontWeight={700}
              fill={color}
              textAnchor="middle"
              className="tabular-nums max-sm:text-[11px]"
            >
              {count}
            </text>
          </g>
        );
      })}
    </g>
  );
}

type RouteSpecimenInteraction = {
  highlightedNodeId?: RouteSpecimenNodeId | null;
  onNodeHover?: (nodeId: RouteSpecimenNodeId | null) => void;
};

function NodeOutline({
  width,
  current,
  highlighted,
}: {
  width: number;
  current: boolean;
  highlighted: boolean;
}) {
  return (
    <>
      {current ? (
        <rect
          x={-6}
          y={-6}
          width={width + 12}
          height={nodeHeight + 12}
          rx={12}
          fill="var(--progress-soft)"
          stroke="var(--progress)"
          strokeWidth={2}
        />
      ) : null}
      <m.rect
        x={current ? -11 : -6}
        y={current ? -11 : -6}
        width={width + (current ? 22 : 12)}
        height={nodeHeight + (current ? 22 : 12)}
        rx={current ? 15 : 12}
        fill="none"
        stroke="var(--primary-bright)"
        strokeWidth={2}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        initial={false}
        animate={{ opacity: highlighted ? 1 : 0, scale: highlighted ? 1 : 0.96 }}
        transition={{ delay: highlighted ? 0.45 : 0, duration: 0.3, ease: easeOutExpo }}
      />
    </>
  );
}

function RouteNode({
  node,
  highlighted,
  onNodeHover,
}: { node: SpecimenNode; highlighted: boolean } & Pick<RouteSpecimenInteraction, 'onNodeHover'>) {
  const width = nodeWidth(node);
  const type = nodeTypes[node.type];
  const locked = node.status === 'locked';
  const nodeColor = locked ? 'var(--blocked)' : type.color;
  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      onPointerEnter={onNodeHover ? () => onNodeHover(node.id) : undefined}
      onPointerLeave={onNodeHover ? () => onNodeHover(null) : undefined}
    >
      <m.g
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: easeOutExpo, delay: nodeDepth(node.id) * stagger * 2 }}
      >
        <NodeOutline width={width} current={Boolean(node.current)} highlighted={highlighted} />
        <g opacity={locked ? 0.88 : 1} filter={locked ? undefined : 'url(#route-node-shadow)'}>
          <rect
            data-route-node={node.id}
            x={1}
            y={1}
            width={width - 2}
            height={nodeHeight - 2}
            rx={8}
            style={{
              fill: locked
                ? 'color-mix(in srgb, var(--blocked) 20%, var(--card))'
                : `color-mix(in srgb, ${type.color} 3%, var(--card))`,
            }}
            stroke={nodeColor}
            strokeWidth={2}
          />
        </g>
        <type.Icon x={16} y={nodeHeight / 2 - 10} size={20} color={nodeColor} aria-hidden="true" />
        <text
          x={46}
          y={nodeHeight / 2}
          dominantBaseline="central"
          fontSize={15.5}
          className="max-sm:text-[17px]"
          fontWeight={500}
          fill="var(--ink)"
        >
          {node.title}
        </text>
        <ResourceBadge node={node} width={width} />
        <StatusBadge node={node} width={width} />
        {node.note ? (
          <g transform={`translate(0 ${nodeHeight + 20})`}>
            <node.note.Icon x={0} y={-1} size={14} color="var(--graphite)" aria-hidden="true" />
            <text
              x={20}
              y={11}
              fontSize={13}
              fontWeight={600}
              fill="var(--graphite)"
              className="max-sm:text-[15px]"
            >
              {node.note.text}
            </text>
          </g>
        ) : null}
      </m.g>
    </g>
  );
}

export function RouteSpecimen({
  highlightedNodeId = null,
  onNodeHover,
  className,
  canvasClassName,
}: RouteSpecimenInteraction & { className?: string; canvasClassName?: string }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <figure aria-label="Ruta de aprendizaje de ejemplo" className={cn('w-full', className)}>
        <div
          data-route-canvas
          className={cn('overflow-hidden rounded-xl bg-card ring-1 ring-white/10', canvasClassName)}
        >
          <svg
            viewBox={`-8 -8 ${viewBox.width + 16} ${viewBox.height + 16}`}
            className="block h-auto w-full font-sans"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <pattern id="route-grid" width={20} height={20} patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--fog)" strokeWidth={1} />
              </pattern>
              <marker
                id="route-arrow"
                viewBox="-10 -10 20 20"
                markerWidth={18}
                markerHeight={18}
                markerUnits="strokeWidth"
                orient="auto-start-reverse"
              >
                <polyline
                  points="-5,-4 0,0 -5,4 -5,-4"
                  fill="var(--ink)"
                  stroke="var(--ink)"
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
              <filter id="route-node-shadow" x="-20%" y="-20%" width="140%" height="160%">
                <feDropShadow
                  dx={0}
                  dy={4}
                  stdDeviation={5}
                  floodColor="#12213a"
                  floodOpacity={0.07}
                />
              </filter>
            </defs>
            <rect x={-8} y={-8} width="100%" height="100%" fill="url(#route-grid)" />
            {dependencies.map(([sourceId, targetId]) => {
              const source = nodeById.get(sourceId)!;
              const target = nodeById.get(targetId)!;
              const transition = {
                duration: 0.5,
                ease: easeOutExpo,
                delay: (nodeDepth(sourceId) * 2 + 1) * stagger,
              };
              return (
                <m.path
                  key={`${sourceId}-${targetId}`}
                  d={stepPath(source, target)}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={transition}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={1.5}
                  markerEnd="url(#route-arrow)"
                />
              );
            })}
            {nodes.map((node) => (
              <RouteNode
                key={node.id}
                node={node}
                highlighted={node.id === highlightedNodeId}
                onNodeHover={onNodeHover}
              />
            ))}
          </svg>
        </div>
        <figcaption className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-primary-foreground">
              Curso de ejemplo · Programación · {completedCount} de {nodes.length} nodos completados
            </span>
            {nextNode ? (
              <span className="text-primary-soft">Siguiente paso: {nextNode.title}</span>
            ) : null}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
            <div
              className="h-full rounded-full bg-progress"
              style={{ width: `${(completedCount / nodes.length) * 100}%` }}
            />
          </div>
          <ol aria-label="Nodos de la ruta de ejemplo" className="sr-only">
            {nodes.map((node) => (
              <li key={node.id}>
                {node.title}: {node.description}
              </li>
            ))}
          </ol>
        </figcaption>
      </figure>
    </LazyMotion>
  );
}
