type ParticipationRole = 'STUDENT' | 'TEACHER';
type ResourceType = 'FILE' | 'LINK' | 'VIDEO';
type FixtureNodeKind = 'CONTENT' | 'ASSESSMENT' | 'SUPPLEMENTARY' | 'CUSTOM';
type DescriptionLength = 'SHORT' | 'MEDIUM' | 'LONG';
export type FileFormat = 'PDF' | 'MARKDOWN' | 'DOCX' | 'XLSX' | 'PPTX';

export type InstitutionalCoursePosition =
  | 'COORDINATING_PROFESSOR'
  | 'COURSE_PROFESSOR'
  | 'AUXILIARY_PROFESSOR'
  | 'TEACHING_ASSISTANT'
  | 'STUDENT';

const uuid = (prefix: string, number: number) =>
  `${prefix}-0000-4000-8000-${String(number).padStart(12, '0')}`;

const studentId = (number: number) => uuid('20000000', number);
const nodeId = (roadmapNumber: number, number: number) =>
  uuid('60000000', roadmapNumber * 100 + number);
const resourceId = (roadmapNumber: number, number: number) =>
  uuid('70000000', roadmapNumber * 100 + number);
const fileKey = (roadmapNumber: number, number: number) =>
  uuid('80000000', roadmapNumber * 100 + number);

export const developmentFixtureIds = {
  daniela: uuid('10000000', 1),
  nicolas: uuid('10000000', 2),
  camila: studentId(51),
  offerings: {
    cc1002: uuid('30000000', 1),
    ma1001: uuid('30000000', 2),
    fi1001Historical: uuid('30000000', 3),
    fi1001Current: uuid('30000000', 4),
  },
  roadmaps: {
    cc1002: uuid('40000000', 1),
    ma1001: uuid('40000000', 2),
    fi1001Historical: uuid('40000000', 3),
  },
  customNodeTypes: {
    cc1002: uuid('50000000', 1),
    ma1001: uuid('50000000', 2),
    fi1001Historical: uuid('50000000', 3),
  },
  predefinedNodeTypes: {
    content: uuid('00000000', 1),
    assessment: uuid('00000000', 2),
    supplementary: uuid('00000000', 3),
  },
} as const;

export const predefinedNodeTypes = [
  {
    id: developmentFixtureIds.predefinedNodeTypes.content,
    name: 'Contenido',
    icon: 'BookOpen',
    color: '#024AD8',
  },
  {
    id: developmentFixtureIds.predefinedNodeTypes.assessment,
    name: 'Evaluación',
    icon: 'ClipboardCheck',
    color: '#FF5050',
  },
  {
    id: developmentFixtureIds.predefinedNodeTypes.supplementary,
    name: 'Material extra',
    icon: 'LibraryBig',
    color: '#356373',
  },
] as const;

export const developmentFixtureCourses = [
  {
    code: 'CC1002',
    name: 'Introducción a la Programación',
    department: 'Departamento de Ciencias de la Computación',
  },
  {
    code: 'MA1001',
    name: 'Introducción al Cálculo',
    department: 'Departamento de Ingeniería Matemática',
  },
  {
    code: 'FI1001',
    name: 'Introducción a la Física Newtoniana',
    department: 'Departamento de Física',
  },
] as const;

const studentNames = [
  'Antonia Valdés Pino',
  'Benjamín Cárdenas Leiva',
  'Catalina Sepúlveda Riquelme',
  'Diego Araya Contreras',
  'Emilia González Vera',
  'Felipe Muñoz Tapia',
  'Gabriela Navarro Fuentes',
  'Héctor Arancibia Silva',
  'Isidora Paredes Moya',
  'Joaquín Salas Carrasco',
  'Karina Olivares Reyes',
  'Leonardo Bustos Ávila',
  'Martina Figueroa Díaz',
  'Nicolás Cabrera Soto',
  'Olivia Rojas Henríquez',
  'Pablo Escobar Valenzuela',
  'Renata Tapia Morales',
  'Sebastián Vidal Castro',
  'Trinidad Espinoza Rivas',
  'Vicente Loyola Correa',
  'Amanda Sanhueza Araya',
  'Bastián Quezada Lagos',
  'Constanza Mella Pizarro',
  'Daniel Ibarra Flores',
  'Elena Yáñez Bravo',
  'Francisco Barría Soto',
  'Ignacia Palma Herrera',
  'Javiera Toledo Muñoz',
  'Lautaro Méndez Araya',
  'María José Cifuentes',
  'Noelia Villarroel Soto',
  'Óscar Pino Aravena',
  'Paulina Guerra Reyes',
  'Raimundo Godoy Silva',
  'Sofía Cordero Fuentes',
  'Tomás Riquelme Mena',
  'Valentina Lagos Vera',
  'Wilhelm Soto Rojas',
  'Ximena Arriagada Díaz',
  'Yasna Concha Silva',
  'Álvaro Neira Paredes',
  'Bárbara Pavez Gutiérrez',
  'Cristóbal Ferrada Moya',
  'Dominga Leiva Jara',
  'Esteban Cáceres Mella',
  'Fernanda Orellana Ríos',
  'Gonzalo Rivas Araya',
  'Helena Varela Soto',
  'Iván Jara Pino',
  'Josefa Mardones Díaz',
] as const;

