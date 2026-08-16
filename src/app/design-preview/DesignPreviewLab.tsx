'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Box } from '@mui/material';
import VtiInformation from '@/components/VtiInformation';
import { RoadmapEditor } from '@/components/roadmap/RoadmapEditor';
import { RoadmapGraph } from '@/components/roadmap/RoadmapGraph';
import { StudentNodeDetail } from '@/components/roadmap/StudentNodeDetail';
import type { RoadmapDto } from '@/lib/roadmap-types';
import styles from './lab.module.css';

const roadmapFixture: RoadmapDto = {
  course: {
    code: 'CC3001',
    name: 'Algoritmos y estructuras de datos',
    department: 'Departamento de Ciencias de la Computación',
  },
  courseOffering: { id: 'offering-preview', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-preview' },
  nodeTypes: [
    { id: 'content', name: 'Contenido', color: '#024AD8', isPredefined: true },
    { id: 'assessment', name: 'Evaluación', color: '#FF5050', isPredefined: true },
    { id: 'extra', name: 'Material extra', color: '#356373', isPredefined: true },
  ],
  nodes: [
    {
      id: 'graphs',
      title: 'Grafos y recorridos',
      description: 'Representaciones, búsqueda en profundidad y búsqueda en anchura.',
      positionX: 20,
      positionY: 60,
      nodeTypeId: 'content',
      isVisible: true,
      isCompleted: true,
      canComplete: true,
      resources: [{ id: 'notes', title: 'Apuntes de grafos', url: '#', type: 'FILE' }],
    },
    {
      id: 'shortest-paths',
      title: 'Caminos mínimos',
      description:
        'Compara Dijkstra, Bellman-Ford y Floyd-Warshall según las propiedades del grafo.',
      positionX: 280,
      positionY: 10,
      nodeTypeId: 'content',
      isVisible: true,
      isCompleted: false,
      canComplete: true,
      resources: [
        { id: 'guide', title: 'Guía de ejercicios 4', url: '#', type: 'FILE' },
        { id: 'video', title: 'Demostración de Dijkstra', url: '#', type: 'VIDEO' },
        { id: 'reference', title: 'Visualizador de caminos', url: '#', type: 'LINK' },
      ],
    },
    {
      id: 'network-flow',
      title: 'Flujo en redes',
      description: 'Modela capacidad, conservación y cortes mínimos.',
      positionX: 550,
      positionY: 115,
      nodeTypeId: 'assessment',
      isVisible: true,
      isCompleted: false,
      canComplete: false,
      resources: [],
    },
    {
      id: 'advanced-analysis',
      title: 'Análisis avanzado de algoritmos sobre grafos dirigidos con restricciones',
      description: null,
      positionX: 280,
      positionY: 235,
      nodeTypeId: 'extra',
      isVisible: true,
      isCompleted: false,
      canComplete: true,
      resources: [],
    },
  ],
  dependencies: [
    { id: 'dep-1', sourceNodeId: 'graphs', targetNodeId: 'shortest-paths' },
    { id: 'dep-2', sourceNodeId: 'shortest-paths', targetNodeId: 'network-flow' },
    { id: 'dep-3', sourceNodeId: 'graphs', targetNodeId: 'advanced-analysis' },
  ],
};

const selectedNode = roadmapFixture.nodes[1];

const sections = [
  ['navigation', 'Navegación'],
  ['entry', 'Ingreso'],
  ['courses', 'Cursos'],
  ['roadmap', 'Roadmap'],
  ['detail', 'Detalle'],
  ['editor', 'Edición'],
  ['feedback', 'Estados'],
  ['institutional', 'Datos institucionales'],
] as const;

type SpecimenProps = {
  id: string;
  index: string;
  title: string;
  description: string;
  coverage: string[];
  pending?: string[];
  children: React.ReactNode;
};

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: 'blue' | 'jade' }) {
  return <span className={`${styles.statusBadge} ${styles[tone]}`}>{children}</span>;
}

function MaterialSymbol({ children, filled = false }: { children: string; filled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={styles.materialSymbol}
      style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}
    >
      {children}
    </span>
  );
}

