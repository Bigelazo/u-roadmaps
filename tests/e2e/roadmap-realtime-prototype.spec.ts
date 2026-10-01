import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ROADMAP_CHANGE_RECEIVED_EVENT } from '@/features/roadmap/session/change-signal';
import { authenticateAs, fixture, roadmapPath } from './helpers';

async function deleteIfPresent(context: BrowserContext, nodeId?: string) {
  if (nodeId) await context.request.delete(roadmapPath(`/nodes/${nodeId}`));
}

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

async function deliverNovuSignal(page: Page) {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'GET' && new URL(candidate.url()).pathname === roadmapPath(),
  );
  await page.evaluate(
    ({ name, identifier }) => {
      window.dispatchEvent(new CustomEvent(name, { detail: identifier }));
    },
    { name: ROADMAP_CHANGE_RECEIVED_EVENT, identifier: fixture.cc1002 },
  );
  const loaded = await response;
  expect(loaded.status()).toBe(200);
  return loaded.json();
}

test('two open sessions refetch the authoritative Roadmap after a Novu change signal', async ({
  browser,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const teacherContext = await browser.newContext({ baseURL });
  const studentContext = await browser.newContext({ baseURL });
  let nodeId = '';

  try {
    await Promise.all([
      authenticateAs(teacherContext, fixture.daniela),
      authenticateAs(studentContext, fixture.cc1002StudentWithoutProgress),
    ]);
    const created = await teacherContext.request.post(roadmapPath('/nodes'), {
      data: {
        title: 'Nodo de sincronización',
        nodeTypeId: '00000000-0000-4000-8000-000000000001',
        positionX: 350,
        positionY: 150,
      },
    });
    expect(created.status()).toBe(201);
    nodeId = (await created.json()).node.id;
    expect(nodeId).toBeTruthy();
    const nodePath = roadmapPath(`/nodes/${nodeId}`);
    const teacher = await teacherContext.newPage();
    const student = await studentContext.newPage();
    await Promise.all([
      teacher.goto('/courses/CC1002/2026/2'),
      student.goto('/courses/CC1002/2026/2'),
    ]);

    await panNodeIntoView(student, nodeId);
    await student.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await expect(student.getByRole('heading', { name: 'Nodo de sincronización' })).toBeVisible();
    await panNodeIntoView(teacher, nodeId);
    await teacher.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await teacher.getByLabel('Título', { exact: true }).fill('Nodo sincronizado');
    await teacher.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(teacher.locator(`.react-flow__node[data-id="${nodeId}"]`)).toContainText(
      'Nodo sincronizado',
    );
    await expect(student.getByRole('heading', { name: 'Nodo de sincronización' })).toBeVisible();

    const afterUpdate = await deliverNovuSignal(student);
    expect(afterUpdate.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: nodeId, title: 'Nodo sincronizado' })]),
    );
    await expect(student.getByRole('heading', { name: 'Nodo sincronizado' })).toBeVisible();
    await expect(student.locator(`.react-flow__node[data-id="${nodeId}"]`)).toHaveClass(/selected/);

    // A missed signal is repaired on reconnect; a transient failure retains detail.
    expect(
      (
        await teacherContext.request.patch(nodePath, {
          data: { description: 'Cambio recuperado sin aviso' },
        })
      ).status(),
    ).toBe(200);
    await student.route(
      `**${roadmapPath()}`,
      async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Fallo transitorio de actualización' } }),
        });
      },
      { times: 1 },
    );
    await student.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(student.getByText('Fallo transitorio de actualización')).toBeVisible();
    await expect(student.getByRole('heading', { name: 'Nodo sincronizado' })).toBeVisible();
    await student.getByRole('button', { name: 'Reintentar actualización' }).click();
    await expect(student.getByText('Cambio recuperado sin aviso', { exact: true })).toBeVisible();
    await expect(student.getByText('Fallo transitorio de actualización')).toBeHidden();

    const blocked = await teacherContext.request.post(`${nodePath}/teacher-block`);
    expect(blocked.status()).toBe(200);
    const afterBlock = await deliverNovuSignal(student);
    expect(afterBlock.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: nodeId,
          access: { status: 'BLOCKED', reason: 'TEACHER_BLOCK' },
        }),
      ]),
    );
    await expect(student.getByRole('heading', { name: 'Nodo sincronizado' })).toBeHidden();
    await expect(student.locator(`.react-flow__node[data-id="${nodeId}"]`)).toHaveClass(/selected/);
    await expect(student.getByRole('status')).toContainText('ahora está bloqueado');
    await expect(
      student.locator(`.react-flow__node[data-id="${nodeId}"]`).getByRole('img', {
        name: 'Bloqueado',
      }),
    ).toBeVisible();

    const unlockPreview = await teacherContext.request.get(
      `${nodePath}/teacher-block?operation=UNBLOCK`,
    );
    expect(unlockPreview.status()).toBe(200);
    const unblocked = await teacherContext.request.delete(`${nodePath}/teacher-block`, {
      headers: { 'x-teacher-block-preview': (await unlockPreview.json()).version },
    });
    expect(unblocked.status()).toBe(200);
    await deliverNovuSignal(student);
    await student.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await expect(student.getByRole('heading', { name: 'Nodo sincronizado' })).toBeVisible();

    const hidden = await teacherContext.request.patch(nodePath, { data: { isVisible: false } });
    expect(hidden.status()).toBe(200);
    const afterHide = await deliverNovuSignal(student);
    expect(afterHide.nodes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: nodeId })]),
    );
    await expect(student.locator(`.react-flow__node[data-id="${nodeId}"]`)).toHaveCount(0);
    await expect(student.getByRole('status')).toContainText('ya no está disponible');
    await expect(student.getByLabel('Lienzo del roadmap')).toBeFocused();

    const shown = await teacherContext.request.patch(nodePath, { data: { isVisible: true } });
    expect(shown.status()).toBe(200);
    await deliverNovuSignal(student);
    await panNodeIntoView(student, nodeId);
    await student.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await expect(student.getByRole('heading', { name: 'Nodo sincronizado' })).toBeVisible();

    const deleted = await teacherContext.request.delete(nodePath);
    expect(deleted.status()).toBe(204);
    nodeId = '';
    const afterDelete = await deliverNovuSignal(student);
    expect(afterDelete.nodes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Nodo sincronizado' })]),
    );
    await expect(student.getByRole('heading', { name: 'Nodo sincronizado' })).toBeHidden();
    await expect(student.getByRole('status')).toContainText('ya no está disponible');
    await expect(student.getByLabel('Lienzo del roadmap')).toBeFocused();
    await student.route(
      `**${roadmapPath()}`,
      (route) =>
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Participación inactiva' } }),
        }),
      { times: 1 },
    );
    await student.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(student).toHaveURL(/academic-overview\?accessLost=1/);
    await expect(
      student.getByRole('status').filter({ hasText: 'ya no tiene acceso' }),
    ).toContainText('ya no tiene acceso');
  } finally {
    await deleteIfPresent(teacherContext, nodeId);
    await Promise.all([teacherContext.close(), studentContext.close()]);
  }
});

