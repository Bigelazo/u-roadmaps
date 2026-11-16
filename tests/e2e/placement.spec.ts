import type { APIRequestContext, Page, Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { authenticateAs, toast } from './helpers';

type Positions = { nodeId: string; position: { x: number; y: number } }[];
type Saved = { nodes: { id: string; positionX: number; positionY: number }[] };

async function bounds(node: Locator) {
  const box = await node.boundingBox();
  if (!box) throw new Error('Node is not visible');
  return box;
}

async function expectSaved(api: APIRequestContext, path: string, positions: Positions) {
  const saved: Saved = await (await api.get(path)).json();
  for (const { nodeId, position } of positions)
    expect(saved.nodes.find(({ id }) => id === nodeId)).toMatchObject({
      positionX: position.x,
      positionY: position.y,
    });
}

function placementResponse(page: Page, path: string) {
  return page.waitForResponse(
    (response) => response.url().endsWith(path) && response.request().method() === 'PATCH',
  );
}

test('keyboard and pointer movement each persist their complete position set in one request', async ({
  page,
  course,
  apiAs,
}) => {
  const api = await apiAs(course.users.teacher);
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  const node = page.locator(`.react-flow__node[data-id="${course.nodes.first}"]`);
  await node.click();
  await node.focus();
  let submissions = 0;
  page.on('request', (request) => {
    if (request.url().endsWith(course.apiPath('/placement')) && request.method() === 'PATCH')
      submissions += 1;
  });
  const keyboardSaved = placementResponse(page, course.apiPath('/placement'));
  await node.press('Shift+ArrowRight');
  const keyboard = await keyboardSaved;
  expect(keyboard.status()).toBe(204);
  await expectSaved(api, course.apiPath(), keyboard.request().postDataJSON().positions);
  expect(submissions).toBe(1);

  const pointerSaved = placementResponse(page, course.apiPath('/placement'));
  const box = await bounds(node);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 80, { steps: 8 });
  await page.mouse.up();
  const pointer = await pointerSaved;
  expect(pointer.status()).toBe(204);
  await expectSaved(api, course.apiPath(), pointer.request().postDataJSON().positions);
  expect(submissions).toBe(2);
});

test('automatic layout saves the chosen complete layout atomically', async ({
  page,
  course,
  apiAs,
}) => {
  const api = await apiAs(course.users.teacher);
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.getByRole('button', { name: 'Ordenar', exact: true }).click();
  const saved = placementResponse(page, course.apiPath('/placement'));
  await page
    .getByRole('alertdialog', { name: '¿Ordenar los nodos?' })
    .getByRole('button', { name: 'Horizontal' })
    .click();
  const response = await saved;
  expect(response.status()).toBe(204);
  const positions: Positions = response.request().postDataJSON().positions;
  expect(positions.length).toBeGreaterThan(1);
  await expectSaved(api, course.apiPath(), positions);
  await expect(toast(page, 'Nodos ordenados exitosamente.').first()).toBeVisible();
});
