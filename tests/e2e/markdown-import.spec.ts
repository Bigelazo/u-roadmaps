import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

test('Markdown drops require confirmation and update the Node draft before saving', async ({
  page,
  course,
  apiAs,
}) => {
  const api = await apiAs(course.users.teacher);
  const created = await api.post(course.apiPath('/nodes'), {
    data: {
      title: 'Nodo para importar Markdown',
      description: 'Descripción original',
      nodeTypeId: '00000000-0000-4000-8000-000000000001',
      positionX: 0,
      positionY: 0,
    },
  });
  expect(created.status()).toBe(201);
  const nodeId: string = (await created.json()).node.id;
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();

  const content = '# Guía de estudio\n\n**Descripción** con ñ y acentos.\n\n- Primer paso\n';
  const transfer = await page.evaluateHandle((text) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([text], 'guia.md', { type: 'text/markdown' }));
    return dataTransfer;
  }, content);
  const editor = page.getByRole('group', {
    name: 'Editor de nodo',
    exact: true,
    includeHidden: true,
  });
  const description = editor.getByLabel(/Descripción/);
  await description.fill('Borrador sin guardar');
  await description.dispatchEvent('dragover', { dataTransfer: transfer });
  await description.dispatchEvent('drop', { dataTransfer: transfer });
  const confirmation = page.getByRole('alertdialog', { name: 'Reemplazar texto con Markdown' });
  await expect(confirmation).toContainText('guia.md');
  await expect(description).toHaveValue('Borrador sin guardar');
  await confirmation.getByRole('button', { name: 'Cancelar' }).click();
  await expect(confirmation).toBeHidden();
  await expect(description).toHaveValue('Borrador sin guardar');

  await page.getByRole('button', { name: 'Editar nodo en pantalla completa' }).click();
  const fullscreen = page.getByRole('dialog', { name: 'Editar nodo', exact: true });
  const fullscreenDescription = fullscreen.getByLabel(/Descripción/);
  await fullscreenDescription.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Reemplazar texto' }).click();
  await expect(confirmation).toBeHidden();
  await expect(fullscreenDescription).toHaveValue(content);
  await expect(fullscreen.locator('.markdown-editor .token.title')).toHaveText('# Guía de estudio');

  const beforeSave = await api.get(course.apiPath());
  expect((await beforeSave.json()).nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: nodeId, description: 'Descripción original' }),
    ]),
  );
  await fullscreen.getByRole('button', { name: 'Cerrar pantalla completa' }).click();
  await expect(description).toHaveValue(content);
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.url().includes(`/nodes/${nodeId}`),
  );
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  expect((await saved).status()).toBe(200);
  const afterSave = await api.get(course.apiPath());
  expect((await afterSave.json()).nodes).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: nodeId, description: content })]),
  );
  await transfer.dispose();
});