test('a teacher keeps a local draft and resolves incompatible remote edits before saving', async ({
  browser,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const author = await browser.newContext({ baseURL });
  const recipient = await browser.newContext({ baseURL });
  let nodeId = '';
  try {
    await Promise.all([
      authenticateAs(author, fixture.daniela),
      authenticateAs(recipient, fixture.nicolas),
    ]);
    const response = await author.request.post(roadmapPath('/nodes'), {
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
    await page.goto('/courses/CC1002/2026/2');
    await panNodeIntoView(page, nodeId);
    await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
    await page.getByLabel('Título', { exact: true }).fill('Mi borrador local');
    expect(
      (
        await author.request.patch(roadmapPath(`/nodes/${nodeId}`), {
          data: { title: 'Edición de otra persona' },
        })
      ).status(),
    ).toBe(200);
    await deliverNovuSignal(page);
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Mi borrador local');
    await expect(page.getByRole('status')).toContainText('cambió mientras editabas');
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    const canonical = await author.request.get(roadmapPath());
    expect(
      (await canonical.json()).nodes.find((node: { id: string }) => node.id === nodeId).title,
    ).toBe('Edición de otra persona');
    await page
      .getByRole('button', { name: 'Conservar mi borrador sobre la versión actual' })
      .click();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    expect((await author.request.delete(roadmapPath(`/nodes/${nodeId}`))).status()).toBe(204);
    await deliverNovuSignal(page);
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Mi borrador local');
    await expect(
      page.getByRole('status').filter({ hasText: 'Conservamos tu borrador local' }),
    ).toContainText('fue eliminado');
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    await expect(page.getByLabel('Lienzo del roadmap')).toBeFocused();
    nodeId = '';
  } finally {
    await deleteIfPresent(author, nodeId);
    await Promise.all([author.close(), recipient.close()]);
  }
});