function Specimen({
  id,
  index,
  title,
  description,
  coverage,
  pending = [],
  children,
}: SpecimenProps) {
  return (
    <section className={styles.specimen} id={id}>
      <header className={styles.specimenHeader}>
        <span className={styles.sectionIndex}>{index}</span>
        <div className={styles.specimenTitle}>
          <div className={styles.statuses}>
            <StatusBadge tone="blue">baseline</StatusBadge>
            <StatusBadge tone="jade">implemented</StatusBadge>
          </div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <dl className={styles.coverage}>
          <div>
            <dt>Cubierto</dt>
            <dd>{coverage.join(' · ')}</dd>
          </div>
          <div>
            <dt>Pendiente de diseño</dt>
            <dd>{pending.length ? pending.join(' · ') : 'Ninguno identificado'}</dd>
          </div>
        </dl>
      </header>
      <div className={styles.specimenBody}>{children}</div>
    </section>
  );
}

function Frame({
  label,
  width,
  children,
  dark = false,
}: {
  label: string;
  width?: 'desktop' | 'mobile';
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <article className={`${styles.frame} ${width ? styles[width] : ''} ${dark ? styles.dark : ''}`}>
      <header className={styles.frameLabel}>
        <span>{label}</span>
        <span>{width === 'mobile' ? '390 px' : width === 'desktop' ? '1280 px' : 'Estado'}</span>
      </header>
      <div className={styles.frameContent}>{children}</div>
    </article>
  );
}

function Candidate({
  title,
  coverage,
  children,
}: {
  title: string;
  coverage: string[];
  children: React.ReactNode;
}) {
  const [decision, setDecision] = useState<'undecided' | 'discard' | 'iterate' | 'request'>('undecided');

  return (
    <section className={styles.candidate} aria-label={`Candidato experimental: ${title}`}>
      <header className={styles.candidateHeader}>
        <div>
          <div className={styles.statuses}>
            <StatusBadge tone="blue">experimental</StatusBadge>
            <StatusBadge tone="jade">not implemented</StatusBadge>
          </div>
          <h3>{title}</h3>
        </div>
        <p>{coverage.join(' · ')}</p>
      </header>
      {children}
      <div className={styles.candidateDecision}>
        <p>{decision === 'request' ? 'Solicitud de aprobación pendiente del propietario.' : 'Decisión de revisión local'}</p>
        <div>
          <button onClick={() => setDecision('discard')} type="button">Descartar</button>
          <button onClick={() => setDecision('iterate')} type="button">Iterar</button>
          <button onClick={() => setDecision('request')} type="button">Solicitar aprobación</button>
        </div>
      </div>
    </section>
  );
}

function NavigationDemo({ authenticated = false, mobile = false }) {
  return (
    <nav className={`${styles.productionNavigation} ${mobile ? styles.compactNavigation : ''}`}>
      <span className={styles.productionWordmark}>
        <MaterialSymbol>account_tree</MaterialSymbol> U-Roadmaps
      </span>
      <button type="button">{authenticated ? 'Cerrar sesión' : 'Autenticarse'}</button>
    </nav>
  );
}

