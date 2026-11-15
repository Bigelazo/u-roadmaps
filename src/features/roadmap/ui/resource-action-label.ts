import type { Resource } from '@/features/roadmap/types';

export function resourceActionLabel(resource: Pick<Resource, 'type' | 'title'>) {
  return resource.type === 'FILE'
    ? `Descargar ${resource.title}`
    : `Abrir enlace ${resource.title}`;
}
