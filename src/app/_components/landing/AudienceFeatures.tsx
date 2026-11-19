'use client';

import { type CSSProperties, useRef, useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import {
  ArrowUpRight,
  Bell,
  CircleCheckBig,
  CircleEllipsis,
  GraduationCap,
  History,
  LibraryBig,
  type LucideIcon,
  Network,
  Presentation,
  Route,
  UserGroup,
} from 'lucide-react';
import { domAnimation, LazyMotion } from 'motion/react';
import { nodeTypePaint } from '@/shared/node-type';
import { buttonVariants } from '@/shared/ui/button-variants';
import { cn } from 'cn';
import { FeatureClip } from './FeatureClip';
import { FeatureRouteTrace, useRouteTrace } from './FeatureRouteTrace';
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
          'Crea [nodos temáticos], agrégales contenidos, muéstralos, conéctalos o bloquéalos según tu planificación o el programa del curso.',
        clip: 'teacher-design',
        clipLabel:
          'Demostración: el equipo docente crea el nodo «Integrales definidas», lo conecta como dependiente de otro y lo bloquea.',
      },
      {
        title: 'Notifica a tus estudiantes',
        Icon: Bell,
        description:
          'Cada modificación significativa que realizas [avisa oportunamente] al estudiantado para que se mantenga al día.',
        clip: 'teacher-notices',
        clipLabel:
          'Demostración: el equipo docente vuelve a mostrar el nodo «Taller de modelamiento de cambios»; la confirmación indica que los estudiantes podrán verlo de inmediato.',
      },
      {
        title: 'Sigue el avance de tu curso',
        Icon: UserGroup,
        description:
          'Revisa los [porcentajes de avance] del roadmap en el listado de integrantes del curso.',
        clip: 'teacher-progress',
        clipLabel:
          'Demostración: página de integrantes con el avance promedio del curso y el porcentaje de cada estudiante.',
      },
    ],
    highlight: {
      title: 'Historial de versiones',
      Icon: History,
      description:
        'Al finalizar cada semestre queda un [registro histórico] de los roadmaps de tus cursos, para que los reutilices en los próximos.',
      clip: 'teacher-versions',
      clipLabel:
        'Demostración: historial de versiones de un curso, con sus semestres anteriores, y apertura de una versión cerrada de solo lectura.',
    },
    extension: {
      title: 'Pruébalo en U-Cursos',
      description:
        'Descarga ya la [extensión], disponible para Chrome y Firefox, y visualiza tus roadmaps a través de U-Cursos.',
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
          'Explora el material y los contenidos de tus cursos de manera [novedosa y esquemática].',
        clip: 'student-navigate',
        clipLabel:
          'Demostración: un estudiante recorre el roadmap y abre un nodo con su descripción y cuatro recursos.',
      },
      {
        title: 'Registra tu avance',
        Icon: CircleCheckBig,
        description:
          'Completa nodos en el roadmap y visualiza [tu progreso] a lo largo del semestre.',
        clip: 'student-progress',
        clipLabel:
          'Demostración: un estudiante abre un nodo, lo completa y ve su avance en el resumen académico.',
      },
      {
        title: 'Entérate de los cambios',
        Icon: Bell,
        description:
          'Recibe [notificaciones] cuando hay cambios significativos en tus roadmaps y mantente conectado.',
        clip: 'student-notices',
        clipLabel:
          'Demostración: un estudiante abre sus notificaciones y, al entrar al roadmap, ve el resumen de cambios desde su última visita.',
      },
    ],
    extension: {
      title: '¿Muy latero usar 2 plataformas para lo mismo?',
      description:
        '¡Descárgate ya la [extensión] para Chrome y Firefox y utiliza U-Roadmaps dentro de U-Cursos!',
    },
  },
} satisfies Record<string, Audience>;

type AudienceId = keyof typeof audiences;
const audienceIds = Object.keys(audiences) as AudienceId[];

const extensionStores = [
  {
    name: 'Chrome',
    href: 'https://chromewebstore.google.com/detail/hebgfpfigbojefeaedpkelohoejbllhm',
    variant: 'default',
  },
  {
    name: 'Firefox',
    href: 'https://addons.mozilla.org/en-US/firefox/addon/u-roadmaps-en-u-cursos/',
    variant: 'outline',
  },
] as const;

const contentColor = '#024AD8';
const extraMaterialColor = '#0F4C81';
const displayTitle =
  'font-heading text-[1.75rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance md:text-[2.5rem] md:leading-none md:tracking-[-0.04em]';
