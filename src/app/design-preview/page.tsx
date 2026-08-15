import { Archivo, Chivo, IBM_Plex_Sans_Condensed, Plus_Jakarta_Sans } from 'next/font/google';
import styles from './preview.module.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
});

const chivo = Chivo({
  subsets: ['latin'],
  variable: '--font-heading',
});

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-heading',
});

const ibmPlex = IBM_Plex_Sans_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
});

const greens = [
  {
    id: 'hoja',
    name: 'Hoja',
    value: '#78C66A',
    rgb: '120, 198, 106',
    soft: '#E4F4E0',
    deep: '#2E6B32',
  },
  {
    id: 'jade',
    name: 'Jade',
    value: '#35A779',
    rgb: '53, 167, 121',
    soft: '#DDF2E9',
    deep: '#176245',
  },
] as const;

const headingFonts = [
  { id: 'chivo', name: 'Chivo', className: chivo.variable, settings: undefined },
  {
    id: 'archivo',
    name: 'Archivo SemiCondensed',
    className: archivo.variable,
    settings: '"wdth" 87.5',
  },
  {
    id: 'ibm-plex',
    name: 'IBM Plex Sans Condensed',
    className: ibmPlex.variable,
    settings: undefined,
  },
] as const;

type RouteMarkProps = {
  green: string;
  label?: string;
  size?: number;
};

function RouteMark({ green, label, size = 64 }: RouteMarkProps) {
  return (
    <svg
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={styles.routeMark}
      height={size}
      role={label ? 'img' : undefined}
      viewBox="0 0 64 64"
      width={size}
    >
      <path d="M14 10v26c0 12 6 18 18 18s18-6 18-18V10" />
      <circle className={styles.blueNode} cx="14" cy="10" r="5" />
      <circle className={styles.blueNode} cx="32" cy="54" r="5" />
      <circle cx="50" cy="10" fill={green} r="6" />
    </svg>
  );
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

type PairingCardProps = {
  font: (typeof headingFonts)[number];
  green: (typeof greens)[number];
};

function PairingCard({ font, green }: PairingCardProps) {
  const pairingId = `${green.id.slice(0, 1).toUpperCase()}-${font.id === 'ibm-plex' ? 'I' : font.id[0].toUpperCase()}`;
  const headingStyle = font.settings ? { fontVariationSettings: font.settings } : undefined;

  return (
    <article
      className={`${styles.pairingCard} ${font.className}`}
      style={
        {
          '--green': green.value,
          '--green-soft': green.soft,
          '--green-deep': green.deep,
        } as React.CSSProperties
      }
    >
      <header className={styles.pairingMeta}>
        <span className={styles.pairingId}>{pairingId}</span>
        <div>
          <p>{green.name}</p>
          <h2 style={headingStyle}>{font.name}</h2>
        </div>
        <span className={styles.colorValue}>{green.value}</span>
      </header>

      <section className={styles.brandBar}>
        <div className={styles.wordmark}>
          <RouteMark green={green.value} size={44} />
          <span style={headingStyle}>U-Roadmaps</span>
        </div>
        <div className={styles.iconSet}>
          <MaterialSymbol>map</MaterialSymbol>
          <MaterialSymbol>route</MaterialSymbol>
          <MaterialSymbol filled>check_circle</MaterialSymbol>
        </div>
      </section>

      <section className={styles.heroSample}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Tu semestre · Primavera 2026</span>
          <h3 style={headingStyle}>Cada curso, una ruta clara.</h3>
          <p>Explora contenidos, requisitos y recursos en una ruta que muestra tu avance.</p>
          <button type="button">
            Ver mis cursos
            <MaterialSymbol>arrow_forward</MaterialSymbol>
          </button>
        </div>

        <div className={styles.routeSample}>
          <span className={styles.routeLabel}>CC3001 · Algoritmos</span>
          <div className={`${styles.mockNode} ${styles.completeNode}`}>
            <MaterialSymbol filled>check_circle</MaterialSymbol>
            <div>
              <small>Completado</small>
              <strong>Grafos y recorridos</strong>
            </div>
          </div>
          <span className={`${styles.connector} ${styles.connectorOne}`} />
          <div className={`${styles.mockNode} ${styles.currentNode}`}>
            <span className={styles.currentDot} />
            <div>
              <small>Estás aquí</small>
              <strong>Caminos mínimos</strong>
            </div>
          </div>
          <span className={`${styles.connector} ${styles.connectorTwo}`} />
          <div className={`${styles.mockNode} ${styles.lockedNode}`}>
            <MaterialSymbol>lock</MaterialSymbol>
            <div>
              <small>A continuación</small>
              <strong>Flujo en redes</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.courseSample}>
        <div className={styles.courseHeading}>
          <div>
            <span className={styles.eyebrow}>Curso actual</span>
            <h3 style={headingStyle}>Estructuras de datos y algoritmos</h3>
          </div>
          <span className={styles.progressValue}>68%</span>
        </div>
        <div className={styles.progressTrack}>
          <span />
        </div>
        <div className={styles.courseFooter}>
          <span>
            <MaterialSymbol>task_alt</MaterialSymbol> 13 de 19 contenidos
          </span>
          <span>
            <MaterialSymbol>menu_book</MaterialSymbol> 4 recursos disponibles
          </span>
        </div>
      </section>
    </article>
  );
}

