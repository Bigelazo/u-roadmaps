import type { Page } from '@playwright/test';

export async function observeTutorialExit(page: Page) {
  await page.evaluate(() => {
    const failures: string[] = [];
    Object.assign(window, { tutorialExitFailures: failures });
    const sample = () => {
      const exit = document.querySelector<HTMLElement>('[data-tutorial-exit]');
      if (exit && document.body.classList.contains('driver-active')) {
        const style = getComputedStyle(exit);
        const rect = exit.getBoundingClientRect();
        if (style.visibility !== 'visible' || Number(style.opacity) < 1)
          failures.push(`${style.visibility}:${style.opacity}`);
        if (
          !exit.contains(
            document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
          )
        )
          failures.push('covered');
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

export function tutorialExitFailures(page: Page) {
  return page.evaluate(
    () => (window as Window & { tutorialExitFailures?: string[] }).tutorialExitFailures,
  );
}
