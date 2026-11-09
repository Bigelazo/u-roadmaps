import { expect, test } from './fixtures';
import { authenticateAs, ok } from './helpers';

for (const width of [1440, 390]) {
  test(`file renaming preserves its extension at ${width}px`, async ({
    page,
    course,
    teacherApi: api,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await api.post(course.apiPath(`/nodes/${course.nodes.first}/resources`), {
      multipart: {
        file: {
          name: 'Plantilla para análisis de archivos.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: Buffer.from('E2E file renaming fixture'),
        },
      },
    });
    await ok(response, 201);
    const { resource } = await response.json();
    await ok(
      await api.post(course.apiPath(`/nodes/${course.nodes.first}/resources`), {
        data: { title: 'Video como enlace', url: 'https://example.test/video', type: 'LINK' },
      }),
      201,
    );
    await authenticateAs(page.context(), course.users.teacher.id);
    await page.goto(course.pagePath());
    await page.locator(`.react-flow__node[data-id="${course.nodes.first}"]`).click();
    await page.setViewportSize({ width, height: 900 });
    const editor = page.getByRole('group', { name: 'Editor de nodo', exact: true });
    await expect(
      editor
        .getByRole('combobox', { name: 'Tipo', exact: true })
        .locator('[data-slot="select-value"] svg'),
    ).toBeVisible();
    const row = editor.getByRole('listitem').filter({ hasText: resource.title });
    await expect(row.locator('[data-slot="item-media"] svg.lucide-file-type')).toBeVisible();
    await expect(row.getByRole('link', { name: `Descargar ${resource.title}` })).toBeVisible();
    const linkRow = editor.getByRole('listitem').filter({ hasText: 'Video como enlace' });
    await expect(linkRow.locator('[data-slot="item-media"] svg.lucide-link-2')).toBeVisible();
    await expect(
      linkRow.getByRole('link', { name: 'Abrir enlace Video como enlace' }),
    ).toBeVisible();
    await expect(editor.getByText(/^(Archivo|Enlace)$/)).toHaveCount(0);
    const resources = editor.getByRole('list', { name: 'Recursos del nodo' });
    await resources.scrollIntoViewIfNeeded();
    await resources.screenshot({ path: testInfo.outputPath('file-link-rendering.png') });
    await row.getByRole('button', { name: `Editar recurso ${resource.title}` }).click();
    const form = editor.getByRole('form', { name: 'Editor de recurso' });
    const title = form.getByRole('textbox', { name: 'Título', exact: true });
    await expect(title).toHaveValue('Plantilla para análisis de archivos');
    await expect(form.getByText('.docx', { exact: false })).toBeVisible();
    await title.fill('Plantilla actualizada.pdf');
    await form.screenshot({ path: testInfo.outputPath('resource-editor.png') });
    const saved = page.waitForResponse(
      (res) =>
        res.request().method() === 'PATCH' && res.url().includes(`/resources/${resource.id}`),
    );
    await form.getByRole('button', { name: 'Guardar recurso' }).click();
    expect((await saved).status()).toBe(200);
    await expect(editor.getByText('Plantilla actualizada.pdf.docx', { exact: true })).toBeVisible();
    const roadmap = await api.get(course.apiPath());
    await ok(roadmap);
    const node = (await roadmap.json()).nodes.find(
      (item: { id: string }) => item.id === course.nodes.first,
    );
    expect(node.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: resource.id, title: 'Plantilla actualizada.pdf.docx' }),
      ]),
    );
  });
}

for (const width of [1440, 390]) {
  test(`replacing a File keeps the Resource and serves the new file at ${width}px`, async ({
    page,
    course,
    teacherApi: api,
  }, testInfo) => {
    const created = await api.post(course.apiPath(`/nodes/${course.nodes.first}/resources`), {
      multipart: {
        file: {
          name: 'Pauta.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: Buffer.from('Primera pauta'),
        },
      },
    });
    await ok(created, 201);
    const { resource } = await created.json();
    await authenticateAs(page.context(), course.users.teacher.id);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(course.pagePath());
    await page.locator(`.react-flow__node[data-id="${course.nodes.first}"]`).click();
    await page.setViewportSize({ width, height: 900 });
    const editor = page.getByRole('group', { name: 'Editor de nodo', exact: true });
    await editor.getByRole('button', { name: 'Editar recurso Pauta.docx' }).click();
    const form = editor.getByRole('form', { name: 'Editor de recurso' });
    await form.getByLabel('Reemplazar archivo').setInputFiles({
      name: 'pauta-final.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7 pauta final'),
    });
    await expect(form.getByText('pauta-final.pdf', { exact: true })).toBeVisible();
    await expect(form.locator('#resource-extension')).toHaveText(/\.pdf$/);
    await form.scrollIntoViewIfNeeded();
    await form.screenshot({ path: testInfo.outputPath('resource-replacement.png') });
    const saved = page.waitForResponse(
      (res) =>
        res.request().method() === 'PATCH' && res.url().includes(`/resources/${resource.id}`),
    );
    await form.getByRole('button', { name: 'Guardar recurso' }).click();
    expect((await saved).status()).toBe(200);
    await expect(form).toHaveCount(0);
    const row = editor.getByRole('listitem').filter({ hasText: 'Pauta.pdf' });
    await expect(row.locator('[data-slot="item-media"] svg.lucide-file-text')).toBeVisible();
    const download = await api.get(course.apiPath(`/resources/${resource.id}/file`));
    await ok(download);
    expect(download.headers()['content-type']).toBe('application/pdf');
    expect((await download.body()).toString()).toBe('%PDF-1.7 pauta final');
    const roadmap = await (await api.get(course.apiPath())).json();
    const node = roadmap.nodes.find((item: { id: string }) => item.id === course.nodes.first);
    expect(node.resources).toContainEqual(
      expect.objectContaining({
        id: resource.id,
        title: 'Pauta.pdf',
        type: 'FILE',
        fileContentType: 'application/pdf',
      }),
    );
  });
}

