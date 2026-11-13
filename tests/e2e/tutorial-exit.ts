import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export async function expectExitReachable(page: Page, evidence: string) {
  const exit = page.locator('[data-tutorial-exit]');
  await expect(page.locator('.driver-popover')).toHaveCSS('opacity', '1');
  await expect
    .poll(() =>
      exit.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          getComputedStyle(element).visibility === 'visible' &&
          element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
        );
      }),
    )
    .toBe(true);
  await page.screenshot({ path: `test-results/tutorial-exit-${evidence}.png` });
}

export async function leavePractice(page: Page) {
  const popover = page.locator('.driver-popover');
  if (!(await page.getByRole('link', { name: 'Salir', exact: true }).isVisible())) {
    await popover.getByRole('button', { name: 'Cerrar tutorial' }).tap();
    await page
      .getByRole('alertdialog', { name: '¿Salir del tutorial?' })
      .getByRole('button', { name: 'Salir', exact: true })
      .tap();
    await expect(popover).toHaveCount(0);
    const closeDetail = page.getByRole('button', { name: 'Cerrar detalle', exact: true });
    if (await closeDetail.isVisible()) await closeDetail.tap();
  }
  await page.getByRole('link', { name: 'Salir', exact: true }).tap();
}
