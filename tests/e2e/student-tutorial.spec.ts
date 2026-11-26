import { observeTutorialExit, tutorialExitFailures } from './tutorial-presentation-observer';
import type { Page } from '@playwright/test';
import { literal, queryJson } from './database';
import { enterRoadmap } from './enter-roadmap';
import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

const steps = [
  'Muévete por el mapa',
  'Centrar mapa',
  'Nodos',
  'Nodo completado',
  'Nodo pendiente',
  'Bloqueado por dependencias',
  'Bloqueado por el equipo docente',
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

type PulseRecord = { pulses: number; offsets: Set<string> };

async function recordDependencyPulses(page: Page) {
  await page.evaluate(() => {
    const record: PulseRecord = { pulses: 0, offsets: new Set() };
    Object.assign(window, { dependencyPulses: record });
    new MutationObserver((mutations) => {
      for (const { type, addedNodes, target } of mutations) {
        if (type === 'childList')
          record.pulses += [...addedNodes].filter(
            (node) =>
              node instanceof Element && node.hasAttribute('data-tutorial-dependency-pulse'),
          ).length;
        else if (target instanceof Element && target.hasAttribute('data-tutorial-dependency-pulse'))
          record.offsets.add(target.getAttribute('stroke-dashoffset') ?? '');
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributeFilter: ['stroke-dashoffset'],
    });
  });
  const read = () =>
    page.evaluate(() => {
      const { pulses, offsets } = (window as unknown as { dependencyPulses: PulseRecord })
        .dependencyPulses;
      return { pulses, offsets: offsets.size };
    });
  return {
    pulses: async () => (await read()).pulses,
    offsets: async () => (await read()).offsets,
  };
}

async function completionsOf(userId: string) {
  return queryJson<number>(
    `SELECT count(*)::int FROM "Completion" WHERE "userId" = ${literal(userId)};`,
  );
}

test('a student walks through the tutorial and returns to their Roadmap', async ({
  page,
  course,
}) => {
  const student = course.users.studentWithoutProgress;
  await enterRoadmap(page, course.pagePath(), student.id);

  await page.goto(
    `/practice-roadmap/student?${new URLSearchParams({ origin: course.pagePath() })}`,
  );
  await expect(page.getByRole('button', { name: /^Avisos/ })).toBeVisible();

  await expectStep(page, 0);
  await observeTutorialExit(page);
  await expect(tourPopover(page).getByRole('button', { name: 'Anterior' })).toHaveCount(0);
  await advanceTo(page, 2);
  await expect(practiceNode(page, 'Lectura complementaria')).toHaveClass(/driver-active-element/);
  await expect
    .poll(
      async () => (await practiceNode(page, 'Lectura complementaria').boundingBox())?.width ?? 0,
    )
    .toBeGreaterThan(250);
  await page.screenshot({ path: 'test-results/tutorial-node-zoom.png' });
  const recorded = await recordDependencyPulses(page);
  await advanceTo(page, 5);
  await expect.poll(recorded.pulses).toBe(3);
  await expect.poll(recorded.offsets).toBeGreaterThan(1);
  await expect(page.locator('[data-tutorial-highlight-group]')).toHaveClass(
    /driver-active-element/,
  );
  await page.screenshot({ path: 'test-results/tutorial-control-dependencies.png' });
  await advanceTo(page, 6);
  await expect(page.locator('[data-tutorial-dependency-pulse]')).toHaveCount(0);
  await advanceTo(page, 8);
  const detail = page.locator('#student-node-detail-panel');
  await expect(detail).toHaveClass(/driver-active-element/);
  await expect(detail.getByRole('heading', { name: 'Lectura complementaria' })).toBeVisible();
  await expect(detail.getByText('Guía de estudio', { exact: true })).toBeVisible();
  await expect(detail.getByText('Apunte de lectura', { exact: true })).toBeVisible();
  await tourPopover(page).getByRole('button', { name: 'Anterior' }).click();
  await expectStep(page, 7);
  await expect(page.locator('#student-node-detail-panel')).toHaveCount(0);
  await advanceTo(page, 9);
  await expect(page.getByRole('button', { name: /^Avisos/ })).toHaveClass(/driver-active-element/);

  await tourPopover(page).getByRole('button', { name: 'Finalizar' }).click();
  await expect(tourPopover(page)).toHaveCount(0);
  expect(await tutorialExitFailures(page)).toEqual([]);
  await expect(
    practiceNode(page, 'Conceptos básicos').getByRole('img', { name: 'Pendiente' }),
  ).toBeVisible();
  expect(await completionsOf(student.id)).toBe(0);

  await page.getByRole('link', { name: 'Salir' }).click();
  await expect(page).toHaveURL(new RegExp(`${course.pagePath()}$`));
  await expect(page.getByRole('link', { name: 'Abrir tutorial' })).toHaveCount(0);
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

test('"Salir" leaves in the middle of the tutorial without confirmation', async ({
  page,
  createUser,
}) => {
  const user = await createUser();
  await authenticateAs(page.context(), user.id);
  await page.goto('/practice-roadmap/student?origin=%2Facademic-overview');
  await expectStep(page, 0);
  await advanceTo(page, 2);

  await page.getByRole('link', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/academic-overview$/);
  await expect(page.getByRole('alertdialog', { name: '¿Salir del tutorial?' })).toHaveCount(0);
});
