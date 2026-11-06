import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { authenticateAs, toast } from './helpers';
import { panRoadmapNodeIntoView } from './pan-roadmap';

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error(`Cannot measure ${locator}`);
  return result;
}

for (const width of [1440, 1024, 390, 320]) {
  test(`feedback stays left of the floating control and clear of its menu at ${width}px`, async ({
    page,
    course,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await authenticateAs(page.context(), course.users.teacher.id);
    await page.goto(course.pagePath());
    // Nodes are positioned in graph coordinates; document scrolling cannot
    // reveal one outside React Flow's transformed canvas at narrow widths.
    await panRoadmapNodeIntoView(page, course.nodes.first);
    const selectedNode = page.locator(`.react-flow__node[data-id="${course.nodes.first}"]`);
    await selectedNode.click();
    const sidebar = page.locator('#roadmap-editor-panel');
    await expect(sidebar).toBeVisible();
    await page.getByLabel('Título', { exact: true }).fill('Variables revisadas');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    const feedback = toast(page, 'Cambios guardados exitosamente.');
    const trigger = page.getByRole('button', { name: 'Crear en el mapa' });
    await feedback.hover();

    async function expectPlacement(menuOpen: boolean) {
      await expect
        .poll(async () => {
          const [notice, anchor, panel] = await Promise.all([
            box(feedback),
            box(trigger),
            sidebar.boundingBox(),
          ]);
          const menu = menuOpen ? await box(page.locator('[data-toast-obstacle]')) : null;
          const entryClip = await page
            .locator('[data-slot="toast-viewport"]')
            .evaluate((element) => {
              const style = getComputedStyle(element);
              const bounds = element.getBoundingClientRect();
              return {
                clipsVerticalMotion: style.overflowY === 'clip',
                right: bounds.right,
                bottom: bounds.bottom + parseFloat(style.overflowClipMargin),
              };
            });
          return {
            leftOfTrigger: notice.x + notice.width <= anchor.x - 12,
            readableWidth: notice.width >= 200,
            insideViewport: notice.x >= 16 && notice.y >= 0 && notice.y + notice.height <= 900,
            clearOfSidebar:
              !panel || notice.x + notice.width <= panel.x || notice.y + notice.height <= panel.y,
            aboveMenu: !menu || notice.y + notice.height <= menu.y - 8,
            // The entry/exit can extend below its resting rectangle. Verify the
            // painted clip edge also clears the stacked sidebar during motion.
            entryClearOfSidebar:
              entryClip.clipsVerticalMotion &&
              (!panel || entryClip.right <= panel.x || entryClip.bottom <= panel.y),
          };
        })
        .toEqual({
          leftOfTrigger: true,
          readableWidth: true,
          insideViewport: true,
          clearOfSidebar: true,
          aboveMenu: true,
          entryClearOfSidebar: true,
        });
    }

    await expectPlacement(false);
    await page.screenshot({ path: testInfo.outputPath(`toast-sidebar-${width}.png`) });
    if (width < 1024) {
      // The compact editor sheet covers the floating control until it closes.
      await page.keyboard.press('Escape');
      await expect(sidebar).toBeHidden();
      await expectPlacement(false);
    }
    await trigger.click();
    await expect(page.getByRole('menuitem', { name: 'Crear nodo', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem').last()).toHaveCSS('opacity', '1');
    await feedback.hover();
    await expectPlacement(true);
    await page.screenshot({ path: testInfo.outputPath(`toast-menu-${width}.png`) });
    await page.keyboard.press('Escape');
    await expectPlacement(false);
  });
}
