import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';
import { expectExitReachable, leavePractice } from './tutorial-exit';

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
]) {
  test.describe(`tutorial exit at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test('teaching staff can leave after dependencies, editing and releasing nodes', async ({
      page,
      createUser,
    }) => {
      test.setTimeout(60_000);
      const user = await createUser();
      await authenticateAs(page.context(), user.id);
      await page.goto('/practice-roadmap/teaching?origin=%2Facademic-overview');
      const popover = page.locator('.driver-popover');
      const heading = popover.locator('.driver-popover-title');
      const node = (title: string) => page.locator('.react-flow__node').filter({ hasText: title });
      const next = async (title: string) => {
        await popover.getByRole('button', { name: 'Siguiente' }).tap();
        await expect(heading).toHaveText(title);
      };
      const action = async (title: string, label: string) => {
        await node(title).getByRole('button', { name: 'Abrir menú de acciones del nodo' }).tap();
        await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).tap();
      };
      await expect(heading).toHaveText('Centrar roadmap');
      for (const title of ['Nodos', 'Nodo oculto', 'Nodo bloqueado', 'Crea un nodo']) {
        await next(title);
      }
      await expectExitReachable(page, `creator-${viewport.width}`);
      const creatorButton = page.getByRole('button', { name: 'Crear en el mapa' });
      await creatorButton.tap();
      await expect(page.getByRole('menuitem', { name: 'Crear nodo', exact: true })).toHaveClass(
        /driver-active-element/,
      );
      await expect(popover).toHaveCSS('opacity', '1');
      await expect(creatorButton).toHaveCSS('transform', 'none');
      await expectExitReachable(page, `creator-menu-open-${viewport.width}`);
      await page.screenshot({ path: `test-results/tutorial-creator-centre-${viewport.width}.png` });
      await creatorButton.tap();
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expectExitReachable(page, `creator-menu-closed-${viewport.width}`);
      await creatorButton.tap();
      await page.getByRole('menuitem', { name: 'Crear nodo' }).tap();
      const creator = page.getByRole('dialog', { name: 'Agregar al mapa' });
      await creator.getByLabel('Título').fill('Mi nodo de práctica');
      await creator.getByLabel('Tipo').tap();
      await page.getByRole('option', { name: 'Evaluación', exact: true }).tap();
      await creator.getByRole('button', { name: 'Agregar nodo' }).tap();
      await expect(heading).toHaveText('Tipos de nodo');
      await next('Conecta tu nodo');
      const client = await page.context().newCDPSession(page);
      const sourceBounds = await node('Mi nodo de práctica').locator('p').boundingBox();
      expect(sourceBounds).not.toBeNull();
      const source = sourceBounds!;
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: source.x + source.width / 2, y: source.y + source.height / 2 }],
      });
      await expect(
        page.getByText('Modo flecha: toca un nodo de destino', { exact: true }),
      ).toBeVisible();
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await node('Control 1').locator('p').tap();
      await expect(heading).toHaveText('Dependencias');
      await expectExitReachable(page, `dependencies-${viewport.width}`);
      await next('Selecciona tu nodo');
      await node('Mi nodo de práctica').locator('p').tap();
      await expect(heading).toHaveText('Editor de nodo');
      await expectExitReachable(page, `editor-${viewport.width}`);
      await popover.getByRole('button', { name: 'Cerrar tutorial' }).tap();
      const exitConfirmation = page.getByRole('alertdialog', { name: '¿Salir del tutorial?' });
      await expect(exitConfirmation).toBeVisible();
      await exitConfirmation.getByRole('button', { name: 'Seguir con el tutorial' }).tap();
      await expect(heading).toHaveText('Editor de nodo');
      await next('Bloquea un nodo');
      await popover.getByRole('button', { name: 'Anterior' }).tap();
      await expect(heading).toHaveText('Editor de nodo');
      const editor = page.locator('[aria-label="Editor de nodo"]');
      await expect(editor).toBeVisible();
      await expect(node('Mi nodo de práctica')).toHaveClass(/selected/);
      await expect(editor.getByLabel('Título', { exact: true })).toHaveValue('Mi nodo de práctica');
      await expect(page.locator('#roadmap-editor-panel [data-slot="sidebar-content"]')).toHaveClass(
        /driver-active-element/,
      );
      await page.screenshot({ path: `test-results/tutorial-editor-back-${viewport.width}.png` });
      await next('Bloquea un nodo');
      await action('Conceptos básicos', 'Bloquear nodo');
      await page.getByRole('alertdialog').getByRole('button', { name: 'Bloquear nodo' }).tap();
      await expect(heading).toHaveText('Bloqueo propagado');
      await next('Desbloquea el nodo');
      await action('Conceptos básicos', 'Desbloquear');
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Incluir dependientes' })
        .tap();
      await expect(heading).toHaveText('Desbloqueo programado');
      await next('Oculta un nodo');
      await action('Retroalimentación del control', 'Ocultar para estudiantes');
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Ocultar', exact: true })
        .tap();
      await expect(heading).toHaveText('Agregar recursos');
      await next('Elimina tu nodo');
      await action('Mi nodo de práctica', 'Eliminar nodo');
      await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar nodo' }).tap();
      await expect(heading).toHaveText('Vista estudiante');
      await page.getByRole('button', { name: 'Vista estudiante', exact: true }).tap();
      await expect(heading).toHaveText('Completa un nodo');
      await node('Introducción').locator('p').tap();
      await page.getByRole('button', { name: 'Completar', exact: true }).tap();
      await expect(heading).toHaveText('Nodos liberados');
      await expectExitReachable(page, `released-${viewport.width}`);
      await leavePractice(page);
      await expect(page).toHaveURL(/\/academic-overview$/);
    });

    for (const title of ['Detalle del nodo', 'Avisos y resumen de cambios']) {
      test(`students can leave during ${title}`, async ({ page, createUser }) => {
        const user = await createUser();
        await authenticateAs(page.context(), user.id);
        await page.goto('/practice-roadmap/student?origin=%2Facademic-overview');
        const popover = page.locator('.driver-popover');
        const heading = popover.locator('.driver-popover-title');
        await expect(heading).toHaveText('Muévete por el mapa');
        const steps = [
          'Centrar mapa',
          'Nodos',
          'Nodo completado',
          'Nodo pendiente',
          'Bloqueado por prerrequisitos',
          'Bloqueado por el equipo docente',
          'Dependencias',
          'Cambios sin revisar',
          'Detalle del nodo',
          'Avisos y resumen de cambios',
        ];
        for (const step of steps.slice(0, steps.indexOf(title) + 1)) {
          await popover.getByRole('button', { name: 'Siguiente' }).tap();
          await expect(heading).toHaveText(step);
        }
        await expectExitReachable(page, `${title}-${viewport.width}`);
        await leavePractice(page);
        await expect(page).toHaveURL(/\/academic-overview$/);
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
      });
    }
  });
}

test.describe('landscape tutorial exit', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('teaching staff can leave the node creation step', async ({ page, createUser }) => {
    const user = await createUser();
    await authenticateAs(page.context(), user.id);
    await page.goto('/practice-roadmap/teaching?origin=%2Facademic-overview');
    const popover = page.locator('.driver-popover');
    await expect(popover.locator('.driver-popover-title')).toHaveText('Centrar roadmap');
    for (const title of ['Nodos', 'Nodo oculto', 'Nodo bloqueado', 'Crea un nodo']) {
      await popover.getByRole('button', { name: 'Siguiente' }).tap();
      await expect(popover.locator('.driver-popover-title')).toHaveText(title);
    }
    await expectExitReachable(page, 'creator-landscape');
    await leavePractice(page);
    await expect(page).toHaveURL(/\/academic-overview$/);
  });
});
