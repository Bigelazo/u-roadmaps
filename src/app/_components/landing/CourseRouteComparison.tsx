'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, Link2 } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { RouteSpecimen, type RouteSpecimenNodeId } from '@/features/roadmap';
import { cn } from 'cn';

type CourseMaterial = {
  kind: 'file' | 'link';
  title: string;
  detail: string;
  downloads?: number;
  /** El equipo docente publica a mano lo que aún no corresponde ver. */
  published: boolean;
  nodeId: RouteSpecimenNodeId;
  /** En teléfonos cada sección se resume a sus primeras filas. */
  compactHidden?: boolean;
};

type CourseSection = { title: string; materials: CourseMaterial[] };

/**
 * Cita de U-Cursos: archivos y enlaces viven en secciones distintas y se ordenan por fecha
 * y por tipo, no por cómo se estudia. Cada fila conoce el nodo de la ruta que la contiene.
 */
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
        title: 'Material complementario',
        materials: [
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
            compactHidden: true,
          },
        ],
      },
    ],
  },
];

/** Recorrido automático: el orden de la ruta, que salta por la tabla. */
const routeOrder: RouteSpecimenNodeId[] = [
  'variables',
  'conditionals',
  'exercises',
  'functions',
  'recursion',
  'quiz',
];
const tourStartMs = 1600;
const tourStepMs = 1150;
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

type Trace = { key: string; d: string; start: [number, number]; end: [number, number] };

const rowColumns = 'grid grid-cols-[1.75rem_minmax(0,1fr)_1.25rem] items-center gap-x-2 px-4';

function CourseMaterialRow({
  material,
  index,
  active,
  onMaterialHover,
}: {
  material: CourseMaterial;
  index: number;
  active: boolean;
  onMaterialHover: (nodeId: RouteSpecimenNodeId | null) => void;
}) {
  return (
    <div
      data-course-material={material.nodeId}
      data-active={active || undefined}
      onPointerEnter={() => onMaterialHover(material.nodeId)}
      onPointerLeave={() => onMaterialHover(null)}
      className={cn(
        rowColumns,
        'border-b border-[#e5e5e5] py-1.5 transition-colors duration-200 data-active:bg-primary-soft',
        material.compactHidden && 'max-sm:hidden',
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
            <Link2 className="size-3.5 shrink-0 text-[#555]" />
          )}
          <span className="truncate text-[#8a6100]">{material.title}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#6b7280]">
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
        <span className="grid size-4 place-items-center rounded-[3px] bg-[#2a7f7f] text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <span className="size-4 rounded-[3px] border border-[#999] bg-white" />
      )}
    </div>
  );
}

