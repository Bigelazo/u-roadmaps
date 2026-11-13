import { observeTutorialExit, tutorialExitFailures } from './tutorial-presentation-observer';
import type { Locator, Page } from '@playwright/test';
import { literal, queryJson } from './database';
import { enterRoadmap } from './enter-roadmap';
import { fileDrop } from './file-drop';
import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';
import { expectExitReachable } from './tutorial-exit';

const steps = [
  'Muévete por el mapa',
  'Centrar mapa',
  'Nodos',
  'Nodo oculto',
  'Nodo bloqueado',
  'Crea un nodo',
  'Tipos de nodo',
  'Conecta tu nodo',
  'Selecciona tu nodo',
  'Editor de nodo',
  'Bloquea un nodo',
  'Bloqueo propagado',
  'Desbloquea un nodo',
  'Desbloqueo programado',
  'Oculta un nodo',
  'Agregar recursos',
  'Elimina tu nodo',
  'Vista estudiante',
  'Avance del curso',
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

function stepDescription(page: Page) {
  return tourPopover(page).locator('.driver-popover-description');
}

async function receivesPointer(target: Locator) {
  return target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit !== null && element.contains(hit);
  });
}

async function expectOnlyNodeActionInteractive(
  page: Page,
  title: string,
  action: string,
  confirmationAction: string,
  confirmationText: string,
) {
  const node = practiceNode(page, title);
  const trigger = node.getByRole('button', { name: 'Abrir menú de acciones del nodo' });
  await expect(trigger).toHaveClass(/driver-active-element/);
  await expect(stepDescription(page)).toHaveText('Abre el menú Acciones del nodo.');
  await expect(stepDescription(page).locator('svg.lucide-settings')).toHaveCount(1);
  expect(await receivesPointer(node.getByTestId('roadmap-card'))).toBe(false);
  await expect.poll(() => receivesPointer(trigger)).toBe(true);
  await trigger.click();
  const item = node.getByRole('button', { name: action, exact: true });
  await expect(item).toHaveClass(/driver-active-element/);
  await expect(stepDescription(page)).toHaveText(`Elige ${action}.`);
  for (const sibling of await node.locator('[id^="node-actions-"] button').all())
    if ((await sibling.getAttribute('aria-label')) !== action)
      expect(await receivesPointer(sibling)).toBe(false);
  await item.click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toHaveClass(/driver-active-element/);
  await expect(stepDescription(page)).toHaveText(confirmationText);
  await confirmation.getByRole('button', { name: confirmationAction }).click();
}

function blockedByTeacher(page: Page, title: string) {
  return practiceNode(page, title).locator('svg.lucide-lock-keyhole');
}

