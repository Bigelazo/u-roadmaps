'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, Link2 } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion, useInView } from 'motion/react';
import * as m from 'motion/react-m';
import { RouteSpecimen, type RouteSpecimenNodeId } from '@/features/roadmap';
import { cn } from 'cn';

type CourseMaterial = {
  kind: 'file' | 'link';
  title: string;
  detail: string;
  downloads?: number;
  published: boolean;
  nodeId: RouteSpecimenNodeId;
};

type CourseSection = { title: string; materials: CourseMaterial[] };

const coursePages: { title: string; titleColumn: string; sections: CourseSection[] }[] = [
  {
    title: 'Material docente',
    titleColumn: 'Título',
    sections: [
      {
        title: 'Clases',
        materials: [
          {
            kind: 'file',
            title: 'Clase 04 - Recursión.pdf',
            detail: '142 kb',
            downloads: 0,
            published: false,
            nodeId: 'recursion',
          },
          {
            kind: 'file',
            title: 'Clase 03 - Funciones.pdf',
            detail: '210 kb',
            downloads: 131,
            published: true,
            nodeId: 'functions',
          },
          {
            kind: 'file',
            title: 'Clase 02 - Condicionales.xlsx',
            detail: '48 kb',
            downloads: 164,
            published: true,
            nodeId: 'conditionals',
          },
          {
            kind: 'file',
            title: 'Clase 01 - Variables.zip',
            detail: '1,2 mb',
            downloads: 201,
            published: true,
            nodeId: 'variables',
          },
        ],
      },
      {
        title: 'Evaluaciones',
        materials: [
          {
            kind: 'file',
            title: 'Control 1 - Enunciado.pdf',
            detail: '58 kb',
            downloads: 0,
            published: false,
            nodeId: 'quiz',
          },
          {
            kind: 'file',
            title: 'Control 1 - Instrucciones.md',
            detail: '4 kb',
            downloads: 0,
            published: false,
            nodeId: 'quiz',
          },
        ],
      },
    ],
  },
  {
    title: 'Enlaces',
    titleColumn: 'Enlace',
    sections: [
      {
        title: 'Auxiliares',
        materials: [
          {
            kind: 'link',
            title: 'Auxiliar 3 - Funciones',
            detail: 'https://…/auxiliar-3',
            published: true,
            nodeId: 'functions',
          },
          {
            kind: 'link',
            title: 'Auxiliar 2 - Condicionales',
            detail: 'https://…/auxiliar-2',
            published: true,
            nodeId: 'conditionals',
          },
          {
            kind: 'link',
            title: 'Auxiliar 1 - Variables',
            detail: 'https://…/auxiliar-1',
            published: true,
            nodeId: 'variables',
          },
        ],
      },
      {
        title: 'Material complementario',
        materials: [
          {
            kind: 'link',
            title: 'Video - Recursión paso a paso',
            detail: 'https://…/video-recursion',
            published: true,
            nodeId: 'recursion',
          },
          {
            kind: 'link',
            title: 'Ejercicios resueltos',
            detail: 'https://…/ejercicios',
            published: true,
            nodeId: 'exercises',
          },
          {
            kind: 'link',
            title: 'Visualizador de llamadas',
            detail: 'https://…/visualizador',
            published: true,
            nodeId: 'functions',
          },
        ],
      },
    ],
  },
];

const routeOrder: RouteSpecimenNodeId[] = [
  'variables',
  'conditionals',
  'exercises',
  'functions',
  'recursion',
  'quiz',
];
const nodeTitles: Record<RouteSpecimenNodeId, string> = {
  variables: 'Variables',
  conditionals: 'Condicionales',
  exercises: 'Ejercicios',
  functions: 'Funciones',
  recursion: 'Recursión',
  quiz: 'Control 1',
};
const stepDuration = 2000;

const fileBadges = {
  pdf: { label: 'PDF', className: 'bg-[#c62828]' },
  xlsx: { label: 'XLS', className: 'bg-[#1d6f42]' },
  zip: { label: 'ZIP', className: 'bg-[#6d4c41]' },
  md: { label: 'MD', className: 'bg-[#37474f]' },
} as const;

