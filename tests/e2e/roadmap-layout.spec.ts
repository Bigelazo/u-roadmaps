import { expect, test } from '@playwright/test';
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
