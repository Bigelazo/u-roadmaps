import type { Resource } from '@/features/roadmap/types';
import { resourcePreviewKind } from '@/features/roadmap/domain/resource-file-category';

export function resourceActionLabel(
  resource: Pick<Resource, 'type' | 'title' | 'fileContentType'>,
) {
  if (resource.type === 'LINK') return `Abrir enlace ${resource.title}`;
  return resourcePreviewKind(resource) ? `Ver ${resource.title}` : `Descargar ${resource.title}`;
}
