import { expect, request as apiRequest, test } from '@playwright/test';
import { authenticateAs, fixture, roadmapPath, sessionCookie } from './helpers';

test('a teacher previews, completes, resets, and exits the persistent student canvas', async (
  { page },
  testInfo,
) => {
  const api = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.daniela) },
  });

  try {
    expect((await api.delete(roadmapPath('/simulation'))).status()).toBe(200);
    const simulation = await (await api.get(roadmapPath('/simulation'))).json();
    const node = simulation.nodes.find(
      (candidate: { access: { status: string }; canComplete?: boolean }) =>
        candidate.access.status === 'ACCESSIBLE' && candidate.canComplete,
    ) as { id: string };
    expect(node).toBeDefined();

    await authenticateAs(page.context(), fixture.daniela);
    await page.goto('/courses/CC1002/2026/2');
    await page.getByRole('button', { name: 'Previsualizar canvas' }).click();

    await expect(page.getByText('Previsualización del canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear en el mapa' })).toHaveCount(0);
    await page.locator(`.react-flow__node[data-id="${node.id}"]`).click({ force: true });
    await page.getByRole('button', { name: 'Completar' }).click();
    await expect.poll(async () => {
      const updated = await (await api.get(roadmapPath('/simulation'))).json();
      return updated.nodes.find((candidate: { id: string }) => candidate.id === node.id)?.isCompleted;
    }).toBe(true);

    await page.getByRole('button', { name: 'Reiniciar progreso' }).click();
    await page
      .getByRole('alertdialog', { name: 'Reiniciar progreso de previsualización' })
      .getByRole('button', { name: 'Reiniciar progreso' })
      .click();
    await expect.poll(async () => {
      const updated = await (await api.get(roadmapPath('/simulation'))).json();
      return updated.nodes.find((candidate: { id: string }) => candidate.id === node.id)?.isCompleted;
    }).toBe(false);

    await page.getByRole('button', { name: 'Ir al editor' }).click();
    await expect(page.getByRole('button', { name: 'Previsualizar canvas' })).toBeFocused();
  } finally {
    await api.delete(roadmapPath('/simulation'));
    await api.dispose();
  }
});
