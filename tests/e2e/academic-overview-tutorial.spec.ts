import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

const choices = [
  { option: 'Docente', experience: 'teaching' },
  { option: 'Estudiante', experience: 'student' },
] as const;

for (const { option, experience } of choices) {
  test(`a User without Roadmaps starts the ${experience} tutorial from the Academic overview and returns to it`, async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await authenticateAs(page.context(), user.id);
    await page.goto('/academic-overview');

    // A question-mark icon, not a text button.
    const icon = page.getByRole('button', { name: 'Abrir tutorial' });
    await expect(icon).toBeVisible();
    await expect(icon).toHaveText('');
    await expect(
      icon.locator('svg.lucide-circle-question-mark, svg.lucide-circle-help'),
    ).toHaveCount(1);
    await icon.click();

    const choice = page.getByRole('dialog', { name: '¿Cómo deseas realizar el tutorial?' });
    await expect(choice.getByRole('button', { name: 'Docente' })).toBeVisible();
    await expect(choice.getByRole('button', { name: 'Estudiante' })).toBeVisible();
    await choice.getByRole('button', { name: option }).click();

    await expect(page).toHaveURL(
      new RegExp(`/practice-roadmap/${experience}\\?origin=%2Facademic-overview$`),
    );
    await expect(page.locator('.driver-popover')).toBeVisible();
    await page.keyboard.press('Escape');
    await page
      .getByRole('alertdialog', { name: '¿Salir del tutorial?' })
      .getByRole('button', { name: 'Salir' })
      .click();
    await expect(page.locator('.driver-popover')).toHaveCount(0);

    await page.getByRole('link', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/academic-overview$/);
    await expect(page.locator('.driver-popover')).toContainText('repetir el tutorial');
    await expect(page.getByRole('button', { name: 'Abrir tutorial' })).toHaveClass(
      /driver-active-element/,
    );
  });
}
