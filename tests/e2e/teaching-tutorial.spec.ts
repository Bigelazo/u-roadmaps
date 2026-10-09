import type { Page } from '@playwright/test';
import { queryJson } from './database';
import { enterRoadmap } from './enter-roadmap';
import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

const steps = [
  'Centrar mapa',
  'Tipo de nodo y recursos',
  'Nodo oculto',
  'Bloqueo docente',
  'Crea un nodo',
  'Conecta tu nodo',
  'Dependencias',
  'Selecciona tu nodo',
  'Editor de nodo',
];

function tourPopover(page: Page) {
  return page.locator('.driver-popover');
}

function practiceNode(page: Page, title: string) {
  return page.locator('.react-flow__node').filter({ hasText: title });
}

async function expectStep(page: Page, title: string) {
  await expect(tourPopover(page).locator('.driver-popover-title')).toHaveText(title);
  await expect(tourPopover(page).locator('.driver-popover-progress-text')).toHaveText(
    `${steps.indexOf(title) + 1} de ${steps.length}`,
  );
}

async function next(page: Page, title: string) {
  await tourPopover(page).getByRole('button', { name: 'Siguiente' }).click();
  await expectStep(page, title);
}

async function connect(page: Page, sourceTitle: string, targetTitle: string) {
  const source = practiceNode(page, sourceTitle).locator('.react-flow__handle-right');
  const target = practiceNode(page, targetTitle).locator('.react-flow__handle-left');
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('No se pudieron medir las conexiones.');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('teaching staff perform each action step of the teaching tutorial', async ({
  page,
  createUser,
}) => {
  const user = await createUser();
  await authenticateAs(page.context(), user.id);
  await page.goto('/practice-roadmap/teaching?origin=%2Facademic-overview');

  // An action step offers no "Siguiente": only its action advances it.
  await expectStep(page, 'Centrar mapa');
  await expect(tourPopover(page).getByRole('button', { name: 'Siguiente' })).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expectStep(page, 'Centrar mapa');
  await page.getByRole('button', { name: 'Centrar mapa' }).click();
  await expectStep(page, 'Tipo de nodo y recursos');

  await next(page, 'Nodo oculto');
  await expect(practiceNode(page, 'Material de apoyo')).toHaveClass(/driver-active-element/);
  await next(page, 'Bloqueo docente');
  await next(page, 'Crea un nodo');
  await expect(tourPopover(page)).toContainText('Gestionar tipos de nodo');
  await expect(tourPopover(page)).toContainText('archivo .md');

  // Cancelling the creation dialog keeps the step and highlights "Crear en el mapa" again.
  const creator = page.getByRole('button', { name: 'Crear en el mapa' });
  const dialog = page.getByRole('dialog', { name: 'Agregar al mapa' });
  await creator.click();
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  await expect(dialog).toHaveClass(/driver-active-element/);
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toHaveCount(0);
  await expectStep(page, 'Crea un nodo');
  await expect(
    page.locator('.driver-active-element').getByRole('button', { name: 'Crear en el mapa' }),
  ).toBeVisible();

  await creator.click();
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  await dialog.getByLabel('Título').fill('Nodo de práctica');
  const markdown = '# Guía del nodo\n\nRepasa **límites**.\n';
  const transfer = await page.evaluateHandle((text) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([text], 'guia.md', { type: 'text/markdown' }));
    return dataTransfer;
  }, markdown);
  const description = dialog.getByLabel(/Descripción/);
  await description.dispatchEvent('drop', { dataTransfer: transfer });
  const confirmation = page.getByRole('alertdialog', { name: 'Reemplazar texto con Markdown' });
  // A real click is blocked by the highlighted dialog until #214 lets portaled UI through.
  await confirmation.getByRole('button', { name: 'Reemplazar texto' }).dispatchEvent('click');
  await expect(description).toHaveValue(markdown);
  await transfer.dispose();
  await expect(dialog.getByRole('checkbox', { name: 'Visible para estudiantes' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Agregar nodo' }).click();
  await expectStep(page, 'Conecta tu nodo');
  await expect(practiceNode(page, 'Nodo de práctica')).toBeVisible();

  await connect(page, 'Nodo de práctica', 'Control 1');
  await expect(page.locator('.react-flow__edge')).toHaveCount(9);
  await expectStep(page, 'Dependencias');
  await expect(tourPopover(page)).toContainText('ciclos');
  await next(page, 'Selecciona tu nodo');

  // Selecting another Node keeps the step.
  await practiceNode(page, 'Introducción').click();
  await expect(page.locator('[aria-label="Editor de nodo"]')).toBeVisible();
  await expectStep(page, 'Selecciona tu nodo');
  await practiceNode(page, 'Nodo de práctica').click();
  await expectStep(page, 'Editor de nodo');
  await expect(page.locator('[aria-label="Editor de nodo"]')).toHaveClass(/driver-active-element/);
  await expect(page.locator('[aria-label="Editor de nodo"]').getByLabel(/Descripción/)).toHaveValue(
    markdown,
  );

  await tourPopover(page).getByRole('button', { name: 'Finalizar' }).click();
  await expect(tourPopover(page)).toHaveCount(0);
  expect(
    await queryJson<number>(
      `SELECT count(*)::int FROM "RoadmapNotice" WHERE "recipientId" = '${user.id}';`,
    ),
  ).toBe(0);
});

test('the canvas question-mark icon opens the teaching tutorial and points back to the Roadmap', async ({
  page,
  course,
}) => {
  const before = await roadmapShape(course.roadmapId);
  await enterRoadmap(page, course.pagePath(), course.users.teacher.id);
  await page.getByRole('button', { name: 'Vista estudiante' }).click();
  await expect(page.getByText('Previsualización del canvas')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir tutorial' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ir al editor' }).click();

  await page.getByRole('link', { name: 'Abrir tutorial' }).click();
  await expect(page).toHaveURL(/\/practice-roadmap\/teaching\?origin=/);
  await expectStep(page, 'Centrar mapa');
  await page.getByRole('button', { name: 'Centrar mapa' }).click();
  await expectStep(page, 'Tipo de nodo y recursos');

  await page.getByRole('link', { name: 'Salir' }).click();
  await expect(page).toHaveURL(new RegExp(`${course.pagePath()}$`));
  await expect(tourPopover(page)).toContainText('repetir el tutorial');
  await expect(page.getByRole('link', { name: 'Abrir tutorial' })).toHaveClass(
    /driver-active-element/,
  );
  expect(await roadmapShape(course.roadmapId)).toEqual(before);
  expect(
    await queryJson<number>(
      `SELECT count(*)::int FROM "RoadmapNotice" WHERE "roadmapId" = '${course.roadmapId}';`,
    ),
  ).toBe(0);
});

async function roadmapShape(roadmapId: string) {
  return queryJson<unknown>(`
    SELECT json_build_object(
      'nodes', (SELECT count(*) FROM "RoadmapNode" WHERE "roadmapId" = '${roadmapId}'),
      'dependencies', (
        SELECT count(*) FROM "Dependency" d
        JOIN "RoadmapNode" n ON n.id = d."sourceNodeId"
        WHERE n."roadmapId" = '${roadmapId}'
      )
    );
  `);
}
