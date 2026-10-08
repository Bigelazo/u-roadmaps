import { expect, test, type E2ECourseOffering, type E2EUser } from './fixtures';
import { chileCalendarDay } from '@/features/roadmap/domain/scheduled-unlock';
import { insert, literal, sql } from './database';
import { authenticateAs } from './helpers';
import { randomUUID } from 'node:crypto';

function yesterday() {
  const day = new Date(`${chileCalendarDay()}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

function versionsPath(offering: E2ECourseOffering) {
  return `/api/${offering.courseCode}/versions`;
}

function setParticipation(
  user: E2EUser,
  offering: E2ECourseOffering,
  changes: Record<string, string | boolean>,
) {
  const assignments = Object.entries(changes)
    .map(([column, value]) =>
      column === 'institutionalPosition'
        ? `"${column}" = ${literal(value)}::"InstitutionalCoursePosition"`
        : `"${column}" = ${literal(value)}`,
    )
    .join(', ');
  return sql(
    `UPDATE "Participation" SET ${assignments} WHERE "userId" = ${literal(user.id)} AND "courseOfferingId" = ${literal(offering.id)};`,
  );
}

test('a closed version records its creator and the teaching staff active at closure', async ({
  course,
  createCourse,
  createTerm,
  apiAs,
  waitForClosure,
}) => {
  const closedTerm = await createTerm();
  const openTerm = await createTerm();
  const creator = course.users.teacher;
  const assistant = course.users.teachingAssistant;
  const created = await createCourse({
    ...closedTerm,
    roadmap: false,
    participants: [
      { user: creator, role: 'TEACHER' },
      { user: assistant, role: 'TEACHER', institutionalPosition: 'TEACHING_ASSISTANT' },
      { user: course.users.studentWithoutProgress, role: 'STUDENT' },
    ],
  });
  const creation = await (await apiAs(creator)).post(created.apiPath(), { data: {} });
  expect(creation.status()).toBe(201);
  const closed = { ...created, roadmapId: (await creation.json()).roadmap.id as string };
  await createCourse({
    ...openTerm,
    sameCourseAs: created,
    participants: [{ user: assistant, role: 'TEACHER' }],
  });

  // The creator leaves before closure and is still credited.
  await setParticipation(creator, created, { isActive: false });
  await closedTerm.setFreezeDate(yesterday());
  await waitForClosure(closed);
  // Later Participation changes never rewrite the recorded staff.
  await setParticipation(assistant, created, { institutionalPosition: 'COURSE_PROFESSOR' });
  await sql(
    insert('Participation', [
      {
        id: randomUUID(),
        userId: course.users.studentWithProgress.id,
        courseOfferingId: created.id,
        role: 'TEACHER',
        institutionalPosition: 'AUXILIARY_PROFESSOR',
        isActive: true,
      },
    ]),
  );

  const response = await (await apiAs(assistant)).get(versionsPath(created));
  expect(response.status()).toBe(200);
  const history = await response.json();
  expect(history.horizon).toEqual({ year: openTerm.year, semester: openTerm.semester });
  expect(history.versions).toEqual([
    {
      year: closedTerm.year,
      semester: closedTerm.semester,
      edition: `Edición ${closedTerm.year}-${closedTerm.semester}`,
      closedAt: expect.any(String),
      creator: { id: creator.id, name: creator.name },
      teachingStaff: [
        { id: assistant.id, name: assistant.name, institutionalPosition: 'TEACHING_ASSISTANT' },
      ],
      origin: { kind: 'EMPTY' },
    },
  ]);
});

test('the horizon stops at the latest active teaching term and advances on rejoining', async ({
  createCourse,
  createTerm,
  createUser,
  apiAs,
  waitForClosure,
}) => {
  const terms = [await createTerm(), await createTerm(), await createTerm()];
  const teacher = await createUser();
  const first = await createCourse({
    ...terms[0],
    participants: [{ user: teacher, role: 'TEACHER', institutionalPosition: 'COURSE_PROFESSOR' }],
  });
  const offerings = [first];
  for (const term of terms.slice(1))
    offerings.push(await createCourse({ ...term, sameCourseAs: first }));
  for (const [index, term] of terms.entries()) {
    await term.setFreezeDate(yesterday());
    await waitForClosure(offerings[index]);
  }
  // Inactive teaching staff in the latest term does not extend the horizon.
  await sql(
    insert('Participation', [
      {
        id: randomUUID(),
        userId: teacher.id,
        courseOfferingId: offerings[2].id,
        role: 'TEACHER',
        institutionalPosition: 'COURSE_PROFESSOR',
        isActive: false,
      },
    ]),
  );
  const api = await apiAs(teacher);
  const editions = async () =>
    ((await (await api.get(versionsPath(first))).json()).versions as { year: number }[]).map(
      ({ year }) => year,
    );
  expect(await editions()).toEqual([terms[0].year]);

  await sql(
    insert('Participation', [
      {
        id: randomUUID(),
        userId: teacher.id,
        courseOfferingId: offerings[1].id,
        role: 'TEACHER',
        institutionalPosition: 'TEACHING_ASSISTANT',
        isActive: true,
      },
    ]),
  );
  expect(await editions()).toEqual([terms[1].year, terms[0].year]);
});

test('students and outsiders are refused the version history', async ({
  course,
  createUser,
  apiAs,
  page,
}) => {
  const student = await apiAs(course.users.studentWithProgress);
  const studentResponse = await student.get(versionsPath(course));
  expect(studentResponse.status()).toBe(403);
  expect((await studentResponse.json()).error.code).toBe('FORBIDDEN');
  const outsider = await apiAs(await createUser());
  expect((await outsider.get(versionsPath(course))).status()).toBe(403);
  expect((await outsider.get('/api/E2E-MISSING/versions')).status()).toBe(404);

  await authenticateAs(page.context(), course.users.studentWithProgress.id);
  await page.goto(course.pagePath());
  await expect(page.getByRole('heading', { name: course.courseName })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Historial de versiones' })).toHaveCount(0);
  const visit = await page.goto(`/courses/${course.courseCode}/versions`);
  expect(visit?.status()).toBe(404);
});

test('teaching staff reach the history from the Roadmap and from past offerings', async ({
  createCourse,
  createTerm,
  createUser,
  page,
  waitForClosure,
}) => {
  const pastTerm = await createTerm();
  const latestTerm = await createTerm();
  const teacher = await createUser();
  const past = await createCourse({
    ...pastTerm,
    participants: [{ user: teacher, role: 'TEACHER', institutionalPosition: 'COURSE_PROFESSOR' }],
  });
  const latest = await createCourse({
    ...latestTerm,
    sameCourseAs: past,
    participants: [{ user: teacher, role: 'TEACHER', institutionalPosition: 'COURSE_PROFESSOR' }],
  });
  await pastTerm.setFreezeDate(yesterday());
  await waitForClosure(past);

  await authenticateAs(page.context(), teacher.id);
  await page.goto(latest.pagePath());
  await page.getByRole('link', { name: 'Historial de versiones' }).click();
  await expect(page).toHaveURL(new RegExp(`/courses/${past.courseCode}/versions$`));
  const version = page.getByRole('listitem', { name: `Edición ${pastTerm.year}-1` });
  await expect(version).toContainText('Creada desde cero');
  await expect(version).toContainText(`${teacher.name} · Profesor de cátedra`);
  // Seeded without a recorded creator, which is never inferred.
  await expect(version).toContainText('Creador no registrado');

  await page.goto('/academic-overview');
  await expect(
    page.getByRole('link', { name: `Historial de versiones de ${past.courseName}` }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: /Semestres anteriores/ }).click();
  await page.getByRole('button', { name: `Otoño ${pastTerm.year}` }).click();
  await expect(
    page.getByRole('link', { name: `Historial de versiones de ${past.courseName}` }),
  ).toBeVisible();
});

test('teaching staff who cannot create the Roadmap are told so and still reach the history', async ({
  createCourse,
  createTerm,
  createUser,
  page,
  reportPosition,
}) => {
  const term = await createTerm();
  const professor = await createUser();
  const assistant = await createUser();
  const offering = await createCourse({
    ...term,
    roadmap: false,
    participants: [
      { user: professor, role: 'TEACHER', institutionalPosition: 'COURSE_PROFESSOR' },
      { user: assistant, role: 'TEACHER', institutionalPosition: 'TEACHING_ASSISTANT' },
    ],
  });
  await reportPosition(assistant, offering, 'TEACHING_ASSISTANT');
  const onlyProfessor = 'Solo el profesor de cátedra puede crear el roadmap.';

  await authenticateAs(page.context(), assistant.id);
  await page.goto('/academic-overview');
  await expect(page.getByText(onlyProfessor)).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Crear roadmap de ${offering.courseName}` }),
  ).toHaveCount(0);
  await page
    .getByRole('link', { name: `Historial de versiones de ${offering.courseName}` })
    .click();
  await expect(page).toHaveURL(new RegExp(`/courses/${offering.courseCode}/versions$`));
  await expect(page.getByRole('heading', { name: 'Historial de versiones' })).toBeVisible();

  await authenticateAs(page.context(), professor.id);
  await page.goto('/academic-overview');
  await expect(
    page.getByRole('button', { name: `Crear roadmap de ${offering.courseName}` }),
  ).toBeVisible();
  await expect(page.getByText(onlyProfessor)).toHaveCount(0);
});
