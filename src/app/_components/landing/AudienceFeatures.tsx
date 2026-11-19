'use client';

import { type CSSProperties, type RefObject, useEffect, useRef, useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import {
  ArrowUpRight,
  Bell,
  CircleCheckBig,
  CircleEllipsis,
  GraduationCap,
  History,
  LibraryBig,
  LockKeyhole,
  type LucideIcon,
  Network,
  Presentation,
  Route,
  UserGroup,
} from 'lucide-react';
import { domAnimation, LazyMotion, useInView, useScroll, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { nodeTypePaint } from '@/shared/node-type';
import { buttonVariants } from '@/shared/ui/button-variants';
import { extensionStores } from '@/shared/u-cursos-extension';
import { cn } from 'cn';
import { FeatureClip } from './FeatureClip';
import { RevealStatement } from './RevealStatement';

type Feature = {
  title: string;
  Icon: LucideIcon;
  description: string;
  clip: string;
  clipLabel: string;
};

type Audience = {
  label: string;
  Icon: LucideIcon;
  features: Feature[];
  highlight?: Feature;
  extension: { title: string; description: string };
};

const audiences = {
  teaching: {
    label: 'Para equipos docentes',
    Icon: Presentation,
    features: [
      {
        title: 'Diseña rutas',
        Icon: Route,
        description:
          'Crea [nodos temáticos], agrégales [contenidos], muéstralos, [conéctalos] o [bloquéalos] según tu planificación o el programa del curso.',
        clip: 'teacher-design',
        clipLabel:
          'Demostración: el equipo docente crea el nodo «Integrales definidas», lo conecta como dependiente de otro y lo bloquea.',
      },
      {
        title: 'Notifica a tus estudiantes',
        Icon: Bell,
        description:
          'Cada [modificación significativa] que realizas [avisa oportunamente] al estudiantado para que se mantenga al día.',
        clip: 'student-notices',
        clipLabel:
          'Demostración: un estudiante recibe el aviso de un nodo nuevo y ve el resumen de cambios al entrar al roadmap.',
      },
      {
        title: 'Sigue el avance de tu curso',
        Icon: UserGroup,
        description:
          'Revisa los [porcentajes de avance] del roadmap en el [listado de integrantes] del curso.',
        clip: 'teacher-progress',
        clipLabel:
          'Demostración: página de integrantes con el avance promedio del curso y el porcentaje de cada estudiante.',
      },
    ],
    highlight: {
      title: 'Historial de versiones',
      Icon: History,
      description:
        'Al finalizar cada semestre queda un [registro histórico] de los roadmaps de tus cursos, para que los [reutilices] en los próximos.',
      clip: 'teacher-versions',
      clipLabel:
        'Demostración: historial de versiones de un curso, con sus semestres anteriores, y apertura de una versión cerrada de solo lectura.',
    },
    extension: {
      title: 'Pruébalo en U-Cursos',
      description:
        'Descarga ya la [extensión], disponible para [Chrome y Firefox], y visualiza tus roadmaps a través de [U-Cursos].',
    },
  },
  students: {
    label: 'Para estudiantes',
    Icon: GraduationCap,
    features: [
      {
        title: 'Navega rutas didácticas',
        Icon: Route,
        description:
          'Explora el [material] y los [contenidos] de tus cursos de manera [novedosa y esquemática].',
        clip: 'student-navigate',
        clipLabel:
          'Demostración: un estudiante recorre el roadmap y abre un nodo con su descripción y cuatro recursos.',
      },
      {
        title: 'Registra tu avance',
        Icon: CircleCheckBig,
        description:
          '[Completa nodos] en el roadmap y visualiza [tu progreso] a lo largo del semestre.',
        clip: 'student-progress',
        clipLabel:
          'Demostración: un estudiante abre un nodo, lo completa y ve su avance en el resumen académico.',
      },
      {
        title: 'Entérate de los cambios',
        Icon: Bell,
        description:
          'Recibe [notificaciones] cuando hay [cambios significativos] en tus roadmaps y mantente conectado.',
        clip: 'student-notices',
        clipLabel:
          'Demostración: un estudiante abre sus notificaciones y, al entrar al roadmap, ve el resumen de cambios desde su última visita.',
      },
    ],
    extension: {
      title: '¿Muy latero usar 2 plataformas para lo mismo?',
      description:
        '¡Descárgate ya la [extensión] para [Chrome y Firefox] y utiliza U-Roadmaps [dentro de U-Cursos]!',
    },
  },
} satisfies Record<string, Audience>;

type AudienceId = keyof typeof audiences;
const audienceIds = Object.keys(audiences) as AudienceId[];

const landingStores = [
  { ...extensionStores.chrome, variant: 'default' },
  { ...extensionStores.firefox, variant: 'outline' },
] as const;

const contentColor = '#024AD8';
const extraMaterialColor = '#0F4C81';
const container = 'mx-auto w-full max-w-360 px-4 sm:px-6 lg:px-12';
const displayTitle =
  'font-heading text-[1.75rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance md:text-[2.5rem] md:leading-none md:tracking-[-0.04em]';

type StopStatus = 'completed' | 'available' | 'locked';

const statusMarks = {
  completed: { Icon: CircleCheckBig, color: 'var(--progress-deep)' },
  available: { Icon: CircleEllipsis, color: 'var(--ink)' },
  locked: { Icon: LockKeyhole, color: 'var(--graphite)' },
} as const;

function RouteNode({
  title,
  Icon,
  color,
  status,
  className,
}: {
  title: string;
  Icon: LucideIcon;
  color: string;
  status: StopStatus;
  className?: string;
}) {
  const locked = status === 'locked';
  const paint = locked ? 'var(--blocked)' : nodeTypePaint(color);
  const mark = statusMarks[status];
  const surface: CSSProperties = {
    borderColor: paint,
    backgroundColor: `color-mix(in srgb, ${paint} ${locked ? 20 : 3}%, var(--card))`,
  };

  return (
    <span
      data-status={status}
      style={surface}
      className={cn(
        'relative inline-flex min-h-14 items-center gap-3 rounded-lg border-2 py-2 pr-9 pl-4 text-left font-sans text-lg leading-tight font-medium tracking-normal text-ink shadow-[0_4px_10px_rgb(18_33_58/7%)] transition-[background-color,border-color] duration-500 sm:text-xl',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" style={{ color: paint }} />
      {title}
      <span className="absolute -right-3 -bottom-3 grid size-7.5 place-items-center rounded-full border border-fog bg-card">
        <mark.Icon aria-hidden="true" className="size-5" style={{ color: mark.color }} />
      </span>
    </span>
  );
}

function useStop(
  ref: RefObject<HTMLElement | null>,
  index: number,
  onReach: (index: number) => void,
) {
  const crossingCenter = useInView(ref, { margin: '-50% 0px -50% 0px' });

  useEffect(() => {
    if (crossingCenter) onReach(index);
  }, [crossingCenter, index, onReach]);
}

type StopProps = {
  feature: Feature;
  index: number;
  status: StopStatus;
  onReach: (index: number) => void;
};

function FeatureStop({ feature, index, status, onReach }: StopProps) {
  const ref = useRef<HTMLLIElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: edgeRef, offset: ['start 0.5', 'end 0.5'] });
  useStop(ref, index, onReach);

  return (
    <li ref={ref} className="flex flex-col lg:min-h-[64vh]">
      <h3>
        <RouteNode title={feature.title} Icon={feature.Icon} color={contentColor} status={status} />
      </h3>
      <div ref={edgeRef} className="relative ml-7 flex-1 pt-7 pb-14 pl-7">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[1.5px] bg-steel" />
        <m.span
          aria-hidden="true"
          style={{ scaleY: scrollYProgress }}
          className="absolute inset-y-0 left-0 w-[1.5px] origin-top bg-ink"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 10 8"
          data-drawn={status === 'completed' || undefined}
          className="absolute bottom-0 -left-[4.25px] w-2.5 fill-steel transition-colors duration-300 data-drawn:fill-ink"
        >
          <polygon points="0,0 10,0 5,8" />
        </svg>
        <RevealStatement text={feature.description} size="feature" />
        <FeatureClip slug={feature.clip} label={feature.clipLabel} className="mt-6 lg:hidden" />
      </div>
    </li>
  );
}

function HighlightedStop({ feature, index, onReach }: Omit<StopProps, 'status'>) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 1', 'start 0.4'] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [56, 0]);
  useStop(ref, index, onReach);

  return (
    <m.article
      ref={ref}
      style={{ scale, y }}
      className="grid items-center gap-10 rounded-xl bg-brand-surface p-6 text-brand-surface-foreground sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:p-14"
    >
      <div>
        <feature.Icon
          aria-hidden="true"
          className="size-12 text-brand-surface-muted"
          strokeWidth={1.5}
        />
        <h3 className="mt-6 font-heading text-[2.5rem] leading-none font-semibold tracking-[-0.04em] text-balance sm:text-6xl xl:text-7xl xl:leading-[0.98]">
          {feature.title}
        </h3>
        <RevealStatement
          text={feature.description}
          size="support"
          className="mt-6 text-brand-surface-foreground"
          keywordClassName="text-brand-surface-muted"
        />
      </div>
      <FeatureClip
        slug={feature.clip}
        label={feature.clipLabel}
        className="border-transparent bg-brand-surface-foreground/10 shadow-none ring-1 ring-white/10"
      />
    </m.article>
  );
}

function AudienceRoute({ audienceId }: { audienceId: AudienceId }) {
  const audience: Audience = audiences[audienceId];
  const stops = audience.highlight ? [...audience.features, audience.highlight] : audience.features;
  const extensionIndex = stops.length;
  const extensionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [furthest, setFurthest] = useState(0);

  const reach = (index: number) => {
    setActive(index);
    setFurthest((previous) => Math.max(previous, index));
  };
  const reachRef = useRef(reach);
  const onReach = reachRef.current;
  useStop(extensionRef, extensionIndex, onReach);

  const statusOf = (index: number): StopStatus =>
    index === active ? 'available' : index <= furthest ? 'completed' : 'locked';

  return (
    <m.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={cn(container, 'pb-24 md:pb-32')}>
        <div className="grid gap-x-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ol>
            {audience.features.map((feature, index) => (
              <FeatureStop
                key={feature.clip}
                feature={feature}
                index={index}
                status={statusOf(index)}
                onReach={onReach}
              />
            ))}
          </ol>
          <div className="max-lg:hidden">
            <div className="sticky top-32 aspect-16/10">
              {audience.features.map((feature, index) => {
                const shown = index === Math.min(active, audience.features.length - 1);
                return (
                  <div
                    key={feature.clip}
                    data-active={shown || undefined}
                    inert={!shown}
                    className="absolute inset-0 scale-[0.97] opacity-0 transition-[opacity,scale] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] data-active:scale-100 data-active:opacity-100"
                  >
                    <FeatureClip slug={feature.clip} label={feature.clipLabel} active={shown} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {audience.highlight ? (
          <HighlightedStop
            feature={audience.highlight}
            index={audience.features.length}
            onReach={onReach}
          />
        ) : null}
      </div>

      <section
        ref={extensionRef}
        aria-labelledby="extension-title"
        className="border-t border-fog bg-card"
      >
        <div
          className={cn(
            container,
            'grid items-center gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16',
          )}
        >
          <div>
            <RouteNode
              title="Extensión para U-Cursos"
              Icon={LibraryBig}
              color={extraMaterialColor}
              status={statusOf(extensionIndex)}
            />
            <h2 id="extension-title" className={cn(displayTitle, 'mt-8')}>
              {audience.extension.title}
            </h2>
            <RevealStatement
              text={audience.extension.description}
              size="support"
              className="mt-5"
            />
            <div className="mt-8 flex flex-wrap gap-3">
              {landingStores.map((store) => (
                <a
                  key={store.name}
                  href={store.href}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: store.variant, size: 'lg' })}
                >
                  Instalar en {store.name}
                  <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  <ArrowUpRight aria-hidden="true" data-icon="inline-end" />
                </a>
              ))}
            </div>
          </div>
          <FeatureClip
            slug="extension"
            label="Demostración: la vista integrada del roadmap que la extensión muestra dentro de U-Cursos, con un nodo abierto."
          />
        </div>
      </section>
    </m.div>
  );
}

export function AudienceFeatures() {
  const [audienceId, setAudienceId] = useState<AudienceId>('teaching');
  const anchorRef = useRef<HTMLDivElement>(null);

  const chooseAudience = (next: AudienceId) => {
    setAudienceId(next);
    requestAnimationFrame(() => {
      const anchor = anchorRef.current;
      if (anchor && anchor.getBoundingClientRect().top < 0) anchor.scrollIntoView();
    });
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <Tabs.Root value={audienceId} onValueChange={(value) => chooseAudience(value as AudienceId)}>
        <section aria-labelledby="audience-title" className={cn(container, 'pt-24 pb-10 md:pt-32')}>
          <h2 id="audience-title" className={displayTitle}>
            Elige tu ruta
          </h2>
          <div className="mt-10 max-w-2xl">
            <div className="flex justify-center">
              <RouteNode title="Tu curso" Icon={Network} color={contentColor} status="completed" />
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              className="block h-12 w-full"
            >
              <path
                d="M50 0 V20 M25 40 V20 H75 V40"
                fill="none"
                stroke="var(--ink)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <Tabs.List className="grid grid-cols-2 gap-4 sm:gap-6">
              {audienceIds.map((id) => (
                <Tabs.Tab
                  key={id}
                  value={id}
                  className="group flex cursor-pointer rounded-lg outline-none active:translate-y-px"
                >
                  <RouteNode
                    title={audiences[id].label}
                    Icon={audiences[id].Icon}
                    color={contentColor}
                    status={id === audienceId ? 'completed' : 'available'}
                    className="w-full group-hover:shadow-[0_8px_18px_rgb(18_33_58/14%)] group-focus-visible:ring-3 group-focus-visible:ring-ring/50"
                  />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </div>
          <div ref={anchorRef} className="scroll-mt-16" />
        </section>
        {audienceIds.map((id) => (
          <Tabs.Panel key={id} value={id} className="outline-none">
            <AudienceRoute audienceId={id} />
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </LazyMotion>
  );
}
