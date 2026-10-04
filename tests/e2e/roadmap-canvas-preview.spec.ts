import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';

test('a teacher previews, completes, resets, and exits the persistent student canvas', async ({
  page,
  course,
  apiAs,
}) => {
  const api = await apiAs(course.users.teacher);

  expect((await api.delete(course.apiPath('/simulation'))).status()).toBe(200);
  const simulation = await (await api.get(course.apiPath('/simulation'))).json();
  const node = simulation.nodes.find(
    (candidate: { access: { status: string }; canComplete?: boolean }) =>
      candidate.access.status === 'ACCESSIBLE' && candidate.canComplete,
  ) as { id: string };
  expect(node).toBeDefined();

  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.getByRole('button', { name: 'Vista estudiante' }).click();

  await expect(page.getByText('Previsualización del canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear en el mapa' })).toHaveCount(0);
  await page.locator(`.react-flow__node[data-id="${node.id}"]`).click();
  await page.getByRole('button', { name: 'Completar' }).click();
  await expect
    .poll(async () => {
      const updated = await (await api.get(course.apiPath('/simulation'))).json();
      return updated.nodes.find((candidate: { id: string }) => candidate.id === node.id)
        ?.isCompleted;
    })
    .toBe(true);

  await page.getByRole('button', { name: 'Reiniciar progreso' }).click();
  await page
    .getByRole('alertdialog', { name: 'Reiniciar progreso de previsualización' })
    .getByRole('button', { name: 'Reiniciar progreso' })
    .click();
  await expect
    .poll(async () => {
      const updated = await (await api.get(course.apiPath('/simulation'))).json();
      return updated.nodes.find((candidate: { id: string }) => candidate.id === node.id)
        ?.isCompleted;
    })
    .toBe(false);

  await page.getByRole('button', { name: 'Ir al editor' }).click();
  await expect(page.getByRole('button', { name: 'Vista estudiante' })).toBeFocused();
});
