import type { Resource, RoadmapNodeDto } from '@/features/roadmap/types';

export const unreviewedResourcesMessage =
  'Revisa todos los recursos de este nodo antes de completarlo.';

export function withResourceReviews<Item extends { id: string }>(
  resources: readonly Item[],
  reviewedResourceIds: ReadonlySet<string>,
) {
  return resources.map((resource) => ({
    ...resource,
    isReviewed: reviewedResourceIds.has(resource.id),
  }));
}

export function unreviewedResourceIds(
  resourceIds: readonly string[],
  reviewedResourceIds: ReadonlySet<string>,
) {
  return resourceIds.filter((id) => !reviewedResourceIds.has(id));
}

export function hasUnreviewedResources(resources: readonly Pick<Resource, 'isReviewed'>[]) {
  return resources.some(({ isReviewed }) => !isReviewed);
}

function accessedResource(resource: Resource, countsAccess: boolean): Resource {
  return {
    ...resource,
    isReviewed: true,
    ...(countsAccess && resource.accessCount !== undefined
      ? { accessCount: resource.accessCount + 1 }
      : {}),
  };
}

export function withAccessedResource<Roadmap extends { nodes: readonly RoadmapNodeDto[] }>(
  roadmap: Roadmap,
  resourceId: string,
  countsAccess: boolean,
): Roadmap {
  const nodes = roadmap.nodes.map((node) =>
    'resources' in node
      ? {
          ...node,
          resources: node.resources.map((resource) =>
            resource.id === resourceId ? accessedResource(resource, countsAccess) : resource,
          ),
        }
      : node,
  );
  return { ...roadmap, nodes };
}
