import { RoadmapAccessLostError, RoadmapClosedError } from './access-lost';
import { roadmapUrl } from '@/features/roadmap/client';
import {
  canvasCommandCatalog,
  type AnyCommandEntry,
  type ChangeImpactCommand,
  type CommandEntry,
  type RouteRequest,
} from '@/features/roadmap/canvas/commands/commands';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';

type RequestOptions = {
  readonly previewHeader?: string;
  readonly previewVersion?: string;
  readonly load?: 'roadmap' | 'canvas-preview';
};

async function failureError(response: Response, failure: string) {
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
      return 'code' in body.error && body.error.code === 'ROADMAP_CLOSED'
        ? new RoadmapClosedError(body.error.message)
        : new Error(body.error.message);
    }
    // eslint-disable-next-line no-empty -- Keep the user-facing failure message when a route has no JSON error body.
  } catch {}
  return new Error(failure);
}

export function createHttpRoadmapCanvasSessionPersistence(
  identifier: CourseOfferingIdentifier,
): RoadmapCanvasSessionPersistence {
  async function request(
    { method, path, body }: RouteRequest,
    failure: string,
    { previewHeader, previewVersion, load }: RequestOptions = {},
  ) {
    const json = body !== undefined && !(body instanceof FormData);
    const headers = {
      ...(json && { 'Content-Type': 'application/json' }),
      ...(previewHeader && previewVersion ? { [previewHeader]: previewVersion } : {}),
    };
    const response = await fetch(roadmapUrl(identifier, path), {
      ...(method && { method }),
      ...(load && { cache: 'no-store' }),
      ...(Object.keys(headers).length > 0 && { headers }),
      ...(body && { body: json ? JSON.stringify(body) : body }),
    });
    if (!response.ok) {
      const error = await failureError(response, failure);
      if (load === 'roadmap' && [401, 403, 404].includes(response.status))
        throw new RoadmapAccessLostError(error.message);
      throw error;
    }
    return response;
  }

  async function sendBesideNavigation(path: string) {
    const response = await fetch(roadmapUrl(identifier, path), { method: 'POST', keepalive: true });
    if (!response.ok) throw new Error('No se pudo registrar el acceso al recurso.');
  }

  return {
    async recordResourceAccess(resource, scope) {
      if (scope === 'canvas-preview') {
        await sendBesideNavigation(`/simulation/resources/${resource.id}/review`);
        return { countsAccess: false };
      }
      if (resource.type === 'LINK') await sendBesideNavigation(`/resources/${resource.id}/access`);
      return { countsAccess: true };
    },

    load: async () =>
      (await request({ path: '' }, 'No se pudo cargar el roadmap.', { load: 'roadmap' })).json(),

    loadCanvasPreview: async () =>
      (
        await request({ path: '/simulation' }, 'No se pudo cargar la previsualización.', {
          load: 'canvas-preview',
        })
      ).json(),

    async readChangeImpact(command) {
      const { changeImpact }: CommandEntry<ChangeImpactCommand, unknown> =
        canvasCommandCatalog[command.kind];
      return (await request({ path: changeImpact.path(command) }, changeImpact.failure)).json();
    },

    async execute(command, previewVersion) {
      const entry: AnyCommandEntry = canvasCommandCatalog[command.kind];
      const options = { previewHeader: entry.previewHeader, previewVersion };
      const sent = await Promise.allSettled(
        [entry.requests(command)].flat().map((item) => request(item, entry.failure, options)),
      );
      const responses = sent.map((result) => {
        if (result.status === 'rejected') throw result.reason;
        return result.value;
      });
      return entry.result?.(responses);
    },
  };
}
