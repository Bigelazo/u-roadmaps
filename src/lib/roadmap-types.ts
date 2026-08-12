export type RoadmapResource = {
  id: string;
  titulo: string;
  url: string;
  tipo: 'ARCHIVO' | 'ENLACE' | 'VIDEO';
};

export type RoadmapType = {
  id: string;
  nombre: string;
  color: string;
  predefinido: boolean;
};

export type RoadmapNode = {
  id: string;
  titulo: string;
  descripcion: string | null;
  posX: number;
  posY: number;
  typeId: string;
  visible: boolean;
  recursos: RoadmapResource[];
};

export type RoadmapDependency = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
};

export type RoadmapDto = {
  ramo: { codigo: string; nombre: string; departamento: string };
  curso: { id: string; anio: number; semestre: number };
  roadmap: { id: string };
  tipos: RoadmapType[];
  nodos: RoadmapNode[];
  dependencias: RoadmapDependency[];
};

export type CourseRoute = {
  ramo: string;
  anio: number;
  semestre: number;
};

export function roadmapUrl(route: CourseRoute, suffix = ''): string {
  return `/api/cursos/${encodeURIComponent(route.ramo)}/${route.anio}/${route.semestre}/roadmap${suffix}`;
}