const canvasGround =
  'bg-cloud bg-[radial-gradient(circle,var(--fog)_1.2px,transparent_1.6px)] bg-size-[24px_24px]';

type StopStatus = 'completed' | 'available' | 'pending';
type Side = 'left' | 'right';

const statusMarks = {
  completed: { Icon: CircleCheckBig, color: 'var(--progress-deep)' },
  available: { Icon: CircleEllipsis, color: 'var(--ink)' },
  pending: { Icon: CircleEllipsis, color: 'var(--graphite)' },
} as const;

function nodeSurface(color: string): CSSProperties {
  const paint = nodeTypePaint(color);
  return { borderColor: paint, backgroundColor: `color-mix(in srgb, ${paint} 3%, var(--card))` };
}

function StatusMark({ status, large = false }: { status: StopStatus; large?: boolean }) {
  const mark = statusMarks[status];
  return (
    <span
      className={cn(
        'absolute grid place-items-center rounded-full border border-fog bg-card',
        large ? '-right-4 -bottom-4 size-10' : '-right-3 -bottom-3 size-8',
      )}
    >
      <mark.Icon
        aria-hidden="true"
        className={large ? 'size-6' : 'size-5'}
        style={{ color: mark.color }}
      />
    </span>
  );
}

function RouteNode({
  title,
  Icon,
  color,
  status,
  className,
  ...data
}: {
  title: string;
  Icon: LucideIcon;
  color: string;
  status: StopStatus;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <span
      {...data}
      data-status={status}
      style={nodeSurface(color)}
      className={cn(
        'relative inline-flex min-h-16 items-center gap-3 rounded-lg border-2 py-3 pr-10 pl-5 text-left font-sans text-xl leading-tight font-medium tracking-normal text-ink shadow-[0_4px_10px_rgb(18_33_58/7%)] transition-[background-color,border-color,opacity] duration-500 sm:text-2xl',
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className="size-6 shrink-0"
        style={{ color: nodeTypePaint(color) }}
      />
      {title}
      <StatusMark status={status} />
    </span>
  );
}

const textColumn = { left: 'lg:col-span-5', right: 'lg:col-span-5 lg:col-start-8' } as const;
const clipColumn = {
  left: 'max-lg:ml-14 lg:col-span-7 lg:mt-24',
  right: 'max-lg:ml-14 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:mt-24',
} as const;
const routeRow = 'grid gap-8 lg:grid-cols-12 lg:gap-x-16';
const routeIndent = 'pl-14';

function FeatureStop({
  feature,
  side,
  status,
}: {
  feature: Feature;
  side: Side;
  status: StopStatus;
}) {
  return (
    <li className={routeRow}>
      <div className={textColumn[side]}>
        <h3>
          <RouteNode
            data-route-stop
            title={feature.title}
            Icon={feature.Icon}
            color={contentColor}
            status={status}
          />
        </h3>
        <RevealStatement
          text={feature.description}
          size="feature"
          className={cn('mt-8', routeIndent)}
        />
      </div>
      <FeatureClip slug={feature.clip} label={feature.clipLabel} className={clipColumn[side]} />
    </li>
  );
}

function HighlightedStop({ feature, status }: { feature: Feature; status: StopStatus }) {
  return (
    <li
      data-route-stop
      data-status={status}
      style={nodeSurface(contentColor)}
      className="relative grid gap-10 rounded-lg border-2 p-6 shadow-[0_18px_50px_rgb(18_33_58/8%)] transition-[background-color,border-color] duration-500 sm:p-10 lg:grid-cols-12 lg:gap-x-16 lg:p-12"
    >
      <div className="lg:col-span-5">
        <feature.Icon
          aria-hidden="true"
          className="size-12"
          strokeWidth={1.75}
          style={{ color: nodeTypePaint(contentColor) }}
        />
        <h3 className="mt-8 font-heading text-[2.5rem] leading-none font-semibold tracking-[-0.04em] text-balance text-ink sm:text-6xl xl:text-7xl xl:leading-[0.98]">
          {feature.title}
        </h3>
        <RevealStatement text={feature.description} size="feature" className="mt-8" />
      </div>
      <FeatureClip
        slug={feature.clip}
        label={feature.clipLabel}
        className="rounded-md shadow-none lg:col-span-7"
      />
      <StatusMark status={status} large />
    </li>
  );
}

function ExtensionStop({ audience, status }: { audience: Audience; status: StopStatus }) {
  return (
    <section aria-labelledby="extension-title" className={routeRow}>
      <div className={textColumn.right}>
        <RouteNode
          data-route-stop
          title="Extensión para U-Cursos"
          Icon={LibraryBig}
          color={extraMaterialColor}
          status={status}
        />
        <div className={cn('mt-8', routeIndent)}>
          <h2 id="extension-title" className={displayTitle}>
            {audience.extension.title}
          </h2>
          <RevealStatement text={audience.extension.description} size="support" className="mt-5" />
          <div className="mt-8 flex flex-wrap gap-3">
            {extensionStores.map((store) => (
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
      </div>
      <FeatureClip
        slug="extension"
        label="Demostración: la vista integrada del roadmap que la extensión muestra dentro de U-Cursos, con un nodo abierto."
        className={clipColumn.right}
      />
    </section>
  );
}

function AudienceRoute({
  audience,
  statusOf,
}: {
  audience: Audience;
  statusOf: (index: number) => StopStatus;
}) {
  const highlightIndex = audience.features.length;
  const extensionIndex = highlightIndex + (audience.highlight ? 1 : 0);

  return (
    <div className="flex flex-col gap-32 pt-24 pb-24 md:pb-32 lg:gap-40">
      <ol className="flex flex-col gap-32 lg:gap-40">
        {audience.features.map((feature, index) => (
          <FeatureStop
            key={feature.clip}
            feature={feature}
            side={index % 2 === 0 ? 'left' : 'right'}
            status={statusOf(index)}
          />
        ))}
        {audience.highlight ? (
          <HighlightedStop feature={audience.highlight} status={statusOf(highlightIndex)} />
        ) : null}
      </ol>
      <ExtensionStop audience={audience} status={statusOf(extensionIndex)} />
    </div>
  );
}

export function AudienceFeatures() {
  const [audienceId, setAudienceId] = useState<AudienceId>('teaching');
  const routeRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const { geometry, reach, furthest } = useRouteTrace(routeRef, audienceId);

  const statusOf = (index: number): StopStatus =>
    index < furthest ? 'completed' : index === furthest ? 'available' : 'pending';

  const chooseAudience = (next: AudienceId) => {
    setAudienceId(next);
    requestAnimationFrame(() => {
      const anchor = anchorRef.current;
      if (anchor && anchor.getBoundingClientRect().top < 0) anchor.scrollIntoView();
    });
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <div className={canvasGround}>
        <Tabs.Root
          value={audienceId}
          onValueChange={(value) => chooseAudience(value as AudienceId)}
          className="mx-auto w-full max-w-360 px-4 sm:px-6 lg:px-12"
        >
          <div ref={routeRef} className="relative">
            <FeatureRouteTrace geometry={geometry} reach={reach} />
            <section aria-labelledby="audience-title" className="relative pt-24 md:pt-32">
              <h2 id="audience-title" className={displayTitle}>
                Elige tu ruta
              </h2>
              <div className="mt-12 flex justify-center">
                <RouteNode
                  data-route-anchor="in"
                  title="Tu curso"
                  Icon={Network}
                  color={contentColor}
                  status="completed"
                />
              </div>
              <Tabs.List className="mx-auto mt-20 grid max-w-5xl grid-cols-2 gap-4 sm:gap-6 lg:gap-x-40">
                {audienceIds.map((id) => {
                  const chosen = id === audienceId;
                  return (
                    <Tabs.Tab
                      key={id}
                      value={id}
                      data-route-audience={id}
                      data-chosen={chosen || undefined}
                      className="group flex cursor-pointer rounded-lg outline-none active:translate-y-px"
                    >
                      <RouteNode
                        title={audiences[id].label}
                        Icon={audiences[id].Icon}
                        color={contentColor}
                        status={chosen ? 'completed' : 'available'}
                        className={cn(
                          'w-full group-hover:opacity-100 group-hover:shadow-[0_8px_18px_rgb(18_33_58/14%)] group-focus-visible:opacity-100 group-focus-visible:ring-3 group-focus-visible:ring-ring/50 max-sm:pr-8 max-sm:pl-4 max-sm:text-lg',
                          !chosen && 'opacity-70',
                        )}
                      />
                    </Tabs.Tab>
                  );
                })}
              </Tabs.List>
              <div ref={anchorRef} className="scroll-mt-16" />
            </section>
            {audienceIds.map((id) => (
              <Tabs.Panel key={id} value={id} className="relative outline-none">
                <AudienceRoute audience={audiences[id]} statusOf={statusOf} />
              </Tabs.Panel>
            ))}
          </div>
        </Tabs.Root>
      </div>
    </LazyMotion>
  );
}
