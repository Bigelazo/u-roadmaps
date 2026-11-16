import { expect, test } from './fixtures';
import { fileDrop } from './file-drop';
import { authenticateAs, ok } from './helpers';

test('Markdown drops require confirmation and update the Node draft before saving', async ({
  page,
  course,
  teacherApi: api,
}) => {
  const created = await api.post(course.apiPath('/nodes'), {
    data: {
      title: 'Nodo para importar Markdown',
      description: 'Descripción original',
      nodeTypeId: '00000000-0000-4000-8000-000000000001',
      positionX: 0,
      positionY: 0,
    },
  });
  await ok(created, 201);
  const nodeId: string = (await created.json()).node.id;
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();

  const content = '# Guía de estudio\n\n**Descripción** con ñ y acentos.\n\n- Primer paso\n';
  const transfer = await fileDrop(page, 'guia.md', content);
  const editor = page.getByRole('group', {
    name: 'Editor de nodo',
    exact: true,
    includeHidden: true,
  });
  const description = editor.getByLabel(/^Contenido/);
  await description.fill('Borrador sin guardar');
  await description.dispatchEvent('dragover', { dataTransfer: transfer });
  await description.dispatchEvent('drop', { dataTransfer: transfer });
  const confirmation = page.getByRole('alertdialog', {
    name: '¿Reemplazar el texto con el archivo Markdown?',
  });
  await expect(confirmation).toContainText('guia.md');
  await expect(description).toHaveText('Borrador sin guardar');
  await confirmation.getByRole('button', { name: 'Cancelar' }).click();
  await expect(confirmation).toBeHidden();
  await expect(description).toHaveText('Borrador sin guardar');

  await page.getByRole('button', { name: 'Editar nodo en pantalla completa' }).click();
  const fullscreen = page.getByRole('dialog', { name: 'Editar nodo', exact: true });
  const fullscreenDescription = fullscreen.getByLabel(/^Contenido/);
  await fullscreenDescription.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Reemplazar texto' }).click();
  await expect(confirmation).toBeHidden();
  await expect(fullscreenDescription).toContainText('Descripción con ñ y acentos.');
  await expect(fullscreen.locator('.markdown-editor .cm-md-h1')).toContainText('Guía de estudio');

  const beforeSave = await api.get(course.apiPath());
  expect((await beforeSave.json()).nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: nodeId, description: 'Descripción original' }),
    ]),
  );
  await fullscreen.getByRole('button', { name: 'Cerrar pantalla completa' }).click();
  await expect(description).toContainText('Descripción con ñ y acentos.');
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

test('a Markdown file dragged into the window turns the description into a drop target', async ({
  page,
  course,
  teacherApi: api,
}) => {
  const created = await api.post(course.apiPath('/nodes'), {
    data: {
      title: 'Nodo para arrastrar Markdown',
      nodeTypeId: '00000000-0000-4000-8000-000000000001',
      positionX: 0,
      positionY: 0,
    },
  });
  await ok(created, 201);
  const nodeId: string = (await created.json()).node.id;
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();

  const description = page.locator('#edit-node-description');
  await expect(description).toBeVisible();
  const body = page.locator('body');
  const dropTarget = page.getByText('Suelta el archivo Markdown aquí');
  const markdown = await fileDrop(page, 'guia.md', '# Guía');
  const pdf = await fileDrop(page, 'guia.pdf', 'PDF', 'application/pdf');

  await body.dispatchEvent('dragenter', { dataTransfer: pdf });
  await expect(dropTarget).toBeHidden();

  await body.dispatchEvent('dragenter', { dataTransfer: markdown });
  await expect(dropTarget).toBeVisible();
  await body.dispatchEvent('dragleave', { dataTransfer: markdown, clientX: 0, clientY: 300 });
  await expect(dropTarget).toBeHidden();

  await body.dispatchEvent('dragenter', { dataTransfer: markdown });
  await expect(dropTarget).toBeVisible();
  const strayDropRejected = await body.evaluate((element, transfer) => {
    const event = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented && transfer.dropEffect === 'none';
  }, markdown);
  expect(strayDropRejected).toBe(true);

  await description.dispatchEvent('dragover', { dataTransfer: markdown });
  await description.dispatchEvent('drop', { dataTransfer: markdown });
  await expect(dropTarget).toBeHidden();
  await expect(
    page.getByRole('alertdialog', { name: '¿Reemplazar el texto con el archivo Markdown?' }),
  ).toContainText('guia.md');

  await markdown.dispose();
  await pdf.dispose();
});