export const fixtureUsers = [
  {
    id: developmentFixtureIds.daniela,
    name: 'Daniela Rojas Mella',
    institutionalEmail: 'daniela.rojas@u-roadmaps.test',
    rut: '10000001',
  },
  {
    id: developmentFixtureIds.nicolas,
    name: 'Nicolás Fuentes Arancibia',
    institutionalEmail: 'nicolas.fuentes@u-roadmaps.test',
    rut: '10000002',
  },
  ...studentNames.map((name, index) => ({
    id: studentId(index + 1),
    name,
    institutionalEmail: `${name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-CL')
      .replaceAll(' ', '.')}@u-roadmaps.test`,
    rut: `20000${String(index + 1).padStart(3, '0')}`,
  })),
  {
    id: developmentFixtureIds.camila,
    name: 'Camila Morales Soto',
    institutionalEmail: 'camila.morales@u-roadmaps.test',
    rut: '20000051',
  },
] as const;

type Participation = {
  userId: string;
  courseOfferingId: string;
  role: ParticipationRole;
  isActive: boolean;
  institutionalPosition: InstitutionalCoursePosition;
  section: string | null;
};

const studentParticipation = (
  userId: string,
  courseOfferingId: string,
  section: string,
  isActive = true,
): Participation => ({
  userId,
  courseOfferingId,
  role: 'STUDENT',
  isActive,
  institutionalPosition: 'STUDENT',
  section,
});

const teacherParticipation = (
  userId: string,
  courseOfferingId: string,
  institutionalPosition: Exclude<InstitutionalCoursePosition, 'STUDENT'>,
): Participation => ({
  userId,
  courseOfferingId,
  role: 'TEACHER',
  isActive: true,
  institutionalPosition,
  section: null,
});

const regularStudents = Array.from({ length: 50 }, (_, index) => studentId(index + 1));
const sections = (students: readonly string[]) => [
  { label: '1', memberIds: students.slice(0, Math.ceil(students.length / 2)) },
  { label: '2', memberIds: students.slice(Math.ceil(students.length / 2)) },
];

export const developmentFixtureOfferings = [
  {
    id: developmentFixtureIds.offerings.cc1002,
    courseCode: 'CC1002',
    year: 2026,
    semester: 2,
    sections: sections(regularStudents),
  },
  {
    id: developmentFixtureIds.offerings.ma1001,
    courseCode: 'MA1001',
    year: 2026,
    semester: 2,
    sections: sections([...regularStudents.slice(0, 49), developmentFixtureIds.camila]),
  },
  {
    id: developmentFixtureIds.offerings.fi1001Historical,
    courseCode: 'FI1001',
    year: 2026,
    semester: 1,
    sections: sections([
      ...regularStudents.slice(0, 48),
      developmentFixtureIds.nicolas,
      developmentFixtureIds.camila,
    ]),
  },
  {
    id: developmentFixtureIds.offerings.fi1001Current,
    courseCode: 'FI1001',
    year: 2026,
    semester: 2,
    sections: sections([
      ...regularStudents,
      developmentFixtureIds.nicolas,
      developmentFixtureIds.camila,
    ]),
    copyCandidateRoadmapId: developmentFixtureIds.roadmaps.fi1001Historical,
  },
] as const;

