import type { Page } from '@playwright/test';
import { queryJson } from './database';
import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

const titles = {
  a: 'Introducción',
  b: 'Conceptos básicos',
  c: 'Lectura complementaria',
  d: 'Ejercicios guiados',
  e: 'Control 1',
  f: 'Proyecto final',
  g: 'Retroalimentación del control',
  h: 'Material de apoyo',
};

function practiceNode(page: Page, title: string) {
  return page.locator('.react-flow__node').filter({ hasText: title });
}

/** Whether an Academic term's Roadmap freeze date has not passed (synthetic terms included). */
async function isOpenAcademicTerm(label: string) {
  const [season, year] = label.split(' ');
  const semester = season === 'Otoño' ? 1 : 2;
  return queryJson<boolean>(`
    SELECT to_json(EXISTS (
      SELECT 1 FROM "AcademicTerm"
      WHERE year = ${Number(year)} AND semester = ${semester}
        AND "roadmapFreezeDate" >= (now() AT TIME ZONE 'America/Santiago')::date
    ) OR NOT EXISTS (
      SELECT 1 FROM "AcademicTerm"
      WHERE "roadmapFreezeDate" >= (now() AT TIME ZONE 'America/Santiago')::date
    ));
  `);
}

async function rowsOwnedBy(userId: string) {
  return queryJson<number>(`
    SELECT (
      (SELECT count(*) FROM "Participation" WHERE "userId" = '${userId}') +
      (SELECT count(*) FROM "Completion" WHERE "userId" = '${userId}') +
      (SELECT count(*) FROM "RoadmapNotice" WHERE "recipientId" = '${userId}')
    )::int;
  `);
}

async function openPractice(page: Page, experience: 'student' | 'teaching', origin?: string) {
  const query = origin === undefined ? '' : `?${new URLSearchParams({ origin })}`;
  await page.goto(`/practice-roadmap/${experience}${query}`);
  await expect(page.locator('.react-flow')).toBeVisible();
  await expect(practiceNode(page, titles.a)).toBeVisible();
}

test('a User without Participations sees the simulated student progress', async ({
  page,
  createUser,
}) => {
  const user = await createUser();
  await authenticateAs(page.context(), user.id);
  await openPractice(page, 'student');

  const header = page.locator('header').filter({ hasText: 'AA0000' });
  await expect(header.getByRole('heading', { name: 'Tutorial' })).toBeVisible();
  const termLabel = header.getByText(/^(Otoño|Primavera) \d{4}$/);
  await expect(termLabel).toBeVisible();
  expect(await isOpenAcademicTerm(await termLabel.innerText())).toBe(true);

  await expect(practiceNode(page, titles.a).getByRole('img', { name: 'Completado' })).toBeVisible();
  for (const title of [titles.b, titles.c])
    await expect(practiceNode(page, title).getByRole('img', { name: 'Pendiente' })).toBeVisible();
  await expect(
    practiceNode(page, titles.c).getByRole('img', { name: '1 cambio sin revisar' }),
  ).toBeVisible();
  for (const title of [titles.d, titles.e, titles.g])
    await expect(practiceNode(page, title).getByTestId('roadmap-card')).toHaveAttribute(
      'data-block-reason',
      'PREREQUISITE_BLOCK',
    );
  await expect(practiceNode(page, titles.f).getByTestId('roadmap-card')).toHaveAttribute(
    'data-block-reason',
    'TEACHER_BLOCK',
  );
  await expect(practiceNode(page, titles.h)).toHaveCount(0);

  await practiceNode(page, titles.b).click();
  await page.getByRole('button', { name: 'Completar' }).click();
  await expect(practiceNode(page, titles.b).getByRole('img', { name: 'Completado' })).toBeVisible();
  await expect(practiceNode(page, titles.d).getByRole('img', { name: 'Pendiente' })).toBeVisible();

  await openPractice(page, 'student');
  await expect(practiceNode(page, titles.b).getByRole('img', { name: 'Pendiente' })).toBeVisible();
  await expect(practiceNode(page, titles.d).getByTestId('roadmap-card')).toHaveAttribute(
    'data-block-reason',
    'PREREQUISITE_BLOCK',
  );
  expect(await rowsOwnedBy(user.id)).toBe(0);
});

