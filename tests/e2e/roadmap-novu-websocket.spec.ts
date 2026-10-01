import { expect, test } from '@playwright/test';
import { authenticateAs, fixture, roadmapPath } from './helpers';

// Explicit cloud contract check; ordinary CI remains independent of Novu Cloud.
test('a real Novu WebSocket change refreshes the authorized open Roadmap', async ({
  browser,
}, testInfo) => {
  test.skip(
    process.env.RUN_NOVU_REALTIME !== '1',
    'Requires an explicitly enabled Novu test environment.',
  );
  test.setTimeout(150_000);
  const baseURL = testInfo.project.use.baseURL as string;
  const author = await browser.newContext({ baseURL });
  const recipient = await browser.newContext({ baseURL });
  let nodeId = '';
  try {
    await Promise.all([
      authenticateAs(author, fixture.daniela),
      authenticateAs(recipient, fixture.cc1002StudentWithoutProgress),
    ]);
    const page = await recipient.newPage();
    let receivedFrame = false;
    page.on('websocket', (socket) =>
      socket.on('framereceived', ({ payload }) => {
        if (String(payload).includes('notification_received')) receivedFrame = true;
      }),
    );
    await page.goto('/courses/CC1002/2026/2');
    await expect(page.getByLabel('Lienzo del roadmap')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Avisos/ }).first()).toBeVisible();
    const title = `WebSocket real ${Date.now()}`;
    const refreshed = page.waitForResponse(
      async (response) => {
        if (
          response.request().method() !== 'GET' ||
          new URL(response.url()).pathname !== roadmapPath() ||
          !response.ok()
        )
          return false;
        const projection = await response.json();
        return (
          receivedFrame && projection.nodes.some((node: { title: string }) => node.title === title)
        );
      },
      { timeout: 120_000 },
    );
    const created = await author.request.post(roadmapPath('/nodes'), {
      data: {
        title,
        nodeTypeId: '00000000-0000-4000-8000-000000000001',
        positionX: 300,
        positionY: 100,
      },
    });
    expect(created.status()).toBe(201);
    nodeId = (await created.json()).node.id;
    await refreshed;
    expect(receivedFrame).toBe(true);
    await expect(page.locator(`.react-flow__node[data-id="${nodeId}"]`)).toContainText(title);
    // Arrival/refetch must leave this newly delivered Node notice pending.
    await expect(
      page.getByRole('button', { name: new RegExp(`avisos sin leer para ${title}`) }),
    ).toBeVisible();
  } finally {
    if (nodeId) await author.request.delete(roadmapPath(`/nodes/${nodeId}`));
    await Promise.all([author.close(), recipient.close()]);
  }
});
