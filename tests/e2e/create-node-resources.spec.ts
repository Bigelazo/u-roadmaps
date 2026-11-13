import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

async function openCreator(page: Page) {
  await page.getByRole('button', { name: 'Crear en el mapa' }).click();
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  return page.getByRole('dialog', { name: 'Crear nodo' });
}

async function stageFileAndLink(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Crear nodo' });
  await dialog.getByRole('button', { name: 'Recurso', exact: true }).click();
  await dialog.locator('#new-node-resource-file').setInputFiles({
    name: 'guia.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 guía'),
  });
  await dialog.getByRole('button', { name: 'Agregar archivo' }).click();
  await dialog.getByRole('button', { name: 'Recurso', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Enlace' }).click();
  const composer = dialog.getByRole('form', { name: 'Editor de recurso' });
  await composer.getByRole('textbox', { name: 'Título' }).fill('Clase grabada');
  await composer.getByRole('textbox', { name: 'Enlace' }).fill('https://video.example/clase');
  await composer.getByRole('button', { name: 'Agregar enlace' }).click();
  await expect(dialog.getByRole('heading', { name: 'Recursos (2)' })).toBeVisible();
}

test('teaching staff create a Node together with its file and link resources', async ({
  page,
  course,
  teacherApi: api,
}) => {
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  const dialog = await openCreator(page);
  await dialog.getByLabel('Título').fill('Nodo con recursos');
  await stageFileAndLink(page);

  await dialog.getByRole('button', { name: 'Crear nodo' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByLabel('Notificaciones').getByText('Nodo creado con 2 recursos.'),
  ).toBeVisible();
  const roadmap = await (await api.get(course.apiPath())).json();
  const created = roadmap.nodes.find(
    (node: { title: string }) => node.title === 'Nodo con recursos',
  );
  expect(
    created.resources.map(({ title, type }: { title: string; type: string }) => ({ title, type })),
  ).toEqual(
    expect.arrayContaining([
      { title: 'guia.pdf', type: 'FILE' },
      { title: 'Clase grabada', type: 'LINK' },
    ]),
  );
  expect(created.resources).toHaveLength(2);
});

test('a resource that fails leaves the created Node open on its resources', async ({
  page,
  course,
  teacherApi: api,
}) => {
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.route('**/resources', async (route) => {
    const isLink = route.request().headers()['content-type']?.includes('application/json');
    if (route.request().method() === 'POST' && isLink) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Servicio no disponible' } }),
      });
      return;
    }
    await route.continue();
  });
  const dialog = await openCreator(page);
  await dialog.getByLabel('Título').fill('Nodo con fallo parcial');
  await stageFileAndLink(page);

  await dialog.getByRole('button', { name: 'Crear nodo' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .getByLabel('Notificaciones')
      .getByText('Nodo creado; 1 recurso no se pudo subir: Clase grabada.'),
  ).toBeVisible();
  const editor = page.getByRole('group', { name: 'Editor de nodo', exact: true });
  await expect(editor.getByRole('heading', { name: 'Recursos (1)' })).toBeInViewport();
  const roadmap = await (await api.get(course.apiPath())).json();
  const created = roadmap.nodes.filter(
    (node: { title: string }) => node.title === 'Nodo con fallo parcial',
  );
  expect(created).toHaveLength(1);
  expect(created[0].resources).toEqual([expect.objectContaining({ title: 'guia.pdf' })]);
});
