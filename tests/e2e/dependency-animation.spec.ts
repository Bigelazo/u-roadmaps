import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ok } from './helpers';

type EdgeSample = { id: string; progress: number; tip: string; tipError: number };
type NodeSample = { id: string; scale: number };
type FrameSample = { time: number; edges: EdgeSample[]; nodes: NodeSample[] };

declare global {
  interface Window {
    dependencyAnimationFrames: FrameSample[];
  }
}

async function observeDrawing(page: Page) {
  await page.addInitScript(() => {
    window.dependencyAnimationFrames = [];
    const sample = () => {
      const edges = Array.from(document.querySelectorAll<SVGGElement>('.react-flow__edge')).flatMap(
        (edge) => {
          const stroke = edge.querySelector<SVGPathElement>('.react-flow__edge-path');
          const tip = edge.querySelector<SVGPathElement>('[data-testid="dependency-arrowhead"]');
          if (!stroke || !tip) return [];
          const progress = Number.parseFloat(stroke.getAttribute('stroke-dasharray') ?? 'NaN');
          if (!Number.isFinite(progress)) return [];
          const transform = tip.getAttribute('transform') ?? '';
          const coordinates = /translate\(([-\d.e+]+)[ ,]+([-\d.e+]+)\)/i.exec(transform);
          const expected = stroke.getPointAtLength(stroke.getTotalLength() * progress);
          return [
            {
              id: edge.dataset.id ?? '',
              progress,
              tip: transform,
              tipError: coordinates
                ? Math.hypot(
                    Number(coordinates[1]) - expected.x,
                    Number(coordinates[2]) - expected.y,
                  )
                : Number.MAX_VALUE,
            },
          ];
        },
      );
      if (edges.length) {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node')).map(
          (node) => {
            const card = node.querySelector<HTMLElement>('[data-slot="roadmap-card"]');
            const transform = card ? getComputedStyle(card).transform : 'none';
            return {
              id: node.dataset.id ?? '',
              scale: transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a,
            };
          },
        );
        window.dependencyAnimationFrames.push({ time: performance.now(), edges, nodes });
        if (window.dependencyAnimationFrames.length > 1500)
          window.dependencyAnimationFrames.shift();
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function waitForCompleteDrawing(page: Page) {
  await expect
    .poll(
      async () => {
        await page.clock.runFor(16);
        return page.evaluate(() => {
          const latest = window.dependencyAnimationFrames.at(-1);
          return (
            latest?.edges.length === 8 &&
            latest.edges.every((edge) => edge.progress === 1) &&
            latest.nodes.every((node) => node.scale === 1)
          );
        });
      },
      { intervals: [1] },
    )
    .toBe(true);
}

async function assertEntryDrawing(page: Page) {
  await waitForCompleteDrawing(page);
  const frames = await page.evaluate(() => window.dependencyAnimationFrames);
  const partialFrames = frames.filter((frame) =>
    frame.edges.some((edge) => edge.progress > 0 && edge.progress < 1),
  );
  expect(partialFrames.length).toBeGreaterThan(1);
  for (const frame of frames) {
    expect(
      frame.edges.filter((edge) => edge.progress > 0 && edge.progress < 1).length,
    ).toBeLessThanOrEqual(1);
  }

  const firstStarted = new Map<string, number>();
  const firstCompleted = new Map<string, number>();
  const tips = new Map<string, Set<string>>();
  for (const frame of frames) {
    for (const edge of frame.edges) {
      if (edge.progress > 0 && !firstStarted.has(edge.id)) firstStarted.set(edge.id, frame.time);
      if (edge.progress === 1 && !firstCompleted.has(edge.id))
        firstCompleted.set(edge.id, frame.time);
      if (edge.progress > 0 && edge.progress < 1) {
        expect(edge.tipError).toBeLessThan(0.01);
        const positions = tips.get(edge.id) ?? new Set<string>();
        positions.add(edge.tip);
        tips.set(edge.id, positions);
      }
    }
  }
  expect(firstCompleted.size).toBe(8);
  const nodeStarted = new Map<string, number>();
  for (const frame of frames) {
    for (const node of frame.nodes) {
      if (node.scale > 0 && !nodeStarted.has(node.id)) nodeStarted.set(node.id, frame.time);
    }
  }
  expect(frames.some((frame) => frame.nodes.some((node) => node.scale > 0 && node.scale < 1))).toBe(
    true,
  );
  for (const [dependency, target] of [
    [1, 'b'],
    [2, 'c'],
    [3, 'd'],
    [4, 'e'],
    [5, 'e'],
    [6, 'e'],
    [7, 'f'],
    [8, 'g'],
  ] as const) {
    expect(nodeStarted.get(`practice-node-${target}`)).toBeGreaterThanOrEqual(
      firstCompleted.get(`practice-dependency-${dependency}`)!,
    );
  }
  for (let id = 1; id <= 8; id++) {
    expect(tips.get(`practice-dependency-${id}`)?.size ?? 0).toBeGreaterThan(1);
  }
  for (const [before, after] of [
    [1, 3],
    [1, 4],
    [2, 5],
    [3, 6],
    [4, 7],
    [5, 7],
    [6, 7],
    [4, 8],
    [5, 8],
    [6, 8],
  ]) {
    expect(firstCompleted.get(`practice-dependency-${before}`)).toBeLessThanOrEqual(
      firstStarted.get(`practice-dependency-${after}`)!,
    );
  }
  const startedAt = Math.min(...firstStarted.values());
  const completedAt = Math.max(...firstCompleted.values());
  expect(completedAt - startedAt).toBeLessThan(2300);
}

async function closePracticeTutorial(page: Page) {
  await expect(page.locator('.driver-popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('alertdialog', { name: '¿Salir del tutorial?' })
    .getByRole('button', { name: 'Salir' })
    .click();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
}

test('Dependencies draw sequentially with moving tips on entry and reload, preserving completion during editing', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const clockStart = Date.now();
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(clockStart + 1000);
  await observeDrawing(page);
  await ok(
    await page.request.post('/api/development/session', {
      data: { userId: '10000000-0000-4000-8000-000000000001' },
    }),
  );
  await page.goto('/practice-roadmap/teaching');
  await assertEntryDrawing(page);
  await page.clock.resume();
  await closePracticeTutorial(page);
  await page
    .locator('.react-flow')
    .screenshot({ path: testInfo.outputPath('dependency-animation-complete.png') });

  await page.evaluate(() => {
    window.dependencyAnimationFrames = [];
  });
  const viewport = page.locator('.react-flow__viewport');
  const previousTransform = await viewport.getAttribute('style');
  const pane = await page.locator('.react-flow__pane').boundingBox();
  expect(pane).not.toBeNull();
  await page.mouse.move(pane!.x + pane!.width / 2, pane!.y + pane!.height / 2);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => viewport.getAttribute('style')).not.toBe(previousTransform);

  const node = page.locator('.react-flow__node[data-id="practice-node-b"]');
  await node.locator('p').click();
  const editor = page.locator('#roadmap-editor-panel');
  await expect(editor).toBeVisible();
  await editor.getByLabel('Título', { exact: true }).fill('Conceptos actualizados');
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(node.locator('p')).toHaveText('Conceptos actualizados');
  await expect
    .poll(() => page.evaluate(() => window.dependencyAnimationFrames.length))
    .toBeGreaterThan(1);
  const editingFrames = await page.evaluate(() => window.dependencyAnimationFrames);
  expect(
    editingFrames.every(
      (frame) => frame.edges.length === 8 && frame.edges.every((edge) => edge.progress === 1),
    ),
  ).toBe(true);

  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.reload();
  await assertEntryDrawing(page);
  await page.clock.resume();
  await expect(page.locator('.react-flow__node[data-id="practice-node-b"] p')).toHaveText(
    'Conceptos básicos',
  );
});