export const fixtureParticipations: Participation[] = [
  teacherParticipation(
    developmentFixtureIds.daniela,
    developmentFixtureIds.offerings.cc1002,
    'COORDINATING_PROFESSOR',
  ),
  teacherParticipation(
    developmentFixtureIds.nicolas,
    developmentFixtureIds.offerings.cc1002,
    'AUXILIARY_PROFESSOR',
  ),
  teacherParticipation(
    developmentFixtureIds.camila,
    developmentFixtureIds.offerings.cc1002,
    'COURSE_PROFESSOR',
  ),
  ...regularStudents.map((id, index) =>
    studentParticipation(
      id,
      developmentFixtureIds.offerings.cc1002,
      index < 25 ? '1' : '2',
      id !== studentId(50),
    ),
  ),
  teacherParticipation(
    developmentFixtureIds.daniela,
    developmentFixtureIds.offerings.ma1001,
    'COURSE_PROFESSOR',
  ),
  teacherParticipation(
    developmentFixtureIds.nicolas,
    developmentFixtureIds.offerings.ma1001,
    'TEACHING_ASSISTANT',
  ),
  ...[...regularStudents.slice(0, 49), developmentFixtureIds.camila].map((id, index) =>
    studentParticipation(
      id,
      developmentFixtureIds.offerings.ma1001,
      index < 25 ? '1' : '2',
      id !== studentId(49),
    ),
  ),
  teacherParticipation(
    developmentFixtureIds.daniela,
    developmentFixtureIds.offerings.fi1001Historical,
    'COURSE_PROFESSOR',
  ),
  ...[
    ...regularStudents.slice(0, 48),
    developmentFixtureIds.nicolas,
    developmentFixtureIds.camila,
  ].map((id, index) =>
    studentParticipation(
      id,
      developmentFixtureIds.offerings.fi1001Historical,
      index < 25 ? '1' : '2',
      id !== studentId(48),
    ),
  ),
  teacherParticipation(
    developmentFixtureIds.daniela,
    developmentFixtureIds.offerings.fi1001Current,
    'COURSE_PROFESSOR',
  ),
  ...regularStudents.map((id, index) =>
    studentParticipation(
      id,
      developmentFixtureIds.offerings.fi1001Current,
      index < 26 ? '1' : '2',
      id !== studentId(47),
    ),
  ),
  studentParticipation(
    developmentFixtureIds.nicolas,
    developmentFixtureIds.offerings.fi1001Current,
    '2',
  ),
  studentParticipation(
    developmentFixtureIds.camila,
    developmentFixtureIds.offerings.fi1001Current,
    '2',
    false,
  ),
];

type NodeBlueprint = {
  title: string;
  focus: string;
  kind: FixtureNodeKind;
};

type ResourceBlueprint = {
  node: number;
  title: string;
  type: ResourceType;
  url: string;
  fileFormat?: FileFormat;
};

type NodePosition = { x: number; y: number };
type DependencyBlueprint = {
  source: number;
  target: number;
  sourceHandle?: 'top' | 'right' | 'bottom' | 'left';
  targetHandle?: 'top' | 'right' | 'bottom' | 'left';
};

type RoadmapBlueprint = {
  id: string;
  courseOfferingId: string;
  customNodeType: { id: string; name: string; icon: string; color: string };
  theme: string;
  layout: 'HORIZONTAL' | 'VERTICAL' | 'MIXED';
  nodes: readonly NodeBlueprint[];
  positions: readonly NodePosition[];
  dependencies: readonly DependencyBlueprint[];
  resources: readonly ResourceBlueprint[];
};

const nodeKinds: readonly FixtureNodeKind[] = [
  'CONTENT',
  'CONTENT',
  'CONTENT',
  'CONTENT',
  'CONTENT',
  'CONTENT',
  'CONTENT',
  'SUPPLEMENTARY',
  'SUPPLEMENTARY',
  'SUPPLEMENTARY',
  'ASSESSMENT',
  'CUSTOM',
  'CUSTOM',
  'ASSESSMENT',
  'ASSESSMENT',
];

const descriptionLengthForNode = (index: number): DescriptionLength =>
  index < 4 ? 'SHORT' : index < 11 ? 'MEDIUM' : 'LONG';

function nodeDescription(theme: string, title: string, focus: string, length: DescriptionLength) {
  const core = [
    `En ${title}, el recorrido de ${theme} trabaja ${focus}.`,
    'La actividad propone distinguir las ideas centrales, justificar decisiones y conectar el resultado con los conceptos que ya aparecen en el mapa.',
    'Se espera que cada persona registre dudas concretas, pruebe un procedimiento propio y use la retroalimentación para ajustar su explicación.',
  ];
  if (length === 'SHORT') {
    return [
      core[0],
      'El objetivo es reconocer el vocabulario esencial y dejar una base verificable para el siguiente nodo.',
      'Antes de continuar, conviene resolver un ejemplo pequeño y explicar por qué la estrategia elegida funciona.',
    ].join(' ');
  }
  if (length === 'MEDIUM') {
    return [
      ...core,
      'El material asociado sirve para contrastar una solución inicial con casos límite, representaciones alternativas y errores frecuentes.',
      'La evidencia de aprendizaje no es repetir una receta: es poder anticipar qué cambiaría si las condiciones del problema cambian.',
      'Al finalizar, la persona debería poder comunicar el razonamiento con precisión y reconocer qué prerrequisito necesita revisar.',
    ].join(' ');
  }
  return [
    [
      ...core,
      'Primero se construye una representación del problema, se separan sus supuestos y se elige una estrategia que pueda comprobarse paso a paso.',
      'Después se comparan resultados plausibles, se documentan los intentos que no funcionaron y se explica cómo esa evidencia orienta una corrección.',
      'La práctica está diseñada para que el avance sea visible tanto en una respuesta escrita como en una conversación breve con el equipo docente.',
    ].join(' '),
    [
      'El cierre recupera la relación de este nodo con sus prerrequisitos y con los caminos que siguen en el roadmap.',
      'No basta con obtener una respuesta: se debe indicar qué dato, definición o principio permitió decidir y qué señal advertiría una interpretación equivocada.',
      'Quien complete la actividad podrá reutilizar el procedimiento en una situación nueva, elegir recursos de apoyo pertinentes y describir con honestidad el alcance de su solución.',
      'Así, el nodo funciona como una pieza de aprendizaje conectada y no como una lista aislada de ejercicios.',
    ].join(' '),
  ].join('\n\n');
}

