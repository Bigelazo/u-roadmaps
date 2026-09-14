import { expect, test, type Locator } from '@playwright/test';
import { authenticateAs, fixture, roadmapPath } from './helpers';

async function expectViewportFitsPage(page: import('@playwright/test').Page) {
  const documentMetrics = await page.evaluate(() => {
    const scrollingElement = document.scrollingElement;
    if (!scrollingElement) throw new Error('No se encontró el elemento de desplazamiento.');
    return {
      clientHeight: scrollingElement.clientHeight,
      scrollHeight: scrollingElement.scrollHeight,
    };
  });

  expect(
    documentMetrics.scrollHeight,
    `El documento mide ${documentMetrics.scrollHeight}px para un viewport de ${documentMetrics.clientHeight}px.`,
  ).toBeLessThanOrEqual(documentMetrics.clientHeight);
}

function overlaps(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`No se pudo medir ${locator}.`);
  return box;
}

async function expectBottomRightOverlay(canvas: Locator, overlay: Locator) {
  const [canvasBox, overlayBox] = await Promise.all([bounds(canvas), bounds(overlay)]);
  expect(overlayBox.x).toBeGreaterThanOrEqual(canvasBox.x);
  expect(canvasBox.x + canvasBox.width - overlayBox.x - overlayBox.width).toBeCloseTo(20, 0);
  expect(canvasBox.y + canvasBox.height - overlayBox.y - overlayBox.height).toBeCloseTo(18, 0);
}

test('roadmap fits the viewport for teachers and students without residual vertical scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await authenticateAs(page.context(), fixture.daniela);
  await page.goto('/courses/CC1002/2026/2');
  await expect(page.getByRole('heading', { name: 'Introducción a la Programación' })).toBeVisible();
  await expectViewportFitsPage(page);

  await page.context().clearCookies();
  await authenticateAs(page.context(), fixture.cc1002StudentWithProgress);
  await page.goto('/courses/CC1002/2026/2');
  await expect(page.getByRole('heading', { name: 'Introducción a la Programación' })).toBeVisible();
  await expectViewportFitsPage(page);
});

test('uploading a resource preserves the roadmap viewport and sends multipart data', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1870, height: 939 });
  await authenticateAs(page.context(), fixture.daniela);
  await page.goto('/courses/CC1002/2026/2');
  await expect(page.getByRole('heading', { name: 'Introducción a la Programación' })).toBeVisible();

  await page.locator(`.react-flow__node[data-id="${fixture.cc1002.firstNode}"]`).click();
  await page.getByRole('button', { name: 'Recurso', exact: true }).click();
  await page.getByLabel('Archivo', { exact: true }).setInputFiles({
    name: 'guia-viewport.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 viewport guide'),
  });

  const uploadResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(roadmapPath(`/nodes/${fixture.cc1002.firstNode}/resources`)),
    ),
    page.getByRole('button', { name: 'Subir archivo' }).click(),
  ]).then(([response]) => response);

  expect(uploadResponse.status()).toBe(201);
  const body = await uploadResponse.json();
  await expect(page.getByRole('heading', { name: 'Introducción a la Programación' })).toBeVisible();
  await expectViewportFitsPage(page);
  await page.request.delete(roadmapPath(`/resources/${body.resource.id}`));
});

test('groups editing controls without visual overlap on narrow viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await authenticateAs(page.context(), fixture.daniela);
  await page.goto('/courses/CC1002/2026/2');
  await page.locator(`.react-flow__node[data-id="${fixture.cc1002.firstNode}"]`).click();
  await page.getByRole('button', { name: 'Ocultar panel de edición' }).click();
  await expect(page.getByRole('button', { name: 'Mostrar panel de edición' })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  const controls = [
    page.getByRole('button', { name: /Ordenar/ }),
    page.getByRole('button', { name: 'Crear en el mapa' }),
    page.getByRole('button', { name: 'Mostrar panel de edición' }),
  ];
  for (const control of controls) await expect(control).toBeVisible();

  const boxes = await Promise.all(
    controls.map(async (control) => {
      const box = await control.boundingBox();
      if (!box) throw new Error('No se pudo obtener la posición de un control del roadmap.');
      return box;
    }),
  );

  expect(overlaps(boxes[0], boxes[1])).toBe(false);
  expect(overlaps(boxes[0], boxes[2])).toBe(false);
  expect(overlaps(boxes[1], boxes[2])).toBe(false);
});

