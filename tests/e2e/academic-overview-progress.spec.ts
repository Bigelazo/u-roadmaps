import { expect, test } from './fixtures';
import {
  developmentFixtureIds,
  fixtureCompletions,
  fixtureRoadmaps,
  fixtureUsers,
} from '@/development/fixtures/catalog';
import { authenticateAs } from './helpers';

const template = fixtureRoadmaps.find(({ id }) => id === developmentFixtureIds.roadmaps.cc1002)!;
const visibleNodeIds = new Set(template.nodes.filter((node) => node.isVisible).map(({ id }) => id));
const visibleNodes = visibleNodeIds.size;

function catalogCompletedNodes(rut: string) {
  const user = fixtureUsers.find((candidate) => candidate.rut === rut)!;
  return fixtureCompletions.filter(
    ({ userId, roadmapNodeId }) => userId === user.id && visibleNodeIds.has(roadmapNodeId),
  ).length;
}

test('the Academic overview shows each participant their own Roadmap progress', async ({
  page,
  course,
}) => {
  const { teacher, studentWithProgress, studentWithoutProgress } = course.users;
  const row = () => page.getByRole('listitem').filter({ hasText: course.courseCode });
  expect(catalogCompletedNodes('20000001')).toBe(0);

  await authenticateAs(page.context(), studentWithProgress.id);
  await page.goto('/academic-overview');
  await expect(row()).toContainText(
    `${catalogCompletedNodes('20000009')} de ${visibleNodes} nodos`,
  );

  await page.context().clearCookies();
  await authenticateAs(page.context(), studentWithoutProgress.id);
  await page.goto('/academic-overview');
  await expect(row()).toContainText('Aún no completas nodos');

  await page.context().clearCookies();
  await authenticateAs(page.context(), teacher.id);
  await page.goto('/academic-overview');
  await expect(
    row().getByRole('link', { name: `Abrir roadmap de ${course.courseName}` }),
  ).toBeVisible();
  await expect(row()).not.toContainText('nodos');
});
