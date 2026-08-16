import { expect, test, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const courseUrl = '/courses/E2E101/2026/1';
const users = {
  teacher: '90000000-0000-4000-8000-000000000001',
  student: '90000000-0000-4000-8000-000000000002',
};

async function authenticateAs(page: Page, userId: string) {
  const value = await encode({ token: { sub: userId }, secret: 'e2e-nextauth-secret' });
  await page
    .context()
    .addCookies([{ name: 'next-auth.session-token', value, domain: 'localhost', path: '/' }]);
}

test('public entry and institutional sign-in expose the expected navigation', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Entiende el camino antes de recorrerlo.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ingresar con U-Pasaporte' }).click();
  await expect(page.getByRole('heading', { name: 'Acceso institucional' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Autenticarse con U-Pasaporte / VTI' }),
  ).toBeVisible();
});

test('teacher can add a roadmap node from the editor', async ({ page }) => {
  await authenticateAs(page, users.teacher);
  await page.goto(courseUrl);
  await expect(page.getByRole('heading', { name: 'Curso E2E' })).toBeVisible();
  await page.getByLabel('Título del nodo').fill('Nodo creado desde E2E');
  await page.getByRole('button', { name: 'Agregar nodo' }).click();
  await expect(page.getByText('Nodo creado desde E2E')).toBeVisible();
});

test('student completes visible prerequisites and accesses their resource', async ({ page }) => {
  await authenticateAs(page, users.student);
  await page.goto('/academic-overview');
  await expect(page.getByRole('heading', { name: 'Hola, Estudiante E2E' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir roadmap' }).click();
  await page.getByText('Fundamentos').click();
  await expect(page.locator('a', { hasText: 'Guía de fundamentos' })).toHaveAttribute(
    'href',
    'https://example.test/fundamentos',
  );
  await page.getByRole('button', { name: 'Completar' }).click();
  await expect(page.getByRole('button', { name: 'Completado', exact: true })).toBeDisabled();
  await page.getByLabel('Cerrar detalle').click();
  await page.getByText('Aplicación').click();
  await expect(page.getByRole('button', { name: 'Completar' })).toBeEnabled();
});
