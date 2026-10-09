import type { RoadmapDto, RoadmapNode } from '@/features/roadmap/types';

export type PracticeExperience = 'student' | 'teaching';
export type PracticeAcademicTerm = Readonly<{ year: number; semester: number }>;

export const PRACTICE_ROADMAP_TITLE = 'Tutorial';
export const PRACTICE_COURSE_CODE = 'AA0000';

const nodeTypes = {
  content: 'practice-node-type-content',
  assessment: 'practice-node-type-assessment',
  supplementary: 'practice-node-type-supplementary',
} as const;

export const practiceNodeIds = {
  a: 'practice-node-a',
  b: 'practice-node-b',
  c: 'practice-node-c',
  d: 'practice-node-d',
  e: 'practice-node-e',
  f: 'practice-node-f',
  g: 'practice-node-g',
  h: 'practice-node-h',
} as const;

/** The simulated progress shown in the student experience. */
export const practiceStudentProgress = { completedNodeIds: [practiceNodeIds.a] } as const;
/** The Node change marks shown on the Practice roadmap. */
export const practiceNodeChangeCounts: Readonly<Record<string, number>> = {
  [practiceNodeIds.c]: 1,
};

function node(
  id: string,
  title: string,
  nodeTypeId: string,
  position: [number, number],
  description: string,
  extra: Partial<RoadmapNode> = {},
): RoadmapNode {
  return {
    id,
    title,
    nodeTypeId,
    positionX: position[0],
    positionY: position[1],
    description,
    resources: [],
    isVisible: true,
    isTeacherBlocked: false,
    ...extra,
  } as RoadmapNode;
}

function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The fixed Practice roadmap (ADR-0025) in the teaching shape. `today` is the
 * Chilean calendar day, so the Scheduled unlock stays in the future.
 */
export function practiceRoadmap(term: PracticeAcademicTerm, today: string): RoadmapDto {
  const dependency = (id: number, sourceNodeId: string, targetNodeId: string) => ({
    id: `practice-dependency-${id}`,
    sourceNodeId,
    targetNodeId,
    sourceHandle: 'right' as const,
    targetHandle: 'left' as const,
  });
  return {
    course: { code: PRACTICE_COURSE_CODE, name: PRACTICE_ROADMAP_TITLE, department: '' },
    courseOffering: { id: 'practice-course-offering', year: term.year, semester: term.semester },
    roadmap: { id: 'practice-roadmap', closedAt: null },
    nodeTypes: [
      {
        id: nodeTypes.content,
        name: 'Contenido',
        icon: 'BookOpen',
        color: '#024AD8',
        isPredefined: true,
      },
      {
        id: nodeTypes.assessment,
        name: 'Evaluación',
        icon: 'ClipboardCheck',
        color: '#FF5050',
        isPredefined: true,
      },
      {
        id: nodeTypes.supplementary,
        name: 'Material extra',
        icon: 'LibraryBig',
        color: '#356373',
        isPredefined: true,
      },
    ],
    nodes: [
      node(
        practiceNodeIds.a,
        'Introducción',
        nodeTypes.content,
        [0, 160],
        'Punto de partida del curso.',
      ),
      node(
        practiceNodeIds.b,
        'Conceptos básicos',
        nodeTypes.content,
        [320, 40],
        'Las ideas que usarás en el resto del curso.',
      ),
      node(
        practiceNodeIds.c,
        'Lectura complementaria',
        nodeTypes.supplementary,
        [320, 280],
        'Material para profundizar en la introducción.',
        {
          resources: [
            {
              id: 'practice-resource-link',
              title: 'Guía de estudio',
              url: 'https://www.u-cursos.cl',
              type: 'LINK',
            },
            {
              id: 'practice-resource-file',
              title: 'Apunte de lectura',
              url: '/practice-roadmap/apunte-de-lectura.txt',
              type: 'FILE',
            },
          ],
        },
      ),
      node(
        practiceNodeIds.d,
        'Ejercicios guiados',
        nodeTypes.content,
        [640, 40],
        'Ejercicios para aplicar los conceptos básicos.',
      ),
      node(
        practiceNodeIds.e,
        'Control 1',
        nodeTypes.assessment,
        [960, 160],
        'Primera evaluación del curso.',
      ),
      node(
        practiceNodeIds.f,
        'Proyecto final',
        nodeTypes.assessment,
        [1280, 40],
        'Se habilita cuando el equipo docente lo libere.',
        { isTeacherBlocked: true, teacherUnlockOn: addDays(today, 14) },
      ),
      node(
        practiceNodeIds.g,
        'Retroalimentación del control',
        nodeTypes.supplementary,
        [1280, 280],
        'Comentarios sobre el Control 1.',
      ),
      node(
        practiceNodeIds.h,
        'Material de apoyo',
        nodeTypes.supplementary,
        [640, 400],
        'Material que aún no se publica.',
        { isVisible: false },
      ),
    ],
    dependencies: [
      dependency(1, practiceNodeIds.a, practiceNodeIds.b),
      dependency(2, practiceNodeIds.a, practiceNodeIds.c),
      dependency(3, practiceNodeIds.b, practiceNodeIds.d),
      dependency(4, practiceNodeIds.b, practiceNodeIds.e),
      dependency(5, practiceNodeIds.c, practiceNodeIds.e),
      dependency(6, practiceNodeIds.d, practiceNodeIds.e),
      dependency(7, practiceNodeIds.e, practiceNodeIds.f),
      dependency(8, practiceNodeIds.e, practiceNodeIds.g),
    ],
  };
}

const exitOrigins = [/^\/academic-overview$/, /^\/courses\/[A-Za-z0-9%-]+\/\d{4}\/[12]$/];

/** Where "Salir" returns: an allow-listed origin, or the home page. */
export function practiceExitHref(origin: string | null | undefined) {
  return origin && exitOrigins.some((pattern) => pattern.test(origin)) ? origin : '/';
}