function CoursePageExcerpt({
  activeNodeId,
  onMaterialHover,
}: {
  activeNodeId: RouteSpecimenNodeId | null;
  onMaterialHover: (nodeId: RouteSpecimenNodeId | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {coursePages.map((page) => (
        // Hoja de otra plataforma: tipografía de sistema y colores propios, ajenos a U-Roadmaps.
        <div
          key={page.title}
          className="overflow-hidden rounded-md bg-white font-[Arial,Helvetica,sans-serif] text-[13px] text-[#333] shadow-[0_18px_50px_rgb(0_0_0/18%)]"
        >
          <p className="px-4 pt-3 pb-2 text-xl leading-none font-light text-[#444]">{page.title}</p>
          <div className={cn(rowColumns, 'border-b border-[#ddd] py-1.5 font-bold')}>
            <span>Nº</span>
            <span>{page.titleColumn}</span>
            <span className="sr-only">Publicado</span>
          </div>
          {page.sections.map((section, sectionIndex) => (
            <div key={section.title} className={cn(sectionIndex > 0 && 'max-sm:hidden')}>
              <p className="bg-[#eeeae2] px-4 py-1">{section.title}</p>
              {section.materials.map((material, index) => (
                <CourseMaterialRow
                  key={material.title}
                  material={material}
                  index={index}
                  active={material.nodeId === activeNodeId}
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

export function CourseRouteComparison({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeNodeId, setActiveNodeId] = useState<RouteSpecimenNodeId | null>(null);
  const [touring, setTouring] = useState(true);
  const [traces, setTraces] = useState<Trace[]>([]);

  // Recorre la ruta una vez al cargar; cualquier interacción toma el control.
  useEffect(() => {
    if (!touring) return;
    const timers = routeOrder.map((nodeId, step) =>
      window.setTimeout(() => setActiveNodeId(nodeId), tourStartMs + step * tourStepMs),
    );
    timers.push(
      window.setTimeout(
        () => {
          setActiveNodeId(null);
          setTouring(false);
        },
        tourStartMs + routeOrder.length * tourStepMs,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [touring]);

  const hover = useCallback((nodeId: RouteSpecimenNodeId | null) => {
    setTouring(false);
    setActiveNodeId(nodeId);
  }, []);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || !activeNodeId) return setTraces([]);
    const origin = container.getBoundingClientRect();
    const node = container
      .querySelector(`[data-route-node="${activeNodeId}"]`)
      ?.getBoundingClientRect();
    const canvas = container.querySelector('[data-route-canvas]')?.getBoundingClientRect();
    if (!node || !canvas) return setTraces([]);
    const materials = container.querySelectorAll(`[data-course-material="${activeNodeId}"]`);
    const next: Trace[] = [];
    materials.forEach((material, index) => {
      const row = material.getBoundingClientRect();
      const x1 = row.right - origin.left;
      const y1 = row.top + row.height / 2 - origin.top;
      // La traza llega al borde del lienzo a la altura del nodo; el contorno del nodo marca el destino.
      const x2 = canvas.left - origin.left;
      const y2 = node.top + node.height / 2 - origin.top;
      // Apiladas (teléfono y tableta), la ruta no queda a la derecha de la tabla: sin traza.
      if (x2 - x1 < 32 || row.height === 0) return;
      const bend = (x2 - x1) / 2;
      next.push({
        key: `${activeNodeId}-${index}`,
        d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
        start: [x1, y1],
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
    <div
      ref={containerRef}
      className={cn(
        'relative grid gap-10 lg:grid-cols-[minmax(0,17rem)_3rem_minmax(0,1fr)] lg:items-start lg:gap-0',
        className,
      )}
    >
      <p className="sr-only">
        En U-Cursos, los siete materiales de este ejemplo se reparten en dos secciones distintas,
        Material docente para los archivos y Enlaces para los enlaces, ordenados por fecha; lo que
        aún no corresponde ver queda sin publicar hasta que alguien lo publique a mano. En
        U-Roadmaps quedan dentro de los nodos de la ruta, con sus requisitos, sus fechas de
        desbloqueo y el avance de cada estudiante.
      </p>
      <div aria-hidden="true" className="order-2 lg:order-1">
        <p className="mb-4 font-heading text-lg leading-[1.15] font-semibold tracking-[-0.02em] whitespace-nowrap text-primary-foreground">
          Hoy, en U-Cursos
        </p>
        <p className="-mt-2 mb-4 text-sm leading-normal text-primary-soft lg:min-h-[2lh]">
          Archivos y enlaces en secciones separadas, ordenados por fecha.
        </p>
        <CoursePageExcerpt activeNodeId={activeNodeId} onMaterialHover={hover} />
      </div>
      <div aria-hidden="true" className="relative order-2 hidden self-stretch lg:block">
        <span className="absolute top-12 bottom-6 left-1/2 w-0.5 -translate-x-1/2 bg-primary-bright" />
      </div>
      <div className="order-1 lg:order-3">
        <p
          aria-hidden="true"
          className="mb-4 font-heading text-lg leading-[1.15] font-semibold tracking-[-0.02em] whitespace-nowrap text-primary-foreground"
        >
          Con U-Roadmaps
        </p>
        <p
          aria-hidden="true"
          className="-mt-2 mb-4 text-sm leading-normal text-primary-soft lg:min-h-[2lh]"
        >
          Cada material dentro de su nodo, en el orden en que se estudia.
        </p>
        <RouteSpecimen
          className="max-w-[27rem]"
          canvasClassName="max-sm:-mx-6 max-sm:rounded-none"
          highlightedNodeId={activeNodeId}
          onNodeHover={hover}
        />
      </div>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
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
  );
}
