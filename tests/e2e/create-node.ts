import type { APIRequestContext } from '@playwright/test';
import { expect, type E2ECourseOffering } from './fixtures';

/** Prepare Nodes through the same HTTP interface used by teaching staff. */
export async function prepareNodeCreator(
  api: APIRequestContext,
  course: E2ECourseOffering,
  options: { description?: string; positionY?: number } = {},
) {
  const roadmap = await api.get(course.apiPath());
  expect(roadmap.status()).toBe(200);
  const nodeTypeId: string = (await roadmap.json()).nodeTypes.find(
    (nodeType: { isPredefined: boolean }) => nodeType.isPredefined,
  ).id;

  return {
    nodeTypeId,
    async createNode(title: string, positionX: number) {
      const response = await api.post(course.apiPath('/nodes'), {
        data: {
          title,
          nodeTypeId,
          description: options.description,
          positionX,
          positionY: options.positionY ?? 0,
        },
      });
      expect(response.status(), await response.text()).toBe(201);
      return (await response.json()).node as { id: string; title: string };
    },
  };
}
