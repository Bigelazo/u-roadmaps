import { expect, test, type E2EPrimaryCourseOffering } from './fixtures';
import {
  developmentFixtureIds,
  fixtureCompletions,
  fixtureRoadmaps,
  fixtureUsers,
} from '@/development/fixtures/catalog';
import { authenticateAs } from './helpers';

const template = fixtureRoadmaps.find(({ id }) => id === developmentFixtureIds.roadmaps.cc1002)!;
const visibleNodeIds = new Set(template.nodes.filter((node) => node.isVisible).map(({ id }) => id));

function catalogCompletedNodes(rut: string) {
  const user = fixtureUsers.find((candidate) => candidate.rut === rut)!;
  return fixtureCompletions.filter(
    ({ userId, roadmapNodeId }) => userId === user.id && visibleNodeIds.has(roadmapNodeId),
  ).length;
}

const visibleNodes = visibleNodeIds.size;
const withProgress = catalogCompletedNodes('20000009');
const complete = catalogCompletedNodes('20000048');
const withoutProgress = catalogCompletedNodes('20000001');

function percent(completed: number) {
  return `${Math.round((completed / visibleNodes) * 100)}%`;
}

function participantsPath(course: E2EPrimaryCourseOffering) {
  return `${course.pagePath()}/participants`;
}

test('teaching staff follow every U-Campus student’s Roadmap completion from both entry points', async ({
  page,
  course,
  reportPosition,
  reportRoster,
}) => {
  const { teacher, teachingAssistant, studentWithProgress, studentComplete } = course.users;
  const { studentWithoutProgress, multiCourseStudent, withdrawnStudent } = course.users;
  const ramoId = Number(teacher.rut);
  const neverEntered = `9${teacher.rut.slice(1)}`;
  const earlierTermStudent = `8${teacher.rut.slice(1)}`;
  const name = (first: string) => ({ first, lastName: 'Prueba', secondLastName: teacher.rut });
  await reportPosition(teacher, course, 'COURSE_PROFESSOR', ramoId);
  await reportRoster(ramoId, course, [
    { rut: teacher.rut, section: '1', position: 'COURSE_PROFESSOR', name: name('Carolina') },
    {
      rut: teachingAssistant.rut,
      section: '2',
      position: 'TEACHING_ASSISTANT',
      name: name('Tomás'),
    },
    { rut: studentWithProgress.rut, section: '1', position: 'STUDENT', name: name('Valentina') },
    { rut: studentComplete.rut, section: '2', position: 'STUDENT', name: name('Ignacio') },
    { rut: studentWithoutProgress.rut, section: '1', position: 'STUDENT' },
    { rut: neverEntered, section: '2', position: 'STUDENT', name: name('Josefa') },
    { rut: multiCourseStudent.rut, section: '1', position: 'OBSERVER', name: name('Matías') },
    {
      rut: earlierTermStudent,
      section: '1',
      position: 'STUDENT',
      name: name('Antonia'),
      term: { year: course.year - 1, semester: course.semester },
    },
  ]);
  await authenticateAs(page.context(), teacher.id);

  await page.goto('/academic-overview');
  await page.getByRole('link', { name: `Integrantes de ${course.courseName}` }).click();
  await expect(page).toHaveURL(participantsPath(course));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Integrantes del curso' }),
  ).toBeVisible();
  await expect(page.getByText('No pudimos obtener el listado completo')).toHaveCount(0);

  const average = (withProgress + complete + withoutProgress + 0) / visibleNodes / 4;
  const summary = page.getByRole('region', { name: 'Completación promedio del roadmap' });
  await expect(summary).toContainText(`${Math.round(average * 100)}%`);
  await expect(summary).toContainText('Solo estudiantes · 4 estudiantes');
  await expect(summary).toContainText('3 de 4');
  await expect(
    summary.getByRole('progressbar', { name: 'Completación promedio de estudiantes' }),
  ).toHaveAttribute('aria-valuenow', String(Math.round(average * 100)));

  const students = page.getByRole('region', { name: 'Estudiantes' });
  const row = (person: string) => students.getByRole('listitem', { name: person });
  await expect(students.getByRole('listitem')).toHaveCount(5);
  await expect(row(`Valentina Prueba ${teacher.rut}`)).toContainText(percent(withProgress));
  await expect(row(`Valentina Prueba ${teacher.rut}`)).toContainText(
    `${withProgress} de ${visibleNodes} nodos`,
  );
  await expect(row(`Valentina Prueba ${teacher.rut}`)).toContainText('Sección 1');
  await expect(row(`Ignacio Prueba ${teacher.rut}`)).toContainText(percent(complete));
  await expect(row(studentWithoutProgress.name)).toContainText(percent(withoutProgress));
  await expect(row(`Josefa Prueba ${teacher.rut}`)).toContainText('Sin ingreso');
  await expect(row(`Josefa Prueba ${teacher.rut}`)).toContainText('0%');
  await expect(row(`Matías Prueba ${teacher.rut}`)).toContainText('Oyente · fuera del promedio');
  await expect(students).not.toContainText(`Antonia Prueba ${teacher.rut}`);
  await expect(students).not.toContainText(withdrawnStudent.name);

  const staff = page.getByRole('region', { name: 'Equipo docente' });
  await expect(staff.getByRole('listitem')).toHaveCount(2);
  await expect(
    staff.getByRole('listitem', { name: `Carolina Prueba ${teacher.rut}` }),
  ).toContainText('Profesor de cátedra · Sección 1');
  await expect(staff.getByRole('listitem', { name: `Tomás Prueba ${teacher.rut}` })).toContainText(
    'Ayudante · Sección 2',
  );

  await page.getByRole('link', { name: 'Volver al roadmap' }).click();
  await expect(page).toHaveURL(course.pagePath());
  await page.getByRole('link', { name: 'Integrantes', exact: true }).click();
  await expect(page).toHaveURL(participantsPath(course));
});

test('without U-Campus the page lists only local participants and warns it is incomplete', async ({
  page,
  course,
}) => {
  await authenticateAs(page.context(), course.users.teacher.id);

  await page.goto(participantsPath(course));

  await expect(
    page.getByText('No pudimos obtener el listado completo desde U-Campus'),
  ).toBeVisible();
  const students = page.getByRole('region', { name: 'Estudiantes' });
  await expect(
    students.getByRole('listitem', { name: course.users.studentWithProgress.name }),
  ).toContainText(percent(withProgress));
  await expect(students).not.toContainText(course.users.withdrawnStudent.name);
  await expect(
    page
      .getByRole('region', { name: 'Equipo docente' })
      .getByRole('listitem', { name: course.users.teacher.name }),
  ).toBeVisible();
});

test('students cannot open the course members page', async ({ page, course }) => {
  await authenticateAs(page.context(), course.users.studentWithProgress.id);

  const response = await page.goto(participantsPath(course));

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Integrantes del curso' })).toHaveCount(0);
});
