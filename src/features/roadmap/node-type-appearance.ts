export const nodeTypeColorPalette = [
  { value: '#024AD8', label: 'Azul institucional' },
  { value: '#1467A8', label: 'Azul océano' },
  { value: '#1476C9', label: 'Azul cielo' },
  { value: '#356373', label: 'Azul acero' },
  { value: '#00758A', label: 'Cian profundo' },
  { value: '#007C75', label: 'Turquesa' },
  { value: '#287A3D', label: 'Verde hoja' },
  { value: '#176245', label: 'Verde bosque' },
  { value: '#687520', label: 'Oliva' },
  { value: '#906800', label: 'Ocre' },
  { value: '#BD5800', label: 'Naranja' },
  { value: '#FF5050', label: 'Coral' },
  { value: '#C9362B', label: 'Rojo' },
  { value: '#B42355', label: 'Carmín' },
  { value: '#C52F73', label: 'Frambuesa' },
  { value: '#AD2680', label: 'Magenta' },
  { value: '#7540B8', label: 'Violeta' },
  { value: '#5F3DC4', label: 'Morado' },
  { value: '#3F51B5', label: 'Índigo' },
  { value: '#56616F', label: 'Pizarra' },
] as const;

export type NodeTypeColor = (typeof nodeTypeColorPalette)[number]['value'];

export const teachingIconCatalog = [
  {
    label: 'Contenido y lectura',
    icons: [
      ['BookOpen', 'Libro abierto'],
      ['BookOpenText', 'Libro con texto'],
      ['BookText', 'Libro de texto'],
      ['BookMarked', 'Libro marcado'],
      ['LibraryBig', 'Biblioteca'],
      ['NotebookText', 'Cuaderno'],
      ['NotebookPen', 'Cuaderno y lápiz'],
      ['Newspaper', 'Artículo'],
      ['FileText', 'Documento'],
      ['Files', 'Documentos'],
      ['FolderOpen', 'Carpeta abierta'],
      ['Bookmark', 'Marcador'],
      ['Highlighter', 'Destacador'],
      ['Quote', 'Cita'],
      ['Languages', 'Idiomas'],
      ['SpellCheck2', 'Ortografía'],
    ],
  },
  {
    label: 'Evaluación y progreso',
    icons: [
      ['ClipboardCheck', 'Lista verificada'],
      ['ClipboardList', 'Lista de tareas'],
      ['ListChecks', 'Lista de cotejo'],
      ['CircleCheckBig', 'Completado'],
      ['CircleEllipsis', 'Pendiente'],
      ['BadgeCheck', 'Aprobado'],
      ['Trophy', 'Trofeo'],
      ['Medal', 'Medalla'],
      ['Award', 'Distinción'],
      ['Target', 'Objetivo'],
      ['ChartNoAxesColumnIncreasing', 'Progreso'],
      ['Gauge', 'Indicador'],
      ['Timer', 'Tiempo'],
      ['CalendarCheck', 'Fecha cumplida'],
      ['Flag', 'Hito'],
      ['GraduationCap', 'Graduación'],
    ],
  },
  {
    label: 'Personas y colaboración',
    icons: [
      ['Users', 'Grupo'],
      ['UserRound', 'Persona'],
      ['UsersRound', 'Comunidad'],
      ['UserRoundCheck', 'Participante confirmado'],
      ['Presentation', 'Presentación'],
      ['Speech', 'Exposición'],
      ['MessageCircle', 'Conversación'],
      ['MessagesSquare', 'Foro'],
      ['Handshake', 'Acuerdo'],
      ['Hand', 'Participación'],
      ['HeartHandshake', 'Apoyo'],
      ['CircleHelp', 'Consulta'],
      ['Lightbulb', 'Idea'],
      ['Brain', 'Pensamiento'],
      ['Ear', 'Escucha'],
      ['Accessibility', 'Accesibilidad'],
    ],
  },
  {
    label: 'Disciplinas',
    icons: [
      ['Calculator', 'Cálculo'],
      ['Sigma', 'Sumatoria'],
      ['Pi', 'Matemáticas'],
      ['Radical', 'Raíz cuadrada'],
      ['Atom', 'Física'],
      ['FlaskConical', 'Química'],
      ['Microscope', 'Microscopía'],
      ['Dna', 'Biología'],
      ['TestTubeDiagonal', 'Laboratorio'],
      ['Binary', 'Computación'],
      ['Code2', 'Programación'],
      ['Terminal', 'Consola'],
      ['Globe2', 'Geografía'],
      ['Map', 'Mapa'],
      ['Landmark', 'Humanidades'],
      ['Palette', 'Arte'],
    ],
  },
  {
    label: 'Herramientas y recursos',
    icons: [
      ['Pencil', 'Lápiz'],
      ['PenTool', 'Diseño'],
      ['Ruler', 'Regla'],
      ['Compass', 'Compás'],
      ['Wrench', 'Herramienta'],
      ['Hammer', 'Construcción'],
      ['Scissors', 'Recorte'],
      ['Paperclip', 'Adjunto'],
      ['Link2', 'Enlace'],
      ['Video', 'Video'],
      ['Image', 'Imagen'],
      ['FileUp', 'Entrega de archivo'],
      ['Download', 'Descarga'],
      ['Laptop', 'Trabajo digital'],
      ['MonitorPlay', 'Clase en video'],
      ['Search', 'Investigación'],
    ],
  },
] as const satisfies readonly {
  label: string;
  icons: readonly (readonly [id: string, label: string])[];
}[];

export const defaultCustomNodeTypeIcon = { id: 'Shapes', label: 'Forma' } as const;

export type NodeTypeIconId =
  typeof defaultCustomNodeTypeIcon.id | (typeof teachingIconCatalog)[number]['icons'][number][0];

export const nodeTypeIcons = [
  defaultCustomNodeTypeIcon,
  ...teachingIconCatalog.flatMap(({ icons }) => icons.map(([id, label]) => ({ id, label }))),
] as readonly { id: NodeTypeIconId; label: string }[];

const nodeTypeColors = new Set<string>(nodeTypeColorPalette.map(({ value }) => value));
const nodeTypeIconIds = new Set<string>(nodeTypeIcons.map(({ id }) => id));

export function isNodeTypeColor(value: unknown): value is NodeTypeColor {
  return typeof value === 'string' && nodeTypeColors.has(value.toUpperCase());
}

export function isNodeTypeIconId(value: unknown): value is NodeTypeIconId {
  return typeof value === 'string' && nodeTypeIconIds.has(value);
}