function fileBadge(title: string) {
  const extension = title.slice(title.lastIndexOf('.') + 1) as keyof typeof fileBadges;
  return fileBadges[extension];
}
const traceRadius = 8;
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export type Point = [number, number];
type Trace = { key: string; d: string; start: Point; end: Point };

const rowColumns = 'grid grid-cols-[1.75rem_minmax(0,1fr)_1.25rem] items-center gap-x-2 px-4';
const columnTitle =
  'font-heading text-xl leading-[1.15] font-semibold tracking-[-0.02em] text-brand-surface-foreground';
const columnLead = 'mt-1 mb-6 text-sm leading-normal text-brand-surface-muted';

function toward([x, y]: Point, [tx, ty]: Point, distance: number) {
  const length = Math.hypot(tx - x, ty - y);
  return `${x + ((tx - x) / length) * distance} ${y + ((ty - y) / length) * distance}`;
}

export function roundedPath(points: Point[]) {
  const corners = points.filter(
    (point, index) =>
      index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1],
  );
  const segments = [`M ${corners[0][0]} ${corners[0][1]}`];
  for (let index = 1; index < corners.length - 1; index++) {
    const [previous, corner, next] = [corners[index - 1], corners[index], corners[index + 1]];
    const radius = Math.min(
      traceRadius,
      Math.hypot(corner[0] - previous[0], corner[1] - previous[1]) / 2,
      Math.hypot(next[0] - corner[0], next[1] - corner[1]) / 2,
    );
    segments.push(
      `L ${toward(corner, previous, radius)}`,
      `Q ${corner[0]} ${corner[1]} ${toward(corner, next, radius)}`,
    );
  }
  const end = corners[corners.length - 1];
  segments.push(`L ${end[0]} ${end[1]}`);
  return segments.join(' ');
}