test('teacher saves consecutive Node edits and publishes links without reloading', async ({
  page,
  course,
  teacherApi: api,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.locator(`.react-flow__node[data-id="${course.nodes.first}"]`).click();
  const editor = page.getByRole('group', { name: 'Editor de nodo', exact: true });
  const title = editor.getByRole('textbox', { name: 'Título', exact: true });
  const save = editor.getByRole('button', { name: 'Guardar cambios', exact: true });
  const nodePath = course.apiPath(`/nodes/${course.nodes.first}`);

  for (const value of ['Primera edición consecutiva', 'Segunda edición consecutiva']) {
    await title.fill(value);
    await expect(save).toBeEnabled();
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'PATCH' && response.url().endsWith(nodePath),
    );
    await save.click();
    expect((await saved).status()).toBe(200);
    await expect(editor.getByRole('heading', { name: value, exact: true })).toBeVisible();
    await expect(save).toBeDisabled();
  }

  for (const resourceTitle of ['Primer enlace consecutivo', 'Segundo enlace consecutivo']) {
    await editor.getByRole('button', { name: 'Recurso', exact: true }).click();
    const form = editor.getByRole('form', { name: 'Editor de recurso' });
    await form.getByRole('tab', { name: 'Enlace', exact: true }).click();
    await form.getByRole('textbox', { name: 'Título', exact: true }).fill(resourceTitle);
    await form
      .getByRole('textbox', { name: 'Enlace', exact: true })
      .fill('https://example.test/material');
    const publish = form.getByRole('button', { name: 'Agregar enlace', exact: true });
    await expect(publish).toBeEnabled();
    const published = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().endsWith(`${nodePath}/resources`),
    );
    await publish.click();
    expect((await published).status()).toBe(201);
    await expect(form).toHaveCount(0);
    await expect(
      editor.getByRole('link', { name: `Abrir enlace ${resourceTitle}`, exact: true }),
    ).toBeVisible();
  }

  await editor.getByRole('button', { name: 'Recurso', exact: true }).click();
  const fileForm = editor.getByRole('form', { name: 'Editor de recurso' });
  await fileForm.locator('input[type="file"]').setInputFiles({
    name: 'archivo-consecutivo.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Consecutive upload regression'),
  });
  await fileForm.getByRole('button', { name: 'Subir archivo', exact: true }).click();
  await expect(fileForm).toHaveCount(0);
  await expect(
    editor.getByRole('link', { name: 'Descargar archivo-consecutivo.txt', exact: true }),
  ).toBeVisible();

  const finalTitle = 'Edición después de publicar recursos';
  await title.fill(finalTitle);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(editor.getByRole('heading', { name: finalTitle, exact: true })).toBeVisible();
  await expect(save).toBeDisabled();

  const roadmapResponse = await api.get(course.apiPath());
  await ok(roadmapResponse);
  const savedNode = (await roadmapResponse.json()).nodes.find(
    (item: { id: string }) => item.id === course.nodes.first,
  );
  expect(savedNode.title).toBe(finalTitle);
  expect(savedNode.resources).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: 'Primer enlace consecutivo',
        url: 'https://example.test/material',
        type: 'LINK',
      }),
      expect.objectContaining({
        title: 'Segundo enlace consecutivo',
        url: 'https://example.test/material',
        type: 'LINK',
      }),
      expect.objectContaining({ title: 'archivo-consecutivo.txt', type: 'FILE' }),
    ]),
  );
  await title.fill('Siguiente edición disponible');
  await expect(save).toBeEnabled();
  await editor.screenshot({ path: testInfo.outputPath('consecutive-edits-and-resources.png') });
});
