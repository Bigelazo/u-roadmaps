import type { Page } from '@playwright/test';
import { literal, queryJson } from './database';
import { enterRoadmap } from './enter-roadmap';
import { fileDrop } from './file-drop';
import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

const steps = [
  'Centrar mapa',
  'Tipo de nodo y recursos',
  'Nodo oculto',
  'Bloqueo docente',
  'Crea un nodo',
  'Tipos de nodo',
  'Conecta tu nodo',
  'Dependencias',
  'Selecciona tu nodo',
  'Editor de nodo',
  'Bloquea una rama',
  'Bloqueo propagado',
  'Desbloquea la rama',
  'Desbloqueo programado',
  'Oculta un nodo',
  'Agrega un recurso',
  'Elimina tu nodo',
  'Vista estudiante',
  'Completa un nodo',
  'Nodos liberados',
  'Vuelve al editor',
  'Tutorial completado',
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

async function openNodeMenu(page: Page, title: string, item: string) {
  const node = practiceNode(page, title);
  await node.getByRole('button', { name: 'Abrir menú de acciones del nodo' }).click();
  await node.getByRole('button', { name: item, exact: true }).click();
}

function blockedByTeacher(page: Page, title: string) {
  // While editing, a Teacher block shows as the lock on the Node's menu trigger.
  return practiceNode(page, title).locator('svg.lucide-lock-keyhole');
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
  const transfer = await fileDrop(page, 'guia.md', markdown);
  const description = dialog.getByLabel(/Descripción/);
  await description.dispatchEvent('drop', { dataTransfer: transfer });
  const markdownConfirmation = page.getByRole('alertdialog', {
    name: 'Reemplazar texto con Markdown',
  });
  await markdownConfirmation.getByRole('button', { name: 'Reemplazar texto' }).click();
  await expect(description).toHaveValue(markdown);
  await transfer.dispose();
  // Portaled popups, like the Node type options, stay usable during an action step.
  await dialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Evaluación' }).click();
  await expect(dialog.getByLabel('Tipo')).toContainText('Evaluación');
  await expect(dialog.getByRole('checkbox', { name: 'Visible para estudiantes' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Agregar nodo' }).click();
  // "Tipos de nodo" is explained on its own, without creating a Custom node type.
  await expectStep(page, 'Tipos de nodo');
  await expect(creator).toHaveClass(/driver-active-element/);
  await next(page, 'Conecta tu nodo');
  await expect(practiceNode(page, 'Nodo de práctica')).toBeVisible();

  // The new Node may still be settling into place, so the drag is retried until it connects.
  await expect(async () => {
    await connect(page, 'Nodo de práctica', 'Control 1');
    await expect(page.locator('.react-flow__edge')).toHaveCount(9, { timeout: 1000 });
  }).toPass();
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

  await next(page, 'Bloquea una rama');

  // The confirmation is portaled, and stays usable.
  await openNodeMenu(page, 'Conceptos básicos', 'Bloquear rama');
  const confirmation = page.getByRole('alertdialog');
  await confirmation.getByRole('button', { name: 'Bloquear rama' }).click();
  await expectStep(page, 'Bloqueo propagado');
  for (const title of [
    'Conceptos básicos',
    'Ejercicios guiados',
    'Control 1',
    'Proyecto final',
    'Retroalimentación del control',
  ])
    await expect(blockedByTeacher(page, title)).toBeVisible();
  await next(page, 'Desbloquea la rama');

  await openNodeMenu(page, 'Conceptos básicos', 'Desbloquear');
  await expect(confirmation.getByRole('button', { name: 'Desbloquear este Nodo' })).toBeVisible();
  await confirmation.getByRole('button', { name: 'Desbloquear la rama' }).click();
  await expectStep(page, 'Desbloqueo programado');
  await expect(blockedByTeacher(page, 'Ejercicios guiados')).toHaveCount(0);
  await next(page, 'Oculta un nodo');

  // Cancelling the confirmation keeps the step.
  await openNodeMenu(page, 'Retroalimentación del control', 'Ocultar para estudiantes');
  await expect(confirmation).toContainText('Dependencias que se eliminarán');
  await confirmation.getByRole('button', { name: 'Cancelar' }).click();
  await expectStep(page, 'Oculta un nodo');
  await openNodeMenu(page, 'Retroalimentación del control', 'Ocultar para estudiantes');
  await confirmation.getByRole('button', { name: 'Ocultar' }).click();
  await expectStep(page, 'Agrega un recurso');

  await openNodeMenu(page, 'Nodo de práctica', 'Agregar recurso');
  const composer = page.locator('[aria-label="Editor de recurso"]');
  await expect(composer.getByLabel('Enlace')).toHaveValue(/wikipedia\.org/);
  await composer.getByRole('button', { name: 'Agregar enlace' }).click();
  await expectStep(page, 'Elimina tu nodo');

  await openNodeMenu(page, 'Nodo de práctica', 'Eliminar nodo');
  await confirmation.getByRole('button', { name: 'Cancelar' }).click();
  await expectStep(page, 'Elimina tu nodo');
  await openNodeMenu(page, 'Nodo de práctica', 'Eliminar nodo');
  await confirmation.getByRole('button', { name: 'Eliminar' }).click();
  await expectStep(page, 'Vista estudiante');
  await expect(practiceNode(page, 'Nodo de práctica')).toHaveCount(0);

  await page.getByRole('button', { name: 'Vista estudiante' }).click();
  await expectStep(page, 'Completa un nodo');
  await expect(
    practiceNode(page, 'Conceptos básicos').getByRole('img', { name: 'Bloqueado' }),
  ).toBeVisible();
  await practiceNode(page, 'Introducción').click();
  await page.getByRole('button', { name: 'Completar' }).click();
  await expectStep(page, 'Nodos liberados');
  await expect(
    practiceNode(page, 'Conceptos básicos').getByRole('img', { name: 'Pendiente' }),
  ).toBeVisible();
  await expect(
    practiceNode(page, 'Lectura complementaria').getByRole('img', { name: 'Pendiente' }),
  ).toBeVisible();
  await next(page, 'Vuelve al editor');
  await page.getByRole('button', { name: 'Ir al editor' }).click();
  await expectStep(page, 'Tutorial completado');
  await expect(page.getByRole('button', { name: 'Vista estudiante' })).toBeVisible();

  await tourPopover(page).getByRole('button', { name: 'Finalizar' }).click();
  await expect(tourPopover(page)).toHaveCount(0);
  expect(
    await queryJson<number>(
      `SELECT count(*)::int FROM "RoadmapNotice" WHERE "recipientId" = ${literal(user.id)};`,
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
      `SELECT count(*)::int FROM "RoadmapNotice" WHERE "roadmapId" = ${literal(course.roadmapId)};`,
    ),
  ).toBe(0);
});

async function roadmapShape(roadmapId: string) {
  return queryJson<unknown>(`
    SELECT json_build_object(
      'nodes', (SELECT count(*) FROM "RoadmapNode" WHERE "roadmapId" = ${literal(roadmapId)}),
      'dependencies', (
        SELECT count(*) FROM "Dependency" d
        JOIN "RoadmapNode" n ON n.id = d."sourceNodeId"
        WHERE n."roadmapId" = ${literal(roadmapId)}
      )
    );
  `);
}