test('a long description scrolls inside its box and never widens the side panel', async ({
  page,
  course,
  teacherApi: api,
}) => {
  const row =
    '| `url` | https://github.com/uchile-cc/plantilla-memoria-typst/blob/main/template/parametros/final/descripcion_completa.typ |';
  const table = ['| Parámetro | Descripción |', '| --------- | ----------- |'];
  const description = [...table, ...Array.from({ length: 60 }, () => row)].join('\n');
  const created = await api.post(course.apiPath('/nodes'), {
    data: {
      title: 'Nodo con tabla larga',
      description,
      nodeTypeId: '00000000-0000-4000-8000-000000000001',
      positionX: 0,
      positionY: 0,
    },
  });
  await ok(created, 201);
  const nodeId: string = (await created.json()).node.id;
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();

  const input = page.locator('#edit-node-description');
  await expect(input.getByRole('columnheader', { name: 'Parámetro' })).toBeVisible();
  const layout = await input.evaluate((element) => {
    const frame = element.closest<HTMLElement>('.markdown-editor');
    const panel = element.closest<HTMLElement>('[data-slot="sidebar-content"]');
    if (!frame || !panel) throw new Error('Missing description frame or side panel');
    return {
      frameHeight: frame.clientHeight,
      frameOverflow: frame.scrollHeight - frame.clientHeight,
      frameHorizontalOverflow: frame.scrollWidth - frame.clientWidth,
      viewportHeight: window.innerHeight,
      panelOverflow: panel.scrollHeight - panel.clientHeight,
      panelHorizontalOverflow: panel.scrollWidth - panel.clientWidth,
      panelScrollbar: getComputedStyle(panel).scrollbarWidth,
    };
  });
  expect(layout.frameOverflow).toBeGreaterThan(0);
  expect(layout.frameHeight).toBeLessThanOrEqual(layout.viewportHeight / 2);
  expect(layout.frameHorizontalOverflow).toBe(0);
  expect(layout.panelHorizontalOverflow).toBe(0);
  expect(layout.panelOverflow).toBeGreaterThan(0);
  expect(layout.panelScrollbar).not.toBe('none');
});

test('teaching staff create a Node whose description comes from a dropped Markdown file', async ({
  page,
  course,
  teacherApi: api,
}) => {
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.getByRole('button', { name: 'Crear en el mapa' }).click();
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear nodo' });
  await dialog.getByLabel('Título').fill('Nodo con Markdown');
  const description = page.locator('#new-node-description');

  const invalid = await fileDrop(page, 'notas.txt', 'texto', 'text/plain');
  await description.dispatchEvent('drop', { dataTransfer: invalid });
  await expect(dialog).toContainText('Arrastra un solo archivo Markdown (.md o .markdown).');
  await invalid.dispose();

  const content = '# Guía de creación\n\n- Primer paso\n';
  const transfer = await fileDrop(page, 'guia.md', content);
  await description.fill('Borrador previo');
  await description.dispatchEvent('drop', { dataTransfer: transfer });
  const confirmation = page.getByRole('alertdialog', {
    name: '¿Reemplazar el texto con el archivo Markdown?',
  });
  await expect(confirmation).toContainText('guia.md');
  await expect(description).toHaveText('Borrador previo');
  await confirmation.getByRole('button', { name: 'Reemplazar texto' }).click();
  await expect(description).toContainText('Guía de creación');
  await transfer.dispose();

  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith(course.apiPath('/nodes')),
  );
  await dialog.getByRole('button', { name: 'Crear nodo' }).click();
  expect((await created).status()).toBe(201);
  const roadmap = await api.get(course.apiPath());
  expect((await roadmap.json()).nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ title: 'Nodo con Markdown', description: content }),
    ]),
  );

  await page.locator('.react-flow__node').filter({ hasText: 'Nodo con Markdown' }).click();
  const editor = page.getByRole('group', { name: 'Editor de nodo', exact: true });
  await expect(editor.getByLabel(/^Contenido/)).toContainText('Guía de creación');
});

test('teaching staff create a Node without a description', async ({ page, course, apiAs }) => {
  const api = await apiAs(course.users.teacher);
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.getByRole('button', { name: 'Crear en el mapa' }).click();
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear nodo' });
  await dialog.getByLabel('Título').fill('Nodo sin descripción');
  await dialog.getByRole('button', { name: 'Crear nodo' }).click();
  await expect(dialog).toHaveCount(0);
  const roadmap = await api.get(course.apiPath());
  const created = (await roadmap.json()).nodes.find(
    (node: { title: string }) => node.title === 'Nodo sin descripción',
  );
  expect(created?.description ?? '').toBe('');
});

test('the fullscreen editor gives the description at least half the viewport', async ({
  page,
  course,
  teacherApi: api,
}) => {
  const created = await api.post(course.apiPath('/nodes'), {
    data: {
      title: 'Nodo en pantalla completa',
      description: 'Una línea',
      nodeTypeId: '00000000-0000-4000-8000-000000000001',
      positionX: 0,
      positionY: 0,
    },
  });
  await ok(created, 201);
  const nodeId: string = (await created.json()).node.id;
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).click();
  await page.getByRole('button', { name: 'Editar nodo en pantalla completa' }).click();

  const description = page.locator('#fullscreen-node-description');
  await expect(description).toBeVisible();
  const { height, viewportHeight } = await description.evaluate((element: HTMLElement) => ({
    height: element.offsetHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(height).toBeGreaterThanOrEqual(viewportHeight / 2);

  await page.getByRole('button', { name: 'Cerrar pantalla completa' }).click();
  await expect(page.locator('#edit-node-description')).toHaveJSProperty('offsetHeight', 128);
});