async function dragBetween(page: Page, from: Locator, to: Locator) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error('No se pudieron medir los elementos.');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function connect(page: Page, sourceTitle: string, targetTitle: string) {
  await practiceNode(page, sourceTitle).getByTestId('roadmap-card').hover();
  const source = practiceNode(page, sourceTitle).locator('[data-node-connector="right"]');
  const target = practiceNode(page, targetTitle).getByTestId('roadmap-card');
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('No se pudieron medir las conexiones.');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('an anonymous visitor performs each action step of the teaching tutorial', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const activityRequests: string[] = [];
  page.on('request', (request) => {
    if (/^\/api\/(tutorial|notifications)\//.test(new URL(request.url()).pathname))
      activityRequests.push(request.url());
  });
  await page.goto('/practice-roadmap/teaching');

  await expectStep(page, 'Muévete por el mapa');
  await observeTutorialExit(page);
  await expect(tourPopover(page).getByRole('button', { name: 'Anterior' })).toHaveCount(0);
  const viewport = page.locator('.react-flow__viewport');
  const initialTransform = await viewport.getAttribute('style');
  const canvas = await page.locator('.react-flow__pane').boundingBox();
  expect(canvas).not.toBeNull();
  await page.mouse.move(canvas!.x + 60, canvas!.y + canvas!.height - 90);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + 150, canvas!.y + canvas!.height - 150, { steps: 8 });
  await page.mouse.up();
  await expect(viewport).not.toHaveAttribute('style', initialTransform!);
  const draggedTransform = await viewport.getAttribute('style');
  await page.mouse.wheel(0, -150);
  await expect(viewport).not.toHaveAttribute('style', draggedTransform!);
  const zoomedTransform = await viewport.getAttribute('style');
  await dragBetween(
    page,
    practiceNode(page, 'Introducción').getByTestId('roadmap-card'),
    practiceNode(page, 'Conceptos básicos').getByTestId('roadmap-card'),
  );
  await expect(viewport).not.toHaveAttribute('style', zoomedTransform!);
  await expect(page.locator('#roadmap-editor-panel')).toBeHidden();
  for (const control of [
    page.getByRole('button', { name: 'Vista estudiante' }),
    page.getByRole('button', { name: 'Crear en el mapa' }),
    practiceNode(page, 'Introducción').getByRole('button', {
      name: 'Abrir menú de acciones del nodo',
    }),
  ])
    expect(await receivesPointer(control)).toBe(false);

  await next(page, 'Centrar mapa');
  await next(page, 'Nodos');
  await tourPopover(page).getByRole('button', { name: 'Anterior' }).click();
  await expectStep(page, 'Centrar mapa');
  await page.getByRole('button', { name: 'Centrar mapa' }).click();
  await next(page, 'Nodos');

  await next(page, 'Nodo oculto');
  await tourPopover(page).getByRole('button', { name: 'Anterior' }).click();
  await expectStep(page, 'Nodos');
  await next(page, 'Nodo oculto');
  await expect(practiceNode(page, 'Material de apoyo')).toHaveClass(/driver-active-element/);
  await next(page, 'Nodo bloqueado');
  await next(page, 'Crea un nodo');
  await expect(tourPopover(page).locator('.driver-popover-description')).toHaveText(
    'A continuación, presiona el botón flotante.',
  );

  const creator = page.getByRole('button', { name: 'Crear en el mapa' });
  const dialog = page.getByRole('dialog', { name: 'Crear nodo' });
  await expect(tourPopover(page)).toHaveCSS('opacity', '1');
  const gridClip = { x: 8, y: 200, width: 80, height: 80 };
  const gridBeforeMenu = await page.screenshot({ clip: gridClip });
  await creator.click();
  await expect(tourPopover(page).locator('.driver-popover-description')).toHaveText(
    'Elige Crear nodo.',
  );
  expect(await page.screenshot({ clip: gridClip })).toEqual(gridBeforeMenu);
  await expect(
    tourPopover(page).locator('.driver-popover-description svg.lucide-circle-plus'),
  ).toHaveCount(1);
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  await expect(tourPopover(page).locator('.driver-popover-description')).toHaveText(
    'Escribe un título y, si quieres, una descripción o un tipo distinto. Durante el tutorial, el nodo quedará visible para estudiantes.',
  );
  await expect(dialog).toHaveClass(/driver-active-element/);
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toHaveCount(0);
  await expectStep(page, 'Crea un nodo');
  await expect(
    page.locator('.driver-active-element').getByRole('button', { name: 'Crear en el mapa' }),
  ).toBeVisible();

  await creator.click();
  await expect
    .poll(() => receivesPointer(page.getByRole('menuitem', { name: 'Gestionar tipos de nodo' })))
    .toBe(false);
  expect(await receivesPointer(creator)).toBe(false);
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  const hidden = dialog.getByRole('radio', { name: 'Oculto' });
  await hidden.dispatchEvent('click');
  await hidden.focus();
  await page.keyboard.press('Space');
  await expect(dialog.getByRole('radio', { name: 'Visible' })).toBeChecked();
  await dialog.getByLabel('Título').fill('Nodo de práctica');
  const markdown = '# Guía del nodo\n\nRepasa **límites**.\n';
  const transfer = await fileDrop(page, 'guia.md', markdown);
  const description = dialog.getByLabel(/^Contenido/);
  await description.dispatchEvent('drop', { dataTransfer: transfer });
  const markdownConfirmation = page.getByRole('alertdialog', {
    name: '¿Reemplazar el texto con el archivo Markdown?',
  });
  await markdownConfirmation.getByRole('button', { name: 'Reemplazar texto' }).click();
  await expect(description).toHaveValue(markdown);
  await transfer.dispose();
  await dialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Evaluación' }).click();
  await expect(dialog.getByLabel('Tipo')).toContainText('Evaluación');
  await expect(dialog.getByRole('radio', { name: 'Visible' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Crear nodo' }).click();
  await expectStep(page, 'Tipos de nodo');
  await expect(tourPopover(page).getByRole('button', { name: 'Anterior' })).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await expectStep(page, 'Tipos de nodo');
  await expect(practiceNode(page, 'Nodo de práctica')).toHaveCount(1);
  const createdTransform = await practiceNode(page, 'Nodo de práctica').evaluate(
    (node) => node.style.transform,
  );
  expect(createdTransform).toBe('translate(960px, 360px)');
  const nodeTypesItem = page.getByRole('menuitem', { name: 'Gestionar tipos de nodo' });
  await expect(nodeTypesItem).toHaveClass(/driver-active-element/);
  expect(await receivesPointer(page.getByRole('menuitem', { name: 'Crear nodo' }))).toBe(false);
  await page.getByRole('menuitem', { name: 'Crear nodo' }).dispatchEvent('click');
  await expect(dialog).toHaveCount(0);
  await nodeTypesItem.click();
  const closeNodeTypes = page.getByRole('button', { name: 'Cerrar tipos de nodo' });
  await expect(closeNodeTypes).toBeVisible();
  await expectStep(page, 'Tipos de nodo');
  await closeNodeTypes.click();
  await expectStep(page, 'Conecta tu nodo');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(tourPopover(page).locator('[data-slot="node-name"]')).toHaveText([
    'Control 1',
    'Control 1',
    'Control 1',
  ]);
  await expect(tourPopover(page).locator('[data-slot="node-name-icon"]').first()).toHaveCSS(
    'color',
    'rgb(219, 39, 119)',
  );
  await expect(practiceNode(page, 'Nodo de práctica')).toBeVisible();
  await expect(tourPopover(page).locator('.driver-popover-description')).toContainText(
    'La dirección importa',
  );
  await practiceNode(page, 'Control 1').getByTestId('roadmap-card').click();
  await expect(page.locator('#roadmap-editor-panel')).toBeHidden();
  for (const title of ['Nodo de práctica', 'Control 1'])
    expect(
      await receivesPointer(
        practiceNode(page, title).getByRole('button', { name: 'Abrir menú de acciones del nodo' }),
      ),
    ).toBe(false);
  await practiceNode(page, 'Control 1').getByTestId('roadmap-card').hover();
  await dragBetween(
    page,
    practiceNode(page, 'Control 1').locator('[data-node-connector="left"]'),
    practiceNode(page, 'Nodo de práctica').getByTestId('roadmap-card'),
  );
  await expect(page.locator('.react-flow__edge')).toHaveCount(8);
  await expectStep(page, 'Conecta tu nodo');

  await expect(async () => {
    await connect(page, 'Nodo de práctica', 'Control 1');
    await expect(page.locator('.react-flow__edge')).toHaveCount(9, { timeout: 1000 });
  }).toPass();
  await expectStep(page, 'Selecciona tu nodo');
  await expect(tourPopover(page).getByRole('button', { name: 'Anterior' })).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await expectStep(page, 'Selecciona tu nodo');

  await expect(practiceNode(page, 'Nodo de práctica')).toHaveClass(/driver-active-element/);
  expect(
    await receivesPointer(
      practiceNode(page, 'Nodo de práctica').getByRole('button', {
        name: 'Abrir menú de acciones del nodo',
      }),
    ),
  ).toBe(false);
  const createdPosition = await practiceNode(page, 'Nodo de práctica').evaluate(
    (node) => node.style.transform,
  );
  await dragBetween(
    page,
    practiceNode(page, 'Nodo de práctica').getByTestId('roadmap-card'),
    practiceNode(page, 'Material de apoyo').getByTestId('roadmap-card'),
  );
  await expectStep(page, 'Selecciona tu nodo');
  expect(
    await practiceNode(page, 'Nodo de práctica').evaluate((node) => node.style.transform),
  ).toBe(createdPosition);
  await practiceNode(page, 'Nodo de práctica').click();
  await expectStep(page, 'Editor de nodo');
  await expect(tourPopover(page).getByRole('button', { name: 'Anterior' })).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await expectStep(page, 'Editor de nodo');
  await expect(page.locator('#roadmap-editor-panel [data-slot="sidebar-content"]')).toHaveClass(
    /driver-active-element/,
  );
  await expect(page.locator('[aria-label="Editor de nodo"]').getByLabel(/^Contenido/)).toHaveValue(
    markdown,
  );

  await expectExitReachable(page, 'editor-desktop');

  const editorTitle = page.locator('[aria-label="Editor de nodo"]').getByLabel('Título');
  expect(await receivesPointer(editorTitle)).toBe(false);
  await editorTitle.focus();
  await page.keyboard.type('xyz');
  await expect(editorTitle).toHaveValue('Nodo de práctica');
  await page
    .locator('#roadmap-editor-panel')
    .getByRole('button', { name: 'Deseleccionar nodo' })
    .dispatchEvent('click');
  await expect(page.getByLabel('Panel de edición del roadmap', { exact: true })).toBeVisible();
  const editorScroll = page.locator('#roadmap-editor-panel [data-slot="sidebar-content"]');
  const editorBox = await editorScroll.boundingBox();
  await page.mouse.move(editorBox!.x + editorBox!.width / 2, editorBox!.y + editorBox!.height / 2);
  await page.mouse.wheel(0, 700);
  await expect.poll(() => editorScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/tutorial-editor-scroll.png' });
  await editorScroll.evaluate((element) => {
    element.scrollTop = 0;
  });

  await next(page, 'Bloquea un nodo');
  const blockNode = practiceNode(page, 'Conceptos básicos');
  const blockMenuTrigger = blockNode.getByRole('button', {
    name: 'Abrir menú de acciones del nodo',
  });
  await expect(page.getByLabel('Panel de edición del roadmap', { exact: true })).toBeHidden();
  await expect(blockMenuTrigger).toHaveClass(/driver-active-element/);
  await expect(stepDescription(page)).toHaveText('Abre el menú Acciones del nodo.');
  await expect(
    tourPopover(page).locator('.driver-popover-description svg.lucide-settings'),
  ).toHaveCount(1);
  const beforeTooltip = await tourPopover(page).boundingBox();
  await blockMenuTrigger.hover();
  const tooltip = page
    .locator('[data-slot="tooltip-content"][data-open]')
    .filter({ hasText: 'Acciones del nodo' });
  await expect(tooltip).toBeVisible();
  expect(await tourPopover(page).boundingBox()).toEqual(beforeTooltip);
  await expect
    .poll(async () => {
      const tip = await tooltip.boundingBox();
      const popover = await tourPopover(page).boundingBox();
      if (!tip || !popover) return false;
      return (
        tip.x + tip.width <= popover.x ||
        popover.x + popover.width <= tip.x ||
        tip.y + tip.height <= popover.y ||
        popover.y + popover.height <= tip.y
      );
    })
    .toBe(true);
  await page.screenshot({ path: 'test-results/tutorial-action-tooltip.png' });
  await tourPopover(page).getByRole('button', { name: 'Anterior' }).click();
  await expectStep(page, 'Editor de nodo');
  await next(page, 'Bloquea un nodo');

  await blockMenuTrigger.click();
  const blockAction = blockNode.getByRole('button', { name: 'Bloquear nodo', exact: true });
  await expect(blockAction).toHaveClass(/driver-active-element/);
  await expect(tourPopover(page).locator('.driver-popover-description')).toHaveText(
    'Elige Bloquear nodo.',
  );
  await blockAction.click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toHaveClass(/driver-active-element/);
  await expect(tourPopover(page).locator('.driver-popover-description')).toHaveText(
    'Selecciona Bloquear nodo. Debido a que este nodo posee otros dependientes a él, estos también serán bloqueados.',
  );
  await expect(confirmation).toContainText(
    'Los estudiantes no podrán acceder a él hasta que lo desbloquees.',
  );
  await expect(confirmation).toContainText('También se bloquearán los 3 nodos que dependen de él.');
  await expect(confirmation.locator('[data-slot="node-name"] svg')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/tutorial-block-confirmation.png' });
  await confirmation.getByRole('button', { name: 'Cancelar' }).click();
  await expect(confirmation).toBeHidden();
  await expectStep(page, 'Bloquea un nodo');
  await expect(blockMenuTrigger).toHaveClass(/driver-active-element/);
  await blockMenuTrigger.click();
  await blockAction.click();
  await confirmation.getByRole('button', { name: 'Bloquear nodo' }).click();
  await expectStep(page, 'Bloqueo propagado');
  for (const title of [
    'Conceptos básicos',
    'Ejercicios guiados',
    'Control 1',
    'Proyecto final',
    'Retroalimentación del control',
  ])
    await expect(blockedByTeacher(page, title)).toBeVisible();
  await expect(stepDescription(page).locator('span.flex-col [data-slot="node-name"]')).toHaveText([
    'Ejercicios guiados',
    'Control 1',
    'Retroalimentación del control',
  ]);
  await expect(stepDescription(page)).toContainText(
    'Proyecto final ya estaba bloqueado desde antes.',
  );
  await page.screenshot({ path: 'test-results/tutorial-block-propagated.png' });

  await next(page, 'Desbloquea un nodo');
  await expectOnlyNodeActionInteractive(
    page,
    'Control 1',
    'Desbloquear',
    'Desbloquear 3 nodos',
    'Desbloquear un nodo que posee prerrequisitos que siguen bloqueados también los desbloqueará. Puedes elegir además entre desbloquear solo este nodo, o incluir además a los dependientes de él.',
  );
  await expectStep(page, 'Desbloqueo programado');
  await expect(page.getByLabel('Panel de edición del roadmap', { exact: true })).toBeHidden();
  await expect(practiceNode(page, 'Proyecto final')).toHaveClass(/driver-active-element/);
  await expect(practiceNode(page, 'Proyecto final')).toBeInViewport({ ratio: 0.99 });
  await expect(stepDescription(page)).toHaveText(
    'El nodo Proyecto final está configurado con un desbloqueo programado, será liberado al estudiantado en el día y hora seleccionados.',
  );
  for (const title of ['Conceptos básicos', 'Ejercicios guiados', 'Control 1'])
    await expect(blockedByTeacher(page, title)).toHaveCount(0);
  await expect(blockedByTeacher(page, 'Proyecto final')).toBeVisible();

  await next(page, 'Oculta un nodo');
  await page.screenshot({ path: 'test-results/tutorial-hide.png' });
  const hidingNode = practiceNode(page, 'Retroalimentación del control');
  await hidingNode.getByRole('button', { name: 'Abrir menú de acciones del nodo' }).click();
  await hidingNode.getByRole('button', { name: 'Ocultar para estudiantes', exact: true }).click();
  await expect(confirmation).toContainText('se eliminará su conexión');
  await confirmation.getByRole('button', { name: 'Cancelar' }).click();
  await expectStep(page, 'Oculta un nodo');
  await expectOnlyNodeActionInteractive(
    page,
    'Retroalimentación del control',
    'Ocultar para estudiantes',
    'Ocultar',
    'Selecciona Ocultar. Los estudiantes dejarán de verlo y se eliminará su conexión con Control 1.',
  );
  await expectStep(page, 'Agregar recursos');
  await expect(page.getByLabel('Panel de edición del roadmap', { exact: true })).toBeHidden();

  await expect(practiceNode(page, 'Nodo de práctica')).toHaveClass(/driver-active-element/);
  await expect(stepDescription(page)).toHaveText(
    'Tus nodos pueden tener recursos, como archivos o enlaces. Se agregan con Agregar recurso en el menú Acciones del nodo, o desde el panel de edición.',
  );
  await page.screenshot({ path: 'test-results/tutorial-resources.png' });
  await next(page, 'Elimina tu nodo');

  const createdNode = practiceNode(page, 'Nodo de práctica');
  await createdNode.getByRole('button', { name: 'Abrir menú de acciones del nodo' }).click();
  const deleteAction = createdNode.getByRole('button', { name: 'Eliminar nodo', exact: true });
  await expect(tourPopover(page).locator('svg.lucide-trash-2')).toHaveCSS(
    'color',
    await deleteAction.evaluate((element) => getComputedStyle(element).color),
  );
  await deleteAction.click();
  await confirmation.getByRole('button', { name: 'Cancelar' }).click();
  await expectStep(page, 'Elimina tu nodo');
  await expectOnlyNodeActionInteractive(
    page,
    'Nodo de práctica',
    'Eliminar nodo',
    'Eliminar nodo',
    'Antes de eliminar podrás ver la cantidad de recursos y dependencias asociadas que se perderán.',
  );
  await expectStep(page, 'Vista estudiante');
  await expect(practiceNode(page, 'Nodo de práctica')).toHaveCount(0);

  const studentView = page.getByRole('button', { name: 'Vista estudiante' });
  await expect(studentView).toHaveClass(/driver-active-element/);
  await expect(async () => {
    await page.keyboard.press('Tab');
    await expect(studentView).toBeFocused({ timeout: 100 });
  }).toPass();
  await page.keyboard.press('Enter');
  await expectStep(page, 'Avance del curso');
  await expect(stepDescription(page)).toHaveText(
    'El estudiantado debe completar progresivamente los nodos para poder avanzar con el curso.',
  );
  await expect(page.locator('.react-flow')).toHaveClass(/driver-no-interaction/);
  await next(page, 'Completa un nodo');
  await expect(
    practiceNode(page, 'Conceptos básicos').getByRole('img', { name: 'Bloqueado' }),
  ).toBeVisible();
  const introduction = practiceNode(page, 'Introducción');
  await expect(introduction).toHaveClass(/driver-active-element/);
  expect(await receivesPointer(practiceNode(page, 'Lectura complementaria'))).toBe(false);
  await introduction.click();
  const complete = page.getByRole('button', { name: 'Completar' });
  await expect(complete).toHaveClass(/driver-active-element/);
  await expect(stepDescription(page).locator('svg.lucide-circle-check-big')).toHaveCSS(
    'color',
    await complete.evaluate((element) => getComputedStyle(element).backgroundColor),
  );
  await complete.click();
  await expectStep(page, 'Nodos liberados');
  await expect(
    practiceNode(page, 'Conceptos básicos').getByRole('img', { name: 'Pendiente' }),
  ).toBeVisible();
  await expect(
    practiceNode(page, 'Lectura complementaria').getByRole('img', { name: 'Pendiente' }),
  ).toBeVisible();
  await next(page, 'Vuelve al editor');
  const editorReturn = page.getByRole('button', { name: 'Ir al editor' });
  await expect(editorReturn).toHaveClass(/driver-active-element/);
  await expect(async () => {
    await page.keyboard.press('Tab');
    await expect(editorReturn).toBeFocused({ timeout: 100 });
  }).toPass();
  await page.keyboard.press('Enter');
  await expectStep(page, 'Tutorial completado');
  await expect(stepDescription(page)).toHaveText(
    'Ya conoces lo esencial para utilizar el roadmap. Ahora puedes jugar y explorar este mapa de forma libre o salir del tutorial.',
  );
  await expect(page.getByRole('button', { name: 'Vista estudiante' })).toBeVisible();

  await tourPopover(page).getByRole('button', { name: 'Finalizar' }).click();
  await expect(tourPopover(page)).toHaveCount(0);
  expect(await tutorialExitFailures(page)).toEqual([]);
  expect(activityRequests).toEqual([]);
});

test('the canvas question-mark icon opens the teaching tutorial and points back to the Roadmap', async ({
  page,
  course,
}) => {
  const before = await roadmapShape(course.roadmapId);
  await enterRoadmap(page, course.pagePath(), course.users.teacher.id);
  await page.getByRole('button', { name: 'Vista estudiante' }).click();
  await expect(page.getByText('Vista estudiantil')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir tutorial' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ir al editor' }).click();

  await page.getByRole('link', { name: 'Abrir tutorial' }).click();
  await expect(page).toHaveURL(/\/practice-roadmap\/teaching\?origin=/);
  await expectStep(page, 'Muévete por el mapa');
  await next(page, 'Centrar mapa');
  await page.getByRole('button', { name: 'Centrar mapa' }).click();
  await next(page, 'Nodos');

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

test('the highlighted creation menu stays behind its floating button', async ({
  page,
  createUser,
}) => {
  const user = await createUser();
  await authenticateAs(page.context(), user.id);
  await page.goto('/practice-roadmap/teaching?origin=%2Facademic-overview');
  await expectStep(page, 'Muévete por el mapa');
  await next(page, 'Centrar mapa');
  await page.getByRole('button', { name: 'Centrar mapa' }).click();
  await next(page, 'Nodos');
  await next(page, 'Nodo oculto');
  await next(page, 'Nodo bloqueado');
  await next(page, 'Crea un nodo');
  const creator = page.getByRole('button', { name: 'Crear en el mapa' });
  await creator.click();
  await expect(page.getByRole('menuitem', { name: 'Crear nodo', exact: true })).toHaveClass(
    /driver-active-element/,
  );
  await expect(page.getByRole('menuitem', { name: 'Crear nodo', exact: true })).toHaveCSS(
    'transform',
    'none',
  );
  await page.getByRole('menuitem', { name: 'Crear nodo', exact: true }).hover();
  await expect(creator).toHaveCSS('transform', 'none');
  await expect(tourPopover(page)).toHaveCSS('opacity', '1');
  await expect
    .poll(() =>
      creator.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const menu = document.querySelector('[role="menu"]');
        const probed = [button, ...(menu ? [menu, ...menu.querySelectorAll('*')] : [])];
        for (const element of probed)
          (element as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        for (const element of probed)
          (element as HTMLElement).style.removeProperty('pointer-events');
        return button.contains(hit);
      }),
    )
    .toBe(true);
  expect(await receivesPointer(creator)).toBe(false);
  const unrelatedNode = practiceNode(page, 'Conceptos básicos');
  await expect(unrelatedNode).toBeInViewport();
  await expect
    .poll(() =>
      unrelatedNode.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return hit !== null && !node.contains(hit);
      }),
    )
    .toBe(true);
  await expectExitReachable(page, 'creator-menu-open-desktop');
  await page.screenshot({ path: 'test-results/tutorial-creator-centre.png' });
  await tourPopover(page).getByRole('button', { name: 'Anterior' }).click();
  await expectStep(page, 'Nodo bloqueado');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expectExitReachable(page, 'creator-menu-closed-desktop');
  await page.getByRole('link', { name: 'Salir', exact: true }).click();
  await expect(page).toHaveURL(/\/academic-overview$/);
});
