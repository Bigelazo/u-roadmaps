import { roadmapUrl } from '@/features/roadmap/client';
import type { StudentRoadmapDto } from '@/features/roadmap/types';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';

async function failureMessage(response: Response, fallback: string) {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
    ) {
      return body.error.message;
    }
  } catch {
    // Keep the user-facing fallback when an existing route has no JSON error body.
  }
  return fallback;
}

function isStudentRoadmap(value: unknown): value is StudentRoadmapDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    'nodeTypes' in value &&
    Array.isArray(value.nodeTypes) &&
    value.nodes.every((node) => typeof node === 'object' && node !== null && 'access' in node)
  );
}

export const httpRoadmapCanvasSessionPersistence: RoadmapCanvasSessionPersistence = {
  async load({ courseOffering }) {
    const response = await fetch(roadmapUrl(courseOffering.identifier));
    if (!response.ok) throw new Error(await failureMessage(response, 'No se pudo cargar el roadmap.'));
    const body: unknown = await response.json();
    if (!isStudentRoadmap(body)) throw new Error('No se pudo cargar el roadmap.');
    return body;
  },

  async complete({ courseOffering }, nodeId) {
    const response = await fetch(roadmapUrl(courseOffering.identifier, `/nodes/${nodeId}/completion`), {
      method: 'POST',
    });
    if (!response.ok) throw new Error(await failureMessage(response, 'No se pudo completar el nodo.'));
  },
};