const commonDependencies: readonly DependencyBlueprint[] = [
  { source: 1, target: 2 },
  { source: 2, target: 3 },
  { source: 3, target: 4 },
  { source: 3, target: 5 },
  { source: 4, target: 6 },
  { source: 5, target: 7 },
  { source: 6, target: 8 },
  { source: 7, target: 8 },
  { source: 8, target: 9 },
  { source: 9, target: 10 },
  { source: 8, target: 11 },
  { source: 10, target: 12 },
  { source: 12, target: 14 },
  { source: 10, target: 15 },
];

const cc1002Resources: readonly ResourceBlueprint[] = [
  {
    node: 1,
    title: 'Programa y herramientas del curso',
    type: 'LINK',
    url: 'https://ucampus.uchile.cl/',
  },
  { node: 2, title: 'Guía de variables.pdf', type: 'FILE', url: '', fileFormat: 'PDF' },
  {
    node: 4,
    title: 'Video: diseñar funciones pequeñas',
    type: 'VIDEO',
    url: 'https://www.youtube.com/watch?v=8mAITcNt710',
  },
  {
    node: 5,
    title: 'Referencia de listas en Python',
    type: 'LINK',
    url: 'https://docs.python.org/es/3/tutorial/',
  },
  {
    node: 7,
    title: 'Plantilla para análisis de archivos.docx',
    type: 'FILE',
    url: '',
    fileFormat: 'DOCX',
  },
  { node: 8, title: 'Notas de práctica guiada.md', type: 'FILE', url: '', fileFormat: 'MARKDOWN' },
  { node: 8, title: 'Casos de prueba de práctica.xlsx', type: 'FILE', url: '', fileFormat: 'XLSX' },
  { node: 8, title: 'Presentación de la práctica.pptx', type: 'FILE', url: '', fileFormat: 'PPTX' },
  {
    node: 8,
    title: 'Video: depurar con evidencia',
    type: 'VIDEO',
    url: 'https://www.youtube.com/watch?v=8mAITcNt710',
  },
  {
    node: 10,
    title: 'Documentación de módulos',
    type: 'LINK',
    url: 'https://developer.mozilla.org/es/docs/Learn',
  },
  {
    node: 12,
    title: 'Rúbrica del laboratorio de integración',
    type: 'LINK',
    url: 'https://www.khanacademy.org/computing',
  },
  {
    node: 13,
    title: 'Material reservado del proyecto.pdf',
    type: 'FILE',
    url: '',
    fileFormat: 'PDF',
  },
];

const ma1001Resources: readonly ResourceBlueprint[] = [
  { node: 1, title: 'Repaso de lenguaje matemático', type: 'LINK', url: 'https://ocw.mit.edu/' },
  { node: 2, title: 'Guía de funciones.md', type: 'FILE', url: '', fileFormat: 'MARKDOWN' },
  {
    node: 4,
    title: 'Video: interpretar una gráfica',
    type: 'VIDEO',
    url: 'https://www.youtube.com/watch?v=Vf7fCTaYgHc',
  },
  {
    node: 5,
    title: 'Colección de problemas de tasas',
    type: 'LINK',
    url: 'https://www.khanacademy.org/math/calculus-1',
  },
  { node: 7, title: 'Plantilla de demostraciones.docx', type: 'FILE', url: '', fileFormat: 'DOCX' },
  {
    node: 8,
    title: 'Lectura sobre continuidad',
    type: 'LINK',
    url: 'https://es.wikipedia.org/wiki/Continuidad_(matem%C3%A1tica)',
  },
  { node: 10, title: 'Láminas para derivadas.pptx', type: 'FILE', url: '', fileFormat: 'PPTX' },
  {
    node: 12,
    title: 'Lista de verificación para el taller',
    type: 'LINK',
    url: 'https://www.desmos.com/calculator',
  },
  { node: 14, title: 'Datos para el control.xlsx', type: 'FILE', url: '', fileFormat: 'XLSX' },
];

