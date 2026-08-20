import { expect, request as apiRequest, test } from '@playwright/test';
import { SignJWT } from 'jose';
import { authenticateAs, fixture, roadmapPath, sessionCookie } from './helpers';

function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
}

test('fixture participants receive their authorized roadmap representation', async ({
  request,
}, testInfo) => {
  const anonymous = await request.get(roadmapPath());
  expect(anonymous.status()).toBe(401);

  const teacher = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.teacher) },
  });
  const teacherRoadmap = await teacher.get(roadmapPath());
  expect(teacherRoadmap.status()).toBe(200);
  expect(await teacherRoadmap.json()).toEqual(
    expect.objectContaining({
      course: expect.objectContaining({ code: 'CC1001', name: 'Programación I' }),
      nodes: expect.arrayContaining([expect.objectContaining({ title: 'Cierre del curso' })]),
    }),
  );
  await teacher.dispose();

  const student = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.studentWithoutProgress) },
  });
  const studentRoadmap = await student.get(roadmapPath());
  expect(studentRoadmap.status()).toBe(200);
  const studentDto = await studentRoadmap.json();
  expect(studentDto.nodes).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: fixture.programming.hiddenNode })]),
  );
  const mutation = await student.patch(roadmapPath(`/nodes/${fixture.programming.firstNode}`), {
    data: { title: 'No autorizado' },
  });
  expect(mutation.status()).toBe(403);
  await student.dispose();

  const inactive = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.inactiveStudent) },
  });
  expect((await inactive.get(roadmapPath())).status()).toBe(403);
  await inactive.dispose();
});

test('teacher API edits nodes, resources, dependencies, and custom types', async ({}, testInfo) => {
  const api = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.teacher) },
  });
  const typeName = uniqueName('Laboratorio E2E');
  const createdType = await api.post(roadmapPath('/node-types'), {
    data: { name: typeName, color: '#abcdef' },
  });
  expect(createdType.status()).toBe(201);
  const nodeType = (await createdType.json()).nodeType;

  const sourceResponse = await api.post(roadmapPath('/nodes'), {
    data: { title: uniqueName('Origen E2E'), nodeTypeId: nodeType.id, positionX: 0, positionY: 0 },
  });
  const targetResponse = await api.post(roadmapPath('/nodes'), {
    data: {
      title: uniqueName('Destino E2E'),
      nodeTypeId: nodeType.id,
      positionX: 120,
      positionY: 0,
    },
  });
  expect(sourceResponse.status()).toBe(201);
  expect(targetResponse.status()).toBe(201);
  const source = (await sourceResponse.json()).node;
  const target = (await targetResponse.json()).node;

  const resource = await api.post(roadmapPath(`/nodes/${source.id}/resources`), {
    data: { title: 'Guía E2E', url: 'https://example.test/e2e-guide', type: 'LINK' },
  });
  expect(resource.status()).toBe(201);
  const dependency = await api.post(roadmapPath('/dependencies'), {
    data: {
      sourceNodeId: source.id,
      targetNodeId: target.id,
      sourceHandle: 'bottom',
      targetHandle: 'top',
    },
  });
  expect(dependency.status()).toBe(201);
  expect(
    (
      await api.post(roadmapPath('/dependencies'), {
        data: { sourceNodeId: source.id, targetNodeId: source.id },
      })
    ).status(),
  ).toBe(409);

  const roadmap = await api.get(roadmapPath());
  expect(await roadmap.json()).toEqual(
    expect.objectContaining({
      nodeTypes: expect.arrayContaining([
        expect.objectContaining({ id: nodeType.id, name: typeName }),
      ]),
      dependencies: expect.arrayContaining([
        expect.objectContaining({ sourceNodeId: source.id, targetNodeId: target.id }),
      ]),
    }),
  );
  await api.dispose();
});

test('student completion obeys fixture prerequisites and is idempotent', async ({}, testInfo) => {
  const api = await apiRequest.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    extraHTTPHeaders: { cookie: await sessionCookie(fixture.studentWithoutProgress) },
  });
  const second = fixture.programming.secondNode;
  expect((await api.post(roadmapPath(`/nodes/${second}/completion`))).status()).toBe(409);
  expect(
    (await api.post(roadmapPath(`/nodes/${fixture.programming.firstNode}/completion`))).status(),
  ).toBe(200);
  expect((await api.post(roadmapPath(`/nodes/${second}/completion`))).status()).toBe(200);
  expect((await api.post(roadmapPath(`/nodes/${second}/completion`))).status()).toBe(200);
  await api.dispose();
});

test('teacher and student workflows render against the shared fixture', async ({ page }) => {
  await authenticateAs(page.context(), fixture.teacher);
  await page.goto('/courses/CC1001/2026/2');
  await expect(page.getByRole('heading', { name: 'Programación I' })).toBeVisible();
  const nodeTitle = uniqueName('Nodo creado desde E2E');
  await page.getByLabel('Título del nodo').fill(nodeTitle);
  await page.getByRole('button', { name: 'Agregar nodo' }).click();
  await expect(page.getByText(nodeTitle)).toBeVisible();

  await page.context().clearCookies();
  await authenticateAs(page.context(), fixture.studentWithProgress);
  await page.goto('/academic-overview');
  await expect(page.getByRole('heading', { name: 'Hola, Estudiante 02' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir roadmap' }).first().click();
  await page.getByText('Variables y tipos').click();
  await expect(page.getByRole('link', { name: 'Guía de variables' })).toHaveAttribute(
    'href',
    'https://example.test/programacion/variables',
  );
  await expect(page.getByRole('button', { name: 'Completar' })).toBeEnabled();
});

test('VTI callback issues a session after validating its one-time state', async ({
  request,
}, testInfo) => {
  const start = await request.get('/api/plogin/start', { maxRedirects: 0 });
  expect(start.status()).toBe(307);
  const state = new URL(start.headers().location).searchParams.get('state');
  expect(state).toBeTruthy();
  const stateCookie = start.headers()['set-cookie'].split(';', 1)[0];
  const token = await new SignJWT({
    identification: `0000${Date.now()}${testInfo.retry}-5`,
    email: `${crypto.randomUUID()}@example.test`,
    name: 'Persona VTI E2E',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .setIssuer(process.env.VTI_JWT_ISSUER ?? 'https://vti.example.test')
    .setAudience(process.env.VTI_JWT_AUDIENCE ?? 'u-roadmaps')
    .sign(new TextEncoder().encode(process.env.VTI_JWT_SECRET ?? 'e2e-vti-secret'));
  const callback = await request.post('/api/plogin', {
    maxRedirects: 0,
    headers: { cookie: stateCookie, 'content-type': 'application/x-www-form-urlencoded' },
    form: { jwt: token, state: state ?? '' },
  });
  expect(callback.status()).toBe(307);
  expect(callback.headers().location).toBe('/');
  const sessionCookieValue = callback.headers()['set-cookie'].split(';', 1)[0];
  const session = await request.get('/api/auth/session', {
    headers: { cookie: sessionCookieValue },
  });
  expect(await session.json()).toEqual(
    expect.objectContaining({ user: expect.objectContaining({ name: 'Persona VTI E2E' }) }),
  );
});