test('keeps graph overlays inside the canvas when a teaching panel opens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticateAs(page.context(), fixture.daniela);
  await page.goto('/courses/CC1002/2026/2');

  const canvas = page.getByLabel('Lienzo del roadmap');
  const metadata = page.getByRole('heading', { name: 'Introducción a la Programación' });
  const shortcuts = page.locator('details[aria-label="Atajos de teclado"]');
  await expect(metadata).toBeVisible();
  await expect(shortcuts).toBeVisible();

  const firstNode = page.locator(`.react-flow__node[data-id="${fixture.cc1002.firstNode}"]`);
  await firstNode.click();
  await expect(page.locator('#roadmap-editor-panel')).toBeVisible();

  const [canvasBox, metadataBox] = await Promise.all([
    bounds(canvas),
    bounds(canvas.locator('header')),
  ]);
  expect(metadataBox.x - canvasBox.x).toBeCloseTo(24, 0);
  expect(metadataBox.y - canvasBox.y).toBeCloseTo(24, 0);
  await expect(canvas.locator('header')).toHaveCSS('pointer-events', 'none');
  await expectBottomRightOverlay(canvas, shortcuts);
  await shortcuts.locator('summary').click();
  await expect(shortcuts).toHaveAttribute('open', '');
  await expectBottomRightOverlay(canvas, shortcuts);

  await page.getByRole('button', { name: 'Ocultar panel de edición' }).click();
  await page.getByRole('button', { name: 'Previsualizar canvas' }).click();
  await expect(page.getByText('Previsualización del canvas')).toBeVisible();
  const previewToolbar = canvas.locator('.react-flow__panel.top.center');
  const [previewCanvasBox, previewBox] = await Promise.all([
    bounds(canvas),
    bounds(previewToolbar),
  ]);
  expect(previewBox.y - previewCanvasBox.y).toBeCloseTo(12, 0);
  expect(previewBox.x + previewBox.width / 2).toBeCloseTo(
    previewCanvasBox.x + previewCanvasBox.width / 2,
    0,
  );
  await expect(shortcuts).toHaveAttribute('open', '');

  const previewNode = page.locator(`.react-flow__node[data-id="${fixture.cc1002.firstNode}"]`);
  await previewNode.click();
  await expect(page.locator('#student-node-detail-panel')).toBeVisible();
  await expectBottomRightOverlay(canvas, shortcuts);
  await page.getByRole('button', { name: 'Ir al editor' }).click();
  await expect(page.getByRole('button', { name: 'Previsualizar canvas' })).toBeFocused();
  await expect(shortcuts).toHaveAttribute('open', '');

  await page.setViewportSize({ width: 375, height: 812 });
  const [mobileCanvasBox, mobileMetadataBox] = await Promise.all([
    bounds(canvas),
    bounds(canvas.locator('header')),
  ]);
  expect(mobileMetadataBox.x - mobileCanvasBox.x).toBeCloseTo(16, 0);
  expect(mobileMetadataBox.y - mobileCanvasBox.y).toBeCloseTo(16, 0);
  expect(mobileMetadataBox.width).toBeLessThanOrEqual(mobileCanvasBox.width - 32);
  await expectBottomRightOverlay(canvas, shortcuts);
  await page.getByRole('button', { name: 'Previsualizar canvas' }).click();
  const mobilePreviewBox = await bounds(previewToolbar);
  expect(mobilePreviewBox.width).toBeCloseTo(mobileCanvasBox.width - 32, 0);
  expect(mobilePreviewBox.x + mobilePreviewBox.width / 2).toBeCloseTo(
    mobileCanvasBox.x + mobileCanvasBox.width / 2,
    0,
  );
  await page.getByRole('button', { name: 'Ir al editor' }).click();
  await expect(page.getByRole('button', { name: 'Previsualizar canvas' })).toBeFocused();
});