const fi1001Resources: readonly ResourceBlueprint[] = [
  {
    node: 1,
    title: 'Unidades y mediciones del laboratorio',
    type: 'LINK',
    url: 'https://physics.nist.gov/cuu/Units/',
  },
  { node: 2, title: 'Guía de vectores.pdf', type: 'FILE', url: '', fileFormat: 'PDF' },
  {
    node: 4,
    title: 'Video: diagramas de cuerpo libre',
    type: 'VIDEO',
    url: 'https://www.youtube.com/watch?v=K_m3N6MZp6I',
  },
  {
    node: 5,
    title: 'Simulador de movimiento',
    type: 'LINK',
    url: 'https://phet.colorado.edu/es/simulations',
  },
  { node: 7, title: 'Bitácora de energía.docx', type: 'FILE', url: '', fileFormat: 'DOCX' },
  { node: 8, title: 'Protocolo de experimento.md', type: 'FILE', url: '', fileFormat: 'MARKDOWN' },
  { node: 8, title: 'Registro experimental.xlsx', type: 'FILE', url: '', fileFormat: 'XLSX' },
  { node: 8, title: 'Síntesis de resultados.pptx', type: 'FILE', url: '', fileFormat: 'PPTX' },
  {
    node: 8,
    title: 'Video: conservar momentum',
    type: 'VIDEO',
    url: 'https://www.youtube.com/watch?v=K_m3N6MZp6I',
  },
  {
    node: 10,
    title: 'Referencia de gravitación',
    type: 'LINK',
    url: 'https://science.nasa.gov/universe/gravity/',
  },
  {
    node: 12,
    title: 'Instrumentos y criterios del taller',
    type: 'LINK',
    url: 'https://phet.colorado.edu/es/simulations',
  },
  {
    node: 13,
    title: 'Registro externo de actividad experimental',
    type: 'LINK',
    url: 'https://ocw.mit.edu/',
  },
];

