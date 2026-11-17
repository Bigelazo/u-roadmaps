import { expect, test } from './fixtures';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 1440, height: 2160 },
]) {
  test.describe(`landing statements at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('fully reveals the extension statement at the bottom for both audiences', async ({
      page,
    }) => {
      await page.goto('/');
      for (const audience of ['Para equipos docentes', 'Para estudiantes']) {
        await page.getByRole('tab', { name: audience }).click();
        const words = page.locator('section[aria-labelledby="extension-title"] p span');
        await expect
          .poll(async () => {
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            return words.evaluateAll(
              (elements) =>
                elements.length > 0 &&
                elements.every((element) => getComputedStyle(element).opacity === '1'),
            );
          })
          .toBe(true);
      }
    });
  });
}
