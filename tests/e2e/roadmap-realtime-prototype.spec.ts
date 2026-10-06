import type { Page } from '@playwright/test';
import { expect, test, type E2EPrimaryCourseOffering } from './fixtures';
import { authenticateAs } from './helpers';
import { prepareNodeCreator } from './create-node';

async function panNodeIntoView(page: Page, nodeId: string) {
  const pane = page.locator('.react-flow__pane');
  const node = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  await expect(node).toBeAttached();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const [nodeBox, paneBox] = await Promise.all([node.boundingBox(), pane.boundingBox()]);
    if (!nodeBox || !paneBox) throw new Error('No se pudo ubicar el Nodo en el canvas.');
    const offsetX = paneBox.x + paneBox.width / 2 - (nodeBox.x + nodeBox.width / 2);
    const offsetY = paneBox.y + paneBox.height / 2 - (nodeBox.y + nodeBox.height / 2);
    if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) break;
    const center = { x: paneBox.x + paneBox.width / 2, y: paneBox.y + paneBox.height / 2 };
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(
      center.x + Math.max(-100, Math.min(100, offsetX)),
      center.y + Math.max(-100, Math.min(100, offsetY)),
      { steps: 4 },
    );
    await page.mouse.up();
  }
  await expect(node).toBeInViewport();
}

async function loadSavedRoadmap(page: Page, course: E2EPrimaryCourseOffering) {
  const response = await page.request.get(course.apiPath());
  expect(response.status()).toBe(200);
  return response.json();
}

test('teaching sessions reload live and recover transient projection failures through real SSE', async ({
  browser,
  course,
  apiAs,
}, testInfo) => {
  const author = await apiAs(course.users.teacher);
  const recipient = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string });
  try {
    await authenticateAs(recipient, course.users.teachingAssistant.id);
    const creator = await prepareNodeCreator(author, course, {
      description: 'Detalle original',
      positionY: 150,
    });
    const node = await creator.createNode('Nodo de sincronización', 350);
    const page = await recipient.newPage();
    await page.goto(`${course.pagePath()}?targetNode=${node.id}`);
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue(node.title);
    expect(
      (
        await author.patch(course.apiPath(`/nodes/${node.id}`), {
          data: { title: 'Nodo sincronizado' },
        })
      ).status(),
    ).toBe(200);
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Nodo sincronizado');

    const projectionRoute = `**${course.apiPath()}`;
    await page.route(projectionRoute, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Fallo transitorio de actualización' } }),
      });
    });
    expect(
      (
        await author.patch(course.apiPath(`/nodes/${node.id}`), {
          data: { description: 'Cambio recuperado sin aviso' },
        })
      ).status(),
    ).toBe(200);
    await expect(page.getByText('Fallo transitorio de actualización')).toBeVisible();
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Nodo sincronizado');
    await page.unroute(projectionRoute);
    await expect(page.getByLabel('Descripción')).toHaveValue('Cambio recuperado sin aviso');
    await expect(page.getByText('Fallo transitorio de actualización')).toBeHidden();

    await recipient.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    expect(
      (
        await author.patch(course.apiPath(`/nodes/${node.id}`), {
          data: { title: 'Recuperado al reconectar' },
        })
      ).status(),
    ).toBe(200);
    const reconnected = page.waitForResponse((response) =>
      response.url().endsWith('/api/notifications/stream'),
    );
    await recipient.setOffline(false);
    expect((await reconnected).status()).toBe(200);
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
      'Recuperado al reconectar',
    );
  } finally {
    await recipient.close();
  }
});

test('a teacher keeps a local draft and resolves incompatible remote edits before saving', async ({
  browser,
  course,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const author = await browser.newContext({ baseURL });
  const recipient = await browser.newContext({ baseURL });
  let nodeId = '';
  try {
    await Promise.all([
      authenticateAs(author, course.users.teacher.id),
      authenticateAs(recipient, course.users.teachingAssistant.id),
    ]);
    const response = await author.request.post(course.apiPath('/nodes'), {
      data: {
        title: 'Borrador compartido',
        nodeTypeId: '00000000-0000-4000-8000-000000000001',
        positionX: 300,
        positionY: 100,
      },
    });
    expect(response.status()).toBe(201);
    nodeId = (await response.json()).node.id;
    const page = await recipient.newPage();
    await page.goto(course.pagePath());
    await panNodeIntoView(page, nodeId);
    await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await page.getByLabel('Título', { exact: true }).fill('Mi borrador local');
    expect(
      (
        await author.request.patch(course.apiPath(`/nodes/${nodeId}`), {
          data: { title: 'Edición de otra persona' },
        })
      ).status(),
    ).toBe(200);
    await loadSavedRoadmap(page, course);
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Mi borrador local');
    await expect(page.getByRole('status')).toContainText('cambió mientras editabas');
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    const canonical = await author.request.get(course.apiPath());
    expect(
      (await canonical.json()).nodes.find((node: { id: string }) => node.id === nodeId).title,
    ).toBe('Edición de otra persona');
    await page
      .getByRole('button', { name: 'Conservar mi borrador sobre la versión actual' })
      .click();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    expect((await author.request.delete(course.apiPath(`/nodes/${nodeId}`))).status()).toBe(204);
    await loadSavedRoadmap(page, course);
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Mi borrador local');
    await expect(
      page.getByRole('status').filter({ hasText: 'Conservamos tu borrador local' }),
    ).toContainText('fue eliminado');
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    await expect(page.getByLabel('Lienzo del roadmap')).toBeFocused();
    nodeId = '';
  } finally {
    await Promise.all([author.close(), recipient.close()]);
  }
});