const roadmapBlueprints: readonly RoadmapBlueprint[] = [
  {
    id: developmentFixtureIds.roadmaps.cc1002,
    courseOfferingId: developmentFixtureIds.offerings.cc1002,
    customNodeType: {
      id: developmentFixtureIds.customNodeTypes.cc1002,
      name: 'Laboratorio',
      icon: 'Shapes',
      color: '#00758A',
    },
    theme: 'programación funcional e imperativa',
    layout: 'HORIZONTAL',
    nodes: [
      {
        title: 'Variables',
        focus: 'variables, tipos y representaciones de datos simples',
        kind: nodeKinds[0],
      },
      {
        title: 'Expresiones',
        focus: 'expresiones, operadores y evaluación controlada',
        kind: nodeKinds[1],
      },
      {
        title: 'Condiciones',
        focus: 'decisiones condicionales y casos mutuamente excluyentes',
        kind: nodeKinds[2],
      },
      { title: 'Funciones', focus: 'funciones pequeñas con contratos claros', kind: nodeKinds[3] },
      {
        title: 'Listas',
        focus: 'colecciones, recorridos y transformación de secuencias',
        kind: nodeKinds[4],
      },
      {
        title: 'Recursión',
        focus: 'casos base, llamadas recursivas y reducción estructural',
        kind: nodeKinds[5],
      },
      {
        title: 'Archivos',
        focus: 'lectura, escritura y validación de datos persistentes',
        kind: nodeKinds[6],
      },
      {
        title: 'Práctica guiada',
        focus: 'integración de ramas mediante una actividad acompañada',
        kind: nodeKinds[7],
      },
      {
        title: 'Depuración',
        focus: 'observación de fallas, pruebas pequeñas y trazas',
        kind: nodeKinds[8],
      },
      {
        title: 'Módulos',
        focus: 'separación de responsabilidades y reutilización de código',
        kind: nodeKinds[9],
      },
      {
        title: 'Evaluación de programación funcional',
        focus: 'resolución individual de problemas funcionales',
        kind: nodeKinds[10],
      },
      {
        title: 'Laboratorio de integración imperativa',
        focus: 'construcción colaborativa de una solución imperativa',
        kind: nodeKinds[11],
      },
      {
        title: 'Proyecto de datos con archivos',
        focus: 'diseño de un programa que procesa datos y archivos',
        kind: nodeKinds[12],
      },
      {
        title: 'Control de estructuras y pruebas',
        focus: 'verificación de estructuras, contratos y pruebas',
        kind: nodeKinds[13],
      },
      {
        title: 'Evaluación final sobre diseño de programas y resolución de problemas',
        focus: 'síntesis de decisiones de diseño y razonamiento algorítmico',
        kind: nodeKinds[14],
      },
    ],
    positions: [
      { x: 0, y: 360 },
      { x: 240, y: 360 },
      { x: 480, y: 360 },
      { x: 720, y: 240 },
      { x: 720, y: 480 },
      { x: 960, y: 240 },
      { x: 960, y: 480 },
      { x: 1200, y: 360 },
      { x: 1440, y: 360 },
      { x: 1680, y: 360 },
      { x: 1200, y: 120 },
      { x: 1920, y: 360 },
      { x: 2160, y: 360 },
      { x: 2400, y: 240 },
      { x: 1920, y: 600 },
    ],
    dependencies: commonDependencies,
    resources: cc1002Resources,
  },
  {
    id: developmentFixtureIds.roadmaps.ma1001,
    courseOfferingId: developmentFixtureIds.offerings.ma1001,
    customNodeType: {
      id: developmentFixtureIds.customNodeTypes.ma1001,
      name: 'Taller de problemas',
      icon: 'Shapes',
      color: '#BD5800',
    },
    theme: 'fundamentos matemáticos, límites y derivadas',
    layout: 'VERTICAL',
    nodes: [
      {
        title: 'Conjuntos',
        focus: 'conjuntos, intervalos y notación matemática',
        kind: nodeKinds[0],
      },
      {
        title: 'Funciones',
        focus: 'dominio, recorrido y composición de funciones',
        kind: nodeKinds[1],
      },
      {
        title: 'Gráficas',
        focus: 'lectura de gráficas y transformaciones elementales',
        kind: nodeKinds[2],
      },
      { title: 'Sucesiones', focus: 'patrones, sucesiones y aproximaciones', kind: nodeKinds[3] },
      { title: 'Tasas', focus: 'tasas de cambio y comparación de variaciones', kind: nodeKinds[4] },
      {
        title: 'Límites',
        focus: 'límites laterales, estimación y comportamiento local',
        kind: nodeKinds[5],
      },
      {
        title: 'Continuidad',
        focus: 'continuidad y condiciones de existencia',
        kind: nodeKinds[6],
      },
      {
        title: 'Ejercicios guiados',
        focus: 'práctica gradual de argumentos y cálculos',
        kind: nodeKinds[7],
      },
      {
        title: 'Errores frecuentes',
        focus: 'diagnóstico de confusiones habituales en límites',
        kind: nodeKinds[8],
      },
      {
        title: 'Reglas de derivación',
        focus: 'reglas de derivación y sus supuestos',
        kind: nodeKinds[9],
      },
      {
        title: 'Evaluación de límites y continuidad',
        focus: 'aplicación individual de límites y continuidad',
        kind: nodeKinds[10],
      },
      {
        title: 'Taller de problemas con derivadas',
        focus: 'discusión colaborativa de problemas de derivadas',
        kind: nodeKinds[11],
      },
      {
        title: 'Taller de modelamiento de cambios',
        focus: 'modelamiento de un fenómeno mediante tasas de cambio',
        kind: nodeKinds[12],
      },
      {
        title: 'Control de reglas y aplicaciones',
        focus: 'argumentación y cálculo en situaciones de derivación',
        kind: nodeKinds[13],
      },
      {
        title: 'Evaluación final de funciones límites derivadas y modelamiento matemático',
        focus: 'síntesis de la progresión matemática del curso',
        kind: nodeKinds[14],
      },
    ],
    positions: [
      { x: 480, y: 0 },
      { x: 480, y: 180 },
      { x: 480, y: 360 },
      { x: 240, y: 540 },
      { x: 720, y: 540 },
      { x: 240, y: 720 },
      { x: 720, y: 720 },
      { x: 480, y: 900 },
      { x: 480, y: 1080 },
      { x: 480, y: 1260 },
      { x: 120, y: 900 },
      { x: 480, y: 1440 },
      { x: 480, y: 1620 },
      { x: 180, y: 1620 },
      { x: 780, y: 1260 },
    ],
    dependencies: commonDependencies.map((dependency) => ({
      ...dependency,
      sourceHandle: dependency.sourceHandle ?? 'bottom',
      targetHandle: dependency.targetHandle ?? 'top',
    })),
    resources: ma1001Resources,
  },
  {
    id: developmentFixtureIds.roadmaps.fi1001Historical,
    courseOfferingId: developmentFixtureIds.offerings.fi1001Historical,
    customNodeType: {
      id: developmentFixtureIds.customNodeTypes.fi1001Historical,
      name: 'Actividad experimental',
      icon: 'Shapes',
      color: '#007C75',
    },
    theme: 'análisis cuantitativo y física newtoniana',
    layout: 'MIXED',
    nodes: [
      {
        title: 'Magnitudes',
        focus: 'magnitudes, unidades y estimación de incertidumbre',
        kind: nodeKinds[0],
      },
      {
        title: 'Vectores',
        focus: 'vectores, componentes y operaciones geométricas',
        kind: nodeKinds[1],
      },
      {
        title: 'Cinemática',
        focus: 'posición, velocidad y aceleración en una dimensión',
        kind: nodeKinds[2],
      },
      {
        title: 'Fuerzas',
        focus: 'fuerzas, diagramas de cuerpo libre y resultantes',
        kind: nodeKinds[3],
      },
      {
        title: 'Movimiento circular',
        focus: 'trayectorias circulares y aceleración centrípeta',
        kind: nodeKinds[4],
      },
      {
        title: 'Leyes de Newton',
        focus: 'las leyes de Newton como modelo predictivo',
        kind: nodeKinds[5],
      },
      {
        title: 'Rozamiento',
        focus: 'rozamiento, tensión y restricciones de movimiento',
        kind: nodeKinds[6],
      },
      {
        title: 'Experimento guiado',
        focus: 'diseño y lectura de una medición controlada',
        kind: nodeKinds[7],
      },
      {
        title: 'Conservación',
        focus: 'conservación de energía y momentum lineal',
        kind: nodeKinds[8],
      },
      {
        title: 'Gravitación',
        focus: 'interacción gravitatoria y escalas de distancia',
        kind: nodeKinds[9],
      },
      {
        title: 'Evaluación de dinámica y fuerzas',
        focus: 'resolución individual de situaciones dinámicas',
        kind: nodeKinds[10],
      },
      {
        title: 'Actividad experimental de energía',
        focus: 'contraste experimental entre trabajo y energía',
        kind: nodeKinds[11],
      },
      {
        title: 'Actividad experimental de momentum',
        focus: 'análisis de momentum a partir de datos medidos',
        kind: nodeKinds[12],
      },
      {
        title: 'Control de conservación y gravitación',
        focus: 'justificación de principios de conservación y gravitación',
        kind: nodeKinds[13],
      },
      {
        title: 'Evaluación final de mecánica energía momentum y gravitación newtoniana',
        focus: 'integración de modelos newtonianos en problemas cuantitativos',
        kind: nodeKinds[14],
      },
    ],
    positions: [
      { x: 0, y: 480 },
      { x: 240, y: 480 },
      { x: 480, y: 480 },
      { x: 720, y: 240 },
      { x: 720, y: 720 },
      { x: 960, y: 240 },
      { x: 960, y: 720 },
      { x: 1200, y: 480 },
      { x: 1440, y: 480 },
      { x: 1680, y: 480 },
      { x: 1200, y: 0 },
      { x: 1680, y: 720 },
      { x: 1920, y: 720 },
      { x: 2160, y: 480 },
      { x: 1680, y: 960 },
    ],
    dependencies: [
      { source: 1, target: 2, sourceHandle: 'right', targetHandle: 'left' },
      { source: 2, target: 3, sourceHandle: 'right', targetHandle: 'left' },
      { source: 3, target: 4, sourceHandle: 'top', targetHandle: 'left' },
      { source: 3, target: 5, sourceHandle: 'bottom', targetHandle: 'left' },
      { source: 4, target: 6, sourceHandle: 'right', targetHandle: 'left' },
      { source: 5, target: 7, sourceHandle: 'right', targetHandle: 'left' },
      { source: 6, target: 8, sourceHandle: 'bottom', targetHandle: 'left' },
      { source: 7, target: 8, sourceHandle: 'top', targetHandle: 'left' },
      { source: 8, target: 9, sourceHandle: 'right', targetHandle: 'left' },
      { source: 9, target: 10, sourceHandle: 'right', targetHandle: 'left' },
      { source: 8, target: 11, sourceHandle: 'top', targetHandle: 'bottom' },
      { source: 10, target: 12, sourceHandle: 'bottom', targetHandle: 'left' },
      { source: 12, target: 13, sourceHandle: 'right', targetHandle: 'left' },
      { source: 12, target: 14, sourceHandle: 'top', targetHandle: 'right' },
      { source: 10, target: 15, sourceHandle: 'bottom', targetHandle: 'top' },
    ],
    resources: fi1001Resources,
  },
];