test('canvas actions in the teaching experience take effect and reset on reopening', async ({
  page,
  createUser,
}) => {
  const user = await createUser();
  await authenticateAs(page.context(), user.id);
  await openPractice(page, 'teaching');
  await expect(page.locator('header').filter({ hasText: 'AA0000' })).toContainText('Tutorial');
  await expect(page.getByRole('link', { name: 'Historial de versiones' })).toHaveCount(0);
  await expect(page.getByLabel(`${titles.h}: oculto para estudiantes`)).toBeVisible();

  // Create
  await page.getByRole('button', { name: 'Crear en el mapa' }).click();
  await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Agregar al mapa' });
  await createDialog.getByLabel('Título').fill('Nodo de práctica');
  await createDialog.getByRole('button', { name: 'Agregar nodo' }).click();
  await expect(practiceNode(page, 'Nodo de práctica')).toBeVisible();

  // Connect
  const edges = page.locator('.react-flow__edge');
  await expect(edges).toHaveCount(8);
  await practiceNode(page, 'Nodo de práctica').click();
  await page.keyboard.press('Escape');
  await connect(page, titles.g, 'Nodo de práctica');
  await expect(edges).toHaveCount(9);

  // Block
  await nodeAction(page, titles.b, 'Bloquear rama');
  await page
    .getByRole('alertdialog', { name: 'Confirmar bloqueo de rama' })
    .getByRole('button', { name: 'Bloquear rama' })
    .click();
  await expectNodeAction(page, titles.b, 'Desbloquear');

  // Hide, which removes the Node's Dependencies
  await nodeAction(page, titles.g, 'Ocultar para estudiantes');
  await page
    .getByRole('alertdialog', { name: 'Confirmar ocultación' })
    .getByRole('button', { name: 'Ocultar' })
    .click();
  await expect(page.getByLabel(`${titles.g}: oculto para estudiantes`)).toBeVisible();
  await expect(edges).toHaveCount(7);

  // Add a Resource
  await nodeAction(page, titles.a, 'Agregar recurso');
  const composer = page.getByRole('form', { name: 'Editor de recurso' });
  await composer.getByRole('tab', { name: 'Enlace' }).click();
  await composer.getByLabel('Título').fill('Guía de práctica');
  await composer.getByLabel('Enlace', { exact: true }).fill('https://example.test/guia');
  await composer.getByRole('button', { name: 'Agregar enlace' }).click();
  await expect(practiceNode(page, titles.a).getByRole('img', { name: '1 enlace' })).toBeVisible();

  // Delete
  await page.keyboard.press('Escape');
  await nodeAction(page, titles.d, 'Eliminar nodo');
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Eliminar', exact: true })
    .click();
  await expect(practiceNode(page, titles.d)).toHaveCount(0);

  await openPractice(page, 'teaching');
  await expect(practiceNode(page, 'Nodo de práctica')).toHaveCount(0);
  await expect(practiceNode(page, titles.d)).toBeVisible();
  await expectNodeAction(page, titles.b, 'Bloquear rama');
  expect(await rowsOwnedBy(user.id)).toBe(0);
});

async function nodeAction(page: Page, title: string, action: string) {
  const node = practiceNode(page, title);
  await node.getByRole('button', { name: 'Menú de acciones del nodo' }).click();
  await node.getByRole('button', { name: action }).click();
}

async function expectNodeAction(page: Page, title: string, action: string) {
  const node = practiceNode(page, title);
  await node.getByRole('button', { name: 'Menú de acciones del nodo' }).click();
  await expect(node.getByRole('button', { name: action, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
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

test('"Salir" returns to an allow-listed origin or to the home page', async ({
  page,
  createUser,
}) => {
  const user = await createUser();
  await authenticateAs(page.context(), user.id);

  for (const [origin, href] of [
    ['/academic-overview', '/academic-overview'],
    ['/courses/CC1002/2026/2', '/courses/CC1002/2026/2'],
    ['https://example.test/phishing', '/'],
    ['//example.test', '/'],
    ['/courses/CC1002/2026/2/../../../api', '/'],
    ['/api/plogin/start', '/'],
    [undefined, '/'],
  ] as const) {
    await openPractice(page, 'student', origin);
    await expect(page.getByRole('link', { name: 'Salir' })).toHaveAttribute('href', href);
  }

  await openPractice(page, 'teaching', '/academic-overview');
  await page.getByRole('link', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/academic-overview$/);
});