export default function DesignPreviewPage() {
  return (
    <main className={`${styles.preview} ${plusJakarta.variable}`}>
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />

      <section className={styles.intro}>
        <div className={styles.introCopy}>
          <span className={styles.kicker}>Laboratorio visual · U-Roadmaps</span>
          <h1>Dos verdes. Tres voces. Una misma ruta.</h1>
          <p>
            Esta página mantiene idénticos la composición, el azul y el contenido. Compara solamente
            el verde secundario y la fuente de títulos antes de fijar el sistema visual.
          </p>
        </div>
        <div className={styles.introMark}>
          <RouteMark green="#78C66A" label="Símbolo propuesto para U-Roadmaps" size={112} />
          <div className={styles.sizeTest}>
            <RouteMark green="#78C66A" size={32} />
            <RouteMark green="#78C66A" size={24} />
            <RouteMark green="#78C66A" size={16} />
          </div>
        </div>
      </section>

      <section className={styles.criteria} aria-labelledby="criteria-heading">
        <h2 id="criteria-heading">Qué observar</h2>
        <ol>
          <li>
            <strong>Orientación:</strong> ¿la vista deja claro dónde estás y qué sigue?
          </li>
          <li>
            <strong>Carácter:</strong> ¿parece universitaria sin sentirse administrativa?
          </li>
          <li>
            <strong>Jerarquía:</strong> ¿los títulos largos se leen antes que los metadatos?
          </li>
          <li>
            <strong>Convivencia:</strong> ¿el verde acompaña al azul sin competir con él?
          </li>
        </ol>
      </section>

      <section className={styles.paletteSection} aria-labelledby="palette-heading">
        <div className={styles.sectionHeading}>
          <span>Prueba 01</span>
          <h2 id="palette-heading">Color secundario</h2>
          <p>El verde ocupa progreso, orientación y superficies de continuidad.</p>
        </div>
        <div className={styles.paletteGrid}>
          {greens.map((green) => (
            <article className={styles.paletteCard} key={green.id}>
              <div className={styles.paletteField} style={{ backgroundColor: green.value }}>
                <RouteMark green={green.deep} size={72} />
                <span>{green.name}</span>
              </div>
              <div className={styles.swatches}>
                <span style={{ backgroundColor: green.soft }} />
                <span style={{ backgroundColor: green.value }} />
                <span style={{ backgroundColor: green.deep }} />
              </div>
              <dl>
                <div>
                  <dt>Base</dt>
                  <dd>{green.value}</dd>
                </div>
                <div>
                  <dt>RGB</dt>
                  <dd>{green.rgb}</dd>
                </div>
                <div>
                  <dt>Rol</dt>
                  <dd>Progreso personal</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.matrixSection} aria-labelledby="matrix-heading">
        <div className={styles.sectionHeading}>
          <span>Prueba 02</span>
          <h2 id="matrix-heading">Combinaciones en contexto</h2>
          <p>Plus Jakarta Sans permanece en cuerpo, navegación y controles.</p>
        </div>
        <div className={styles.pairingGrid}>
          {headingFonts.flatMap((font) =>
            greens.map((green) => (
              <PairingCard font={font} green={green} key={`${green.id}-${font.id}`} />
            )),
          )}
        </div>
      </section>

      <footer className={styles.previewFooter}>
        <RouteMark green="#35A779" size={36} />
        <div>
          <strong>Próxima decisión</strong>
          <p>Elige un código de combinación: H-C, H-A, H-I, J-C, J-A o J-I.</p>
        </div>
      </footer>
    </main>
  );
}