const nodeTypeIdFor = (kind: FixtureNodeKind, customNodeTypeId: string) => {
  if (kind === 'CONTENT') return developmentFixtureIds.predefinedNodeTypes.content;
  if (kind === 'ASSESSMENT') return developmentFixtureIds.predefinedNodeTypes.assessment;
  if (kind === 'SUPPLEMENTARY') return developmentFixtureIds.predefinedNodeTypes.supplementary;
  return customNodeTypeId;
};

const fileMetadata: Record<FileFormat, { extension: string; contentType: string }> = {
  PDF: { extension: 'pdf', contentType: 'application/pdf' },
  MARKDOWN: { extension: 'md', contentType: 'text/markdown; charset=utf-8' },
  DOCX: {
    extension: 'docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  XLSX: {
    extension: 'xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  PPTX: {
    extension: 'pptx',
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
};

type FixtureResource = {
  id: string;
  roadmapNodeId: string;
  title: string;
  type: ResourceType;
  url: string;
  fileKey?: string;
  fileContentType?: string;
  fileFormat?: FileFormat;
};

function materializeRoadmap(blueprint: RoadmapBlueprint, roadmapIndex: number) {
  const nodes = blueprint.nodes.map((node, index) => ({
    id: nodeId(roadmapIndex, index + 1),
    roadmapId: blueprint.id,
    nodeTypeId: nodeTypeIdFor(node.kind, blueprint.customNodeType.id),
    title: node.title,
    description: nodeDescription(
      blueprint.theme,
      node.title,
      node.focus,
      descriptionLengthForNode(index),
    ),
    positionX: blueprint.positions[index].x,
    positionY: blueprint.positions[index].y,
    isVisible: index !== 12,
  }));
  const resources: FixtureResource[] = blueprint.resources.map((resource, index) => {
    const id = resourceId(roadmapIndex, index + 1);
    const metadata = resource.fileFormat ? fileMetadata[resource.fileFormat] : undefined;
    const reservedFileKey = resource.fileFormat ? fileKey(roadmapIndex, index + 1) : undefined;
    return {
      id,
      roadmapNodeId: nodes[resource.node - 1].id,
      title: resource.title,
      type: resource.type,
      url: reservedFileKey ? `https://files.u-roadmaps.invalid/${reservedFileKey}` : resource.url,
      ...(reservedFileKey
        ? {
            fileKey: reservedFileKey,
            fileContentType: metadata?.contentType,
            fileFormat: resource.fileFormat,
          }
        : {}),
    };
  });
  return {
    id: blueprint.id,
    courseOfferingId: blueprint.courseOfferingId,
    layout: blueprint.layout,
    customNodeType: blueprint.customNodeType,
    nodes,
    dependencies: blueprint.dependencies.map((dependency) => ({
      sourceNodeId: nodes[dependency.source - 1].id,
      targetNodeId: nodes[dependency.target - 1].id,
      sourceHandle: dependency.sourceHandle ?? 'right',
      targetHandle: dependency.targetHandle ?? 'left',
    })),
    resources,
  };
}

export const fixtureRoadmaps = roadmapBlueprints.map(materializeRoadmap);
export const fixtureResources = fixtureRoadmaps.flatMap((roadmap) => roadmap.resources);
export const fixtureFileAssets = fixtureResources.flatMap((resource) =>
  resource.fileKey && resource.fileContentType && resource.fileFormat
    ? [
        {
          fileKey: resource.fileKey,
          title: resource.title,
          contentType: resource.fileContentType,
          format: resource.fileFormat,
        },
      ]
    : [],
);

const progressGroups = [
  { count: 8, completedNodeIndexes: [] },
  { count: 10, completedNodeIndexes: [1, 2] },
  { count: 12, completedNodeIndexes: [1, 2, 3, 4, 6] },
  { count: 10, completedNodeIndexes: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { count: 7, completedNodeIndexes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { count: 3, completedNodeIndexes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15] },
] as const;

const completionStudentsByRoadmap = [
  regularStudents,
  [...regularStudents.slice(0, 49), developmentFixtureIds.camila],
  [...regularStudents.slice(0, 48), developmentFixtureIds.nicolas, developmentFixtureIds.camila],
] as const;

export const fixtureCompletions = fixtureRoadmaps.flatMap((roadmap, roadmapIndex) => {
  let studentOffset = 0;
  return progressGroups.flatMap((group) => {
    const students = completionStudentsByRoadmap[roadmapIndex].slice(
      studentOffset,
      studentOffset + group.count,
    );
    studentOffset += group.count;
    return students.flatMap((userId) =>
      group.completedNodeIndexes.map((nodeIndex) => ({
        userId,
        roadmapNodeId: roadmap.nodes[nodeIndex - 1].id,
        completedAt: new Date('2026-08-15T12:00:00.000Z'),
      })),
    );
  });
});

// These make the development personas visibly exercise the two independent
// teacher simulations for CC1002. They never share or alter student progress.
export const fixtureSimulatedCompletions = [
  {
    userId: developmentFixtureIds.daniela,
    courseOfferingId: developmentFixtureIds.offerings.cc1002,
    roadmapId: developmentFixtureIds.roadmaps.cc1002,
    roadmapNodeId: fixtureRoadmaps[0].nodes[0].id,
  },
  {
    userId: developmentFixtureIds.nicolas,
    courseOfferingId: developmentFixtureIds.offerings.cc1002,
    roadmapId: developmentFixtureIds.roadmaps.cc1002,
    roadmapNodeId: fixtureRoadmaps[0].nodes[1].id,
  },
] as const;

export const reservedFixtureOfferingIds = developmentFixtureOfferings.map(({ id }) => id);
export const reservedFixtureUserIds = [
  developmentFixtureIds.daniela,
  developmentFixtureIds.nicolas,
  ...Array.from({ length: 55 }, (_, index) => studentId(index + 1)),
];

export const developmentPersonas = [
  { id: developmentFixtureIds.daniela, label: 'Daniela Rojas Mella' },
  { id: developmentFixtureIds.nicolas, label: 'Nicolás Fuentes Arancibia' },
  { id: developmentFixtureIds.camila, label: 'Camila Morales Soto' },
];
