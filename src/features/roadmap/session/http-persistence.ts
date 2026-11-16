import { RoadmapAccessLostError, RoadmapClosedError } from './access-lost';
import { roadmapUrl } from '@/features/roadmap/client';
import {
  httpCommands,
  type AnyHttpCommand,
  type ChangeImpactHttpCommand,
  type RouteRequest,
} from '@/features/roadmap/session/http-commands';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { readApiErrorBody } from '@/shared/api-error';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';

type RequestOptions = {
  readonly previewHeader?: string;
  readonly previewVersion?: string;
  readonly load?: 'roadmap' | 'canvas-preview';
  readonly signal?: AbortSignal;
};

async function failureError(response: Response, failure: string) {
  const error = await readApiErrorBody(response);
  if (!error) return new Error(failure);
  return error.code === 'ROADMAP_CLOSED'
    ? new RoadmapClosedError(error.message)
    : new Error(error.message);
}

export function createHttpRoadmapCanvasSessionPersistence(
  identifier: CourseOfferingIdentifier,
): RoadmapCanvasSessionPersistence {
  async function request(
    { method, path, body }: RouteRequest,
    failure: string,
    { previewHeader, previewVersion, load, signal }: RequestOptions = {},
  ) {
    const json = body !== undefined && !(body instanceof FormData);
    const headers = {
      ...(json && { 'Content-Type': 'application/json' }),
      ...(previewHeader && previewVersion ? { [previewHeader]: previewVersion } : {}),
    };
    const response = await fetch(roadmapUrl(identifier, path), {
      ...(method && { method }),
      ...(load && { cache: 'no-store' }),
      ...(signal && { signal }),
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

    load: async (signal) =>
      (
        await request({ path: '' }, 'No se pudo cargar el roadmap.', { load: 'roadmap', signal })
      ).json(),

    loadCanvasPreview: async () =>
      (
        await request({ path: '/simulation' }, 'No se pudo cargar la previsualización.', {
          load: 'canvas-preview',
        })
      ).json(),

    async readChangeImpact(command) {
      const { changeImpact }: ChangeImpactHttpCommand = httpCommands[command.kind];
      return (await request({ path: changeImpact.path(command) }, changeImpact.failure)).json();
    },

    async execute(command, previewVersion) {
      const entry: AnyHttpCommand = httpCommands[command.kind];
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
