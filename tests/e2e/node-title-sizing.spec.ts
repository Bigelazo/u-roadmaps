import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { authenticateAs } from './helpers';
import { prepareNodeCreator } from './create-node';

async function expectOneLine(title: Locator) {
  await expect
    .poll(() =>
      title.evaluate((element) => {
        const text = element.firstChild!;
        return new Set(
          Array.from(element.textContent!).map((_, index) => {
            const range = document.createRange();
            range.setStart(text, index);
            range.setEnd(text, index + 1);
            return range.getBoundingClientRect().top;
          }),
        ).size;
      }),
    )
    .toBe(1);
}

for (const viewportWidth of [1440, 390]) {
  test(`short titles fit after delayed font loading at ${viewportWidth}px`, async ({
    page,
    course,
    teacherApi,
  }, testInfo) => {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    const creator = await prepareNodeCreator(teacherApi, course);
    const titles = ['Nombre', 'Listas', 'Recursión', 'Archivos', 'MMMMMM'];
    const created: { id: string; title: string }[] = [];
    for (const [index, title] of titles.entries()) {
      created.push(await creator.createNode(title, index * 300));
    }
    const longTitle = 'Una palabra extraordinariamente larga para comprobar el límite del título';
    const longNode = await creator.createNode(longTitle, 1500);
    let releaseFonts: () => void = () => undefined;
    const fontsReleased = new Promise<void>((resolve) => {
      releaseFonts = resolve;
    });
    await page.route('**/*.woff2', async (route) => {
      await fontsReleased;
      await route.continue();
    });
    await authenticateAs(page.context(), course.users.teacher.id);
    await page.goto(course.pagePath(), { waitUntil: 'domcontentloaded' });
    const card = (id: string) =>
      page.locator(`.react-flow__node[data-id="${id}"]`).getByTestId('roadmap-card');
    try {
      await expect(card(created[0].id)).toBeAttached();
    } finally {
      releaseFonts();
    }
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    for (const node of created) {
      const title = card(node.id).locator('p');
      await expect(title).toHaveText(node.title);
      await expectOneLine(title);
    }
    await expect(card(created[0].id)).toHaveCSS('width', '160px');
    await expect(card(created[1].id)).toHaveCSS('width', '120px');
    await expect(card(longNode.id)).toHaveCSS('width', '240px');
    await expect(card(longNode.id)).toHaveCSS('height', '80px');
    await expect(card(longNode.id).locator('p')).toHaveAttribute('title', longTitle);
    await page.getByRole('button', { name: 'Centrar mapa' }).click();
    await page.screenshot({ path: testInfo.outputPath('node-titles.png') });
    await page.reload();
    await expectOneLine(card(created[0].id).locator('p'));
  });
}

test('editing a title resizes its node and survives a reload', async ({ page, course }) => {
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(course.pagePath());
  await page.getByRole('button', { name: 'Centrar mapa' }).click();
  const card = page
    .locator(`.react-flow__node[data-id="${course.nodes.first}"]`)
    .getByTestId('roadmap-card');
  await card.click();
  const editor = page.getByRole('group', { name: 'Editor de nodo', exact: true });
  for (const [title, width] of [
    ['Listas', '120px'],
    ['Nombre', '160px'],
  ]) {
    await editor.getByRole('textbox', { name: 'Título', exact: true }).fill(title);
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/nodes/${course.nodes.first}`),
    );
    await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(card.locator('p')).toHaveText(title);
    await expectOneLine(card.locator('p'));
    await expect(card).toHaveCSS('width', width);
  }
  await page.reload();
  await expect(card.locator('p')).toHaveText('Nombre');
  await expectOneLine(card.locator('p'));
  await expect(card).toHaveCSS('width', '160px');
});