function CourseMaterialRow({
  material,
  index,
  active,
  placed,
  onMaterialHover,
}: {
  material: CourseMaterial;
  index: number;
  active: boolean;
  placed: boolean;
  onMaterialHover: (nodeId: RouteSpecimenNodeId | null) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${material.title}: en U-Roadmaps está en el nodo ${nodeTitles[material.nodeId]}`}
      data-course-material={material.nodeId}
      data-active={active || undefined}
      data-placed={placed || undefined}
      onPointerEnter={() => onMaterialHover(material.nodeId)}
      onPointerLeave={() => onMaterialHover(null)}
      onFocus={() => onMaterialHover(material.nodeId)}
      onBlur={() => onMaterialHover(null)}
      onClick={() => onMaterialHover(material.nodeId)}
      className={cn(
        rowColumns,
        'w-full cursor-default border-b border-[#e5e5e5] py-1.5 text-left transition-[background-color,opacity] duration-300 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[#296ef9] focus-visible:ring-inset data-placed:opacity-45 dark:border-[#333] data-active:bg-[#c9e0fc] dark:data-active:bg-[#1a3448]',
      )}
    >
      <span aria-hidden="true" className="tabular-nums">
        {index + 1}
      </span>
      <span aria-hidden="true" className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          {material.kind === 'file' ? (
            <span
              className={cn(
                'rounded-[2px] px-[3px] text-[9px] leading-[13px] font-bold text-white',
                fileBadge(material.title).className,
              )}
            >
              {fileBadge(material.title).label}
            </span>
          ) : (
            <Link2 className="size-3.5 shrink-0 text-[#555] dark:text-[#bbb]" />
          )}
          <span className="truncate text-[#8a6100] dark:text-[#6ea8e6]">{material.title}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#6b7280] dark:text-[#9a9a9a]">
          {material.detail}
          {material.downloads !== undefined ? (
            <>
              <Download className="size-3" />
              <span className="tabular-nums">{material.downloads}</span>
            </>
          ) : null}
        </span>
      </span>
      {material.published ? (
        <span
          aria-hidden="true"
          className="grid size-4 place-items-center rounded-[3px] bg-[#2a7f7f] text-white dark:bg-[#3d7ab5]"
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="size-4 rounded-[3px] border border-[#999] bg-white dark:border-[#666] dark:bg-[#3a3a3a]"
        />
      )}
    </button>
  );
}

function CoursePageExcerpt({
  activeNodeId,
  placedNodeIds,
  onMaterialHover,
}: {
  activeNodeId: RouteSpecimenNodeId | null;
  placedNodeIds: RouteSpecimenNodeId[];
  onMaterialHover: (nodeId: RouteSpecimenNodeId | null) => void;
}) {
  return (
    <div className="grid items-start gap-3 max-lg:max-w-xl xl:grid-cols-2 xl:gap-6">
      {coursePages.map((page, pageIndex) => (
        <div
          key={page.title}
          data-course-sheet
          className={cn(
            'overflow-hidden rounded-md bg-white font-[Arial,Helvetica,sans-serif] text-[13px] text-[#333] shadow-[0_18px_50px_rgb(0_0_0/18%)] dark:bg-[#1f1f1f] dark:text-[#e6e6e6]',
            pageIndex > 0 && 'max-lg:hidden',
          )}
        >
          <p
            aria-hidden="true"
            className="px-4 pt-3 pb-2 text-xl leading-none font-light text-[#444] dark:text-[#ddd]"
          >
            {page.title}
          </p>
          <div
            aria-hidden="true"
            className={cn(rowColumns, 'border-b border-[#ddd] py-1.5 font-bold dark:border-[#333]')}
          >
            <span>Nº</span>
            <span>{page.titleColumn}</span>
          </div>
          {page.sections.map((section) => (
            <div key={section.title}>
              <p aria-hidden="true" className="bg-[#eeeae2] px-4 py-1 dark:bg-[#151515]">
                {section.title}
              </p>
              {section.materials.map((material, index) => (
                <CourseMaterialRow
                  key={material.title}
                  material={material}
                  index={index}
                  active={material.nodeId === activeNodeId}
                  placed={
                    material.nodeId !== activeNodeId && placedNodeIds.includes(material.nodeId)
                  }
                  onMaterialHover={onMaterialHover}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CourseRouteComparison() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.4 });
  const [step, setStep] = useState(-1);
  const [hoveredNodeId, setHoveredNodeId] = useState<RouteSpecimenNodeId | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [linked, setLinked] = useState(true);

  useEffect(() => {
    if (inView) setStep((current) => Math.max(current, 0));
  }, [inView]);

  useEffect(() => {
    if (step < 0 || step >= routeOrder.length) return;
    const timer = setTimeout(() => setStep(step + 1), stepDuration);
    return () => clearTimeout(timer);
  }, [step]);

  const activeNodeId = hoveredNodeId ?? routeOrder[step] ?? null;
  const placedNodeIds = routeOrder.slice(0, Math.max(0, step));

  const measure = useCallback(() => {
    const container = containerRef.current;
    const canvas = container?.querySelector('[data-route-canvas]')?.getBoundingClientRect();
    if (!container || !canvas) return setTraces([]);
    const origin = container.getBoundingClientRect();
    const sheets = [...container.querySelectorAll('[data-course-sheet]')]
      .map((sheet) => sheet.getBoundingClientRect())
      .filter((sheet) => sheet.width > 0);
    const sheetsRight = Math.max(...sheets.map((sheet) => sheet.right)) - origin.left;
    const sheetsTop = Math.min(...sheets.map((sheet) => sheet.top)) - origin.top;
    const entryX = canvas.left - origin.left;
    const fits = entryX - sheetsRight >= 32;
    setLinked(fits);
    const node = container
      .querySelector(`[data-route-node="${activeNodeId}"]`)
      ?.getBoundingClientRect();
    if (!fits || !node) return setTraces([]);
    const besideAnotherNode = [...container.querySelectorAll('[data-route-node]')].some((other) => {
      const rect = other.getBoundingClientRect();
      return rect.right < node.left && rect.top < node.bottom && rect.bottom > node.top;
    });
    const busX = (sheetsRight + entryX) / 2;
    const ending: Point[] = besideAnotherNode
      ? [
          [busX, node.top - origin.top - 16],
          [node.left + 18 - origin.left, node.top - origin.top - 16],
          [node.left + 18 - origin.left, node.top - origin.top],
        ]
      : [
          [busX, node.top + node.height / 2 - origin.top],
          [node.left - origin.left, node.top + node.height / 2 - origin.top],
        ];
    const materials = container.querySelectorAll(`[data-course-material="${activeNodeId}"]`);
    const next: Trace[] = [];
    materials.forEach((material, index) => {
      const row = material.getBoundingClientRect();
      const sheet = material.closest('[data-course-sheet]')?.getBoundingClientRect();
      if (!sheet || row.height === 0) return;
      const start: Point = [row.right - origin.left, row.top + row.height / 2 - origin.top];
      const blocker = sheets.find(
        (other) =>
          other.left >= sheet.right && other.top < sheet.bottom && other.bottom > sheet.top,
      );
      const gapX = blocker ? (sheet.right + blocker.left) / 2 - origin.left : null;
      const departure: Point[] =
        gapX === null
          ? [[busX, start[1]]]
          : [
              [gapX, start[1]],
              [gapX, sheetsTop - 12],
              [busX, sheetsTop - 12],
            ];
      const points = [start, ...departure, ...ending];
      next.push({
        key: `${activeNodeId}-${index}`,
        d: roundedPath(points),
        start,
        end: points[points.length - 1],
      });
    });
    setTraces(next);
  }, [activeNodeId]);

  useEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <section aria-labelledby="comparison-title">
      <div className="mx-auto max-w-360 px-4 pt-14 pb-16 sm:px-6 lg:px-12">
        <span data-route-anchor="in" aria-hidden="true" className="mb-4 ml-4 block size-0" />
        <h2
          id="comparison-title"
          className="font-heading text-[1.75rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-brand-surface-foreground md:text-[2.5rem] md:leading-none"
        >
          Del listado al mapa
        </h2>
        <p className="sr-only">
          En U-Cursos, los doce materiales de este ejemplo se reparten en dos secciones distintas,
          Material docente para los archivos y Enlaces para los enlaces, ordenados por fecha; lo que
          aún no corresponde ver queda sin publicar hasta que alguien lo publique a mano. En
          U-Roadmaps quedan dentro de los nodos de la ruta, con sus requisitos, sus fechas de
          desbloqueo y el avance de cada estudiante.
        </p>
        <div
          ref={containerRef}
          className="relative mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_6rem_27rem] lg:items-start lg:gap-0"
        >
          <div className="relative z-20">
            <h3 aria-hidden="true" className={columnTitle}>
              Hoy, en U-Cursos
            </h3>
            <p aria-hidden="true" className={columnLead}>
              Archivos en una sección, enlaces en otra, todo ordenado por fecha.
            </p>
            <CoursePageExcerpt
              activeNodeId={activeNodeId}
              placedNodeIds={placedNodeIds}
              onMaterialHover={setHoveredNodeId}
            />
          </div>
          <div aria-hidden="true" className="hidden lg:block" />
          <div>
            <h3 aria-hidden="true" className={columnTitle}>
              Con U-Roadmaps
            </h3>
            <p aria-hidden="true" className={columnLead}>
              Cada material dentro de su nodo, en el orden en que se estudia.
            </p>
            <RouteSpecimen
              className="max-w-[27rem]"
              canvasClassName="max-sm:-mx-4 max-sm:rounded-none"
              highlightedNodeId={activeNodeId}
              highlightDelay={linked ? 0.45 : 0}
              onNodeHover={setHoveredNodeId}
            />
            <span
              data-route-anchor="out"
              aria-hidden="true"
              className="mx-auto mt-8 block size-0"
            />
          </div>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
          >
            <LazyMotion features={domAnimation} strict>
              <AnimatePresence>
                {traces.map((trace) => (
                  <m.g
                    key={trace.key}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.25 } }}
                  >
                    <m.path
                      d={trace.d}
                      fill="none"
                      stroke="var(--primary-bright)"
                      strokeWidth={1.5}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.1, ease: easeOutExpo }}
                    />
                    <circle
                      cx={trace.start[0]}
                      cy={trace.start[1]}
                      r={3}
                      fill="var(--primary-bright)"
                    />
                    <m.circle
                      cx={trace.end[0]}
                      cy={trace.end[1]}
                      r={3.5}
                      fill="var(--primary-bright)"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.95, duration: 0.3, ease: easeOutExpo }}
                    />
                  </m.g>
                ))}
              </AnimatePresence>
            </LazyMotion>
          </svg>
        </div>
      </div>
    </section>
  );
}
