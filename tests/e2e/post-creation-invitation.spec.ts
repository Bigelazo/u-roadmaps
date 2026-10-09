import type { Page } from '@playwright/test';
import { expect, test, type E2ECourseOffering } from './fixtures';
import { authenticateAs } from './helpers';

const invitationName = '¡Roadmap creado!';

async function createEmptyRoadmap(page: Page, offering: E2ECourseOffering) {
  await page.goto('/academic-overview');
  await page
    .getByRole('button', { name: `Crear roadmap de ${offering.courseName}` })
    .filter({ visible: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: `Crear roadmap de ${offering.courseName}` });
  await dialog.getByRole('button', { name: 'Crear roadmap' }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/courses/${offering.courseCode}/${offering.year}/${offering.semester}\\?created=1$`,
    ),
  );
}

function offeringPath(offering: E2ECourseOffering) {
  return `/courses/${offering.courseCode}/${offering.year}/${offering.semester}`;
}

test('the first Roadmap creation invites to do the teaching tutorial, and no later one does', async ({
  createCourse,
  createUser,
  page,
}) => {
  const professor = await createUser();
  const first = await createCourse({
    roadmap: false,
    participants: [{ user: professor, role: 'TEACHER' }],
  });
  const second = await createCourse({
    roadmap: false,
    participants: [{ user: professor, role: 'TEACHER' }],
  });
  await authenticateAs(page.context(), professor.id);

  await createEmptyRoadmap(page, first);
  const invitation = page.getByRole('alertdialog', { name: invitationName });
  await expect(invitation).toContainText('¿Quieres hacer el tutorial');
  await invitation.getByRole('button', { name: 'Ahora no' }).click();
  await expect(invitation).toBeHidden();

  await page.reload();
  await expect(page.getByRole('link', { name: 'Abrir tutorial' })).toBeVisible();
  await expect(invitation).toHaveCount(0);

  await createEmptyRoadmap(page, second);
  await expect(page.getByRole('link', { name: 'Abrir tutorial' })).toBeVisible();
  await expect(page.getByRole('alertdialog', { name: invitationName })).toHaveCount(0);
});

test('accepting opens the teaching tutorial and "Salir" returns to the new Roadmap', async ({
  createCourse,
  createUser,
  page,
}) => {
  const professor = await createUser();
  const offering = await createCourse({
    roadmap: false,
    participants: [{ user: professor, role: 'TEACHER' }],
  });
  await authenticateAs(page.context(), professor.id);

  await createEmptyRoadmap(page, offering);
  await page
    .getByRole('alertdialog', { name: invitationName })
    .getByRole('button', { name: 'Hacer tutorial' })
    .click();
  await expect(page).toHaveURL(/\/practice-roadmap\/teaching\?origin=/);
  await expect(page.locator('.driver-popover-title')).toHaveText('Centrar mapa');

  await page.getByRole('link', { name: 'Salir' }).click();
  await expect(page).toHaveURL(new RegExp(`${offeringPath(offering)}$`));
  await expect(page.locator('.driver-popover')).toContainText('repetir el tutorial');
  await expect(page.getByRole('link', { name: 'Abrir tutorial' })).toHaveClass(
    /driver-active-element/,
  );
});

test('a professor who opened the teaching tutorial before is invited to repeat it', async ({
  createCourse,
  createUser,
  page,
}) => {
  const professor = await createUser();
  const offering = await createCourse({
    roadmap: false,
    participants: [{ user: professor, role: 'TEACHER' }],
  });
  await authenticateAs(page.context(), professor.id);
  await page.goto(`/practice-roadmap/teaching?${new URLSearchParams({ origin: '/' })}`);
  await expect(page.locator('.driver-popover-title')).toHaveText('Centrar mapa');

  await createEmptyRoadmap(page, offering);
  await expect(page.getByRole('alertdialog', { name: invitationName })).toContainText(
    '¿Quieres repetir el tutorial',
  );
});
