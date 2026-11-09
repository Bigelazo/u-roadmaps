import { expect, test, type E2ECourseOffering } from './fixtures';
import { authenticateAs, ok } from './helpers';
import { createDependency } from './create-node';

const gridCell = 20;
const nodeSize = { width: 160, height: 80 };
const clearance = 2 * gridCell;

test('dropping a Node on another pushes it two grid cells away, saves both and draws their Dependency', async ({
  page,
  course,
  createCourse,
  teacherApi: api,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const offering: E2ECourseOffering = await createCourse({
    roadmap: false,
    participants: [{ user: course.users.teacher, role: 'TEACHER' }],
  });
  await ok(await api.post(offering.apiPath(), { data: {} }), 201);
  const types = (await (await api.get(offering.apiPath())).json()).nodeTypes;
  const nodeTypeId = types.find((type: { isPredefined: boolean }) => type.isPredefined).id;
  const ids: string[] = [];
  for (const [title, x] of [
    ['Arrastrado', 0],
    ['Ocupado', 400],
  ] as const) {
    const response = await ok(
      await api.post(offering.apiPath('/nodes'), {
        data: { title, nodeTypeId, positionX: x, positionY: 0 },
      }),
      201,
    );
    ids.push((await response.json()).node.id as string);
  }
  const [dragged, occupied] = ids;
  await createDependency(api, offering, dragged, occupied);
  await authenticateAs(page.context(), course.users.teacher.id);
  await page.goto(offering.pagePath());
  await expect(page.locator('.react-flow__edge-path')).toHaveCount(1);

  const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
  const from = (await node(dragged).boundingBox())!;
  const to = (await node(occupied).boundingBox())!;
  const saved = (id: string) =>
    page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' && response.url().endsWith(`/nodes/${id}`),
    );
  const savedDragged = saved(dragged);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + gridCell, { steps: 12 });
  await page.mouse.up();
  expect((await savedDragged).status()).toBe(200);

  const separated = async () => {
    const nodes: { id: string; positionX: number; positionY: number; title: string }[] = (
      await (await api.get(offering.apiPath())).json()
    ).nodes;
    const [a, b] = ids.map((id) => nodes.find((candidate) => candidate.id === id)!);
    return {
      grid: [a, b].every(
        ({ positionX, positionY }) => positionX % gridCell === 0 && positionY % gridCell === 0,
      ),
      gap: Math.max(
        Math.abs(a.positionY - b.positionY) - nodeSize.height,
        a.positionX < b.positionX
          ? b.positionX - a.positionX - nodeSize.width
          : a.positionX - b.positionX - nodeSize.width,
      ),
    };
  };
  await expect.poll(separated).toMatchObject({ grid: true, gap: clearance });
  const result = await separated();
  await page.screenshot({ path: testInfo.outputPath('collision-desktop.png') });

  await page.reload();
  await expect(page.locator('.react-flow__edge-path')).toHaveCount(1);
  expect(await separated()).toEqual(result);
});
