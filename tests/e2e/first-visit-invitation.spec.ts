import type { Page } from '@playwright/test';
import { literal, sql } from './database';
import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

// Test Users start with the invitation already shown; these specs make it a first visit.
const forgetInvitation = (userId: string) =>
  sql(`UPDATE "User" SET "tutorialInvitationShownAt" = NULL WHERE "id" = ${literal(userId)};`);

const invitation = (page: Page) =>
  page.getByRole('dialog', { name: '¿Cómo deseas realizar el tutorial?' });

test('a first Academic overview visit invites once, also in a fresh browser context', async ({
  page,
  browser,
  createUser,
}) => {
  const user = await createUser();
  await forgetInvitation(user.id);
  await authenticateAs(page.context(), user.id);

  await page.goto('/academic-overview');
  await expect(invitation(page).getByRole('button', { name: 'Docente' })).toBeVisible();
  await expect(invitation(page).getByRole('button', { name: 'Estudiante' })).toBeVisible();
  await invitation(page).getByRole('button', { name: 'Ahora no' }).click();
  await expect(invitation(page)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resumen académico' })).toBeVisible();
  await expect(invitation(page)).toHaveCount(0);

  const fresh = await browser.newContext();
  try {
    await authenticateAs(fresh, user.id);
    const freshPage = await fresh.newPage();
    await freshPage.goto('/academic-overview');
    await expect(freshPage.getByRole('heading', { name: 'Resumen académico' })).toBeVisible();
    await expect(invitation(freshPage)).toHaveCount(0);
  } finally {
    await fresh.close();
  }
});

test('accepting the invitation starts the tutorial and it is not shown on return', async ({
  page,
  createUser,
}) => {
  const user = await createUser();
  await forgetInvitation(user.id);
  await authenticateAs(page.context(), user.id);

  await page.goto('/academic-overview');
  await invitation(page).getByRole('button', { name: 'Estudiante' }).click();
  await expect(page).toHaveURL(/\/practice-roadmap\/student\?origin=%2Facademic-overview$/);

  await page.goto('/academic-overview');
  await expect(page.getByRole('heading', { name: 'Resumen académico' })).toBeVisible();
  await expect(invitation(page)).toHaveCount(0);
});

test('dismissing the invitation also records it', async ({ page, createUser }) => {
  const user = await createUser();
  await forgetInvitation(user.id);
  await authenticateAs(page.context(), user.id);

  await page.goto('/academic-overview');
  await expect(invitation(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(invitation(page)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resumen académico' })).toBeVisible();
  await expect(invitation(page)).toHaveCount(0);
});

test('opening a tutorial from a Roadmap canvas first prevents the invitation', async ({
  page,
  course,
}) => {
  const teacher = course.users.teacher;
  await forgetInvitation(teacher.id);
  await authenticateAs(page.context(), teacher.id);

  await page.goto(course.pagePath());
  await page.getByRole('button', { name: 'Vista estudiante' }).click();
  await expect(page.getByText('Previsualización del canvas')).toBeVisible();
  await expect(invitation(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Ir al editor' }).click();
  await expect(invitation(page)).toHaveCount(0);

  await page.getByRole('link', { name: 'Abrir tutorial' }).click();
  await expect(page).toHaveURL(/\/practice-roadmap\/teaching\?origin=/);

  await page.goto('/academic-overview');
  await expect(page.getByRole('heading', { name: 'Resumen académico' })).toBeVisible();
  await expect(invitation(page)).toHaveCount(0);
});
