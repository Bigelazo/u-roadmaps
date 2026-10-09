import type { Page } from '@playwright/test';
import { queryJson } from './database';
import { enterRoadmap } from './enter-roadmap';
import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

const steps = [
  'Muévete por el mapa',
  'Centrar mapa',
  'Tipo de nodo y recursos',
  'Nodo completado',
  'Nodo pendiente',
  'Bloqueado por prerrequisitos',
  'Bloqueado por el equipo docente',
  'Dependencias',
  'Cambios sin revisar',
  'Detalle del nodo',
  'Avisos y resumen de cambios',
];

function tourPopover(page: Page) {
  return page.locator('.driver-popover');
}

function practiceNode(page: Page, title: string) {
  return page.locator('.react-flow__node').filter({ hasText: title });
}

async function expectStep(page: Page, index: number) {
  const popover = tourPopover(page);
  await expect(popover.locator('.driver-popover-title')).toHaveText(steps[index]);
  await expect(popover.locator('.driver-popover-progress-text')).toHaveText(
    `${index + 1} de ${steps.length}`,
  );
}

/** Advances with "Siguiente", checking every step shown on the way. */
async function advanceTo(page: Page, index: number) {
  let current = Number(
    (await tourPopover(page).locator('.driver-popover-progress-text').innerText()).split(' ')[0],
  );
  while (current <= index) {
    await tourPopover(page).getByRole('button', { name: 'Siguiente' }).click();
    await expectStep(page, current);
    current += 1;
  }
}

async function completionsOf(userId: string) {
  return queryJson<number>(`SELECT count(*)::int FROM "Completion" WHERE "userId" = '${userId}';`);
}

test('a student walks through the tutorial from their Roadmap and is pointed back to it', async ({
  page,
  course,
}) => {
  const student = course.users.studentWithoutProgress;
  await enterRoadmap(page, course.pagePath(), student.id);

  await page.getByRole('link', { name: 'Abrir tutorial' }).click();
  await expect(page).toHaveURL(/\/practice-roadmap\/student\?origin=/);
  await expect(page.getByRole('button', { name: /^Avisos/ })).toBeVisible();

  await expectStep(page, 0);
  await expect(tourPopover(page).getByRole('button', { name: 'Anterior' })).toBeDisabled();
  await advanceTo(page, 2);
  await expect(practiceNode(page, 'Lectura complementaria')).toHaveClass(/driver-active-element/);
  await advanceTo(page, 9);
  const detail = page.locator('#student-node-detail-panel');
  await expect(detail).toHaveClass(/driver-active-element/);
  await expect(detail.getByRole('heading', { name: 'Conceptos básicos' })).toBeVisible();
  await expect(tourPopover(page)).toContainText('no se puede deshacer');
  await tourPopover(page).getByRole('button', { name: 'Anterior' }).click();
  await expectStep(page, 8);
  await expect(page.locator('#student-node-detail-panel')).toHaveCount(0);
  await advanceTo(page, 10);
  await expect(page.getByRole('button', { name: /^Avisos/ })).toHaveClass(/driver-active-element/);

  await tourPopover(page).getByRole('button', { name: 'Finalizar' }).click();
  await expect(tourPopover(page)).toHaveCount(0);
  await expect(
    practiceNode(page, 'Conceptos básicos').getByRole('img', { name: 'Pendiente' }),
  ).toBeVisible();
  expect(await completionsOf(student.id)).toBe(0);

  await page.getByRole('link', { name: 'Salir' }).click();
  await expect(page).toHaveURL(new RegExp(`${course.pagePath()}$`));
  await expect(tourPopover(page)).toContainText('repetir el tutorial');
  await expect(page.getByRole('link', { name: 'Abrir tutorial' })).toHaveClass(
    /driver-active-element/,
  );
});

test('leaving the tutorial asks for confirmation first', async ({ page, createUser }) => {
  const user = await createUser();
  await authenticateAs(page.context(), user.id);
  await page.goto('/practice-roadmap/student?origin=%2Facademic-overview');
  await expectStep(page, 0);

  await page.keyboard.press('ArrowRight');
  await expectStep(page, 1);
  await tourPopover(page).getByRole('button', { name: 'Siguiente' }).click();
  await expectStep(page, 2);

  await page.keyboard.press('Escape');
  const confirmation = page.getByRole('alertdialog', { name: '¿Salir del tutorial?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Seguir con el tutorial' }).click();
  await expect(confirmation).toHaveCount(0);
  await expectStep(page, 2);

  await page.mouse.click(8, page.viewportSize()!.height - 8);
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Seguir con el tutorial' }).click();
  await expectStep(page, 2);

  await tourPopover(page)
    .getByRole('button', { name: /cerrar/i })
    .click();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Salir' }).click();
  await expect(tourPopover(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/practice-roadmap\/student/);
  await expect(practiceNode(page, 'Introducción')).toBeVisible();
});
