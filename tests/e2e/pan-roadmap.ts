import { expect, type Page } from '@playwright/test';

export async function panRoadmapNodeIntoView(page: Page, nodeId: string) {
  const pane = page.locator('.react-flow__pane');
  const node = page.locator(`.react-flow__node[data-id="${nodeId}"]`);

  await expect(node).toBeAttached();
  await expect(pane).toBeVisible();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const [nodeBox, paneBox] = await Promise.all([node.boundingBox(), pane.boundingBox()]);
    if (!nodeBox || !paneBox) throw new Error('No se pudo ubicar el nodo dentro del lienzo.');

    const paneCenter = { x: paneBox.x + paneBox.width / 2, y: paneBox.y + paneBox.height / 2 };
    const nodeCenter = { x: nodeBox.x + nodeBox.width / 2, y: nodeBox.y + nodeBox.height / 2 };
    const offsetX = paneCenter.x - nodeCenter.x;
    const offsetY = paneCenter.y - nodeCenter.y;
    if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) break;

    const panStart = await pane.evaluate((element) => {
      const box = element.getBoundingClientRect();
      for (const row of [0.3, 0.5, 0.7, 0.2, 0.8]) {
        for (const column of [0.3, 0.5, 0.7, 0.2, 0.8]) {
          const point = { x: box.x + box.width * column, y: box.y + box.height * row };
          if (document.elementFromPoint(point.x, point.y) === element) return point;
        }
      }
      return null;
    });
    if (!panStart) throw new Error('No se encontró un área libre para desplazar el lienzo.');
    await page.mouse.move(panStart.x, panStart.y);
    await page.mouse.down();
    await page.mouse.move(
      panStart.x + Math.max(-100, Math.min(100, offsetX)),
      panStart.y + Math.max(-100, Math.min(100, offsetY)),
      { steps: 4 },
    );
    await page.mouse.up();
  }
  await expect(node).toBeInViewport();
}
