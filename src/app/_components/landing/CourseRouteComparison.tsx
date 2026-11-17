'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, Link2 } from 'lucide-react';
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  useMotionValueEvent,
  useScroll,
} from 'motion/react';
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
  compactHidden?: boolean;
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
            title: 'Clase 02 - Condicionales.pdf',
            detail: '96 kb',
            downloads: 164,
            published: true,
            nodeId: 'conditionals',
            compactHidden: true,
          },
          {
            kind: 'file',
            title: 'Clase 01 - Variables.pdf',
            detail: '120 kb',
            downloads: 201,
            published: true,
            nodeId: 'variables',
            compactHidden: true,
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
            compactHidden: true,
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
            compactHidden: true,
          },
          {
            kind: 'link',
            title: 'Auxiliar 1 - Variables',
            detail: 'https://…/auxiliar-1',
            published: true,
            nodeId: 'variables',
            compactHidden: true,
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
            title: 'Visualizador de llamadas',
            detail: 'https://…/visualizador',
            published: true,
            nodeId: 'functions',
            compactHidden: true,
          },
          {
            kind: 'link',
            title: 'Ejercicios resueltos',
            detail: 'https://…/ejercicios',
            published: true,
            nodeId: 'exercises',
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
const leadInSteps = 1;
const scrollSteps = routeOrder.length + leadInSteps + 1;
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

type Trace = { key: string; d: string; start: [number, number]; end: [number, number] };

const rowColumns = 'grid grid-cols-[1.75rem_minmax(0,1fr)_1.25rem] items-center gap-x-2 px-4';
const columnTitle =
  'font-heading text-xl leading-[1.15] font-semibold tracking-[-0.02em] text-brand-surface-foreground';
const columnLead = 'mt-1 mb-4 text-sm leading-normal text-brand-surface-muted short:hidden';

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
    <div
      data-course-material={material.nodeId}
      data-active={active || undefined}
      data-placed={placed || undefined}
      onPointerEnter={() => onMaterialHover(material.nodeId)}
      onPointerLeave={() => onMaterialHover(null)}
      className={cn(
        rowColumns,
        'border-b border-[#e5e5e5] py-1.5 transition-[background-color,opacity] duration-300 data-placed:opacity-45 dark:border-[#333] data-active:bg-[#c9e0fc] dark:data-active:bg-[#1a3448]',
        material.compactHidden && 'max-sm:hidden lg:max-xl:hidden short:hidden',
      )}
    >
      <span className="tabular-nums">{index + 1}</span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          {material.kind === 'file' ? (
            <span className="rounded-[2px] bg-[#c62828] px-[3px] text-[9px] leading-[13px] font-bold text-white">
              PDF
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
        <span className="grid size-4 place-items-center rounded-[3px] bg-[#2a7f7f] text-white dark:bg-[#3d7ab5]">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <span className="size-4 rounded-[3px] border border-[#999] bg-white dark:border-[#666] dark:bg-[#3a3a3a]" />
      )}
    </div>
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
    <div className="grid items-start gap-3 sm:max-lg:grid-cols-2 xl:grid-cols-2">
      {coursePages.map((page) => (
        <div
          key={page.title}
          className="overflow-hidden rounded-md bg-white font-[Arial,Helvetica,sans-serif] text-[13px] text-[#333] shadow-[0_18px_50px_rgb(0_0_0/18%)] dark:bg-[#1f1f1f] dark:text-[#e6e6e6]"
        >
          <p className="px-4 pt-3 pb-2 text-xl leading-none font-light text-[#444] dark:text-[#ddd]">
            {page.title}
          </p>
          <div
            className={cn(rowColumns, 'border-b border-[#ddd] py-1.5 font-bold dark:border-[#333]')}
          >
            <span>Nº</span>
            <span>{page.titleColumn}</span>
            <span className="sr-only">Publicado</span>
          </div>
          {page.sections.map((section, sectionIndex) => (
            <div
              key={section.title}
              className={cn(
                sectionIndex > 0 &&
                  page.title !== 'Enlaces' &&
                  'max-sm:hidden lg:max-xl:hidden short:hidden',
              )}
            >
              <p className="bg-[#eeeae2] px-4 py-1 dark:bg-[#151515]">{section.title}</p>
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
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(-1);
  const [hoveredNodeId, setHoveredNodeId] = useState<RouteSpecimenNodeId | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    setHoveredNodeId(null);
    setStep(Math.min(scrollSteps - 1, Math.floor(progress * scrollSteps)) - leadInSteps);
  });

  const activeNodeId = hoveredNodeId ?? routeOrder[step] ?? null;
  const placedNodeIds = routeOrder.slice(0, Math.max(0, step));

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || !activeNodeId) return setTraces([]);
    const origin = container.getBoundingClientRect();
    const node = container
      .querySelector(`[data-route-node="${activeNodeId}"]`)
      ?.getBoundingClientRect();
    const canvas = container.querySelector('[data-route-canvas]')?.getBoundingClientRect();
    if (!node || !canvas) return setTraces([]);
    const besideAnotherNode = [...container.querySelectorAll('[data-route-node]')].some((other) => {
      const rect = other.getBoundingClientRect();
      return rect.right < node.left && rect.top < node.bottom && rect.bottom > node.top;
    });
    const entryX = canvas.left - origin.left;
    const materials = container.querySelectorAll(`[data-course-material="${activeNodeId}"]`);
    const next: Trace[] = [];
    materials.forEach((material, index) => {
      const row = material.getBoundingClientRect();
      const x1 = row.right - origin.left;
      const y1 = row.top + row.height / 2 - origin.top;
      if (entryX - x1 < 32 || row.height === 0) return;
      const key = `${activeNodeId}-${index}`;
      const start: [number, number] = [x1, y1];
      if (besideAnotherNode) {
        const x2 = node.left + 18 - origin.left;
        const y2 = node.top - origin.top;
        const channelY = y2 - 16;
        const bend = (entryX - x1) / 2;
        next.push({
          key,
          d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${entryX - bend} ${channelY}, ${entryX} ${channelY} L ${x2 - 10} ${channelY} Q ${x2} ${channelY} ${x2} ${y2}`,
          start,
          end: [x2, y2],
        });
        return;
      }
      const x2 = node.left - origin.left;
      const y2 = node.top + node.height / 2 - origin.top;
      const bend = (x2 - x1) / 2;
      next.push({
        key,
        d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
        start,
        end: [x2, y2],
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
    <section ref={sectionRef} aria-labelledby="comparison-title" className="stage:h-[300vh]">
      <div className="mx-auto flex max-w-360 flex-col justify-center px-4 pt-14 pb-16 sm:px-6 lg:px-12 stage:sticky stage:top-16 stage:h-[calc(100dvh-4rem)] stage:pb-6">
        <h2
          id="comparison-title"
          className="font-heading text-[1.75rem] leading-[1.08] font-semibold tracking-[-0.03em] text-brand-surface-foreground md:text-[2.5rem] md:leading-none short:text-[1.75rem]"
        >
          Del listado al mapa
        </h2>
        <p className="sr-only">
          En U-Cursos, los once materiales de este ejemplo se reparten en dos secciones distintas,
          Material docente para los archivos y Enlaces para los enlaces, ordenados por fecha; lo que
          aún no corresponde ver queda sin publicar hasta que alguien lo publique a mano. En
          U-Roadmaps quedan dentro de los nodos de la ruta, con sus requisitos, sus fechas de
          desbloqueo y el avance de cada estudiante.
        </p>
        <div
          ref={containerRef}
          className="relative mt-8 grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(4rem,1fr)_auto] lg:items-start lg:gap-0 xl:grid-cols-[minmax(0,38rem)_minmax(4rem,1fr)_auto] short:mt-5"
        >
          <div aria-hidden="true" className="relative z-20">
            <h3 className={columnTitle}>Hoy, en U-Cursos</h3>
            <p className={columnLead}>
              Archivos en una sección, enlaces en otra, todo ordenado por fecha.
            </p>
            <div className="short:mt-3">
              <CoursePageExcerpt
                activeNodeId={activeNodeId}
                placedNodeIds={placedNodeIds}
                onMaterialHover={setHoveredNodeId}
              />
            </div>
          </div>
          <div aria-hidden="true" className="hidden lg:block" />
          <div className="lg:w-[min(27rem,calc((100dvh-20rem)*0.85))]">
            <h3 aria-hidden="true" className={columnTitle}>
              Con U-Roadmaps
            </h3>
            <p aria-hidden="true" className={columnLead}>
              Cada material dentro de su nodo, en el orden en que se estudia.
            </p>
            <RouteSpecimen
              className="max-w-[27rem] short:mt-3"
              canvasClassName="max-sm:-mx-4 max-sm:rounded-none"
              highlightedNodeId={activeNodeId}
              onNodeHover={setHoveredNodeId}
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
                      transition={{ duration: 0.55, ease: easeOutExpo }}
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
                      transition={{ delay: 0.45, duration: 0.3, ease: easeOutExpo }}
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
