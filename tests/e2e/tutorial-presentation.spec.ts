import { expect, test } from './fixtures';

for (const width of [1280, 390]) {
  test(`tutorial presentation remains steady at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/practice-roadmap/student');
    const popover = page.locator('.driver-popover');
    const title = popover.locator('.driver-popover-title');
    await expect(title).toHaveText('Muévete por el mapa');
    for (const step of ['Centrar mapa', 'Nodos', 'Nodo completado', 'Nodo pendiente']) {
      await popover.getByRole('button', { name: 'Siguiente' }).click();
      await expect(title).toHaveText(step);
    }
    const observations = page.evaluate(async () => {
      const positions: { x: number; y: number }[] = [];
      const exitFailures: string[] = [];
      const start = performance.now();
      while (performance.now() - start < 2000) {
        const exit = document.querySelector<HTMLElement>('[data-tutorial-exit]')!;
        const style = getComputedStyle(exit);
        const rect = exit.getBoundingClientRect();
        if (style.visibility !== 'visible' || Number(style.opacity) < 1)
          exitFailures.push(`${style.visibility}:${style.opacity}`);
        if (
          !exit.contains(
            document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
          )
        )
          exitFailures.push('covered');
        const popover = document.querySelector<HTMLElement>('.driver-popover');
        if (
          popover?.querySelector('.driver-popover-title')?.textContent ===
            'Bloqueado por dependencias' &&
          Number(getComputedStyle(popover).opacity) > 0.05
        ) {
          const bounds = popover.getBoundingClientRect();
          positions.push({ x: bounds.x, y: bounds.y });
        }
        await new Promise(requestAnimationFrame);
      }
      return { positions, exitFailures };
    });
    await popover.getByRole('button', { name: 'Siguiente' }).click();
    const result = await observations;
    expect(result.positions.length).toBeGreaterThan(10);
    expect
      .soft(
        Math.max(...result.positions.map(({ x }) => x)) -
          Math.min(...result.positions.map(({ x }) => x)),
      )
      .toBeLessThanOrEqual(1);
    expect
      .soft(
        Math.max(...result.positions.map(({ y }) => y)) -
          Math.min(...result.positions.map(({ y }) => y)),
      )
      .toBeLessThanOrEqual(1);
    expect.soft(result.exitFailures).toEqual([]);
    await expect.soft(page.locator('[data-tutorial-dependency-pulse]')).toHaveCount(0);
    await page.screenshot({ path: `test-results/tutorial-steady-${width}.png` });
  });
}

for (const width of [1280, 390]) {
  test(`teaching creation controls stay reachable throughout menu transitions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/practice-roadmap/teaching');
    const popover = page.locator('.driver-popover');
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
    await expect(popover).toHaveCSS('opacity', '1');
    const creator = page.getByRole('button', { name: 'Crear en el mapa' });
    const beforeHover = await popover.boundingBox();
    await creator.hover();
    await expect(
      page
        .locator('[data-slot="tooltip-content"][data-open]')
        .filter({ hasText: 'Crear en el mapa' }),
    ).toBeVisible();
    expect(await popover.boundingBox()).toEqual(beforeHover);
    const observation = page.evaluate(async () => {
      let overlaps = 0;
      let visibleFrames = 0;
      const start = performance.now();
      while (performance.now() - start < 1200) {
        const popover = document.querySelector<HTMLElement>('.driver-popover');
        const button = document.querySelector('button[aria-label="Crear en el mapa"]');
        if (popover && button && Number(getComputedStyle(popover).opacity) > 0.05) {
          const a = popover.getBoundingClientRect();
          const b = button.getBoundingClientRect();
          visibleFrames++;
          if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)
            overlaps++;
        }
        await new Promise(requestAnimationFrame);
      }
      return { overlaps, visibleFrames };
    });
    await creator.click();
    const result = await observation;
    expect(result.visibleFrames).toBeGreaterThan(10);
    expect(result.overlaps).toBe(0);
    await page.screenshot({ path: `test-results/teaching-creation-transition-${width}.png` });
    await page.getByRole('menuitem', { name: 'Crear nodo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Crear nodo' });
    await dialog.getByLabel('Título').fill('Ejemplo');
    await dialog.getByRole('button', { name: 'Crear nodo', exact: true }).click();
    await expect(popover.locator('.driver-popover-title')).toHaveText('Tipos de nodo');
    const types = page.getByRole('menuitem', { name: 'Gestionar tipos de nodo' });
    await types.click();
    const closeTypes = page.getByRole('button', { name: 'Cerrar tipos de nodo' });
    const typesDialog = page.getByRole('dialog').filter({ has: closeTypes });
    await expect(typesDialog).toHaveClass(/driver-active-element/);
    await closeTypes.click();
    await expect(typesDialog).toHaveCount(0);
    await creator.click();
    await expect(types).toHaveClass(/driver-active-element/);
    await popover.getByRole('button', { name: 'Siguiente' }).click();
    await expect(popover.locator('.driver-popover-title')).toHaveText('Conecta tu nodo');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });
}