test('keeps feedback above shortcut help beside an open editor without losing disclosure state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await authenticateAs(page.context(), fixture.daniela);
  await page.goto('/courses/CC1002/2026/2');
  const canvas = page.getByLabel('Lienzo del roadmap');
  const shortcuts = page.getByRole('group', { name: 'Atajos de teclado' });
  await shortcuts.locator('summary').click();
  await page.locator(`.react-flow__node[data-id="${fixture.cc1002.firstNode}"]`).click();
  await expect(page.locator('#roadmap-editor-panel')).toBeVisible();

  // Exercise the real mutation UI while keeping the shared fixture unchanged.
  await page.route(`**${roadmapPath(`/nodes/${fixture.cc1002.firstNode}`)}`, async (route) => {
    await route.fulfill({ status: 200, json: {} });
  });
  await page.getByLabel('Título', { exact: true }).fill('Variables revisadas');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  const success = page.getByRole('status', { name: 'Cambios guardados exitosamente.' });
  await expect(success).toBeVisible();
  await expectBottomRightOverlay(canvas, success);
  await expect(shortcuts).toHaveAttribute('open', '');

  await page.route(`**${roadmapPath(`/nodes/${fixture.cc1002.firstNode}`)}`, async (route) => {
    await route.fulfill({ status: 409, json: { error: 'No se pudo guardar el nodo.' } });
  });
  await page.getByLabel('Título', { exact: true }).fill('Variables con error');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  const error = page.getByRole('alert', { name: 'No se pudo guardar el nodo.' });
  await expect(error).toBeVisible();
  await expectBottomRightOverlay(canvas, error);
  await expectBottomRightOverlay(canvas, success);
  await expectBottomRightOverlay(canvas, shortcuts);

  // The later success surface retains priority while both notifications exist.
  await page.getByRole('button', { name: 'Cerrar notificación' }).click();
  await expect(success).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar alerta' }).click();
  await expect(error).toHaveCount(0);
  await expect(shortcuts).toHaveAttribute('open', '');
  await shortcuts.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(shortcuts).not.toHaveAttribute('open');
});

test('keeps the radial node actions above their canvas focus treatment', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await authenticateAs(page.context(), fixture.daniela);
  await page.goto('/courses/CC1002/2026/2');

  const node = page.locator(`.react-flow__node[data-id="${fixture.cc1002.firstNode}"]`);
  await node.getByRole('button', { name: 'Abrir menú de acciones del nodo' }).click();

  await page.getByRole('button', { name: 'Ocultar para estudiantes' }).click();

  await expect(page.getByRole('alertdialog', { name: 'Confirmar ocultación' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
});

test('keeps radial node actions evenly sized and separated', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await authenticateAs(page.context(), fixture.daniela);
  await page.goto('/courses/CC1002/2026/2');

  const node = page.locator(`.react-flow__node[data-id="${fixture.cc1002.firstNode}"]`);
  const trigger = node.getByRole('button', { name: 'Abrir menú de acciones del nodo' });
  await trigger.click();
  await page.waitForTimeout(450);
  await page.mouse.move(0, 0);

  const controls = [
    node.getByRole('button', { name: 'Cerrar menú de acciones del nodo' }),
    page.getByRole('button', { name: 'Bloquear rama' }),
    page.getByRole('button', { name: 'Ocultar para estudiantes' }),
    page.getByRole('button', { name: 'Agregar recurso' }),
    page.getByRole('button', { name: 'Eliminar nodo' }),
  ];
  const boxes = await Promise.all(
    controls.map(async (control) => {
      const box = await control.boundingBox();
      if (!box) throw new Error('No se pudo medir un control radial.');
      return box;
    }),
  );

  for (const box of boxes) {
    expect(box.width).toBeCloseTo(boxes[0].width, 1);
    expect(box.height).toBeCloseTo(boxes[0].height, 1);
  }
  for (let index = 1; index < boxes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < boxes.length; otherIndex += 1) {
      expect(overlaps(boxes[index], boxes[otherIndex])).toBe(false);
    }
  }
});
