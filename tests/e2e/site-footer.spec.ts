import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

test('site pages share one footer with provenance, credit, version and the repository', async ({
  page,
  course,
}) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('© 2026 Universidad de Chile');
  await expect(footer).toContainText('Creado por Daniel Ramírez López');
  await expect(footer).toContainText('v1.0.0');
  await expect(footer.getByRole('link', { name: /^Repositorio en GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/Bigelazo/u-roadmaps',
  );

  await authenticateAs(page.context(), course.users.teacher.id);
  for (const path of ['/academic-overview', `${course.pagePath()}/participants`]) {
    await page.goto(path);
    await expect(page.getByRole('contentinfo')).toContainText('© 2026 Universidad de Chile');
  }
});

test('the roadmap canvas has no footer', async ({ page, course }) => {
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
});
