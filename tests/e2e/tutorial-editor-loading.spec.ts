import { expect, test } from './fixtures';
import { expectExitReachable } from './tutorial-exit';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

test('loading the Markdown editor keeps the tutorial canvas and its exit available', async ({
  page,
}) => {
  const editorRequested = deferred();
  const releaseEditor = deferred();
  await page.route('**/_next/static/chunks/*.js', async (route) => {
    const response = await route.fetch();
    if ((await response.text()).includes('Suelta el archivo Markdown aquí')) {
      editorRequested.resolve();
      await releaseEditor.promise;
    }
    await route.fulfill({ response });
  });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/practice-roadmap/teaching');
    const popover = page.locator('.driver-popover');
    await expect(popover.locator('.driver-popover-title')).toHaveText('Muévete por el mapa');
    for (const title of [
      'Centrar mapa',
      'Nodos',
      'Nodo oculto',
      'Nodo bloqueado',
      'Crea un nodo',
    ]) {
      await popover.getByRole('button', { name: 'Siguiente' }).click();
      await expect(popover.locator('.driver-popover-title')).toHaveText(title);
    }
    await page.getByRole('button', { name: 'Crear en el mapa' }).click();
    await page.getByRole('menuitem', { name: 'Crear nodo' }).click();
    await editorRequested.promise;
    await expectExitReachable(page, 'markdown-loading');
    releaseEditor.resolve();
    const dialog = page.getByRole('dialog', { name: 'Crear nodo' });
    await expect(dialog.getByRole('textbox', { name: /^Contenido/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toHaveCount(0);
    await expectExitReachable(page, 'markdown-loaded');
  } finally {
    releaseEditor.resolve();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