function DevelopmentMenuDemo() {
  const [open, setOpen] = useState(true);
  const reduceMotion = useReducedMotion();

  return (
    <div className={styles.developmentDemo}>
      <button
        aria-expanded={open}
        className={styles.personaFab}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <MaterialSymbol>group</MaterialSymbol>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={styles.personaMenu}
            exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
          >
            <strong>Cambiar perfil</strong>
            <button type="button">Camila Soto · Estudiante</button>
            <button type="button">Daniel Muñoz · Profesor de curso</button>
            <button type="button">Valentina Rojas · Auxiliar</button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function LandingHeroDemo() {
  return (
    <div className={styles.landingHero}>
      <span className={styles.blueBand} />
      <p className={styles.overline}>U-Roadmaps · DCC</p>
      <h3>Entiende el camino antes de recorrerlo.</h3>
      <p>
        U-Roadmaps muestra cómo se conectan los contenidos de tus cursos para que puedas preparar
        cada unidad con una visión clara de sus requisitos y recursos.
      </p>
      <button type="button">
        Ingresar con U-Pasaporte <MaterialSymbol>arrow_forward</MaterialSymbol>
      </button>
    </div>
  );
}

const featureCards = [
  [
    'map',
    'Explora el mapa del curso',
    'Visualiza unidades, evaluaciones y materiales en una sola ruta.',
  ],
  ['checklist', 'Sigue tu avance', 'Identifica qué contenidos completaste y cuáles debes preparar.'],
  ['menu_book', 'Encuentra recursos a tiempo', 'Accede a lecturas y enlaces asociados a cada tema.'],
] as const;

function FeatureCardsDemo() {
  return (
    <div className={styles.featureGrid}>
      {featureCards.map(([icon, title, description]) => (
        <article key={title}>
          <span>
            <MaterialSymbol>{icon}</MaterialSymbol>
          </span>
          <h4>{title}</h4>
          <p>{description}</p>
        </article>
      ))}
    </div>
  );
}

function SignInCard({ state }: { state: 'ready' | 'error' | 'unconfigured' }) {
  return (
    <div className={styles.signInCard}>
      <p className={styles.productionOverline}>U-roadmaps</p>
      <h3>Acceso institucional</h3>
      <p>Ingresa con tu identidad de Universidad de Chile mediante U-Pasaporte / VTI.</p>
      {state === 'error' ? (
        <div className={styles.productionAlert}>
          <MaterialSymbol>warning</MaterialSymbol> No fue posible completar la autenticación institucional.
        </div>
      ) : null}
      {state === 'unconfigured' ? (
        <div className={styles.productionAlert}>
          <MaterialSymbol>warning</MaterialSymbol> El acceso institucional no está configurado.
        </div>
      ) : (
        <button className={styles.primaryAction} type="button">
          Autenticarse con U-Pasaporte / VTI
        </button>
      )}
      <button className={styles.textAction} type="button">
        Volver al inicio
      </button>
    </div>
  );
}

type CourseCardProps = {
  participationRole: 'Estudiante' | 'Personal docente';
  hasRoadmap: boolean;
  historical?: boolean;
  mobile?: boolean;
};

function CourseCard({ participationRole, hasRoadmap, historical = false, mobile = false }: CourseCardProps) {
  return (
    <article className={`${styles.courseCard} ${mobile ? styles.courseCardMobile : ''}`}>
      <div>
        <p>{historical ? '2025, semestre 2' : '2026, semestre 2'}</p>
        <h3>
          {historical
            ? 'CC4102 · Diseño y análisis de algoritmos'
            : 'CC3001 · Algoritmos y estructuras de datos'}
        </h3>
        <span>{participationRole} · Departamento de Ciencias de la Computación</span>
      </div>
      <button className={hasRoadmap ? styles.primaryAction : styles.secondaryAction} type="button">
        {hasRoadmap ? 'Abrir roadmap' : 'Ver curso'}
      </button>
    </article>
  );
}

function CourseRouteCandidate({ mobile = false, withoutRoadmap = false }: { mobile?: boolean; withoutRoadmap?: boolean }) {
  return (
    <article className={`${styles.courseRouteCandidate} ${mobile ? styles.courseRouteCandidateMobile : ''}`}>
      <div className={styles.courseRouteTrace} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={styles.courseRouteHeading}>
        <p>{withoutRoadmap ? 'Oferta actual · Personal docente' : 'Oferta actual · Estudiante'}</p>
        <h4>CC3001 · Algoritmos y estructuras de datos</h4>
        <span>2026, semestre 2 · Departamento de Ciencias de la Computación</span>
      </div>
      {withoutRoadmap ? (
        <div className={styles.courseRouteEmpty}>
          <strong>El roadmap aún no existe</strong>
          <p>Crea una ruta para organizar contenidos, dependencias y recursos de esta oferta.</p>
          <button className={styles.secondaryAction} type="button">
            Crear roadmap
          </button>
        </div>
      ) : (
        <div className={styles.courseRouteProgress}>
          <div>
            <span>Tu posición</span>
            <strong>4 de 7 nodos</strong>
          </div>
          <div
            aria-label="4 de 7 nodos completados"
            aria-valuemax={7}
            aria-valuemin={0}
            aria-valuenow={4}
            className={styles.candidateProgressTrack}
            role="progressbar"
          >
            <span />
          </div>
          <p>Sigue con <strong>Caminos mínimos</strong></p>
          <button className={styles.primaryAction} type="button">
            Continuar ruta
          </button>
        </div>
      )}
    </article>
  );
}

function NodeDetailReplica({ mobile = false }: { mobile?: boolean }) {
  return (
    <aside className={`${styles.nodeDetailReplica} ${mobile ? styles.nodeDetailMobile : ''}`}>
      <button aria-label="Cerrar detalle" className={styles.closeButton} type="button">
        <MaterialSymbol>close</MaterialSymbol>
      </button>
      <header>
        <p className={styles.productionOverline}>Nodo del roadmap</p>
        <h3>Caminos mínimos</h3>
        <button className={styles.primaryAction} type="button">
          <MaterialSymbol>task_alt</MaterialSymbol> Completar
        </button>
      </header>
      <div className={styles.detailContent}>
        <h4>
          <MaterialSymbol>description</MaterialSymbol> Descripción
        </h4>
        <p>Compara Dijkstra, Bellman-Ford y Floyd-Warshall según las propiedades del grafo.</p>
        <hr />
        <h4>
          <MaterialSymbol>menu_book</MaterialSymbol> Recursos
        </h4>
        {(
          [
            ['description', 'Guía de ejercicios 4', 'Archivo descargable'],
            ['videocam', 'Demostración de Dijkstra', 'Video'],
          ] as const
        ).map(([icon, title, type]) => (
          <article className={styles.resourceCard} key={title as string}>
            <MaterialSymbol>{icon}</MaterialSymbol>
            <span>
              <strong>{title}</strong>
              <small>{type}</small>
            </span>
            <MaterialSymbol>chevron_right</MaterialSymbol>
          </article>
        ))}
      </div>
    </aside>
  );
}

type CandidateNodeStatus = 'available' | 'blocked' | 'completed';

function NodeDetailCandidate({ mobile = false }: { mobile?: boolean }) {
  const [status, setStatus] = useState<CandidateNodeStatus>('available');
  const reduceMotion = useReducedMotion();
  const detail = {
    available: {
      label: 'Disponible ahora',
      title: 'Caminos mínimos',
      description: 'Ya puedes comparar Dijkstra, Bellman-Ford y Floyd-Warshall.',
      action: 'Marcar como completado',
    },
    blocked: {
      label: 'Requiere un paso previo',
      title: 'Flujo en redes',
      description: 'Completa Caminos mínimos para habilitar este nodo.',
      action: 'Ver requisito',
    },
    completed: {
      label: 'Completado el 12 de agosto',
      title: 'Grafos y recorridos',
      description: 'Tu avance se registró y las rutas que dependen de este nodo siguen disponibles.',
      action: 'Revisar recursos',
    },
  }[status];

  return (
    <div className={`${styles.nodeDetailCandidate} ${mobile ? styles.nodeDetailCandidateMobile : ''}`}>
      <fieldset className={styles.nodeStatusTabs}>
        <legend className={styles.screenReaderOnly}>Estado simulado del nodo</legend>
        {(['available', 'blocked', 'completed'] as const).map((option) => (
          <button
            aria-pressed={status === option}
            className={status === option ? styles.nodeStatusTabActive : undefined}
            key={option}
            onClick={() => setStatus(option)}
            type="button"
          >
            {option === 'available' ? 'Disponible' : option === 'blocked' ? 'Bloqueado' : 'Completado'}
          </button>
        ))}
      </fieldset>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className={styles.nodeCandidateContent}
          exit={reduceMotion ? undefined : { opacity: 0, x: -10 }}
          initial={reduceMotion ? false : { opacity: 0, x: 10 }}
          key={status}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className={styles.nodeCandidateLabel}>{detail.label}</p>
          <h4>{detail.title}</h4>
          <p>{detail.description}</p>
          <div className={styles.nodeCandidateRoute}>
            <span>{status === 'blocked' ? 'Antes' : 'Ahora'}</span>
            <strong>{status === 'blocked' ? 'Caminos mínimos' : detail.title}</strong>
          </div>
          <section className={styles.nodeCandidateResources}>
            <p>Recursos asociados</p>
            <button type="button">Guía de ejercicios 4</button>
            <button type="button">Demostración de Dijkstra</button>
          </section>
          <button className={status === 'blocked' ? styles.secondaryAction : styles.primaryAction} type="button">
            {detail.action}
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

async function acceptMutation() {
  return true;
}

function RoadmapEditorDemo() {
  return (
    <div className={styles.editorShell}>
      <RoadmapEditor
        roadmap={roadmapFixture}
        selectedNode={selectedNode}
        isOpen
        onToggle={() => undefined}
        onClose={() => undefined}
        onAddNode={acceptMutation}
        onUpdateNode={acceptMutation}
        onToggleVisibility={acceptMutation}
        onDeleteNode={acceptMutation}
        onAddResource={acceptMutation}
      />
    </div>
  );
}

function CanvasState({ state }: { state: 'loading' | 'fatal' | 'recoverable' | 'empty' }) {
  if (state === 'loading') return <div className={styles.loadingState}>Cargando roadmap...</div>;
  if (state === 'fatal')
    return (
      <div className={styles.errorState}>
        <MaterialSymbol>warning</MaterialSymbol> No fue posible cargar el roadmap.
      </div>
    );
  if (state === 'recoverable')
    return (
      <div className={styles.errorState}>
        <MaterialSymbol>warning</MaterialSymbol> No fue posible guardar el cambio.
      </div>
    );
  return (
    <div className={styles.pendingState}>
      <MaterialSymbol>circle</MaterialSymbol>
      <strong>Estado aún no diseñado</strong>
      <span>La línea base no define una experiencia para un roadmap sin nodos.</span>
    </div>
  );
}

type FeedbackState = 'loading' | 'empty' | 'recoverable' | 'fatal' | 'success';

function FeedbackCandidate() {
  const [state, setState] = useState<FeedbackState>('empty');
  const reduceMotion = useReducedMotion();
  const content: Record<FeedbackState, { label: string; title: string; description: string; action?: string }> = {
    loading: {
      label: 'Cargando',
      title: 'Estamos preparando tu ruta',
      description: 'Los nodos y sus dependencias aparecerán aquí.',
    },
    empty: {
      label: 'Sin nodos todavía',
      title: 'Empieza por el primer punto de la ruta',
      description: 'Agrega un nodo para comenzar a organizar el aprendizaje del curso.',
      action: 'Agregar primer nodo',
    },
    recoverable: {
      label: 'Cambio sin guardar',
      title: 'No se pudo guardar este cambio',
      description: 'Tu ruta sigue abierta. Intenta guardar de nuevo.',
      action: 'Intentar de nuevo',
    },
    fatal: {
      label: 'Ruta no disponible',
      title: 'No pudimos cargar este roadmap',
      description: 'Actualiza la página para volver a intentarlo.',
      action: 'Actualizar vista',
    },
    success: {
      label: 'Cambio guardado',
      title: 'El nodo ya forma parte de la ruta',
      description: 'Puedes seguir editando sus dependencias y recursos.',
    },
  };
  const current = content[state];

  return (
    <div className={styles.feedbackCandidate}>
      <fieldset className={styles.feedbackControls}>
        <legend className={styles.screenReaderOnly}>Estado simulado del canvas</legend>
        {(Object.keys(content) as FeedbackState[]).map((option) => (
          <button
            aria-pressed={state === option}
            className={state === option ? styles.feedbackControlActive : undefined}
            key={option}
            onClick={() => setState(option)}
            type="button"
          >
            {content[option].label}
          </button>
        ))}
      </fieldset>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className={`${styles.feedbackMessage} ${styles[`feedback${state[0].toUpperCase()}${state.slice(1)}`]}`}
          exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          key={state}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <span aria-hidden="true">{state === 'success' ? '01' : state === 'fatal' ? '!' : '·'}</span>
          <div>
            <p>{current.label}</p>
            <h4>{current.title}</h4>
            <p>{current.description}</p>
            {current.action ? (
              <button className={state === 'recoverable' || state === 'fatal' ? styles.secondaryAction : styles.primaryAction} type="button">
                {current.action}
              </button>
            ) : null}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function DesignPreviewLab({ fontClassName }: { fontClassName: string }) {
  return (
    <main className={`${styles.lab} ${fontClassName}`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>Laboratorio visual · Baseline 01</span>
          <h1>El estado actual, puesto sobre la mesa.</h1>
          <p>
            Inventario panorámico de las unidades visuales que existen hoy en U-Roadmaps. Nada en
            esta página constituye todavía un candidato de reemplazo.
          </p>
        </div>
        <div className={styles.heroLedger}>
          <div>
            <strong>08</strong>
            <span>familias visuales</span>
          </div>
          <div>
            <strong>02</strong>
            <span>ejes de estado</span>
          </div>
          <div>
            <strong>00</strong>
            <span>diseños aprobados</span>
          </div>
        </div>
        <div aria-hidden className={styles.routeTrace} />
      </header>

      <div className={styles.atlasLayout}>
        <aside className={styles.index}>
          <p>Índice de cobertura</p>
          <nav aria-label="Familias del laboratorio">
            {sections.map(([id, label], index) => (
              <a href={`#${id}`} key={id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {label}
              </a>
            ))}
          </nav>
          <div className={styles.legend}>
            <StatusBadge tone="blue">baseline</StatusBadge>
            <span>Diseño vigente observado</span>
            <StatusBadge tone="jade">implemented</StatusBadge>
            <span>Existe en producción</span>
          </div>
        </aside>

        <div className={styles.catalogue}>
          <Specimen
            id="navigation"
            index="01"
            title="Navegación y sesión"
            description="Cabecera global, acciones de sesión y selector de persona del entorno local."
            coverage={['anónimo', 'autenticado', 'desktop', 'móvil', 'menú abierto y cerrado']}
            pending={['colapso móvil', 'estado de foco específico']}
          >
            <div className={styles.frameGrid}>
              <Frame label="Anónimo" width="desktop">
                <NavigationDemo />
              </Frame>
              <Frame label="Autenticado" width="desktop">
                <NavigationDemo authenticated />
              </Frame>
              <Frame label="Móvil" width="mobile">
                <NavigationDemo mobile />
              </Frame>
              <Frame label="Herramienta de desarrollo">
                <DevelopmentMenuDemo />
              </Frame>
            </div>
          </Specimen>

          <Specimen
            id="entry"
            index="02"
            title="Ingreso y presentación"
            description="Las superficies que presentan el producto antes de que exista una participación activa en pantalla."
            coverage={[
              'hero',
              'CTA',
              'tarjeta informativa',
              'acceso normal',
              'error',
              'servicio no configurado',
            ]}
            pending={['carga de autenticación']}
          >
            <div className={styles.stackFrames}>
              <Frame label="Hero de acceso" dark>
                <LandingHeroDemo />
              </Frame>
              <Frame label="Beneficios">
                <FeatureCardsDemo />
              </Frame>
              <div className={styles.frameGridThree}>
                <Frame label="Acceso disponible">
                  <SignInCard state="ready" />
                </Frame>
                <Frame label="Error de callback">
                  <SignInCard state="error" />
                </Frame>
                <Frame label="Servicio no configurado">
                  <SignInCard state="unconfigured" />
                </Frame>
              </div>
            </div>
          </Specimen>

          <Specimen
            id="courses"
            index="03"
            title="Tarjetas de course offering"
            description="Entrada desde el resumen académico a cada impartición vigente o histórica."
            coverage={[
              'estudiante',
              'personal docente',
              'con roadmap',
              'sin roadmap',
              'actual',
              'histórico',
              'móvil',
            ]}
            pending={['resumen sin cursos', 'historial sin ofertas']}
          >
            <div className={styles.stackFrames}>
              <Frame label="Desktop" width="desktop">
                <div className={styles.courseStack}>
                  <CourseCard participationRole="Estudiante" hasRoadmap />
                  <CourseCard participationRole="Personal docente" hasRoadmap={false} historical />
                </div>
              </Frame>
              <Frame label="Móvil" width="mobile">
                <CourseCard participationRole="Estudiante" hasRoadmap mobile />
              </Frame>
              <Candidate
                title="Tarjeta de ruta"
                coverage={['estudiante con roadmap', 'personal docente sin roadmap', 'desktop', 'móvil']}
              >
                <div className={styles.candidateFrameGrid}>
                  <Frame label="Estudiante · desktop" width="desktop">
                    <CourseRouteCandidate />
                  </Frame>
                  <Frame label="Personal docente · sin roadmap">
                    <CourseRouteCandidate withoutRoadmap />
                  </Frame>
                  <Frame label="Estudiante · móvil" width="mobile">
                    <CourseRouteCandidate mobile />
                  </Frame>
                  <Frame label="Personal docente · móvil" width="mobile">
                    <CourseRouteCandidate mobile withoutRoadmap />
                  </Frame>
                </div>
              </Candidate>
            </div>
          </Specimen>

          <Specimen
            id="roadmap"
            index="04"
            title="Nodos y dependencias"
            description="El grafo real de producción con fixtures estáticos y sus modos de consulta y edición."
            coverage={[
              'completado',
              'disponible',
              'bloqueado',
              'título largo',
              'dependencia activa e inactiva',
              'edición',
            ]}
            pending={[
              'seleccionado',
              'posición actual',
              'nodo oculto recuperable',
              'foco de tarjeta',
            ]}
          >
            <div className={styles.stackFrames}>
              <Frame label="Consulta del estudiante" width="desktop">
                <div className={styles.graphFrame}>
                  <RoadmapGraph
                    roadmap={roadmapFixture}
                    canEdit={false}
                    onSelectNode={() => undefined}
                    onMoveNode={() => undefined}
                    onConnectNodes={() => undefined}
                  />
                </div>
              </Frame>
              <Frame label="Edición del personal docente" width="desktop">
                <div className={styles.graphFrame}>
                  <RoadmapGraph
                    roadmap={roadmapFixture}
                    canEdit
                    onSelectNode={() => undefined}
                    onMoveNode={() => undefined}
                    onConnectNodes={() => undefined}
                  />
                </div>
              </Frame>
            </div>
          </Specimen>

          <Specimen
            id="detail"
            index="05"
            title="Detalle y recursos del nodo"
            description="Panel persistente de escritorio, diálogo móvil y recursos vinculados a un nodo."
            coverage={[
              'sin selección',
              'disponible',
              'bloqueado',
              'completado',
              'sin descripción',
              'sin recursos',
              'archivo',
              'enlace',
              'video',
              'móvil',
            ]}
            pending={['completación en curso', 'fallo de completación', 'desborde de recursos']}
          >
            <div className={styles.detailFrames}>
              <Frame label="Panel real de producción" width="desktop">
                <Box sx={{ position: 'relative', height: 620, bgcolor: '#fdfdfe' }}>
                  <StudentNodeDetail
                    node={selectedNode}
                    status="available"
                    onClose={() => undefined}
                    onComplete={() => undefined}
                  />
                </Box>
              </Frame>
              <Frame label="Diálogo móvil" width="mobile">
                <NodeDetailReplica mobile />
              </Frame>
              <Frame label="Sin selección" width="desktop">
                <div className={styles.placeholderPanel}>
                  <h3>Selecciona un nodo</h3>
                  <p>Revisa su descripción, materiales y estado de avance desde este panel.</p>
                </div>
              </Frame>
              <Candidate
                title="Panel de posición"
                coverage={['disponible', 'bloqueado', 'completado', 'recursos', 'desktop', 'móvil']}
              >
                <div className={styles.candidateFrameGrid}>
                  <Frame label="Panel · desktop" width="desktop">
                    <NodeDetailCandidate />
                  </Frame>
                  <Frame label="Diálogo · móvil" width="mobile">
                    <NodeDetailCandidate mobile />
                  </Frame>
                </div>
              </Candidate>
            </div>
          </Specimen>

          <Specimen
            id="editor"
            index="06"
            title="Edición del roadmap"
            description="Formularios reales para agregar contenido, editar un nodo y adjuntar recursos."
            coverage={[
              'panel abierto',
              'agregar nodo',
              'editar selección',
              'visibilidad',
              'recurso',
              'panel cerrado',
            ]}
            pending={[
              'guardado en curso',
              'confirmación integrada',
              'éxito',
              'error localizado',
              'drawer móvil',
            ]}
          >
            <div className={styles.stackFrames}>
              <Frame label="Panel y selección activos" width="desktop">
                <RoadmapEditorDemo />
              </Frame>
              <Frame label="Panel cerrado">
                <div className={styles.closedEditor}>
                  <button type="button">
                    <MaterialSymbol>dock_to_left</MaterialSymbol>
                  </button>
                  <span>El canvas ocupa el espacio disponible.</span>
                </div>
              </Frame>
            </div>
          </Specimen>

          <Specimen
            id="feedback"
            index="07"
            title="Carga, error y vacío"
            description="Feedback transversal que hoy aparece alrededor del canvas. Los vacíos ausentes se registran sin inventar una solución."
            coverage={['carga inicial', 'error fatal', 'error recuperable']}
            pending={['roadmap vacío', 'sin cursos', 'not found propio', 'éxito de mutación']}
          >
            <div className={styles.frameGridFour}>
              <Frame label="Carga">
                <CanvasState state="loading" />
              </Frame>
              <Frame label="Error fatal">
                <CanvasState state="fatal" />
              </Frame>
              <Frame label="Error recuperable">
                <CanvasState state="recoverable" />
              </Frame>
              <Frame label="Vacío pendiente">
                <CanvasState state="empty" />
              </Frame>
              <Candidate
                title="Mensajes que reorientan"
                coverage={['carga', 'vacío', 'error recuperable', 'error fatal', 'éxito']}
              >
                <Frame label="Estados interactivos">
                  <FeedbackCandidate />
                </Frame>
              </Candidate>
            </div>
          </Specimen>

          <Specimen
            id="institutional"
            index="08"
            title="Información institucional"
            description="Definición visual existente para claims institucionales escalares, anidados y extensos."
            coverage={['texto', 'booleano', 'lista', 'objeto', 'valor largo']}
            pending={['claims vacías']}
          >
            <div className={styles.frameGrid}>
              <Frame label="Claims representativas" width="desktop">
                <VtiInformation
                  claims={{
                    nombre: 'Camila Soto',
                    rut: '18.765.432-1',
                    estudiante: true,
                    roles: ['estudiante', 'auxiliar'],
                    unidad: { codigo: 'DCC', nombre: 'Departamento de Ciencias de la Computación' },
                  }}
                />
              </Frame>
              <Frame label="Ficha de persona">
                <div className={styles.personaPage}>
                  <p className={styles.productionOverline}>Entorno de desarrollo</p>
                  <h3>Seleccionar persona</h3>
                  <p>Alterna entre los casos representativos usando la barra DESARROLLO.</p>
                  <span>Camila Soto · Estudiante</span>
                  <span>Daniel Muñoz · Profesor de curso</span>
                </div>
              </Frame>
            </div>
          </Specimen>
        </div>
      </div>

      <footer className={styles.labFooter}>
        <div>
          <MaterialSymbol>task_alt</MaterialSymbol>
          <span>Línea base y tres candidatos disponibles</span>
        </div>
        <p>Compara cada candidata con su línea base antes de decidir si descartarla, iterarla o aprobarla.</p>
      </footer>
    </main>
  );
}
